'use client';

import React, { useState } from 'react';
import { fetchAPI } from '../utils/api';
import { Plus, Search, Mail, Phone, MapPin, Trash2, Edit2, ShieldAlert, X, FileText, Download, Upload } from 'lucide-react';
import ClientStatement from './ClientStatement';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

interface ClientsProps {
  clients: any[];
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

export default function Clients({ clients, onRefresh, user }: ClientsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedClientForStatement, setSelectedClientForStatement] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Delhi');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  const openAddModal = () => {
    setEditingClient(null);
    setCompanyName('');
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

  const openEditModal = (client: any) => {
    setEditingClient(client);
    setCompanyName(client.companyName || '');
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setAddress(client.address || '');
    setState(client.state || 'Delhi');
    setCity(client.city || '');
    setZip(client.zip || '');
    setGstin(client.gstin || '');
    setPan(client.pan || '');
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const bodyData = {
      companyName,
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
      if (editingClient) {
        await fetchAPI(`/clients/${editingClient.id}`, {
          method: 'PUT',
          bodyData
        });
      } else {
        await fetchAPI('/clients', {
          method: 'POST',
          bodyData
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving client details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client? All their invoices will also be permanently deleted.')) {
      return;
    }
    try {
      await fetchAPI(`/clients/${id}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete client.');
    }
  };

  const filteredClients = clients.filter(c => 
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.gstin && c.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.pan && c.pan.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Add and manage partner companies, state details, and tax identification profiles.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => downloadExcel(`/clients/export?search=${encodeURIComponent(searchQuery)}`, `Clients_Directory_${new Date().toISOString().split('T')[0]}.xlsx`)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
            title="Export all clients matching search to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          {user?.role !== 'USER' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
                title="Bulk import clients from Excel (.xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Client Company
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-2 max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by company, email, GSTIN or PAN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <div className="glass-panel py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <ShieldAlert className="w-8 h-8 text-slate-500" />
          <span>No clients found. Click "Add Client Company" to begin.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div 
              key={client.id}
              className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">{client.companyName}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[10px] font-semibold">
                      {client.state}
                    </span>
                  </div>
                  <div className="flex gap-1.5 text-slate-400">
                    <button 
                      onClick={() => setSelectedClientForStatement(client)}
                      className="p-1 hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                      title="View Account Statement"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {user?.role !== 'USER' && (
                      <>
                        <button 
                          onClick={() => openEditModal(client)}
                          className="p-1 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors cursor-pointer"
                          title="Edit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(client.id)}
                          className="p-1 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                          title="Delete client"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {client.address}, {client.city || ''} {client.zip ? `- ${client.zip}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-50 dark:bg-slate-900/30 p-2 rounded">
                    <span className="block text-slate-400 uppercase font-semibold">GSTIN</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 truncate block">
                      {client.gstin || 'Not Provided'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/30 p-2 rounded">
                    <span className="block text-slate-400 uppercase font-semibold">PAN</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 truncate block">
                      {client.pan || 'Not Provided'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-md font-bold text-slate-950 dark:text-slate-200">
                {editingClient ? 'Edit Client Details' : 'Add New Client'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="my-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 py-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Office Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">State * (for GST routing)</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-300"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Postal/ZIP Code</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedClientForStatement && (
        <ClientStatement 
          client={selectedClientForStatement} 
          onClose={() => setSelectedClientForStatement(null)} 
        />
      )}

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        moduleKey="clients"
        moduleTitle="Clients"
        onSuccess={onRefresh}
      />
    </div>
  );
}
