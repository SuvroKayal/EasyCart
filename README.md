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

### Backend (Python Flask REST Services)
- **Framework**: Python Flask 3.0+
- **Database**: SQLite 3 (`Backend/easycart.db`) with ACID transaction integrity and automatic PostgreSQL compatibility
- **Authentication**: Session-backed with PBKDF2/SHA-256 password hashing via Werkzeug
- **Cart & Pricing Engine**: Server-authoritative calculation at `POST /api/cart/calculate`
- **Checkout & Inventory**: Atomic inventory deduction, unique sequential order IDs (`EC-XXXXXX`), and printable invoice rendering at `POST /api/cart/checkout`
- **Admin Control APIs**: 14+ dedicated admin endpoints under `/api/admin/*` protected by `@admin_required`

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

## 📁 Cleaned Project Directory Structure

```text
EasyCart/
├── app.py                          # Root launcher (imports and serves Flask app & React SPA)
├── requirements.txt                # Python dependencies (Flask, Werkzeug, psycopg, gunicorn)
├── README.md                       # Master system documentation
├── test_regression.py              # 103-point automated regression test suite
│
├── Backend/
│   ├── app.py                      # Flask REST API, authentication, admin endpoints & SPA router
│   ├── easycart.db                 # Live SQLite database with all tables and columns
│   ├── easycart.db.backup          # Initial safety checkpoint backup
│   ├── migrate_admin_features.py   # Database migration utility for admin tables
│   └── products.json               # Canonical 25-product catalog seed
│
├── banner/                         # Category photography & transparent brand graphics
│   ├── Electronics.png
│   ├── Grocery.png
│   ├── Fashion.png
│   ├── Home-Kitchen.png
│   ├── Beauty.png
│   ├── Books.png
│   ├── Fitness.png
│   ├── Toys.png
│   └── EasyCart logo transparent.png
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
    │   ├── banner/                 # Category banners and brand imagery
    │   └── static/images/          # Product SVG vectors (p1.svg - p25.svg)
    │
    ├── dist/                       # Compiled production bundle served directly by Flask
    │   ├── index.html
    │   └── assets/                 # Minified and fingerprinted JS & CSS bundles
    │
    └── src/
        ├── types/                  # Strict TypeScript interfaces
        ├── services/api.ts         # Centralized API service layer with all storefront & admin endpoints
        ├── context/                # AuthContext, CartContext, ThemeContext
        ├── styles/                 # crystal-theme.css (glass tokens, specular highlights)
        │
        └── components/
            ├── common/             # Button, Input, Modal, Toast
            ├── layout/             # AnnouncementBar, Navbar, CategoryNav, Footer (Crystal Wave)
            ├── products/           # HeroBanner, CategoryShowcase, FilterToolbar, ProductCard, ProductGrid, ProductDetailsModal
            ├── cart/               # CartDrawer (pearl-white/dark glass, coupon chips, stepper)
            ├── auth/               # AuthModal (Sign In / Register), AccountModal, OrdersModal
            ├── checkout/           # CheckoutModal (2-column layout), InvoiceModal (printable receipt)
            └── admin/              # Complete Admin Control Center
                ├── AdminLayout.tsx         # 13-item navigation sidebar & executive header
                ├── AdminDashboard.tsx      # Main coordinator & tab dispatcher
                ├── AdminOverview.tsx       # Live KPI overview & low-stock watchlist
                ├── AdminProducts.tsx       # Product SKU management & catalog CRUD
                ├── AdminInventory.tsx      # Real-time stock control & inline stepper
                ├── AdminCategories.tsx     # Department merchandising & category banners
                ├── AdminOffers.tsx         # Promotions, coupons & usage metrics
                ├── AdminOrders.tsx         # Order fulfillment, tracking & status updates
                ├── AdminSales.tsx          # Real sales revenue, date filters & CSV exports
                ├── AdminCustomers.tsx      # Customer accounts, session revocation & safeguards
                ├── AdminLoginActivity.tsx  # Login security activity & brute-force monitoring
                ├── AdminAnalytics.tsx      # Commerce intelligence & trajectory charts
                ├── AdminActivityLog.tsx    # Administrative audit trail log
                └── AdminSettings.tsx       # System parameters & superadmin access list
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
