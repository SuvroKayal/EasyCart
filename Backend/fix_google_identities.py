import os
import sys
import shutil
import sqlite3

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db')
BACKUP_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db.pre_google_fix.backup')

def fix_google_identities():
    print("=" * 60)
    print("EASYCART GOOGLE IDENTITY CORRECTION")
    print("=" * 60)

    # 1. Create a safety backup
    shutil.copyfile(DB_PATH, BACKUP_PATH)
    print(f"Safety backup created at: {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 2. Inspect current administrator records
    admin_emails = ['suvrokayal2005@gmail.com', 'shraddha66singh66@gmail.com']
    print("\n--- Current Administrator Records Before Correction ---")
    cursor.execute("SELECT id, name, email, role, status, auth_provider, google_id FROM users")
    all_users = cursor.fetchall()
    
    admins_before = [u for u in all_users if u['email'] in admin_emails]
    for a in admins_before:
        is_test_placeholder = bool(a['google_id'] and a['google_id'].startswith('google-oauth2-'))
        print(f"  ID: {a['id']}, Name: {a['name']}, Email: {a['email']}")
        print(f"    Role: {a['role']}, Status: {a['status']}, Provider: {a['auth_provider']}")
        print(f"    Current google_id: '{a['google_id']}' (Is Test Placeholder: {is_test_placeholder})")

    # Also check other accounts with test placeholders
    test_placeholders = [u for u in all_users if u['google_id'] and u['google_id'].startswith('google-oauth2-')]
    print(f"\nTotal accounts with test placeholders: {len(test_placeholders)}")
    for tp in test_placeholders:
        print(f"  ID {tp['id']} ({tp['email']}): '{tp['google_id']}'")

    # 3. Safely reset test placeholders to NULL for the two authorized administrators
    print("\n--- Resetting Test Identifiers for Authorized Administrators ---")
    cursor.execute("""
        UPDATE users
        SET google_id = NULL
        WHERE email IN ('suvrokayal2005@gmail.com', 'shraddha66singh66@gmail.com')
          AND (google_id LIKE 'google-oauth2-%' OR google_id IS NOT NULL)
    """)
    updated_admins = cursor.rowcount
    print(f"Reset google_id to NULL for {updated_admins} administrator account(s).")

    # Also clean test placeholders from test customer accounts
    cursor.execute("""
        UPDATE users
        SET google_id = NULL
        WHERE google_id LIKE 'google-oauth2-%'
    """)
    updated_others = cursor.rowcount
    print(f"Reset test google_id to NULL for {updated_others} other test account(s).")

    conn.commit()

    # 4. Verification After Correction
    print("\n--- Administrator Records After Correction ---")
    cursor.execute("SELECT id, name, email, role, status, auth_provider, google_id FROM users")
    all_users_after = cursor.fetchall()
    admins_after = [u for u in all_users_after if u['email'] in admin_emails]

    for a in admins_after:
        print(f"  ID: {a['id']}, Name: {a['name']}, Email: {a['email']}")
        print(f"    Role: {a['role']}, Status: {a['status']}, Provider: {a['auth_provider']}")
        print(f"    Corrected google_id: {a['google_id']} (Expected: None)")
        assert a['google_id'] is None, f"Expected google_id to be None, got {a['google_id']}"
        assert a['role'] == 'admin', f"Expected role to be 'admin', got {a['role']}"
        assert a['status'] == 'active', f"Expected status to be 'active', got {a['status']}"

    # Verify no test placeholders remain in the database
    cursor.execute("SELECT id, email, google_id FROM users WHERE google_id LIKE 'google-oauth2-%'")
    remaining_placeholders = cursor.fetchall()
    print(f"\nRemaining test placeholders in database: {len(remaining_placeholders)} (Expected: 0)")
    assert len(remaining_placeholders) == 0, "Test placeholders still remain!"

    # Verify total users, products, orders are unchanged
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM products")
    total_products = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM orders")
    total_orders = cursor.fetchone()[0]

    print(f"\nPreserved Data:")
    print(f"  Total users: {total_users}")
    print(f"  Total products: {total_products}")
    print(f"  Total orders: {total_orders}")

    conn.close()
    print("\n" + "=" * 60)
    print("GOOGLE IDENTITY CORRECTION COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == '__main__':
    fix_google_identities()

