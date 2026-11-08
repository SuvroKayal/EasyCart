import React, { useEffect, useState, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  Trash2,
  Edit2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  Star,
  Layers,
  Truck,
  Hash,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api, CATEGORY_BANNERS } from '../../services/api';
import { Product, CategoryItem, Supplier } from '../../types';
import { useToast } from '../common/Toast';

export const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('');
  const [formSubcategoryId, setFormSubcategoryId] = useState<number | ''>('');
  const [formNestedCategoryId, setFormNestedCategoryId] = useState<number | ''>('');
  const [formCategoryText, setFormCategoryText] = useState('Electronics');
  const [formSku, setFormSku] = useState('');
  const [formSupplierId, setFormSupplierId] = useState<number | ''>('');
  const [formPrice, setFormPrice] = useState<number>(999);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number>(1299);
  const [formQuantity, setFormQuantity] = useState<number>(20);
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  
  // Dual Image State
  const [imageMethod, setImageMethod] = useState<'url' | 'upload'>('url');
  const [primaryImageUrl, setPrimaryImageUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodsRes, catTreeRes, supRes] = await Promise.all([
        api.getProducts({ include_inactive: true }),
        api.getCategoryTree(),
        api.adminGetSuppliers(),
      ]);
      setProducts(Array.isArray(prodsRes) ? prodsRes : []);
      setCategories(catTreeRes || []);
      setSuppliers(supRes.suppliers || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load catalog data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Level 1 Root Categories
  const rootCategories = categories.filter((c) => !c.parent_id);

  // Level 2 Subcategories based on selected Level 1
  const subcategories = formCategoryId
    ? categories.find((c) => c.id === formCategoryId)?.children || []
    : [];

  // Level 3 Nested Categories based on selected Level 2
  const nestedCategories = formSubcategoryId
    ? subcategories.find((c) => c.id === formSubcategoryId)?.children || []
    : [];

  const handleMainCategoryChange = (catId: number | '') => {
    setFormCategoryId(catId);
    setFormSubcategoryId('');
    setFormNestedCategoryId('');
    if (catId) {
      const match = categories.find((c) => c.id === catId);
      if (match) {
        setFormCategoryText(match.name);
        if (!primaryImageUrl) {
          setPrimaryImageUrl(match.image_url || CATEGORY_BANNERS[match.name] || '/banner/Electronics.png');
        }
      }
    }
  };

  const handleSubcategoryChange = (subId: number | '') => {
    setFormSubcategoryId(subId);
    setFormNestedCategoryId('');
  };

  const generateSku = () => {
    const catCode = formCategoryText.slice(0, 3).toUpperCase();
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const newSku = `EC-${catCode}-${randPart}`;
    setFormSku(newSku);
    showToast(`Generated SKU: ${newSku}`, 'info');
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategoryId(rootCategories[0]?.id || '');
    setFormCategoryText(rootCategories[0]?.name || 'Electronics');
    setFormSubcategoryId('');
    setFormNestedCategoryId('');
    setFormSku(`EC-ELE-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormSupplierId(suppliers[0]?.id || '');
    setFormPrice(999);
    setFormOriginalPrice(1299);
    setFormQuantity(25);
    setFormDescription('Authentic craftsmanship with standard brand manufacturer warranty.');
    setPrimaryImageUrl(CATEGORY_BANNERS['Electronics'] || '/banner/Electronics.png');
    setGalleryImages([]);
    setImageMethod('url');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name || p.title || '');
    setFormCategoryText(p.category || 'Electronics');
    setFormCategoryId(p.category_id || '');
    setFormSubcategoryId(p.subcategory_id || '');
    setFormNestedCategoryId(p.nested_category_id || '');
    setFormSku(p.sku || `EC-PROD-${p.id}`);
    setFormSupplierId(p.supplier_id || '');
    setFormPrice(p.price);
    setFormOriginalPrice(p.original_price || p.price * 1.25);
    setFormQuantity(p.quantity);
    setFormDescription(p.description || '');
    setPrimaryImageUrl(p.image_url || p.image || '/banner/Electronics.png');
    setGalleryImages(Array.isArray(p.gallery_images) ? p.gallery_images : []);
    setImageMethod('url');
    setFormIsActive(p.is_active !== 0 && p.is_active !== false);
    setIsModalOpen(true);
  };

  // Image Upload handler for Primary Image
  const handlePrimaryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await api.adminUploadImage(file);
      setPrimaryImageUrl(res.url);
      showToast('Image uploaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Image Upload handler for Gallery Images
  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await api.adminUploadImage(file);
      setGalleryImages((prev) => [...prev, res.url]);
      showToast('Gallery image added!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gallery upload failed', 'error');
    } finally {
      setUploadingImage(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const addGalleryUrl = () => {
    if (!newGalleryUrl.trim()) return;
    setGalleryImages((prev) => [...prev, newGalleryUrl.trim()]);
    setNewGalleryUrl('');
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const makePrimaryImage = (url: string, index: number) => {
    const oldPrimary = primaryImageUrl;
    setPrimaryImageUrl(url);
    setGalleryImages((prev) => {
      const updated = [...prev];
      updated[index] = oldPrimary;
      return updated;
    });
    showToast('Primary image updated', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Product title is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: Partial<Product> = {
        name: formName.trim(),
        title: formName.trim(),
        category: formCategoryText,
        category_id: formCategoryId ? Number(formCategoryId) : null,
        subcategory_id: formSubcategoryId ? Number(formSubcategoryId) : null,
        nested_category_id: formNestedCategoryId ? Number(formNestedCategoryId) : null,
        sku: formSku.trim() || undefined,
        supplier_id: formSupplierId ? Number(formSupplierId) : null,
        price: Number(formPrice),
        original_price: Number(formOriginalPrice),
        quantity: Number(formQuantity),
        description: formDescription.trim(),
        image_url: primaryImageUrl,
        image: primaryImageUrl,
        gallery_images: galleryImages,
        is_active: formIsActive ? 1 : 0,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showToast(`Product '${payload.name}' updated successfully!`, 'success');
      } else {
        await api.addProduct(payload);
        showToast(`Product '${payload.name}' created successfully!`, 'success');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    try {
      const currentActive = p.is_active !== 0 && p.is_active !== false;
      await api.toggleProductStatus(p.id, !currentActive);
      showToast(`Product '${p.name || p.title}' ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update product status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      await api.deleteProduct(deletingProduct.id);
      showToast(`Product '${deletingProduct.name || deletingProduct.title}' deleted`, 'success');
      setDeletingProduct(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      (p.name || p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'All' || p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-espresso dark:text-porcelain flex items-center gap-2">
            <Package className="w-6 h-6 text-bronze" />
            Product Catalogue &amp; SKU Management
          </h1>
          <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1">
            Manage comprehensive product items with cascading categories, unique SKUs, supplier linkages, and dual-mode gallery assets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain hover:bg-porcelain transition-colors shadow-luxury-sm cursor-pointer"
            title="Refresh Products"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-bronze' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold text-xs shadow-luxury-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedGrey pointer-events-none" />
          <input
            type="text"
            placeholder="Search by product title, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze shadow-luxury-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-mutedGrey font-medium">Department:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze shadow-luxury-sm cursor-pointer"
          >
            <option value="All">All Departments ({products.length})</option>
            {Object.keys(CATEGORY_BANNERS).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-espresso dark:text-porcelain">
            <thead className="bg-porcelain/60 dark:bg-dark-elevated border-b border-softBorder dark:border-dark-border text-[11px] font-semibold text-mutedGrey uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item &amp; SKU</th>
                <th className="py-3 px-4">Department / Subcategory</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">Price (₹)</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Gallery</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-softBorder dark:divide-dark-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-mutedGrey">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-bronze" />
                    <span>Loading catalog items...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-mutedGrey">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-mutedGrey" />
                    <p className="font-medium">No products match your criteria.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const supplierObj = suppliers.find((s) => s.id === p.supplier_id);
                  const galleryCount = (Array.isArray(p.gallery_images) ? p.gallery_images.length : 0) + 1;

                  return (
                    <tr key={p.id} className="hover:bg-porcelain/30 dark:hover:bg-dark-elevated/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image_url || p.image || '/banner/Electronics.png'}
                            alt={p.name || p.title || 'Product'}
                            className="w-10 h-10 object-cover rounded-lg border border-softBorder dark:border-dark-border shrink-0 bg-white"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                            }}
                          />
                          <div>
                            <div className="font-serif font-bold text-xs text-espresso dark:text-porcelain line-clamp-1 max-w-xs">
                              {p.name || p.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-mutedGrey bg-porcelain dark:bg-dark-elevated px-1.5 py-0.2 rounded border border-softBorder dark:border-dark-border">
                                {p.sku || `SKU-${p.id}`}
                              </span>
                              <span className="text-[10px] text-mutedGrey font-mono">#{p.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-porcelain dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-[11px] font-medium text-espresso dark:text-porcelain">
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-mutedGrey dark:text-dark-muted">
                        {supplierObj ? (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-espresso dark:text-porcelain">
                            <Truck className="w-3 h-3 text-bronze shrink-0" />
                            <span className="truncate max-w-[120px]">{supplierObj.name}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-mutedGrey/60 italic">Direct Sourcing</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-serif font-bold text-xs text-espresso dark:text-porcelain">
                          ₹{p.price.toLocaleString('en-IN')}
                        </div>
                        {p.original_price && p.original_price > p.price && (
                          <div className="text-[10px] text-mutedGrey line-through">
                            ₹{p.original_price.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                            p.quantity <= 5
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                              : p.quantity <= 15
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-porcelain dark:bg-dark-elevated text-espresso dark:text-porcelain'
                          }`}
                        >
                          {p.quantity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${
                            p.is_active !== 0 && p.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
                          }`}
                          title="Click to toggle active status on public storefront"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.is_active !== 0 && p.is_active !== false ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>{p.is_active !== 0 && p.is_active !== false ? 'Active' : 'Deactivated'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-mutedGrey bg-porcelain dark:bg-dark-elevated px-2 py-0.5 rounded border border-softBorder dark:border-dark-border">
                          <ImageIcon className="w-3 h-3 text-bronze" />
                          <span>{galleryCount}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              p.is_active !== 0 && p.is_active !== false
                                ? 'bg-porcelain dark:bg-dark-elevated text-mutedGrey hover:text-amber-600'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 hover:text-emerald-600'
                            }`}
                            title={p.is_active !== 0 && p.is_active !== false ? 'Deactivate Product' : 'Activate Product'}
                          >
                            {p.is_active !== 0 && p.is_active !== false ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-porcelain dark:bg-dark-elevated hover:bg-stone text-mutedGrey hover:text-bronze transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-softBorder dark:border-dark-border">
              <h3 className="font-serif text-lg font-bold text-espresso dark:text-porcelain flex items-center gap-2">
                <Package className="w-5 h-5 text-bronze" />
                {editingProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-porcelain dark:bg-dark-elevated text-mutedGrey hover:text-espresso dark:hover:text-porcelain cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs">
              {/* Product Title */}
              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony WH-1000XM5 Noise Canceling Wireless Headphones"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              {/* Dynamic Cascading Category Selectors */}
              <div className="p-3.5 rounded-2xl bg-porcelain/30 dark:bg-dark-elevated/30 border border-softBorder dark:border-dark-border space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-bronze flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Cascading Category Hierarchy
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Level 1: Root Department */}
                  <div>
                    <label className="block text-[11px] font-semibold text-espresso dark:text-porcelain mb-1">
                      1. Main Department *
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => handleMainCategoryChange(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain text-xs focus:outline-none focus:border-bronze cursor-pointer"
                    >
                      <option value="">Select Department</option>
                      {rootCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Level 2: Subcategory */}
                  <div>
                    <label className="block text-[11px] font-semibold text-espresso dark:text-porcelain mb-1">
                      2. Subcategory
                    </label>
                    <select
                      value={formSubcategoryId}
                      disabled={subcategories.length === 0}
                      onChange={(e) => handleSubcategoryChange(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain text-xs focus:outline-none focus:border-bronze disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">None / Direct</option>
                      {subcategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Level 3: Nested Subcategory */}
                  <div>
                    <label className="block text-[11px] font-semibold text-espresso dark:text-porcelain mb-1">
                      3. Nested Group
                    </label>
                    <select
                      value={formNestedCategoryId}
                      disabled={nestedCategories.length === 0}
                      onChange={(e) => setFormNestedCategoryId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain text-xs focus:outline-none focus:border-bronze disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">None / Leaf</option>
                      {nestedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SKU & Supplier Association */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-espresso dark:text-porcelain">
                      Stock Keeping Unit (SKU)
                    </label>
                    <button
                      type="button"
                      onClick={generateSku}
                      className="text-[10px] text-bronze hover:underline font-semibold cursor-pointer"
                    >
                      Auto-generate
                    </button>
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mutedGrey pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. EC-ELE-8492"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain font-mono text-[11px] focus:outline-none focus:border-bronze"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Assigned Supplier / Vendor
                  </label>
                  <select
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze cursor-pointer"
                  >
                    <option value="">Direct Internal Sourcing</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.contact_person || 'Active'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Stock Quantity */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Sale Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  />
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Original Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formOriginalPrice}
                    onChange={(e) => setFormOriginalPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  />
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Inventory Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  />
                </div>
              </div>

              {/* Dual Image Input Section */}
              <div className="p-3.5 rounded-2xl bg-porcelain/30 dark:bg-dark-elevated/30 border border-softBorder dark:border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-bronze flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Primary Product Image (Method 1: URL / Method 2: Computer Upload)
                  </span>

                  <div className="flex items-center gap-1 bg-white dark:bg-dark-surface p-0.5 rounded-lg border border-softBorder dark:border-dark-border">
                    <button
                      type="button"
                      onClick={() => setImageMethod('url')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        imageMethod === 'url' ? 'bg-espresso text-white' : 'text-mutedGrey'
                      }`}
                    >
                      Image URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMethod('upload')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        imageMethod === 'upload' ? 'bg-espresso text-white' : 'text-mutedGrey'
                      }`}
                    >
                      Computer Upload
                    </button>
                  </div>
                </div>

                {imageMethod === 'url' ? (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mutedGrey pointer-events-none" />
                      <input
                        type="text"
                        placeholder="e.g. /banner/Electronics.png or https://..."
                        value={primaryImageUrl}
                        onChange={(e) => setPrimaryImageUrl(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain text-xs focus:outline-none focus:border-bronze"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handlePrimaryFileUpload}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-softBorder dark:border-dark-border rounded-xl p-4 text-center cursor-pointer hover:border-bronze transition-colors bg-white/50 dark:bg-dark-surface/50"
                    >
                      <Upload className="w-5 h-5 mx-auto text-bronze mb-1" />
                      <p className="font-semibold text-xs text-espresso dark:text-porcelain">
                        {uploadingImage ? 'Uploading image...' : 'Click to browse or drop product photo (JPG, PNG, WebP)'}
                      </p>
                      <p className="text-[10px] text-mutedGrey mt-0.5">Maximum file size: 5MB</p>
                    </div>
                  </div>
                )}

                {/* Primary Image Preview */}
                {primaryImageUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={primaryImageUrl}
                      alt="Primary Preview"
                      className="w-14 h-14 object-cover rounded-xl border border-softBorder dark:border-dark-border bg-white"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                      }}
                    />
                    <div className="text-[11px] text-mutedGrey">
                      <div className="font-bold text-espresso dark:text-porcelain flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Primary Display Cover
                      </div>
                      <div className="truncate max-w-sm font-mono text-[10px]">{primaryImageUrl}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gallery Images Manager */}
              <div className="p-3.5 rounded-2xl bg-porcelain/30 dark:bg-dark-elevated/30 border border-softBorder dark:border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-bronze flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gallery Images ({galleryImages.length})
                  </span>

                  <div>
                    <input
                      type="file"
                      ref={galleryFileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleGalleryFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => galleryFileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-[10px] font-semibold text-espresso dark:text-porcelain hover:text-bronze flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-bronze" />
                      Upload to Gallery
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Or paste gallery image URL..."
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain text-xs focus:outline-none focus:border-bronze"
                  />
                  <button
                    type="button"
                    onClick={addGalleryUrl}
                    className="px-3 py-1.5 rounded-xl bg-espresso hover:bg-bronze text-white text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {galleryImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-softBorder dark:border-dark-border bg-white h-20"
                      >
                        <img
                          src={imgUrl}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                          }}
                        />
                        <div className="absolute inset-0 bg-espresso/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                          <button
                            type="button"
                            onClick={() => makePrimaryImage(imgUrl, idx)}
                            className="p-1 rounded bg-white/20 text-white hover:bg-bronze transition-colors"
                            title="Make Primary Cover"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(idx)}
                            className="p-1 rounded bg-rose-600/80 text-white hover:bg-rose-700 transition-colors"
                            title="Remove from gallery"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Product Description &amp; Specifications
                </label>
                <textarea
                  rows={3}
                  placeholder="Comprehensive item specification, materials, warranty, package inclusions..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze resize-none"
                />
              </div>

              {/* Product Storefront Status / Visibility */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-porcelain/60 dark:bg-dark-elevated border border-softBorder dark:border-dark-border">
                <div>
                  <span className="block font-bold text-xs text-espresso dark:text-porcelain">
                    Storefront Visibility
                  </span>
                  <span className="block text-[11px] text-mutedGrey dark:text-dark-muted mt-0.5">
                    {formIsActive
                      ? 'Live on storefront: visible to all shoppers in Our Collection'
                      : 'Deactivated: hidden from storefront while preserving database records'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    formIsActive
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm'
                      : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700 shadow-sm'
                  }`}
                >
                  {formIsActive ? 'Active' : 'Deactivated'}
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-softBorder dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-light/60 dark:bg-dark-elevated hover:bg-stone text-espresso dark:text-porcelain font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold transition-all cursor-pointer shadow-luxury-sm"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-espresso dark:text-porcelain">
                Delete Product?
              </h3>
              <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-espresso dark:text-porcelain">"{deletingProduct.name || deletingProduct.title}"</span>? This will permanently remove the item from the live storefront catalog.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 rounded-xl bg-stone-light/60 dark:bg-dark-elevated hover:bg-stone text-espresso dark:text-porcelain font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-luxury-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
