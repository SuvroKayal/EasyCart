# EasyCart 2.0 — Crystal Luxury E-Commerce & Admin Control Center

EasyCart 2.0 is a production-quality, modern full-stack e-commerce platform and executive administrative control center. It transforms the legacy storefront into an Apple Liquid Glass-inspired **Crystal Luxury** design system, migrated entirely to **React 18, TypeScript, Tailwind CSS, Vite, and Framer Motion**, seamlessly powered by the existing **Python Flask** backend and **SQLite** database.

---

## 💎 Design Direction: Crystal Luxury

The user interface implements an Apple-inspired Liquid Glass aesthetic:
- **Liquid Glass Materials**: Custom multi-layered blur backdrops (`backdrop-filter: blur(16px)`), specular white edge highlights (`border-white/60`), and subtle ambient drop shadows.
- **Theme Support**: Balanced **Light** mode (default) and **Dark** mode (deep midnight navy `#0D1527`), persisted in `localStorage` and respected across both storefront and administrative consoles.
- **Crystal Wave Footer**: Distinctive asymmetric flowing curved upper edge created via responsive mathematical SVG paths that smoothly integrates the main storefront into the midnight crystal footer.
- **Fluid Micro-Interactions**: Carefully tuned spring physics for modals, slide-out cart drawer, and interactive product inspections.

---

## 🏛️ Architecture & Technology Stack

### Frontend (Crystal Luxury UI/UX)
- **Framework**: React 18 + TypeScript (Strict Type Checking)
- **Build Tool**: Vite 5 (Lightning-fast HMR & production bundle minification)
- **Styling**: Tailwind CSS + Custom Crystal Glass Theme (`crystal-theme.css`)
- **Animations**: Framer Motion (Restrained drawer/modal physics & specular reflections)
- **Icons**: Lucide React
- **State Management**: React Context (`AuthContext`, `CartContext`, `ThemeContext`, `ToastProvider`)
- **Client Networking**: Native Fetch API with session credential preservation (`credentials: 'include'`)

### Backend (Modular Flask Blueprint Architecture)
- **Framework**: Python Flask 3.0.2 with Application Factory pattern (`create_app`)
- **Architecture**: Modular Blueprints (`auth`, `products`, `cart`, `checkout`, `orders`, `admin`, `suppliers`)
- **WSGI Entry Point**: Production WSGI compatible (`gunicorn app:app` for Render & cloud deployment)
- **Database Engine**: Dual-mode database layer supporting Supabase PostgreSQL (production) with automatic fallback to local SQLite (`Backend/easycart.db`) with 15 strategic indexes
- **Transaction Safety**: Context-managed atomic transactions with automatic rollback on error
- **Inventory Concurrency**: Atomic inventory deduction (`UPDATE products SET quantity = quantity - %s WHERE id = %s AND quantity >= %s`) preventing race conditions and overselling
- **Security Hardening**: Sliding-window IP rate limiting, CSRF defense headers, magic bytes image verification, and server-enforced administrator allowlist
- **Authentication**: Google Identity Services OAuth 2.0 with signature verification + PBKDF2/SHA-256 password hashing via Werkzeug

---

## 🛡️ Admin Control Center

The application features a 13-item administrative suite accessible at `/admin` (or via the **Admin Center** shield button in the top navigation):

1. **Executive Overview** (`/admin`): Real-time KPI summary cards (Net Sales Revenue, Customer Accounts, Low Stock Watchlist, Today's Login Security events, and recent Admin Activity audit trail).
2. **Product Catalog & SKU Management** (`/admin/products`): Full catalog view, live SKU search, dynamic category filtering, new product creation with image linking, and deletion.
3. **Inventory & Stock Control** (`/admin/inventory`): Real-time stock levels of all 25 products with visual health badges (In Stock, Low Stock $\le 10$, Out of Stock), quantity steppers, and inline database updates.
4. **Category Merchandising** (`/admin/categories`): Structural departments view with category hero banners, SKU counts, total in-stock units, and average price per category.
5. **Promotions & Offers** (`/admin/offers`): Active voucher cards (`WELCOME10`, `SAVE50`, `FREESHIP`), discount rules, minimum order thresholds, and live store redemption metrics.
6. **Order Fulfillment** (`/admin/orders`): Searchable, filterable order fulfillment table with full customer address inspection and inline status dropdowns (`Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`).
7. **Sales & Revenue Intelligence** (`/admin/sales`): Live metrics derived strictly from SQLite order records (Gross Sales, Total Discounts, Total Refunds, Net Revenue, Paid vs Pending vs Cancelled Orders, Average Order Value, Units Sold). Includes date range filters (Today, 7 Days, 30 Days, YTD, Custom) and 4 CSV exports.
8. **Customer Account Management** (`/admin/customers`): Searchable customer roster, spending statistics, order counts, status history, session revocation, and **safeguarded soft-deletion**.
9. **Login Security Monitoring** (`/admin/activity/logins`): Database-backed telemetry logging successful logins, failed attempts, IP addresses, user agents, and brute-force detection.
10. **Commerce Analytics** (`/admin/analytics`): Deep-dive chronological revenue trajectory graphs, department contribution progress bars, and top-velocity SKU rankings.
11. **Administrative Audit Trail** (`/admin/activity`): Immutable log of all administrative actions (status adjustments, session revoking, inventory modifications).
12. **Storefront & Engine Settings** (`/admin/settings`): Superadmin registry, tax and shipping policy parameters, SQLite path, and runtime environment health.
13. **Sign Out**: Securely clears administrative session and redirects to the public storefront.

### 🔐 Authorized Administrator Accounts & Safeguards

EasyCart 2.0 enforces a strict server-side **Two-Account Superadmin Allowlist**. Only the following two verified Google accounts are permitted administrative access:

| Administrator Name | Google / Email Address | Role | Privileges |
| :--- | :--- | :--- | :--- |
| **Suvro Kayal** | `suvrokayal2005@gmail.com` | `admin` | Full Admin Control Center Access & Protected Superadmin |
| **Shraddha Singh** | `shraddha66singh66@gmail.com` | `admin` | Full Admin Control Center Access & Protected Superadmin |

> **Strict Account Safeguards & Role Isolation Active:**
> - **Zero Self-Promotion**: Roles are determined server-side; client role requests are strictly ignored.
> - **Allowlist Enforcement**: Any Google account not in the explicit allowlist is automatically provisioned as `customer`.
> - **Superadmin Deletion Safeguards**: Attempts to deactivate or delete either protected administrator account are rejected with `HTTP 403 Forbidden`.
> - **Customer Soft Deletion**: Compliant deactivation preserves financial records, invoices, and audit trails.

---

## 🌐 Google Authentication & Identity Services (GIS)

EasyCart features official Google OAuth 2.0 authentication using Google Identity Services:

- **Frontend Flow**: Official Google GIS library (`https://accounts.google.com/gsi/client`) initializes the custom Crystal Luxury "Continue with Google" button, adapting automatically to light and dark themes.
- **Backend Verification**: Flask verifies the cryptographic signature of the Google ID token using Google's official `google-auth` library (`id_token.verify_oauth2_token`) against Google's public certificates.
- **Audience & Issuer Validation**: Guarantees the token was issued by Google specifically for the EasyCart Google Client ID.
- **Session Fixation Defense**: Existing session IDs are cleared and regenerated upon authentication.
- **Rate Limiting**: Sliding window rate limiter protects auth endpoints (maximum 15 attempts per 5 minutes per IP).

### ⚙️ Google Cloud Console Configuration
- **Application Type**: Web application
- **Client Name**: EasyCart Web Client
- **Google Client ID**: `334860227356-tmgcjjar1p1bf8g14nllr2qolldu60gr.apps.googleusercontent.com`
- **Authorized JavaScript Origins**:
  - `https://easycart-vzl7.onrender.com` *(Production)*
  - `http://127.0.0.1:5000` *(Local Flask Development)*
  - `http://localhost:5000` *(Localhost alias)*
- **Publishing Status**: *External / Testing Mode*
  > **Note on Testing Mode:** In Google Cloud Console Testing mode, only accounts added under **OAuth consent screen > Test users** can authenticate. Ensure `suvrokayal2005@gmail.com`, `shraddha66singh66@gmail.com`, and any demonstration customer accounts are listed as test users.

### 🌐 Render Production Environment Variables
When deploying to Render (`https://easycart-vzl7.onrender.com`), set the following environment variables in the Render Dashboard:

```env
GOOGLE_CLIENT_ID=334860227356-tmgcjjar1p1bf8g14nllr2qolldu60gr.apps.googleusercontent.com
GOOGLE_ALLOWED_ADMIN_EMAILS=suvrokayal2005@gmail.com,shraddha66singh66@gmail.com
SECRET_KEY=generate_a_secure_random_hex_key_here
FLASK_ENV=production
```

---

## 📁 Project Directory Structure (Modular Blueprint Architecture)

```text
EasyCart/
├── app.py                          # WSGI root entry point (delegates to Backend.create_app())
├── requirements.txt                # Python dependencies (Flask 3, Werkzeug, psycopg, gunicorn, pytest)
├── README.md                       # Master system documentation
├── .env.example                    # Environment configuration template
├── run_tests.py                    # Unified test runner (executes both unit & regression tests)
├── test_regression.py              # 144-point automated end-to-end regression test suite
│
├── tests/                          # Modular Automated Test Suite (23 test cases)
│   ├── base.py                     # BaseTestCase with isolated test database & fixtures
│   ├── conftest.py                 # Pytest fixtures and app configuration
│   ├── test_cart.py                # Server-side pricing & quantity boundary tests
│   ├── test_coupons.py             # Percentage, flat, cap & threshold coupon tests
│   ├── test_checkout_atomic.py     # Atomic stock deduction & overselling prevention
│   ├── test_auth.py                # Registration, hashing, rate limiting & admin boundaries
│   └── test_orders.py              # Order isolation & status state machine tests
│
├── Backend/
│   ├── __init__.py                 # Application factory (create_app) & blueprint registrations
│   ├── app.py                      # Backend launcher & WSGI instance
│   ├── config.py                   # Centralized configuration (Dev, Testing, Prod)
│   ├── extensions.py               # In-memory sliding-window rate limiter & CSRF helpers
│   ├── easycart.db                 # Live SQLite database with 15 strategic indexes
│   │
│   ├── database/                   # Database abstraction layer
│   │   ├── __init__.py             # Exports get_db, transaction, init_db
│   │   ├── connection.py           # SQLite & psycopg PostgreSQL connection management
│   │   ├── models.py               # Idempotent table definitions, migrations & indexes
│   │   └── seed.py                 # Extracted seed product catalog & coupons
│   │
│   ├── common/                     # Shared cross-cutting concerns
│   │   ├── security.py             # @admin_required, @login_required, password hashing, Google auth
│   │   ├── validators.py           # Strict email, phone, PIN, cart & magic bytes image validation
│   │   └── responses.py            # Standardized JSON response helpers
│   │
│   ├── auth/                       # Authentication blueprint (/api/auth/*)
│   ├── products/                   # Product catalog & categories blueprint (/api/products/*)
│   ├── cart/                       # Server-side cart calculation & coupons (/api/cart/*)
│   ├── checkout/                   # Transaction-safe atomic checkout (/api/cart/checkout)
│   ├── orders/                     # Customer order history (/api/auth/orders)
│   ├── admin/                      # Comprehensive administrative control (/api/admin/*)
│   ├── suppliers/                  # Supplier directory & management (/api/admin/suppliers/*)
│   ├── migrations/                 # Database schema migration scripts
│   └── scripts/                    # Maintenance & utility scripts
│
├── banner/                         # Category photography & transparent brand graphics
│
└── Frontend/                       # React 18 + TypeScript + Vite Single Page Application
    ├── index.html                  # HTML entry point (Inter font & meta configuration)
    ├── package.json                # React, Vite, Tailwind, Framer Motion dependencies
    ├── tsconfig.json               # TypeScript configuration with strict mode
    ├── vite.config.ts              # Vite reverse-proxy configuration
    ├── tailwind.config.js          # Crystal Luxury design tokens & custom shadow definitions
    ├── postcss.config.js           # PostCSS Tailwind and Autoprefixer plugins
    │
    ├── public/                     # Static assets served in development and production
    ├── dist/                       # Compiled production bundle served directly by Flask
    │
    └── src/
        ├── types/                  # Strict TypeScript interfaces
        ├── services/api.ts         # Centralized API service layer with all storefront & admin endpoints
        ├── context/                # AuthContext, CartContext, ThemeContext
        ├── styles/                 # crystal-theme.css (glass tokens, specular highlights)
        └── components/             # React component hierarchy (storefront, cart, auth, admin)
```

---

## 🚀 How to Run the Application

### Option 1: Standalone Flask (Production Mode — Recommended)
The React application has already been compiled into `Frontend/dist`. The Python Flask server automatically serves the compiled SPA:

```bash
# Start Flask server
python app.py
```
- Storefront URL: **`http://127.0.0.1:5000/`**
- Admin Control Center: **`http://127.0.0.1:5000/admin`**

### Production WSGI Server (Render / Cloud Deployment)
```bash
gunicorn app:app
```

### Option 2: Vite Dev Server with Live Reload (Development Mode)
Run two parallel processes for full hot-module replacement (HMR):

**Terminal 1 (Backend REST API):**
```bash
python app.py
```

**Terminal 2 (React Vite Dev Server):**
```bash
cd Frontend
npm run dev
```
- Dev Storefront URL: **`http://localhost:5173/`**
- Dev Admin URL: **`http://localhost:5173/admin`**
*(Vite proxies all `/api`, `/banner`, and `/static` requests to Flask at port 5000).*

---

## 🧪 Comprehensive Automated Testing Suite

EasyCart includes **167 automated tests** across two complementary test suites:

### 1. Unified Test Runner
To run all unit and regression tests in a single command:
```bash
python run_tests.py
```

Or run suites independently:
```bash
python run_tests.py unit       # Runs 23 modular unit tests (tests/)
python run_tests.py regress    # Runs 144 regression tests (test_regression.py)
```

### 2. Pytest Support
If `pytest` is installed in your environment:
```bash
pytest tests/ -v
```
The React application has already been compiled into `Frontend/dist`. The Python Flask server automatically serves the compiled SPA:

```bash
# Start Flask server
python app.py
```
- Storefront URL: **`http://127.0.0.1:5000/`**
- Admin Control Center: **`http://127.0.0.1:5000/admin`**

### Option 2: Vite Dev Server with Live Reload (Development Mode)
Run two parallel processes for full hot-module replacement (HMR):

**Terminal 1 (Backend REST API):**
```bash
python app.py
```

**Terminal 2 (React Vite Dev Server):**
```bash
cd Frontend
npm run dev
```
- Dev Storefront URL: **`http://localhost:5173/`**
- Dev Admin URL: **`http://localhost:5173/admin`**
*(Vite proxies all `/api`, `/banner`, and `/static` requests to Flask at port 5000).*

---

## 🧪 Comprehensive Automated Regression Testing

A comprehensive regression test suite verifies 144 critical functional and security points across the storefront, pricing engine, authentication, database transactions, Google OAuth verification, role-based access control, CSRF defenses, account linking conflict resolution, and the entire administrative suite:

```bash
python test_regression.py
```

### Test Suite Coverage:
- **Frontend SPA Serving**: Root route, React mount point, Crystal Luxury title.
- **Categories API**: All 8 departments.
- **Coupons Engine**: `WELCOME10`, `SAVE50`, `FREESHIP` verification.
- **Product Catalog**: Category filtering, search query, sorting (`price_asc`, `price_desc`, `rating`), and in-stock toggles.
- **Product Detail**: Product metadata and related items recommendations.
- **Cart Calculation Engine**: Subtotal, tiered coupon application, dynamic delivery fee calculation, and total basket computation.
- **User Authentication**: Registration, login, session validation, and logout.
- **Order Placement**: Atomic SQLite inventory deduction and invoice generation.
- **Order History**: User order retrieval with line items.
- **Static Assets**: Category banners and vector graphics.
- **Admin Security Boundaries**: 401/403 rejection for unauthenticated and standard customer requests targeting `/api/admin/*`.
- **Admin Authentication**: Multi-admin login verification and legacy admin demotion.
- **Admin Executive Overview**: Real-time customer, order, stock, and revenue metrics.
- **Customer Management & Safeguards**: Customer roster, detail inspection, **Superadmin deletion safeguard (403 Forbidden)**, customer soft-deactivation, session revocation, and reactivation.
- **Login Activity Monitoring**: Telemetry tracking, failed login brute-force capture, and admin activity audit logging.
- **Sales & Financial Management**: Gross sales, discounts, refunds, net revenue, AOV, sales analytics, and order fulfillment updates.
- **CSV Data Exports**: Order records, sales reports, product velocity, and customer rosters.
- **Inventory & Offers Admin APIs**: Stock adjustments and coupon redemption statistics.
- **Google OAuth & Multi-Admin Security**: Client ID verification endpoint, forged token rejection, authorized superadmin sign-in (`suvrokayal2005@gmail.com`, `shraddha66singh66@gmail.com`), regular customer sign-in role isolation (`role='customer'`), access prevention on administrative endpoints for non-admins (403 Forbidden), and session cleanup.
- **Advanced Security & Vulnerability Remediation**:
  * Unauthenticated & customer catalog mutation prevention (`POST /api/products`, `PUT /api/products/<id>`, `DELETE /api/products/<id>` strictly return 401/403).
  * Database role manipulation resistance (direct DB tampering cannot bypass the email allowlist).
  * Google account linking takeover protection (pre-registered passwords are neutralized upon Google linking).
  * CSRF defense on authenticated state-changing requests (unauthorized cross-site requests are rejected with 403 Forbidden).
  * Administrator catalog mutations with valid credentials.
  * Genuine Google ID conflict defense (conflicting genuine Google IDs for the same email return 409 Conflict).
  * Production fail-safe enforcement (application strictly refuses to launch in production if `SECRET_KEY` is missing).

**Result: 144/144 tests passing (100% pass rate).**

---

## 🎟️ Active Demonstration Coupons
- **`WELCOME10`**: 10% discount on orders $\ge ₹200$ (Max discount ₹500).
- **`SAVE50`**: Flat ₹50 discount on orders $\ge ₹499$.
- **`FREESHIP`**: Free standard shipping on orders $\ge ₹300$ (Standard orders $\ge ₹999$ receive automatic complimentary shipping).
