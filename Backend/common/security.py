"""
EasyCart Security & Authorization Module.
Provides authentication decorators, password security, Google token verification,
and audit logging.
"""
import os
import logging
from functools import wraps
from flask import session, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from ..config import parse_admin_emails, Config
from ..database.connection import get_db

logger = logging.getLogger('easycart.security')

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    HAS_GOOGLE_AUTH = True
except ImportError:
    HAS_GOOGLE_AUTH = False

def hash_password(password: str) -> str:
    """Generate a secure cryptographic PBKDF2:SHA256 password hash."""
    return generate_password_hash(password, method='pbkdf2:sha256')

def verify_password(stored_hash: str, password: str) -> bool:
    """Verify password against stored cryptographic hash."""
    return check_password_hash(stored_hash, password)

def is_admin_email(email: str) -> bool:
    """Check if given email is in the verified administrator allowlist."""
    if not email:
        return False
    allowlist = parse_admin_emails()
    return email.strip().lower() in allowlist

def admin_required(f):
    """Enforce strict administrator authentication and allowlist verification."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        user_email = session.get('user_email') or session.get('email')
        user_role = session.get('user_role') or session.get('role')

        if not user_id:
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401

        # Check session role
        if user_role != 'admin':
            return jsonify({'error': 'Administrative privileges required.'}), 403

        # Database verification: Ensure user exists, is active, has admin role, and matches email allowlist
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role, status FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        conn.close()

        if not user or user['status'] != 'active':
            session.clear()
            return jsonify({'error': 'Account inactive or revoked.'}), 403

        if user['role'] != 'admin' or not is_admin_email(user['email']):
            session['user_role'] = 'customer'
            return jsonify({'error': 'Access denied: Email not authorized for administrator privileges.'}), 403

        return f(*args, **kwargs)
    return decorated_function

def login_required(f):
    """Enforce standard customer or administrator authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Please sign in to proceed.'}), 401
        return f(*args, **kwargs)
    return decorated_function

def verify_google_token(token: str, client_id: str = None):
    """Verify Google ID token signature, issuer, audience, and expiration.
    
    Returns token payload dict on success, None on failure.
    """
    if not HAS_GOOGLE_AUTH:
        logger.error("google-auth library is not installed")
        return None

    target_client_id = (client_id or os.environ.get('GOOGLE_CLIENT_ID') or Config.GOOGLE_CLIENT_ID or '').strip()
    if not target_client_id:
        logger.warning("Google ID token verification failed: GOOGLE_CLIENT_ID is not configured.")
        return None

    request_adapter = google_requests.Request()

    try:
        id_info = id_token.verify_oauth2_token(
            token,
            request_adapter,
            target_client_id,
            clock_skew_in_seconds=10
        )

        # Enforce valid Google issuer
        if id_info.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
            logger.warning(f"Google ID token has invalid issuer: {id_info.get('iss')}")
            return None

        # Enforce verified email
        if not id_info.get('email_verified', False):
            logger.warning(f"Google email is unverified for subject {id_info.get('sub')}")
            return None

        return id_info
    except Exception as e:
        logger.warning(f"Google ID token verification failed: {e}")
        return None

def log_login_activity(user_id, email, ip, user_agent, status, method):
    """Record an authentication event in the user_login_activity table."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, ip_address, user_agent, status, method)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (user_id, email, ip[:64] if ip else 'unknown', user_agent[:255] if user_agent else 'unknown', status, method))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to log login activity: {e}")

def log_admin_action(admin_id, admin_email, action, target_type, target_id, details):
    """Record an administrator mutation in the admin_audit_logs table."""
    try:
        ip = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1')
        if ',' in ip:
            ip = ip.split(',')[0].strip()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO admin_audit_logs (admin_id, admin_email, action, target_type, target_id, details, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (admin_id, admin_email, action, target_type, str(target_id), str(details), ip))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")
