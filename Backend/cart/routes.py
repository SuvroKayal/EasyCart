"""
EasyCart Cart & Coupons Blueprint.
Provides cart total calculations and coupon lookup.
"""
from flask import Blueprint, request, jsonify, session
from .services import calculate_cart_totals
from ..database.seed import COUPONS
from ..database.connection import get_db

cart_bp = Blueprint('cart', __name__)

@cart_bp.route('/api/coupons', methods=['GET'])
def get_coupons():
    """Return available verified promotional coupons."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT code, type, value, min_order, max_discount, description FROM coupons WHERE is_active = 1")
        rows = [dict(r) for r in cursor.fetchall()]
        if rows:
            conn.close()
            return jsonify(rows)
    except Exception:
        pass
    conn.close()
    return jsonify(list(COUPONS.values()))

@cart_bp.route('/api/cart/calculate', methods=['POST'])
def api_calculate_cart():
    """Verify item stock, prices, and recalculate server-side totals."""
    data = request.get_json(silent=True) or {}
    items = data.get('items', [])
    coupon_code = data.get('coupon_code')
    user_id = session.get('user_id')
    user_email = session.get('user_email')
    calculation = calculate_cart_totals(items, coupon_code, user_id=user_id, user_email=user_email)
    return jsonify(calculation)
