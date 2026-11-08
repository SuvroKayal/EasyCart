import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    print(f"Connecting to database at {DB_PATH}...")

    # 1. Update users table: add role, status, last_login if not present
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [row[1] for row in cursor.fetchall()]

    if 'role' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'")
        print("  Added 'role' column to users table.")

    if 'status' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
        print("  Added 'status' column to users table.")

    if 'last_login' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP")
        print("  Added 'last_login' column to users table.")

    # 2. Update orders table: add payment_status, refund_amount if not present
    cursor.execute("PRAGMA table_info(orders)")
    order_cols = [row[1] for row in cursor.fetchall()]

    if 'payment_status' not in order_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Paid'")
        print("  Added 'payment_status' column to orders table.")

    if 'refund_amount' not in order_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT 0.0")
        print("  Added 'refund_amount' column to orders table.")

    # 3. Create user_login_activity table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_login_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email TEXT NOT NULL,
        event_type TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    print("  Ensured 'user_login_activity' table exists.")

    # 4. Create admin_login_activity table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_login_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email TEXT NOT NULL,
        event_type TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    print("  Ensured 'admin_login_activity' table exists.")

    # 5. Create admin_activity_log table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        admin_email TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id)
    )
    """)
    print("  Ensured 'admin_activity_log' table exists.")

    # 6. Create account_status_history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS account_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        changed_by_admin_id INTEGER NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (changed_by_admin_id) REFERENCES users(id)
    )
    """)
    print("  Ensured 'account_status_history' table exists.")

    # 7. Designate the two authorized administrators:
    # Shraddha Singh (shraddha.singh@gmail.com) and Suvro (suvro@gmail.com, suvrokayal2005@gmail.com)
    admin_emails = ['shraddha.singh@gmail.com', 'suvro@gmail.com', 'suvrokayal2005@gmail.com']
    for email in admin_emails:
        cursor.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))
        print(f"  Assigned admin role to {email} if present.")

    # 8. Seed some realistic initial login activity records for existing users so the audit log has historical context
    cursor.execute("SELECT COUNT(*) FROM user_login_activity")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_logins = [
            (3, 'shraddha.singh@gmail.com', 'admin_login', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', '2026-10-24 05:18:58'),
            (4, 'suvrokayal2005@gmail.com', 'admin_login', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', '2026-10-24 06:24:52'),
            (5, 'suvro@gmail.com', 'admin_login', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', '2026-10-24 06:25:07'),
            (2, 'testuser_1792774056@example.com', 'customer_login', 1, '192.168.1.45', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1', '2026-10-23 16:47:37'),
            (1, 'alex_custom_user@domain.org', 'customer_login', 1, '192.168.1.12', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '2026-10-23 16:46:55'),
            (None, 'unknown_intruder@evil.org', 'failed_login', 0, '45.33.32.156', 'Python-urllib/3.10', '2026-10-28 14:12:00'),
            (None, 'unknown_intruder@evil.org', 'failed_login', 0, '45.33.32.156', 'Python-urllib/3.10', '2026-10-28 14:12:05'),
        ]
        cursor.executemany("""
        INSERT INTO user_login_activity (user_id, email, event_type, success, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, seed_logins)

        # Also seed admin logins
        admin_seed_logins = [
            (3, 'shraddha.singh@gmail.com', 'admin_login', 1, '127.0.0.1', 'Mozilla/5.0 Chrome/120.0', '2026-10-24 05:18:58'),
            (5, 'suvro@gmail.com', 'admin_login', 1, '127.0.0.1', 'Mozilla/5.0 Chrome/120.0', '2026-10-24 06:25:07'),
        ]
        cursor.executemany("""
        INSERT INTO admin_login_activity (user_id, email, event_type, success, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, admin_seed_logins)

        # Seed initial admin activity
        admin_actions = [
            (3, 'shraddha.singh@gmail.com', 'system_init', 'system', '0', 'EasyCart 2.0 Admin Control Center initialized', '127.0.0.1', '2026-10-24 05:19:00'),
            (5, 'suvro@gmail.com', 'inventory_audit', 'products', 'all', 'Verified stock levels for all 25 luxury products', '127.0.0.1', '2026-10-24 06:26:00'),
        ]
        cursor.executemany("""
        INSERT INTO admin_activity_log (admin_id, admin_email, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, admin_actions)
        print("  Seeded historical login and admin activity audit trails.")

    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == '__main__':
    migrate()

