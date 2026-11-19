"""
EasyCart Standardized API Response Utilities.
"""
from flask import jsonify

def success_response(data=None, message=None, status_code=200):
    """Format a consistent JSON success response."""
    payload = {'success': True}
    if message:
        payload['message'] = message
    if data is not None:
        if isinstance(data, dict):
            payload.update(data)
        else:
            payload['data'] = data
    return jsonify(payload), status_code

def error_response(message: str, status_code: int = 400, details=None):
    """Format a consistent JSON error response."""
    payload = {'error': message, 'status': status_code}
    if details:
        payload['details'] = details
    return jsonify(payload), status_code
