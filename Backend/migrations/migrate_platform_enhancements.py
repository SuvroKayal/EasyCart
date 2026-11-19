import sqlite3
import json
import re

SQLITE_DB = 'Backend/easycart.db'

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')

def run_migration():
    conn = sqlite3.connect(SQLITE_DB)
    cur = conn.cursor()
    print("Running platform enhancements migration...")

    # 1. Create categories table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            parent_id INTEGER,
            description TEXT,
            image_url TEXT,
            display_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    ''')

    # 2. Create suppliers table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            supplied_categories TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 3. Add columns to products safely
    cur.execute("PRAGMA table_info(products)")
    existing_cols = [c[1] for c in cur.fetchall()]

    new_product_cols = [
        ('category_id', 'INTEGER REFERENCES categories(id)'),
        ('subcategory_id', 'INTEGER REFERENCES categories(id)'),
        ('nested_category_id', 'INTEGER REFERENCES categories(id)'),
        ('sku', 'TEXT'),
        ('supplier_id', 'INTEGER REFERENCES suppliers(id)'),
        ('gallery_images', 'TEXT')
    ]

    for col_name, col_type in new_product_cols:
        if col_name not in existing_cols:
            print(f"Adding column '{col_name}' to products...")
            cur.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")

    conn.commit()

    # 4. Seed initial categories hierarchy
    CATEGORY_HIERARCHY = [
        {
            "name": "Electronics",
            "image": "/banner/Electronics.png",
            "desc": "Precision acoustics, minimalist setups & flagship mobile technology.",
            "children": [
                {
                    "name": "Smartphones",
                    "desc": "Flagship devices, 5G performance and precision optics.",
                    "children": [
                        {"name": "Android Phones", "desc": "Leading Android flagships with Dynamic displays."},
                        {"name": "iPhones", "desc": "iOS devices with A-series silicon and Super Retina screens."},
                        {"name": "Budget Smartphones", "desc": "High utility daily drivers with long battery life."}
                    ]
                },
                {
                    "name": "Laptops",
                    "desc": "High performance workstations and ultrabooks.",
                    "children": [
                        {"name": "Gaming Laptops", "desc": "High-refresh displays and dedicated RTX graphics."},
                        {"name": "Business Laptops", "desc": "All-day endurance, security chips and lightweight chassis."},
                        {"name": "Student Laptops", "desc": "Essential computing for academics and creation."}
                    ]
                },
                {"name": "Tablets", "desc": "Touch displays for stylus sketching and entertainment."},
                {"name": "Headphones", "desc": "Active noise cancelling, planar drivers and wireless freedom."},
                {"name": "Smartwatches", "desc": "Biometric tracking, AMOLED displays and notifications."},
                {"name": "Cameras", "desc": "Mirrorless sensors and prime glass for creators."},
                {"name": "Gadgets", "desc": "Multiport hubs, GaN chargers and desk accessories."}
            ]
        },
        {
            "name": "Fashion",
            "image": "/banner/Fashion.png",
            "desc": "Tailored Oxford weave, organic heavyweight cotton & timeless eyewear.",
            "children": [
                {
                    "name": "Men's Clothing",
                    "desc": "Tailored shirts, casual tees and smart trousers.",
                    "children": [
                        {"name": "Shirts", "desc": "Oxford cotton and breathable linen formal and casual shirts."},
                        {"name": "T-Shirts", "desc": "240 GSM heavyweight combed organic cotton tees."},
                        {"name": "Trousers", "desc": "Chinos, slim stretch trousers and classic denim."}
                    ]
                },
                {"name": "Women's Clothing", "desc": "Contemporary dresses, elegant tops and knitwear."},
                {"name": "Footwear", "desc": "Leather formal shoes, clean sneakers and casual loafers."},
                {"name": "Watches", "desc": "Minimalist analog timepieces and chronograph movements."},
                {"name": "Bags & Accessories", "desc": "Genuine leather wallets, canvas backpacks and polarized shades."}
            ]
        },
        {
            "name": "Home & Kitchen",
            "image": "/banner/Home-Kitchen.png",
            "desc": "Cast iron cookware, borosilicate glassware & handcrafted ceramics.",
            "children": [
                {"name": "Kitchen Appliances", "desc": "Silent mixers, cold-press juicers and induction cooktops."},
                {"name": "Furniture", "desc": "Ergonomic desk chairs, solid wood tables and minimalist shelving."},
                {"name": "Home Decor", "desc": "Textured ceramic vases, linen throw cushions and ambient lighting."},
                {"name": "Cookware", "desc": "Pre-seasoned Dutch ovens, tri-ply stainless steel and skillet pans."},
                {"name": "Storage", "desc": "Airtight borosilicate jars, modular pantry organizers."},
                {"name": "Lighting", "desc": "Warm LED desk lamps, sculptural pendants and dimmable sconces."}
            ]
        },
        {
            "name": "Beauty & Personal Care",
            "image": "/banner/Beauty.png",
            "desc": "Botanical extracts, active antioxidant serums & sonic dental care.",
            "children": [
                {"name": "Skincare", "desc": "Pure Vitamin C serums, ceramide moisturizers and broad spectrum sunscreens."},
                {"name": "Haircare", "desc": "Argan conditioning masks, biotin shampoos and scalp treatment oils."},
                {"name": "Makeup", "desc": "Weightless mineral foundations, velvet lip stains and precision liners."},
                {"name": "Fragrances", "desc": "Artisanal eau de parfum, amber woods and clean citrus notes."},
                {"name": "Grooming", "desc": "Sonic electric toothbrushes, precision titanium trimmers and safety razors."}
            ]
        },
        {
            "name": "Books & Stationery",
            "image": "/banner/Books.png",
            "desc": "Archival dot notebooks, brass writing instruments & curated literature.",
            "children": [
                {"name": "Academic Books", "desc": "Core engineering, economics, sciences and reference texts."},
                {"name": "Fiction", "desc": "Literary novels, historical fiction and contemporary prose."},
                {"name": "Non-fiction", "desc": "Biographies, philosophy, business design and history."},
                {"name": "Notebooks", "desc": "120 GSM fountain-pen friendly dot grid and ruled journals."},
                {"name": "Office Supplies", "desc": "Brass desk rulers, archival gel pens and metallic paper clips."}
            ]
        },
        {
            "name": "Sports & Fitness",
            "image": "/banner/Fitness.png",
            "desc": "High-density yoga mats, precision dumbbells & insulated thermal flasks.",
            "children": [
                {"name": "Fitness Equipment", "desc": "Hex rubber dumbbells, resistance loop bands and ab wheels."},
                {"name": "Sportswear", "desc": "Moisture-wicking training tees, compression shorts and socks."},
                {"name": "Outdoor Gear", "desc": "Lightweight trekking poles, daypacks and hydration bladders."},
                {"name": "Yoga", "desc": "6mm alignment eco TPE mats, cork blocks and stretching straps."},
                {"name": "Accessories", "desc": "Double-wall vacuum flasks, gym duffels and wrist wraps."}
            ]
        },
        {
            "name": "Toys & Accessories",
            "image": "/banner/Toys.png",
            "desc": "STEM engineering kits, carbon stunt drones & speed competition cubes.",
            "children": [
                {"name": "Educational Toys", "desc": "Robotics kits, magnetic building tiles and circuit experiments."},
                {"name": "Soft Toys", "desc": "Hypoallergenic plush companions and organic cotton dolls."},
                {"name": "Games & Puzzles", "desc": "Strategy board games, 1000-piece wooden jigsaw puzzles."},
                {"name": "Baby Care", "desc": "BPA-free feeding bottles, organic cotton bibs and teethers."}
            ]
        },
        {
            "name": "Grocery",
            "image": "/banner/Grocery.png",
            "desc": "Single-origin roast beans, cold-pressed oils & artisanal pantry provisions.",
            "children": [
                {"name": "Snacks", "desc": "Roasted almonds, organic trail mix and artisanal dark chocolate."},
                {"name": "Beverages", "desc": "Single-origin Arabica beans, ceremonial matcha and herbal infusions."},
                {"name": "Packaged Foods", "desc": "Whole grain sourdough pasta, organic rolled oats and wild honey."},
                {"name": "Household Essentials", "desc": "Plant-based eco laundry detergents and compostable bags."},
                {"name": "Personal Hygiene", "desc": "Handcrafted botanical soaps and gentle aloe washes."}
            ]
        }
    ]

    def insert_category(name, desc=None, image=None, parent_id=None, order=0):
        slug = slugify(name)
        # Check if already exists
        cur.execute("SELECT id FROM categories WHERE slug = ? OR (name = ? AND parent_id IS ?)", (slug, name, parent_id))
        row = cur.fetchone()
        if row:
            cat_id = row[0]
            cur.execute("""
                UPDATE categories
                SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), display_order = ?
                WHERE id = ?
            """, (name, desc, image, order, cat_id))
            return cat_id
        else:
            cur.execute("""
                INSERT INTO categories (name, slug, parent_id, description, image_url, display_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (name, slug, parent_id, desc, image, order))
            return cur.lastrowid

    for top_idx, top_cat in enumerate(CATEGORY_HIERARCHY):
        top_id = insert_category(top_cat["name"], top_cat.get("desc"), top_cat.get("image"), None, top_idx)
        for sub_idx, sub_cat in enumerate(top_cat.get("children", [])):
            sub_id = insert_category(sub_cat["name"], sub_cat.get("desc"), None, top_id, sub_idx)
            for nest_idx, nest_cat in enumerate(sub_cat.get("children", [])):
                insert_category(nest_cat["name"], nest_cat.get("desc"), None, sub_id, nest_idx)

    conn.commit()
    print("Categories seeded successfully.")

    # 5. Seed initial suppliers
    cur.execute("SELECT COUNT(*) FROM suppliers")
    if cur.fetchone()[0] == 0:
        suppliers = [
            (
                "Apex Electronics Supply Co.",
                "Rajesh Verma",
                "+91 98301 22345",
                "rajesh@apexelectronics.in",
                "Plot 42, Salt Lake Sector V, Kolkata, West Bengal 700091",
                json.dumps(["Electronics"]),
                "active",
                "Primary supplier for audio equipment, hubs, and peripherals. Fast 48h dispatch SLA."
            ),
            (
                "Heritage Textiles & Weaves",
                "Ananya Sharma",
                "+91 98205 66789",
                "orders@heritagetextiles.co.in",
                "Building 12, Lower Parel, Mumbai, Maharashtra 400013",
                json.dumps(["Fashion"]),
                "active",
                "Certified organic cotton apparel and artisanal fabrics."
            ),
            (
                "Greenfield Organic Estates",
                "Vikram Joshi",
                "+91 94480 11223",
                "contact@greenfieldorganic.org",
                "Estate Road, Chikmagalur, Karnataka 577101",
                json.dumps(["Grocery"]),
                "active",
                "Single-origin Arabica coffee beans and cold-pressed certified pantry provisions."
            ),
            (
                "Artisan Kitchenware Foundry",
                "Priya Sen",
                "+91 97110 44556",
                "sales@artisankitchen.in",
                "Industrial Area Phase 2, Okhla, New Delhi 110020",
                json.dumps(["Home & Kitchen"]),
                "active",
                "Heavy-duty cast iron cookware, borosilicate glassware and ceramic supplies."
            ),
            (
                "Stellar Athletic Equipment",
                "Aman Gupta",
                "+91 98199 88776",
                "aman@stellarathletic.com",
                "MIDC Phase 1, Hinjawadi, Pune, Maharashtra 411057",
                json.dumps(["Sports & Fitness"]),
                "active",
                "High density yoga mats, commercial-grade dumbbells and resistance systems."
            )
        ]
        for s in suppliers:
            cur.execute("""
                INSERT INTO suppliers (name, contact_person, phone, email, address, supplied_categories, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, s)
        conn.commit()
        print("Suppliers seeded successfully.")

    # 6. Map existing products to category_id, sku, and supplier_id
    cur.execute("SELECT id, name, category FROM products")
    prods = cur.fetchall()

    for pid, pname, pcat in prods:
        cur.execute("SELECT id FROM categories WHERE name = ? AND parent_id IS NULL", (pcat,))
        cat_row = cur.fetchone()
        cat_id = cat_row[0] if cat_row else None

        # Generate standard SKU: EC-<CAT3>-<PID:04d>
        cat_code = pcat[:3].upper() if pcat else 'GEN'
        sku = f"EC-{cat_code}-{pid:04d}"

        # Assign supplier based on category
        cur.execute("SELECT id FROM suppliers WHERE supplied_categories LIKE ?", (f'%"{pcat}"%',))
        sup_row = cur.fetchone()
        supplier_id = sup_row[0] if sup_row else 1

        cur.execute("""
            UPDATE products
            SET category_id = COALESCE(category_id, ?),
                sku = COALESCE(sku, ?),
                supplier_id = COALESCE(supplier_id, ?)
            WHERE id = ?
        """, (cat_id, sku, supplier_id, pid))

    conn.commit()
    print("Products updated with category_id, SKU, and supplier_id.")

    conn.close()
    print("Migration finished cleanly.")

if __name__ == '__main__':
    run_migration()
