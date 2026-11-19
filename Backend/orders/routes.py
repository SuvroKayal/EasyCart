"""
EasyCart Customer Orders Blueprint.
Provides customer order history and line-item lookups.
"""
from flask import Blueprint, jsonify, session
from ..database.connection import get_db

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/api/auth/orders', methods=['GET'])
def api_user_orders():
    """Retrieve all orders placed by the authenticated customer."""
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
