import sys
import os
import json
from unittest.mock import patch

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

# Insert Backend to sys.path
os.environ.setdefault('GOOGLE_CLIENT_ID', '334860227356-tmgcjjar1p1bf8g14nllr2qolldu60gr.apps.googleusercontent.com')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))
from app import app, get_db

def run_tests():
    client = app.test_client()
    client.environ_base['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest'
    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}: {details}")

    print("=" * 60)
    print("EASYCART 2.0 FULL FUNCTIONAL REGRESSION TEST SUITE")
    print("=" * 60)

    # 1. Storefront Root / React SPA
    print("\n1. Testing Frontend SPA Serving...")
    res = client.get('/')
    assert_test("GET / returns 200", res.status_code == 200)
    html_text = res.get_data(as_text=True)
    assert_test("HTML contains React root div", '<div id="root">' in html_text)
    assert_test("HTML contains Crystal Luxury title", "EasyCart — Crystal Luxury" in html_text)

    # 2. Categories API
    print("\n2. Testing Categories API...")
    res = client.get('/api/categories')
    assert_test("GET /api/categories returns 200", res.status_code == 200)
    cats = res.get_json()
    assert_test("Returns 8 categories", len(cats) == 8, f"Got {len(cats)}")
    assert_test("Includes Electronics", "Electronics" in cats)
    assert_test("Includes Grocery", "Grocery" in cats)
    assert_test("Includes Toys & Accessories", "Toys & Accessories" in cats)

    # 3. Coupons API
    print("\n3. Testing Coupons API...")
    res = client.get('/api/coupons')
    assert_test("GET /api/coupons returns 200", res.status_code == 200)
    coupons = res.get_json()
    assert_test("Returns 3 coupons", len(coupons) == 3)
    codes = [c['code'] for c in coupons]
    assert_test("Contains WELCOME10, SAVE50, FREESHIP", set(codes) == {'WELCOME10', 'SAVE50', 'FREESHIP'})

    # 4. Products Listing & Filtering API
    print("\n4. Testing Products API...")
    res = client.get('/api/products')
    assert_test("GET /api/products returns 200", res.status_code == 200)
    prods = res.get_json()
    assert_test("Returns all products", len(prods) >= 25, f"Got {len(prods)}")

    # Category filter
    res_elec = client.get('/api/products?category=Electronics')
    elec_prods = res_elec.get_json()
    assert_test("Filter category=Electronics returns 4 products", len(elec_prods) == 4)

    # Search filter
    res_search = client.get('/api/products?search=Galaxy')
    search_prods = res_search.get_json()
    assert_test("Search 'Galaxy' returns Samsung Galaxy", len(search_prods) >= 1 and "Galaxy" in search_prods[0]['name'])

    # Sorting
    res_sort = client.get('/api/products?sort=price_asc')
    sort_prods = res_sort.get_json()
    assert_test("Sort price_asc works", sort_prods[0]['price'] <= sort_prods[-1]['price'])

    # In-stock filter
    res_stock = client.get('/api/products?in_stock=true')
    stock_prods = res_stock.get_json()
    assert_test("in_stock filter works", all(p['quantity'] > 0 for p in stock_prods))

    # 5. Product Detail API
    print("\n5. Testing Product Detail API...")
    res = client.get('/api/products/1')
    assert_test("GET /api/products/1 returns 200", res.status_code == 200)
    data = res.get_json()
    assert_test("Contains 'product' key", 'product' in data)
    assert_test("Contains 'related' items", 'related' in data and len(data['related']) > 0)
    assert_test("Product 1 name matches", data['product']['name'] == 'USB-C Multiport Hub')

    # 6. Cart Calculation & Coupon Validation
    print("\n6. Testing Cart Calculation API...")
    cart_payload = {
        "items": [
            {"id": 1, "quantity": 1},  # Price 1499
            {"id": 5, "quantity": 2}   # Price 499 * 2 = 998, Subtotal = 2497
        ],
        "coupon_code": "WELCOME10"
    }
    res = client.post('/api/cart/calculate', json=cart_payload)
    assert_test("POST /api/cart/calculate returns 200", res.status_code == 200)
    calc = res.get_json()
    expected_subtotal = 1499.0 + (499.0 * 2)
    assert_test("Subtotal is ₹2497.0", calc['subtotal'] == expected_subtotal, f"Got {calc['subtotal']}")
    assert_test("WELCOME10 applied (10% capped at 500)", calc['discount'] == 249.7, f"Got {calc['discount']}")
    assert_test("Free delivery because subtotal >= 999", calc['delivery_fee'] == 0.0)
    assert_test("Total = 2497.0 - 249.7 = 2247.3", round(calc['total'], 1) == 2247.3)

    # 7. Authentication Flow (Login, Check, Logout)
    print("\n7. Testing Authentication Flow...")
    # Use existing user shraddha@gmail.com
    # First test check unauthenticated
    res = client.get('/api/auth/me')
    assert_test("Unauthenticated GET /api/auth/me returns authenticated: False", res.get_json()['authenticated'] is False)

    # Register new test user with unique email
    import time
    test_email = f"crystal_test_{int(time.time())}@domain.com"
    res_reg = client.post('/api/auth/register', json={
        "name": "Crystal Tester",
        "email": test_email,
        "password": "SecurePassword123"
    })
    assert_test("POST /api/auth/register returns 200", res_reg.status_code == 200)
    reg_data = res_reg.get_json()
    assert_test("User object returned", reg_data.get('success') is True and reg_data['user']['email'] == test_email)

    # Verify session is now active
    res_me = client.get('/api/auth/me')
    assert_test("GET /api/auth/me reports authenticated: True", res_me.get_json()['authenticated'] is True)
    assert_test("Session user matches registered user", res_me.get_json()['user']['email'] == test_email)

    # 8. Order Placement & Checkout Validation
    print("\n8. Testing Checkout & Order Placement...")
    # Check current stock of product 5
    p5_initial_stock = client.get('/api/products/5').get_json()['product']['quantity']

    checkout_payload = {
        "items": [{"id": 5, "quantity": 1}],
        "coupon_code": "SAVE50",
        "delivery": {
            "name": "Crystal Tester",
            "email": test_email,
            "phone": "9876543210",
            "address": "42 Diamond Plaza, Suite 900",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postal_code": "400001"
        },
        "payment_method": "Simulated UPI (Demo)"
    }
    res_checkout = client.post('/api/cart/checkout', json=checkout_payload)
    assert_test("POST /api/cart/checkout returns 200", res_checkout.status_code == 200)
    order_res = res_checkout.get_json()
    assert_test("Order placement success: True", order_res.get('success') is True)
    assert_test("Order ID format EC-XXXXXX", order_res.get('order_id', '').startswith('EC-'))
    order_details = order_res.get('order_details', {})
    assert_test("Invoice subtotal is ₹499.0", order_details.get('subtotal') == 499.0)
    assert_test("SAVE50 discount is ₹50.0", order_details.get('discount') == 50.0)

    # Verify inventory was deducted in database
    p5_new_stock = client.get('/api/products/5').get_json()['product']['quantity']
    assert_test("Inventory was deducted by 1 unit", p5_new_stock == p5_initial_stock - 1, f"Initial: {p5_initial_stock}, New: {p5_new_stock}")

    # 9. Order History
    print("\n9. Testing Order History for Authenticated User...")
    res_orders = client.get('/api/auth/orders')
    assert_test("GET /api/auth/orders returns 200", res_orders.status_code == 200)
    user_orders = res_orders.get_json()
    assert_test("User has at least 1 order recorded", len(user_orders) >= 1)
    latest_order = user_orders[0]
    assert_test("Order items array populated", len(latest_order.get('items', [])) == 1)
    assert_test("Order customer name matches", latest_order.get('customer_name') == "Crystal Tester")

    # 10. Static & Banner Assets
    print("\n10. Testing Asset Serving...")
    res_banner = client.get('/banner/Electronics.png')
    assert_test("GET /banner/Electronics.png returns 200", res_banner.status_code == 200)
    res_svg = client.get('/static/images/p1.svg')
    assert_test("GET /static/images/p1.svg returns 200", res_svg.status_code == 200)

    # 11. Logout
    print("\n11. Testing Logout...")
    res_logout = client.post('/api/auth/logout')
    assert_test("POST /api/auth/logout returns 200", res_logout.status_code == 200)
    res_me_after = client.get('/api/auth/me')
    assert_test("Session cleared after logout", res_me_after.get_json()['authenticated'] is False)

    # 12. Security: Unauthorized Admin Access Blocked
    print("\n12. Testing Admin Security & Authorization Boundaries...")
    res_unauth_admin = client.get('/api/admin/overview')
    assert_test("Unauthenticated GET /api/admin/overview returns 401 Unauthorized", res_unauth_admin.status_code in (401, 403))
    res_unauth_customers = client.get('/api/admin/customers')
    assert_test("Unauthenticated GET /api/admin/customers returns 401 Unauthorized", res_unauth_customers.status_code in (401, 403))
    res_unauth_sales = client.get('/api/admin/sales/overview')
    assert_test("Unauthenticated GET /api/admin/sales/overview returns 401 Unauthorized", res_unauth_sales.status_code in (401, 403))

    # Login as non-admin customer
    res_cust_login = client.post('/api/auth/login', json={
        "email": test_email,
        "password": "SecurePassword123"
    })
    assert_test("Login as standard customer returns 200", res_cust_login.status_code == 200)
    res_cust_admin = client.get('/api/admin/overview')
    assert_test("Customer accessing /api/admin/overview returns 403 Forbidden", res_cust_admin.status_code == 403)
    client.post('/api/auth/logout')

    # 13. Admin Authentication & Session
    print("\n13. Testing Admin Authentication & Legacy Demotion...")
    # Test failed admin login attempt to verify security audit logging
    res_fail = client.post('/api/auth/login', json={
        "email": "shraddha.singh@gmail.com",
        "password": "WrongPasswordAttempt"
    })
    assert_test("Failed login attempt returns 401", res_fail.status_code == 401)

    # Legacy demo account login: must be strictly demoted to customer role
    res_legacy_login = client.post('/api/auth/login', json={
        "email": "shraddha.singh@gmail.com",
        "password": "Admin@EasyCart2026"
    })
    assert_test("Legacy demo account login returns 200", res_legacy_login.status_code == 200)
    legacy_user = res_legacy_login.get_json().get('user', {})
    assert_test("Legacy account strictly receives role='customer'", legacy_user.get('role') == 'customer')
    res_legacy_blocked = client.get('/api/admin/overview')
    assert_test("Legacy account cannot access /api/admin/overview (403 Forbidden)", res_legacy_blocked.status_code == 403)
    client.post('/api/auth/logout')

    # Authenticate as authorized superadmin via Google OAuth flow
    # Retrieve current linked sub if any, or default to Suvro's actual OAuth sub
    conn = get_db()
    c_sub = conn.cursor()
    c_sub.execute("SELECT google_id FROM users WHERE email = 'suvrokayal2005@gmail.com'")
    suvro_db_row = c_sub.fetchone()
    conn.close()
    actual_sub = (suvro_db_row['google_id'] if suvro_db_row and suvro_db_row.get('google_id') else '115697831847821389364')

    mock_suvro_auth = {
        "sub": actual_sub,
        "email": "suvrokayal2005@gmail.com",
        "name": "Suvro Kayal",
        "picture": "https://lh3.googleusercontent.com/a/suvro-test-avatar",
        "email_verified": True
    }
    with patch('app.verify_google_id_token', return_value=mock_suvro_auth):
        res_admin_login = client.post('/api/auth/google', json={"credential": "mock_suvro_token"})
    assert_test("Authorized superadmin Google login returns 200", res_admin_login.status_code == 200)
    admin_user = res_admin_login.get_json().get('user', {})
    assert_test("Authorized superadmin receives role='admin'", admin_user.get('role') == 'admin')

    # 14. Admin Executive Overview API
    print("\n14. Testing Admin Overview API...")
    res_overview = client.get('/api/admin/overview')
    assert_test("GET /api/admin/overview returns 200", res_overview.status_code == 200)
    ov = res_overview.get_json()
    assert_test("Overview contains total_customers", 'total_customers' in ov and ov['total_customers'] >= 1)
    assert_test("Overview contains total_orders", 'total_orders' in ov and ov['total_orders'] >= 1)
    assert_test("Overview contains net_revenue", 'net_revenue' in ov and ov['net_revenue'] > 0)
    assert_test("Overview contains low_stock_count", 'low_stock_count' in ov)

    # 15. Customer Account Management & Safeguards
    print("\n15. Testing Customer Management & Safeguards...")
    res_customers = client.get('/api/admin/customers')
    assert_test("GET /api/admin/customers returns 200", res_customers.status_code == 200)
    cust_list = res_customers.get_json().get('customers', [])
    assert_test("Customer list returns registered users", len(cust_list) >= 1)

    # Find the created test user in the list
    test_user_obj = next((c for c in cust_list if c['email'] == test_email), None)
    assert_test("Test user found in customer list", test_user_obj is not None)
    test_user_id = test_user_obj['id'] if test_user_obj else 1

    # Customer detail inspection
    res_detail = client.get(f'/api/admin/customers/{test_user_id}')
    assert_test("GET /api/admin/customers/<id> returns 200", res_detail.status_code == 200)
    detail_data = res_detail.get_json()
    assert_test("Customer detail contains stats and orders", 'stats' in detail_data and 'orders' in detail_data)

    # SAFEGUARD TEST: Attempt to deactivate/delete Superadmin must return 403 Forbidden!
    shraddha_admin_obj = next((c for c in cust_list if c['email'] == 'shraddha66singh66@gmail.com'), None)
    shraddha_id = shraddha_admin_obj['id'] if shraddha_admin_obj else 12
    res_safeguard = client.put(f'/api/admin/customers/{shraddha_id}/status', json={"status": "deleted"})
    assert_test("SAFEGUARD: Deleting authorized admin returns 403 Forbidden", res_safeguard.status_code == 403)
    assert_test("Error message states protected admin", "protected administrator" in res_safeguard.get_json().get('error', '').lower())

    # Soft deactivate the test customer
    res_deact = client.put(f'/api/admin/customers/{test_user_id}/status', json={
        "status": "deactivated",
        "reason": "Test deactivation compliance"
    })
    assert_test("Soft deactivating customer returns 200", res_deact.status_code == 200)

    # Revoke sessions for the customer
    res_revoke = client.post(f'/api/admin/customers/{test_user_id}/revoke-sessions')
    assert_test("Revoke customer sessions returns 200", res_revoke.status_code == 200)

    # Reactivate the customer
    res_react = client.put(f'/api/admin/customers/{test_user_id}/status', json={"status": "active"})
    assert_test("Reactivating customer returns 200", res_react.status_code == 200)

    # 16. Login Activity Monitoring API
    print("\n16. Testing Login Activity Monitoring...")
    res_logins = client.get('/api/admin/activity/logins')
    assert_test("GET /api/admin/activity/logins returns 200", res_logins.status_code == 200)
    login_data = res_logins.get_json()
    assert_test("Contains login events list", 'logins' in login_data and len(login_data['logins']) > 0)
    assert_test("Contains login stats", 'stats' in login_data and login_data['stats']['total_events'] > 0)
    assert_test("Failed login attempt was captured in DB", any(e['success'] == 0 for e in login_data['logins']))

    # Admin activity audit trail
    res_act = client.get('/api/admin/activity/admin')
    assert_test("GET /api/admin/activity/admin returns 200", res_act.status_code == 200)
    act_data = res_act.get_json()
    assert_test("Admin actions recorded in audit log", len(act_data.get('activities', [])) > 0)

    # 17. Complete Sales Management APIs
    print("\n17. Testing Sales Management APIs...")
    res_sales_ov = client.get('/api/admin/sales/overview')
    assert_test("GET /api/admin/sales/overview returns 200", res_sales_ov.status_code == 200)
    sales_ov = res_sales_ov.get_json()
    assert_test("Gross sales calculated from SQLite", 'gross_sales' in sales_ov and sales_ov['gross_sales'] > 0)
    assert_test("Net revenue calculated", 'net_revenue' in sales_ov and sales_ov['net_revenue'] > 0)
    assert_test("Average order value calculated", 'average_order_value' in sales_ov and sales_ov['average_order_value'] > 0)

    res_analytics = client.get('/api/admin/sales/analytics')
    assert_test("GET /api/admin/sales/analytics returns 200", res_analytics.status_code == 200)
    an_data = res_analytics.get_json()
    assert_test("Analytics contains daily_revenue", 'daily_revenue' in an_data)
    assert_test("Analytics contains best_selling", 'best_selling' in an_data)
    assert_test("Analytics contains category_performance", 'category_performance' in an_data)

    res_sales_orders = client.get('/api/admin/sales/orders')
    assert_test("GET /api/admin/sales/orders returns 200", res_sales_orders.status_code == 200)
    sales_orders_list = res_sales_orders.get_json().get('orders', [])
    assert_test("Sales orders returned with line items", len(sales_orders_list) > 0 and 'items' in sales_orders_list[0])

    # Update order fulfillment status
    if sales_orders_list:
        sample_order_id = sales_orders_list[0]['id']
        res_upd_order = client.put(f'/api/admin/orders/{sample_order_id}/status', json={
            "status": "Shipped",
            "payment_status": "Paid"
        })
        assert_test("Updating order status returns 200", res_upd_order.status_code == 200)

    # 18. Sales Data Exports (CSV)
    print("\n18. Testing CSV Exports...")
    for export_type in ['orders', 'sales_report', 'products', 'customers']:
        res_exp = client.get(f'/api/admin/sales/export?type={export_type}')
        assert_test(f"Export CSV ({export_type}) returns 200", res_exp.status_code == 200)
        assert_test(f"Export CSV ({export_type}) returns text/csv header", 'text/csv' in res_exp.headers.get('Content-Type', ''))
        assert_test(f"Export CSV ({export_type}) content length > 0", len(res_exp.get_data()) > 0)

    # 19. Inventory Management & Offers
    print("\n19. Testing Inventory & Offers Admin APIs...")
    res_inv = client.get('/api/admin/inventory')
    assert_test("GET /api/admin/inventory returns 200", res_inv.status_code == 200)
    inv_prods = res_inv.get_json().get('products', [])
    assert_test("Inventory contains all products", len(inv_prods) >= 25)

    # Update inventory level for product 1
    res_inv_upd = client.put('/api/admin/inventory/1', json={"quantity": 30})
    assert_test("PUT /api/admin/inventory/1 returns 200", res_inv_upd.status_code == 200)
    p1_check = client.get('/api/products/1').get_json()['product']
    assert_test("Product 1 quantity updated to 30", p1_check['quantity'] == 30)

    # Offers
    res_offers = client.get('/api/admin/offers')
    assert_test("GET /api/admin/offers returns 200", res_offers.status_code == 200)
    offers_list = res_offers.get_json().get('offers', [])
    assert_test("Offers contains 3 vouchers with usage stats", len(offers_list) == 3 and 'total_uses' in offers_list[0])

    # 20. Google Authentication & Administrator Security
    print("\n20. Testing Google Authentication & Administrator Security...")

    # 20.1 Auth Config
    res_cfg = client.get('/api/auth/config')
    assert_test("GET /api/auth/config returns 200", res_cfg.status_code == 200)
    cfg_json = res_cfg.get_json()
    assert_test("Config contains google_client_id", 'google_client_id' in cfg_json and len(cfg_json['google_client_id']) > 10)
    assert_test("Config contains providers list with google", 'providers' in cfg_json and 'google' in cfg_json['providers'])

    # 20.2 Empty or Invalid Google Sign-in Tokens
    res_empty = client.post('/api/auth/google', json={})
    assert_test("POST /api/auth/google with empty payload returns 400", res_empty.status_code == 400)

    res_bad_token = client.post('/api/auth/google', json={"credential": "invalid_forged_jwt_token_12345"})
    assert_test("POST /api/auth/google with forged token returns 401", res_bad_token.status_code == 401)

    # 20.3 Authorized Admin 1 (Suvro) Google Login
    mock_suvro_payload = {
        "sub": actual_sub,
        "email": "suvrokayal2005@gmail.com",
        "name": "Suvro Kayal",
        "picture": "https://lh3.googleusercontent.com/a/suvro-test-avatar",
        "email_verified": True
    }
    with patch('app.verify_google_id_token', return_value=mock_suvro_payload):
        res_suvro = client.post('/api/auth/google', json={"credential": "valid_mock_token_suvro"})
        assert_test("Google sign-in for suvrokayal2005@gmail.com returns 200", res_suvro.status_code == 200)
        suvro_data = res_suvro.get_json()
        assert_test("suvro user receives role='admin'", suvro_data.get('user', {}).get('role') == 'admin')
        assert_test("suvro user has auth_provider='google'", suvro_data.get('user', {}).get('auth_provider') == 'google')
        assert_test("suvro user has avatar_url", suvro_data.get('user', {}).get('avatar_url') == mock_suvro_payload['picture'])

        # Verify Suvro can access admin routes
        res_suvro_admin = client.get('/api/admin/sales/overview')
        assert_test("Admin Suvro can access /api/admin/sales/overview", res_suvro_admin.status_code == 200)

    # Logout
    client.post('/api/auth/logout')

    # 20.4 Authorized Admin 2 (Shraddha) Google Login
    mock_shraddha_payload = {
        "sub": "google-oauth2-shraddha-test-sub-1002",
        "email": "shraddha66singh66@gmail.com",
        "name": "Shraddha Singh",
        "picture": "https://lh3.googleusercontent.com/a/shraddha-test-avatar",
        "email_verified": True
    }
    with patch('app.verify_google_id_token', return_value=mock_shraddha_payload):
        res_shraddha = client.post('/api/auth/google', json={"credential": "valid_mock_token_shraddha"})
        assert_test("Google sign-in for shraddha66singh66@gmail.com returns 200", res_shraddha.status_code == 200)
        shraddha_data = res_shraddha.get_json()
        assert_test("shraddha user receives role='admin'", shraddha_data.get('user', {}).get('role') == 'admin')
        assert_test("shraddha user has auth_provider='google'", shraddha_data.get('user', {}).get('auth_provider') == 'google')

        # Verify Shraddha can access admin customers
        res_shraddha_admin = client.get('/api/admin/customers')
        assert_test("Admin Shraddha can access /api/admin/customers", res_shraddha_admin.status_code == 200)

        # Verify protected admin account cannot be deactivated or deleted
        suvro_user_id = 4  # Known ID for suvro
        res_del_admin = client.delete(f'/api/admin/customers/{suvro_user_id}')
        assert_test("Admin cannot delete protected co-admin (returns 403)", res_del_admin.status_code == 403)

    # Logout
    client.post('/api/auth/logout')

    # 20.5 Regular Customer Google Sign-in (Strict Role Isolation)
    mock_customer_payload = {
        "sub": "google-oauth2-customer-test-sub-2001",
        "email": "luxuryshopper@gmail.com",
        "name": "Luxury Shopper",
        "picture": "https://lh3.googleusercontent.com/a/customer-avatar",
        "email_verified": True
    }
    with patch('app.verify_google_id_token', return_value=mock_customer_payload):
        res_cust = client.post('/api/auth/google', json={"credential": "valid_mock_token_cust"})
        assert_test("Google sign-in for non-admin email returns 200", res_cust.status_code == 200)
        cust_data = res_cust.get_json()
        assert_test("Non-admin Google sign-in strictly receives role='customer'", cust_data.get('user', {}).get('role') == 'customer')

        # Verify customer CANNOT access admin routes (403 Forbidden)
        res_blocked = client.get('/api/admin/sales/overview')
        assert_test("Customer is blocked from /api/admin/sales/overview (403 Forbidden)", res_blocked.status_code == 403)
        res_blocked_cust = client.get('/api/admin/customers')
        assert_test("Customer is blocked from /api/admin/customers (403 Forbidden)", res_blocked_cust.status_code == 403)

    # Logout
    client.post('/api/auth/logout')
    res_me_logged_out = client.get('/api/auth/me')
    assert_test("After logout, GET /api/auth/me returns 401 or authenticated=False", res_me_logged_out.status_code == 401 or not res_me_logged_out.get_json().get('authenticated'))

    # 21. Advanced Security & Vulnerability Remediation Tests
    print("\n21. Testing Vulnerability Remediation & Security Controls...")

    # 21.1 Product Management Endpoint Protection
    # Unauthenticated attempts to add, edit, or delete products must be rejected
    res_unauth_add_prod = client.post('/api/products', json={"name": "Attacker SKU", "price": 99.0})
    assert_test("Unauthenticated POST /api/products returns 401 Unauthorized", res_unauth_add_prod.status_code == 401)

    res_unauth_put_prod = client.put('/api/products/1', json={"name": "Attacker Update", "price": 10.0})
    assert_test("Unauthenticated PUT /api/products/<id> returns 401 Unauthorized", res_unauth_put_prod.status_code == 401)

    res_unauth_del_prod = client.delete('/api/products/1')
    assert_test("Unauthenticated DELETE /api/products/<id> returns 401 Unauthorized", res_unauth_del_prod.status_code == 401)

    # Customer attempt to mutate products must return 403 Forbidden
    client.post('/api/auth/login', json={"email": test_email, "password": "SecurePassword123"})
    res_cust_add_prod = client.post('/api/products', json={"name": "Attacker SKU", "price": 99.0})
    assert_test("Customer POST /api/products returns 403 Forbidden", res_cust_add_prod.status_code == 403)
    client.post('/api/auth/logout')

    # 21.2 Database Role Manipulation Resistance (Role alone cannot grant admin access)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = 'admin' WHERE email = %s", (test_email,))
    conn.commit()
    conn.close()

    # Login as this manipulated user
    client.post('/api/auth/login', json={"email": test_email, "password": "SecurePassword123"})
    res_tampered_access = client.get('/api/admin/overview')
    assert_test("Tampered DB role cannot bypass allowlist (returns 403 Forbidden)", res_tampered_access.status_code == 403)
    client.post('/api/auth/logout')

    # Revert test user role to customer
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = 'customer' WHERE email = %s", (test_email,))
    conn.commit()
    conn.close()

    # 21.3 Google Account Linking Takeover Prevention (Pre-registration attack test)
    victim_email = f"pre_reg_victim_{int(time.time()*1000)}@gmail.com"
    victim_sub = f"google-oauth2-victim-sub-{int(time.time()*1000)}"
    victim_pw = "AttackerPreRegPass123"
    res_victim_reg = client.post('/api/auth/register', json={
        "name": "PreReg Victim",
        "email": victim_email,
        "password": victim_pw
    })
    assert_test("Pre-registration of victim email returns 200", res_victim_reg.status_code == 200)
    client.post('/api/auth/logout')

    # Now victim authenticates via Google OAuth (linking account)
    mock_victim_google = {
        "sub": victim_sub,
        "email": victim_email,
        "name": "PreReg Victim Real",
        "picture": "https://lh3.googleusercontent.com/a/victim-avatar",
        "email_verified": True
    }
    with patch('app.verify_google_id_token', return_value=mock_victim_google):
        res_victim_link = client.post('/api/auth/google', json={"credential": "mock_victim_token"})
    assert_test("Victim Google OAuth linking returns 200", res_victim_link.status_code == 200)
    client.post('/api/auth/logout')

    # Attacker tries to log in using the pre-registered password
    res_takeover_attempt = client.post('/api/auth/login', json={
        "email": victim_email,
        "password": victim_pw
    })
    assert_test("Pre-registered password cannot be used after Google link (Takeover Blocked)", res_takeover_attempt.status_code in (400, 401))

    # 21.4 CSRF Protection on Authenticated State-Changing Requests
    # Login as customer
    client.post('/api/auth/login', json={"email": test_email, "password": "SecurePassword123"})
    # Attempt state-changing request WITHOUT custom header (simulating cross-site form POST)
    res_csrf_blocked = client.post('/api/cart/checkout', json={"items": [{"id": 1, "quantity": 1}]}, headers={'X-Requested-With': ''})
    assert_test("State-changing request without CSRF header is rejected (403 Forbidden)", res_csrf_blocked.status_code == 403)
    assert_test("CSRF error message returned", "csrf" in res_csrf_blocked.get_json().get('error', '').lower())
    client.post('/api/auth/logout')

    # 21.5 Authorized Admin Adding, Updating, and Deleting Product (With valid credentials)
    with patch('app.verify_google_id_token', return_value=mock_suvro_payload):
        client.post('/api/auth/google', json={"credential": "valid_mock_token_suvro"})

    res_admin_add_prod = client.post('/api/products', json={
        "name": "Luxury Silk Scarf",
        "category": "Fashion",
        "price": 2499.0,
        "original_price": 3499.0,
        "quantity": 25,
        "description": "100% pure mulberry silk."
    })
    assert_test("Authorized administrator CAN add product (returns 201)", res_admin_add_prod.status_code == 201)
    new_prod_id = res_admin_add_prod.get_json().get('id')

    if new_prod_id:
        # Update product
        res_admin_upd_prod = client.put(f'/api/products/{new_prod_id}', json={"price": 2299.0})
        assert_test("Authorized administrator CAN update product (returns 200)", res_admin_upd_prod.status_code == 200)

        # Delete product
        res_admin_del_prod = client.delete(f'/api/products/{new_prod_id}')
        assert_test("Authorized administrator CAN delete product (returns 200)", res_admin_del_prod.status_code == 200)

    client.post('/api/auth/logout')

    # 21.6 Genuine Google ID Conflict Rejection (Different genuine Google ID cannot claim same email)
    conflict_email = f"conflict_test_{int(time.time()*1000)}@gmail.com"
    genuine_sub_1 = "109823471029384710293"
    genuine_sub_2 = "209823471029384710294"

    # Register and link with genuine_sub_1
    with patch('app.verify_google_id_token', return_value={
        "sub": genuine_sub_1,
        "email": conflict_email,
        "name": "First Account",
        "email_verified": True
    }):
        res_link_1 = client.post('/api/auth/google', json={"credential": "token_1"})
        assert_test("First genuine Google account creation returns 200", res_link_1.status_code == 200)
    client.post('/api/auth/logout')

    # Attempt to sign in with different genuine_sub_2 for the same email
    with patch('app.verify_google_id_token', return_value={
        "sub": genuine_sub_2,
        "email": conflict_email,
        "name": "Second Account Hijack",
        "email_verified": True
    }):
        res_link_2 = client.post('/api/auth/google', json={"credential": "token_2"})
        assert_test("Conflicting genuine Google ID returns 409 Conflict", res_link_2.status_code == 409)
        assert_test("Conflict message explains already linked", "already linked to a different google account" in res_link_2.get_json().get('error', '').lower())

    # 21.7 Production SECRET_KEY Fail-Safe
    import subprocess
    env_test = os.environ.copy()
    env_test['FLASK_ENV'] = 'production'
    if 'SECRET_KEY' in env_test:
        del env_test['SECRET_KEY']
    res_failsafe = subprocess.run(
        [sys.executable, '-c', 'import sys; sys.path.insert(0, sys.argv[1]); import app', 'Backend'],
        env=env_test,
        capture_output=True,
        text=True
    )
    assert_test("Production mode without SECRET_KEY fails safely (exit code != 0)", res_failsafe.returncode != 0)
    assert_test("Production error mentions SECRET_KEY required", "secret_key" in res_failsafe.stderr.lower())

    # CLEANUP: Ensure database is clean of test mock google_id mappings so real browser logins succeed
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET google_id = NULL WHERE email IN ('suvrokayal2005@gmail.com', 'shraddha66singh66@gmail.com')")
    cursor.execute("UPDATE users SET google_id = NULL WHERE google_id LIKE 'google-oauth2-%' OR google_id LIKE '109823%'")
    cursor.execute("DELETE FROM user_login_activity WHERE email = %s", (conflict_email,))
    cursor.execute("DELETE FROM users WHERE email = %s", (conflict_email,))
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print(f"REGRESSION TEST SUMMARY: {passed}/{total} TESTS PASSED")
    print("=" * 60)

    return passed == total

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
