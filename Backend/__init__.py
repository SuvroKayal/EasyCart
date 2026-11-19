"""
EasyCart Backend Application Factory.
Configures and initializes the modular Flask application with Blueprints,
security protections, database initialization, and static file delivery.
"""
import os
import sys
import secrets
import logging
from flask import Flask, session, request, jsonify, send_from_directory, render_template
from .config import get_config, PROJECT_ROOT, BACKEND_DIR
from .database import init_db, get_db
from .auth import auth_bp
from .products import products_bp
from .cart import cart_bp
from .checkout import checkout_bp
from .orders import orders_bp
from .admin import admin_bp
from .suppliers import suppliers_bp

# Structured Application Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] easycart: %(message)s'
)
logger = logging.getLogger('easycart')

DIST_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'dist')
PUBLIC_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'public')
BANNER_DIR = os.path.join(PROJECT_ROOT, 'banner')
STATIC_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'public', 'static')

def create_app(config_class=None):
    """Application factory for EasyCart."""
    app = Flask(
        __name__,
        static_folder=os.path.join(PROJECT_ROOT, 'Frontend'),
        template_folder=os.path.join(PROJECT_ROOT, 'Frontend')
    )

    # Load configuration
    cfg = config_class or get_config()
    app.config.from_object(cfg)

    # Production Secret Key Enforcement
    is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('APP_ENV') == 'production'
    secret_key = os.environ.get('SECRET_KEY')
    if is_prod and not secret_key:
        logger.critical("FATAL: SECRET_KEY environment variable is required in production mode.")
        raise ValueError("SECRET_KEY environment variable is required in production mode. Set a strong secret key in your environment.")

    if not secret_key:
        dev_key_file = os.path.join(BACKEND_DIR, '.dev_secret.key')
        if os.path.exists(dev_key_file):
            try:
                with open(dev_key_file, 'r', encoding='utf-8') as f:
                    secret_key = f.read().strip()
            except Exception:
                pass
        if not secret_key:
            secret_key = secrets.token_hex(32)
            try:
                with open(dev_key_file, 'w', encoding='utf-8') as f:
                    f.write(secret_key)
            except Exception:
                pass

    app.config['SECRET_KEY'] = secret_key

    # Initialize Database Schema & Migrations
    try:
        init_db()
    except Exception as e:
        logger.error(f"Error during database initialization: {e}", exc_info=True)

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(checkout_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(suppliers_bp)

    # CSRF Protection on State-Changing Endpoints
    @app.before_request
    def csrf_protect_and_init():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_hex(16)

        if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
            public_exempt = (
                '/api/auth/login',
                '/api/auth/register',
                '/api/auth/google',
                '/api/cart/calculate',
            )
            if request.path in public_exempt:
                return None

            if session.get('user_id'):
                token = request.headers.get('X-CSRF-Token')
                req_with = request.headers.get('X-Requested-With')
                session_token = session.get('csrf_token')
                if not ((token and token == session_token) or req_with == 'XMLHttpRequest'):
                    return jsonify({'error': 'CSRF verification failed: missing or invalid CSRF token.'}), 403

    # Security Headers and CSRF Cookie Injection
    @app.after_request
    def inject_security_headers(response):
        if 'csrf_token' in session:
            response.set_cookie(
                'csrf_token',
                session['csrf_token'],
                samesite='Lax',
                secure=is_prod,
                httponly=False
            )
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # Health Check Endpoint (Render & Production Monitoring)
    @app.route('/api/health')
    def health_check():
        """Safe application and database health check for Render / monitoring."""
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            return jsonify({
                'status': 'healthy',
                'service': 'EasyCart',
                'database': 'connected',
                'environment': 'production' if is_prod else 'development',
                'version': '2.0.0'
            }), 200
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({
                'status': 'unhealthy',
                'service': 'EasyCart',
                'database': 'error',
                'error': str(e)
            }), 503

    # Static Assets & SPA Serving Routes
    @app.route('/')
    def index():
        if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
            return send_from_directory(DIST_DIR, 'index.html')
        return render_template('index.html')

    @app.route('/banner/<path:filename>')
    def serve_banner(filename):
        if os.path.exists(os.path.join(PUBLIC_DIR, 'banner', filename)):
            return send_from_directory(os.path.join(PUBLIC_DIR, 'banner'), filename)
        if os.path.exists(os.path.join(BANNER_DIR, filename)):
            return send_from_directory(BANNER_DIR, filename)
        return jsonify({'error': 'Banner image not found'}), 404

    @app.route('/static/<path:filename>')
    def serve_static_assets(filename):
        if os.path.exists(os.path.join(STATIC_DIR, filename)):
            return send_from_directory(STATIC_DIR, filename)
        if os.path.exists(os.path.join(PROJECT_ROOT, 'Frontend', 'static', filename)):
            return send_from_directory(os.path.join(PROJECT_ROOT, 'Frontend', 'static'), filename)
        return jsonify({'error': 'Asset not found'}), 404

    @app.route('/assets/<path:filename>')
    def serve_dist_assets(filename):
        if os.path.exists(os.path.join(DIST_DIR, 'assets', filename)):
            return send_from_directory(os.path.join(DIST_DIR, 'assets'), filename)
        return jsonify({'error': 'Asset not found'}), 404

    @app.errorhandler(404)
    def handle_404(e):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Endpoint not found'}), 404
        if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
            return send_from_directory(DIST_DIR, 'index.html')
        return e, 404

    @app.errorhandler(500)
    def handle_500(e):
        logger.error(f"Internal server error: {e}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred. Please try again later.'}), 500

    @app.errorhandler(429)
    def handle_429(e):
        return jsonify({'error': 'Too many requests. Please slow down and try again.'}), 429

    return app
