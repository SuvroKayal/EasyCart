"""
EasyCart Cart & Pricing Services.
Calculates server-authoritative totals, verifies current database prices,
validates stock levels, and applies promotional vouchers safely.
"""
from datetime import datetime
from ..database.connection import get_db
from ..database.seed import COUPONS as DEFAULT_COUPONS
from ..config import Config
from ..common.validators import validate_cart_quantity

def get_coupon_rule(coupon_code: str, user_id=None, user_email=None):
    """Retrieve and validate coupon rule from database or fallback defaults.
    Checks active status, expiration date, global usage limit, and per-user redemption limits.
    """
    if not coupon_code:
        return None, None
    code_upper = coupon_code.strip().upper()

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM coupons WHERE UPPER(code) = %s AND is_active = 1", (code_upper,))
        row = cursor.fetchone()
        if row:
            rule = dict(row)
            
            # 1. Expiration check
            if rule.get('expires_at'):
                try:
                    exp = rule['expires_at']
                    if isinstance(exp, str):
                        exp = datetime.fromisoformat(exp)
                    if datetime.now() > exp:
                        conn.close()
                        return None, f"Coupon '{code_upper}' expired on {exp.strftime('%Y-%m-%d')}."
                except Exception:
                    pass

            # 2. Global usage limit check
            max_uses = rule.get('max_uses')
            used_count = rule.get('used_count', 0) or 0
            if max_uses is not None and used_count >= max_uses:
                conn.close()
                return None, f"Coupon '{code_upper}' has reached its maximum redemption limit."

            # 3. Per-user usage limit check
            max_user = rule.get('max_uses_per_user', 1) or 1
            if user_id or user_email:
                try:
                    cursor.execute("""
                        SELECT COUNT(*) FROM coupon_redemptions 
                        WHERE UPPER(coupon_code) = %s AND (user_id = %s OR LOWER(customer_email) = %s)
                    """, (code_upper, user_id, (user_email or '').lower()))
                    user_redemptions = cursor.fetchone()[0]
                    if user_redemptions >= max_user:
                        conn.close()
                        return None, f"You have already redeemed coupon '{code_upper}' the maximum allowable times."
                except Exception:
                    pass

            conn.close()
            return rule, None
    except Exception:
        pass
    conn.close()

    # Fallback to configured defaults
    default_rule = DEFAULT_COUPONS.get(code_upper)
    if default_rule:
        return default_rule, None
    return None, f"Invalid promotional coupon code '{coupon_code}'."

def calculate_cart_totals(items, coupon_code=None, user_id=None, user_email=None):
    """Calculate verified subtotal, discount, delivery fee, and total based on live database values."""
    verified_items = []
    subtotal = 0.0
    stock_errors = []

    conn = get_db()
    cursor = conn.cursor()

    for item in items:
        pid = item.get('id')
        raw_qty = item.get('quantity', 1)
        valid_qty, req_qty, err = validate_cart_quantity(raw_qty)
        if not valid_qty:
            stock_errors.append(f"Product ID {pid}: {err}")
            continue

        cursor.execute('SELECT id, name, price, quantity, category, image, image_url FROM products WHERE id = %s', (pid,))
        prod = cursor.fetchone()
        if not prod:
            stock_errors.append(f"Product ID {pid} is no longer available.")
            continue

        available_stock = prod['quantity']
        if available_stock < req_qty:
            stock_errors.append(f"'{prod['name']}' has only {available_stock} units available.")
            continue

        item_price = float(prod['price'])
        item_total = round(item_price * req_qty, 2)
        subtotal += item_total

        verified_items.append({
            'id': prod['id'],
            'name': prod['name'],
            'price': item_price,
            'quantity': req_qty,
            'total': item_total,
            'category': prod['category'],
            'image': prod['image'] or prod.get('image_url')
        })

    conn.close()

    subtotal = round(subtotal, 2)
    discount_amount = 0.0
    applied_coupon = None
    coupon_message = None

    if coupon_code and subtotal > 0:
        code_upper = coupon_code.strip().upper()
        rule, rule_err = get_coupon_rule(code_upper, user_id=user_id, user_email=user_email)

        if rule:
            min_order = float(rule.get('min_order', 0) or 0)
            if subtotal < min_order:
                coupon_message = f"Coupon '{code_upper}' requires a minimum order of ₹{min_order:.0f}."
            else:
                c_type = rule.get('type')
                c_val = float(rule.get('value', 0) or 0)
                max_disc = rule.get('max_discount')
                if max_disc is not None:
                    max_disc = float(max_disc)

                if c_type == 'percentage':
                    discount_amount = subtotal * (c_val / 100.0)
                    if max_disc is not None and discount_amount > max_disc:
                        discount_amount = max_disc
                elif c_type == 'flat':
                    discount_amount = min(c_val, subtotal)
                elif c_type == 'free_shipping':
                    discount_amount = 0.0

                discount_amount = round(discount_amount, 2)
                applied_coupon = {
                    'code': code_upper,
                    'discount': discount_amount,
                    'type': c_type,
                    'description': rule.get('description', '')
                }
                coupon_message = f"Coupon '{code_upper}' applied successfully!"
        else:
            coupon_message = rule_err or f"Invalid or expired coupon code '{coupon_code}'."

    delivery_fee = Config.DELIVERY_FEE if subtotal > 0 else 0.0
    if subtotal >= Config.FREE_DELIVERY_THRESHOLD or (applied_coupon and applied_coupon['type'] == 'free_shipping'):
        delivery_fee = 0.0

    final_total = max(0.0, round(subtotal - discount_amount + delivery_fee, 2))

    return {
        'items': verified_items,
        'subtotal': subtotal,
        'discount': discount_amount,
        'delivery_fee': delivery_fee,
        'total': final_total,
        'free_delivery_threshold': Config.FREE_DELIVERY_THRESHOLD,
        'applied_coupon': applied_coupon,
        'coupon_message': coupon_message,
        'stock_errors': stock_errors,
        'errors': stock_errors
    }

