"""
EasyCart Database Connection Provider.
Provides unified database connections with dict-like row access for both
PostgreSQL (Supabase production) and SQLite (development / testing).
"""
import os
import re
import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger('easycart.database')

# Optional PostgreSQL Driver
try:
    import psycopg
    from psycopg.rows import dict_row
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'Backend')
SQLITE_DB_FILE = os.path.join(BACKEND_DIR, 'easycart.db')

class DictWithIndex(dict):
    """Dictionary supporting integer column indexing for SQL compatibility."""
    def __getitem__(self, item):
        if isinstance(item, int):
            return list(self.values())[item]
        return super().__getitem__(item)

class SQLiteCursorWrapper:
    """Wraps SQLite cursor to translate PostgreSQL-style %s placeholders and yield DictWithIndex."""
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        sqlite_query = re.sub(r'%s', '?', query)
        if params is None:
            return self._cursor.execute(sqlite_query)
        return self._cursor.execute(sqlite_query, params)

    def fetchone(self):
        row = self._cursor.fetchone()
        return DictWithIndex(dict(row)) if row is not None else None

    def fetchall(self):
        return [DictWithIndex(dict(r)) for r in self._cursor.fetchall()]

    def __getattr__(self, name):
        return getattr(self._cursor, name)

class SQLiteConnWrapper:
    """Wraps SQLite connection to provide standard cursor, commit, rollback, close methods."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return SQLiteCursorWrapper(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

def get_db(custom_url=None):
    """Return an active database connection with dictionary-like row access.
    
    If DATABASE_URL is set (e.g. on Render with Supabase PostgreSQL),
    connects via psycopg with dict_row. If unset, connects to local SQLite in development.
    In production mode, silent fallback to SQLite is strictly prohibited.
    """
    db_url = custom_url or os.environ.get('DATABASE_URL')
    is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('APP_ENV') == 'production'

    if db_url and (db_url.startswith('postgres://') or db_url.startswith('postgresql://')) and HAS_PSYCOPG:
        if 'sslmode' not in db_url:
            separator = '&' if '?' in db_url else '?'
            db_url += f'{separator}sslmode=require'
        return psycopg.connect(db_url, row_factory=dict_row)
    elif is_prod and not custom_url:
        logger.critical("FATAL: DATABASE_URL is missing or invalid in production mode.")
        raise RuntimeError(
            "FATAL DATABASE ERROR: Production mode requires a valid PostgreSQL DATABASE_URL (Supabase). "
            "Silent fallback to SQLite is strictly disabled in production to protect data persistence."
        )
    else:
        sqlite_file = custom_url if (custom_url and not str(custom_url).startswith('postgres')) else os.environ.get('SQLITE_DB_PATH', SQLITE_DB_FILE)
        conn = sqlite3.connect(sqlite_file)
        conn.row_factory = sqlite3.Row
        return SQLiteConnWrapper(conn)

@contextmanager
def transaction(custom_url=None):
    """Context manager for atomic database transactions with auto-commit and rollback."""
    conn = get_db(custom_url)
    cursor = conn.cursor()
    try:
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
