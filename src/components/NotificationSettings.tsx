'use client';

import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  Bell, 
  Mail, 
  Play, 
  Settings, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LogEntry {
  timestamp: string;
  invoiceNumber: string;
  clientName: string;
  recipient: string;
  amount: number;
  status: string;
}

interface NotificationConfig {
  remindersEnabled: boolean;
  ccAdmin: boolean;
  lastRun: string | null;
  logs: LogEntry[];
}

export default function NotificationSettings() {
  const [config, setConfig] = useState<NotificationConfig>({
    remindersEnabled: true,
    ccAdmin: true,
    lastRun: null,
    logs: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load config & pending reminders
  useEffect(() => {
    loadNotificationData();
  }, []);

  const loadNotificationData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get Settings
      const settingsData = await fetchAPI('/notifications/settings');
      
      // 2. Get Overdue Invoices
      const invoicesData = await fetchAPI('/invoices');
      const today = new Date();
      const overdue = invoicesData.filter((inv: any) => 
        ['UNPAID', 'PARTIALLY_PAID'].includes(inv.status) && 
        new Date(inv.dueDate) < today
      );

      setConfig(settingsData);
      setOverdueInvoices(overdue);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load notifications control configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReminders = () => {
    setConfig(prev => ({ ...prev, remindersEnabled: !prev.remindersEnabled }));
  };

  const handleToggleCcAdmin = () => {
    setConfig(prev => ({ ...prev, ccAdmin: !prev.ccAdmin }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const updated = await fetchAPI('/notifications/settings', {
        method: 'PUT',
        bodyData: {
          remindersEnabled: config.remindersEnabled,
          ccAdmin: config.ccAdmin
        }
      });
      setConfig(prev => ({
        ...prev,
        remindersEnabled: updated.remindersEnabled,
        ccAdmin: updated.ccAdmin
      }));
      
      confetti({
        particleCount: 50,
        spread: 40,
        origin: { y: 0.8 }
      });
    } catch (err: any) {
      alert(err.message || 'Failed to save notifications settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerScannerNow = async () => {
    setTriggering(true);
    try {
      const result = await fetchAPI('/notifications/trigger-reminders', {
        method: 'POST'
      });
      setConfig(prev => ({
        ...prev,
        lastRun: new Date().toISOString(),
        logs: result.logs || []
      }));
      
      alert(result.message || 'Past-due invoice reminder scan complete.');
      loadNotificationData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger past-due reminders scan.');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center space-y-3">
        <span className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
        <span className="text-xs text-slate-400 font-medium">Loading notifications configuration panel...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in text-xs">
      
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Configuration settings panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <Settings className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Reminder Automation Settings</h3>
            </div>

            {/* Toggle 1: Auto reminders */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Automatic Overdue Scanner</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Runs daily scan for invoices past their due date</span>
              </div>
              <button
                onClick={handleToggleReminders}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                  config.remindersEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    config.remindersEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Admin copy */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">CC Admin Mailbox</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Sends a duplicate tracking copy to the administrative log</span>
              </div>
              <button
                onClick={handleToggleCcAdmin}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                  config.ccAdmin ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    config.ccAdmin ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Quick manual triggers */}
          <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <Play className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Manual Scanner Control</h3>
            </div>

            <p className="text-[10px] text-slate-400">
              Forced trigger runs a database scan, processes email templates with overdue statements, and dispatches them via SMTP immediately.
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Last Run Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {config.lastRun ? new Date(config.lastRun).toLocaleString('en-IN') : 'Never Run'}
                </span>
              </div>
            </div>

            <button
              onClick={handleTriggerScannerNow}
              disabled={triggering}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold rounded-lg cursor-pointer disabled:opacity-50"
            >
              {triggering ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running Scan...
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Run Overdue Scanner Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Pending Reminders Preview & Dispatch Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Overdue Queue List */}
          <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Pending Reminders Queue ({overdueInvoices.length})</h3>
              </div>
              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded text-[9px] font-bold uppercase select-none">
                Overdue Outstanding
              </span>
            </div>

            <div className="overflow-x-auto max-h-[220px] border border-slate-200 dark:border-slate-900 rounded-lg">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Client</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {overdueInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400">
                        No outstanding past-due invoices inside the ledger. Good job!
                      </td>
                    </tr>
                  ) : (
                    overdueInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-slate-700 dark:text-slate-300">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3">{inv.client?.companyName}</td>
                        <td className="py-2 px-3 text-rose-500">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-3 text-right font-bold font-mono">
                          ₹{inv.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Execution dispatch logs */}
          <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Reminder Email Audit Log</h3>
              </div>
              <span className="text-[10px] text-slate-400">Shows recent emails processed</span>
            </div>

            <div className="overflow-x-auto max-h-[220px] border border-slate-200 dark:border-slate-900 rounded-lg">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900 font-bold">
                    <th className="py-2 px-3">Date & Time</th>
                    <th className="py-2 px-3">Invoice</th>
                    <th className="py-2 px-3">Client</th>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-3 text-right">Value</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {config.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        No reminders have been logged as dispatched yet.
                      </td>
                    </tr>
                  ) : (
                    config.logs.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-slate-700 dark:text-slate-300">
                        <td className="py-2 px-3 text-slate-400">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{log.invoiceNumber}</td>
                        <td className="py-2 px-3 truncate max-w-[80px]" title={log.clientName}>{log.clientName}</td>
                        <td className="py-2 px-3 font-mono">{log.recipient}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">₹{log.amount.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : log.status === 'SIMULATED'
                              ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
