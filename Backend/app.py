import os
import sys
import json
import random
import logging
import sqlite3
import re
import functools
import csv
import io
import threading
import time
import secrets
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, session, Response, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

# Try importing google-auth for official Google Identity verification
try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    HAS_GOOGLE_AUTH = True
except ImportError:
    google_id_token = None
    google_requests = None
    HAS_GOOGLE_AUTH = False

# Try importing psycopg for Supabase PostgreSQL
try:
    import psycopg
    from psycopg.rows import dict_row
    HAS_PSYCOPG = True
except ImportError:
    psycopg = None
    dict_row = None
    HAS_PSYCOPG = False

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger('easycart')

# Path configuration for modular Backend structure
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, '..'))
DIST_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'dist')
TEMPLATE_DIR = os.path.join(PROJECT_ROOT, 'Frontend')
STATIC_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'public', 'static')
BANNER_DIR = os.path.join(PROJECT_ROOT, 'banner')
DATA_FILE = os.path.join(BACKEND_DIR, 'products.json')
SQLITE_DB_FILE = os.path.join(BACKEND_DIR, 'easycart.db')
UPLOAD_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'public', 'uploads', 'products')
BACKEND_UPLOAD_DIR = os.path.join(BACKEND_DIR, 'uploads', 'products')

# ---------------------------------------------------------------------------
# Database URL — reads from environment; if absent, falls back to SQLite
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get('DATABASE_URL')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR, static_url_path='/static')
# Reverse-proxy support for Render deployment (correct client IP and HTTPS scheme)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

# Production Cookie & Session Security Configuration
is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('RENDER') == 'true'

# Secret key configuration:
# In production, require a strong, explicitly configured SECRET_KEY from environment variables.
# Refuse to start in production if SECRET_KEY is missing or insecure.
_secret = os.environ.get('SECRET_KEY')
if not _secret:
    if is_prod:
        logger.critical("FATAL: SECRET_KEY environment variable is required in production mode.")
        raise RuntimeError(
            "FATAL SECURITY ERROR: SECRET_KEY environment variable must be set in production mode on Render. "
            "Please configure a strong random secret key in your Render environment variables."
        )
    else:
        # Development key: generate and persist a strong random secret locally
        _dev_secret_file = os.path.join(BACKEND_DIR, '.dev_secret.key')
        if os.path.exists(_dev_secret_file):
            try:
                with open(_dev_secret_file, 'r', encoding='utf-8') as f:
                    _secret = f.read().strip()
            except Exception:
                _secret = None
        if not _secret or len(_secret) < 32:
            _secret = secrets.token_hex(32)
            try:
                with open(_dev_secret_file, 'w', encoding='utf-8') as f:
                    f.write(_secret)
            except Exception:
                pass
app.secret_key = _secret

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=is_prod,
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

# Google OAuth 2.0 Client & Administrator Allowlist Configuration
GOOGLE_CLIENT_ID = os.environ.get(
    'GOOGLE_CLIENT_ID',
    '334860227356-tmgcjjar1p1bf8g14nllr2qolldu60gr.apps.googleusercontent.com'
)

# STRICT TWO-ACCOUNT ADMINISTRATOR ALLOWLIST (Authoritative)
_raw_allowed = os.environ.get(
    'GOOGLE_ALLOWED_ADMIN_EMAILS',
    'suvrokayal2005@gmail.com,shraddha66singh66@gmail.com'
)
GOOGLE_ALLOWED_ADMIN_EMAILS = {e.strip().lower() for e in _raw_allowed.split(',') if e.strip()}

# Authoritative set of protected administrator accounts immune from deletion or deactivation
PROTECTED_ADMIN_EMAILS = set(GOOGLE_ALLOWED_ADMIN_EMAILS)

# In-Memory Authentication Rate Limiter (sliding window)
AUTH_FAILED_ATTEMPTS = {}
AUTH_RATE_LIMIT_LOCK = threading.Lock()

def check_auth_rate_limit(ip):
    now = time.time()
    with AUTH_RATE_LIMIT_LOCK:
        attempts = [t for t in AUTH_FAILED_ATTEMPTS.get(ip, []) if now - t < 300]
        AUTH_FAILED_ATTEMPTS[ip] = attempts
        return len(attempts) < 15

def record_failed_attempt(ip):
    now = time.time()
    with AUTH_RATE_LIMIT_LOCK:
        attempts = AUTH_FAILED_ATTEMPTS.get(ip, [])
        attempts.append(now)
        AUTH_FAILED_ATTEMPTS[ip] = [t for t in attempts if now - t < 300]

def verify_google_id_token(token_str):
    """Verify Google OAuth2 ID token using official google-auth library."""
    if not HAS_GOOGLE_AUTH:
        raise RuntimeError("google-auth package is not installed on this server.")

    req = google_requests.Request()
    id_info = google_id_token.verify_oauth2_token(
        token_str,
        req,
        audience=GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=10
    )

    # 1. Verify Issuer
    if id_info.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
        raise ValueError(f"Invalid Google token issuer: {id_info.get('iss')}")

    # 2. Verify Email verified by Google
    if not id_info.get('email_verified', False):
        raise ValueError("Google account email is not verified.")

    return id_info

def admin_required(f):
    """Security decorator ensuring caller is an authenticated and authorized administrator.
    
    Verifies:
      1. User is authenticated in session.
      2. Administrator session lifetime (12-hour limit).
      3. User exists in database.
      4. Account status is active.
      5. Database role is 'admin'.
      6. Normalized email is in GOOGLE_ALLOWED_ADMIN_EMAILS (never trusts database role alone).
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required. Please sign in as an administrator.'}), 401

        # Check administrator session lifetime (12 hours limit)
        admin_login_time = session.get('admin_login_time')
        if admin_login_time and (time.time() - admin_login_time > 12 * 3600):
            session.clear()
            session.modified = True
            return jsonify({'error': 'Administrator session has expired (12-hour limit). Please sign in again.'}), 401

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, email, role, status FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({'error': 'Administrator account not found.'}), 401

        if user.get('status') != 'active':
            return jsonify({'error': 'Administrator account is deactivated.'}), 403

        if user.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized: Administrator privileges required.'}), 403

        # STRICT ALLOWLIST: Never trust database role alone
        normalized_email = user.get('email', '').strip().lower()
        if normalized_email not in GOOGLE_ALLOWED_ADMIN_EMAILS:
            return jsonify({'error': 'Unauthorized: Email is not authorized for administrator access.'}), 403

        return f(*args, **kwargs)
    return decorated_function

# --- CSRF Protection & Token Management ---

@app.before_request
def csrf_protect_and_init():
    """Ensure CSRF token presence and verify authenticated state-changing requests."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(16)

    # For authenticated state-changing requests, require CSRF verification
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        # Exempt public / unauthenticated auth initialization endpoints
        public_exempt = (
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/google',
            '/api/cart/calculate',
        )
        if request.path in public_exempt:
            return None

        # If user is authenticated, verify CSRF header or XMLHttpRequest header
        if session.get('user_id'):
            token = request.headers.get('X-CSRF-Token')
            req_with = request.headers.get('X-Requested-With')
            session_token = session.get('csrf_token')
            if not ((token and token == session_token) or req_with == 'XMLHttpRequest'):
                return jsonify({'error': 'CSRF verification failed: missing or invalid CSRF token.'}), 403

@app.after_request
def set_csrf_cookie(response):
    """Expose CSRF token in a readable cookie for frontend fetch requests."""
    if 'csrf_token' in session:
        response.set_cookie(
            'csrf_token',
            session['csrf_token'],
            samesite='Lax',
            secure=is_prod,
            httponly=False
        )
    return response

# Route to serve banner images with validation
@app.route('/banner/<path:filename>')
def serve_banner(filename):
    from flask import send_from_directory, abort
    try:
        return send_from_directory(BANNER_DIR, filename)
    except Exception as e:
        logger.error(f"Error serving banner {filename}: {e}")
        abort(404)

# Predefined Demonstration Coupons
COUPONS = {
    'WELCOME10': {
        'code': 'WELCOME10',
        'type': 'percentage',
        'value': 10,
        'min_order': 200,
        'max_discount': 500,
        'description': '10% off on orders above ₹200 (Max discount ₹500)'
    },
    'SAVE50': {
        'code': 'SAVE50',
        'type': 'flat',
        'value': 50,
        'min_order': 499,
        'max_discount': 50,
        'description': 'Flat ₹50 off on orders above ₹499'
    },
    'FREESHIP': {
        'code': 'FREESHIP',
        'type': 'free_shipping',
        'value': 0,
        'min_order': 300,
        'max_discount': 40,
        'description': 'Free Delivery on orders above ₹300'
    }
}

DELIVERY_FEE = 40.0
FREE_DELIVERY_THRESHOLD = 999.0

# 25 Products across 8 categories with image_url support and offline fallbacks
SEED_PRODUCTS = [
    {
        "id": 1,
        "name": "USB-C Multiport Hub",
        "category": "Electronics",
        "price": 1499.00,
        "original_price": 2499.00,
        "quantity": 10,
        "rating": 4.5,
        "rating_count": 128,
        "image": "/static/images/p1.svg",
        "image_url": "https://m.media-amazon.com/images/I/618Cnb3N0qL.jpg",
        "description": "7-in-1 Aluminium Type-C Hub with 4K HDMI, 3 USB 3.0 ports, SD/TF card reader, and 100W Power Delivery."
    },
    {
        "id": 2,
        "name": "Samsung Galaxy S26 Ultra",
        "category": "Electronics",
        "price": 115999.00,
        "original_price": 130999.00,
        "quantity": 10,
        "rating": 4.8,
        "rating_count": 1412,
        "image": "/static/images/p2.svg",
        "image_url": "https://rukminim3.flixcart.com/image/480/640/xif0q/mobile/d/0/x/-resized-original-imahhyzrnhgzvdk4.jpeg?q=90",
        "description": "a flagship smartphone featuring a 6.9-inch Dynamic AMOLED 2X display, built-in privacy protection, and a 200MP main camera"
    },
    {
        "id": 3,
        "name": "Noise-Cancelling Wireless Headphones",
        "category": "Electronics",
        "price": 3499.00,
        "original_price": 5999.00,
        "quantity": 15,
        "rating": 4.7,
        "rating_count": 890,
        "image": "/static/images/p3.svg",
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
        "description": "Active Noise Cancellation, 40-hour battery life, plush memory foam earcups, and crystal-clear hands-free calling."
    },
    {
        "id": 4,
        "name": "Smart Fitness Watch with SpO2",
        "category": "Electronics",
        "price": 2199.00,
        "original_price": 3999.00,
        "quantity": 22,
        "rating": 4.3,
        "rating_count": 340,
        "image": "/static/images/p4.svg",
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        "description": "1.78-inch HD curved display, 24/7 heart rate and blood oxygen monitoring, 100+ sports modes, and 7-day battery."
    },
    {
        "id": 5,
        "name": "Organic Arabica Coffee Beans (500g)",
        "category": "Grocery",
        "price": 499.00,
        "original_price": 650.00,
        "quantity": 30,
        "rating": 4.8,
        "rating_count": 215,
        "image": "/static/images/p5.svg",
        "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80",
        "description": "100% single-origin roasted Arabica beans sourced from high-altitude estates with notes of dark chocolate and hazelnut."
    },
    {
        "id": 6,
        "name": "Cold-Pressed Extra Virgin Olive Oil (1L)",
        "category": "Grocery",
        "price": 950.00,
        "original_price": 1200.00,
        "quantity": 18,
        "rating": 4.6,
        "rating_count": 180,
        "image": "/static/images/p6.svg",
        "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
        "description": "Pure Mediterranean first cold-pressed olive oil, naturally rich in antioxidants and healthy monounsaturated fats."
    },
    {
        "id": 7,
        "name": "Premium California Raw Almonds (500g)",
        "category": "Grocery",
        "price": 420.00,
        "original_price": 550.00,
        "quantity": 25,
        "rating": 4.7,
        "rating_count": 320,
        "image": "/static/images/p7.svg",
        "image_url": "https://storage.googleapis.com/shy-pub/303196/ChatGPTImageMay14202604_04_08PM-1783947728828.png",
        "description": "Crisp, unpasteurized natural almonds vacuum-packed to preserve crunch and rich vitamin E content."
    },
    {
        "id": 8,
        "name": "Men's Classic Slim-Fit Oxford Shirt",
        "category": "Fashion",
        "price": 1299.00,
        "original_price": 1999.00,
        "quantity": 14,
        "rating": 4.4,
        "rating_count": 156,
        "image": "/static/images/p8.svg",
        "image_url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80",
        "description": "100% breathable combed cotton with button-down collar, tailored cuffs, and subtle texture ideal for work or casual wear."
    },
    {
        "id": 9,
        "name": "Women's Canvas Everyday Tote Bag",
        "category": "Fashion",
        "price": 899.00,
        "original_price": 1499.00,
        "quantity": 20,
        "rating": 4.6,
        "rating_count": 278,
        "image": "/static/images/p9.svg",
        "image_url": "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80",
        "description": "Heavyweight 16oz eco-friendly canvas tote with reinforced double handles and a zippered internal stash pocket."
    },
    {
        "id": 10,
        "name": "Polarized Aviator Sunglasses",
        "category": "Fashion",
        "price": 799.00,
        "original_price": 1599.00,
        "quantity": 19,
        "rating": 4.5,
        "rating_count": 190,
        "image": "/static/images/p10.svg",
        "image_url": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80",
        "description": "UV400 scratch-resistant polarized lenses with a lightweight stainless steel alloy frame and silicone nose pads."
    },
    {
        "id": 11,
        "name": "Cast Iron Pre-Seasoned Skillet (10-inch)",
        "category": "Home & Kitchen",
        "price": 1450.00,
        "original_price": 2100.00,
        "quantity": 12,
        "rating": 4.8,
        "rating_count": 520,
        "image": "/static/images/p11.svg",
        "image_url": "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=600&q=80",
        "description": "Heavy-duty cast iron pan seasoned with 100% natural vegetable oil for superior heat retention and uniform searing."
    },
    {
        "id": 12,
        "name": "Borosilicate Glass Food Storage Set",
        "category": "Home & Kitchen",
        "price": 999.00,
        "original_price": 1699.00,
        "quantity": 16,
        "rating": 4.5,
        "rating_count": 310,
        "image": "/static/images/p12.svg",
        "image_url": "https://image.made-in-china.com/202f0j00ZQNoSRYtYOgu/4-PCS-Set-Lead-Free-Wholesale-High-Borosilicate-Glass-Lunch-Box.webp",
        "description": "Microwave and oven-safe containers with airtight silicone clip-lock lids, 100% leakproof and BPA-free."
    },
    {
        "id": 13,
        "name": "Modern Minimalist Ceramic Desk Lamp",
        "category": "Home & Kitchen",
        "price": 1699.00,
        "original_price": 2499.00,
        "quantity": 8,
        "rating": 4.7,
        "rating_count": 142,
        "image": "/static/images/p13.svg",
        "image_url": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80",
        "description": "Handcrafted matte ceramic base with warm fabric shade, dimmer switch, and energy-efficient warm LED bulb included."
    },
    {
        "id": 14,
        "name": "Vitamin C + Hyaluronic Acid Glow Serum (30ml)",
        "category": "Beauty & Personal Care",
        "price": 599.00,
        "original_price": 899.00,
        "quantity": 28,
        "rating": 4.6,
        "rating_count": 640,
        "image": "/static/images/p14.svg",
        "image_url": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
        "description": "Dermatologist-tested glow formulation with 10% pure ethyl ascorbic acid and moisture-locking hyaluronic acid."
    },
    {
        "id": 15,
        "name": "Natural Tea Tree & Rosemary Hair Care Kit",
        "category": "Beauty & Personal Care",
        "price": 799.00,
        "original_price": 1199.00,
        "quantity": 17,
        "rating": 4.4,
        "rating_count": 210,
        "image": "/static/images/p15.svg",
        "image_url": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80",
        "description": "Sulphate-free purifying shampoo and conditioner set formulated to reduce dandruff and strengthen roots."
    },
    {
        "id": 16,
        "name": "Ultrasonic Sonic Electric Toothbrush",
        "category": "Beauty & Personal Care",
        "price": 1499.00,
        "original_price": 2499.00,
        "quantity": 11,
        "rating": 4.7,
        "rating_count": 380,
        "image": "/static/images/p16.svg",
        "image_url": "https://m.media-amazon.com/images/I/71CiwYb8itL.jpg",
        "description": "40,000 vibrations/min with 5 tailored modes, 2-minute smart timer, and 30-day wireless charging battery."
    },
    {
        "id": 17,
        "name": "Classic Hardcover Dotted Journal (A5)",
        "category": "Books & Stationery",
        "price": 449.00,
        "original_price": 699.00,
        "quantity": 35,
        "rating": 4.8,
        "rating_count": 490,
        "image": "/static/images/p17.svg",
        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
        "description": "160 GSM thick bleedproof bamboo paper with faux leather binding, dual ribbon bookmarks, and an expandable back pocket."
    },
    {
        "id": 18,
        "name": "Vintage Brass Fountain Pen with Fine Nib",
        "category": "Books & Stationery",
        "price": 899.00,
        "original_price": 1399.00,
        "quantity": 14,
        "rating": 4.7,
        "rating_count": 135,
        "image": "/static/images/p18.svg",
        "image_url": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80",
        "description": "Precision weighted solid brass barrel with German iridium-tipped fine nib and piston ink converter included."
    },
    {
        "id": 19,
        "name": "Bestseller Productivity & Mindset Book",
        "category": "Books & Stationery",
        "price": 399.00,
        "original_price": 599.00,
        "quantity": 25,
        "rating": 4.9,
        "rating_count": 880,
        "image": "/static/images/p19.svg",
        "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80",
        "description": "Transformative guide to building sustainable habits, deep focus, and high performance in everyday professional life."
    },
    {
        "id": 20,
        "name": "High-Density Non-Slip Yoga Mat (6mm)",
        "category": "Sports & Fitness",
        "price": 799.00,
        "original_price": 1299.00,
        "quantity": 20,
        "rating": 4.6,
        "rating_count": 310,
        "image": "/static/images/p20.svg",
        "image_url": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=600&q=80",
        "description": "Eco-friendly TPE dual-layer mat with alignment guidelines, joint cushioning, and complimentary carry strap."
    },
    {
        "id": 21,
        "name": "Adjustable Neoprene Dumbbells Pair (10kg Total)",
        "category": "Sports & Fitness",
        "price": 1899.00,
        "original_price": 2899.00,
        "quantity": 9,
        "rating": 4.5,
        "rating_count": 175,
        "image": "/static/images/p21.svg",
        "image_url": "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=600&q=80",
        "description": "Hexagonal anti-roll cast iron weights with comfortable non-slip neoprene coating for home strength workouts."
    },
    {
        "id": 22,
        "name": "Insulated Stainless Steel Sports Flask (750ml)",
        "category": "Sports & Fitness",
        "price": 649.00,
        "original_price": 999.00,
        "quantity": 24,
        "rating": 4.7,
        "rating_count": 425,
        "image": "/static/images/p22.svg",
        "image_url": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
        "description": "Double-wall vacuum insulation keeps drinks chilled for 24 hours or piping hot for 12 hours. Sweat-proof powder finish."
    },
    {
        "id": 23,
        "name": "Magnetic STEM Building Tiles Set (64 Pcs)",
        "category": "Toys & Accessories",
        "price": 1299.00,
        "original_price": 1899.00,
        "quantity": 15,
        "rating": 4.8,
        "rating_count": 290,
        "image": "/static/images/p23.svg",
        "image_url": "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80",
        "description": "Vibrant translucent 3D geometric magnetic building tiles fostering creativity, spatial reasoning, and engineering skills."
    },
    {
        "id": 24,
        "name": "Smart RC Stunt Drone with HD Camera",
        "category": "Toys & Accessories",
        "price": 2799.00,
        "original_price": 4499.00,
        "quantity": 7,
        "rating": 4.4,
        "rating_count": 140,
        "image": "/static/images/p24.svg",
        "image_url": "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=600&q=80",
        "description": "Altitude hold, 360-degree flip maneuvers, one-key return, and real-time FPV Wi-Fi camera with smartphone holder."
    },
    {
        "id": 25,
        "name": "Speed Cube 3x3 Smooth Turning Puzzle",
        "category": "Toys & Accessories",
        "price": 349.00,
        "original_price": 549.00,
        "quantity": 30,
        "rating": 4.7,
        "rating_count": 510,
        "image": "/static/images/p25.svg",
        "image_url": "https://images.unsplash.com/photo-1591991731833-b4807cf7ef94?auto=format&fit=crop&w=600&q=80",
        "description": "Stickerless frosted surface with anti-pop mechanism and adjustable tension for lightning-fast competition turns."
    }
]

# ---------------------------------------------------------------------------
# SQLite Compatibility Wrapper (translates standard %s queries & dict rows)
# ---------------------------------------------------------------------------
class DictWithIndex(dict):
    """Dictionary supporting integer column indexing for SQL compatibility."""
    def __getitem__(self, item):
        if isinstance(item, int):
            return list(self.values())[item]
        return super().__getitem__(item)

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        sqlite_query = re.sub(r'%s', '?', query)
        if params is None:
            return self._cursor.execute(sqlite_query)
        return self._cursor.execute(sqlite_query, params)

    def fetchone(self):
        row = self._cursor.fetchone()
        return DictWithIndex(dict(row)) if row is not None else None

    def fetchall(self):
        return [DictWithIndex(dict(r)) for r in self._cursor.fetchall()]

    def __getattr__(self, name):
        return getattr(self._cursor, name)

class SQLiteConnWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

# ---------------------------------------------------------------------------
# Unified Database Connection Helper
# ---------------------------------------------------------------------------
def get_db():
    """Return a database connection with dict-like row access.

    If DATABASE_URL is set (e.g. on Render with Supabase PostgreSQL),
    connects via psycopg. If not set, falls back seamlessly to local SQLite.
    """
    db_url = os.environ.get('DATABASE_URL')
    if db_url and HAS_PSYCOPG:
        if 'sslmode' not in db_url:
            separator = '&' if '?' in db_url else '?'
            db_url += f'{separator}sslmode=require'
        return psycopg.connect(db_url, row_factory=dict_row)
    else:
        conn = sqlite3.connect(SQLITE_DB_FILE)
        conn.row_factory = sqlite3.Row
        return SQLiteConnWrapper(conn)

# ---------------------------------------------------------------------------
# Schema Initialization — Idempotent & Works on both Postgres & SQLite
# ---------------------------------------------------------------------------
def init_db():
    """Create tables if they don't exist, run safe migrations, and seed data."""
    is_postgres = bool(os.environ.get('DATABASE_URL') and HAS_PSYCOPG)
    conn = get_db()
    cursor = conn.cursor()

    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Electronics',
                price DOUBLE PRECISION NOT NULL,
                original_price DOUBLE PRECISION,
                quantity INTEGER NOT NULL DEFAULT 0,
                rating DOUBLE PRECISION DEFAULT 4.5,
                rating_count INTEGER DEFAULT 50,
                image TEXT,
                image_url TEXT,
                description TEXT
            )
        ''')
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'image_url'
        """)
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE products ADD COLUMN image_url TEXT")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                status TEXT DEFAULT 'active',
                last_login TIMESTAMP,
                google_id TEXT UNIQUE,
                avatar_url TEXT,
                auth_provider TEXT DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'google_id'
        """)
        if not cursor.fetchone():
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE")
                cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
                cursor.execute("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'")
            except Exception:
                pass

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                postal_code TEXT NOT NULL,
                subtotal DOUBLE PRECISION NOT NULL,
                discount DOUBLE PRECISION NOT NULL DEFAULT 0,
                delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
                total DOUBLE PRECISION NOT NULL,
                coupon_code TEXT,
                payment_method TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price DOUBLE PRECISION NOT NULL,
                quantity INTEGER NOT NULL,
                total_price DOUBLE PRECISION NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        ''')
        conn.commit()

        for p in SEED_PRODUCTS:
            img_url = p.get('image_url') or p.get('image')
            cursor.execute('''
                INSERT INTO products (id, name, category, price, original_price, quantity, rating, rating_count, image, image_url, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            ''', (
                p['id'], p['name'], p['category'], p['price'], p['original_price'],
                p['quantity'], p['rating'], p['rating_count'], p.get('image', img_url), img_url, p['description']
            ))

        cursor.execute("SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1))")
        conn.commit()
    else:
        # SQLite Initialization
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Electronics',
                price REAL NOT NULL,
                original_price REAL,
                quantity INTEGER NOT NULL DEFAULT 0,
                rating REAL DEFAULT 4.5,
                rating_count INTEGER DEFAULT 50,
                image TEXT,
                image_url TEXT,
                description TEXT
            )
        ''')
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
        except Exception:
            pass

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                status TEXT DEFAULT 'active',
                last_login TIMESTAMP,
                google_id TEXT,
                avatar_url TEXT,
                auth_provider TEXT DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        for col_name, col_def in [
            ("role", "TEXT DEFAULT 'customer'"),
            ("status", "TEXT DEFAULT 'active'"),
            ("last_login", "TIMESTAMP"),
            ("google_id", "TEXT"),
            ("avatar_url", "TEXT"),
            ("auth_provider", "TEXT DEFAULT 'local'"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except Exception:
                pass
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL")
        except Exception:
            pass

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                postal_code TEXT NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL NOT NULL DEFAULT 0,
                delivery_fee REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL,
                coupon_code TEXT,
                payment_method TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                total_price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        ''')
        conn.commit()

        for p in SEED_PRODUCTS:
            img_url = p.get('image_url') or p.get('image')
            cursor.execute('''
                INSERT INTO products (id, name, category, price, original_price, quantity, rating, rating_count, image, image_url, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            ''', (
                p['id'], p['name'], p['category'], p['price'], p['original_price'],
                p['quantity'], p['rating'], p['rating_count'], p.get('image', img_url), img_url, p['description']
            ))
        conn.commit()

    # Platform Enhancements Schema Migration (categories, suppliers, product enhancements)
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT,
                image_url TEXT,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                supplied_categories TEXT,
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        for col_name, col_type in [
            ('category_id', 'INTEGER REFERENCES categories(id)'),
            ('subcategory_id', 'INTEGER REFERENCES categories(id)'),
            ('nested_category_id', 'INTEGER REFERENCES categories(id)'),
            ('sku', 'TEXT'),
            ('supplier_id', 'INTEGER REFERENCES suppliers(id)'),
            ('gallery_images', 'TEXT'),
            ('is_active', 'INTEGER DEFAULT 1')
        ]:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'products' AND column_name = %s
            """, (col_name,))
            if not cursor.fetchone():
                try:
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
        try:
            cursor.execute("UPDATE products SET is_active = 1 WHERE is_active IS NULL")
        except Exception:
            pass
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT,
                image_url TEXT,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                supplied_categories TEXT,
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute("PRAGMA table_info(products)")
        existing_cols = [c[1] for c in cursor.fetchall()]
        for col_name, col_type in [
            ('category_id', 'INTEGER REFERENCES categories(id)'),
            ('subcategory_id', 'INTEGER REFERENCES categories(id)'),
            ('nested_category_id', 'INTEGER REFERENCES categories(id)'),
            ('sku', 'TEXT'),
            ('supplier_id', 'INTEGER REFERENCES suppliers(id)'),
            ('gallery_images', 'TEXT'),
            ('is_active', 'INTEGER DEFAULT 1')
        ]:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
        try:
            cursor.execute("UPDATE products SET is_active = 1 WHERE is_active IS NULL")
        except Exception:
            pass
    conn.commit()

    # Controlled cleanup: ensure only allowlisted Google emails retain 'admin' role
    cursor.execute('''
        UPDATE users
        SET role = 'customer'
        WHERE role = 'admin' AND LOWER(email) NOT IN (%s, %s)
    ''', ('suvrokayal2005@gmail.com', 'shraddha66singh66@gmail.com'))
    conn.commit()

    sync_json_from_db(conn)
    conn.close()
    logger.info("Database initialized successfully.")

def sync_json_from_db(conn=None):
    """Keep Backend/products.json synchronized with database."""
    close_after = False
    if conn is None:
        conn = get_db()
        close_after = True
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products ORDER BY id ASC')
    rows = cursor.fetchall()
    data = list(rows)
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, default=str)
    except (OSError, IOError) as e:
        logger.debug(f"Could not write products.json: {e}")
    if close_after:
        conn.close()

# Auto-initialize database on application launch
try:
    init_db()
except Exception as e:
    logger.error(f"Error during database initialization: {e}", exc_info=True)

# --- Storefront Routes ---

@app.route('/')
def index():
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        from flask import send_from_directory
        return send_from_directory(DIST_DIR, 'index.html')
    return render_template('index.html')

@app.route('/assets/<path:filename>')
def serve_dist_assets(filename):
    from flask import send_from_directory
    return send_from_directory(os.path.join(DIST_DIR, 'assets'), filename)

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Endpoint not found'}), 404
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        from flask import send_from_directory
        return send_from_directory(DIST_DIR, 'index.html')
    return e, 404

def get_category_tree_response():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*,
               (SELECT COUNT(*) FROM products pr 
                WHERE pr.category_id = c.id 
                   OR pr.subcategory_id = c.id 
                   OR pr.nested_category_id = c.id) AS product_count
        FROM categories c
        WHERE c.is_active = 1
        ORDER BY c.display_order ASC, c.name ASC
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    def build_tree(items, parent_id=None):
        branch = []
        for item in items:
            if item.get('parent_id') == parent_id:
                node = dict(item)
                node['children'] = build_tree(items, item['id'])
                branch.append(node)
        return branch

    return jsonify(build_tree(rows, None))

def check_category_cycle(cursor, cat_id, proposed_parent_id):
    """Return True if proposed_parent_id creates a circular reference."""
    if proposed_parent_id is None:
        return False
    if proposed_parent_id == cat_id:
        return True
    curr = proposed_parent_id
    visited = set()
    while curr is not None:
        if curr == cat_id:
            return True
        if curr in visited:
            break
        visited.add(curr)
        cursor.execute("SELECT parent_id FROM categories WHERE id = %s", (curr,))
        row = cursor.fetchone()
        if not row:
            break
        curr = row['parent_id'] if isinstance(row, dict) else row[0]
    return False

def make_category_slug(name):
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug.strip('-')

@app.route('/api/categories', methods=['GET'])
def get_categories():
    fmt = request.args.get('format', '').lower()
    if fmt == 'tree':
        return get_category_tree_response()
    if fmt in ('all', 'flat'):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM categories ORDER BY display_order ASC, name ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)
    # Default 8 categories list for 100% backward compatibility
    categories = [
        "Electronics",
        "Grocery",
        "Fashion",
        "Home & Kitchen",
        "Beauty & Personal Care",
        "Books & Stationery",
        "Sports & Fitness",
        "Toys & Accessories"
    ]
    return jsonify(categories)

@app.route('/api/categories/tree', methods=['GET'])
def get_category_tree():
    return get_category_tree_response()

@app.route('/api/coupons', methods=['GET'])
def get_coupons():
    return jsonify(list(COUPONS.values()))

@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        category = request.args.get('category')
        category_id = request.args.get('category_id', type=int)
        subcategory_id = request.args.get('subcategory_id', type=int)
        supplier_id = request.args.get('supplier_id', type=int)
        search = request.args.get('search', '').strip().lower()
        sort_by = request.args.get('sort', 'default')
        in_stock_only = request.args.get('in_stock', 'false').lower() == 'true'
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

        conn = get_db()
        cursor = conn.cursor()

        query = 'SELECT * FROM products WHERE 1=1'
        params = []

        if not include_inactive:
            query += ' AND COALESCE(is_active, 1) = 1'

        if category_id is not None:
            query += ' AND (category_id = %s OR subcategory_id = %s OR nested_category_id = %s)'
            params.extend([category_id, category_id, category_id])

        if subcategory_id is not None:
            query += ' AND (subcategory_id = %s OR nested_category_id = %s)'
            params.extend([subcategory_id, subcategory_id])

        if supplier_id is not None:
            query += ' AND supplier_id = %s'
            params.append(supplier_id)

        if category and category.lower() != 'all':
            query += ' AND LOWER(category) = LOWER(%s)'
            params.append(category)

        if search:
            query += ' AND (LOWER(name) LIKE %s OR LOWER(description) LIKE %s)'
            params.extend([f'%{search}%', f'%{search}%'])

        if in_stock_only:
            query += ' AND quantity > 0'

        if min_price is not None:
            query += ' AND price >= %s'
            params.append(min_price)

        if max_price is not None:
            query += ' AND price <= %s'
            params.append(max_price)

        if sort_by == 'price_asc':
            query += ' ORDER BY price ASC'
        elif sort_by == 'price_desc':
            query += ' ORDER BY price DESC'
        elif sort_by == 'discount':
            query += ' ORDER BY ((original_price - price) / NULLIF(original_price, 0)) DESC'
        elif sort_by == 'rating':
            query += ' ORDER BY rating DESC'
        elif sort_by == 'name':
            query += ' ORDER BY name ASC'
        else:
            query += ' ORDER BY id ASC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        products = []
        for r in rows:
            p = dict(r)
            if p.get('gallery_images') and isinstance(p['gallery_images'], str):
                try:
                    p['gallery_images'] = json.loads(p['gallery_images'])
                except Exception:
                    p['gallery_images'] = []
            elif not p.get('gallery_images'):
                p['gallery_images'] = []
            products.append(p)
        conn.close()

        return jsonify(products)
    except Exception as e:
        logger.error(f"Error querying products: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve products', 'details': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    product = dict(row)
    if product.get('gallery_images') and isinstance(product['gallery_images'], str):
        try:
            product['gallery_images'] = json.loads(product['gallery_images'])
        except Exception:
            product['gallery_images'] = []
    elif not product.get('gallery_images'):
        product['gallery_images'] = []

    if product.get('supplier_id'):
        try:
            cursor.execute('SELECT name, contact_person, email, phone FROM suppliers WHERE id = %s', (product['supplier_id'],))
            s_row = cursor.fetchone()
            if s_row:
                product['supplier_name'] = s_row['name']
                product['supplier_info'] = dict(s_row)
        except Exception:
            pass

    cursor.execute('''
        SELECT * FROM products
        WHERE category = %s AND id != %s
        LIMIT 4
    ''', (product['category'], product_id))
    related = []
    for r in cursor.fetchall():
        rp = dict(r)
        if rp.get('gallery_images') and isinstance(rp['gallery_images'], str):
            try:
                rp['gallery_images'] = json.loads(rp['gallery_images'])
            except Exception:
                rp['gallery_images'] = []
        related.append(rp)
    conn.close()

    return jsonify({
        'product': product,
        'related': related
    })

# Product Catalog Mutation Endpoints (Strictly Protected)
@app.route('/api/products', methods=['POST'])
@admin_required
def add_product():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    category = data.get('category', 'Electronics')
    quantity = int(data.get('quantity', 0))
    price = float(data.get('price', 0.0))
    original_price = float(data.get('original_price', price * 1.25))
    image_url = data.get('image_url') or data.get('image', '/static/images/p1.svg')
    image = data.get('image', image_url)
    description = data.get('description', 'Authentic product with standard brand warranty.')

    category_id = data.get('category_id')
    subcategory_id = data.get('subcategory_id')
    nested_category_id = data.get('nested_category_id')
    supplier_id = data.get('supplier_id')
    sku = data.get('sku') or f"EC-{category[:3].upper()}-{int(time.time()) % 100000:05d}"
    gallery_images = data.get('gallery_images')
    if isinstance(gallery_images, list):
        gallery_images_str = json.dumps(gallery_images)
    else:
        gallery_images_str = gallery_images if gallery_images else '[]'

    is_active = 1 if data.get('is_active', 1) in (1, True, '1', 'true') else 0

    if not name or price < 0 or quantity < 0:
        return jsonify({'error': 'Invalid product parameters'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (
            name, category, price, original_price, quantity, rating, rating_count,
            image, image_url, description, category_id, subcategory_id,
            nested_category_id, sku, supplier_id, gallery_images, is_active
        )
        VALUES (%s, %s, %s, %s, %s, 4.5, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (
        name, category, price, original_price, quantity,
        image, image_url, description, category_id, subcategory_id,
        nested_category_id, sku, supplier_id, gallery_images_str, is_active
    ))
    new_id = cursor.fetchone()['id']
    conn.commit()

    cursor.execute('SELECT * FROM products WHERE id = %s', (new_id,))
    new_product = dict(cursor.fetchone())
    if new_product.get('gallery_images') and isinstance(new_product['gallery_images'], str):
        try:
            new_product['gallery_images'] = json.loads(new_product['gallery_images'])
        except Exception:
            new_product['gallery_images'] = []
    sync_json_from_db(conn)
    conn.close()

    return jsonify(new_product), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    name = data.get('name', existing['name'])
    category = data.get('category', existing['category'])
    quantity = int(data.get('quantity', existing['quantity']))
    price = float(data.get('price', existing['price']))
    original_price = float(data.get('original_price', existing['original_price']))
    description = data.get('description', existing['description'])
    image_url = data.get('image_url', existing.get('image_url') or existing.get('image'))
    image = data.get('image', image_url)

    category_id = data.get('category_id', existing.get('category_id'))
    subcategory_id = data.get('subcategory_id', existing.get('subcategory_id'))
    nested_category_id = data.get('nested_category_id', existing.get('nested_category_id'))
    supplier_id = data.get('supplier_id', existing.get('supplier_id'))
    sku = data.get('sku', existing.get('sku'))
    gallery_images = data.get('gallery_images', existing.get('gallery_images'))
    if isinstance(gallery_images, list):
        gallery_images_str = json.dumps(gallery_images)
    else:
        gallery_images_str = gallery_images if gallery_images else '[]'

    is_active = existing.get('is_active', 1)
    if 'is_active' in data:
        is_active = 1 if data['is_active'] in (1, True, '1', 'true') else 0

    cursor.execute('''
        UPDATE products
        SET name = %s, category = %s, quantity = %s, price = %s, original_price = %s,
            description = %s, image = %s, image_url = %s, category_id = %s,
            subcategory_id = %s, nested_category_id = %s, sku = %s,
            supplier_id = %s, gallery_images = %s, is_active = %s
        WHERE id = %s
    ''', (
        name, category, quantity, price, original_price,
        description, image, image_url, category_id,
        subcategory_id, nested_category_id, sku,
        supplier_id, gallery_images_str, is_active, product_id
    ))
    conn.commit()

    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    updated = dict(cursor.fetchone())
    if updated.get('gallery_images') and isinstance(updated['gallery_images'], str):
        try:
            updated['gallery_images'] = json.loads(updated['gallery_images'])
        except Exception:
            updated['gallery_images'] = []
    sync_json_from_db(conn)
    conn.close()

    return jsonify(updated)

@app.route('/api/products/<int:product_id>/status', methods=['PATCH'])
@admin_required
def toggle_product_status(product_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    current_status = prod.get('is_active')
    if current_status is None:
        current_status = 1
    new_status = 0 if current_status == 1 else 1
    if 'is_active' in data:
        new_status = 1 if data['is_active'] in (1, True, '1', 'true') else 0

    cursor.execute('UPDATE products SET is_active = %s WHERE id = %s', (new_status, product_id))
    conn.commit()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    updated = dict(cursor.fetchone())
    if updated.get('gallery_images') and isinstance(updated['gallery_images'], str):
        try:
            updated['gallery_images'] = json.loads(updated['gallery_images'])
        except Exception:
            updated['gallery_images'] = []
    sync_json_from_db(conn)
    conn.close()
    return jsonify(updated)

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM products WHERE id = %s', (product_id,))
    conn.commit()
    sync_json_from_db(conn)
    conn.close()
    return jsonify({'success': True})

# --- Cart Calculation & Coupons ---

def calculate_cart_totals(cart_items, coupon_code=None):
    conn = get_db()
    cursor = conn.cursor()

    verified_items = []
    subtotal = 0.0
    stock_errors = []

    for item in cart_items:
        pid = item.get('id')
        req_qty = int(item.get('quantity', 1))
        if req_qty <= 0:
            continue

        cursor.execute('SELECT * FROM products WHERE id = %s', (pid,))
        prod = cursor.fetchone()
        if not prod:
            stock_errors.append(f"Product ID {pid} is no longer available.")
            continue

        p_dict = dict(prod)
        if p_dict['quantity'] < req_qty:
            stock_errors.append(f"Only {p_dict['quantity']} unit(s) left for '{p_dict['name']}'.")

        item_total = round(p_dict['price'] * req_qty, 2)
        subtotal += item_total

        verified_items.append({
            'id': p_dict['id'],
            'name': p_dict['name'],
            'category': p_dict['category'],
            'price': p_dict['price'],
            'original_price': p_dict['original_price'],
            'image': p_dict.get('image'),
            'image_url': p_dict.get('image_url') or p_dict.get('image'),
            'quantity': req_qty,
            'max_stock': p_dict['quantity'],
            'total': item_total
        })

    conn.close()
    subtotal = round(subtotal, 2)

    discount_amount = 0.0
    applied_coupon = None
    coupon_message = None

    if coupon_code:
        code_upper = coupon_code.strip().upper()
        if code_upper in COUPONS:
            rule = COUPONS[code_upper]
            if subtotal < rule['min_order']:
                coupon_message = f"Coupon '{code_upper}' requires a minimum cart value of ₹{rule['min_order']}."
            else:
                if rule['type'] == 'percentage':
                    calc_discount = (subtotal * rule['value']) / 100.0
                    discount_amount = min(calc_discount, rule['max_discount'])
                elif rule['type'] == 'flat':
                    discount_amount = min(rule['value'], subtotal)
                elif rule['type'] == 'free_shipping':
                    discount_amount = 0.0

                discount_amount = round(discount_amount, 2)
                applied_coupon = {
                    'code': code_upper,
                    'discount': discount_amount,
                    'type': rule['type'],
                    'description': rule['description']
                }
                coupon_message = f"Coupon '{code_upper}' applied successfully!"
        else:
            coupon_message = f"Invalid coupon code '{coupon_code}'."

    delivery_fee = DELIVERY_FEE if subtotal > 0 else 0.0
    if subtotal >= FREE_DELIVERY_THRESHOLD or (applied_coupon and applied_coupon['type'] == 'free_shipping'):
        delivery_fee = 0.0

    final_total = max(0.0, round(subtotal - discount_amount + delivery_fee, 2))

    return {
        'items': verified_items,
        'subtotal': subtotal,
        'discount': discount_amount,
        'delivery_fee': delivery_fee,
        'total': final_total,
        'free_delivery_threshold': FREE_DELIVERY_THRESHOLD,
        'applied_coupon': applied_coupon,
        'coupon_message': coupon_message,
        'stock_errors': stock_errors
    }

@app.route('/api/cart/calculate', methods=['POST'])
def api_calculate_cart():
    data = request.get_json(silent=True) or {}
    items = data.get('items', [])
    coupon_code = data.get('coupon_code')
    calculation = calculate_cart_totals(items, coupon_code)
    return jsonify(calculation)

# --- Checkout ---

@app.route('/api/cart/checkout', methods=['POST'])
def api_checkout():
    data = request.get_json(silent=True) or {}
    cart_items = data.get('items', [])
    coupon_code = data.get('coupon_code')
    delivery_info = data.get('delivery', {})
    payment_method = data.get('payment_method', 'Cash on Delivery (Demo)')

    if not cart_items:
        return jsonify({'error': 'Your cart is empty'}), 400

    required_fields = ['name', 'email', 'phone', 'address', 'city', 'state', 'postal_code']
    for field in required_fields:
        if not delivery_info.get(field, '').strip():
            return jsonify({'error': f"Please enter your {field.replace('_', ' ').capitalize()}."}), 400

    conn = get_db()
    cursor = conn.cursor()

    for item in cart_items:
        pid = item.get('id')
        req_qty = int(item.get('quantity', 1))
        cursor.execute('SELECT quantity, name FROM products WHERE id = %s', (pid,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': f"Product ID {pid} is no longer available"}), 404
        if row['quantity'] < req_qty:
            conn.close()
            return jsonify({
                'error': f"Insufficient stock for '{row['name']}'. Only {row['quantity']} available."
            }), 400

    calc = calculate_cart_totals(cart_items, coupon_code)
    if calc['stock_errors']:
        conn.close()
        return jsonify({'error': calc['stock_errors'][0]}), 400

    order_id = f"EC-{random.randint(100000, 999999)}"
    user_id = session.get('user_id')

    cursor.execute('''
        INSERT INTO orders (
            id, user_id, customer_name, customer_email, customer_phone,
            address, city, state, postal_code, subtotal, discount,
            delivery_fee, total, coupon_code, payment_method, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Confirmed')
    ''', (
        order_id, user_id,
        delivery_info['name'].strip(),
        delivery_info['email'].strip(),
        delivery_info['phone'].strip(),
        delivery_info['address'].strip(),
        delivery_info['city'].strip(),
        delivery_info['state'].strip(),
        delivery_info['postal_code'].strip(),
        calc['subtotal'],
        calc['discount'],
        calc['delivery_fee'],
        calc['total'],
        calc['applied_coupon']['code'] if calc['applied_coupon'] else None,
        payment_method
    ))

    for item in calc['items']:
        cursor.execute('''
            INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            order_id, item['id'], item['name'], item['price'], item['quantity'], item['total']
        ))

        cursor.execute('''
            UPDATE products
            SET quantity = quantity - %s
            WHERE id = %s
        ''', (item['quantity'], item['id']))

    conn.commit()
    sync_json_from_db(conn)
    conn.close()

    return jsonify({
        'success': True,
        'order_id': order_id,
        'message': 'Order placed successfully! Thank you for shopping with EasyCart.',
        'order_details': {
            'order_id': order_id,
            'customer': delivery_info,
            'items': calc['items'],
            'subtotal': calc['subtotal'],
            'discount': calc['discount'],
            'delivery_fee': calc['delivery_fee'],
            'total': calc['total'],
            'payment_method': payment_method,
            'status': 'Confirmed'
        }
    })

# --- User Authentication ---

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login endpoint. Verifies password for existing users and logs security events."""
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
    user_agent = request.headers.get('User-Agent', '')[:255]

    if not email:
        return jsonify({'error': 'Please enter your email address.'}), 400

    if not password:
        return jsonify({'error': 'Please enter your password.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
    user = cursor.fetchone()

    if not user:
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (NULL, %s, 'failed_login', 0, %s, %s)
        ''', (email, ip_addr, user_agent))
        conn.commit()
        conn.close()
        return jsonify({'error': 'No account found with this email. Please register first.'}), 404

    if user.get('auth_provider') == 'google' and str(user.get('password_hash', '')).startswith('google_oauth:'):
        conn.close()
        return jsonify({'error': 'This account was authenticated with Google. Please use Google Sign-In.'}), 400

    if not check_password_hash(user['password_hash'], password):
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, 'failed_login', 0, %s, %s)
        ''', (user['id'], email, ip_addr, user_agent))
        conn.commit()
        conn.close()
        return jsonify({'error': 'Invalid password. Please try again.'}), 401

    # Check status (Safe deactivation guard)
    if user.get('status') in ('deactivated', 'deleted'):
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, 'blocked_deactivated', 0, %s, %s)
        ''', (user['id'], email, ip_addr, user_agent))
        conn.commit()
        conn.close()
        return jsonify({'error': 'Your account has been deactivated. Please contact customer support.'}), 403

    # Enforce role consistency: Only allowlisted emails can be admin
    is_allowlisted = user['email'].strip().lower() in GOOGLE_ALLOWED_ADMIN_EMAILS
    actual_role = 'admin' if (user.get('role') == 'admin' and is_allowlisted) else 'customer'

    # Successful login
    event_type = 'admin_login' if actual_role == 'admin' else 'customer_login'
    cursor.execute('''
        INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
        VALUES (%s, %s, %s, 1, %s, %s)
    ''', (user['id'], email, event_type, ip_addr, user_agent))

    if actual_role == 'admin':
        cursor.execute('''
            INSERT INTO admin_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, 'admin_login', 1, %s, %s)
        ''', (user['id'], email, ip_addr, user_agent))

    cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s', (user['id'],))
    conn.commit()
    conn.close()

    session['user_id'] = user['id']
    session['user_name'] = user['name']
    session['user_email'] = user['email']
    session['user_role'] = actual_role
    if actual_role == 'admin':
        session['admin_login_time'] = time.time()

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': actual_role,
            'status': user.get('status', 'active'),
            'last_login': str(datetime.now())
        },
        'message': f"Signed in as {user['name']}"
    })

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email:
        return jsonify({'error': 'Email is required.'}), 400

    if not password:
        return jsonify({'error': 'Password is required.'}), 400

    if not name:
        raw_name = email.split('@')[0]
        name = ' '.join(part.capitalize() for part in raw_name.replace('.', ' ').replace('_', ' ').split())
        if not name:
            name = "EasyCart User"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE email = %s', (email,))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        return jsonify({'error': 'An account with this email already exists. Please log in.'}), 409

    pw_hash = generate_password_hash(password)
    # Registration always assigns customer role; admin role is strictly assigned via server-side allowlist
    role = 'customer'
    cursor.execute('INSERT INTO users (name, email, password_hash, role, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
                   (name, email, pw_hash, role, 'active'))
    user_id = cursor.fetchone()['id']
    conn.commit()
    conn.close()

    session['user_id'] = user_id
    session['user_name'] = name
    session['user_email'] = email
    session['user_role'] = role

    return jsonify({
        'success': True,
        'user': {'id': user_id, 'name': name, 'email': email, 'role': role, 'status': 'active'}
    })

@app.route('/api/auth/config', methods=['GET'])
def api_auth_config():
    """Return public authentication configuration for GIS."""
    return jsonify({
        'google_client_id': GOOGLE_CLIENT_ID,
        'auth_providers': ['google', 'local'],
        'providers': ['google', 'local']
    })

@app.route('/api/auth/google', methods=['POST'])
def api_google_auth():
    """Authenticate or register user via verified Google OAuth2 ID Token."""
    ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
    user_agent = request.headers.get('User-Agent', '')[:255]

    if not check_auth_rate_limit(ip_addr):
        return jsonify({'error': 'Too many authentication attempts. Please wait 5 minutes and try again.'}), 429

    data = request.get_json(silent=True) or {}
    credential = data.get('credential')

    if not credential:
        record_failed_attempt(ip_addr)
        return jsonify({'error': 'Missing Google authentication credential token.'}), 400

    try:
        id_info = verify_google_id_token(credential)
    except Exception as e:
        record_failed_attempt(ip_addr)
        logger.warning(f"Google ID token verification failed for IP {ip_addr}: {e}")
        return jsonify({'error': f'Google verification failed: {str(e)}'}), 401

    google_sub = id_info.get('sub')
    email = id_info.get('email', '').strip().lower()
    name = id_info.get('name') or email.split('@')[0]
    picture = id_info.get('picture')

    if not email or not google_sub:
        record_failed_attempt(ip_addr)
        return jsonify({'error': 'Google token did not contain valid identity claims.'}), 400

    # STRICT TWO-ACCOUNT ADMINISTRATOR ALLOWLIST
    is_admin = email in GOOGLE_ALLOWED_ADMIN_EMAILS
    target_role = 'admin' if is_admin else 'customer'

    conn = get_db()
    cursor = conn.cursor()

    # 1. Lookup by Google Subject Identifier (sub)
    cursor.execute('SELECT * FROM users WHERE google_id = %s', (google_sub,))
    user = cursor.fetchone()

    if not user:
        # 2. Lookup by verified email for safe account linking
        cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cursor.fetchone()
        if user:
            # Check for Google ID conflict:
            # Only trigger conflict if a genuine, different Google ID is already linked.
            # Test placeholders (starting with 'google-oauth2-') are safely replaced.
            existing_google_id = user.get('google_id')
            if existing_google_id and existing_google_id != google_sub:
                if str(existing_google_id).startswith('google-oauth2-'):
                    logger.warning(f"Upgrading test placeholder google_id '{existing_google_id}' to genuine Google ID for {email}")
                else:
                    conn.close()
                    return jsonify({'error': 'Email is already linked to a different Google account.'}), 409

            # Safe account linking for existing user:
            # Overwrite password_hash with scrambled OAuth token to prevent pre-registration account takeover
            scrambled_password = f"google_oauth:{secrets.token_hex(16)}"
            cursor.execute('''
                UPDATE users
                SET google_id = %s,
                    password_hash = %s,
                    avatar_url = COALESCE(%s, avatar_url),
                    auth_provider = 'google',
                    last_login = CURRENT_TIMESTAMP,
                    role = %s
                WHERE id = %s
            ''', (google_sub, scrambled_password, picture, target_role, user['id']))
            conn.commit()
            cursor.execute('SELECT * FROM users WHERE id = %s', (user['id'],))
            user = cursor.fetchone()
        else:
            # 3. New account auto-registration
            dummy_hash = f"google_oauth:{secrets.token_hex(16)}"
            cursor.execute('''
                INSERT INTO users (name, email, password_hash, role, status, google_id, avatar_url, auth_provider, last_login)
                VALUES (%s, %s, %s, %s, 'active', %s, %s, 'google', CURRENT_TIMESTAMP)
            ''', (name, email, dummy_hash, target_role, google_sub, picture))
            conn.commit()
            cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
            user = cursor.fetchone()
    else:
        # Existing Google user by Google ID - update profile info & synchronize role
        cursor.execute('''
            UPDATE users
            SET name = COALESCE(%s, name),
                avatar_url = COALESCE(%s, avatar_url),
                last_login = CURRENT_TIMESTAMP,
                role = %s
            WHERE id = %s
        ''', (name, picture, target_role, user['id']))
        conn.commit()
        cursor.execute('SELECT * FROM users WHERE id = %s', (user['id'],))
        user = cursor.fetchone()

    # Security check: account status
    if user.get('status') in ('deactivated', 'deleted'):
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, 'blocked_deactivated_google', 0, %s, %s)
        ''', (user['id'], email, ip_addr, user_agent))
        conn.commit()
        conn.close()
        return jsonify({'error': 'Your account has been deactivated. Please contact customer support.'}), 403

    # Audit logging for successful login
    event_type = 'google_admin_login' if user.get('role') == 'admin' else 'google_customer_login'
    cursor.execute('''
        INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
        VALUES (%s, %s, %s, 1, %s, %s)
    ''', (user['id'], email, event_type, ip_addr, user_agent))

    if user.get('role') == 'admin':
        cursor.execute('''
            INSERT INTO admin_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, 'google_admin_login', 1, %s, %s)
        ''', (user['id'], email, ip_addr, user_agent))

    conn.commit()
    conn.close()

    # Secure session initialization & fixation defense
    session.clear()
    session.permanent = True
    session['user_id'] = user['id']
    session['user_name'] = user['name']
    session['user_email'] = user['email']
    session['user_role'] = user['role']
    session['auth_method'] = 'google'
    if user.get('role') == 'admin':
        session['admin_login_time'] = time.time()

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'avatar_url': user.get('avatar_url') or picture,
            'auth_provider': 'google',
            'last_login': str(datetime.now())
        },
        'message': f"Welcome, {user['name']}"
    })

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    user_id = session.get('user_id')
    user_email = session.get('user_email')
    user_role = session.get('user_role')
    if user_id and user_email:
        try:
            conn = get_db()
            cursor = conn.cursor()
            ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
            event_type = 'admin_logout' if user_role == 'admin' else 'customer_logout'
            cursor.execute('''
                INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, %s, 1, %s, %s)
            ''', (user_id, user_email, event_type, ip_addr, request.headers.get('User-Agent', '')[:255]))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error logging logout: {e}")
    session.clear()
    session.modified = True
    resp = jsonify({'success': True, 'message': 'Successfully logged out'})
    resp.delete_cookie('session')
    return resp

@app.route('/api/auth/me', methods=['GET'])
def api_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email, role, status, created_at, last_login, avatar_url, auth_provider, google_id FROM users WHERE id = %s', (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user or user.get('status') in ('deactivated', 'deleted'):
        session.clear()
        return jsonify({'authenticated': False})

    return jsonify({
        'authenticated': True,
        'user': dict(user)
    })

@app.route('/api/auth/orders', methods=['GET'])
def api_user_orders():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM orders
        WHERE user_id = %s
        ORDER BY created_at DESC
    ''', (user_id,))
    orders = [dict(r) for r in cursor.fetchall()]

    for order in orders:
        cursor.execute('''
            SELECT * FROM order_items
            WHERE order_id = %s
        ''', (order['id'],))
        order['items'] = [dict(i) for i in cursor.fetchall()]

    conn.close()
    return jsonify(orders)

# ===========================================================================
# EASYCART ADMIN CONTROL CENTER — AUTHORIZATION & SERVICES
# ===========================================================================

def log_admin_action(admin_id, admin_email, action, target_type, target_id, details):
    """Helper to record audit trail in admin_activity_log."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
        cursor.execute('''
            INSERT INTO admin_activity_log (admin_id, admin_email, action, target_type, target_id, details, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (admin_id, admin_email, action, target_type, str(target_id), str(details), ip_addr))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to record admin activity log: {e}")

def parse_date_filter(range_str, start_date_str=None, end_date_str=None):
    """Helper to compute SQL date boundaries."""
    now = datetime.now()
    if range_str == 'today':
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start.strftime('%Y-%m-%d %H:%M:%S'), None
    elif range_str == 'yesterday':
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start.strftime('%Y-%m-%d %H:%M:%S'), end.strftime('%Y-%m-%d %H:%M:%S')
    elif range_str == '7days':
        start = now - timedelta(days=7)
        return start.strftime('%Y-%m-%d %H:%M:%S'), None
    elif range_str == '30days':
        start = now - timedelta(days=30)
        return start.strftime('%Y-%m-%d %H:%M:%S'), None
    elif range_str == 'this_month':
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start.strftime('%Y-%m-%d %H:%M:%S'), None
    elif range_str == 'last_month':
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day_of_last_month = first_of_this_month - timedelta(seconds=1)
        start = last_day_of_last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start.strftime('%Y-%m-%d %H:%M:%S'), last_day_of_last_month.strftime('%Y-%m-%d %H:%M:%S')
    elif range_str == 'this_year':
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return start.strftime('%Y-%m-%d %H:%M:%S'), None
    elif range_str == 'custom' and start_date_str:
        return f"{start_date_str} 00:00:00", f"{end_date_str or start_date_str} 23:59:59"
    return None, None

# --- A. Customer Account Management Endpoints ---

@app.route('/api/admin/customers', methods=['GET'])
@admin_required
def api_admin_customers():
    search = request.args.get('search', '').strip().lower()
    status_filter = request.args.get('status', 'all')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    sort = request.args.get('sort', 'newest')

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login,
               COUNT(o.id) as total_orders,
               COALESCE(SUM(CASE WHEN o.status != 'Cancelled' AND (o.payment_status = 'Paid' OR o.status = 'Confirmed') THEN o.total ELSE 0 END), 0) as total_spending
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE 1=1
    '''
    params = []

    if search:
        query += ' AND (LOWER(u.name) LIKE %s OR LOWER(u.email) LIKE %s OR CAST(u.id AS TEXT) = %s)'
        params.extend([f"%{search}%", f"%{search}%", search])

    if status_filter != 'all':
        query += ' AND u.status = %s'
        params.append(status_filter)

    if date_from:
        query += ' AND u.created_at >= %s'
        params.append(f"{date_from} 00:00:00")
    if date_to:
        query += ' AND u.created_at <= %s'
        params.append(f"{date_to} 23:59:59")

    query += ' GROUP BY u.id'

    if sort == 'newest':
        query += ' ORDER BY u.created_at DESC'
    elif sort == 'oldest':
        query += ' ORDER BY u.created_at ASC'
    elif sort == 'spending_desc':
        query += ' ORDER BY total_spending DESC'
    elif sort == 'orders_desc':
        query += ' ORDER BY total_orders DESC'
    elif sort == 'name_asc':
        query += ' ORDER BY u.name ASC'

    cursor.execute(query, tuple(params) if params else None)
    customers = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({'customers': customers, 'count': len(customers)})

@app.route('/api/admin/customers/<int:user_id>', methods=['GET', 'DELETE'])
@admin_required
def api_admin_customer_detail(user_id):
    if request.method == 'DELETE':
        return api_admin_update_customer_status(user_id)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT id, name, email, role, status, created_at, last_login, avatar_url, auth_provider, google_id FROM users WHERE id = %s', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'Customer not found'}), 404

    customer = dict(user)

    # Order History
    cursor.execute('''
        SELECT * FROM orders
        WHERE user_id = %s
        ORDER BY created_at DESC
    ''', (user_id,))
    orders = [dict(r) for r in cursor.fetchall()]

    for o in orders:
        cursor.execute('SELECT * FROM order_items WHERE order_id = %s', (o['id'],))
        o['items'] = [dict(i) for i in cursor.fetchall()]

    # Purchase Stats
    paid_orders = [o for o in orders if o.get('status') != 'Cancelled' and (o.get('payment_status') == 'Paid' or o.get('status') == 'Confirmed')]
    total_spent = sum(o['total'] for o in paid_orders)
    avg_order_val = (total_spent / len(paid_orders)) if paid_orders else 0

    stats = {
        'total_orders': len(orders),
        'completed_orders': len(paid_orders),
        'pending_orders': len([o for o in orders if o.get('status') == 'Pending']),
        'cancelled_orders': len([o for o in orders if o.get('status') == 'Cancelled']),
        'total_spent': round(total_spent, 2),
        'average_order_value': round(avg_order_val, 2),
        'last_purchase_date': orders[0]['created_at'] if orders else None,
    }

    # Status History
    cursor.execute('''
        SELECT h.*, u.name as admin_name
        FROM account_status_history h
        LEFT JOIN users u ON h.changed_by_admin_id = u.id
        WHERE h.user_id = %s
        ORDER BY h.created_at DESC
    ''', (user_id,))
    status_history = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        'customer': customer,
        'stats': stats,
        'orders': orders,
        'status_history': status_history
    })

@app.route('/api/admin/customers/<int:user_id>/status', methods=['PUT'])
@admin_required
def api_admin_update_customer_status(user_id):
    """Safely update customer status (active/deactivated/deleted). Safeguards protect admins & preserve financial history."""
    data = request.get_json(silent=True) or {}
    new_status = data.get('status') or ('deleted' if request.method == 'DELETE' else None)
    reason = data.get('reason', 'Administrative action').strip()

    if new_status not in ('active', 'deactivated', 'deleted'):
        return jsonify({'error': 'Invalid status. Must be active, deactivated, or deleted.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT id, name, email, role, status FROM users WHERE id = %s', (user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        return jsonify({'error': 'Customer account not found'}), 404

    target = dict(target)

    # STRICT SAFEGUARD: Prevent deletion/deactivation of either authorized administrator
    if target.get('role') == 'admin' or target.get('email') in PROTECTED_ADMIN_EMAILS:
        conn.close()
        return jsonify({'error': 'Unauthorized: Cannot deactivate or delete a protected administrator account.'}), 403

    prev_status = target.get('status', 'active')
    admin_id = session.get('user_id')
    admin_email = session.get('user_email')

    # Update status
    cursor.execute('UPDATE users SET status = %s WHERE id = %s', (new_status, user_id))

    # Record in history
    cursor.execute('''
        INSERT INTO account_status_history (user_id, previous_status, new_status, changed_by_admin_id, reason)
        VALUES (%s, %s, %s, %s, %s)
    ''', (user_id, prev_status, new_status, admin_id, reason))

    conn.commit()
    conn.close()

    log_admin_action(admin_id, admin_email, f"customer_{new_status}", "customer", user_id,
                     f"Changed status from {prev_status} to {new_status}. Reason: {reason}")

    return jsonify({
        'success': True,
        'message': f"Customer account {target['name']} ({target['email']}) is now {new_status}.",
        'customer': {'id': user_id, 'status': new_status}
    })

@app.route('/api/admin/customers/<int:user_id>/revoke-sessions', methods=['POST'])
@admin_required
def api_admin_revoke_sessions(user_id):
    admin_id = session.get('user_id')
    admin_email = session.get('user_email')

    log_admin_action(admin_id, admin_email, "revoke_sessions", "customer", user_id,
                     "Revoked all active sessions for customer")

    return jsonify({'success': True, 'message': 'Customer active session revoked successfully.'})

# --- B. Login Activity Monitoring Endpoints ---

@app.route('/api/admin/activity/logins', methods=['GET'])
@admin_required
def api_admin_logins():
    status_filter = request.args.get('status', 'all')
    type_filter = request.args.get('type', 'all')
    email_query = request.args.get('email', '').strip().lower()
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    limit = int(request.args.get('limit', 100))

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT l.*, u.name as user_name, u.role as user_role
        FROM user_login_activity l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE 1=1
    '''
    params = []

    if status_filter == 'success':
        query += ' AND l.success = 1'
    elif status_filter == 'failed':
        query += ' AND l.success = 0'

    if type_filter == 'admin':
        query += " AND (l.event_type = 'admin_login' OR l.event_type = 'admin_logout')"
    elif type_filter == 'customer':
        query += " AND (l.event_type = 'customer_login' OR l.event_type = 'customer_logout')"

    if email_query:
        query += ' AND LOWER(l.email) LIKE %s'
        params.append(f"%{email_query}%")

    if date_from:
        query += ' AND l.created_at >= %s'
        params.append(f"{date_from} 00:00:00")
    if date_to:
        query += ' AND l.created_at <= %s'
        params.append(f"{date_to} 23:59:59")

    query += ' ORDER BY l.created_at DESC LIMIT %s'
    params.append(limit)

    cursor.execute(query, tuple(params))
    logins = [dict(r) for r in cursor.fetchall()]

    # Stats aggregation
    cursor.execute('SELECT COUNT(*) FROM user_login_activity')
    total_events = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM user_login_activity WHERE success = 1')
    successful_logins = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM user_login_activity WHERE success = 0')
    failed_logins = cursor.fetchone()[0]

    # Identify repeated failed attempts (emails with multiple failed attempts)
    cursor.execute('''
        SELECT email, COUNT(*) as failed_count, MAX(created_at) as last_attempt
        FROM user_login_activity
        WHERE success = 0
        GROUP BY email
        HAVING failed_count >= 2
        ORDER BY failed_count DESC
    ''')
    repeated_failures = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        'logins': logins,
        'stats': {
            'total_events': total_events,
            'successful_logins': successful_logins,
            'failed_logins': failed_logins,
            'repeated_failed_attempts': len(repeated_failures),
            'repeated_failures': repeated_failures
        }
    })

@app.route('/api/admin/activity/admin', methods=['GET'])
@admin_required
def api_admin_activity():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM admin_activity_log
        ORDER BY created_at DESC
        LIMIT 100
    ''')
    activities = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'activities': activities})

# --- C. Complete Sales Management Endpoints ---

@app.route('/api/admin/sales/overview', methods=['GET'])
@admin_required
def api_admin_sales_overview():
    range_str = request.args.get('range', 'all')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start_bound, end_bound = parse_date_filter(range_str, start_date, end_date)

    conn = get_db()
    cursor = conn.cursor()

    query = 'SELECT * FROM orders WHERE 1=1'
    params = []

    if start_bound:
        query += ' AND created_at >= %s'
        params.append(start_bound)
    if end_bound:
        query += ' AND created_at <= %s'
        params.append(end_bound)

    cursor.execute(query, tuple(params) if params else None)
    all_orders = [dict(r) for r in cursor.fetchall()]

    # Financial derivation strictly from existing orders
    total_orders = len(all_orders)
    paid_orders_list = [o for o in all_orders if o.get('status') != 'Cancelled' and (o.get('payment_status') == 'Paid' or o.get('status') == 'Confirmed')]
    pending_orders_list = [o for o in all_orders if o.get('status') == 'Pending' or o.get('payment_status') == 'Pending']
    cancelled_orders_list = [o for o in all_orders if o.get('status') == 'Cancelled']

    gross_sales = sum((o.get('subtotal', 0) + o.get('delivery_fee', 0)) for o in paid_orders_list)
    total_discounts = sum(o.get('discount', 0) for o in paid_orders_list)
    total_refunds = sum(o.get('refund_amount', 0) for o in all_orders)
    net_revenue = sum(o.get('total', 0) for o in paid_orders_list) - total_refunds
    avg_order_value = (net_revenue / len(paid_orders_list)) if paid_orders_list else 0.0

    # Total units sold from order_items
    paid_order_ids = [o['id'] for o in paid_orders_list]
    total_units_sold = 0
    if paid_order_ids:
        placeholders = ','.join(['%s'] * len(paid_order_ids))
        cursor.execute(f'SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id IN ({placeholders})', tuple(paid_order_ids))
        total_units_sold = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'gross_sales': round(gross_sales, 2),
        'total_discounts': round(total_discounts, 2),
        'total_refunds': round(total_refunds, 2),
        'net_revenue': round(net_revenue, 2),
        'total_orders': total_orders,
        'paid_orders': len(paid_orders_list),
        'pending_orders': len(pending_orders_list),
        'cancelled_orders': len(cancelled_orders_list),
        'average_order_value': round(avg_order_value, 2),
        'total_units_sold': int(total_units_sold),
        'date_range': range_str
    })

@app.route('/api/admin/sales/analytics', methods=['GET'])
@admin_required
def api_admin_sales_analytics():
    conn = get_db()
    cursor = conn.cursor()

    # Timeline revenue by date (last 30 days)
    cursor.execute('''
        SELECT DATE(created_at) as date,
               COUNT(*) as order_count,
               SUM(total) as revenue
        FROM orders
        WHERE status != 'Cancelled' AND (payment_status = 'Paid' OR status = 'Confirmed')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ''')
    daily_revenue = [dict(r) for r in cursor.fetchall()]

    # Best-selling products (by units and revenue)
    cursor.execute('''
        SELECT oi.product_id, oi.product_name,
               SUM(oi.quantity) as units_sold,
               SUM(oi.total_price) as total_revenue,
               p.category
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status != 'Cancelled' AND (o.payment_status = 'Paid' OR o.status = 'Confirmed')
        GROUP BY oi.product_id
        ORDER BY units_sold DESC
        LIMIT 5
    ''')
    best_selling = [dict(r) for r in cursor.fetchall()]

    # Least-selling products
    cursor.execute('''
        SELECT p.id as product_id, p.name as product_name, p.category, p.quantity as current_stock,
               COALESCE(SUM(oi.quantity), 0) as units_sold
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        GROUP BY p.id
        ORDER BY units_sold ASC, p.id ASC
        LIMIT 5
    ''')
    least_selling = [dict(r) for r in cursor.fetchall()]

    # Category performance
    cursor.execute('''
        SELECT COALESCE(p.category, 'Uncategorized') as category,
               COUNT(DISTINCT o.id) as orders_count,
               SUM(oi.quantity) as units_sold,
               SUM(oi.total_price) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status != 'Cancelled' AND (o.payment_status = 'Paid' OR o.status = 'Confirmed')
        GROUP BY category
        ORDER BY revenue DESC
    ''')
    category_performance = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        'daily_revenue': daily_revenue,
        'best_selling': best_selling,
        'least_selling': least_selling,
        'category_performance': category_performance
    })

@app.route('/api/admin/sales/orders', methods=['GET'])
@admin_required
def api_admin_sales_orders():
    search = request.args.get('search', '').strip().lower()
    payment_status = request.args.get('payment_status', 'all')
    order_status = request.args.get('order_status', 'all')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    conn = get_db()
    cursor = conn.cursor()

    query = 'SELECT * FROM orders WHERE 1=1'
    params = []

    if search:
        query += ' AND (LOWER(id) LIKE %s OR LOWER(customer_name) LIKE %s OR LOWER(customer_email) LIKE %s)'
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    if payment_status != 'all':
        query += ' AND payment_status = %s'
        params.append(payment_status)

    if order_status != 'all':
        query += ' AND status = %s'
        params.append(order_status)

    if date_from:
        query += ' AND created_at >= %s'
        params.append(f"{date_from} 00:00:00")
    if date_to:
        query += ' AND created_at <= %s'
        params.append(f"{date_to} 23:59:59")

    query += ' ORDER BY created_at DESC'

    cursor.execute(query, tuple(params) if params else None)
    orders = [dict(r) for r in cursor.fetchall()]

    for o in orders:
        cursor.execute('SELECT * FROM order_items WHERE order_id = %s', (o['id'],))
        o['items'] = [dict(i) for i in cursor.fetchall()]

    conn.close()
    return jsonify({'orders': orders, 'count': len(orders)})

@app.route('/api/admin/orders/<order_id>/status', methods=['PUT'])
@admin_required
def api_admin_update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    new_order_status = data.get('status')
    new_payment_status = data.get('payment_status')
    refund_amount = float(data.get('refund_amount', 0.0))

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found'}), 404

    updates = []
    params = []
    if new_order_status:
        updates.append('status = %s')
        params.append(new_order_status)
    if new_payment_status:
        updates.append('payment_status = %s')
        params.append(new_payment_status)
    if refund_amount > 0:
        updates.append('refund_amount = %s')
        params.append(refund_amount)

    if updates:
        params.append(order_id)
        cursor.execute(f"UPDATE orders SET {', '.join(updates)} WHERE id = %s", tuple(params))
        conn.commit()

    conn.close()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_order", "order", order_id,
                     f"Updated order {order_id}: status={new_order_status}, payment={new_payment_status}, refund={refund_amount}")

    return jsonify({'success': True, 'message': f'Order {order_id} updated successfully.'})

@app.route('/api/admin/sales/export', methods=['GET'])
@admin_required
def api_admin_sales_export():
    export_type = request.args.get('type', 'orders')
    range_str = request.args.get('range', 'all')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start_bound, end_bound = parse_date_filter(range_str, start_date, end_date)

    conn = get_db()
    cursor = conn.cursor()
    output = io.StringIO()
    writer = csv.writer(output)

    if export_type == 'orders':
        writer.writerow(['Order ID', 'Customer Name', 'Customer Email', 'Date', 'Subtotal (INR)', 'Discount (INR)',
                         'Delivery Fee (INR)', 'Total (INR)', 'Payment Method', 'Payment Status', 'Order Status'])
        query = 'SELECT * FROM orders WHERE 1=1'
        params = []
        if start_bound:
            query += ' AND created_at >= %s'
            params.append(start_bound)
        if end_bound:
            query += ' AND created_at <= %s'
            params.append(end_bound)
        query += ' ORDER BY created_at DESC'
        cursor.execute(query, tuple(params) if params else None)
        for r in cursor.fetchall():
            writer.writerow([r['id'], r['customer_name'], r['customer_email'], r['created_at'],
                             r['subtotal'], r['discount'], r['delivery_fee'], r['total'],
                             r['payment_method'], r.get('payment_status', 'Paid'), r['status']])
        filename = f"easycart_orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    elif export_type == 'products':
        writer.writerow(['Product ID', 'Name', 'Category', 'Price (INR)', 'Stock Level', 'Rating', 'Units Sold', 'Total Revenue (INR)'])
        cursor.execute('''
            SELECT p.id, p.name, p.category, p.price, p.quantity, p.rating,
                   COALESCE(SUM(oi.quantity), 0) as units_sold,
                   COALESCE(SUM(oi.total_price), 0) as revenue
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            GROUP BY p.id
            ORDER BY units_sold DESC
        ''')
        for r in cursor.fetchall():
            writer.writerow([r['id'], r['name'], r['category'], r['price'], r['quantity'], r['rating'], r['units_sold'], r['revenue']])
        filename = f"easycart_product_sales_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    elif export_type == 'customers':
        writer.writerow(['Customer ID', 'Name', 'Email', 'Role', 'Status', 'Registered Date', 'Last Login', 'Total Orders', 'Total Spent (INR)'])
        cursor.execute('''
            SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login,
                   COUNT(o.id) as total_orders,
                   COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total ELSE 0 END), 0) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            GROUP BY u.id
            ORDER BY total_spent DESC
        ''')
        for r in cursor.fetchall():
            writer.writerow([r['id'], r['name'], r['email'], r['role'], r['status'], r['created_at'], r['last_login'], r['total_orders'], r['total_spent']])
        filename = f"easycart_customers_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    else:
        # High-level sales report summary
        writer.writerow(['Metric', 'Value'])
        cursor.execute('''
            SELECT COUNT(*) as total_orders,
                   COALESCE(SUM(total), 0) as gross_revenue,
                   COALESCE(SUM(discount), 0) as total_discounts,
                   COALESCE(SUM(refund_amount), 0) as total_refunds
            FROM orders
            WHERE status != 'Cancelled'
        ''')
        row = cursor.fetchone()
        net = row['gross_revenue'] - row['total_refunds']
        writer.writerow(['Total Orders', row['total_orders']])
        writer.writerow(['Gross Revenue (INR)', round(row['gross_revenue'], 2)])
        writer.writerow(['Total Discounts (INR)', round(row['total_discounts'], 2)])
        writer.writerow(['Total Refunds (INR)', round(row['total_refunds'], 2)])
        writer.writerow(['Net Sales Revenue (INR)', round(net, 2)])
        filename = f"easycart_sales_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    conn.close()
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )

# --- D. Overview & Inventory & Offers Management ---

@app.route('/api/admin/overview', methods=['GET'])
@admin_required
def api_admin_overview():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "customer"')
    total_customers = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM users WHERE status = "active" AND role = "customer"')
    active_customers = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders WHERE status != "Cancelled" AND (payment_status = "Paid" OR status = "Confirmed")')
    row = cursor.fetchone()
    total_orders = row[0]
    net_revenue = row[1]

    cursor.execute('SELECT COUNT(*) FROM products WHERE quantity <= 10')
    low_stock_count = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM user_login_activity WHERE DATE(created_at) = DATE("now")')
    today_logins = cursor.fetchone()[0]

    cursor.execute('SELECT * FROM admin_activity_log ORDER BY created_at DESC LIMIT 5')
    recent_admin_activity = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return jsonify({
        'total_customers': total_customers,
        'active_customers': active_customers,
        'total_orders': total_orders,
        'net_revenue': round(net_revenue, 2),
        'low_stock_count': low_stock_count,
        'today_logins': today_logins,
        'recent_activity': recent_admin_activity
    })

@app.route('/api/admin/inventory', methods=['GET'])
@admin_required
def api_admin_inventory():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, category, price, quantity, rating FROM products ORDER BY quantity ASC')
    products = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'products': products})

@app.route('/api/admin/inventory/<int:product_id>', methods=['PUT'])
@admin_required
def api_admin_update_inventory(product_id):
    data = request.get_json(silent=True) or {}
    new_quantity = int(data.get('quantity', 0))
    if new_quantity < 0:
        return jsonify({'error': 'Quantity cannot be negative'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT name, quantity FROM products WHERE id = %s', (product_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    old_qty = prod['quantity']
    cursor.execute('UPDATE products SET quantity = %s WHERE id = %s', (new_quantity, product_id))
    conn.commit()
    sync_json_from_db(conn)
    conn.close()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_inventory", "product", product_id,
                     f"Adjusted inventory of {prod['name']} from {old_qty} to {new_quantity}")

    return jsonify({'success': True, 'product_id': product_id, 'quantity': new_quantity})

@app.route('/api/admin/offers', methods=['GET'])
@admin_required
def api_admin_offers():
    conn = get_db()
    cursor = conn.cursor()
    offers_list = []
    for code, conf in COUPONS.items():
        cursor.execute('SELECT COUNT(*) FROM orders WHERE coupon_code = %s', (code,))
        uses = cursor.fetchone()[0]
        offers_list.append({
            'code': conf['code'],
            'type': conf['type'],
            'value': conf['value'],
            'min_order': conf['min_order'],
            'max_discount': conf['max_discount'],
            'description': conf['description'],
            'total_uses': uses
        })
    conn.close()
    return jsonify({'offers': offers_list})

# --- E. Category Hierarchy Management ---

@app.route('/api/admin/categories', methods=['GET'])
@admin_required
def api_admin_categories():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*, p.name AS parent_name,
               (SELECT COUNT(*) FROM products pr 
                WHERE pr.category_id = c.id 
                   OR pr.subcategory_id = c.id 
                   OR pr.nested_category_id = c.id) AS product_count
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        ORDER BY c.display_order ASC, c.name ASC
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if request.args.get('tree', 'false').lower() == 'true':
        def build_tree(items, parent_id=None):
            branch = []
            for item in items:
                if item.get('parent_id') == parent_id:
                    node = dict(item)
                    node['children'] = build_tree(items, item['id'])
                    branch.append(node)
            return branch
        tree = build_tree(rows, None)
        return jsonify({'categories': tree, 'flat': rows})

    return jsonify({'categories': rows})

@app.route('/api/admin/categories', methods=['POST'])
@admin_required
def api_admin_create_category():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required'}), 400

    parent_id = data.get('parent_id')
    if parent_id in ('', 'null', None):
        parent_id = None
    else:
        try:
            parent_id = int(parent_id)
        except (ValueError, TypeError):
            parent_id = None

    description = data.get('description', '').strip()
    image_url = data.get('image_url', '').strip()
    display_order = int(data.get('display_order', 0))
    is_active = 1 if data.get('is_active', True) else 0

    slug = data.get('slug', '').strip()
    if not slug:
        slug = make_category_slug(name)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM categories WHERE slug = %s", (slug,))
    if cursor.fetchone():
        slug = f"{slug}-{int(time.time())}"

    cursor.execute('''
        INSERT INTO categories (name, slug, parent_id, description, image_url, display_order, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (name, slug, parent_id, description, image_url, display_order, is_active))
    cat_id = cursor.fetchone()['id']
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "create_category", "category", cat_id,
                     f"Created category '{name}' (ID: {cat_id})")

    cursor.execute("SELECT * FROM categories WHERE id = %s", (cat_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return jsonify(created), 201

@app.route('/api/admin/categories/<int:cat_id>', methods=['PUT'])
@admin_required
def api_admin_update_category(cat_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories WHERE id = %s", (cat_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Category not found'}), 404

    name = data.get('name', existing['name']).strip()
    if not name:
        conn.close()
        return jsonify({'error': 'Category name cannot be empty'}), 400

    parent_id = data.get('parent_id')
    if parent_id in ('', 'null', None):
        new_parent_id = None
    else:
        try:
            new_parent_id = int(parent_id)
        except (ValueError, TypeError):
            new_parent_id = None

    if new_parent_id is not None:
        if check_category_cycle(cursor, cat_id, new_parent_id):
            conn.close()
            return jsonify({'error': 'Circular hierarchy detected: cannot set parent to a descendant category.'}), 400

    description = data.get('description', existing['description'])
    image_url = data.get('image_url', existing['image_url'])
    display_order = int(data.get('display_order', existing['display_order']))
    is_active = 1 if data.get('is_active', existing['is_active']) else 0
    slug = data.get('slug', existing['slug'])

    cursor.execute('''
        UPDATE categories
        SET name = %s, slug = %s, parent_id = %s, description = %s, image_url = %s, display_order = %s, is_active = %s
        WHERE id = %s
    ''', (name, slug, new_parent_id, description, image_url, display_order, is_active, cat_id))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_category", "category", cat_id,
                     f"Updated category '{name}' (ID: {cat_id})")

    cursor.execute("SELECT * FROM categories WHERE id = %s", (cat_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return jsonify(updated)

@app.route('/api/admin/categories/<int:cat_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_category(cat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories WHERE id = %s", (cat_id,))
    cat = cursor.fetchone()
    if not cat:
        conn.close()
        return jsonify({'error': 'Category not found'}), 404

    cursor.execute("SELECT COUNT(*) FROM categories WHERE parent_id = %s", (cat_id,))
    child_count = cursor.fetchone()[0]
    if child_count > 0:
        conn.close()
        return jsonify({'error': f'Cannot delete category: it contains {child_count} subcategories. Please reassign or delete subcategories first.'}), 400

    cursor.execute('''
        SELECT COUNT(*) FROM products 
        WHERE category_id = %s OR subcategory_id = %s OR nested_category_id = %s
    ''', (cat_id, cat_id, cat_id))
    prod_count = cursor.fetchone()[0]
    if prod_count > 0:
        conn.close()
        return jsonify({'error': f'Cannot delete category: {prod_count} products are currently assigned to it. Reassign products first.'}), 400

    cursor.execute("DELETE FROM categories WHERE id = %s", (cat_id,))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "delete_category", "category", cat_id,
                     f"Deleted category '{cat['name']}' (ID: {cat_id})")

    conn.close()
    return jsonify({'success': True, 'message': f"Category '{cat['name']}' was successfully deleted."})

# --- F. Dual Image Upload & Asset Serving ---

@app.route('/api/admin/upload-image', methods=['POST'])
@admin_required
def api_admin_upload_image():
    if 'file' not in request.files and 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded'}), 400
    file = request.files.get('file') or request.files.get('image')
    if not file or not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    if ext not in allowed_extensions:
        return jsonify({'error': f'Invalid file format .{ext}. Allowed formats: PNG, JPG, JPEG, WebP, GIF'}), 400

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    if file_size > 5 * 1024 * 1024:
        return jsonify({'error': 'File size exceeds maximum allowed limit (5MB)'}), 400

    unique_filename = f"prod_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(BACKEND_UPLOAD_DIR, exist_ok=True)

    file_bytes = file.read()
    frontend_path = os.path.join(UPLOAD_DIR, unique_filename)
    backend_path = os.path.join(BACKEND_UPLOAD_DIR, unique_filename)

    try:
        with open(frontend_path, 'wb') as f:
            f.write(file_bytes)
    except Exception as e:
        logger.warning(f"Could not write to Frontend upload dir: {e}")

    try:
        with open(backend_path, 'wb') as f:
            f.write(file_bytes)
    except Exception as e:
        logger.warning(f"Could not write to Backend upload dir: {e}")

    relative_url = f"/uploads/products/{unique_filename}"
    return jsonify({
        'success': True,
        'url': relative_url,
        'filename': unique_filename,
        'size': file_size
    }), 201

@app.route('/uploads/products/<path:filename>')
def serve_uploaded_product_image(filename):
    if os.path.exists(os.path.join(BACKEND_UPLOAD_DIR, filename)):
        return send_from_directory(BACKEND_UPLOAD_DIR, filename)
    elif os.path.exists(os.path.join(UPLOAD_DIR, filename)):
        return send_from_directory(UPLOAD_DIR, filename)
    return jsonify({'error': 'Image not found'}), 404

# --- G. Supplier Management (13th Admin Module) ---

@app.route('/api/admin/suppliers', methods=['GET'])
@admin_required
def api_admin_get_suppliers():
    search = request.args.get('search', '').strip().lower()
    status = request.args.get('status', '').strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    query = '''
        SELECT s.*, 
               (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count
        FROM suppliers s
        WHERE 1=1
    '''
    params = []
    if search:
        query += ''' AND (LOWER(s.name) LIKE %s 
                          OR LOWER(COALESCE(s.contact_person, '')) LIKE %s 
                          OR LOWER(COALESCE(s.email, '')) LIKE %s 
                          OR LOWER(COALESCE(s.phone, '')) LIKE %s)'''
        term = f"%{search}%"
        params.extend([term, term, term, term])
    if status and status != 'all':
        query += ' AND LOWER(s.status) = %s'
        params.append(status)

    query += ' ORDER BY s.name ASC'
    cursor.execute(query, params)
    suppliers = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'suppliers': suppliers})

@app.route('/api/admin/suppliers/stats', methods=['GET'])
@admin_required
def api_admin_supplier_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM suppliers')
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM suppliers WHERE status = 'active'")
    active = cursor.fetchone()[0]
    inactive = total - active

    cursor.execute('SELECT COUNT(*) FROM products WHERE supplier_id IS NOT NULL')
    supplied_prods = cursor.fetchone()[0]

    cursor.execute('SELECT supplied_categories FROM suppliers WHERE supplied_categories IS NOT NULL')
    cat_rows = cursor.fetchall()
    all_cats = set()
    for row in cat_rows:
        val = row[0] if isinstance(row, tuple) else row.get('supplied_categories')
        if val:
            for c in str(val).split(','):
                c = c.strip()
                if c:
                    all_cats.add(c)

    conn.close()
    return jsonify({
        'total_suppliers': total,
        'active_suppliers': active,
        'inactive_suppliers': inactive,
        'total_products_supplied': supplied_prods,
        'categories_covered': sorted(list(all_cats))
    })

@app.route('/api/admin/suppliers/<int:sup_id>', methods=['GET'])
@admin_required
def api_admin_get_supplier(sup_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    sup = cursor.fetchone()
    if not sup:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    supplier = dict(sup)
    cursor.execute('''
        SELECT id, name, sku, price, quantity, category, image, image_url
        FROM products
        WHERE supplier_id = %s
        ORDER BY name ASC
    ''', (sup_id,))
    products = [dict(r) for r in cursor.fetchall()]
    supplier['products'] = products
    supplier['product_count'] = len(products)
    conn.close()
    return jsonify(supplier)

@app.route('/api/admin/suppliers', methods=['POST'])
@admin_required
def api_admin_create_supplier():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Supplier name is required'}), 400

    contact_person = data.get('contact_person', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    address = data.get('address', '').strip()
    supplied_categories = data.get('supplied_categories', '').strip()
    status = data.get('status', 'active').strip() or 'active'
    notes = data.get('notes', '').strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO suppliers (name, contact_person, phone, email, address, supplied_categories, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (name, contact_person, phone, email, address, supplied_categories, status, notes))
    sup_id = cursor.fetchone()['id']
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "create_supplier", "supplier", sup_id,
                     f"Created supplier '{name}' (ID: {sup_id})")

    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return jsonify(created), 201

@app.route('/api/admin/suppliers/<int:sup_id>', methods=['PUT'])
@admin_required
def api_admin_update_supplier(sup_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    name = data.get('name', existing['name']).strip()
    if not name:
        conn.close()
        return jsonify({'error': 'Supplier name cannot be empty'}), 400

    contact_person = data.get('contact_person', existing['contact_person'])
    phone = data.get('phone', existing['phone'])
    email = data.get('email', existing['email'])
    address = data.get('address', existing['address'])
    supplied_categories = data.get('supplied_categories', existing['supplied_categories'])
    status = data.get('status', existing['status'])
    notes = data.get('notes', existing['notes'])

    cursor.execute('''
        UPDATE suppliers
        SET name = %s, contact_person = %s, phone = %s, email = %s, address = %s, supplied_categories = %s, status = %s, notes = %s
        WHERE id = %s
    ''', (name, contact_person, phone, email, address, supplied_categories, status, notes, sup_id))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_supplier", "supplier", sup_id,
                     f"Updated supplier '{name}' (ID: {sup_id})")

    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return jsonify(updated)

@app.route('/api/admin/suppliers/<int:sup_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_supplier(sup_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    sup = cursor.fetchone()
    if not sup:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    cursor.execute('UPDATE products SET supplier_id = NULL WHERE supplier_id = %s', (sup_id,))
    cursor.execute('DELETE FROM suppliers WHERE id = %s', (sup_id,))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "delete_supplier", "supplier", sup_id,
                     f"Deleted supplier '{sup['name']}' (ID: {sup_id})")

    conn.close()
    return jsonify({'success': True, 'message': f"Supplier '{sup['name']}' deleted successfully."})

if __name__ == '__main__':
    app.run(debug=True)
