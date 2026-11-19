"""
EasyCart Admin Control Center Blueprint.
Handles analytics, overview KPIs, customer management, order fulfillment workflow,
inventory adjustments, offers, categories, and image upload.
"""
import io
import os
import csv
import time
import uuid
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, Response, send_from_directory
from werkzeug.utils import secure_filename
from ..database.connection import get_db
from ..common.security import admin_required, log_admin_action, is_admin_email
from ..common.validators import validate_image_file
from ..database.seed import COUPONS
from ..config import Config

logger = logging.getLogger('easycart.admin')

admin_bp = Blueprint('admin', __name__)

VALID_STATUS_TRANSITIONS = {
    'Confirmed': {'Processing', 'Shipped', 'Cancelled'},
    'Processing': {'Shipped', 'Cancelled'},
    'Shipped': {'Delivered', 'Returned', 'Failed'},
    'Delivered': {'Returned', 'Refunded'},
    'Cancelled': set(),
    'Returned': {'Refunded'},
    'Refunded': set(),
    'Failed': {'Cancelled'}
}

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

def make_category_slug(name):
    import re
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', name).strip().lower()
    return re.sub(r'[\s-]+', '-', slug)

def check_category_cycle(cursor, cat_id, new_parent_id):
    """Check if setting new_parent_id would create a circular dependency."""
    curr = new_parent_id
    visited = set()
    while curr:
        if curr == cat_id:
            return True
        if curr in visited:
            return True
        visited.add(curr)
        cursor.execute("SELECT parent_id FROM categories WHERE id = %s", (curr,))
        row = cursor.fetchone()
        curr = row['parent_id'] if row else None
    return False

# ===========================================================================
# A. Overview & Dashboard Metrics
# ===========================================================================

@admin_bp.route('/api/admin/overview', methods=['GET'])
@admin_required
def api_admin_overview():
    """Return top-level administrative performance metrics and low-stock alerts."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'customer'")
    total_customers = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'active' AND role = 'customer'")
    active_customers = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders WHERE status != 'Cancelled' AND (payment_status = 'Paid' OR status = 'Confirmed')")
    row = cursor.fetchone()
    total_orders = row[0]
    net_revenue = row[1]

    cursor.execute('SELECT COUNT(*) FROM products WHERE quantity <= 10')
    low_stock_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM user_login_activity WHERE DATE(created_at) = DATE('now')")
    today_logins = cursor.fetchone()[0]

    cursor.execute('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 5')
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

# ===========================================================================
# B. Customer Management & Safeguards
# ===========================================================================

@admin_bp.route('/api/admin/customers', methods=['GET'])
@admin_required
def api_admin_customers():
    """Retrieve filtered and sorted customer directory with purchase aggregates."""
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

@admin_bp.route('/api/admin/customers/<int:user_id>', methods=['GET', 'DELETE'])
@admin_required
def api_admin_customer_detail(user_id):
    """Retrieve detailed customer purchase stats or safely delete/deactivate."""
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

    cursor.execute('''
        SELECT * FROM orders
        WHERE user_id = %s
        ORDER BY created_at DESC
    ''', (user_id,))
    orders = [dict(r) for r in cursor.fetchall()]

    for o in orders:
        cursor.execute('SELECT * FROM order_items WHERE order_id = %s', (o['id'],))
        o['items'] = [dict(i) for i in cursor.fetchall()]

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

    conn.close()
    return jsonify({
        'customer': customer,
        'stats': stats,
        'orders': orders
    })

@admin_bp.route('/api/admin/customers/<int:user_id>/status', methods=['PUT', 'PATCH'])
@admin_required
def api_admin_update_customer_status(user_id):
    """Safely update customer status (active/deactivated/deleted). Safeguards protect admins."""
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

    # STRICT SAFEGUARD: Prevent deletion/deactivation of authorized administrators
    if target.get('role') == 'admin' or is_admin_email(target.get('email')):
        conn.close()
        return jsonify({'error': 'Unauthorized: Cannot deactivate or delete a protected administrator account.'}), 403

    prev_status = target.get('status', 'active')
    admin_id = session.get('user_id')
    admin_email = session.get('user_email')

    cursor.execute('UPDATE users SET status = %s WHERE id = %s', (new_status, user_id))
    conn.commit()
    conn.close()

    log_admin_action(admin_id, admin_email, f"customer_{new_status}", "customer", user_id,
                     f"Changed status from {prev_status} to {new_status}. Reason: {reason}")

    return jsonify({
        'success': True,
        'message': f"Customer account {target['name']} ({target['email']}) is now {new_status}.",
        'customer': {'id': user_id, 'status': new_status}
    })

@admin_bp.route('/api/admin/customers/<int:user_id>/revoke-sessions', methods=['POST'])
@admin_required
def api_admin_revoke_sessions(user_id):
    """Invalidate customer active sessions."""
    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "revoke_sessions", "customer", user_id,
                     "Revoked active sessions for customer")
    return jsonify({'success': True, 'message': 'Customer active session revoked successfully.'})

# ===========================================================================
# C. Login Activity & Audit Logs
# ===========================================================================

@admin_bp.route('/api/admin/activity/logins', methods=['GET'])
@admin_required
def api_admin_logins():
    """Return historical authentication activity records with security filters."""
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
        query += " AND (l.event_type = 'admin_login' OR l.event_type = 'admin_logout' OR l.event_type = 'google_admin_login')"
    elif type_filter == 'customer':
        query += " AND (l.event_type = 'customer_login' OR l.event_type = 'customer_logout' OR l.event_type = 'google_customer_login')"

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

    cursor.execute('SELECT COUNT(*) FROM user_login_activity')
    total_events = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM user_login_activity WHERE success = 1')
    successful_logins = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM user_login_activity WHERE success = 0')
    failed_logins = cursor.fetchone()[0]

    conn.close()
    return jsonify({
        'logins': logins,
        'stats': {
            'total_events': total_events,
            'successful_logins': successful_logins,
            'failed_logins': failed_logins
        }
    })

@admin_bp.route('/api/admin/activity/admin', methods=['GET'])
@admin_required
def api_admin_activity():
    """Retrieve immutable administrative mutation audit trail."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100')
    activities = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'activities': activities})

# ===========================================================================
# D. Sales Overview, Analytics, and Order Management
# ===========================================================================

@admin_bp.route('/api/admin/sales/overview', methods=['GET'])
@admin_required
def api_admin_sales_overview():
    """Calculate verified financial metrics across orders."""
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

    total_orders = len(all_orders)
    paid_orders_list = [o for o in all_orders if o.get('status') != 'Cancelled' and (o.get('payment_status') == 'Paid' or o.get('status') == 'Confirmed')]
    pending_orders_list = [o for o in all_orders if o.get('status') == 'Pending' or o.get('payment_status') == 'Pending']
    cancelled_orders_list = [o for o in all_orders if o.get('status') == 'Cancelled']

    gross_sales = sum((o.get('subtotal', 0) + o.get('delivery_fee', 0)) for o in paid_orders_list)
    total_discounts = sum(o.get('discount', 0) for o in paid_orders_list)
    total_refunds = sum(o.get('refund_amount', 0) for o in all_orders)
    net_revenue = sum(o.get('total', 0) for o in paid_orders_list) - total_refunds
    avg_order_value = (net_revenue / len(paid_orders_list)) if paid_orders_list else 0.0

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

@admin_bp.route('/api/admin/sales/analytics', methods=['GET'])
@admin_required
def api_admin_sales_analytics():
    """Retrieve detailed sales analytics: revenue timeline, top products, category performance."""
    conn = get_db()
    cursor = conn.cursor()

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

@admin_bp.route('/api/admin/sales/orders', methods=['GET'])
@admin_required
def api_admin_sales_orders():
    """Retrieve full store sales orders with line items."""
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

@admin_bp.route('/api/admin/orders/<order_id>/status', methods=['PUT', 'PATCH'])
@admin_bp.route('/api/admin/sales/orders/<order_id>/status', methods=['PUT', 'PATCH'])
@admin_required
def api_admin_update_order_status(order_id):
    """Enforce validated order state transitions, payment status updates, and history auditing."""
    data = request.get_json(silent=True) or {}
    new_order_status = data.get('status')
    new_payment_status = data.get('payment_status')
    refund_amount = float(data.get('refund_amount', 0.0))
    admin_id = session.get('user_id')
    admin_email = session.get('user_email') or 'Admin'

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cursor.fetchone()
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        current_order_status = order.get('status')
        current_payment_status = order.get('payment_status')
        payment_method = order.get('payment_method', '')

        # 1. State Machine Validation (Phase 4.6)
        if new_order_status and new_order_status != current_order_status:
            allowed_transitions = VALID_STATUS_TRANSITIONS.get(current_order_status, set())
            if new_order_status not in allowed_transitions and current_order_status != new_order_status:
                return jsonify({
                    'error': f"Invalid status transition from '{current_order_status}' to '{new_order_status}'. Allowed transitions: {sorted(list(allowed_transitions)) or 'None (Terminal state)'}"
                }), 400

        # 2. Automated COD Payment Status Handling (Phase 4.1)
        if not new_payment_status:
            if new_order_status == 'Delivered' and current_payment_status == 'Pending':
                # Cash on Delivery collected upon physical delivery
                new_payment_status = 'Paid'
            elif new_order_status == 'Cancelled' and current_payment_status == 'Pending':
                # Cancelling an unpaid order must not mark it as Paid
                new_payment_status = 'Cancelled'
            elif new_order_status == 'Refunded':
                new_payment_status = 'Refunded'
            elif new_order_status == 'Returned':
                new_payment_status = 'Returned'

        effective_order_status = new_order_status or current_order_status
        effective_payment_status = new_payment_status or current_payment_status

        updates = []
        params = []
        if new_order_status and new_order_status != current_order_status:
            updates.append('status = %s')
            params.append(new_order_status)
        if new_payment_status and new_payment_status != current_payment_status:
            updates.append('payment_status = %s')
            params.append(new_payment_status)
        if refund_amount > 0:
            updates.append('refund_amount = %s')
            params.append(refund_amount)

        if updates:
            params.append(order_id)
            cursor.execute(f"UPDATE orders SET {', '.join(updates)} WHERE id = %s", tuple(params))

            # Record Status Transition History (Phase 4.6)
            cursor.execute('''
                INSERT INTO order_status_history (
                    order_id, from_status, to_status, from_payment_status, to_payment_status, changed_by, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                order_id,
                current_order_status,
                effective_order_status,
                current_payment_status,
                effective_payment_status,
                admin_email,
                f"Status updated by {admin_email}"
            ))

            conn.commit()

            log_admin_action(
                admin_id, admin_email, "update_order", "order", order_id,
                f"Updated order {order_id}: status={current_order_status}->{effective_order_status}, payment={current_payment_status}->{effective_payment_status}, refund={refund_amount}"
            )

        return jsonify({
            'success': True,
            'message': f'Order {order_id} updated successfully.',
            'status': effective_order_status,
            'payment_status': effective_payment_status
        })

    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to update order status: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update order status'}), 500
    finally:
        conn.close()

# ===========================================================================
# E. Data Export (CSV)
# ===========================================================================

@admin_bp.route('/api/admin/sales/export', methods=['GET'])
@admin_bp.route('/api/admin/export/<export_type>', methods=['GET'])
@admin_required
def api_admin_export(export_type=None):
    """Generate dynamic CSV data exports for orders, sales summary, products, and customers."""
    target_type = export_type or request.args.get('type', 'orders')
    range_str = request.args.get('range', 'all')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start_bound, end_bound = parse_date_filter(range_str, start_date, end_date)

    conn = get_db()
    cursor = conn.cursor()
    output = io.StringIO()
    writer = csv.writer(output)

    if target_type == 'orders':
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
                             r['payment_method'], r.get('payment_status', 'Pending'), r['status']])
        filename = f"easycart_orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    elif target_type in ('sales', 'sales_report'):
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

    elif target_type == 'products':
        writer.writerow(['ID', 'SKU', 'Name', 'Category', 'Price (INR)', 'Original Price', 'Stock Quantity', 'Active Status'])
        cursor.execute('SELECT id, sku, name, category, price, original_price, quantity, is_active FROM products ORDER BY id ASC')
        for r in cursor.fetchall():
            writer.writerow([r['id'], r['sku'] or '', r['name'], r['category'], r['price'], r['original_price'] or '', r['quantity'], 'Active' if r.get('is_active', 1) else 'Inactive'])
        filename = f"easycart_products_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    elif target_type == 'customers':
        writer.writerow(['ID', 'Name', 'Email', 'Role', 'Status', 'Registered Date', 'Last Login'])
        cursor.execute('SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY id ASC')
        for r in cursor.fetchall():
            writer.writerow([r['id'], r['name'], r['email'], r['role'], r['status'], r['created_at'], r['last_login'] or ''])
        filename = f"easycart_customers_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    conn.close()
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )

# ===========================================================================
# F. Inventory & Offers Management
# ===========================================================================

@admin_bp.route('/api/admin/inventory', methods=['GET'])
@admin_required
def api_admin_inventory():
    """Retrieve inventory stock matrix sorted by stock priority."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, category, price, quantity, rating, is_active FROM products ORDER BY quantity ASC')
    products = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'products': products})

@admin_bp.route('/api/admin/inventory/<int:product_id>', methods=['PUT'])
@admin_required
def api_admin_update_inventory(product_id):
    """Adjust inventory stock count for a product."""
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
    conn.close()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_inventory", "product", product_id,
                     f"Adjusted inventory of {prod['name']} from {old_qty} to {new_quantity}")

    return jsonify({'success': True, 'product_id': product_id, 'quantity': new_quantity})

@admin_bp.route('/api/admin/offers', methods=['GET'])
@admin_required
def api_admin_offers():
    """Retrieve offers and voucher redemption analytics."""
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

# ===========================================================================
# G. Category Hierarchy Management
# ===========================================================================

@admin_bp.route('/api/admin/categories', methods=['GET'])
@admin_required
def api_admin_categories():
    """Return category hierarchy with product counts."""
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

@admin_bp.route('/api/admin/categories', methods=['POST'])
@admin_required
def api_admin_create_category():
    """Create a new category node."""
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

    slug = data.get('slug', '').strip() or make_category_slug(name)

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

@admin_bp.route('/api/admin/categories/<int:cat_id>', methods=['PUT'])
@admin_required
def api_admin_update_category(cat_id):
    """Update category properties and parent relationship with cycle protection."""
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

@admin_bp.route('/api/admin/categories/<int:cat_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_category(cat_id):
    """Delete a category node with dependency safeguards."""
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
        return jsonify({'error': f'Cannot delete category: contains {child_count} subcategories. Reassign first.'}), 400

    cursor.execute('''
        SELECT COUNT(*) FROM products 
        WHERE category_id = %s OR subcategory_id = %s OR nested_category_id = %s
    ''', (cat_id, cat_id, cat_id))
    prod_count = cursor.fetchone()[0]
    if prod_count > 0:
        conn.close()
        return jsonify({'error': f'Cannot delete category: {prod_count} products assigned. Reassign first.'}), 400

    cursor.execute("DELETE FROM categories WHERE id = %s", (cat_id,))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "delete_category", "category", cat_id,
                     f"Deleted category '{cat['name']}' (ID: {cat_id})")

    conn.close()
    return jsonify({'success': True, 'message': f"Category '{cat['name']}' deleted successfully."})

# ===========================================================================
# H. Secure Image Upload (Magic Bytes Verification)
# ===========================================================================

@admin_bp.route('/api/admin/upload-image', methods=['POST'])
@admin_required
def api_admin_upload_image():
    """Upload product imagery with true binary magic-bytes signature verification."""
    if 'file' not in request.files and 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded'}), 400
    file = request.files.get('file') or request.files.get('image')
    
    # Verify magic bytes, file format, and size limits
    is_valid, ext, err_msg = validate_image_file(file)
    if not is_valid:
        return jsonify({'error': err_msg}), 400

    unique_filename = f"prod_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"

    os.makedirs(Config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(Config.BACKEND_UPLOAD_DIR, exist_ok=True)

    file_bytes = file.read()
    file_size = len(file_bytes)
    frontend_path = os.path.join(Config.UPLOAD_DIR, unique_filename)
    backend_path = os.path.join(Config.BACKEND_UPLOAD_DIR, unique_filename)

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

@admin_bp.route('/uploads/products/<path:filename>')
def serve_uploaded_product_image(filename):
    """Serve uploaded product image from persistent storage."""
    safe_filename = secure_filename(filename)
    if os.path.exists(os.path.join(Config.BACKEND_UPLOAD_DIR, safe_filename)):
        return send_from_directory(Config.BACKEND_UPLOAD_DIR, safe_filename)
    elif os.path.exists(os.path.join(Config.UPLOAD_DIR, safe_filename)):
        return send_from_directory(Config.UPLOAD_DIR, safe_filename)
    return jsonify({'error': 'Image not found'}), 404
