'use client';

import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  X, Calendar, Download, Scale, ArrowUpRight, 
  TrendingDown, TrendingUp, RefreshCw, AlertCircle, 
  Printer, Mail, Phone, MapPin, FileSpreadsheet
} from 'lucide-react';
import { downloadExcel } from '../utils/excel';

interface ClientStatementProps {
  client: any;
  onClose: () => void;
}

type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'custom';

export default function ClientStatement({ client, onClose }: ClientStatementProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Data states
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  // Helper to get dates for presets (Indian Financial style)
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

  // Synchronize dates when preset changes
  useEffect(() => {
    if (datePreset !== 'custom') {
      const dates = getPresetDates(datePreset);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [datePreset]);

  // Load statement details
  const loadStatement = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);
    try {
      const params = `?startDate=${startDate}&endDate=${endDate}`;
      const data = await fetchAPI(`/clients/${client.id}/statement${params}`);
      setStatementData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load statement details.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger load
  useEffect(() => {
    if (startDate && endDate) {
      loadStatement();
    }
  }, [startDate, endDate]);

  // Download PDF statement
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const params = `?startDate=${startDate}&endDate=${endDate}`;
      const blob = await fetchAPI(`/clients/${client.id}/statement/pdf${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Statement_${client.companyName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF statement.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start md:items-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-up my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <div>
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block">Ledger Audit Panel</span>
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
              Statement of Account - {client.companyName}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/20 text-xs">
          
          {/* Date presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['this-month', 'last-month', 'this-quarter', 'this-fy', 'custom'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-md font-semibold text-[10px] uppercase tracking-wide transition-all cursor-pointer ${
                  datePreset === preset
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                }`}
              >
                {preset.replace('-', ' ')}
              </button>
            ))}

            {datePreset === 'custom' && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded text-[10px] font-mono">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadStatement}
              title="Reload Statement"
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => downloadExcel(`/clients/${client.id}/statement/excel?startDate=${startDate}&endDate=${endDate}`, `Statement_${client.companyName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.xlsx`)}
              disabled={loading || !statementData}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-[10px] tracking-wider uppercase transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || loading || !statementData}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[10px] tracking-wider uppercase transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Exporting PDF...' : 'Download Statement PDF'}
            </button>
          </div>

        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-24 space-y-3">
              <span className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
              <span className="text-xs text-slate-400 font-medium">Computing account ledger...</span>
            </div>
          ) : (
            statementData && (
              <div className="space-y-6">
                
                {/* Contact details & balances row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Account detail profile */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-2 text-[10px] md:col-span-1">
                    <h4 className="font-bold text-[10px] text-indigo-500 uppercase tracking-wider">Recipient Details</h4>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{client.companyName}</h3>
                    <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                      {client.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span>{client.address}, {client.city || ''}, {client.state}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.gstin && (
                        <div className="flex items-center gap-1.5 font-mono text-[9px]">
                          <span className="bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded font-semibold">GSTIN</span>
                          <span>{client.gstin}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-3 md:col-span-2 flex flex-col justify-between">
                    <h4 className="font-bold text-[10px] text-indigo-500 uppercase tracking-wider">Account Ledger Summary</h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Opening Balance</span>
                        <h4 className="font-bold font-mono text-slate-850 dark:text-slate-200">{formatCurrency(statementData.openingBalance)}</h4>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Total Invoiced (+)</span>
                        <h4 className="font-bold font-mono text-rose-500">{formatCurrency(statementData.totalDebits)}</h4>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Total Paid (-)</span>
                        <h4 className="font-bold font-mono text-emerald-500">{formatCurrency(statementData.totalCredits)}</h4>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Balance Due</span>
                        <h4 className={`font-black font-mono text-xs ${statementData.closingBalance > 0 ? 'text-indigo-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatCurrency(statementData.closingBalance)}
                        </h4>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Ledger Transactions Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] text-indigo-500 uppercase tracking-wider">Chronological Ledger Records</h4>
                  
                  <div className="border border-slate-200 dark:border-slate-900 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 font-bold">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Particulars / Description</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3 text-right">Debit (+)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-)</th>
                          <th className="py-2.5 px-3 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {statementData.ledger.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                              No ledger entries found in the selected date range.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {/* Opening Balance Row */}
                            <tr className="bg-slate-100/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 font-semibold italic">
                              <td className="py-2 px-3">{startDate}</td>
                              <td className="py-2 px-3">Brought Forward Opening Balance</td>
                              <td className="py-2 px-3">-</td>
                              <td className="py-2 px-3 text-right">-</td>
                              <td className="py-2 px-3 text-right">-</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(statementData.openingBalance)}</td>
                            </tr>

                            {/* Ledger Entries */}
                            {statementData.ledger.map((row: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 text-slate-700 dark:text-slate-300">
                                <td className="py-2.5 px-3">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">{row.description}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[9px] text-slate-500">{row.reference || '-'}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-500">
                                  {row.type === 'DEBIT' ? formatCurrency(row.amount) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-500">
                                  {row.type === 'CREDIT' ? formatCurrency(row.amount) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                                  {formatCurrency(row.runningBalance)}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
