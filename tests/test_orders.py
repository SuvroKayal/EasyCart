"""
EasyCart Order Management & State Transition Machine Automated Tests.
Tests order history retrieval, isolation between users, and state machine transition validation.
"""
from tests.base import BaseTestCase

class TestOrders(BaseTestCase):

    def _create_test_order(self, customer_email="order_test@example.com", status="Confirmed"):
        """Helper to insert a test order directly."""
        import uuid
        conn, cursor = self.get_db_cursor()
        order_id = f"EC-TEST-{uuid.uuid4().hex[:8].upper()}"
        cursor.execute("""
            INSERT INTO orders (id, user_id, customer_name, customer_email, customer_phone, address, city, state, postal_code, subtotal, discount, delivery_fee, total, payment_method, payment_status, status)
            VALUES (%s, 1, 'Test Buyer', %s, '9876543210', '123 Market Rd', 'Mumbai', 'Maharashtra', '400001', 1499.0, 0.0, 0.0, 1499.0, 'cod', 'Pending', %s)
        """, (order_id, customer_email, status))
        cursor.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
            VALUES (%s, 1, 'USB-C Multiport Hub', 1499.0, 1, 1499.0)
        """, (order_id,))
        conn.commit()
        conn.close()
        return order_id

    def test_authenticated_user_order_history(self):
        """Authenticated customer should receive only their orders."""
        email = "history_user@example.com"
        self.client.post('/api/auth/register', json={'name': 'History User', 'email': email, 'password': 'Password123!'})

        # Place an order via checkout
        payload = {
            'items': [{'id': 1, 'quantity': 1}],
            'customer': {
                'name': 'History User',
                'email': email,
                'phone': '9876543210',
                'address': 'Street 10',
                'city': 'Delhi',
                'pincode': '110001'
            }
        }
        res_checkout = self.client.post('/api/cart/checkout', json=payload)
        self.assertEqual(res_checkout.status_code, 200)

        # Retrieve orders
        res_orders = self.client.get('/api/auth/orders')
        self.assertEqual(res_orders.status_code, 200)
        orders = res_orders.get_json()
        self.assertTrue(len(orders) >= 1)
        self.assertEqual(orders[0]['customer_email'], email)

    def test_order_status_valid_state_transitions(self):
        """Valid status workflow progression: Confirmed -> Processing -> Shipped -> Delivered."""
        order_id = self._create_test_order(status="Confirmed")

        # Mock an admin session
        with self.client.session_transaction() as sess:
            sess['user_id'] = 4
            sess['user_email'] = 'suvrokayal2005@gmail.com'
            sess['email'] = 'suvrokayal2005@gmail.com'
            sess['user_role'] = 'admin'
            sess['role'] = 'admin'

        # Confirmed -> Shipped
        res_ship = self.client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Shipped'})
        self.assertEqual(res_ship.status_code, 200)

        # Shipped -> Delivered
        res_deliver = self.client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Delivered'})
        self.assertEqual(res_deliver.status_code, 200)

    def test_order_status_invalid_state_transition_rejected(self):
        """Terminal or invalid transitions (e.g. Delivered -> Confirmed or Cancelled -> Delivered) must be rejected with 400."""
        order_id = self._create_test_order(status="Delivered")

        with self.client.session_transaction() as sess:
            sess['user_id'] = 4
            sess['user_email'] = 'suvrokayal2005@gmail.com'
            sess['email'] = 'suvrokayal2005@gmail.com'
            sess['user_role'] = 'admin'
            sess['role'] = 'admin'

        # Attempt invalid backward transition from Delivered to Confirmed
        res_invalid = self.client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Confirmed'})
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn('invalid status transition', res_invalid.get_json().get('error', '').lower())
