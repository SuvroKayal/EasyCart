import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'easycart.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    print(f"Connecting to database at {DB_PATH} for Google OAuth migration...")

    # 1. Inspect existing columns in users table
    cursor.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cursor.fetchall()]
    print(f"  Existing users columns: {cols}")

    # Add google_id column if not exists
    if 'google_id' not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN google_id TEXT")
        print("  Added 'google_id' column to users table.")

    # Add avatar_url column if not exists
    if 'avatar_url' not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        print("  Added 'avatar_url' column to users table.")

    # Add auth_provider column if not exists
    if 'auth_provider' not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'")
        print("  Added 'auth_provider' column to users table.")

    # 2. Add unique index on google_id
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL")
    print("  Created unique index idx_users_google_id on users(google_id).")

    # 3. Ensure the two approved administrator accounts exist and have role='admin'
    admin_accounts = [
        ('Suvro Kayal', 'suvrokayal2005@gmail.com'),
        ('Shraddha Singh', 'shraddha66singh66@gmail.com')
    ]

    for name, email in admin_accounts:
        cursor.execute("SELECT id, role, status FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            user_id, current_role, current_status = existing
            if current_role != 'admin' or current_status != 'active':
                cursor.execute("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?", (user_id,))
                print(f"  Updated existing account {email} to role='admin', status='active'.")
            else:
                print(f"  Account {email} is already verified admin (ID: {user_id}).")
        else:
            # Create the initial admin record with a secure disabled placeholder password
            import secrets
            dummy_hash = f"google_oauth:{secrets.token_hex(16)}"
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, status, auth_provider)
                VALUES (?, ?, ?, 'admin', 'active', 'google')
            """, (name, email, dummy_hash))
            print(f"  Initialized pre-approved administrator account: {email} with role='admin'.")

    conn.commit()
    conn.close()
    print("Google OAuth database migration completed successfully!")

if __name__ == '__main__':
    migrate()

