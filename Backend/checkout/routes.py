"""
EasyCart Checkout Blueprint.
Handles atomic stock deduction, input validation, collision-resistant order ID generation,
and transaction-safe order placement.
"""
import time
import secrets
import logging
from flask import Blueprint, request, jsonify, session
from ..database.connection import get_db
from ..cart.services import calculate_cart_totals
from ..common.validators import validate_delivery_info, validate_cart_quantity
from ..extensions import rate_limit

logger = logging.getLogger('easycart.checkout')

checkout_bp = Blueprint('checkout', __name__)

def generate_unique_order_id(cursor) -> str:
    """Generate a collision-resistant, cryptographically random, timestamp-prefixed order ID."""
    for _ in range(5):
        # Format: EC-XXXX-XXXXXX (e.g. EC-674A3B-8F92D1)
        rand_suffix = secrets.token_hex(4).upper()
        time_part = hex(int(time.time()))[2:].upper()[-4:]
        candidate = f"EC-{time_part}-{rand_suffix}"
        
        cursor.execute("SELECT id FROM orders WHERE id = %s", (candidate,))
        if not cursor.fetchone():
            return candidate

    # Fallback to full hex UUID
    return f"EC-{secrets.token_hex(8).upper()}"

@checkout_bp.route('/api/cart/checkout', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def api_checkout():
    """Execute transaction-safe order placement with atomic inventory verification."""
    data = request.get_json(silent=True) or {}
    cart_items = data.get('items', [])
    coupon_code = data.get('coupon_code')
    delivery_info = data.get('delivery') or data.get('customer') or {}
    payment_method = data.get('payment_method', 'Cash on Delivery (Demo)')

    if not cart_items:
        return jsonify({'error': 'Your cart is empty'}), 400

    # 1. Delivery Input Validation
    is_valid_delivery, delivery_err = validate_delivery_info(delivery_info)
    if not is_valid_delivery:
        return jsonify({'error': delivery_err}), 400

    # 2. Cart Item Validation
    for item in cart_items:
        valid_qty, _, qty_err = validate_cart_quantity(item.get('quantity'))
        if not valid_qty:
            return jsonify({'error': qty_err}), 400

    # 3. Server-authoritative Price & Stock Calculation
    user_id = session.get('user_id')
    user_email = delivery_info.get('email', '').strip().lower()
    calc = calculate_cart_totals(cart_items, coupon_code, user_id=user_id, user_email=user_email)
    if calc['stock_errors']:
        return jsonify({'error': calc['stock_errors'][0]}), 400

    if not calc['items']:
        return jsonify({'error': 'No valid products in cart to purchase.'}), 400

    # 4. Atomic Database Transaction: Deduct Stock, Apply Coupon, & Insert Order
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Atomic inventory deduction (prevents overselling race conditions)
        for item in calc['items']:
            pid = item['id']
            qty = item['quantity']

            # Conditional atomic update: only deduct if quantity >= required
            cursor.execute('''
                UPDATE products
                SET quantity = quantity - %s
                WHERE id = %s AND quantity >= %s
            ''', (qty, pid, qty))

            if cursor.rowcount == 0:
                conn.rollback()
                logger.warning(f"Atomic stock deduction failed for product {pid}: insufficient stock.")
                return jsonify({
                    'error': f"Insufficient stock for '{item['name']}'. Another shopper may have just purchased the last available units."
                }), 400

        # Unique Order ID Generation
        order_id = generate_unique_order_id(cursor)

        # Coupon Enforcement & Usage Tracking inside Transaction (Phase 4.5)
        applied_coupon = calc.get('applied_coupon')
        if applied_coupon:
            c_code = applied_coupon['code'].strip().upper()
            cursor.execute("""
                SELECT id, max_uses, used_count, max_uses_per_user 
                FROM coupons WHERE UPPER(code) = %s AND is_active = 1
            """, (c_code,))
            c_row = cursor.fetchone()
            if c_row:
                c_id = c_row['id']
                max_u = c_row.get('max_uses')
                curr_u = c_row.get('used_count', 0) or 0
                if max_u is not None and curr_u >= max_u:
                    conn.rollback()
                    return jsonify({'error': f"Coupon '{c_code}' has reached its maximum global usage limit."}), 400

                max_per_u = c_row.get('max_uses_per_user', 1) or 1
                cursor.execute("""
                    SELECT COUNT(*) FROM coupon_redemptions 
                    WHERE UPPER(coupon_code) = %s AND (user_id = %s OR LOWER(customer_email) = %s)
                """, (c_code, user_id, user_email))
                user_u = cursor.fetchone()[0]
                if user_u >= max_per_u:
                    conn.rollback()
                    return jsonify({'error': f"You have already redeemed coupon '{c_code}' the maximum allowable times."}), 400

                # Increment global used_count atomically
                cursor.execute("UPDATE coupons SET used_count = used_count + 1 WHERE id = %s", (c_id,))
                
                # Record specific redemption
                cursor.execute("""
                    INSERT INTO coupon_redemptions (coupon_id, coupon_code, user_id, customer_email, order_id, discount_amount)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (c_id, c_code, user_id, user_email, order_id, calc['discount']))

        # Payment Status Handling (Phase 4.1: Cash on Delivery defaults to Pending)
        payment_status = 'Pending'

        # Insert Order Record
        cursor.execute('''
            INSERT INTO orders (
                id, user_id, customer_name, customer_email, customer_phone,
                address, city, state, postal_code, subtotal, discount,
                delivery_fee, total, coupon_code, payment_method, payment_status, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Confirmed')
        ''', (
            order_id, user_id,
            delivery_info['name'].strip(),
            user_email,
            delivery_info['phone'].strip(),
            delivery_info['address'].strip(),
            delivery_info['city'].strip(),
            delivery_info['state'].strip(),
            delivery_info['postal_code'].strip(),
            calc['subtotal'],
            calc['discount'],
            calc['delivery_fee'],
            calc['total'],
            applied_coupon['code'] if applied_coupon else None,
            payment_method,
            payment_status
        ))

        # Insert Line Items
        for item in calc['items']:
            cursor.execute('''
                INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (
                order_id, item['id'], item['name'], item['price'], item['quantity'], item['total']
            ))

        # Record Initial Status History (Phase 4.6)
        cursor.execute('''
            INSERT INTO order_status_history (order_id, from_status, to_status, from_payment_status, to_payment_status, changed_by, notes)
            VALUES (%s, NULL, 'Confirmed', NULL, %s, 'Customer Checkout', 'Order placed by customer')
        ''', (order_id, payment_status))

        # Commit Transaction atomically
        conn.commit()

        logger.info(f"Order {order_id} successfully created for customer {user_email}")

        order_dict = {
            'id': order_id,
            'order_id': order_id,
            'customer': delivery_info,
            'items': calc['items'],
            'subtotal': calc['subtotal'],
            'discount': calc['discount'],
            'delivery_fee': calc['delivery_fee'],
            'total': calc['total'],
            'payment_method': payment_method,
            'payment_status': payment_status,
            'status': 'Confirmed'
        }

        return jsonify({
            'success': True,
            'order_id': order_id,
            'order': order_dict,
            'order_details': order_dict,
            'message': 'Order placed successfully! Thank you for shopping with EasyCart.'
        }), 200

    except Exception as e:
        conn.rollback()
        logger.error(f"Checkout transaction failed: {e}", exc_info=True)
        return jsonify({'error': 'Failed to process checkout transaction. Please try again.'}), 500
    finally:
        conn.close()

