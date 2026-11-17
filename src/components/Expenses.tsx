'use client';
import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { Plus, Search, Calendar, Tag, Trash2, Edit3, ClipboardList, X, AlertTriangle, Paperclip, Download, Upload } from 'lucide-react';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

interface ExpensesProps {
  expenses: any[];
  onRefresh: () => void;
  user?: any;
}

const CATEGORIES = ['Rent', 'Salary', 'Software', 'Marketing', 'Utilities', 'Travel', 'Other'];

export default function Expenses({ expenses, onRefresh, user }: ExpensesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Suppliers integration
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');

  // Load suppliers list
  useEffect(() => {
    fetchAPI('/suppliers')
      .then(setSuppliers)
      .catch(err => console.error('Failed to load suppliers in expenses:', err));
  }, []);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Software');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);

  const openAddModal = () => {
    setEditingExpense(null);
    setSupplierId('');
    setDescription('');
    setAmount('');
    setCategory('Software');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setReceiptFile(null);
    setRemoveReceipt(false);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp: any) => {
    setEditingExpense(exp);
    setSupplierId(exp.supplierId || '');
    setDescription(exp.description || '');
    setAmount(exp.amount?.toString() || '');
    setCategory(exp.category || 'Software');
    setDate(exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setNotes(exp.notes || '');
    setReceiptFile(null);
    setRemoveReceipt(false);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !category || !date) {
      setError('Description, amount, category, and date are required.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('description', description);
    formData.append('amount', amount);
    formData.append('category', category);
    formData.append('date', date);
    formData.append('notes', notes);
    if (receiptFile) {
      formData.append('receipt', receiptFile);
    }
    if (removeReceipt) {
      formData.append('removeReceipt', 'true');
    }
    formData.append('supplierId', supplierId || '');

    try {
      if (editingExpense) {
        await fetchAPI(`/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        await fetchAPI('/expenses', {
          method: 'POST',
          body: formData
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record? This action is permanent.')) {
      return;
    }
    try {
      await fetchAPI(`/expenses/${id}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  // Category Badge Color helper
  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'rent':
        return 'bg-purple-500/10 text-purple-500';
      case 'salary':
        return 'bg-emerald-500/10 text-emerald-500';
      case 'software':
        return 'bg-blue-500/10 text-blue-500';
      case 'marketing':
        return 'bg-pink-500/10 text-pink-500';
      case 'utilities':
        return 'bg-amber-500/10 text-amber-500';
      case 'travel':
        return 'bg-cyan-500/10 text-cyan-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  // Filter list
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = 
      selectedCategory === 'ALL' || 
      exp.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Accounting & Expenditures</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Log business overheads, categorise payments, and track ledger outflows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => downloadExcel(`/expenses/export?category=${selectedCategory}&search=${encodeURIComponent(searchQuery)}`, `expenses_${new Date().toISOString().split('T')[0]}.xlsx`)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            title="Export filtered expenses to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>
          {user?.role !== 'USER' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                title="Bulk import expenses from Excel"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Import Excel</span>
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Business Expense
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="flex items-center gap-2 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by description or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Categories filters */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg">
          {['ALL', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer text-[10px] ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Grid / Table */}
      {filteredExpenses.length === 0 ? (
        <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-8 h-8 text-slate-500" />
          <span>No expense records found. Click "Add Business Expense" to log one.</span>
        </div>
      ) : (
        <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-center">Receipt</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  {user?.role !== 'USER' && <th className="px-5 py-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-200">
                      {exp.description}
                      {exp.supplier && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 select-none uppercase">
                          {exp.supplier.companyName}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 italic text-slate-400 max-w-[200px] truncate" title={exp.notes || ''}>
                      {exp.notes || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {exp.receiptUrl ? (
                        <a
                          href={`http://localhost:5000/${exp.receiptUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                          title="View Receipt"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold font-mono text-rose-500 dark:text-rose-400">
                      ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {user?.role !== 'USER' && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal dialog overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h2 className="text-md font-bold text-slate-950 dark:text-slate-200 flex items-center gap-1.5">
                <ClipboardList className="w-4.5 h-4.5 text-slate-400" />
                {editingExpense ? 'Modify Expense Record' : 'Record Business Expense'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Description / Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Hosting, Office Rent, Tea Snacks"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-300"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Payee Vendor / Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-300"
                >
                  <option value="">-- No Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName} ({s.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Transaction Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Optional Notes / Details</label>
                <textarea
                  rows={2}
                  placeholder="Payment receipt details, bank account references, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  Receipt Attachment (Image/PDF)
                </label>
                <div className="mt-1 flex flex-col gap-2">
                  {editingExpense?.receiptUrl && !removeReceipt ? (
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <a
                        href={`http://localhost:5000/${editingExpense.receiptUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[200px]"
                      >
                        View current attachment
                      </a>
                      <button
                        type="button"
                        onClick={() => setRemoveReceipt(true)}
                        className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  {(!editingExpense?.receiptUrl || removeReceipt) && (
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setReceiptFile(e.target.files[0]);
                        }
                      }}
                      className="w-full text-xs text-slate-500 dark:text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded file:border-0
                        file:text-xs file:font-semibold
                        file:bg-indigo-50 dark:file:bg-indigo-950/40
                        file:text-indigo-600 dark:file:text-indigo-400
                        hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/40
                        cursor-pointer bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1"
                    />
                  )}
                  
                  {removeReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveReceipt(false);
                        setReceiptFile(null);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline self-start cursor-pointer"
                      >
                      Keep current attachment
                    </button>
                  )}
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
                  {loading ? 'Saving...' : 'Record Outflow'}
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
        moduleKey="expenses"
        moduleTitle="Expenses"
        onSuccess={onRefresh}
      />
    </div>
  );
}
