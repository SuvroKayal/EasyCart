export interface Product {
  id: number;
  name: string;
  title?: string;
  category: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  nested_category_id?: number | null;
  sku?: string;
  supplier_id?: number | null;
  supplier_name?: string;
  price: number;
  original_price?: number;
  quantity: number;
  rating?: number | { rate: number; count: number };
  rating_count?: number;
  image?: string;
  image_url?: string;
  gallery_images?: string[];
  description?: string;
  is_active?: number | boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  status?: string;
  created_at?: string;
  last_login?: string;
  google_id?: string;
  avatar_url?: string;
  auth_provider?: string;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  value: number;
  min_order: number;
  max_discount: number;
  description: string;
}

export interface CartItem {
  id: number;
  quantity: number;
}

export interface VerifiedCartItem {
  id: number;
  name: string;
  category: string;
  price: number;
  original_price?: number;
  image?: string;
  image_url?: string;
  quantity: number;
  max_stock: number;
  total: number;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  type: string;
  description: string;
}

export interface CartCalculation {
  items: VerifiedCartItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  free_delivery_threshold: number;
  applied_coupon: AppliedCoupon | null;
  coupon_message?: string;
  stock_errors: string[];
}

export interface DeliveryDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
}

export interface OrderItem {
  id: number;
  order_id?: string;
  product_id: number;
  product_name: string;
  title?: string;
  unit_price: number;
  price?: number;
  quantity: number;
  total_price: number;
}

export interface Order {
  id: string;
  order_id?: string;
  user_id?: number | null;
  customer_name: string;
  customer_email: string;
  email?: string;
  customer_phone?: string;
  address?: string;
  shipping_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  shipping?: number;
  total: number;
  net_total?: number;
  coupon_code?: string | null;
  payment_method: string;
  payment_status?: string;
  refund_amount?: number;
  status: string;
  created_at: string;
  date?: string;
  items: OrderItem[];
}

export interface ProductFilters {
  category?: string;
  category_id?: number;
  subcategory_id?: number;
  search?: string;
  sort?: string;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
  include_inactive?: boolean;
}

// --- Admin Domain Types ---

export interface Customer {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'deactivated' | 'deleted';
  created_at: string;
  last_login?: string;
  total_orders: number;
  total_spending: number;
}

export interface CustomerDetail {
  customer: Customer;
  stats: {
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    total_spent: number;
    average_order_value: number;
    last_purchase_date?: string;
  };
  orders: Order[];
  status_history: Array<{
    id: number;
    previous_status: string;
    new_status: string;
    changed_by_admin_id: number;
    admin_name?: string;
    reason: string;
    created_at: string;
  }>;
}

export interface LoginEvent {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  email: string;
  event_type: string;
  success: number;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface LoginActivityResponse {
  logins: LoginEvent[];
  stats: {
    total_events: number;
    successful_logins: number;
    failed_logins: number;
    repeated_failed_attempts: number;
    repeated_failures: Array<{ email: string; failed_count: number; last_attempt: string }>;
  };
}

export interface SalesOverview {
  gross_sales: number;
  total_discounts: number;
  total_refunds: number;
  net_revenue: number;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  total_units_sold: number;
  date_range: string;
}

export interface SalesAnalytics {
  daily_revenue: Array<{ date: string; order_count: number; revenue: number }>;
  best_selling: Array<{ product_id: number; product_name: string; units_sold: number; total_revenue: number; category: string }>;
  least_selling: Array<{ product_id: number; product_name: string; category: string; current_stock: number; units_sold: number }>;
  category_performance: Array<{ category: string; orders_count: number; units_sold: number; revenue: number }>;
}

export interface AdminActivity {
  id: number;
  admin_id: number;
  admin_name?: string;
  admin_email: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

export interface AdminOverview {
  total_customers: number;
  active_customers: number;
  total_orders: number;
  net_revenue: number;
  low_stock_count: number;
  today_logins: number;
  recent_activity: AdminActivity[];
  metrics?: {
    total_sales: number;
    net_sales: number;
    total_orders: number;
    paid_orders: number;
    total_customers: number;
    active_customers: number;
    total_products: number;
    low_stock_count: number;
    today_logins: number;
    recent_failed_logins: number;
  };
  low_stock_items?: Array<{
    id: number;
    title: string;
    category: string;
    price: number;
    quantity: number;
    image_url?: string;
  }>;
}

export interface AdminOffer {
  code: string;
  type: string;
  value: number;
  min_order: number;
  min_purchase?: number;
  max_discount: number;
  description: string;
  total_uses: number;
  usage_count?: number;
  status?: string;
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  parent_name?: string | null;
  description?: string;
  image_url?: string;
  display_order: number;
  is_active: number;
  product_count?: number;
  created_at?: string;
  children?: CategoryItem[];
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  supplied_categories?: string;
  status: 'active' | 'inactive';
  notes?: string;
  product_count?: number;
  created_at?: string;
  products?: Array<{
    id: number;
    name: string;
    sku?: string;
    price: number;
    quantity: number;
    category: string;
    image?: string;
    image_url?: string;
  }>;
}

export interface SupplierStats {
  total_suppliers: number;
  active_suppliers: number;
  inactive_suppliers: number;
  total_products_supplied: number;
  categories_covered: string[];
}
