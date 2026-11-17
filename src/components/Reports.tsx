'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Percent, 
  Calendar, 
  Download, 
  Scale, 
  Users, 
  Briefcase, 
  FileText, 
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { fetchAPI } from '../utils/api';
import NotificationSettings from './NotificationSettings';
import { downloadExcel } from '../utils/excel';

type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'custom';
type ReportTab = 'pl' | 'gst' | 'tds-tcs' | 'bookkeeping' | 'notifications';
type BookkeepingSubTab = 'bs' | 'tb' | 'gl';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pl');
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Data states
  const [plData, setPlData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [tdsTcsData, setTdsTcsData] = useState<any>(null);
  const [bookkeepingData, setBookkeepingData] = useState<any>(null);
  const [bkSubTab, setBkSubTab] = useState<BookkeepingSubTab>('bs');
  const [selectedGlAccount, setSelectedGlAccount] = useState<string>('Cash');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  // Helper to get dates for presets
  const getPresetDates = (preset: DatePreset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-11

    let start = new Date();
    let end = new Date();

    if (preset === 'this-month') {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0);
    } else if (preset === 'last-month') {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0);
    } else if (preset === 'this-quarter') {
      // Indian Financial Quarters: Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar
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
      // Indian Financial Year: April 1 to March 31
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

  // Synchronize start and end date when preset changes
  useEffect(() => {
    if (datePreset !== 'custom') {
      const dates = getPresetDates(datePreset);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [datePreset]);

  // Load report data
  const loadReports = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);
    try {
      const params = `?startDate=${startDate}&endDate=${endDate}`;
      const [plRes, gstRes, tdsTcsRes, bookkeepingRes] = await Promise.all([
        fetchAPI(`/reports/profit-loss${params}`),
        fetchAPI(`/reports/gst${params}`),
        fetchAPI(`/reports/tds-tcs${params}`),
        fetchAPI(`/reports/bookkeeping${params}`)
      ]);
      setPlData(plRes);
      setGstData(gstRes);
      setTdsTcsData(tdsTcsRes);
      setBookkeepingData(bookkeepingRes);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch financial reports.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger load when dates or preset changes
  useEffect(() => {
    if (startDate && endDate) {
      loadReports();
    }
  }, [startDate, endDate]);

  // CSV Export for GSTR-1
  const handleExportGSTR1 = () => {
    if (!gstData || !gstData.outwardSupplies || gstData.outwardSupplies.length === 0) return;

    const headers = [
      'Invoice Number',
      'Invoice Type',
      'Date',
      'Client Name',
      'Client GSTIN',
      'Place of Supply (State)',
      'Taxable Value (INR)',
      'CGST (INR)',
      'SGST (INR)',
      'IGST (INR)',
      'Grand Total (INR)'
    ];

    const rows = gstData.outwardSupplies.map((row: any) => [
      row.invoiceNumber,
      row.invoiceType,
      new Date(row.date).toLocaleDateString('en-IN'),
      `"${row.clientName.replace(/"/g, '""')}"`,
      row.clientGstin,
      row.state,
      row.taxableValue.toFixed(2),
      row.cgst.toFixed(2),
      row.sgst.toFixed(2),
      row.igst.toFixed(2),
      row.grandTotal.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GSTR1_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for TDS
  const handleExportTDS = () => {
    if (!tdsTcsData || !tdsTcsData.tdsRecords || tdsTcsData.tdsRecords.length === 0) return;

    const headers = [
      'Invoice Number',
      'Date',
      'Client Name',
      'Client PAN',
      'TDS Section',
      'Taxable Value (INR)',
      'TDS Rate (%)',
      'TDS Amount (INR)'
    ];

    const rows = tdsTcsData.tdsRecords.map((row: any) => [
      row.invoiceNumber,
      new Date(row.date).toLocaleDateString('en-IN'),
      `"${row.clientName.replace(/"/g, '""')}"`,
      row.clientPan,
      row.section,
      row.taxableValue.toFixed(2),
      row.tdsRate.toFixed(2),
      row.tdsAmount.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TDS_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for TCS
  const handleExportTCS = () => {
    if (!tdsTcsData || !tdsTcsData.tcsRecords || tdsTcsData.tcsRecords.length === 0) return;

    const headers = [
      'Invoice Number',
      'Date',
      'Client Name',
      'Client PAN',
      'Taxable Value (INR)',
      'TCS Rate (%)',
      'TCS Amount (INR)'
    ];

    const rows = tdsTcsData.tcsRecords.map((row: any) => [
      row.invoiceNumber,
      new Date(row.date).toLocaleDateString('en-IN'),
      `"${row.clientName.replace(/"/g, '""')}"`,
      row.clientPan,
      row.taxableValue.toFixed(2),
      row.tcsRate.toFixed(2),
      row.tcsAmount.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TCS_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel Export for Active Report
  const handleExportExcel = () => {
    if (activeTab === 'pl') {
      downloadExcel(`/reports/profit-loss/excel?startDate=${startDate}&endDate=${endDate}`, `profit_loss_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    } else if (activeTab === 'gst') {
      downloadExcel(`/reports/gst/excel?startDate=${startDate}&endDate=${endDate}`, `gstr1_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    } else if (activeTab === 'tds-tcs') {
      downloadExcel(`/reports/tds-tcs/excel?startDate=${startDate}&endDate=${endDate}`, `tds_tcs_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    } else if (activeTab === 'bookkeeping') {
      downloadExcel(`/reports/bookkeeping/excel?startDate=${startDate}&endDate=${endDate}&subTab=${bkSubTab}&accountName=${encodeURIComponent(selectedGlAccount)}`, `bookkeeping_${bkSubTab}_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Financial Reports & Auditing</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            P&L statement analysis and tax summary ledger computations
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
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

          {activeTab !== 'notifications' && (
            <button
              onClick={handleExportExcel}
              title="Export Current Report to Excel"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            onClick={loadReports}
            title="Refresh Report Data"
            className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('pl')}
          className={`pb-3 px-6 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'pl'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveTab('gst')}
          className={`pb-3 px-6 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'gst'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          GST Ledger & Filing
        </button>
        <button
          onClick={() => setActiveTab('tds-tcs')}
          className={`pb-3 px-6 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'tds-tcs'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          TDS & TCS Ledger
        </button>
        <button
          onClick={() => setActiveTab('bookkeeping')}
          className={`pb-3 px-6 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'bookkeeping'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          General Ledger & Balance Sheet
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 px-6 text-xs font-semibold tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'notifications'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Automated Reminders
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center space-y-3 py-12">
          <span className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
          <span className="text-xs text-slate-400 font-medium">Crunching ledger data...</span>
        </div>
      ) : (
        <>
          {/* Tab 1: P&L Statement */}
          {activeTab === 'pl' && plData && (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
                
                {/* Gross Revenue */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Sales (Revenue)</span>
                    <h3 className="text-lg font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(plData.revenue)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span>Invoiced subtotal values</span>
                  </div>
                </div>

                {/* COGS */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
                      {formatCurrency(plData.cogs)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>Inventory product costs</span>
                  </div>
                </div>

                {/* Gross Profit */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Profit</span>
                    <h3 className={`text-lg font-extrabold tracking-tight ${plData.grossProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                      {formatCurrency(plData.grossProfit)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Percent className="w-3 h-3 text-indigo-500" />
                    <span>Margin: {plData.revenue > 0 ? Math.round((plData.grossProfit / plData.revenue) * 100) : 0}%</span>
                  </div>
                </div>

                {/* Operating Expenses */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operating Expenses</span>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
                      {formatCurrency(plData.operatingExpenses)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-rose-500" />
                    <span>Excludes payroll payouts</span>
                  </div>
                </div>

                {/* Payroll */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payroll Salaries</span>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
                      {formatCurrency(plData.payroll)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span>Paid employee salaries</span>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-500/5 to-transparent">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Income (Profit)</span>
                    <h3 className={`text-lg font-black tracking-tight ${plData.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatCurrency(plData.netProfit)}
                    </h3>
                  </div>
                  <div className="mt-3 text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Scale className="w-3 h-3 text-emerald-500" />
                    <span>Net Margin: {plData.revenue > 0 ? Math.round((plData.netProfit / plData.revenue) * 100) : 0}%</span>
                  </div>
                </div>

              </div>

              {/* Chart & Expense Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Recharts Bar Chart */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">6-Month Fiscal Performance</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Historical monthly comparison of gross sales, product costs, and expenses</p>
                  </div>
                  <div className="h-72 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={plData.trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" className="dark:hidden" />
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `₹${v/1000}k`} />
                        <Tooltip 
                          formatter={(v) => [formatCurrency(v as number)]} 
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            borderColor: '#334155', 
                            borderRadius: '8px',
                            color: '#fff' 
                          }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Sales Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cogs" name="COGS" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Operating Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expense Categories Breakdown */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">Expense Distribution</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Breakdown of operational spend in the selected date range</p>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-3 mt-4">
                    {Object.keys(plData.expenseBreakdown).length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No expenses logged in this range.
                      </div>
                    ) : (
                      Object.entries(plData.expenseBreakdown).map(([category, amount]: any) => {
                        const totalSpend = plData.totalExpenses;
                        const percentage = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;
                        return (
                          <div key={category} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{category}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {formatCurrency(amount)} ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-1.5 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-500">Cumulative Expenses</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(plData.totalExpenses)}</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Tab 2: GST Ledger & Filing */}
          {activeTab === 'gst' && gstData && (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Total Taxable Value */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Taxable Value</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(gstData.taxableValue)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Cumulative taxable sales</p>
                </div>

                {/* CGST */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Central Tax (CGST)</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(gstData.cgst)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Intra-state central split</p>
                </div>

                {/* SGST */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">State Tax (SGST)</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(gstData.sgst)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Intra-state state split</p>
                </div>

                {/* IGST */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integrated Tax (IGST)</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(gstData.igst)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Inter-state sales tax</p>
                </div>

                {/* Cumulative GST Liability */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-500/5 to-transparent">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Total GST Collected</span>
                  <h3 className="text-lg font-black tracking-tight mt-1 text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(gstData.totalGst)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Total GSTR tax liability</p>
                </div>

              </div>

              {/* GSTR-3B Liability Table & Details */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* GSTR-3B Summary Split Box */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">GSTR-3B Summary Split</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Aggregated tax liability splits for simplified GSTR-3B filings</p>
                  </div>

                  <div className="space-y-4 pt-3">
                    {/* Intra-State */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">1. Intra-State Outward Supplies</span>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Taxable Value:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(gstData.gstr3b.intraState.taxableValue)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">CGST Amount:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(gstData.gstr3b.intraState.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">SGST Amount:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(gstData.gstr3b.intraState.sgst)}</span>
                      </div>
                    </div>

                    {/* Inter-State */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">2. Inter-State Outward Supplies</span>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Taxable Value:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(gstData.gstr3b.interState.taxableValue)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">IGST Amount:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(gstData.gstr3b.interState.igst)}</span>
                      </div>
                    </div>

                    {/* Overall Summary */}
                    <div className="pt-2 flex justify-between items-center text-xs font-bold border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Net Tax Liability Due</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-sm">{formatCurrency(gstData.gstr3b.totalLiability)}</span>
                    </div>
                  </div>
                </div>

                {/* Outward Supplies Ledger (GSTR-1 style) */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight">Outward Supply Ledger (GSTR-1 Details)</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Detailed records of business-to-business (B2B) and customer supplies</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadExcel(`/reports/gst/excel?startDate=${startDate}&endDate=${endDate}`, `gstr1_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`)}
                        disabled={gstData.outwardSupplies.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Export GSTR-1 formatted Excel workbook"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export GSTR-1 Excel
                      </button>
                      <button
                        onClick={handleExportGSTR1}
                        disabled={gstData.outwardSupplies.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                          <th className="py-2.5 px-3">Invoice No.</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Recipient Name</th>
                          <th className="py-2.5 px-3">Recipient GSTIN</th>
                          <th className="py-2.5 px-3">Place (State)</th>
                          <th className="py-2.5 px-3 text-right">Taxable Value</th>
                          <th className="py-2.5 px-3 text-right">GST Splits</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {gstData.outwardSupplies.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400">
                              No outward supplies recorded in this date range.
                            </td>
                          </tr>
                        ) : (
                          gstData.outwardSupplies.map((row: any) => (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 px-3 font-semibold text-slate-950 dark:text-slate-100">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                              <td className="py-2.5 px-3 font-medium max-w-[120px] truncate" title={row.clientName}>{row.clientName}</td>
                              <td className="py-2.5 px-3 font-mono">{row.clientGstin}</td>
                              <td className="py-2.5 px-3">{row.state}</td>
                              <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(row.taxableValue)}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-500">
                                {row.igst > 0 ? (
                                  <span>IGST: {formatCurrency(row.igst)}</span>
                                ) : (
                                  <div className="flex flex-col">
                                    <span>CGST: {formatCurrency(row.cgst)}</span>
                                    <span>SGST: {formatCurrency(row.sgst)}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-950 dark:text-slate-100">{formatCurrency(row.grandTotal)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Tab 3: TDS & TCS Ledger */}
          {activeTab === 'tds-tcs' && tdsTcsData && (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Total Taxable Value under TDS/TCS */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Taxable Sales (TDS/TCS)</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(tdsTcsData.taxableValue)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Cumulative taxable sales with withholdings</p>
                </div>

                {/* Total TDS Deducted */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total TDS Deducted</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(tdsTcsData.totalTds)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Tax Deducted at Source (Receivables)</p>
                </div>

                {/* Total TCS Collected */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-500/5 to-transparent">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Total TCS Collected</span>
                  <h3 className="text-lg font-black tracking-tight mt-1 text-emerald-500">
                    {formatCurrency(tdsTcsData.totalTcs)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Tax Collected at Source (Payables)</p>
                </div>

              </div>

              {/* Section-wise TDS summary cards */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">TDS Breakdown by Section</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Summary of taxable values and tax amounts grouped by TDS section codes</p>
                </div>
                {Object.keys(tdsTcsData.tdsBySection).length === 0 ? (
                  <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No section-wise TDS data recorded in this range.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(tdsTcsData.tdsBySection).map(([section, data]: [string, any]) => (
                      <div key={section} className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider">
                            Section {section}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {data.rate}% Rate
                          </span>
                        </div>
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Taxable Value:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(data.taxableValue)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">TDS Amount:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(data.amount)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TDS & TCS Detail Ledgers */}
              <div className="grid grid-cols-1 gap-6">
                
                {/* TDS Ledger */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight">TDS (Tax Deducted at Source) Ledger</h3>
                      <p className="text-xs text-slate-400 mt-0.5">List of invoices where client has deducted tax at source (Form 26Q/27Q mapping)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadExcel(`/reports/tds-tcs/excel?startDate=${startDate}&endDate=${endDate}`, `tds_tcs_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`)}
                        disabled={tdsTcsData.tdsRecords.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Export TDS formatted Excel workbook"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export TDS Excel
                      </button>
                      <button
                        onClick={handleExportTDS}
                        disabled={tdsTcsData.tdsRecords.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                          <th className="py-2.5 px-3">Invoice No.</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Client Name</th>
                          <th className="py-2.5 px-3">Client PAN</th>
                          <th className="py-2.5 px-3">Section</th>
                          <th className="py-2.5 px-3 text-right">Taxable Value</th>
                          <th className="py-2.5 px-3 text-right">Rate</th>
                          <th className="py-2.5 px-3 text-right">TDS Deducted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {tdsTcsData.tdsRecords.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400">
                              No TDS deductions recorded in this date range.
                            </td>
                          </tr>
                        ) : (
                          tdsTcsData.tdsRecords.map((row: any) => (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 px-3 font-semibold text-slate-950 dark:text-slate-100">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                              <td className="py-2.5 px-3 font-medium max-w-[150px] truncate" title={row.clientName}>{row.clientName}</td>
                              <td className="py-2.5 px-3 font-mono">{row.clientPan}</td>
                              <td className="py-2.5 px-3 font-semibold text-indigo-500">{row.section}</td>
                              <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(row.taxableValue)}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{row.tdsRate}%</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-950 dark:text-slate-100">{formatCurrency(row.tdsAmount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TCS Ledger */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight">TCS (Tax Collected at Source) Ledger</h3>
                      <p className="text-xs text-slate-400 mt-0.5">List of invoices where tax has been collected at source (Form 27EQ mapping)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadExcel(`/reports/tds-tcs/excel?startDate=${startDate}&endDate=${endDate}`, `tds_tcs_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`)}
                        disabled={tdsTcsData.tcsRecords.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Export TCS formatted Excel workbook"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export TCS Excel
                      </button>
                      <button
                        onClick={handleExportTCS}
                        disabled={tdsTcsData.tcsRecords.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                          <th className="py-2.5 px-3">Invoice No.</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Client Name</th>
                          <th className="py-2.5 px-3">Client PAN</th>
                          <th className="py-2.5 px-3 text-right">Taxable Value</th>
                          <th className="py-2.5 px-3 text-right">Rate</th>
                          <th className="py-2.5 px-3 text-right">TCS Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {tdsTcsData.tcsRecords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400">
                              No TCS collections recorded in this date range.
                            </td>
                          </tr>
                        ) : (
                          tdsTcsData.tcsRecords.map((row: any) => (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 px-3 font-semibold text-slate-950 dark:text-slate-100">{row.invoiceNumber}</td>
                              <td className="py-2.5 px-3">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                              <td className="py-2.5 px-3 font-medium max-w-[150px] truncate" title={row.clientName}>{row.clientName}</td>
                              <td className="py-2.5 px-3 font-mono">{row.clientPan}</td>
                              <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(row.taxableValue)}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{row.tcsRate}%</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-950 dark:text-slate-100">{formatCurrency(row.tcsAmount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Tab 4: General Ledger & Balance Sheet */}
          {activeTab === 'bookkeeping' && bookkeepingData && (
            <div className="space-y-6">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Total Assets */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Assets</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(bookkeepingData.balanceSheet.assets.total)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Cash, bank, receivables & TDS assets</p>
                </div>

                {/* Total Liabilities */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Liabilities</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(bookkeepingData.balanceSheet.liabilities.total)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Payables, tax liabilities & TCS collected</p>
                </div>

                {/* Total Equity */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Capital & Equity</span>
                  <h3 className="text-lg font-extrabold tracking-tight mt-1 text-slate-800 dark:text-slate-200">
                    {formatCurrency(bookkeepingData.balanceSheet.equity.total)}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-2">Owner capital & dynamic retained income</p>
                </div>

                {/* Bookkeeping Equation Check */}
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-500/5 to-transparent">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Accounting Balance Status</span>
                  {bookkeepingData.balanceSheet.isBalanced ? (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider">
                      <Scale className="w-3.5 h-3.5" />
                      Balanced
                    </div>
                  ) : (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-lg text-xs font-bold uppercase tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Unbalanced ({formatCurrency(bookkeepingData.balanceSheet.difference)})
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400 mt-2.5">Equation: Assets = Liabilities + Equity</p>
                </div>

              </div>

              {/* Sub-tabs controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800/80 gap-2 pb-1">
                <div className="flex text-xs font-bold">
                  <button
                    onClick={() => setBkSubTab('bs')}
                    className={`pb-2 px-4 transition-all border-b-2 cursor-pointer ${
                      bkSubTab === 'bs'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Balance Sheet
                  </button>
                  <button
                    onClick={() => setBkSubTab('tb')}
                    className={`pb-2 px-4 transition-all border-b-2 cursor-pointer ${
                      bkSubTab === 'tb'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Trial Balance
                  </button>
                  <button
                    onClick={() => setBkSubTab('gl')}
                    className={`pb-2 px-4 transition-all border-b-2 cursor-pointer ${
                      bkSubTab === 'gl'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    General Ledger Audit Logs
                  </button>
                </div>
                <button
                  onClick={() => downloadExcel(`/reports/bookkeeping/excel?startDate=${startDate}&endDate=${endDate}&subTab=${bkSubTab}&accountName=${encodeURIComponent(selectedGlAccount)}`, `bookkeeping_${bkSubTab}_${startDate || 'all'}_${endDate || 'all'}.xlsx`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors shadow-sm cursor-pointer self-start sm:self-auto mb-1"
                  title="Export active bookkeeping statement to Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export {bkSubTab === 'bs' ? 'Balance Sheet' : bkSubTab === 'tb' ? 'Trial Balance' : 'General Ledger'} Excel</span>
                </button>
              </div>

              {/* Sub-tab 1: Balance Sheet */}
              {bkSubTab === 'bs' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Side: Assets */}
                  <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Assets</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Economic resources owned by the business entity</p>
                    </div>

                    <div className="space-y-3 min-h-48">
                      {bookkeepingData.balanceSheet.assets.items.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-400">No asset accounts recorded.</div>
                      ) : (
                        bookkeepingData.balanceSheet.assets.items.map((asset: any) => (
                          <div key={asset.name} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-lg">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{asset.name}</span>
                            <span className="font-mono text-slate-950 dark:text-slate-100">{formatCurrency(asset.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500">Total Assets (A)</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black">
                        {formatCurrency(bookkeepingData.balanceSheet.assets.total)}
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Liabilities & Equity */}
                  <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                    
                    {/* Liabilities Section */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Liabilities</h3>
                        <p className="text-xs text-slate-400 mt-0.5">External financial obligations and debt settlements due</p>
                      </div>

                      <div className="space-y-2">
                        {bookkeepingData.balanceSheet.liabilities.items.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">No liability accounts recorded.</div>
                        ) : (
                          bookkeepingData.balanceSheet.liabilities.items.map((liability: any) => (
                            <div key={liability.name} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-lg">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{liability.name}</span>
                              <span className="font-mono text-slate-950 dark:text-slate-100">{formatCurrency(liability.amount)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Equity Section */}
                    <div className="space-y-4 pt-2 border-t border-slate-200/60 dark:border-slate-850">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Capital & Equity</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Owner reserves and dynamic retained earnings (Net Income)</p>
                      </div>

                      <div className="space-y-2">
                        {bookkeepingData.balanceSheet.equity.items.map((equity: any) => (
                          <div key={equity.name} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-lg">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{equity.name}</span>
                            <span className="font-mono text-slate-950 dark:text-slate-100">{formatCurrency(equity.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Liabilities + Equity Summary */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500">Total Liabilities & Equity (B)</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black">
                        {formatCurrency(bookkeepingData.balanceSheet.liabilities.total + bookkeepingData.balanceSheet.equity.total)}
                      </span>
                    </div>

                  </div>

                </div>
              )}

              {/* Sub-tab 2: Trial Balance */}
              {bkSubTab === 'tb' && (
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Trial Balance Sheet</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Double-entry audit check showing ending debit/credit totals across all accounts</p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                          <th className="py-2.5 px-3">Account Ledger Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-right">Debit Balance (INR)</th>
                          <th className="py-2.5 px-3 text-right">Credit Balance (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {bookkeepingData.trialBalance.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-slate-400">
                              No ledger postings recorded in this range.
                            </td>
                          </tr>
                        ) : (
                          bookkeepingData.trialBalance.map((tb: any) => (
                            <tr key={tb.accountName} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{tb.accountName}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-500">{tb.category}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-950 dark:text-slate-200">
                                {tb.balanceType === 'DEBIT' ? formatCurrency(tb.balance) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-950 dark:text-slate-200">
                                {tb.balanceType === 'CREDIT' ? formatCurrency(tb.balance) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                        {/* Trial Balance Total Row */}
                        <tr className="bg-slate-50 dark:bg-slate-950 font-bold border-t-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                          <td colSpan={2} className="py-3 px-3 text-right">Balanced Total:</td>
                          <td className="py-3 px-3 text-right font-mono text-indigo-500">
                            {formatCurrency(bookkeepingData.totalTrialDebit)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-indigo-500">
                            {formatCurrency(bookkeepingData.totalTrialCredit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: General Ledger Audits */}
              {bkSubTab === 'gl' && (
                <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  
                  {/* Account Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">General Ledger Accounts Audit Log</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Chronological audit registries and rolling balances of individual accounts</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Select Account:</span>
                      <select
                        value={selectedGlAccount}
                        onChange={(e) => setSelectedGlAccount(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200 font-semibold"
                      >
                        {Object.keys(bookkeepingData.ledgerDetails).length === 0 ? (
                          <option value="">No Active Accounts</option>
                        ) : (
                          Object.keys(bookkeepingData.ledgerDetails).sort().map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Ledger Details List Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-900 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                          <th className="py-2.5 px-3">Posting Date</th>
                          <th className="py-2.5 px-3">Source Journal</th>
                          <th className="py-2.5 px-3">Description Narration</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3 text-right">Debit (INR)</th>
                          <th className="py-2.5 px-3 text-right">Credit (INR)</th>
                          <th className="py-2.5 px-3 text-right">Rolling Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {!selectedGlAccount || !bookkeepingData.ledgerDetails[selectedGlAccount] || bookkeepingData.ledgerDetails[selectedGlAccount].length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400">
                              No postings recorded for the selected account in this date range.
                            </td>
                          </tr>
                        ) : (
                          bookkeepingData.ledgerDetails[selectedGlAccount].map((p: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 px-3">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-950 dark:text-slate-100">{p.source}</td>
                              <td className="py-2.5 px-3 max-w-[200px] truncate" title={p.narration}>{p.narration}</td>
                              <td className="py-2.5 px-3 font-mono">{p.reference || '-'}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-500">
                                {p.type === 'DEBIT' ? formatCurrency(p.amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-500">
                                {p.type === 'CREDIT' ? formatCurrency(p.amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-200">
                                {formatCurrency(p.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationSettings />
          )}
        </>
      )}

    </div>
  );
}
