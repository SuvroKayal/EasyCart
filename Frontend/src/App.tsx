import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { Navbar } from './components/layout/Navbar';
import { CategoryNav } from './components/layout/CategoryNav';
import { Footer } from './components/layout/Footer';
import { HeroBanner } from './components/products/HeroBanner';
import { FilterToolbar } from './components/products/FilterToolbar';
import { ProductGrid } from './components/products/ProductGrid';
import { ProductDetailsModal } from './components/products/ProductDetailsModal';
import { CartDrawer } from './components/cart/CartDrawer';
import { AuthModal } from './components/auth/AuthModal';
import { AccountModal } from './components/auth/AccountModal';
import { OrdersModal } from './components/auth/OrdersModal';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { InvoiceModal } from './components/checkout/InvoiceModal';
import { Product, ProductFilters, CategoryItem } from './types';
import { api } from './services/api';
import { useCart } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import {
  ShieldAlert,
  ArrowLeft,
  Lock,
  ChevronRight,
  ShieldCheck,
  Truck,
  RefreshCw,
  Award,
} from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminTab } from './components/admin/AdminLayout';

export const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin routing state
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    return window.location.pathname.startsWith('/admin');
  });
  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    const p = window.location.pathname;
    if (p.includes('/admin/customers')) return 'customers';
    if (p.includes('/admin/activity/logins') || p.includes('/admin/logins')) return 'logins';
    if (p.includes('/admin/sales')) return 'sales';
    if (p.includes('/admin/products')) return 'products';
    if (p.includes('/admin/inventory')) return 'inventory';
    if (p.includes('/admin/categories')) return 'categories';
    if (p.includes('/admin/suppliers')) return 'suppliers';
    if (p.includes('/admin/offers')) return 'offers';
    if (p.includes('/admin/orders')) return 'orders';
    if (p.includes('/admin/analytics')) return 'analytics';
    if (p.includes('/admin/activity')) return 'activity';
    if (p.includes('/admin/settings')) return 'settings';
    return 'overview';
  });

  // Filters & Search state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('default');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [priceFilter, setPriceFilter] = useState<string>('all');

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [invoiceOpen, setInvoiceOpen] = useState<boolean>(false);
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState<boolean>(false);

  const { applyCoupon, openCart } = useCart();
  const { isAuthenticated, user, openAuthModal, setAccountModalOpen } = useAuth();

  const collectionSectionRef = useRef<HTMLDivElement>(null);
  const catalogViewRef = useRef<HTMLDivElement>(null);

  // Sync popstate routing
  useEffect(() => {
    const handlePopState = () => {
      const isAdm = window.location.pathname.startsWith('/admin');
      setIsAdminRoute(isAdm);
      if (isAdm) {
        const p = window.location.pathname;
        if (p.includes('/admin/customers')) setAdminTab('customers');
        else if (p.includes('/admin/activity/logins') || p.includes('/admin/logins')) setAdminTab('logins');
        else if (p.includes('/admin/sales')) setAdminTab('sales');
        else if (p.includes('/admin/products')) setAdminTab('products');
        else if (p.includes('/admin/inventory')) setAdminTab('inventory');
        else if (p.includes('/admin/categories')) setAdminTab('categories');
        else if (p.includes('/admin/suppliers')) setAdminTab('suppliers');
        else if (p.includes('/admin/offers')) setAdminTab('offers');
        else if (p.includes('/admin/orders')) setAdminTab('orders');
        else if (p.includes('/admin/analytics')) setAdminTab('analytics');
        else if (p.includes('/admin/activity')) setAdminTab('activity');
        else if (p.includes('/admin/settings')) setAdminTab('settings');
        else setAdminTab('overview');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load category tree for subcategory pills
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const tree = await api.getCategoryTree();
        setCategoryTree(tree || []);
      } catch (err) {
        console.error('Failed to load category hierarchy:', err);
      }
    };
    fetchTree();
  }, []);

  const navigateToAdmin = (tab: AdminTab = 'overview') => {
    setAdminTab(tab);
    setIsAdminRoute(true);
    const targetPath = tab === 'overview' ? '/admin' : `/admin/${tab}`;
    window.history.pushState({}, '', targetPath);
  };

  const exitAdminToStore = () => {
    setIsAdminRoute(false);
    window.history.pushState({}, '', '/');
  };

  // Parse min_price and max_price from priceFilter
  const getPriceRange = (range: string): { min?: number; max?: number } => {
    switch (range) {
      case 'under-500':
        return { max: 500 };
      case '500-1500':
        return { min: 500, max: 1500 };
      case '1500-5000':
        return { min: 1500, max: 5000 };
      case 'above-5000':
        return { min: 5000 };
      default:
        return {};
    }
  };

  // Fetch products from Flask backend
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { min, max } = getPriceRange(priceFilter);
      const filters: ProductFilters = {
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        search: activeSearch || undefined,
        sort: sortBy !== 'default' ? sortBy : undefined,
        in_stock: inStockOnly || undefined,
        min_price: min,
        max_price: max,
      };

      const data = await api.getProducts(filters);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, activeSearch, sortBy, inStockOnly, priceFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchSubmit = () => {
    setActiveSearch(searchQuery.trim());
    setSelectedSubcategory('All');
    if (catalogViewRef.current) {
      catalogViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('All');
    setActiveSearch('');
    setSearchQuery('');
    if (category !== 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedSubcategory('All');
    setSearchQuery('');
    setActiveSearch('');
    setSortBy('default');
    setInStockOnly(false);
    setPriceFilter('all');
  };

  const handleProceedCheckout = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setCheckoutOpen(true);
  };

  const handleOrderSuccess = (orderData: any) => {
    setCurrentOrder(orderData);
    setInvoiceOpen(true);
    loadProducts();
  };

  // Check if viewing homepage
  const isHomepage = selectedCategory === 'All' && !activeSearch;

  // Active category node for subcategories
  const currentCategoryNode = categoryTree.find(
    (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
  );
  const activeSubcategories = currentCategoryNode?.children || [];

  // Filter products by subcategory if selected
  const displayedProducts = selectedSubcategory === 'All'
    ? products
    : products.filter((p) => {
        const subId = p.subcategory_id;
        if (subId) {
          const match = activeSubcategories.find((c) => c.id === subId);
          return match?.name.toLowerCase() === selectedSubcategory.toLowerCase();
        }
        return false;
      });

  // If user navigated to an /admin route
  if (isAdminRoute) {
    if (!isAuthenticated || user?.role !== 'admin') {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-porcelain dark:bg-dark-bg transition-colors">
          <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-lg text-center space-y-5 animate-fadeIn">
            <div className="w-14 h-14 rounded-xl bg-bronze/10 text-bronze dark:text-bronze-gold flex items-center justify-center mx-auto border border-bronze/20">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold text-espresso dark:text-porcelain">
                Administrator Authentication Required
              </h2>
              <p className="text-xs text-mutedGrey dark:text-dark-muted mt-2 leading-relaxed">
                Access to the EasyCart Control Center is restricted exclusively to authorized administrators (<span className="font-mono text-bronze">suvrokayal2005@gmail.com</span> or <span className="font-mono text-bronze">shraddha66singh66@gmail.com</span>).
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-3 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold text-xs shadow-luxury-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Sign In as Administrator
              </button>
              <button
                onClick={exitAdminToStore}
                className="w-full py-2.5 rounded-xl bg-stone-light/60 dark:bg-dark-elevated hover:bg-stone dark:hover:bg-dark-card text-espresso dark:text-porcelain font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-softBorder dark:border-dark-border"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Public Store
              </button>
            </div>
          </div>
          <AuthModal />
        </div>
      );
    }

    return (
      <>
        <AdminDashboard
          initialTab={adminTab}
          onExitToStore={exitAdminToStore}
        />
        <AuthModal />
        <AccountModal onNavigateOrders={() => setOrdersModalOpen(true)} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-porcelain dark:bg-dark-bg text-espresso dark:text-porcelain transition-colors">
      {/* 1. Announcement Bar */}
      <AnnouncementBar />

      {/* 2. Main Navigation Bar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onLogoClick={() => handleSelectCategory('All')}
        onNavigateOrders={() => setOrdersModalOpen(true)}
        onNavigateAdmin={() => navigateToAdmin('overview')}
      />

      {/* 3. Category Navigation Bar */}
      <CategoryNav
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* HOMEPAGE VIEW: HERO BANNER DIRECTLY INTO DYNAMIC PRODUCT COLLECTION */}
        {isHomepage ? (
          <div className="space-y-12">
            {/* Hero Section */}
            <HeroBanner
              onShopNow={() => {
                if (collectionSectionRef.current) {
                  collectionSectionRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              onApplyCoupon={async (code) => {
                await applyCoupon(code);
                openCart();
              }}
              onSelectCategory={handleSelectCategory}
            />

            {/* Dynamic Product Collection Section */}
            <section
              id="our-collection"
              ref={collectionSectionRef}
              className="space-y-6 pt-2 pb-4 scroll-mt-20"
            >
              {/* Section Header with Refined Editorial Styling */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-softBorder dark:border-dark-border pb-5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-bronze dark:text-bronze-gold">
                    Curated Catalogue
                  </span>
                  <h2 className="font-serif text-3xl sm:text-4xl font-normal text-espresso dark:text-porcelain mt-1">
                    Our Collection
                  </h2>
                  <p className="text-xs sm:text-sm text-mutedGrey dark:text-dark-muted font-light mt-1 max-w-xl">
                    Explore our complete range of certified premium essentials, precision technology, and artisanal craftsmanship.
                  </p>
                </div>

                <FilterToolbar
                  currentCategory={selectedCategory}
                  productCount={displayedProducts.length}
                  inStockOnly={inStockOnly}
                  onToggleInStock={setInStockOnly}
                  priceFilter={priceFilter}
                  onPriceFilterChange={setPriceFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onResetFilters={handleResetFilters}
                  onBackToBanners={() => handleSelectCategory('All')}
                />
              </div>

              {/* Dynamic Product Grid */}
              <ProductGrid
                products={displayedProducts}
                isLoading={loading}
                onOpenDetail={setSelectedProduct}
                onResetFilters={handleResetFilters}
              />
            </section>

            {/* Shopping Trust Guarantees & Pillars */}
            <section aria-labelledby="shopping-guarantees-heading" className="py-6 space-y-6">
              <div className="text-center max-w-xl mx-auto">
                <span className="text-xs font-semibold uppercase tracking-widest text-bronze">
                  The EasyCart Standard
                </span>
                <h3 id="shopping-guarantees-heading" className="font-serif text-2xl font-normal text-espresso dark:text-porcelain mt-1">
                  Crafted for Daily Life, Built on Trust
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-bronze/10 text-bronze flex items-center justify-center mx-auto border border-bronze/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-espresso dark:text-porcelain">
                    100% Verified Authenticity
                  </h4>
                  <p className="text-xs text-mutedGrey dark:text-dark-muted font-light leading-relaxed">
                    Direct brand procurement and stringent quality inspections prior to dispatch.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-bronze/10 text-bronze flex items-center justify-center mx-auto border border-bronze/20">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-espresso dark:text-porcelain">
                    Complimentary Express Shipping
                  </h4>
                  <p className="text-xs text-mutedGrey dark:text-dark-muted font-light leading-relaxed">
                    Enjoy fast, tracked pan-India delivery at no charge on all orders over ₹999.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-bronze/10 text-bronze flex items-center justify-center mx-auto border border-bronze/20">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-espresso dark:text-porcelain">
                    7-Day Hassle-Free Returns
                  </h4>
                  <p className="text-xs text-mutedGrey dark:text-dark-muted font-light leading-relaxed">
                    Doorstep returns and rapid refunds if your purchase does not meet your expectations.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-bronze/10 text-bronze flex items-center justify-center mx-auto border border-bronze/20">
                    <Award className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-espresso dark:text-porcelain">
                    Curated Department Curation
                  </h4>
                  <p className="text-xs text-mutedGrey dark:text-dark-muted font-light leading-relaxed">
                    Zero counterfeit clutter — only purposeful essentials selected by domain specialists.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* DEDICATED CATEGORY & SEARCH CATALOG VIEW */
          <div ref={catalogViewRef} className="space-y-6 pt-2 pb-12 animate-fadeIn">
            {/* Breadcrumb Navigation & Catalog Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-softBorder dark:border-dark-border">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-mutedGrey dark:text-dark-muted">
                  <button
                    onClick={() => handleSelectCategory('All')}
                    className="hover:text-bronze transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-espresso dark:text-porcelain font-semibold">
                    {activeSearch ? `Search: "${activeSearch}"` : selectedCategory}
                  </span>
                  {selectedSubcategory !== 'All' && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span className="text-bronze font-semibold">{selectedSubcategory}</span>
                    </>
                  )}
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-espresso dark:text-porcelain mt-1">
                  {activeSearch
                    ? `Results for "${activeSearch}"`
                    : `${selectedCategory} Department`}
                </h2>
              </div>

              <button
                onClick={() => handleSelectCategory('All')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-surface hover:bg-porcelain border border-softBorder dark:border-dark-border text-xs font-semibold text-mutedGrey hover:text-espresso dark:hover:text-porcelain transition-colors self-start sm:self-auto cursor-pointer shadow-luxury-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to All Departments
              </button>
            </div>

            {/* Subcategory Filter Pills (if active category has subcategories) */}
            {activeSubcategories.length > 0 && !activeSearch && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <span className="text-xs text-mutedGrey font-medium shrink-0">Subcategories:</span>
                <button
                  onClick={() => setSelectedSubcategory('All')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedSubcategory === 'All'
                      ? 'bg-espresso text-porcelain dark:bg-bronze dark:text-espresso shadow-luxury-sm'
                      : 'bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-mutedGrey hover:text-espresso'
                  }`}
                >
                  All {selectedCategory}
                </button>
                {activeSubcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubcategory(sub.name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      selectedSubcategory === sub.name
                        ? 'bg-espresso text-porcelain dark:bg-bronze dark:text-espresso shadow-luxury-sm font-semibold'
                        : 'bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-mutedGrey hover:text-espresso'
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* Filter Toolbar */}
            <FilterToolbar
              currentCategory={selectedCategory}
              productCount={displayedProducts.length}
              inStockOnly={inStockOnly}
              onToggleInStock={setInStockOnly}
              priceFilter={priceFilter}
              onPriceFilterChange={setPriceFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onResetFilters={handleResetFilters}
              onBackToBanners={() => handleSelectCategory('All')}
            />

            {/* Product Grid */}
            <ProductGrid
              products={displayedProducts}
              isLoading={loading}
              onOpenDetail={setSelectedProduct}
              onResetFilters={handleResetFilters}
            />
          </div>
        )}
      </main>

      {/* Curved Premium Footer */}
      <Footer
        onSelectCategory={handleSelectCategory}
        onOpenCouponCart={async (code) => {
          await applyCoupon(code);
          openCart();
        }}
        onOpenOrders={() => {
          if (isAuthenticated) setOrdersModalOpen(true);
          else openAuthModal('login');
        }}
        onOpenProfile={() => {
          if (isAuthenticated) setAccountModalOpen(true);
          else openAuthModal('login');
        }}
        onOpenAuth={(tab) => openAuthModal(tab)}
        onOpenAdmin={() => navigateToAdmin('overview')}
      />

      {/* Global Modals & Overlays */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <CartDrawer onProceedCheckout={handleProceedCheckout} />

      <AuthModal />

      <AccountModal onNavigateOrders={() => setOrdersModalOpen(true)} />

      <OrdersModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
        onViewInvoice={(ord) => {
          setCurrentOrder(ord);
          setInvoiceOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />

      <InvoiceModal
        order={currentOrder}
        isOpen={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false);
          setCurrentOrder(null);
        }}
        onContinueShopping={() => {
          setInvoiceOpen(false);
          setCurrentOrder(null);
        }}
      />
    </div>
  );
};
