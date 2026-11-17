'use client';

import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  Plus, Search, Mail, Phone, MapPin, Trash2, Edit2, 
  ShieldAlert, X, Briefcase, DollarSign, ArrowUpRight, 
  Calendar, Info, Layers, Tag, Eye, Download, Upload
} from 'lucide-react';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

interface SuppliersProps {
  suppliers: any[];
  onRefresh: () => void;
  user?: any;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh', 
  'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep', 'Andaman and Nicobar Islands'
].sort();

export default function Suppliers({ suppliers, onRefresh, user }: SuppliersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'purchases' | 'expenses'>('purchases');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Delhi');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setState('Delhi');
    setCity('');
    setZip('');
    setGstin('');
    setPan('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening details drawer
    setEditingSupplier(supplier);
    setCompanyName(supplier.companyName || '');
    setContactName(supplier.contactName || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setState(supplier.state || 'Delhi');
    setCity(supplier.city || '');
    setZip(supplier.zip || '');
    setGstin(supplier.gstin || '');
    setPan(supplier.pan || '');
    setError('');
    setIsModalOpen(true);
  };

  const openDetailDrawer = async (supplier: any) => {
    setDetailLoading(true);
    setIsDetailOpen(true);
    setSelectedSupplierDetail(supplier);
    setDetailTab('purchases');
    try {
      const details = await fetchAPI(`/suppliers/${supplier.id}`);
      setSelectedSupplierDetail(details);
    } catch (err: any) {
      console.error(err);
      alert('Failed to load supplier detail logs.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const bodyData = {
      companyName,
      contactName,
      email,
      phone,
      address,
      state,
      city,
      zip,
      gstin,
      pan
    };

    try {
      if (editingSupplier) {
        await fetchAPI(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          bodyData
        });
      } else {
        await fetchAPI('/suppliers', {
          method: 'POST',
          bodyData
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving supplier details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this supplier? This action is permanent and links will be broken.')) {
      return;
    }
    try {
      await fetchAPI(`/suppliers/${id}`, {
        method: 'DELETE'
      });
      setIsDetailOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier.');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contactName && s.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.gstin && s.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.pan && s.pan.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Total cumulative spent across all suppliers
  const totalCumulativeSpend = suppliers.reduce((sum, s) => sum + (s.totalSpend || 0), 0);

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Supplier Directory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage product manufacturers, jewelry suppliers, and outsource partners.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => downloadExcel(`/suppliers/export?search=${encodeURIComponent(searchQuery)}`, `Suppliers_Directory_${new Date().toISOString().split('T')[0]}.xlsx`)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
            title="Export suppliers to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          {user?.role !== 'USER' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
                title="Bulk import suppliers from Excel (.xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Supplier Vendor
              </button>
            </>
          )}
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Registered Suppliers</span>
            <h4 className="text-lg font-bold">{suppliers.length}</h4>
          </div>
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Cumulative Outflows (Spend)</span>
            <h4 className="text-lg font-bold text-indigo-500">{formatCurrency(totalCumulativeSpend)}</h4>
          </div>
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Place of Supply Coverage</span>
            <h4 className="text-lg font-bold">
              {new Set(suppliers.map(s => s.state)).size} States
            </h4>
          </div>
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
            <MapPin className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search and filter toolbar */}
      <div className="flex items-center gap-2 max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by company name, contact, GSTIN, PAN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Suppliers Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <ShieldAlert className="w-8 h-8 text-slate-500" />
          <span>No suppliers found. Click "Add Supplier Vendor" to register a new vendor.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div 
              key={supplier.id}
              onClick={() => openDetailDrawer(supplier)}
              className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/40 hover:shadow transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">{supplier.companyName}</h3>
                    <div className="flex gap-1.5 items-center mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[9px] font-semibold">
                        {supplier.state}
                      </span>
                      {supplier.contactName && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          • {supplier.contactName}
                        </span>
                      )}
                    </div>
                  </div>
                  {user?.role !== 'USER' && (
                    <div className="flex gap-1 text-slate-400">
                      <button 
                        onClick={(e) => openEditModal(supplier, e)}
                        title="Edit Supplier"
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(supplier.id, e)}
                        title="Delete Supplier"
                        className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Info */}
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                  {supplier.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.gstin && (
                    <div className="flex items-center gap-1.5 font-mono text-[9px]">
                      <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded">GSTIN</span>
                      <span>{supplier.gstin}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Spend Aggregate */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400">Total Purchase Outflows:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(supplier.totalSpend)}</span>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Supplier Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {editingSupplier ? 'Edit Supplier Vendor' : 'Add New Supplier Vendor'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define contact and tax profiles for this vendor</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-[10px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Contact Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendor@company.com"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Place of Supply (State) *</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City Name"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Zip Code</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="e.g. 110001"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">Billing Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Suite, Street name, area..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">GSTIN</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="15-digit GSTIN"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block text-[9px]">PAN</label>
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="10-digit PAN"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/30 -mx-5 -mb-5 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Supplier Detail Drawer/Modal */}
      {isDetailOpen && selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-in">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-900/30">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-bold rounded uppercase">SUPPLIER</span>
                  <span className="text-[10px] font-mono text-slate-400">ID: {selectedSupplierDetail.id?.substring(0, 8)}...</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{selectedSupplierDetail.companyName}</h2>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                  <span className="bg-slate-200/60 dark:bg-slate-950 px-2 py-0.5 rounded font-semibold text-slate-600 dark:text-slate-300">
                    {selectedSupplierDetail.state}
                  </span>
                  {selectedSupplierDetail.contactName && (
                    <span className="bg-slate-200/60 dark:bg-slate-950 px-2 py-0.5 rounded text-slate-500">
                      Contact: {selectedSupplierDetail.contactName}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Contact Card & Tax ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-2.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-[10px] uppercase tracking-wider text-indigo-500">Contact Details</h4>
                  <div className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[10px]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedSupplierDetail.email}</span>
                    </div>
                    {selectedSupplierDetail.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedSupplierDetail.phone}</span>
                      </div>
                    )}
                    {selectedSupplierDetail.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <span>
                          {selectedSupplierDetail.address}, {selectedSupplierDetail.city || ''} {selectedSupplierDetail.zip || ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-2.5">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-[10px] uppercase tracking-wider text-indigo-500">Tax Identification</h4>
                  <div className="space-y-2 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">GSTIN:</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        {selectedSupplierDetail.gstin || 'Not Registered'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">PAN:</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        {selectedSupplierDetail.pan || 'Not Registered'}
                      </span>
                    </div>
                    <div className="pt-1.5 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400">Supplied Transactions:</span>
                      <span className="font-bold text-indigo-500">
                        {(selectedSupplierDetail.transactionsCount !== undefined ? selectedSupplierDetail.transactionsCount : selectedSupplierDetail.transactions?.length || 0)} Inward
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Logs Tabs */}
              <div className="space-y-4">
                <div className="flex border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
                  <button
                    onClick={() => setDetailTab('purchases')}
                    className={`pb-2.5 px-4 border-b-2 cursor-pointer transition-all ${
                      detailTab === 'purchases'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Inventory Purchases (Restocks)
                  </button>
                  <button
                    onClick={() => setDetailTab('expenses')}
                    className={`pb-2.5 px-4 border-b-2 cursor-pointer transition-all ${
                      detailTab === 'expenses'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Linked Payout Expenses
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-12 flex justify-center items-center">
                    <span className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
                  </div>
                ) : (
                  <>
                    {/* Tab 1: Purchases list */}
                    {detailTab === 'purchases' && (
                      <div className="border border-slate-200 dark:border-slate-900 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 font-bold">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Product (SKU)</th>
                              <th className="py-2 px-3 text-right">Quantity</th>
                              <th className="py-2 px-3 text-right">Unit Rate</th>
                              <th className="py-2 px-3 text-right">Total Outflow</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                            {!selectedSupplierDetail.transactions || selectedSupplierDetail.transactions.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-slate-400">
                                  No product restocks registered for this supplier.
                                </td>
                              </tr>
                            ) : (
                              selectedSupplierDetail.transactions.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                                  <td className="py-2.5 px-3 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{tx.product?.name || 'Deleted Product'}</div>
                                    <div className="text-[9px] text-slate-400">{tx.product?.sku || 'N/A'}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold">
                                    {tx.quantity} {tx.product?.unit || 'PCS'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">{formatCurrency(tx.unitPrice)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(tx.quantity * tx.unitPrice)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Tab 2: Expenses list */}
                    {detailTab === 'expenses' && (
                      <div className="border border-slate-200 dark:border-slate-900 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 font-bold">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                            {!selectedSupplierDetail.expenses || selectedSupplierDetail.expenses.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-6 text-slate-400">
                                  No payout expenses logged for this supplier.
                                </td>
                              </tr>
                            ) : (
                              selectedSupplierDetail.expenses.map((exp: any) => (
                                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                                  <td className="py-2.5 px-3 whitespace-nowrap">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{exp.description}</div>
                                    {exp.notes && <div className="text-[9px] text-slate-400 truncate max-w-xs">{exp.notes}</div>}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/10 text-indigo-500">
                                      {exp.category}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(exp.amount)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-900/30">
              <button
                onClick={(e) => handleDelete(selectedSupplierDetail.id, e)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 dark:border-rose-950 text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 rounded font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Supplier
              </button>
              <button
                onClick={(e) => openEditModal(selectedSupplierDetail, e)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            </div>

          </div>
        </div>
      )}

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        moduleKey="suppliers"
        moduleTitle="Suppliers"
        onSuccess={onRefresh}
      />

    </div>
  );
}
