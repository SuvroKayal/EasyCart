"""
EasyCart Application Module.
Provides the primary application instance, database utilities, and CLI entry point.
Refactored into a modular Blueprint architecture.
"""
import os
import sys

# Ensure workspace root and Backend directory are in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.dirname(backend_dir)
for p in (workspace_root, backend_dir):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from Backend import create_app
    from Backend.database import get_db, init_db
    from Backend.config import Config
    from Backend.common.security import verify_google_token as verify_google_id_token
except (ImportError, ValueError):
    try:
        from . import create_app
        from .database import get_db, init_db
        from .config import Config
        from .common.security import verify_google_token as verify_google_id_token
    except (ImportError, ValueError):
        import create_app
        from database import get_db, init_db
        from config import Config
        from common.security import verify_google_token as verify_google_id_token

app = create_app()

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
