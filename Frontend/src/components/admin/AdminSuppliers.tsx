import React, { useEffect, useState } from 'react';
import {
  Truck,
  Search,
  Plus,
  Trash2,
  Edit2,
  XCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  Package,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Supplier, SupplierStats } from '../../types';
import { useToast } from '../common/Toast';

export const AdminSuppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<Supplier | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCategories, setFormCategories] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppRes, statsRes] = await Promise.all([
        api.adminGetSuppliers(search, statusFilter),
        api.adminGetSupplierStats(),
      ]);
      setSuppliers(suppRes.suppliers || []);
      setStats(statsRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCategories('');
    setFormStatus('active');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContactPerson(sup.contact_person || '');
    setFormPhone(sup.phone || '');
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormCategories(sup.supplied_categories || '');
    setFormStatus(sup.status || 'active');
    setFormNotes(sup.notes || '');
    setIsModalOpen(true);
  };

  const openDetailModal = async (sup: Supplier) => {
    try {
      setDetailLoading(true);
      const detailed = await api.adminGetSupplier(sup.id);
      setSelectedSupplierDetail(detailed);
    } catch (err: any) {
      showToast('Failed to load supplier details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Supplier name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload: Partial<Supplier> = {
        name: formName.trim(),
        contact_person: formContactPerson.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        supplied_categories: formCategories.trim(),
        status: formStatus,
        notes: formNotes.trim(),
      };

      if (editingSupplier) {
        await api.adminUpdateSupplier(editingSupplier.id, payload);
        showToast(`Supplier '${payload.name}' updated successfully`, 'success');
      } else {
        await api.adminCreateSupplier(payload);
        showToast(`Supplier '${payload.name}' added successfully`, 'success');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save supplier', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    try {
      await api.adminDeleteSupplier(deletingSupplier.id);
      showToast(`Supplier '${deletingSupplier.name}' removed`, 'success');
      setDeletingSupplier(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete supplier', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-espresso dark:text-porcelain flex items-center gap-2">
            <Truck className="w-6 h-6 text-bronze" />
            Supplier Network &amp; Logistics
          </h1>
          <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1">
            Manage certified procurement vendors, supply channels, contact details, and product catalog linkages.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain hover:bg-porcelain dark:hover:bg-dark-elevated transition-colors shadow-luxury-sm cursor-pointer"
            title="Refresh Suppliers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-bronze' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold text-xs shadow-luxury-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Supplier
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
              Total Suppliers
            </span>
            <div className="text-2xl font-serif font-bold text-espresso dark:text-porcelain mt-1">
              {stats.total_suppliers}
            </div>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted mt-1">
              Registered procurement partners
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
              Active Suppliers
            </span>
            <div className="text-2xl font-serif font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.active_suppliers}
            </div>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted mt-1">
              Fully operational channels
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
              Inactive Suppliers
            </span>
            <div className="text-2xl font-serif font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stats.inactive_suppliers}
            </div>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted mt-1">
              Temporarily suspended
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mutedGrey">
              Supplied Products
            </span>
            <div className="text-2xl font-serif font-bold text-bronze dark:text-bronze-gold mt-1">
              {stats.total_products_supplied}
            </div>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted mt-1">
              Active catalog items covered
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedGrey pointer-events-none" />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20 transition-all shadow-luxury-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-mutedGrey font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze shadow-luxury-sm cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-espresso dark:text-porcelain">
            <thead className="bg-porcelain/60 dark:bg-dark-elevated border-b border-softBorder dark:border-dark-border text-[11px] font-semibold text-mutedGrey uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Contact Information</th>
                <th className="py-3 px-4">Category Channels</th>
                <th className="py-3 px-4 text-center">Products</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-softBorder dark:divide-dark-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-mutedGrey">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-bronze" />
                    <span>Loading suppliers...</span>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-mutedGrey">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-mutedGrey" />
                    <p className="font-medium">No suppliers found.</p>
                    <p className="text-[11px] mt-1">Try adjusting search parameters or add a new supplier.</p>
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-porcelain/30 dark:hover:bg-dark-elevated/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-espresso dark:text-porcelain">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-bronze/10 text-bronze flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-serif font-bold text-sm">{sup.name}</div>
                          {sup.notes && (
                            <div className="text-[10px] text-mutedGrey line-clamp-1 max-w-xs">{sup.notes}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-mutedGrey dark:text-dark-muted">
                      {sup.contact_person || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1 text-[11px]">
                        {sup.phone && (
                          <div className="flex items-center gap-1.5 text-mutedGrey dark:text-dark-muted">
                            <Phone className="w-3 h-3 text-bronze" />
                            <span>{sup.phone}</span>
                          </div>
                        )}
                        {sup.email && (
                          <div className="flex items-center gap-1.5 text-mutedGrey dark:text-dark-muted">
                            <Mail className="w-3 h-3 text-bronze" />
                            <span>{sup.email}</span>
                          </div>
                        )}
                        {sup.address && (
                          <div className="flex items-center gap-1.5 text-mutedGrey dark:text-dark-muted text-[10px] line-clamp-1 max-w-xs">
                            <MapPin className="w-3 h-3 text-bronze shrink-0" />
                            <span className="truncate">{sup.address}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {sup.supplied_categories ? (
                          sup.supplied_categories.split(',').map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-porcelain dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-[10px] font-medium text-espresso dark:text-porcelain"
                            >
                              {c.replace(/[\[\]"']/g, '').trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-mutedGrey text-[11px]">All Categories</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openDetailModal(sup)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bronze/10 text-bronze dark:text-bronze-gold hover:bg-bronze/20 text-xs font-bold transition-colors cursor-pointer"
                        title="View Associated Products"
                      >
                        <Package className="w-3 h-3" />
                        <span>{sup.product_count ?? 0}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          sup.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {sup.status === 'active' ? (
                          <>
                            <CheckCircle className="w-2.5 h-2.5" /> Active
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-2.5 h-2.5" /> Inactive
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetailModal(sup)}
                          className="p-1.5 rounded-lg bg-porcelain dark:bg-dark-elevated hover:bg-stone text-mutedGrey hover:text-espresso dark:hover:text-porcelain transition-colors cursor-pointer"
                          title="View Products"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(sup)}
                          className="p-1.5 rounded-lg bg-porcelain dark:bg-dark-elevated hover:bg-stone text-mutedGrey hover:text-bronze transition-colors cursor-pointer"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingSupplier(sup)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Delete Supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-softBorder dark:border-dark-border">
              <h3 className="font-serif text-lg font-bold text-espresso dark:text-porcelain flex items-center gap-2">
                <Building2 className="w-5 h-5 text-bronze" />
                {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
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
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Tech Global Ltd"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Sharma"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                  />
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. vendor@supply.in"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                  />
                </div>

                <div>
                  <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain focus:outline-none focus:border-bronze"
                  >
                    <option value="active">Active (Procuring)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Physical Office / Warehouse Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 402, Trade Hub, Electronic City, Bengaluru 560100"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Supplied Categories (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electronics, Gadgets, Audio"
                  value={formCategories}
                  onChange={(e) => setFormCategories(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                />
              </div>

              <div>
                <label className="block font-bold text-espresso dark:text-porcelain mb-1">
                  Internal Notes &amp; Lead Time SLAs
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Net 30 payment terms, 24-hour stock replenishment SLA."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-porcelain/40 dark:bg-dark-elevated border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze resize-none"
                />
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
                  {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Products Detail Modal */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-softBorder dark:border-dark-border shrink-0">
              <div>
                <h3 className="font-serif text-lg font-bold text-espresso dark:text-porcelain flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-bronze" />
                  {selectedSupplierDetail.name} — Supplied Products
                </h3>
                <p className="text-xs text-mutedGrey dark:text-dark-muted mt-0.5">
                  {selectedSupplierDetail.product_count} active product(s) linked to this supplier.
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="p-1.5 rounded-xl bg-porcelain dark:bg-dark-elevated text-mutedGrey hover:text-espresso dark:hover:text-porcelain cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-3">
              {detailLoading ? (
                <div className="py-12 text-center text-mutedGrey">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-bronze" />
                  <span>Loading product listings...</span>
                </div>
              ) : !selectedSupplierDetail.products || selectedSupplierDetail.products.length === 0 ? (
                <div className="py-12 text-center text-mutedGrey">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-mutedGrey" />
                  <p className="font-medium text-xs">No products currently linked to this supplier.</p>
                  <p className="text-[11px] mt-1">Assign products in the Product Management tab.</p>
                </div>
              ) : (
                <div className="divide-y divide-softBorder dark:divide-dark-border">
                  {selectedSupplierDetail.products.map((prod) => (
                    <div key={prod.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={prod.image_url || prod.image || '/banner/Electronics.png'}
                          alt={prod.name}
                          className="w-10 h-10 object-cover rounded-lg border border-softBorder dark:border-dark-border shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                          }}
                        />
                        <div>
                          <div className="font-semibold text-xs text-espresso dark:text-porcelain">
                            {prod.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-mutedGrey mt-0.5">
                            <span className="font-mono bg-porcelain dark:bg-dark-elevated px-1.5 py-0.2 rounded border border-softBorder dark:border-dark-border">
                              {prod.sku || `SKU-${prod.id}`}
                            </span>
                            <span>•</span>
                            <span>{prod.category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-serif font-bold text-xs text-espresso dark:text-porcelain">
                          ₹{prod.price.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-mutedGrey mt-0.5">
                          Stock: <span className="font-bold text-espresso dark:text-porcelain">{prod.quantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-softBorder dark:border-dark-border flex justify-end shrink-0">
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="px-4 py-2 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-dark-surface rounded-3xl border border-softBorder dark:border-dark-border shadow-luxury-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-espresso dark:text-porcelain">
                Delete Supplier?
              </h3>
              <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-espresso dark:text-porcelain">"{deletingSupplier.name}"</span>? Any associated products will remain in the catalog and their supplier association will be safely unlinked.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingSupplier(null)}
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
