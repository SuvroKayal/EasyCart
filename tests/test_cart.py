"""
EasyCart Cart Calculation & Validation Automated Tests.
Tests server-side authoritative pricing, quantity boundaries, stock enforcement, and item totals.
"""
from tests.base import BaseTestCase

class TestCart(BaseTestCase):

    def test_cart_empty_items(self):
        """Calculating cart with empty items should return 0 totals."""
        res = self.client.post('/api/cart/calculate', json={'items': []})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['subtotal'], 0.0)
        self.assertEqual(data['total'], 0.0)
        self.assertEqual(len(data['items']), 0)

    def test_cart_valid_items_subtotal(self):
        """Valid items should calculate exact prices from database, not client input."""
        # Product 1 price is 1499.0
        payload = {
            'items': [
                {'id': 1, 'quantity': 2, 'price': 1.0} # Client attempts to spoof price=1.0
            ]
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        # Price must be authoritative DB price (1499.0 * 2 = 2998.0)
        self.assertEqual(data['subtotal'], 2998.0)
        self.assertEqual(data['items'][0]['price'], 1499.0)

    def test_cart_quantity_boundaries(self):
        """Invalid quantities (negative, zero, non-integer, excessive) should be rejected or sanitized."""
        # Negative quantity
        res = self.client.post('/api/cart/calculate', json={'items': [{'id': 1, 'quantity': -5}]})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data['items']), 0)
        self.assertTrue(len(data.get('errors', [])) > 0)

        # Zero quantity
        res_zero = self.client.post('/api/cart/calculate', json={'items': [{'id': 1, 'quantity': 0}]})
        self.assertEqual(res_zero.status_code, 200)
        data_zero = res_zero.get_json()
        self.assertEqual(len(data_zero['items']), 0)

        # Excessive quantity above MAX_CART_QUANTITY (e.g., 500)
        res_excess = self.client.post('/api/cart/calculate', json={'items': [{'id': 1, 'quantity': 500}]})
        self.assertEqual(res_excess.status_code, 200)
        data_excess = res_excess.get_json()
        self.assertEqual(len(data_excess['items']), 0)
        self.assertTrue(any('maximum' in err.lower() or 'exceeds' in err.lower() for err in data_excess.get('errors', [])))

    def test_cart_exceeding_stock_rejected(self):
        """Requesting more units than currently in stock should return an error and exclude the item."""
        # Check stock of product 2
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT quantity FROM products WHERE id = 2")
        qty = cursor.fetchone()[0]
        conn.close()

        payload = {
            'items': [{'id': 2, 'quantity': qty + 10}]
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data['items']), 0)
        self.assertTrue(any('available' in err.lower() for err in data.get('errors', [])))

    def test_cart_delivery_fee_threshold(self):
        """Orders under ₹999 incur delivery fee; orders ₹999+ have free delivery."""
        # Product 5: ₹499 (1 unit = ₹499 < ₹999 => standard ₹40 delivery fee)
        res_under = self.client.post('/api/cart/calculate', json={'items': [{'id': 5, 'quantity': 1}]})
        self.assertEqual(res_under.status_code, 200)
        data_under = res_under.get_json()
        self.assertEqual(data_under['delivery_fee'], 40.0)
        self.assertEqual(data_under['total'], 499.0 + 40.0)

        # Product 5: 3 units = ₹1497 >= ₹999 => ₹0 delivery fee
        res_over = self.client.post('/api/cart/calculate', json={'items': [{'id': 5, 'quantity': 3}]})
        self.assertEqual(res_over.status_code, 200)
        data_over = res_over.get_json()
        self.assertEqual(data_over['delivery_fee'], 0.0)
        self.assertEqual(data_over['total'], 1497.0)
