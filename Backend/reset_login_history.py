import os
import sys
import shutil
import sqlite3

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db')
BACKUP_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db.pre_reset.backup')

def reset_login_history():
    print("=" * 60)
    print("EASYCART LOGIN HISTORY & AUTHENTICATION RESET")
    print("=" * 60)

    # 1. Create a safety checkpoint backup
    shutil.copyfile(DB_PATH, BACKUP_PATH)
    print(f"Safety backup created at: {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 2. Count existing records before reset
    tables_to_clear = [
        'user_login_activity',
        'admin_login_activity',
        'admin_activity_log',
        'account_status_history'
    ]

    print("\n--- Records Before Reset ---")
    counts_before = {}
    for table in tables_to_clear:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        counts_before[table] = count
        print(f"  {table}: {count} records")

    cursor.execute("SELECT COUNT(*) FROM users WHERE last_login IS NOT NULL")
    users_with_login = cursor.fetchone()[0]
    print(f"  users with last_login timestamp: {users_with_login}")

    # Check preserved tables before
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users_before = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM products")
    total_products_before = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM orders")
    total_orders_before = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM order_items")
    total_order_items_before = cursor.fetchone()[0]

    print(f"\n--- Preserved Data Check (Before) ---")
    print(f"  Total users: {total_users_before}")
    print(f"  Total products: {total_products_before}")
    print(f"  Total orders: {total_orders_before}")
    print(f"  Total order items: {total_order_items_before}")

    # 3. Perform Deletion
    print("\n--- Deleting Login & Auth History ---")
    for table in tables_to_clear:
        cursor.execute(f"DELETE FROM {table}")
        print(f"  Cleared all records from {table}.")

    # Reset last_login timestamps in users table
    cursor.execute("UPDATE users SET last_login = NULL")
    print(f"  Reset last_login timestamp to NULL across all {total_users_before} users.")

    conn.commit()

    # Optimize database storage
    cursor.execute("VACUUM")
    conn.commit()

    # 4. Verification After Reset
    print("\n--- Records After Reset ---")
    counts_after = {}
    for table in tables_to_clear:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        counts_after[table] = count
        print(f"  {table}: {count} records (Expected: 0)")

    cursor.execute("SELECT COUNT(*) FROM users WHERE last_login IS NOT NULL")
    users_with_login_after = cursor.fetchone()[0]
    print(f"  users with last_login timestamp: {users_with_login_after} (Expected: 0)")

    # 5. Verify Preserved Accounts & Google Mappings
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users_after = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM products")
    total_products_after = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM orders")
    total_orders_after = cursor.fetchone()[0]

    cursor.execute("SELECT id, name, email, role, status, auth_provider, google_id FROM users WHERE role = 'admin'")
    admin_users = cursor.fetchall()

    print(f"\n--- Preserved Data Verification (After) ---")
    print(f"  Total users: {total_users_after} (Unchanged: {total_users_before == total_users_after})")
    print(f"  Total products: {total_products_after} (Unchanged: {total_products_before == total_products_after})")
    print(f"  Total orders: {total_orders_after} (Unchanged: {total_orders_before == total_orders_after})")

    print("\n--- Authorized Superadmin Accounts Verification ---")
    for a in admin_users:
        print(f"  ID: {a['id']}, Name: {a['name']}, Email: {a['email']}, Role: {a['role']}, Status: {a['status']}, Google ID: {a['google_id']}")

    conn.close()

    print("\n" + "=" * 60)
    print("LOGIN HISTORY RESET COMPLETED SUCCESSFULLY")
    print("=" * 60)

    return {
        'counts_before': counts_before,
        'counts_after': counts_after,
        'users_with_login_cleared': users_with_login,
        'total_users': total_users_after,
        'total_products': total_products_after,
        'total_orders': total_orders_after
    }

if __name__ == '__main__':
    reset_login_history()

