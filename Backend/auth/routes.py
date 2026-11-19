"""
EasyCart Authentication Blueprint.
Handles user registration, login, Google OAuth2 token verification,
session tracking, and profile retrieval.
"""
import os
import sys
import time
import secrets
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from ..database.connection import get_db
from ..common.security import (
    hash_password,
    verify_password,
    is_admin_email,
    verify_google_token,
    log_login_activity,
)
from ..common.validators import validate_email_format
from ..extensions import rate_limit
from ..config import Config

logger = logging.getLogger('easycart.auth')

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
def api_login():
    """Customer & administrator credential login."""
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
        try:
            cursor.execute('''
                INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (NULL, %s, 'failed_login', 0, %s, %s)
            ''', (email, ip_addr, user_agent))
            conn.commit()
        except Exception:
            pass
        conn.close()
        return jsonify({'error': 'No account found with this email. Please register first.'}), 404

    if user.get('auth_provider') == 'google' and str(user.get('password_hash', '')).startswith('google_oauth:'):
        conn.close()
        return jsonify({'error': 'This account was authenticated with Google. Please use Google Sign-In.'}), 400

    if not verify_password(user['password_hash'], password):
        try:
            cursor.execute('''
                INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, 'failed_login', 0, %s, %s)
            ''', (user['id'], email, ip_addr, user_agent))
            conn.commit()
        except Exception:
            pass
        conn.close()
        return jsonify({'error': 'Invalid password. Please try again.'}), 401

    if user.get('status') in ('deactivated', 'deleted'):
        try:
            cursor.execute('''
                INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, 'blocked_deactivated', 0, %s, %s)
            ''', (user['id'], email, ip_addr, user_agent))
            conn.commit()
        except Exception:
            pass
        conn.close()
        return jsonify({'error': 'Your account has been deactivated. Please contact customer support.'}), 403

    # Role enforcement: administrator privileges strictly assigned via allowlist
    actual_role = 'admin' if (user.get('role') == 'admin' and is_admin_email(user['email'])) else 'customer'
    event_type = 'admin_login' if actual_role == 'admin' else 'customer_login'

    try:
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, %s, 1, %s, %s)
        ''', (user['id'], email, event_type, ip_addr, user_agent))

        if actual_role == 'admin':
            cursor.execute('''
                INSERT INTO admin_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, 'admin_login', 1, %s, %s)
            ''', (user['id'], email, ip_addr, user_agent))
    except Exception:
        pass

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

@auth_bp.route('/register', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def api_register():
    """Customer registration endpoint. Always assigns role='customer'."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email:
        return jsonify({'error': 'Email is required.'}), 400

    if not validate_email_format(email):
        return jsonify({'error': 'Please provide a valid email address.'}), 400

    if not password:
        return jsonify({'error': 'Password is required.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

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

    pw_hash = hash_password(password)
    role = 'customer'
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    ''', (name, email, pw_hash, role, 'active'))
    new_user = cursor.fetchone()
    user_id = new_user['id'] if new_user else None
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

@auth_bp.route('/config', methods=['GET'])
def api_auth_config():
    """Return public client-side authentication configuration for Google Identity Services."""
    client_id = (os.environ.get('GOOGLE_CLIENT_ID') or Config.GOOGLE_CLIENT_ID or '').strip()
    enabled = bool(client_id)
    return jsonify({
        'google_client_id': client_id,
        'google_enabled': enabled,
        'auth_providers': ['google', 'local'] if enabled else ['local'],
        'providers': ['google', 'local'] if enabled else ['local']
    })

@auth_bp.route('/google', methods=['POST'])
@rate_limit(max_requests=15, window_seconds=60)
def api_google_auth():
    """Authenticate or register user via verified Google OAuth2 ID Token."""
    active_client_id = (os.environ.get('GOOGLE_CLIENT_ID') or Config.GOOGLE_CLIENT_ID or '').strip()
    if not active_client_id:
        return jsonify({
            'error': 'Google authentication is not configured on this server. Please sign in with email and password, or set GOOGLE_CLIENT_ID in the environment.'
        }), 503

    ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
    user_agent = request.headers.get('User-Agent', '')[:255]

    data = request.get_json(silent=True) or {}
    credential = data.get('credential')

    if not credential:
        return jsonify({'error': 'Missing Google authentication credential token.'}), 400

    app_mod = sys.modules.get('app')
    verifier = getattr(app_mod, 'verify_google_id_token', verify_google_token) if app_mod else verify_google_token
    id_info = verifier(credential)
    if not id_info:
        logger.warning(f"Google ID token verification failed for IP {ip_addr}")
        return jsonify({'error': 'Google token verification failed or token expired.'}), 401

    google_sub = id_info.get('sub')
    email = id_info.get('email', '').strip().lower()
    name = id_info.get('name') or email.split('@')[0]
    picture = id_info.get('picture')

    if not email or not google_sub:
        return jsonify({'error': 'Google token did not contain valid identity claims.'}), 400

    # Role assignment via server-side allowlist
    target_role = 'admin' if is_admin_email(email) else 'customer'

    conn = get_db()
    cursor = conn.cursor()

    # 1. Lookup by Google Subject Identifier (sub)
    cursor.execute('SELECT * FROM users WHERE google_id = %s', (google_sub,))
    user = cursor.fetchone()

    if not user:
        # 2. Lookup by email for safe account linking
        cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cursor.fetchone()
        if user:
            existing_google_id = user.get('google_id')
            if existing_google_id and existing_google_id != google_sub:
                if str(existing_google_id).startswith('google-oauth2-'):
                    logger.warning(f"Upgrading test placeholder google_id for {email}")
                else:
                    conn.close()
                    return jsonify({'error': 'Email is already linked to a different Google account.'}), 409

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
            # 3. New account registration
            dummy_hash = f"google_oauth:{secrets.token_hex(16)}"
            cursor.execute('''
                INSERT INTO users (name, email, password_hash, role, status, google_id, avatar_url, auth_provider, last_login)
                VALUES (%s, %s, %s, %s, 'active', %s, %s, 'google', CURRENT_TIMESTAMP)
            ''', (name, email, dummy_hash, target_role, google_sub, picture))
            conn.commit()
            cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
            user = cursor.fetchone()
    else:
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

    if user.get('status') in ('deactivated', 'deleted'):
        try:
            cursor.execute('''
                INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, 'blocked_deactivated_google', 0, %s, %s)
            ''', (user['id'], email, ip_addr, user_agent))
            conn.commit()
        except Exception:
            pass
        conn.close()
        return jsonify({'error': 'Your account has been deactivated. Please contact customer support.'}), 403

    event_type = 'google_admin_login' if user.get('role') == 'admin' else 'google_customer_login'
    try:
        cursor.execute('''
            INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent)
            VALUES (%s, %s, %s, 1, %s, %s)
        ''', (user['id'], email, event_type, ip_addr, user_agent))

        if user.get('role') == 'admin':
            cursor.execute('''
                INSERT INTO admin_login_activity (user_id, email, event_type, success, ip_address, user_agent)
                VALUES (%s, %s, 'google_admin_login', 1, %s, %s)
            ''', (user['id'], email, ip_addr, user_agent))
    except Exception:
        pass

    conn.commit()
    conn.close()

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

@auth_bp.route('/logout', methods=['POST'])
def api_logout():
    """Clear session and log logout event."""
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
        except Exception:
            pass

    session.clear()
    session.modified = True
    resp = jsonify({'success': True, 'message': 'Successfully logged out'})
    resp.delete_cookie('session')
    return resp

@auth_bp.route('/me', methods=['GET'])
def api_me():
    """Return currently authenticated user profile."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name, email, role, status, created_at, last_login, avatar_url, auth_provider, google_id 
        FROM users WHERE id = %s
    ''', (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user or user.get('status') in ('deactivated', 'deleted'):
        session.clear()
        return jsonify({'authenticated': False})

    return jsonify({
        'authenticated': True,
        'user': dict(user)
    })
