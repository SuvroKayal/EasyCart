"""
EasyCart Database Schema & Migrations Module.
Provides idempotent schema creation, migration tracking, indexes, and seed provisioning
for both Supabase PostgreSQL and SQLite.
"""
import os
import json
import logging
from .connection import get_db, HAS_PSYCOPG
from .seed import SEED_PRODUCTS, COUPONS
from ..config import parse_admin_emails

logger = logging.getLogger('easycart.models')

def init_db(custom_url=None):
    """Create all required tables, ensure safe migrations, build indexes, and seed data."""
    db_url = custom_url or os.environ.get('DATABASE_URL')
    is_postgres = bool(db_url and HAS_PSYCOPG)
    conn = get_db(custom_url)
    cursor = conn.cursor()

    # 1. Products Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Electronics',
                price DOUBLE PRECISION NOT NULL,
                original_price DOUBLE PRECISION,
                quantity INTEGER NOT NULL DEFAULT 0,
                rating DOUBLE PRECISION DEFAULT 4.5,
                rating_count INTEGER DEFAULT 50,
                image TEXT,
                image_url TEXT,
                description TEXT,
                category_id INTEGER,
                subcategory_id INTEGER,
                nested_category_id INTEGER,
                sku TEXT,
                supplier_id INTEGER,
                gallery_images TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Electronics',
                price REAL NOT NULL,
                original_price REAL,
                quantity INTEGER NOT NULL DEFAULT 0,
                rating REAL DEFAULT 4.5,
                rating_count INTEGER DEFAULT 50,
                image TEXT,
                image_url TEXT,
                description TEXT,
                category_id INTEGER,
                subcategory_id INTEGER,
                nested_category_id INTEGER,
                sku TEXT,
                supplier_id INTEGER,
                gallery_images TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # Safe migrations for products columns
    for col_name, col_type in [
        ('image_url', 'TEXT'),
        ('category_id', 'INTEGER'),
        ('subcategory_id', 'INTEGER'),
        ('nested_category_id', 'INTEGER'),
        ('sku', 'TEXT'),
        ('supplier_id', 'INTEGER'),
        ('gallery_images', 'TEXT'),
        ('is_active', 'INTEGER DEFAULT 1'),
        ('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    ]:
        try:
            if is_postgres:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'products' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")
            else:
                cursor.execute("PRAGMA table_info(products)")
                existing = [c[1] for c in cursor.fetchall()]
                if col_name not in existing:
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    try:
        cursor.execute("UPDATE products SET is_active = 1 WHERE is_active IS NULL")
    except Exception:
        pass

    # 2. Users Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                status TEXT DEFAULT 'active',
                last_login TIMESTAMP,
                google_id TEXT UNIQUE,
                avatar_url TEXT,
                auth_provider TEXT DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                status TEXT DEFAULT 'active',
                last_login TIMESTAMP,
                google_id TEXT,
                avatar_url TEXT,
                auth_provider TEXT DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    for col_name, col_def in [
        ("role", "TEXT DEFAULT 'customer'"),
        ("status", "TEXT DEFAULT 'active'"),
        ("last_login", "TIMESTAMP"),
        ("google_id", "TEXT"),
        ("avatar_url", "TEXT"),
        ("auth_provider", "TEXT DEFAULT 'local'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        except Exception:
            pass

    # 3. Orders Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                postal_code TEXT NOT NULL,
                subtotal DOUBLE PRECISION NOT NULL,
                discount DOUBLE PRECISION NOT NULL DEFAULT 0,
                delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
                total DOUBLE PRECISION NOT NULL,
                coupon_code TEXT,
                payment_method TEXT NOT NULL,
                payment_status TEXT NOT NULL DEFAULT 'Pending',
                status TEXT NOT NULL DEFAULT 'Confirmed',
                refund_amount DOUBLE PRECISION DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                postal_code TEXT NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL NOT NULL DEFAULT 0,
                delivery_fee REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL,
                coupon_code TEXT,
                payment_method TEXT NOT NULL,
                payment_status TEXT NOT NULL DEFAULT 'Pending',
                status TEXT NOT NULL DEFAULT 'Confirmed',
                refund_amount REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

    # 4. Order Items Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                product_name TEXT NOT NULL,
                unit_price DOUBLE PRECISION NOT NULL,
                quantity INTEGER NOT NULL,
                total_price DOUBLE PRECISION NOT NULL
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                total_price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        ''')

    # 5. Categories Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT,
                image_url TEXT,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                description TEXT,
                image_url TEXT,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # 6. Suppliers Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                supplied_categories TEXT,
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                supplied_categories TEXT,
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # 7. Coupons Table
    if is_postgres:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS coupons (
                id SERIAL PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                value DOUBLE PRECISION NOT NULL,
                min_order DOUBLE PRECISION DEFAULT 0,
                max_discount DOUBLE PRECISION,
                max_uses INTEGER DEFAULT 10000,
                max_uses_per_user INTEGER DEFAULT 1,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                value REAL NOT NULL,
                min_order REAL DEFAULT 0,
                max_discount REAL,
                max_uses INTEGER DEFAULT 10000,
                max_uses_per_user INTEGER DEFAULT 1,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # Coupons table safe migration for used_count
    try:
        if is_postgres:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'coupons' AND column_name = 'used_count'
            """)
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE coupons ADD COLUMN used_count INTEGER DEFAULT 0")
        else:
            cursor.execute("PRAGMA table_info(coupons)")
            existing = [c[1] for c in cursor.fetchall()]
            if 'used_count' not in existing:
                cursor.execute("ALTER TABLE coupons ADD COLUMN used_count INTEGER DEFAULT 0")
    except Exception:
        pass

    # 8. Activity Logs, Audit & History Tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            from_payment_status TEXT,
            to_payment_status TEXT,
            changed_by TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
        )
    ''' if not is_postgres else '''
        CREATE TABLE IF NOT EXISTS order_status_history (
            id SERIAL PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            from_status TEXT,
            to_status TEXT NOT NULL,
            from_payment_status TEXT,
            to_payment_status TEXT,
            changed_by TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS coupon_redemptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coupon_id INTEGER,
            coupon_code TEXT NOT NULL,
            user_id INTEGER,
            customer_email TEXT NOT NULL,
            order_id TEXT NOT NULL,
            discount_amount REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''' if not is_postgres else '''
        CREATE TABLE IF NOT EXISTS coupon_redemptions (
            id SERIAL PRIMARY KEY,
            coupon_id INTEGER,
            coupon_code TEXT NOT NULL,
            user_id INTEGER,
            customer_email TEXT NOT NULL,
            order_id TEXT NOT NULL,
            discount_amount DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_login_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT NOT NULL,
            method TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''' if not is_postgres else '''
        CREATE TABLE IF NOT EXISTS user_login_activity (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            email TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT NOT NULL,
            method TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER,
            admin_email TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''' if not is_postgres else '''
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id SERIAL PRIMARY KEY,
            admin_id INTEGER,
            admin_email TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 9. Important Performance & Reliability Indexes (Phase 3 Requirement)
    indexes = [
        ("idx_users_email", "users", "email"),
        ("idx_users_google_id", "users", "google_id"),
        ("idx_orders_user_id", "orders", "user_id"),
        ("idx_orders_status", "orders", "status"),
        ("idx_orders_created_at", "orders", "created_at"),
        ("idx_order_items_order_id", "order_items", "order_id"),
        ("idx_order_items_product_id", "order_items", "product_id"),
        ("idx_products_category_id", "products", "category_id"),
        ("idx_products_is_active", "products", "is_active"),
        ("idx_products_price", "products", "price"),
        ("idx_categories_slug", "categories", "slug"),
        ("idx_suppliers_status", "suppliers", "status"),
        ("idx_coupons_code", "coupons", "code"),
        ("idx_login_activity_email", "user_login_activity", "email"),
        ("idx_audit_logs_action", "admin_audit_logs", "action"),
        ("idx_order_status_history_order", "order_status_history", "order_id"),
        ("idx_coupon_redemptions_code", "coupon_redemptions", "coupon_code"),
        ("idx_coupon_redemptions_user", "coupon_redemptions", "customer_email"),
    ]
    for idx_name, tbl_name, col_name in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl_name}({col_name})")
        except Exception:
            pass

    conn.commit()

    # 10. Seed Products Provisioning (Idempotent: seed only if products table is empty or missing seeds)
    cursor.execute("SELECT COUNT(*) FROM products")
    prod_count = cursor.fetchone()[0]
    if prod_count == 0:
        for p in SEED_PRODUCTS:
            img_url = p.get('image_url') or p.get('image')
            if is_postgres:
                cursor.execute('''
                    INSERT INTO products (id, name, category, price, original_price, quantity, rating, rating_count, image, image_url, description, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                    ON CONFLICT (id) DO NOTHING
                ''', (
                    p['id'], p['name'], p['category'], p['price'], p['original_price'],
                    p['quantity'], p['rating'], p['rating_count'], p.get('image', img_url), img_url, p['description']
                ))
            else:
                cursor.execute('''
                    INSERT OR IGNORE INTO products (id, name, category, price, original_price, quantity, rating, rating_count, image, image_url, description, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                ''', (
                    p['id'], p['name'], p['category'], p['price'], p['original_price'],
                    p['quantity'], p['rating'], p['rating_count'], p.get('image', img_url), img_url, p['description']
                ))
        conn.commit()

    # 11. Seed Default Coupons (Idempotent)
    for code, c in COUPONS.items():
        try:
            if is_postgres:
                cursor.execute('''
                    INSERT INTO coupons (code, type, value, min_order, max_discount, description, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, 1)
                    ON CONFLICT (code) DO NOTHING
                ''', (c['code'], c['type'], c['value'], c['min_order'], c['max_discount'], c['description']))
            else:
                cursor.execute('''
                    INSERT OR IGNORE INTO coupons (code, type, value, min_order, max_discount, description, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, 1)
                ''', (c['code'], c['type'], c['value'], c['min_order'], c['max_discount'], c['description']))
        except Exception:
            pass
    conn.commit()

    # 12. Controlled Administrator Allowlist Enforcement
    admin_emails = list(parse_admin_emails())
    if admin_emails:
        placeholders = ', '.join(['%s'] * len(admin_emails))
        cursor.execute(f'''
            UPDATE users
            SET role = 'customer'
            WHERE role = 'admin' AND LOWER(email) NOT IN ({placeholders})
        ''', tuple(admin_emails))
        conn.commit()

    conn.close()
    logger.info("Database schema initialized and indexes verified.")
