"""
EasyCart Suppliers Management Blueprint.
Handles administrative supplier records, contacts, and supplied category metrics.
"""
import logging
from flask import Blueprint, request, jsonify, session
from ..database.connection import get_db
from ..common.security import admin_required, log_admin_action

logger = logging.getLogger('easycart.suppliers')

suppliers_bp = Blueprint('suppliers', __name__)

@suppliers_bp.route('/api/admin/suppliers', methods=['GET'])
@admin_required
def api_admin_get_suppliers():
    """List suppliers with product counts and optional status/search filters."""
    search = request.args.get('search', '').strip().lower()
    status = request.args.get('status', '').strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    query = '''
        SELECT s.*, 
               (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count
        FROM suppliers s
        WHERE 1=1
    '''
    params = []
    if search:
        query += ''' AND (LOWER(s.name) LIKE %s 
                          OR LOWER(COALESCE(s.contact_person, '')) LIKE %s 
                          OR LOWER(COALESCE(s.email, '')) LIKE %s 
                          OR LOWER(COALESCE(s.phone, '')) LIKE %s)'''
        term = f"%{search}%"
        params.extend([term, term, term, term])
    if status and status != 'all':
        query += ' AND LOWER(s.status) = %s'
        params.append(status)

    query += ' ORDER BY s.name ASC'
    cursor.execute(query, params)
    suppliers = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'suppliers': suppliers})

@suppliers_bp.route('/api/admin/suppliers/stats', methods=['GET'])
@admin_required
def api_admin_supplier_stats():
    """Return high-level supplier statistics."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM suppliers')
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM suppliers WHERE status = 'active'")
    active = cursor.fetchone()[0]
    inactive = total - active

    cursor.execute('SELECT COUNT(*) FROM products WHERE supplier_id IS NOT NULL')
    supplied_prods = cursor.fetchone()[0]

    cursor.execute('SELECT supplied_categories FROM suppliers WHERE supplied_categories IS NOT NULL')
    cat_rows = cursor.fetchall()
    all_cats = set()
    for row in cat_rows:
        val = row[0] if isinstance(row, tuple) else row.get('supplied_categories')
        if val:
            for c in str(val).split(','):
                c = c.strip()
                if c:
                    all_cats.add(c)

    conn.close()
    return jsonify({
        'total_suppliers': total,
        'active_suppliers': active,
        'inactive_suppliers': inactive,
        'total_products_supplied': supplied_prods,
        'categories_covered': sorted(list(all_cats))
    })

@suppliers_bp.route('/api/admin/suppliers/<int:sup_id>', methods=['GET'])
@admin_required
def api_admin_get_supplier(sup_id):
    """Retrieve detailed supplier profile and supplied catalog products."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    sup = cursor.fetchone()
    if not sup:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    supplier = dict(sup)
    cursor.execute('''
        SELECT id, name, sku, price, quantity, category, image, image_url
        FROM products
        WHERE supplier_id = %s
        ORDER BY name ASC
    ''', (sup_id,))
    products = [dict(r) for r in cursor.fetchall()]
    supplier['products'] = products
    supplier['product_count'] = len(products)
    conn.close()
    return jsonify(supplier)

@suppliers_bp.route('/api/admin/suppliers', methods=['POST'])
@admin_required
def api_admin_create_supplier():
    """Create a new supplier partner record."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Supplier name is required'}), 400

    contact_person = data.get('contact_person', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    address = data.get('address', '').strip()
    supplied_categories = data.get('supplied_categories', '').strip()
    status = data.get('status', 'active').strip() or 'active'
    notes = data.get('notes', '').strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO suppliers (name, contact_person, phone, email, address, supplied_categories, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (name, contact_person, phone, email, address, supplied_categories, status, notes))
    sup_id = cursor.fetchone()['id']
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "create_supplier", "supplier", sup_id,
                     f"Created supplier '{name}' (ID: {sup_id})")

    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return jsonify(created), 201

@suppliers_bp.route('/api/admin/suppliers/<int:sup_id>', methods=['PUT'])
@admin_required
def api_admin_update_supplier(sup_id):
    """Update supplier partner details."""
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    name = data.get('name', existing['name']).strip()
    if not name:
        conn.close()
        return jsonify({'error': 'Supplier name cannot be empty'}), 400

    contact_person = data.get('contact_person', existing['contact_person'])
    phone = data.get('phone', existing['phone'])
    email = data.get('email', existing['email'])
    address = data.get('address', existing['address'])
    supplied_categories = data.get('supplied_categories', existing['supplied_categories'])
    status = data.get('status', existing['status'])
    notes = data.get('notes', existing['notes'])

    cursor.execute('''
        UPDATE suppliers
        SET name = %s, contact_person = %s, phone = %s, email = %s, address = %s, supplied_categories = %s, status = %s, notes = %s
        WHERE id = %s
    ''', (name, contact_person, phone, email, address, supplied_categories, status, notes, sup_id))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "update_supplier", "supplier", sup_id,
                     f"Updated supplier '{name}' (ID: {sup_id})")

    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return jsonify(updated)

@suppliers_bp.route('/api/admin/suppliers/<int:sup_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_supplier(sup_id):
    """Delete supplier partner record."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers WHERE id = %s', (sup_id,))
    sup = cursor.fetchone()
    if not sup:
        conn.close()
        return jsonify({'error': 'Supplier not found'}), 404

    cursor.execute('UPDATE products SET supplier_id = NULL WHERE supplier_id = %s', (sup_id,))
    cursor.execute('DELETE FROM suppliers WHERE id = %s', (sup_id,))
    conn.commit()

    admin_id = session.get('user_id')
    admin_email = session.get('user_email')
    log_admin_action(admin_id, admin_email, "delete_supplier", "supplier", sup_id,
                     f"Deleted supplier '{sup['name']}' (ID: {sup_id})")

    conn.close()
    return jsonify({'success': True, 'message': f"Supplier '{sup['name']}' deleted successfully."})
