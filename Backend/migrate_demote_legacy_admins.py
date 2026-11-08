import os
import sys
import sqlite3

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db')

def migrate():
    print(f"Opening database: {SQLITE_PATH}")
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Inspect existing admin users
    cursor.execute("SELECT id, name, email, role, status, auth_provider FROM users WHERE role = 'admin'")
    current_admins = cursor.fetchall()
    print("Admins before migration:")
    for a in current_admins:
        print(f"  ID: {a['id']}, Name: {a['name']}, Email: {a['email']}, Role: {a['role']}, Provider: {a['auth_provider']}")

    # 2. Demote legacy demo accounts (shraddha.singh@gmail.com, suvro@gmail.com)
    # while preserving their account records, user IDs, and order histories
    cursor.execute("""
        UPDATE users
        SET role = 'customer'
        WHERE email IN ('shraddha.singh@gmail.com', 'suvro@gmail.com')
    """)
    demoted_count = cursor.rowcount
    print(f"Demoted {demoted_count} legacy admin account(s) to 'customer'.")

    # 3. Ensure both authorized Google administrators exist and have role='admin'
    authorized_google_admins = [
        ('Suvro Kayal', 'suvrokayal2005@gmail.com'),
        ('Shraddha Singh', 'shraddha66singh66@gmail.com')
    ]
    for name, email in authorized_google_admins:
        cursor.execute("SELECT id, role, status FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?", (row['id'],))
            print(f"Verified authorized admin {email} (ID: {row['id']}) as active admin.")
        else:
            import secrets
            dummy_hash = f"google_oauth:{secrets.token_hex(16)}"
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, status, auth_provider)
                VALUES (?, ?, ?, 'admin', 'active', 'google')
            """, (name, email, dummy_hash))
            print(f"Created authorized admin record for {email}.")

    conn.commit()

    # 4. Verify final admins
    cursor.execute("SELECT id, name, email, role, status, auth_provider FROM users WHERE role = 'admin'")
    final_admins = cursor.fetchall()
    print("\nAdmins after migration (Strict Two-Account Allowlist):")
    for a in final_admins:
        print(f"  ID: {a['id']}, Name: {a['name']}, Email: {a['email']}, Role: {a['role']}, Provider: {a['auth_provider']}")

    conn.close()
    print("Migration completed successfully.")

if __name__ == '__main__':
    migrate()

