import React, { useEffect, useState } from 'react';
import {
  Layers,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { Product } from '../../types';
import { useToast } from '../common/Toast';

export const AdminInventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingQuantities, setEditingQuantities] = useState<Record<number, number>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const { showToast } = useToast();

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetInventory();
      setProducts(res.products || []);
      const initialMap: Record<number, number> = {};
      (res.products || []).forEach((p) => {
        initialMap[p.id] = p.quantity;
      });
      setEditingQuantities(initialMap);
    } catch {
      showToast('Failed to load inventory records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleQuantityChange = (id: number, val: number) => {
    setEditingQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, val),
    }));
  };

  const handleSaveQuantity = async (id: number) => {
    const newQty = editingQuantities[id];
    if (newQty === undefined) return;
    try {
      setSavingId(id);
      await api.adminUpdateInventory(id, newQty);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p))
      );
      showToast('Inventory quantity updated successfully', 'success');
    } catch {
      showToast('Failed to update inventory', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Filter products
  const categories = Array.from(new Set(products.map((p) => p.category)));

  const filteredProducts = products.filter((p) => {
    const prodName = p.name || p.title || '';
    const matchesSearch =
      prodName.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toString() === search;

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    let matchesStatus = true;
    if (statusFilter === 'in_stock') matchesStatus = p.quantity > 10;
    if (statusFilter === 'low_stock') matchesStatus = p.quantity > 0 && p.quantity <= 10;
    if (statusFilter === 'out_of_stock') matchesStatus = p.quantity === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= 10).length;
  const outOfStockCount = products.filter((p) => p.quantity === 0).length;
  const healthyStockCount = products.filter((p) => p.quantity > 10).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-crystal-royal" />
            Inventory & Stock Control
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time stock monitoring across all {products.length} products in SQLite database.
          </p>
        </div>

        <button
          onClick={fetchInventory}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center gap-2 shadow-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stock
        </button>
      </div>

      {/* Stock Health Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setStatusFilter(statusFilter === 'in_stock' ? 'all' : 'in_stock')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'in_stock'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-crystal-navyCard/90 border-slate-200 dark:border-white/10 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              In Healthy Stock (&gt;10)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {healthyStockCount} <span className="text-xs font-normal text-slate-400">items</span>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'low_stock' ? 'all' : 'low_stock')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'low_stock'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-crystal-navyCard/90 border-slate-200 dark:border-white/10 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Low Stock Alert (1-10)
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {lowStockCount} <span className="text-xs font-normal text-slate-400">items</span>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'out_of_stock'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-white dark:bg-crystal-navyCard/90 border-slate-200 dark:border-white/10 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Out of Stock (0)
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {outOfStockCount} <span className="text-xs font-normal text-slate-400">items</span>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, category or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-crystal-royal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crystal-royal"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-crystal-royal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading inventory items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm">
            No products match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product ID</th>
                  <th className="py-3 px-4">Item Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Stock Quantity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-200 font-medium">
                {filteredProducts.map((p) => {
                  const currentQty = editingQuantities[p.id] ?? p.quantity;
                  const isModified = currentQty !== p.quantity;
                  const isSaving = savingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">#{p.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 p-1 flex items-center justify-center shrink-0">
                            <img
                              src={p.image_url || `/static/images/p${p.id}.svg`}
                              alt={p.name || p.title || 'Product'}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {p.name || p.title}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Rating: {typeof p.rating === 'number' ? p.rating : (p.rating as any)?.rate || 4.5} ({p.rating_count || 50} reviews)
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{p.price.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        {p.quantity === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3 h-3" />
                            Out of Stock
                          </span>
                        ) : p.quantity <= 10 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleQuantityChange(p.id, currentQty - 1)}
                            className="p-1 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentQty}
                            onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center font-bold text-xs rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-crystal-navy text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-crystal-royal"
                          />
                          <button
                            onClick={() => handleQuantityChange(p.id, currentQty + 1)}
                            className="p-1 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSaveQuantity(p.id)}
                          disabled={!isModified || isSaving}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                            isModified
                              ? 'bg-crystal-royal hover:bg-blue-600 text-white shadow-sm shadow-crystal-royal/30'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Save className="w-3 h-3" />
                          {isSaving ? 'Saving...' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
