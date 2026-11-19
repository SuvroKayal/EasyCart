import {
  Product,
  Coupon,
  CartItem,
  CartCalculation,
  DeliveryDetails,
  Order,
  ProductFilters,
  User,
  Customer,
  CustomerDetail,
  LoginActivityResponse,
  SalesOverview,
  SalesAnalytics,
  AdminOverview,
  AdminActivity,
  AdminOffer,
  CategoryItem,
  Supplier,
  SupplierStats,
} from '../types';

const API_BASE = '/api';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const csrf = getCsrfToken();
  const headers = new Headers(init.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (csrf) {
    headers.set('X-CSRF-Token', csrf);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || data.details || data.message || `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  // Products
  async getProducts(filters?: ProductFilters): Promise<Product[]> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'All') {
      params.append('category', filters.category);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.sort) {
      params.append('sort', filters.sort);
    }
    if (filters?.in_stock) {
      params.append('in_stock', 'true');
    }
    if (filters?.min_price !== undefined) {
      params.append('min_price', filters.min_price.toString());
    }
    if (filters?.max_price !== undefined) {
      params.append('max_price', filters.max_price.toString());
    }
    if (filters?.category_id !== undefined) {
      params.append('category_id', filters.category_id.toString());
    }
    if (filters?.subcategory_id !== undefined) {
      params.append('subcategory_id', filters.subcategory_id.toString());
    }
    if (filters?.include_inactive) {
      params.append('include_inactive', 'true');
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`${API_BASE}/products${query}`, {
      credentials: 'include',
    });
    return handleResponse<Product[]>(res);
  },

  async getProduct(id: number): Promise<{ product: Product; related: Product[] }> {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ product: Product; related: Product[] }>(res);
  },

  async getCategories(): Promise<string[]> {
    const res = await apiFetch(`${API_BASE}/categories`, {
      credentials: 'include',
    });
    return handleResponse<string[]>(res);
  },

  async getCoupons(): Promise<Coupon[]> {
    const res = await apiFetch(`${API_BASE}/coupons`, {
      credentials: 'include',
    });
    return handleResponse<Coupon[]>(res);
  },

  // Cart & Checkout
  async calculateCart(items: CartItem[], couponCode?: string): Promise<CartCalculation> {
    const res = await apiFetch(`${API_BASE}/cart/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items,
        coupon_code: couponCode || undefined,
      }),
    });
    return handleResponse<CartCalculation>(res);
  },

  async checkout(
    items: CartItem[],
    delivery: DeliveryDetails,
    paymentMethod: string,
    couponCode?: string
  ): Promise<{
    success: boolean;
    order_id: string;
    message: string;
    order_details: {
      order_id: string;
      customer: DeliveryDetails;
      items: any[];
      subtotal: number;
      discount: number;
      delivery_fee: number;
      total: number;
      payment_method: string;
      status: string;
    };
  }> {
    const res = await apiFetch(`${API_BASE}/cart/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items,
        coupon_code: couponCode || undefined,
        delivery,
        payment_method: paymentMethod,
      }),
    });
    return handleResponse(res);
  },

  // Authentication
  async getAuthConfig(): Promise<{ google_client_id: string; google_enabled?: boolean; auth_providers: string[]; providers?: string[] }> {
    const res = await apiFetch(`${API_BASE}/auth/config`, {
      credentials: 'include',
    });
    return handleResponse<{ google_client_id: string; google_enabled?: boolean; auth_providers: string[]; providers?: string[] }>(res);
  },

  async googleLogin(credential: string): Promise<{ success: boolean; user: User; message: string }> {
    const res = await apiFetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });
    return handleResponse(res);
  },

  async checkAuth(): Promise<{ authenticated: boolean; user?: User }> {
    const res = await apiFetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    return handleResponse<{ authenticated: boolean; user?: User }>(res);
  },

  async login(email: string, password: string): Promise<{ success: boolean; user: User; message: string }> {
    const res = await apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; user: User }> {
    const res = await apiFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });
    return handleResponse(res);
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await apiFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getUserOrders(): Promise<Order[]> {
    const res = await apiFetch(`${API_BASE}/auth/orders`, {
      credentials: 'include',
    });
    return handleResponse<Order[]>(res);
  },

  // Seller / Product Management
  async addProduct(product: Partial<Product>): Promise<Product> {
    const res = await apiFetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(product),
    });
    return handleResponse<Product>(res);
  },

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(product),
    });
    return handleResponse<Product>(res);
  },

  async deleteProduct(id: number): Promise<{ success: boolean }> {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async toggleProductStatus(id: number, isActive?: boolean): Promise<Product> {
    const res = await apiFetch(`${API_BASE}/products/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(isActive !== undefined ? { is_active: isActive ? 1 : 0 } : {}),
    });
    return handleResponse<Product>(res);
  },

  // =========================================================================
  // ADMIN CONTROL CENTER SERVICES
  // =========================================================================

  async adminGetOverview(): Promise<AdminOverview> {
    const res = await apiFetch(`${API_BASE}/admin/overview`, { credentials: 'include' });
    return handleResponse<AdminOverview>(res);
  },

  // Customer Management
  async adminGetCustomers(params?: {
    search?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    sort?: string;
  }): Promise<{ customers: Customer[]; count: number }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status) q.append('status', params.status);
    if (params?.date_from) q.append('date_from', params.date_from);
    if (params?.date_to) q.append('date_to', params.date_to);
    if (params?.sort) q.append('sort', params.sort);
    const res = await apiFetch(`${API_BASE}/admin/customers?${q.toString()}`, { credentials: 'include' });
    return handleResponse<{ customers: Customer[]; count: number }>(res);
  },

  async adminGetCustomerDetail(userId: number): Promise<CustomerDetail> {
    const res = await apiFetch(`${API_BASE}/admin/customers/${userId}`, { credentials: 'include' });
    return handleResponse<CustomerDetail>(res);
  },

  async adminUpdateCustomerStatus(
    userId: number,
    status: 'active' | 'deactivated' | 'deleted',
    reason?: string
  ): Promise<{ success: boolean; message: string; customer: Partial<Customer> }> {
    const res = await apiFetch(`${API_BASE}/admin/customers/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, reason: reason || undefined }),
    });
    return handleResponse(res);
  },

  async adminRevokeCustomerSessions(userId: number): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/admin/customers/${userId}/revoke-sessions`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse(res);
  },

  // Login Activity Monitoring
  async adminGetLogins(params?: {
    status?: string;
    type?: string;
    email?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<LoginActivityResponse> {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.type) q.append('type', params.type);
    if (params?.email) q.append('email', params.email);
    if (params?.date_from) q.append('date_from', params.date_from);
    if (params?.date_to) q.append('date_to', params.date_to);
    if (params?.limit) q.append('limit', params.limit.toString());
    const res = await apiFetch(`${API_BASE}/admin/activity/logins?${q.toString()}`, { credentials: 'include' });
    return handleResponse<LoginActivityResponse>(res);
  },

  async adminGetActivity(): Promise<{ activities: AdminActivity[] }> {
    const res = await apiFetch(`${API_BASE}/admin/activity/admin`, { credentials: 'include' });
    return handleResponse<{ activities: AdminActivity[] }>(res);
  },

  // Sales Management
  async adminGetSalesOverview(params?: {
    range?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<SalesOverview> {
    const q = new URLSearchParams();
    if (params?.range) q.append('range', params.range);
    if (params?.start_date) q.append('start_date', params.start_date);
    if (params?.end_date) q.append('end_date', params.end_date);
    const res = await apiFetch(`${API_BASE}/admin/sales/overview?${q.toString()}`, { credentials: 'include' });
    return handleResponse<SalesOverview>(res);
  },

  async adminGetSalesAnalytics(): Promise<SalesAnalytics> {
    const res = await apiFetch(`${API_BASE}/admin/sales/analytics`, { credentials: 'include' });
    return handleResponse<SalesAnalytics>(res);
  },

  async adminGetSalesOrders(params?: {
    search?: string;
    payment_status?: string;
    order_status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{ orders: Order[]; count: number }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.payment_status) q.append('payment_status', params.payment_status);
    if (params?.order_status) q.append('order_status', params.order_status);
    if (params?.date_from) q.append('date_from', params.date_from);
    if (params?.date_to) q.append('date_to', params.date_to);
    const res = await apiFetch(`${API_BASE}/admin/sales/orders?${q.toString()}`, { credentials: 'include' });
    return handleResponse<{ orders: Order[]; count: number }>(res);
  },

  async adminUpdateOrderStatus(
    orderId: string,
    updates: { status?: string; payment_status?: string; refund_amount?: number }
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  adminGetExportUrl(type: 'sales_report' | 'orders' | 'products' | 'customers', range?: string, startDate?: string, endDate?: string): string {
    const q = new URLSearchParams();
    q.append('type', type);
    if (range) q.append('range', range);
    if (startDate) q.append('start_date', startDate);
    if (endDate) q.append('end_date', endDate);
    return `${API_BASE}/admin/sales/export?${q.toString()}`;
  },

  // Inventory & Offers
  async adminGetInventory(): Promise<{ products: Product[] }> {
    const res = await apiFetch(`${API_BASE}/admin/inventory`, { credentials: 'include' });
    return handleResponse<{ products: Product[] }>(res);
  },

  async adminUpdateInventory(productId: number, quantity: number): Promise<{ success: boolean; product_id: number; quantity: number }> {
    const res = await apiFetch(`${API_BASE}/admin/inventory/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ quantity }),
    });
    return handleResponse(res);
  },

  async adminGetOffers(): Promise<{ offers: AdminOffer[] }> {
    const res = await apiFetch(`${API_BASE}/admin/offers`, { credentials: 'include' });
    return handleResponse<{ offers: AdminOffer[] }>(res);
  },

  // Category Hierarchy
  async getCategoryTree(): Promise<CategoryItem[]> {
    const res = await apiFetch(`${API_BASE}/categories/tree`);
    return handleResponse<CategoryItem[]>(res);
  },

  async adminGetCategories(tree?: boolean): Promise<{ categories: CategoryItem[]; flat?: CategoryItem[] }> {
    const q = tree ? '?tree=true' : '';
    const res = await apiFetch(`${API_BASE}/admin/categories${q}`, { credentials: 'include' });
    return handleResponse<{ categories: CategoryItem[]; flat?: CategoryItem[] }>(res);
  },

  async adminCreateCategory(data: Partial<CategoryItem>): Promise<CategoryItem> {
    const res = await apiFetch(`${API_BASE}/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<CategoryItem>(res);
  },

  async adminUpdateCategory(catId: number, data: Partial<CategoryItem>): Promise<CategoryItem> {
    const res = await apiFetch(`${API_BASE}/admin/categories/${catId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<CategoryItem>(res);
  },

  async adminDeleteCategory(catId: number): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/admin/categories/${catId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Dual Image Upload
  async adminUploadImage(file: File): Promise<{ success: boolean; url: string; filename: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch(`${API_BASE}/admin/upload-image`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return handleResponse<{ success: boolean; url: string; filename: string; size: number }>(res);
  },

  // Supplier Management
  async adminGetSuppliers(search?: string, status?: string): Promise<{ suppliers: Supplier[] }> {
    const q = new URLSearchParams();
    if (search) q.append('search', search);
    if (status && status !== 'all') q.append('status', status);
    const query = q.toString() ? `?${q.toString()}` : '';
    const res = await apiFetch(`${API_BASE}/admin/suppliers${query}`, { credentials: 'include' });
    return handleResponse<{ suppliers: Supplier[] }>(res);
  },

  async adminGetSupplierStats(): Promise<SupplierStats> {
    const res = await apiFetch(`${API_BASE}/admin/suppliers/stats`, { credentials: 'include' });
    return handleResponse<SupplierStats>(res);
  },

  async adminGetSupplier(id: number): Promise<Supplier> {
    const res = await apiFetch(`${API_BASE}/admin/suppliers/${id}`, { credentials: 'include' });
    return handleResponse<Supplier>(res);
  },

  async adminCreateSupplier(data: Partial<Supplier>): Promise<Supplier> {
    const res = await apiFetch(`${API_BASE}/admin/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Supplier>(res);
  },

  async adminUpdateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
    const res = await apiFetch(`${API_BASE}/admin/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Supplier>(res);
  },

  async adminDeleteSupplier(id: number): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/admin/suppliers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },
};

// Image resolution helper
export function getProductImage(product: { id: number; image?: string; image_url?: string }): string {
  if (product.image_url && product.image_url.startsWith('http')) {
    return product.image_url;
  }
  if (product.image) {
    return product.image;
  }
  return `/static/images/p${product.id}.svg`;
}

// Category banner image resolution
export const CATEGORY_BANNERS: Record<string, string> = {
  'Electronics': '/banner/Electronics.png',
  'Grocery': '/banner/Grocery.png',
  'Fashion': '/banner/Fashion.png',
  'Home & Kitchen': '/banner/Home-Kitchen.png',
  'Beauty & Personal Care': '/banner/Beauty.png',
  'Books & Stationery': '/banner/Books.png',
  'Sports & Fitness': '/banner/Fitness.png',
  'Toys & Accessories': '/banner/Toys.png',
};
