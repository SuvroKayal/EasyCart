"""
EasyCart Configuration Module.
Centralizes environment variables, secret management, and environment configurations.
"""
import os
import sys
import logging

logger = logging.getLogger('easycart.config')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'Backend')

def load_dotenv_simple():
    """Lightweight .env parser for local development without external dependencies."""
    for env_path in [os.path.join(PROJECT_ROOT, '.env'), os.path.join(BACKEND_DIR, '.env')]:
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

load_dotenv_simple()

is_prod_env = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('APP_ENV') == 'production'
if is_prod_env and not os.environ.get('SECRET_KEY'):
    logger.critical("FATAL: SECRET_KEY environment variable is required in production mode.")
    raise ValueError("SECRET_KEY environment variable is required in production mode. Set a strong secret key in your environment.")

AUTHORITATIVE_ADMIN_EMAILS = {'suvrokayal2005@gmail.com', 'shraddha66singh66@gmail.com'}

def parse_admin_emails():
    """Retrieve verified administrative email allowlist from environment, falling back safely to code-configured administrators."""
    env_admins = os.environ.get('ADMIN_EMAILS', '').strip()
    if env_admins:
        emails = [e.strip().lower() for e in env_admins.split(',') if e.strip()]
        if emails:
            return set(emails)
    # Both authorized superadmin accounts configured directly in application code
    return set(AUTHORITATIVE_ADMIN_EMAILS)

class Config:
    """Base application configuration."""
    PROJECT_ROOT = PROJECT_ROOT
    BACKEND_DIR = BACKEND_DIR
    SQLITE_DB_FILE = os.path.join(BACKEND_DIR, 'easycart.db')
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    # Secret Key Management
    SECRET_KEY = os.environ.get('SECRET_KEY')
    DEV_KEY_FILE = os.path.join(BACKEND_DIR, '.dev_secret.key')
    
    # Session Security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV') == 'production'
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days
    
    # Google OAuth 2.0 Web Client ID (strictly configured via environment; no hardcoded fallback)
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
    GOOGLE_LOGIN_ENABLED = bool(GOOGLE_CLIENT_ID)
    ADMIN_EMAILS = parse_admin_emails()
    
    # Shared Redis Store for Distributed Rate Limiting (Phase 5.3)
    REDIS_URL = os.environ.get('REDIS_URL', '').strip()
    ALLOW_IN_MEMORY_RATE_LIMIT = os.environ.get('ALLOW_IN_MEMORY_RATE_LIMIT', '0') == '1'
    
    # Upload Directories
    UPLOAD_DIR = os.path.join(PROJECT_ROOT, 'Frontend', 'public', 'uploads', 'products')
    BACKEND_UPLOAD_DIR = os.path.join(BACKEND_DIR, 'uploads', 'products')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max request size
    
    # Pricing & Delivery Constants
    DELIVERY_FEE = 40.0
    FREE_DELIVERY_THRESHOLD = 999.0
    
    # Rate Limiting Defaults
    RATELIMIT_DEFAULT = "120 per minute"
    RATELIMIT_AUTH = "15 per minute"
    RATELIMIT_CHECKOUT = "10 per minute"

class DevelopmentConfig(Config):
    """Local development configuration."""
    DEBUG = True
    SESSION_COOKIE_SECURE = False

class TestingConfig(Config):
    """Automated testing configuration."""
    TESTING = True
    DEBUG = False
    SESSION_COOKIE_SECURE = False
    DATABASE_URL = None  # Force isolated SQLite or test DB

class ProductionConfig(Config):
    """Production deployment configuration."""
    DEBUG = False
    SESSION_COOKIE_SECURE = True

def get_config():
    """Resolve active configuration class based on FLASK_ENV or APP_ENV."""
    env = os.environ.get('FLASK_ENV', os.environ.get('APP_ENV', 'development')).lower()
    if env == 'production':
        return ProductionConfig
    elif env == 'testing':
        return TestingConfig
    return DevelopmentConfig
