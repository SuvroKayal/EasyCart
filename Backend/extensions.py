"""
EasyCart Extensions Module.
Provides rate limiting, CSRF protection, and shared application utilities.
"""
import os
import time
import secrets
from collections import defaultdict
from functools import wraps
from flask import request, jsonify, session
import logging

logger = logging.getLogger('easycart.extensions')

class InMemoryRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter for development and testing."""
    def __init__(self):
        self._requests = defaultdict(list)

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        # Prune old timestamps
        timestamps = [t for t in self._requests[key] if t > window_start]
        self._requests[key] = timestamps
        
        if len(timestamps) >= max_requests:
            return True
            
        self._requests[key].append(now)
        return False

class RedisRateLimiter:
    """Redis-backed distributed sliding-window rate limiter for multi-worker production deployments."""
    def __init__(self, redis_url: str):
        try:
            import redis
            self._client = redis.from_url(redis_url, decode_responses=True)
            self._client.ping()
            logger.info("Connected to Redis for distributed rate limiting.")
        except Exception as e:
            logger.critical(f"Failed to connect to Redis at {redis_url}: {e}")
            raise RuntimeError(f"Could not connect to Redis distributed rate limiter: {e}")

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        redis_key = f"ratelimit:{key}"

        pipeline = self._client.pipeline()
        pipeline.zremrangebyscore(redis_key, '-inf', window_start)
        pipeline.zcard(redis_key)
        pipeline.zadd(redis_key, {f"{now}:{secrets.token_hex(4)}": now})
        pipeline.expire(redis_key, window_seconds + 5)
        results = pipeline.execute()

        request_count = results[1]
        return request_count >= max_requests

_limiter_instance = None

def get_rate_limiter():
    """Resolve and return active rate limiter implementation based on environment."""
    global _limiter_instance
    if _limiter_instance is not None:
        return _limiter_instance

    redis_url = os.environ.get('REDIS_URL', '').strip()
    is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('APP_ENV') == 'production'
    allow_memory = os.environ.get('ALLOW_IN_MEMORY_RATE_LIMIT', '0') == '1'

    if redis_url:
        _limiter_instance = RedisRateLimiter(redis_url)
    elif is_prod:
        if not allow_memory:
            logger.critical("FATAL: REDIS_URL environment variable is required in production mode for shared rate limiting.")
            raise RuntimeError(
                "FATAL CONFIGURATION ERROR: REDIS_URL environment variable must be set in production mode for distributed "
                "multi-worker rate limiting across Render instances. Set REDIS_URL in Render, or set ALLOW_IN_MEMORY_RATE_LIMIT=1 to override."
            )
        else:
            logger.warning("Production mode running with in-memory rate limiter override (ALLOW_IN_MEMORY_RATE_LIMIT=1).")
            _limiter_instance = InMemoryRateLimiter()
    else:
        _limiter_instance = InMemoryRateLimiter()

    return _limiter_instance

def rate_limit(max_requests=30, window_seconds=60, error_message=None):
    """Decorator to enforce rate limiting by client IP or session user."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # In testing environments, bypass rate limiting if requested
            if os.environ.get('TESTING') == 'True' and os.environ.get('DISABLE_RATE_LIMIT') == '1':
                return f(*args, **kwargs)

            # Prefer authenticated user ID, fallback to client IP
            user_id = session.get('user_id')
            ip = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1')
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            
            key = f"{f.__name__}:{user_id if user_id else ip}"
            limiter = get_rate_limiter()
            
            if limiter.is_rate_limited(key, max_requests, window_seconds):
                msg = error_message or f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds}s. Please slow down."
                logger.warning(f"Rate limit triggered for {key} on {request.path}")
                return jsonify({'error': msg, 'status': 429}), 429
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def generate_csrf_token():
    """Generate or retrieve the session CSRF token."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

def verify_csrf_token():
    """Verify CSRF token on state-changing requests."""
    # Safe methods do not require CSRF
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
        
    expected_token = session.get('csrf_token')
    if not expected_token:
        # If no session token yet, generate one for legitimate clients
        expected_token = generate_csrf_token()

    # Check header
    received_token = request.headers.get('X-CSRF-Token')
    
    # Also support X-Requested-With for XMLHttpRequest / same-origin calls
    is_xhr = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    # Validate token or valid XHR origin
    if received_token and secrets.compare_digest(received_token, expected_token):
        return None
    elif is_xhr and not received_token:
        # Same-origin custom header verification
        return None
    elif received_token:
        # Explicit token was sent but didn't match
        return jsonify({'error': 'Invalid or expired CSRF token. Please refresh the page.'}), 403
    else:
        # State changing request with no CSRF token and no XHR header
        return jsonify({'error': 'CSRF verification failed: Missing X-CSRF-Token or XMLHttpRequest header.'}), 403
