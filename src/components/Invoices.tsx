'use client';

import React, { useState } from 'react';
import { fetchAPI } from '../utils/api';
import { Search, Download, Trash2, CheckCircle, Clock, AlertTriangle, Plus, Mail, FileSpreadsheet, Upload } from 'lucide-react';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

interface InvoicesProps {
  invoices: any[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  user?: any;
}

type StatusFilter = 'ALL' | 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';

export default function Invoices({ invoices, onRefresh, onNavigate, user }: InvoicesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleDownloadPDF = async (id: string, invoiceNum: string) => {
    setDownloadingId(id);
    try {
      const blob = await fetchAPI(`/invoices/${id}/pdf`, {
        method: 'GET',
      });
      
      // Create download link for PDF blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEmailInvoice = async (id: string, invoiceNum: string) => {
    setEmailingId(id);
    try {
      const res = await fetchAPI(`/invoices/${id}/email`, {
        method: 'POST',
      });
      alert(res.message || `Invoice ${invoiceNum} emailed successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to email invoice.');
    } finally {
      setEmailingId(null);
    }
  };

  const handleExportExcel = async (id: string, invoiceNum: string) => {
    setExportingId(id);
    try {
      const blob = await fetchAPI(`/invoices/${id}/excel`, {
        method: 'GET',
      });
      
      // Create download link for genuine Excel blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNum}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export invoice to Excel.');
    } finally {
      setExportingId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    let nextStatus = 'UNPAID';
    if (currentStatus === 'UNPAID') {
      nextStatus = 'PARTIALLY_PAID';
    } else if (currentStatus === 'PARTIALLY_PAID') {
      nextStatus = 'PAID';
    } else {
      nextStatus = 'UNPAID';
    }

    try {
      await fetchAPI(`/invoices/${id}/status`, {
        method: 'PATCH',
        bodyData: { status: nextStatus }
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action is permanent.')) {
      return;
    }
    try {
      await fetchAPI(`/invoices/${id}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete invoice.');
    }
  };

  // Filter logic
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.client && inv.client.companyName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'ALL' || 
      inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20';
      case 'PARTIALLY_PAID':
        return 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20';
      default:
        return 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20';
    }
  };

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Invoice Ledger</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor receivables, export official PDFs/Excels, email clients, and manage payment statuses.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => downloadExcel(`/invoices/export?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`, `Sales_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
            title="Export filtered invoice ledger to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            Export Ledger
          </button>
          {user?.role !== 'USER' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-xs cursor-pointer"
                title="Bulk import invoices from Excel (.xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Invoices
              </button>
              <button
                onClick={() => onNavigate('create-invoice')}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create New Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="flex items-center gap-2 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by invoice number or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Status filters */}
        <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg">
          {(['ALL', 'PAID', 'UNPAID', 'PARTIALLY_PAID'] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === filter
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {filter === 'PARTIALLY_PAID' ? 'Partially Paid' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List Table */}
      {filteredInvoices.length === 0 ? (
        <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-8 h-8 text-slate-500" />
          <span>No invoices found. Click "Create New Invoice" to begin.</span>
        </div>
      ) : (
        <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3">Invoice ID</th>
                  <th className="px-5 py-3">Client Company</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                  <th className="px-5 py-3 text-right">Net Payable</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-950 dark:text-slate-200 font-mono">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-300">{inv.client?.companyName}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-500">₹{inv.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3.5 text-right font-semibold font-mono text-slate-900 dark:text-slate-100">
                      ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        disabled={user?.role === 'USER'}
                        onClick={() => handleToggleStatus(inv.id, inv.status)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors hover:scale-105 active:scale-95 ${getStatusBadgeClass(inv.status)}`}
                        title="Click to cycle status: Unpaid -> Partially Paid -> Paid"
                      >
                        {inv.status === 'PAID' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </>
                        ) : inv.status === 'PARTIALLY_PAID' ? (
                          <>
                            <Clock className="w-3 h-3" />
                            Partially Paid
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            Unpaid
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={downloadingId === inv.id}
                          onClick={() => handleDownloadPDF(inv.id, inv.invoiceNumber)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors disabled:opacity-40 cursor-pointer"
                          title="Download Invoice PDF"
                        >
                          {downloadingId === inv.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin"></span>
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                        
                        <button
                          disabled={emailingId === inv.id}
                          onClick={() => handleEmailInvoice(inv.id, inv.invoiceNumber)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors disabled:opacity-40 cursor-pointer"
                          title="Email Invoice to Customer"
                        >
                          {emailingId === inv.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin"></span>
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          disabled={exportingId === inv.id}
                          onClick={() => handleExportExcel(inv.id, inv.invoiceNumber)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors disabled:opacity-40 cursor-pointer"
                          title="Export Invoice as Excel"
                        >
                          {exportingId === inv.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin"></span>
                          ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {user?.role !== 'USER' && (
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        moduleKey="invoices"
        moduleTitle="Invoices & Sales"
        onSuccess={onRefresh}
      />
    </div>
  );
}
