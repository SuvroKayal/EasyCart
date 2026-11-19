"""
EasyCart Atomic Checkout & Inventory Concurrency Automated Tests.
Verifies collision-resistant order IDs, atomic stock reduction, transaction rollback, and overselling safeguards.
"""
from tests.base import BaseTestCase

class TestCheckoutAtomic(BaseTestCase):

    def test_successful_checkout_order_creation(self):
        """Checkout should create order record, deduct stock, and return collision-resistant ID."""
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT quantity FROM products WHERE id = 3")
        initial_stock = cursor.fetchone()[0]
        conn.close()

        payload = {
            'items': [{'id': 3, 'quantity': 2}],
            'customer': {
                'name': 'Priya Sharma',
                'email': 'priya.sharma@example.com',
                'phone': '9876543210',
                'address': 'Flat 402, Lotus Residency',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'pincode': '400001'
            },
            'payment_method': 'cod'
        }

        res = self.client.post('/api/cart/checkout', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        order = data.get('order', {})
        order_id = order.get('id')
        self.assertTrue(order_id.startswith('EC-'))
        self.assertEqual(len(order_id.split('-')), 3)

        # Verify stock was atomically deducted
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT quantity FROM products WHERE id = 3")
        new_stock = cursor.fetchone()[0]
        self.assertEqual(new_stock, initial_stock - 2)

        # Verify order persisted in database
        cursor.execute("SELECT id, total, status FROM orders WHERE id = %s", (order_id,))
        order_row = cursor.fetchone()
        self.assertIsNotNone(order_row)
        self.assertEqual(order_row[2], 'Confirmed')
        conn.close()

    def test_overselling_protection(self):
        """Attempting to checkout more units than available stock must be rejected atomically."""
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT quantity FROM products WHERE id = 4")
        current_stock = cursor.fetchone()[0]
        conn.close()

        payload = {
            'items': [{'id': 4, 'quantity': current_stock + 5}],
            'customer': {
                'name': 'Test Buyer',
                'email': 'buyer@example.com',
                'phone': '9876543210',
                'address': '123 Market Road',
                'city': 'Bengaluru',
                'pincode': '560001'
            }
        }

        res = self.client.post('/api/cart/checkout', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertTrue('available' in data.get('error', '').lower() or 'insufficient' in data.get('error', '').lower())

        # Verify stock was untouched
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT quantity FROM products WHERE id = 4")
        stock_after = cursor.fetchone()[0]
        self.assertEqual(stock_after, current_stock)
        conn.close()

    def test_missing_delivery_info_rejected(self):
        """Checkout without required shipping details must fail with 400 validation error."""
        payload = {
            'items': [{'id': 1, 'quantity': 1}],
            'customer': {
                'name': '', # Missing name
                'email': 'invalid-email',
                'address': ''
            }
        }
        res = self.client.post('/api/cart/checkout', json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn('error', data)

    def test_empty_cart_checkout_rejected(self):
        """Checkout with an empty items array must be rejected."""
        payload = {
            'items': [],
            'customer': {
                'name': 'Test',
                'email': 'test@example.com',
                'phone': '9876543210',
                'address': '123 Road',
                'city': 'Delhi',
                'pincode': '110001'
            }
        }
        res = self.client.post('/api/cart/checkout', json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn('empty', res.get_json().get('error', '').lower())
