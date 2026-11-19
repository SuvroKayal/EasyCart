"""
EasyCart Products & Categories Blueprint.
Handles catalog browsing, filtering, search, category hierarchy,
and administrative product management.
"""
import time
import json
import logging
from flask import Blueprint, request, jsonify
from ..database.connection import get_db
from ..common.security import admin_required

logger = logging.getLogger('easycart.products')

products_bp = Blueprint('products', __name__)

DEFAULT_CATEGORIES = [
    "Electronics",
    "Fashion",
    "Home & Kitchen",
    "Grocery",
    "Beauty & Personal Care",
    "Books & Stationery",
    "Sports & Fitness",
    "Toys & Accessories"
]

@products_bp.route('/api/categories', methods=['GET'])
def get_categories():
    """Return list of departments."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM categories WHERE parent_id IS NULL AND is_active = 1 ORDER BY display_order ASC, name ASC")
        rows = cursor.fetchall()
        if rows:
            cats = [r['name'] for r in rows]
            conn.close()
            return jsonify(cats)
    except Exception:
        pass
    conn.close()
    return jsonify(DEFAULT_CATEGORIES)

@products_bp.route('/api/categories/tree', methods=['GET'])
def get_category_tree():
    """Return nested category tree for navigation and filtering."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, name, slug, parent_id, description, image_url, display_order, is_active
            FROM categories
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        ''')
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()

        def build_tree(items, parent_id=None):
            branch = []
            for item in items:
                if item.get('parent_id') == parent_id:
                    node = dict(item)
                    node['children'] = build_tree(items, item['id'])
                    branch.append(node)
            return branch

        tree = build_tree(rows, None)
        return jsonify(tree)
    except Exception as e:
        conn.close()
        logger.warning(f"Falling back to basic categories tree: {e}")
        flat = [{"id": i+1, "name": c, "slug": c.lower().replace(' ', '-'), "parent_id": None, "children": []} for i, c in enumerate(DEFAULT_CATEGORIES)]
        return jsonify(flat)

@products_bp.route('/api/products', methods=['GET'])
def get_products():
    """Retrieve catalog products with comprehensive filtering and sorting."""
    try:
        category = request.args.get('category')
        category_id = request.args.get('category_id', type=int)
        subcategory_id = request.args.get('subcategory_id', type=int)
        supplier_id = request.args.get('supplier_id', type=int)
        search = request.args.get('search', '').strip().lower()
        sort_by = request.args.get('sort', 'default')
        in_stock_only = request.args.get('in_stock', 'false').lower() == 'true'
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

        conn = get_db()
        cursor = conn.cursor()

        query = 'SELECT * FROM products WHERE 1=1'
        params = []

        if not include_inactive:
            query += ' AND COALESCE(is_active, 1) = 1'

        if category_id is not None:
            query += ' AND (category_id = %s OR subcategory_id = %s OR nested_category_id = %s)'
            params.extend([category_id, category_id, category_id])

        if subcategory_id is not None:
            query += ' AND (subcategory_id = %s OR nested_category_id = %s)'
            params.extend([subcategory_id, subcategory_id])

        if supplier_id is not None:
            query += ' AND supplier_id = %s'
            params.append(supplier_id)

        if category and category.lower() != 'all':
            query += ' AND LOWER(category) = LOWER(%s)'
            params.append(category)

        if search:
            query += ' AND (LOWER(name) LIKE %s OR LOWER(description) LIKE %s)'
            params.extend([f'%{search}%', f'%{search}%'])

        if in_stock_only:
            query += ' AND quantity > 0'

        if min_price is not None:
            query += ' AND price >= %s'
            params.append(min_price)

        if max_price is not None:
            query += ' AND price <= %s'
            params.append(max_price)

        if sort_by == 'price_asc':
            query += ' ORDER BY price ASC'
        elif sort_by == 'price_desc':
            query += ' ORDER BY price DESC'
        elif sort_by == 'discount':
            query += ' ORDER BY ((original_price - price) / NULLIF(original_price, 0)) DESC'
        elif sort_by == 'rating':
            query += ' ORDER BY rating DESC'
        elif sort_by == 'name':
            query += ' ORDER BY name ASC'
        else:
            query += ' ORDER BY id ASC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        products = []
        for r in rows:
            p = dict(r)
            if p.get('gallery_images') and isinstance(p['gallery_images'], str):
                try:
                    p['gallery_images'] = json.loads(p['gallery_images'])
                except Exception:
                    p['gallery_images'] = []
            elif not p.get('gallery_images'):
                p['gallery_images'] = []
            products.append(p)
        conn.close()

        return jsonify(products)
    except Exception as e:
        logger.error(f"Error querying products: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve products', 'details': str(e)}), 500

@products_bp.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Retrieve detailed product information and related recommendations."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    product = dict(row)
    if product.get('gallery_images') and isinstance(product['gallery_images'], str):
        try:
            product['gallery_images'] = json.loads(product['gallery_images'])
        except Exception:
            product['gallery_images'] = []
    elif not product.get('gallery_images'):
        product['gallery_images'] = []

    if product.get('supplier_id'):
        try:
            cursor.execute('SELECT name, contact_person, email, phone FROM suppliers WHERE id = %s', (product['supplier_id'],))
            s_row = cursor.fetchone()
            if s_row:
                product['supplier_name'] = s_row['name']
                product['supplier_info'] = dict(s_row)
        except Exception:
            pass

    cursor.execute('''
        SELECT * FROM products
        WHERE category = %s AND id != %s
        LIMIT 4
    ''', (product['category'], product_id))
    related = []
    for r in cursor.fetchall():
        rp = dict(r)
        if rp.get('gallery_images') and isinstance(rp['gallery_images'], str):
            try:
                rp['gallery_images'] = json.loads(rp['gallery_images'])
            except Exception:
                rp['gallery_images'] = []
        related.append(rp)
    conn.close()

    return jsonify({
        'product': product,
        'related': related
    })

@products_bp.route('/api/products', methods=['POST'])
@admin_required
def add_product():
    """Create a new product in the catalog (Admin only)."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    category = data.get('category', 'Electronics')
    quantity = int(data.get('quantity', 0))
    price = float(data.get('price', 0.0))
    original_price = float(data.get('original_price', price * 1.25))
    image_url = data.get('image_url') or data.get('image', '/static/images/p1.svg')
    image = data.get('image', image_url)
    description = data.get('description', 'Authentic product with standard brand warranty.')

    category_id = data.get('category_id')
    subcategory_id = data.get('subcategory_id')
    nested_category_id = data.get('nested_category_id')
    supplier_id = data.get('supplier_id')
    sku = data.get('sku') or f"EC-{category[:3].upper()}-{int(time.time()) % 100000:05d}"
    gallery_images = data.get('gallery_images')
    if isinstance(gallery_images, list):
        gallery_images_str = json.dumps(gallery_images)
    else:
        gallery_images_str = gallery_images if gallery_images else '[]'

    is_active = 1 if data.get('is_active', 1) in (1, True, '1', 'true') else 0

    if not name or price < 0 or quantity < 0:
        return jsonify({'error': 'Invalid product parameters'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (
            name, category, price, original_price, quantity, rating, rating_count,
            image, image_url, description, category_id, subcategory_id,
            nested_category_id, sku, supplier_id, gallery_images, is_active
        )
        VALUES (%s, %s, %s, %s, %s, 4.5, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (
        name, category, price, original_price, quantity,
        image, image_url, description, category_id, subcategory_id,
        nested_category_id, sku, supplier_id, gallery_images_str, is_active
    ))
    new_id = cursor.fetchone()['id']
    conn.commit()

    cursor.execute('SELECT * FROM products WHERE id = %s', (new_id,))
    new_product = dict(cursor.fetchone())
    if new_product.get('gallery_images') and isinstance(new_product['gallery_images'], str):
        try:
            new_product['gallery_images'] = json.loads(new_product['gallery_images'])
        except Exception:
            new_product['gallery_images'] = []
    conn.close()

    return jsonify(new_product), 201

@products_bp.route('/api/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    """Update an existing catalog product (Admin only)."""
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    name = data.get('name', existing['name'])
    category = data.get('category', existing['category'])
    quantity = int(data.get('quantity', existing['quantity']))
    price = float(data.get('price', existing['price']))
    original_price = float(data.get('original_price', existing['original_price']))
    description = data.get('description', existing['description'])
    image_url = data.get('image_url', existing.get('image_url') or existing.get('image'))
    image = data.get('image', image_url)

    category_id = data.get('category_id', existing.get('category_id'))
    subcategory_id = data.get('subcategory_id', existing.get('subcategory_id'))
    nested_category_id = data.get('nested_category_id', existing.get('nested_category_id'))
    supplier_id = data.get('supplier_id', existing.get('supplier_id'))
    sku = data.get('sku', existing.get('sku'))
    gallery_images = data.get('gallery_images', existing.get('gallery_images'))
    if isinstance(gallery_images, list):
        gallery_images_str = json.dumps(gallery_images)
    else:
        gallery_images_str = gallery_images if gallery_images else '[]'

    is_active = existing.get('is_active', 1)
    if 'is_active' in data:
        is_active = 1 if data['is_active'] in (1, True, '1', 'true') else 0

    cursor.execute('''
        UPDATE products
        SET name = %s, category = %s, quantity = %s, price = %s, original_price = %s,
            description = %s, image = %s, image_url = %s, category_id = %s,
            subcategory_id = %s, nested_category_id = %s, sku = %s,
            supplier_id = %s, gallery_images = %s, is_active = %s
        WHERE id = %s
    ''', (
        name, category, quantity, price, original_price,
        description, image, image_url, category_id,
        subcategory_id, nested_category_id, sku,
        supplier_id, gallery_images_str, is_active, product_id
    ))
    conn.commit()

    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    updated = dict(cursor.fetchone())
    if updated.get('gallery_images') and isinstance(updated['gallery_images'], str):
        try:
            updated['gallery_images'] = json.loads(updated['gallery_images'])
        except Exception:
            updated['gallery_images'] = []
    conn.close()

    return jsonify(updated)

@products_bp.route('/api/products/<int:product_id>/status', methods=['PATCH'])
@admin_required
def toggle_product_status(product_id):
    """Toggle active status or set specific visibility for a product."""
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    current_status = prod.get('is_active')
    if current_status is None:
        current_status = 1
    new_status = 0 if current_status == 1 else 1
    if 'is_active' in data:
        new_status = 1 if data['is_active'] in (1, True, '1', 'true') else 0

    cursor.execute('UPDATE products SET is_active = %s WHERE id = %s', (new_status, product_id))
    conn.commit()
    cursor.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    updated = dict(cursor.fetchone())
    if updated.get('gallery_images') and isinstance(updated['gallery_images'], str):
        try:
            updated['gallery_images'] = json.loads(updated['gallery_images'])
        except Exception:
            updated['gallery_images'] = []
    conn.close()
    return jsonify(updated)

@products_bp.route('/api/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    """Delete a product from the database (Admin only)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM products WHERE id = %s', (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})
