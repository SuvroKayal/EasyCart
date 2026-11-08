import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  XCircle,
  AlertCircle,
  Package,
  FolderPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import { CategoryItem } from '../../types';
import { useToast } from '../common/Toast';
import { AdminTab } from './AdminLayout';

interface AdminCategoriesProps {
  onNavigate?: (tab: AdminTab) => void;
}

export const AdminCategories: React.FC<AdminCategoriesProps> = () => {
  const [treeCategories, setTreeCategories] = useState<CategoryItem[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const { showToast } = useToast();

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetCategories(true);
      const tree = res.categories || [];
      const flat = res.flat || [];
      setTreeCategories(tree);
      setFlatCategories(flat);

      // Expand root nodes by default
      const initialExpanded: Record<number, boolean> = {};
      tree.forEach((c) => {
        initialExpanded[c.id] = true;
      });
      setExpandedNodes((prev) => ({ ...initialExpanded, ...prev }));
    } catch (err: any) {
      showToast(err.message || 'Failed to load category tree', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allExp: Record<number, boolean> = {};
    flatCategories.forEach((c) => {
      allExp[c.id] = true;
    });
    setExpandedNodes(allExp);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const openAddRootModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormParentId(null);
    setFormDescription('');
    setFormImageUrl('');
    setFormDisplayOrder(0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openAddChildModal = (parent: CategoryItem) => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormParentId(parent.id);
    setFormDescription('');
    setFormImageUrl('');
    setFormDisplayOrder((parent.children?.length || 0) + 1);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormParentId(cat.parent_id);
    setFormDescription(cat.description || '');
    setFormImageUrl(cat.image_url || '');
    setFormDisplayOrder(cat.display_order || 0);
    setFormIsActive(cat.is_active === 1);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingCategory) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: Partial<CategoryItem> = {
        name: formName.trim(),
        slug: formSlug.trim() || undefined,
        parent_id: formParentId,
        description: formDescription.trim(),
        image_url: formImageUrl.trim(),
        display_order: Number(formDisplayOrder),
        is_active: formIsActive ? 1 : 0,
      };

      if (editingCategory) {
        await api.adminUpdateCategory(editingCategory.id, payload);
        showToast(`Category '${payload.name}' updated successfully`, 'success');
      } else {
        await api.adminCreateCategory(payload);
        showToast(`Category '${payload.name}' created successfully`, 'success');
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    try {
      const res = await api.adminDeleteCategory(deletingCategory.id);
      showToast(res.message || `Category '${deletingCategory.name}' deleted`, 'success');
      setDeletingCategory(null);
      loadCategories();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete category', 'error');
    }
  };

  // Render a node in the tree recursively
  const renderCategoryNode = (node: CategoryItem, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];

    // Search filter: check node and descendants
    const matchesSearch =
      search.trim() === '' ||
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.slug.toLowerCase().includes(search.toLowerCase());

    const hasMatchingDescendant = (item: CategoryItem): boolean => {
      if (!item.children || item.children.length === 0) return false;
      return item.children.some(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.slug.toLowerCase().includes(search.toLowerCase()) ||
          hasMatchingDescendant(c)
      );
    };

    if (!matchesSearch && !hasMatchingDescendant(node)) {
      return null;
    }

    const paddingLeft = depth * 24;

    return (
      <div key={node.id} className="group/node">
        <div
          className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all ${
            depth === 0
              ? 'bg-porcelain/50 dark:bg-dark-elevated/40 hover:bg-porcelain dark:hover:bg-dark-elevated font-semibold'
              : 'hover:bg-porcelain/30 dark:hover:bg-dark-elevated/20'
          }`}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          {/* Node Icon & Name */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 rounded-md flex items-center justify-center text-mutedGrey hover:text-espresso dark:hover:text-porcelain transition-colors cursor-pointer shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-bronze/40" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs ${
                    depth === 0
                      ? 'font-serif text-sm font-bold text-espresso dark:text-porcelain'
                      : depth === 1
                      ? 'font-semibold text-espresso/90 dark:text-porcelain/90'
                      : 'text-mutedGrey dark:text-dark-muted'
                  }`}
                >
                  {node.name}
                </span>

                <span className="font-mono text-[10px] text-mutedGrey bg-white dark:bg-dark-surface px-1.5 py-0.5 rounded border border-softBorder dark:border-dark-border">
                  /{node.slug}
                </span>

                {node.is_active === 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200">
                    Draft
                  </span>
                )}
              </div>

              {node.description && (
                <p className="text-[10px] text-mutedGrey dark:text-dark-muted truncate max-w-md mt-0.5">
                  {node.description}
                </p>
              )}
            </div>
          </div>

          {/* Node Meta & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Products Count */}
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-mutedGrey bg-white dark:bg-dark-surface px-2 py-0.5 rounded-lg border border-softBorder dark:border-dark-border"
              title="Assigned products count"
            >
              <Package className="w-3 h-3 text-bronze" />
              <span>{node.product_count ?? 0}</span>
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-80 group-hover/node:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => openAddChildModal(node)}
                className="p-1.5 rounded-lg bg-white dark:bg-dark-surface hover:bg-stone text-mutedGrey hover:text-bronze transition-colors cursor-pointer border border-softBorder dark:border-dark-border"
                title="Add Subcategory under this"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openEditModal(node)}
                className="p-1.5 rounded-lg bg-white dark:bg-dark-surface hover:bg-stone text-mutedGrey hover:text-espresso dark:hover:text-porcelain transition-colors cursor-pointer border border-softBorder dark:border-dark-border"
                title="Edit Category"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingCategory(node)}
                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Delete Category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 mt-1">
            {node.children!.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-espresso dark:text-porcelain flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-bronze" />
            Category Architecture &amp; Hierarchy
          </h1>
          <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1">
            Multi-level parent/child taxonomy: Departments → Subcategories → Nested Subcategories with cycle safeguards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCategories}
            className="p-2.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain hover:bg-porcelain transition-colors shadow-luxury-sm cursor-pointer"
            title="Refresh Categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-bronze' : ''}`} />
          </button>
          <button
            onClick={openAddRootModal}
            className="px-4 py-2.5 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold text-xs shadow-luxury-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Main Department
          </button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
            Root Departments
          </span>
          <div className="text-2xl font-serif font-bold text-espresso dark:text-porcelain mt-1">
            {treeCategories.length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
            Total Categories &amp; Subcategories
          </span>
          <div className="text-2xl font-serif font-bold text-bronze dark:text-bronze-gold mt-1">
            {flatCategories.length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
            Active Status
          </span>
          <div className="text-2xl font-serif font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {flatCategories.filter((c) => c.is_active === 1).length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
            Catalogued Products Linked
          </span>
          <div className="text-2xl font-serif font-bold text-espresso dark:text-porcelain mt-1">
            {flatCategories.reduce((acc, c) => acc + (c.product_count || 0), 0)}
          </div>
        </div>
      </div>

      {/* Search and Tree Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedGrey pointer-events-none" />
          <input
            type="text"
            placeholder="Search hierarchy by category name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze shadow-luxury-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-mutedGrey hover:text-espresso dark:hover:text-porcelain shadow-luxury-sm cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-mutedGrey hover:text-espresso dark:hover:text-porcelain shadow-luxury-sm cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Category Tree Container */}
      <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
        {loading ? (
          <div className="py-16 text-center text-mutedGrey">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-bronze" />
            <p className="text-xs">Loading department hierarchy...</p>
          </div>
        ) : treeCategories.length === 0 ? (
          <div className="py-16 text-center text-mutedGrey">
            <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-serif text-sm font-semibold text-espresso dark:text-porcelain">
              No categories found
            </p>
            <p className="text-xs mt-1">Add your first root department to begin building your catalog taxonomy.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {treeCategories.map((rootNode) => renderCategoryNode(rootNode, 0))}
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-softBorder dark:border-dark-border">
              <h3 className="font-serif text-lg font-bold text-espresso dark:text-porcelain flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-bronze" />
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-porcelain dark:bg-dark-elevated text-mutedGrey hover:text-espresso dark:hover:text-porcelain cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Parent Category / Department
                </label>
                <select
                  value={formParentId ?? ''}
                  onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                >
                  <option value="">None (Top-Level Root Department)</option>
                  {flatCategories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent_name ? `${c.parent_name} → ${c.name}` : c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-mutedGrey mt-1">
                  Leave as "None" for main shopping departments, or select a parent to create a subcategory.
                </p>
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mechanical Watches or Smartphones"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  URL Slug (Auto-generated or custom)
                </label>
                <input
                  type="text"
                  placeholder="e.g. mechanical-watches"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Description / Merchandising Tagline
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Precision acoustics, minimalist desk setups & flagship mobile technology."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Banner / Image Asset URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. /banner/Electronics.png or https://images.unsplash.com/..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  />
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Visibility Status
                  </label>
                  <select
                    value={formIsActive ? '1' : '0'}
                    onChange={(e) => setFormIsActive(e.target.value === '1')}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  >
                    <option value="1">Active (Visible)</option>
                    <option value="0">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

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
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-espresso dark:text-porcelain">
                Delete Category?
              </h3>
              <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-espresso dark:text-porcelain">"{deletingCategory.name}"</span>? Deletion will be rejected if it contains active subcategories or assigned products.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingCategory(null)}
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
