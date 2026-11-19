"""
EasyCart Test Base & Fixtures.
Provides isolated test database configuration, test clients, and helper utilities.
Compatible with both pytest and python -m unittest.
"""
import os
import sys
import unittest
import tempfile
import sqlite3

# Ensure project root and Backend directory are in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'Backend')
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from Backend import create_app
from Backend.config import TestingConfig
from Backend.database.connection import get_db
from Backend.database.models import init_db
from Backend.database.seed import SEED_PRODUCTS, COUPONS

class BaseTestCase(unittest.TestCase):
    """Base test case providing an isolated temporary SQLite database and test client."""

    @classmethod
    def setUpClass(cls):
        # Save original environment state
        cls.orig_db_url = os.environ.get('DATABASE_URL')
        cls.orig_sqlite_path = os.environ.get('SQLITE_DB_PATH')
        cls.orig_secret_key = os.environ.get('SECRET_KEY')
        cls.orig_testing = os.environ.get('TESTING')
        cls.orig_flask_env = os.environ.get('FLASK_ENV')
        cls.orig_google_client_id = os.environ.get('GOOGLE_CLIENT_ID')

        # Create a temporary file for the isolated test database
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix='.db')
        os.close(cls.db_fd)

        # Set environment overrides
        os.environ['DATABASE_URL'] = ''
        os.environ['SQLITE_DB_PATH'] = cls.db_path
        os.environ['SECRET_KEY'] = 'test-secret-key-32-chars-long-1234'
        os.environ['TESTING'] = 'True'
        os.environ['FLASK_ENV'] = 'testing'
        os.environ['GOOGLE_CLIENT_ID'] = '334860227356-tmgcjjar1p1bf8g14nllr2qolldu60gr.apps.googleusercontent.com'

        # Initialize test app
        cls.app = create_app(TestingConfig)
        cls.app.config['SQLITE_DB_PATH'] = cls.db_path

        # Initialize schema and seed data
        with cls.app.app_context():
            init_db(cls.db_path)
            conn = get_db(cls.db_path)
            cursor = conn.cursor()

            # Seed test categories if not present
            cursor.execute("SELECT COUNT(*) FROM categories")
            if cursor.fetchone()[0] == 0:
                for cat in ["Electronics", "Fashion", "Home & Kitchen", "Beauty & Care", "Sports & Fitness", "Books & Stationery", "Grocery", "Toys & Accessories"]:
                    cursor.execute("INSERT OR IGNORE INTO categories (name, slug) VALUES (%s, %s)", (cat, cat.lower().replace(' ', '-')))

            # Seed products
            cursor.execute("SELECT COUNT(*) FROM products")
            if cursor.fetchone()[0] == 0:
                for p in SEED_PRODUCTS:
                    cursor.execute("""
                        INSERT OR IGNORE INTO products (id, name, category, price, original_price, quantity, rating, rating_count, image, description, is_active)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                    """, (p['id'], p['name'], p['category'], p['price'], p.get('original_price'), p.get('quantity', 20), p.get('rating', 4.5), p.get('rating_count', 10), p.get('image', ''), p.get('description', '')))

            # Seed authorized administrator
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'suvrokayal2005@gmail.com'")
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO users (id, name, email, password_hash, role, status, auth_provider)
                    VALUES (4, 'Suvro Kayal', 'suvrokayal2005@gmail.com', 'scrypt:32768:8:1$test$fakehash', 'admin', 'active', 'google')
                """)

            # Seed coupons
            cursor.execute("SELECT COUNT(*) FROM coupons")
            if cursor.fetchone()[0] == 0:
                for code, c in COUPONS.items():
                    cursor.execute("""
                        INSERT OR IGNORE INTO coupons (code, type, value, min_order, max_discount, description, is_active)
                        VALUES (%s, %s, %s, %s, %s, %s, 1)
                    """, (code, c['type'], c['value'], c.get('min_order', 0), c.get('max_discount'), c.get('description', '')))

            conn.commit()
            conn.close()

    @classmethod
    def tearDownClass(cls):
        # Remove temporary database file
        if os.path.exists(cls.db_path):
            try:
                os.remove(cls.db_path)
            except OSError:
                pass

        # Restore original environment
        for key, val in [
            ('DATABASE_URL', cls.orig_db_url),
            ('SQLITE_DB_PATH', cls.orig_sqlite_path),
            ('SECRET_KEY', cls.orig_secret_key),
            ('TESTING', cls.orig_testing),
            ('FLASK_ENV', cls.orig_flask_env),
            ('GOOGLE_CLIENT_ID', cls.orig_google_client_id),
        ]:
            if val is not None:
                os.environ[key] = val
            else:
                os.environ.pop(key, None)

    def setUp(self):
        self.client = self.app.test_client()
        # Set standard CSRF header on client
        self.client.environ_base['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest'

    def get_db_cursor(self):
        """Helper to get a database connection and cursor for tests."""
        conn = get_db(self.db_path)
        return conn, conn.cursor()
