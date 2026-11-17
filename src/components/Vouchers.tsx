'use client';

import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  X, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  RefreshCw,
  Info,
  Download,
  Upload
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'custom';
type VoucherType = 'RECEIPT' | 'PAYMENT' | 'CONTRA' | 'JOURNAL';

// Standard Chart of Accounts (COA) for selection
const CHART_OF_ACCOUNTS = [
  // Assets
  { name: 'Cash', category: 'Asset' },
  { name: 'Bank Account', category: 'Asset' },
  { name: 'Accounts Receivable', category: 'Asset' },
  { name: 'Inventory', category: 'Asset' },
  { name: 'Equipment', category: 'Asset' },
  // Liabilities
  { name: 'Accounts Payable', category: 'Liability' },
  { name: 'TDS Payable', category: 'Liability' },
  { name: 'GST Payable', category: 'Liability' },
  // Equity
  { name: 'Owner Capital', category: 'Equity' },
  { name: 'Retained Earnings', category: 'Equity' },
  // Revenue
  { name: 'Sales Revenue', category: 'Revenue' },
  { name: 'Other Income', category: 'Revenue' },
  // Expenses
  { name: 'Salaries & Payroll', category: 'Expense' },
  { name: 'Rent Expense', category: 'Expense' },
  { name: 'Office Expenses', category: 'Expense' },
  { name: 'Utilities', category: 'Expense' },
  { name: 'COGS (Cost of Goods Sold)', category: 'Expense' },
  { name: 'Other Expenses', category: 'Expense' }
];

interface VouchersProps {
  user?: any;
}

export default function Vouchers({ user }: VouchersProps) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Expandable row tracking
  const [expandedVouchers, setExpandedVouchers] = useState<Set<string>>(new Set());

  // Create Voucher Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [formType, setFormType] = useState<VoucherType>('RECEIPT');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNarration, setFormNarration] = useState<string>('');
  const [formReference, setFormReference] = useState<string>('');
  const [formItems, setFormItems] = useState<any[]>([
    { accountName: 'Cash', type: 'DEBIT', amount: '' },
    { accountName: 'Sales Revenue', type: 'CREDIT', amount: '' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Preset Date Sync
  const getPresetDates = (preset: DatePreset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    let start = new Date();
    let end = new Date();

    if (preset === 'this-month') {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0);
    } else if (preset === 'last-month') {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0);
    } else if (preset === 'this-quarter') {
      if (m >= 3 && m <= 5) {
        start = new Date(y, 3, 1);
        end = new Date(y, 6, 0);
      } else if (m >= 6 && m <= 8) {
        start = new Date(y, 6, 1);
        end = new Date(y, 9, 0);
      } else if (m >= 9 && m <= 11) {
        start = new Date(y, 9, 1);
        end = new Date(y, 12, 0);
      } else {
        start = new Date(y, 0, 1);
        end = new Date(y, 3, 0);
      }
    } else if (preset === 'this-fy') {
      if (m >= 3) {
        start = new Date(y, 3, 1);
        end = new Date(y + 1, 3, 0);
      } else {
        start = new Date(y - 1, 3, 1);
        end = new Date(y, 3, 0);
      }
    }

    const format = (d: Date) => d.toISOString().split('T')[0];
    return { start: format(start), end: format(end) };
  };

  useEffect(() => {
    if (datePreset !== 'custom') {
      const dates = getPresetDates(datePreset);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [datePreset]);

  // Load vouchers
  const loadVouchers = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      let params = `?startDate=${startDate}&endDate=${endDate}`;
      if (filterType !== 'ALL') {
        params += `&type=${filterType}`;
      }
      const data = await fetchAPI(`/vouchers${params}`);
      setVouchers(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch financial vouchers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadVouchers();
    }
  }, [startDate, endDate, filterType]);

  const toggleRow = (id: string) => {
    const next = new Set(expandedVouchers);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedVouchers(next);
  };

  // Live validation properties for Create Form
  const debitsTotal = formItems
    .filter(i => i.type === 'DEBIT')
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const creditsTotal = formItems
    .filter(i => i.type === 'CREDIT')
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const difference = Math.abs(debitsTotal - creditsTotal);
  const isBalanced = difference < 0.02 && formItems.length >= 2;

  // Add a line item row to the form
  const addFormItem = () => {
    setFormItems([...formItems, { accountName: 'Cash', type: 'DEBIT', amount: '' }]);
  };

  // Delete a line item row from the form
  const removeFormItem = (index: number) => {
    if (formItems.length <= 2) return;
    const next = [...formItems];
    next.splice(index, 1);
    setFormItems(next);
  };

  // Handle value change on form item lines
  const handleItemChange = (index: number, key: string, val: string) => {
    const next = [...formItems];
    next[index] = { ...next[index], [key]: val };
    setFormItems(next);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Validation
    if (!formNarration.trim()) {
      setFormError('Narration (transaction description) is required.');
      return;
    }

    if (!isBalanced) {
      setFormError('Voucher is unbalanced. Total debits must equal total credits.');
      return;
    }

    const payloadItems = formItems.map(i => ({
      accountName: i.accountName,
      type: i.type,
      amount: parseFloat(i.amount) || 0
    }));

    if (payloadItems.some(i => i.amount <= 0)) {
      setFormError('All journal entry amounts must be greater than zero.');
      return;
    }

    try {
      await fetchAPI('/vouchers', {
        method: 'POST',
        bodyData: {
          type: formType,
          date: formDate,
          narration: formNarration,
          reference: formReference.trim() || undefined,
          items: payloadItems
        }
      });

      // Confetti feedback
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      // Reset Form and reload
      setIsCreateOpen(false);
      setFormNarration('');
      setFormReference('');
      setFormItems([
        { accountName: 'Cash', type: 'DEBIT', amount: '' },
        { accountName: 'Sales Revenue', type: 'CREDIT', amount: '' }
      ]);
      loadVouchers();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to submit financial voucher.');
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookkeeping voucher? This will permanently remove its debit/credit postings.')) return;
    try {
      await fetchAPI(`/vouchers/${id}`, { method: 'DELETE' });
      loadVouchers();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete voucher.');
    }
  };

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  // Filtered Vouchers list
  const filteredVouchers = vouchers.filter(v => {
    const term = searchTerm.toLowerCase();
    return (
      v.voucherNumber.toLowerCase().includes(term) ||
      v.narration.toLowerCase().includes(term) ||
      (v.reference && v.reference.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header and Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Double-Entry Voucher Book</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Journal adjustments, cash/bank contra deposits, receipt vouchers, and payment settlements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Presets */}
          <div className="flex bg-slate-200/60 dark:bg-slate-900/60 p-1 rounded-lg border border-slate-300/40 dark:border-slate-800/40 text-[11px] font-semibold">
            {(['this-month', 'last-month', 'this-quarter', 'this-fy', 'custom'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer capitalize ${
                  datePreset === preset
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset.replace('-', ' ')}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none border-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none border-none"
              />
            </div>
          )}

          <button
            onClick={() => downloadExcel(`/vouchers/export?startDate=${startDate}&endDate=${endDate}&type=${filterType}`, `vouchers_${startDate || 'all'}_${endDate || 'all'}.xlsx`)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            title="Export filtered vouchers to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {user?.role !== 'USER' && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title="Bulk import vouchers from Excel"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Import Excel</span>
            </button>
          )}

          <button
            onClick={loadVouchers}
            title="Refresh Ledger"
            className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {user?.role !== 'USER' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Voucher
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Vouchers logged */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged Vouchers</span>
          <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
            {filteredVouchers.length} Transactions
          </h3>
          <p className="text-[9px] text-slate-400 mt-2">Bookkeeping vouchers in date range</p>
        </div>

        {/* Voucher types distribution counters */}
        {['RECEIPT', 'PAYMENT', 'CONTRA'].map(t => {
          const count = filteredVouchers.filter(v => v.type === t).length;
          const totalVal = filteredVouchers
            .filter(v => v.type === t)
            .reduce((sum, v) => {
              const debitSide = v.items
                .filter((i: any) => i.type === 'DEBIT')
                .reduce((s: number, i: any) => s + i.amount, 0);
              return sum + debitSide;
            }, 0);
          
          return (
            <div key={t} className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t} Transactions
              </span>
              <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                {count} ({formatCurrency(totalVal)})
              </h3>
              <p className="text-[9px] text-slate-400 mt-2">Aggregate transaction value</p>
            </div>
          );
        })}
      </div>

      {/* Main Ledger controls */}
      <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Filters and search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Voucher Number, Narration, or Reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold">
            {['ALL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  filterType === t
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="min-h-[250px] flex flex-col items-center justify-center space-y-3">
            <span className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
            <span className="text-xs text-slate-400 font-medium">Loading bookkeeping entries...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                  <th className="py-2.5 px-3 w-10"></th>
                  <th className="py-2.5 px-3">Voucher No.</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Narration (Description)</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">Debit/Credit Value</th>
                  {user?.role !== 'USER' && <th className="py-2.5 px-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'USER' ? 7 : 8} className="text-center py-8 text-slate-400">
                      No vouchers found matching search filters.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => {
                    const isExpanded = expandedVouchers.has(v.id);
                    // Value is sum of all debits
                    const totalVal = v.items
                      .filter((i: any) => i.type === 'DEBIT')
                      .reduce((sum: number, i: any) => sum + i.amount, 0);

                    // Badge colors
                    let badgeStyle = 'bg-slate-500/10 text-slate-500';
                    if (v.type === 'RECEIPT') badgeStyle = 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400';
                    else if (v.type === 'PAYMENT') badgeStyle = 'bg-rose-500/10 text-rose-500 dark:text-rose-400';
                    else if (v.type === 'CONTRA') badgeStyle = 'bg-blue-500/10 text-blue-500 dark:text-blue-400';
                    else if (v.type === 'JOURNAL') badgeStyle = 'bg-amber-500/10 text-amber-500 dark:text-amber-400';

                    return (
                      <React.Fragment key={v.id}>
                        {/* Parent Row */}
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => toggleRow(v.id)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-950 dark:text-slate-100">{v.voucherNumber}</td>
                          <td className="py-2.5 px-3">{new Date(v.date).toLocaleDateString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                              {v.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px] truncate" title={v.narration}>{v.narration}</td>
                          <td className="py-2.5 px-3 font-mono">{v.reference || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-200">
                            {formatCurrency(totalVal)}
                          </td>
                          {user?.role !== 'USER' && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDelete(v.id)}
                                title="Delete Voucher"
                                className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Expandable Ledger Detail Panel */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                            <td colSpan={user?.role === 'USER' ? 7 : 8} className="px-6 py-4">
                              <div className="max-w-2xl border border-slate-200/60 dark:border-slate-800/80 rounded-lg bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Ledger Postings (Double-Entry Ledger Sheet)</span>
                                </div>
                                <table className="w-full text-left text-[10px]">
                                  <thead>
                                    <tr className="border-b border-slate-200/40 dark:border-slate-800/40 text-slate-400 font-bold bg-slate-50/20">
                                      <th className="py-2 px-3">Account Ledger Name</th>
                                      <th className="py-2 px-3 text-right w-36">Debit (INR)</th>
                                      <th className="py-2 px-3 text-right w-36">Credit (INR)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                    {v.items.map((item: any) => (
                                      <tr key={item.id} className="text-slate-700 dark:text-slate-300">
                                        <td className="py-2 px-3 font-medium">
                                          {item.type === 'CREDIT' ? (
                                            <span className="pl-6 text-slate-600 dark:text-slate-400">To {item.accountName}</span>
                                          ) : (
                                            <span>{item.accountName}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-950 dark:text-slate-200">
                                          {item.type === 'DEBIT' ? formatCurrency(item.amount) : '-'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-950 dark:text-slate-200">
                                          {item.type === 'CREDIT' ? formatCurrency(item.amount) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {/* Balanced Total Row */}
                                    <tr className="bg-slate-50/40 dark:bg-slate-950/40 font-bold border-t border-slate-200/80 dark:border-slate-800/80">
                                      <td className="py-2 px-3 text-slate-500 text-right">Total:</td>
                                      <td className="py-2 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(totalVal)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(totalVal)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog: Create Voucher */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="glass-panel w-full max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-[#0c1220] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-600/10 rounded-lg flex items-center justify-center">
                  <Scale className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Bookkeeping Voucher</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Post debit/credit transaction entries to general ledger</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Form KPI Errors */}
              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form parameters grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as VoucherType)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200 font-semibold"
                  >
                    <option value="RECEIPT">RECEIPT</option>
                    <option value="PAYMENT">PAYMENT</option>
                    <option value="CONTRA">CONTRA</option>
                    <option value="JOURNAL">JOURNAL</option>
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>

                {/* Reference */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reference / Doc No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank Ref, Cheque No, Invoice linkage"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Narration */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Narration (Description)</label>
                <textarea
                  required
                  placeholder="Describe the nature of this financial transaction..."
                  value={formNarration}
                  onChange={(e) => setFormNarration(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>

              {/* Ledger Lines builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Journal Posting Rows</label>
                  <button
                    type="button"
                    onClick={addFormItem}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Entry Row
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {formItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      
                      {/* Account selection */}
                      <div className="flex-1">
                        <select
                          value={item.accountName}
                          onChange={(e) => handleItemChange(index, 'accountName', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-2 py-1.5 rounded-lg text-[11px] outline-none text-slate-700 dark:text-slate-300 font-medium"
                        >
                          {CHART_OF_ACCOUNTS.map(coa => (
                            <option key={coa.name} value={coa.name}>
                              {coa.name} ({coa.category})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type (DEBIT/CREDIT) */}
                      <div className="w-28">
                        <select
                          value={item.type}
                          onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-2 py-1.5 rounded-lg text-[11px] outline-none text-slate-800 dark:text-slate-200 font-bold"
                        >
                          <option value="DEBIT">DEBIT</option>
                          <option value="CREDIT">CREDIT</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div className="w-36 relative">
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-400">₹</span>
                        <input
                          type="number"
                          required
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-6 pr-2 py-1.5 rounded-lg text-[11px] outline-none text-slate-800 dark:text-slate-200 font-mono text-right"
                        />
                      </div>

                      {/* Remove Line Row */}
                      <button
                        type="button"
                        onClick={() => removeFormItem(index)}
                        disabled={formItems.length <= 2}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  ))}
                </div>
              </div>

              {/* Balanced Warning display */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Double-entry balancing monitor:</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
                  <div>Debits: <span className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(debitsTotal)}</span></div>
                  <div>Credits: <span className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(creditsTotal)}</span></div>
                  
                  {isBalanced ? (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ledger Balanced</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-rose-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Unbalanced (Diff: {formatCurrency(difference)})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white disabled:text-slate-400 rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 disabled:shadow-none cursor-pointer"
                >
                  Post Voucher
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        moduleKey="vouchers"
        moduleTitle="Double-Entry Vouchers"
        onSuccess={loadVouchers}
      />

    </div>
  );
}
