"""
EasyCart Promotional Coupon & Voucher Automated Tests.
Tests percentage discounts, flat discounts, caps, minimum spend thresholds, and invalid voucher handling.
"""
from tests.base import BaseTestCase

class TestCoupons(BaseTestCase):

    def test_coupon_welcome10_percentage(self):
        """WELCOME10 gives 10% discount on orders meeting minimum spend."""
        # Product 1: 1 unit = ₹1499.0
        payload = {
            'items': [{'id': 1, 'quantity': 1}],
            'coupon_code': 'WELCOME10'
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNotNone(data['applied_coupon'])
        self.assertEqual(data['applied_coupon']['code'], 'WELCOME10')
        # 10% of 1499.0 = 149.9
        self.assertEqual(data['discount'], 149.9)
        self.assertEqual(data['total'], round(1499.0 - 149.9, 2))

    def test_coupon_welcome10_max_cap(self):
        """WELCOME10 has a maximum discount cap of ₹500."""
        # Large subtotal: 5 units of Product 1 (1499 * 5 = 7495.0)
        # 10% would be 749.5, but cap is 500.0
        payload = {
            'items': [{'id': 1, 'quantity': 5}],
            'coupon_code': 'WELCOME10'
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['discount'], 500.0)
        self.assertEqual(data['total'], 7495.0 - 500.0)

    def test_coupon_save50_flat(self):
        """SAVE50 gives flat ₹50 discount when subtotal >= ₹499."""
        # Product 5: ₹499
        payload = {
            'items': [{'id': 5, 'quantity': 1}],
            'coupon_code': 'SAVE50'
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNotNone(data['applied_coupon'])
        self.assertEqual(data['applied_coupon']['code'], 'SAVE50')
        self.assertEqual(data['discount'], 50.0)

    def test_coupon_minimum_order_rejection(self):
        """Coupons below minimum order requirement should not apply discount."""
        # Minimum order for SAVE50 is ₹499. Try with ₹299 (Product 17: Hardcover Journal, qty 1)
        payload = {
            'items': [{'id': 17, 'quantity': 1}],
            'coupon_code': 'SAVE50'
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNone(data['applied_coupon'])
        self.assertEqual(data['discount'], 0.0)
        self.assertIn('minimum order', data.get('coupon_message', '').lower())

    def test_coupon_invalid_code(self):
        """Unknown coupon code should return a clear rejection message without discounting."""
        payload = {
            'items': [{'id': 1, 'quantity': 1}],
            'coupon_code': 'NONEXISTENT_CODE_999'
        }
        res = self.client.post('/api/cart/calculate', json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNone(data['applied_coupon'])
        self.assertEqual(data['discount'], 0.0)
        self.assertIn('invalid', data.get('coupon_message', '').lower())
