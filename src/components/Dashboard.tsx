'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Scale,
  IndianRupee, 
  Percent, 
  ClipboardList, 
  ArrowUpRight, 
  Plus, 
  Users,
  AlertCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  invoices: any[];
  clients: any[];
  expenses: any[];
  user?: any;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ invoices, clients, expenses, user, onNavigate }: DashboardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute metrics
  const totalSubtotal = invoices.reduce((sum, inv) => sum + inv.subTotal, 0);
  const totalReceivable = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalCGST = invoices.reduce((sum, inv) => sum + inv.cgst, 0);
  const totalSGST = invoices.reduce((sum, inv) => sum + inv.sgst, 0);
  const totalIGST = invoices.reduce((sum, inv) => sum + inv.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const totalTDS = invoices.reduce((sum, inv) => sum + inv.tdsAmount, 0);

  const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
  const unpaidInvoices = invoices.filter(inv => inv.status === 'UNPAID');

  const pendingAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const receivedAmount = paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const cashNetProfit = receivedAmount - totalExpenses;
  const accrualNetProfit = totalReceivable - totalExpenses;

  // Chart data: monthly trend
  const getTrendData = () => {
    const monthlyData: { [key: string]: { month: string; Revenue: number; Net: number } } = {};
    
    // Sort invoices chronologically
    const sorted = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(inv => {
      const d = new Date(inv.date);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, Revenue: 0, Net: 0 };
      }
      monthlyData[key].Revenue += inv.subTotal;
      monthlyData[key].Net += inv.totalAmount;
    });

    const data = Object.values(monthlyData);
    return data.length > 0 ? data : [{ month: 'No Data', Revenue: 0, Net: 0 }];
  };

  // Chart data: GST vs TDS
  const getTaxData = () => {
    return [
      { name: 'CGST', Amount: totalCGST },
      { name: 'SGST', Amount: totalSGST },
      { name: 'IGST', Amount: totalIGST },
      { name: 'TDS', Amount: totalTDS }
    ];
  };

  // Chart data: Expense categories breakdown
  const getExpenseCategoryData = () => {
    const categoriesMap: { [key: string]: number } = {};
    expenses.forEach(exp => {
      categoriesMap[exp.category] = (categoriesMap[exp.category] || 0) + exp.amount;
    });
    const data = Object.entries(categoriesMap).map(([name, value]) => ({ name, value }));
    return data.length > 0 ? data : [{ name: 'No Expenses', value: 0.1 }];
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#06b6d4', '#64748b'];

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time billing activity, taxes ledger, and earnings overview.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onNavigate('clients')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            Manage Clients
          </button>
          {user?.role !== 'USER' && (
            <button 
              onClick={() => onNavigate('create-invoice')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gross Billings</span>
              <h3 className="text-xl font-bold tracking-tight">₹{totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400">
            <span>Pre-tax: ₹{totalSubtotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Outflows</span>
              <h3 className="text-xl font-bold tracking-tight">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400">
            <span>Total logged business expenses</span>
          </div>
        </div>

        {/* Net Cash Flow / Profit */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Net Cash Profit</span>
              <h3 className={`text-xl font-bold tracking-tight ${cashNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                ₹{cashNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className={`p-2.5 rounded-lg ${cashNetProfit >= 0 ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400">
            <span>Collections minus total outflows</span>
          </div>
        </div>

        {/* Taxes Collected */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">GST Collected</span>
              <h3 className="text-xl font-bold tracking-tight">₹{totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-[10px] text-slate-400 gap-2">
            <span>CGST+SGST: ₹{(totalCGST+totalSGST).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Outstanding / Payment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Total Payments Received</span>
            <h4 className="text-lg font-bold text-emerald-500">₹{receivedAmount.toLocaleString('en-IN')}</h4>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
            {invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0}% Paid
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Pending Receivables</span>
            <h4 className="text-lg font-bold text-rose-500">₹{pendingAmount.toLocaleString('en-IN')}</h4>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-rose-500/10 text-rose-500 rounded-full">
            {invoices.length > 0 ? Math.round((unpaidInvoices.length / invoices.length) * 100) : 0}% Outstanding
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area Chart */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Earning & Billing Trend</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparison between Subtotal values and Final Receivables</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getTrendData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="month" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff'
                  }} 
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Gross Revenue" />
                <Area type="monotone" dataKey="Net" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" name="Net Payable" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Breakdown Chart */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Expense Categories</h3>
            <p className="text-xs text-slate-400 mt-0.5">Budget allocation of business expenditures</p>
          </div>
          <div className="h-64 w-full flex flex-col items-center justify-center relative">
            {expenses.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">No logged expenses found.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={getExpenseCategoryData()}
                      cx="50%"
                      cy="48%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {getExpenseCategoryData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`}
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        borderRadius: '8px',
                        fontSize: '10px',
                        color: '#fff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1 justify-center max-h-16 overflow-y-auto px-1 pt-1.5 border-t border-slate-200 dark:border-slate-800 w-full">
                  {getExpenseCategoryData().map((entry, index) => (
                    entry.value > 0.1 && (
                      <div key={entry.name} className="flex items-center gap-1 text-[9px] font-semibold text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        <span>{entry.name} (₹{Math.round(entry.value).toLocaleString('en-IN')})</span>
                      </div>
                    )
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* P&L Statement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Taxes Breakdown Bar Chart */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Taxes Ledger Breakdown</h3>
            <p className="text-xs text-slate-400 mt-0.5">Taxes collected vs TDS deducted</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getTaxData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff'
                  }} 
                />
                <Bar dataKey="Amount" fill="#6366f1" radius={[4, 4, 0, 0]} name="Value (₹)" maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit & Loss Statement table */}
        <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Profit & Loss Statement</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparison between Accrual-basis billing and Cash-basis inflows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5">Financial Metric</th>
                  <th className="py-2.5 text-right">Accrual Basis</th>
                  <th className="py-2.5 text-right">Cash Basis</th>
                  <th className="py-2.5 text-slate-400 font-normal pl-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                <tr className="hover:bg-slate-50/20">
                  <td className="py-3 font-semibold text-slate-900 dark:text-slate-200">Total Revenue</td>
                  <td className="py-3 text-right font-mono font-medium">₹{totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right font-mono font-medium">₹{receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-slate-400 pl-4">Invoiced totals (Accrual) vs actual money collected (Cash)</td>
                </tr>
                <tr className="hover:bg-slate-50/20">
                  <td className="py-3 font-semibold text-slate-900 dark:text-slate-200">Total Expenses</td>
                  <td className="py-3 text-right font-mono font-medium text-rose-500 dark:text-rose-400">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right font-mono font-medium text-rose-500 dark:text-rose-400">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-slate-400 pl-4">All business expenditures logged in the ledger</td>
                </tr>
                <tr className="bg-slate-50/40 dark:bg-slate-900/10 font-bold">
                  <td className="py-3.5 text-slate-950 dark:text-slate-100">Net Profit</td>
                  <td className={`py-3.5 text-right font-mono ${accrualNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ₹{accrualNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3.5 text-right font-mono ${cashNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ₹{cashNetProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 text-slate-400 font-normal pl-4">Current operating profit margin</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Recent Invoices</h3>
          <button 
            onClick={() => onNavigate('invoices')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-400 flex items-center gap-0.5 cursor-pointer"
          >
            View All
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-500" />
            <span>No invoices found. Create your first invoice to populate statistics!</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3">Invoice Number</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Net Amount</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {invoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-950 dark:text-slate-200">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{inv.client?.companyName}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-900 dark:text-slate-200">
                      ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        inv.status === 'PAID' 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : inv.status === 'UNPAID'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
