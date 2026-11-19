"""
EasyCart Authentication & Role-Based Authorization Automated Tests.
Tests user registration, duplicate email prevention, password hashing, credential verification, and admin boundaries.
"""
import json
from tests.base import BaseTestCase
from Backend.common.security import is_admin_email

class TestAuth(BaseTestCase):

    def test_customer_registration_and_login(self):
        """New customer registration creates user record with secure hash and allows subsequent login."""
        email = "test.shopper@example.com"
        password = "SecurePassword123!"

        reg_payload = {
            'name': 'Test Shopper',
            'email': email,
            'password': password
        }

        # 1. Register
        reg_res = self.client.post('/api/auth/register', json=reg_payload)
        self.assertEqual(reg_res.status_code, 200)
        reg_data = reg_res.get_json()
        self.assertTrue(reg_data.get('success'))
        self.assertEqual(reg_data['user']['email'], email)
        self.assertEqual(reg_data['user']['role'], 'customer')

        # Verify password is not stored in plaintext
        conn, cursor = self.get_db_cursor()
        cursor.execute("SELECT password_hash FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertNotEqual(row[0], password)
        self.assertTrue(row[0].startswith('pbkdf2:') or row[0].startswith('scrypt:'))
        conn.close()

        # 2. Logout
        self.client.post('/api/auth/logout')

        # 3. Login
        login_res = self.client.post('/api/auth/login', json={'email': email, 'password': password})
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertTrue(login_data.get('success'))
        self.assertEqual(login_data['user']['email'], email)

    def test_duplicate_email_registration_rejected(self):
        """Registering with an email that already exists should return 400 or 409 error."""
        email = "duplicate@example.com"
        self.client.post('/api/auth/register', json={'name': 'User 1', 'email': email, 'password': 'Password123!'})

        res_dup = self.client.post('/api/auth/register', json={'name': 'User 2', 'email': email, 'password': 'Password123!'})
        self.assertIn(res_dup.status_code, (400, 409))
        self.assertIn('already exists', res_dup.get_json().get('error', '').lower())

    def test_short_password_rejected(self):
        """Passwords shorter than 6 characters must be rejected."""
        res = self.client.post('/api/auth/register', json={'name': 'Short Pass', 'email': 'short@example.com', 'password': '123'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('at least 6 characters', res.get_json().get('error', '').lower())

    def test_login_invalid_credentials_rejected(self):
        """Invalid password returns 401 Unauthorized."""
        email = "shopper_wrongpass@example.com"
        self.client.post('/api/auth/register', json={'name': 'User', 'email': email, 'password': 'CorrectPassword123!'})
        self.client.post('/api/auth/logout')

        res = self.client.post('/api/auth/login', json={'email': email, 'password': 'WrongPassword999!'})
        self.assertEqual(res.status_code, 401)
        self.assertIn('invalid', res.get_json().get('error', '').lower())

    def test_customer_blocked_from_admin_overview(self):
        """Customer session accessing /api/admin/overview must receive 403 Forbidden."""
        self.client.post('/api/auth/register', json={'name': 'Regular Customer', 'email': 'customer@example.com', 'password': 'CustomerPass123!'})

        res_admin = self.client.get('/api/admin/overview')
        self.assertEqual(res_admin.status_code, 403)
        self.assertIn('privileges', res_admin.get_json().get('error', '').lower())

    def test_admin_allowlist_security(self):
        """Only emails in the authorized administrator allowlist return True for is_admin_email."""
        self.assertTrue(is_admin_email('suvrokayal2005@gmail.com'))
        self.assertTrue(is_admin_email('shraddha66singh66@gmail.com'))
        self.assertFalse(is_admin_email('attacker@domain.com'))
        self.assertFalse(is_admin_email('suvrokayal2005@fakegmail.com'))

    def test_google_auth_config_endpoint(self):
        """GET /api/auth/config should return the configured client ID and provider list."""
        res = self.client.get('/api/auth/config')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('google_client_id', data)
        self.assertTrue(data.get('google_enabled'))
        self.assertIn('google', data.get('providers', []))

    def test_google_auth_disabled_when_missing_credentials(self):
        """When GOOGLE_CLIENT_ID is unset, Google auth returns 503 error while email/password login remains unaffected."""
        import os
        from Backend.config import Config
        orig_cid = Config.GOOGLE_CLIENT_ID
        orig_env = os.environ.get('GOOGLE_CLIENT_ID')
        try:
            Config.GOOGLE_CLIENT_ID = ""
            os.environ['GOOGLE_CLIENT_ID'] = ""
            # Config endpoint reports disabled
            res = self.client.get('/api/auth/config')
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertFalse(data.get('google_enabled'))
            self.assertEqual(data.get('google_client_id'), "")
            self.assertNotIn('google', data.get('providers', []))

            # Attempting Google sign-in returns clear 503 configuration error
            res_google = self.client.post('/api/auth/google', json={'credential': 'fake_token'})
            self.assertEqual(res_google.status_code, 503)
            self.assertIn('not configured', res_google.get_json().get('error', '').lower())

            # Verify ordinary email/password registration and login still works seamlessly
            email = "normal_user@example.com"
            reg = self.client.post('/api/auth/register', json={'name': 'Normal User', 'email': email, 'password': 'Password123!'})
            self.assertEqual(reg.status_code, 200)
            self.assertTrue(reg.get_json().get('success'))
        finally:
            Config.GOOGLE_CLIENT_ID = orig_cid
            if orig_env is not None:
                os.environ['GOOGLE_CLIENT_ID'] = orig_env
            else:
                os.environ.pop('GOOGLE_CLIENT_ID', None)

    def test_google_login_superadmin_suvro(self):
        """Suvro Kayal Google sign-in receives role='admin' and accesses protected Admin APIs."""
        from unittest.mock import patch
        mock_payload = {
            'sub': 'google-oauth2-suvro-test-sub-1001',
            'email': 'suvrokayal2005@gmail.com',
            'name': 'Suvro Kayal',
            'picture': 'https://lh3.googleusercontent.com/a/suvro-avatar',
            'email_verified': True
        }
        with patch('Backend.auth.routes.verify_google_token', return_value=mock_payload):
            res = self.client.post('/api/auth/google', json={'credential': 'valid_suvro_token'})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get('success'))
            self.assertEqual(data['user']['email'], 'suvrokayal2005@gmail.com')
            self.assertEqual(data['user']['role'], 'admin')

            # Verify Admin Portal API access is granted (200 OK)
            res_admin = self.client.get('/api/admin/overview')
            self.assertEqual(res_admin.status_code, 200)
            self.assertIn('total_customers', res_admin.get_json())

    def test_google_login_superadmin_shraddha(self):
        """Shraddha Singh Google sign-in receives role='admin' and accesses protected Admin APIs."""
        from unittest.mock import patch
        mock_payload = {
            'sub': 'google-oauth2-shraddha-test-sub-1002',
            'email': 'shraddha66singh66@gmail.com',
            'name': 'Shraddha Singh',
            'picture': 'https://lh3.googleusercontent.com/a/shraddha-avatar',
            'email_verified': True
        }
        with patch('Backend.auth.routes.verify_google_token', return_value=mock_payload):
            res = self.client.post('/api/auth/google', json={'credential': 'valid_shraddha_token'})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get('success'))
            self.assertEqual(data['user']['email'], 'shraddha66singh66@gmail.com')
            self.assertEqual(data['user']['role'], 'admin')

            # Verify Admin Portal API access is granted (200 OK)
            res_admin = self.client.get('/api/admin/sales/overview')
            self.assertEqual(res_admin.status_code, 200)

    def test_google_login_unrelated_customer(self):
        """Unrelated Gmail user receives role='customer' and is strictly blocked with 403 on Admin APIs."""
        from unittest.mock import patch
        mock_payload = {
            'sub': 'google-oauth2-customer-test-sub-9999',
            'email': 'random.shopper.2026@gmail.com',
            'name': 'Random Shopper',
            'picture': 'https://lh3.googleusercontent.com/a/customer-avatar',
            'email_verified': True
        }
        with patch('Backend.auth.routes.verify_google_token', return_value=mock_payload):
            res = self.client.post('/api/auth/google', json={'credential': 'valid_customer_token'})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get('success'))
            self.assertEqual(data['user']['email'], 'random.shopper.2026@gmail.com')
            self.assertEqual(data['user']['role'], 'customer')

            # Verify Admin Portal API access is strictly blocked (403 Forbidden)
            res_admin = self.client.get('/api/admin/overview')
            self.assertEqual(res_admin.status_code, 403)
            self.assertIn('privileges', res_admin.get_json().get('error', '').lower())

    def test_google_token_rejections(self):
        """Missing or forged Google tokens are strictly rejected."""
        # 1. Missing credential
        res_empty = self.client.post('/api/auth/google', json={})
        self.assertEqual(res_empty.status_code, 400)

        # 2. Forged / invalid token
        res_forged = self.client.post('/api/auth/google', json={'credential': 'forged_jwt_12345'})
        self.assertEqual(res_forged.status_code, 401)
        self.assertIn('failed', res_forged.get_json().get('error', '').lower())

    def test_verify_google_token_edge_cases(self):
        """Low-level security validation: unverified email or invalid issuer must be rejected."""
        from unittest.mock import patch
        from Backend.common.security import verify_google_token

        # Unverified email
        with patch('google.oauth2.id_token.verify_oauth2_token', return_value={
            'iss': 'https://accounts.google.com',
            'sub': '123',
            'email': 'test@gmail.com',
            'email_verified': False
        }):
            self.assertIsNone(verify_google_token('dummy_token'))

        # Invalid issuer
        with patch('google.oauth2.id_token.verify_oauth2_token', return_value={
            'iss': 'https://fake-issuer.com',
            'sub': '123',
            'email': 'test@gmail.com',
            'email_verified': True
        }):
            self.assertIsNone(verify_google_token('dummy_token'))

    def test_frontend_role_manipulation_prevented(self):
        """Client supplying role='admin' in registration payload is ignored; role is strictly 'customer'."""
        res = self.client.post('/api/auth/register', json={
            'name': 'Hacker',
            'email': 'hacker@example.com',
            'password': 'Password123!',
            'role': 'admin'
        })
        self.assertEqual(res.status_code, 200)
        user = res.get_json().get('user', {})
        self.assertEqual(user.get('role'), 'customer')

        # Even with manipulated DB role, email not in allowlist cannot access admin routes
        res_admin = self.client.get('/api/admin/overview')
        self.assertEqual(res_admin.status_code, 403)
