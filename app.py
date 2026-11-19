"""
EasyCart Application Root Entry Point.
Delegates to the modular application factory in Backend.
Compatible with Render (gunicorn app:app), Vercel, and local execution.
"""
import os
import sys

project_root = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(project_root, 'Backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from Backend import create_app

app = create_app()

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
