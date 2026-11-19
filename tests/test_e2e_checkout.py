"""
EasyCart Full End-to-End E-Commerce Flow Integration Test (Phase 6.4).
Verifies the complete lifecycle:
1. Product browsing & catalog querying
2. Product detail inspection
3. Cart calculation & quantity updating
4. Coupon application, removal, and re-application
5. Delivery contact validation
6. Collision-resistant order creation & atomic inventory deduction
7. Authenticated user order history retrieval
8. Administrative order status workflow (Confirmed -> Processing -> Shipped -> Delivered)
9. Automatic COD payment status transition to Paid upon Delivery
10. State machine terminal transition safeguards (rejecting invalid transitions)
11. Coupon global usage counter incrementing
12. Comprehensive order status audit trail recording
"""
import uuid
from tests.base import BaseTestCase

class TestEndToEndCheckout(BaseTestCase):

    def test_complete_shopper_to_admin_lifecycle(self):
        """Execute the complete 15-step end-to-end e-commerce journey."""
        # --- Step 1: Register and authenticate customer ---
        customer_email = f"e2e_shopper_{uuid.uuid4().hex[:6]}@example.com"
        reg_res = self.client.post('/api/auth/register', json={
            'name': 'E2E Shopper',
            'email': customer_email,
            'password': 'SecurePassword123!'
        })
        self.assertEqual(reg_res.status_code, 200)

        # --- Step 2: Browse Products Catalog ---
        res_catalog = self.client.get('/api/products')
        self.assertEqual(res_catalog.status_code, 200)
        catalog = res_catalog.get_json()
        self.assertTrue(len(catalog) >= 20, "Catalog should contain standard products")
        sample_prod = catalog[0]
        self.assertIn('id', sample_prod)
        self.assertIn('name', sample_prod)
        self.assertIn('price', sample_prod)
        self.assertIn('quantity', sample_prod)

        # Pick product ID 2 for the lifecycle
        res_prod = self.client.get('/api/products/2')
        self.assertEqual(res_prod.status_code, 200)
        prod_data = res_prod.get_json().get('product')
        self.assertIsNotNone(prod_data)
        initial_stock = prod_data['quantity']
        prod_price = prod_data['price']

        # --- Step 3: Add to Cart & Calculate Totals (1 unit) ---
        calc_1 = self.client.post('/api/cart/calculate', json={
            'items': [{'id': 2, 'quantity': 1}]
        })
        self.assertEqual(calc_1.status_code, 200)
        c1_data = calc_1.get_json()
        self.assertEqual(c1_data['subtotal'], prod_price)
        self.assertEqual(c1_data['discount'], 0.0)

        # --- Step 4: Update Quantity (2 units) ---
        calc_2 = self.client.post('/api/cart/calculate', json={
            'items': [{'id': 2, 'quantity': 2}]
        })
        self.assertEqual(calc_2.status_code, 200)
        c2_data = calc_2.get_json()
        self.assertEqual(c2_data['subtotal'], prod_price * 2)

        # --- Step 5: Apply Coupon (SAVE50) ---
        calc_coupon1 = self.client.post('/api/cart/calculate', json={
            'items': [{'id': 2, 'quantity': 2}],
            'coupon_code': 'SAVE50'
        })
        self.assertEqual(calc_coupon1.status_code, 200)
        cc1_data = calc_coupon1.get_json()
        self.assertEqual(cc1_data.get('applied_coupon', {}).get('code'), 'SAVE50')
        self.assertEqual(cc1_data['discount'], 50.0)

        # --- Step 6: Reapply Different Coupon (WELCOME10) ---
        calc_coupon2 = self.client.post('/api/cart/calculate', json={
            'items': [{'id': 2, 'quantity': 2}],
            'coupon_code': 'WELCOME10'
        })
        self.assertEqual(calc_coupon2.status_code, 200)
        cc2_data = calc_coupon2.get_json()
        self.assertEqual(cc2_data.get('applied_coupon', {}).get('code'), 'WELCOME10')
        expected_discount = min(round((prod_price * 2) * 0.10, 2), 500.0)
        self.assertEqual(cc2_data['discount'], expected_discount)

        # Read initial coupon used_count
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT used_count FROM coupons WHERE code = 'WELCOME10'")
        coupon_initial_uses = cursor.fetchone()[0] or 0
        conn.close()

        # --- Step 7: Proceed to Checkout with Invalid/Missing Delivery Details (Must Fail) ---
        bad_checkout = self.client.post('/api/cart/checkout', json={
            'items': [{'id': 2, 'quantity': 2}],
            'coupon_code': 'WELCOME10',
            'delivery': {
                'name': '', # Missing name
                'email': 'invalid-email',
                'phone': '123' # Invalid phone
            }
        })
        self.assertEqual(bad_checkout.status_code, 400)

        # --- Step 8: Complete Valid Checkout & Verify Atomic Order Placement ---
        checkout_payload = {
            'items': [{'id': 2, 'quantity': 2}],
            'coupon_code': 'WELCOME10',
            'delivery': {
                'name': 'E2E Shopper',
                'email': customer_email,
                'phone': '9876543210',
                'address': '742 Evergreen Terrace',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400001'
            },
            'payment_method': 'Cash on Delivery (Demo)'
        }
        res_checkout = self.client.post('/api/cart/checkout', json=checkout_payload)
        self.assertEqual(res_checkout.status_code, 200)
        order_res = res_checkout.get_json()
        self.assertTrue(order_res.get('success'))
        order_id = order_res.get('order_id')
        self.assertTrue(order_id.startswith('EC-'))

        # --- Step 9: Verify Atomic Inventory Deduction & Coupon Usage Increment ---
        res_prod_after = self.client.get('/api/products/2')
        new_stock = res_prod_after.get_json()['product']['quantity']
        self.assertEqual(new_stock, initial_stock - 2)

        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT used_count FROM coupons WHERE code = 'WELCOME10'")
        coupon_new_uses = cursor.fetchone()[0]
        self.assertEqual(coupon_new_uses, coupon_initial_uses + 1)
        conn.close()

        # --- Step 10: Verify Order Appears in Authenticated User Order History ---
        res_history = self.client.get('/api/auth/orders')
        self.assertEqual(res_history.status_code, 200)
        user_orders = res_history.get_json()
        matching_orders = [o for o in user_orders if o['id'] == order_id]
        self.assertEqual(len(matching_orders), 1)
        self.assertEqual(matching_orders[0]['status'], 'Confirmed')
        self.assertEqual(matching_orders[0]['payment_status'], 'Pending')

        # --- Step 11: Admin Login and Order Retrieval ---
        admin_conn, admin_cursor = self.get_db_cursor()
        admin_cursor.execute("SELECT id FROM users WHERE email = 'suvrokayal2005@gmail.com'")
        suvro_user = admin_cursor.fetchone()
        admin_conn.close()

        with self.client.session_transaction() as sess:
            sess['user_id'] = suvro_user[0]
            sess['user_email'] = 'suvrokayal2005@gmail.com'
            sess['email'] = 'suvrokayal2005@gmail.com'
            sess['user_role'] = 'admin'
            sess['role'] = 'admin'

        res_admin_orders = self.client.get('/api/admin/sales/orders')
        self.assertEqual(res_admin_orders.status_code, 200)
        admin_orders_list = res_admin_orders.get_json().get('orders', [])
        self.assertTrue(any(o['id'] == order_id for o in admin_orders_list))

        # --- Step 12: Admin Status Transition: Confirmed -> Processing -> Shipped -> Delivered ---
        res_proc = self.client.put(f'/api/admin/sales/orders/{order_id}/status', json={'status': 'Processing'})
        self.assertEqual(res_proc.status_code, 200)

        res_ship = self.client.put(f'/api/admin/sales/orders/{order_id}/status', json={'status': 'Shipped'})
        self.assertEqual(res_ship.status_code, 200)

        # Transition to Delivered: Must trigger automatic payment_status -> Paid for COD
        res_deliv = self.client.put(f'/api/admin/sales/orders/{order_id}/status', json={'status': 'Delivered'})
        self.assertEqual(res_deliv.status_code, 200)

        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT status, payment_status FROM orders WHERE id = %s", (order_id,))
        final_order = cursor.fetchone()
        self.assertEqual(final_order[0], 'Delivered')
        self.assertEqual(final_order[1], 'Paid', "COD order must transition to Paid upon delivery")

        # --- Step 13: Terminal State Transition Safeguard (Delivered cannot transition backwards) ---
        res_invalid_rev = self.client.put(f'/api/admin/sales/orders/{order_id}/status', json={'status': 'Confirmed'})
        self.assertEqual(res_invalid_rev.status_code, 400, "Terminal Delivered order cannot be transitioned to Confirmed")

        # --- Step 14: Verify Order Status Audit Trail ---
        cursor.execute("""
            SELECT from_status, to_status, to_payment_status, changed_by 
            FROM order_status_history 
            WHERE order_id = %s 
            ORDER BY id ASC
        """, (order_id,))
        history = cursor.fetchall()
        self.assertTrue(len(history) >= 4, "Should have checkout + processing + shipped + delivered entries")
        self.assertEqual(history[0][1], 'Confirmed')
        self.assertEqual(history[-1][1], 'Delivered')
        self.assertEqual(history[-1][2], 'Paid')
        conn.close()
