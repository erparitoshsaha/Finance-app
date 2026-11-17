'use client';

import React, { useEffect, useState } from 'react';
import { fetchAPI, removeToken, getToken } from '../utils/api';
import Auth from '../components/Auth';
import Dashboard from '../components/Dashboard';
import Clients from '../components/Clients';
import Invoices from '../components/Invoices';
import CreateInvoice from '../components/CreateInvoice';
import Expenses from '../components/Expenses';
import Payroll from '../components/Payroll';
import Inventory from '../components/Inventory';
import Reports from '../components/Reports';
import Suppliers from '../components/Suppliers';
import Vouchers from '../components/Vouchers';

import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  PlusCircle, 
  LogOut, 
  Sun, 
  Moon, 
  ShieldCheck,
  Menu,
  X,
  Wallet,
  CreditCard,
  Archive,
  TrendingUp,
  Truck,
  BookOpen
} from 'lucide-react';

type Tab = 'dashboard' | 'clients' | 'invoices' | 'create-invoice' | 'expenses' | 'payroll' | 'inventory' | 'reports' | 'suppliers' | 'vouchers';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Theme and UI States
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [initializing, setInitializing] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Authenticate session on boot
  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      if (token) {
        try {
          const profile = await fetchAPI('/auth/me');
          setUser(profile.user);
          await loadData();
        } catch (err) {
          removeToken();
        }
      }
      setInitializing(false);
    }
    checkAuth();
  }, []);

  // Set initial theme class on HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark', 'dark-theme');
    } else {
      root.classList.remove('dark', 'dark-theme');
    }
  }, [theme]);

  // Load clients, invoices, expenses, and suppliers in parallel
  const loadData = async () => {
    setDataLoading(true);
    try {
      const [clientsData, invoicesData, expensesData, suppliersData] = await Promise.all([
        fetchAPI('/clients'),
        fetchAPI('/invoices'),
        fetchAPI('/expenses'),
        fetchAPI('/suppliers')
      ]);
      setClients(clientsData);
      setInvoices(invoicesData);
      setExpenses(expensesData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleAuthSuccess = (authUser: any) => {
    setUser(authUser);
    loadData();
  };

  const handleLogout = () => {
    removeToken();
    setUser(null);
    setClients([]);
    setInvoices([]);
    setExpenses([]);
    setSuppliers([]);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13]">
        <span className="w-9 h-9 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  // Not logged in -> Auth Screen
  if (!user) {
    return <Auth onSuccess={handleAuthSuccess} />;
  }

  // Dynamic nav configuration based on user roles (Guaranteed to have user here)
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients Directory', icon: Users },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Truck },
    { id: 'invoices', label: 'Invoice Ledger', icon: FileText },
    ...(user.role !== 'USER' ? [{ id: 'create-invoice', label: 'New Invoice', icon: PlusCircle }] : []),
    { id: 'inventory', label: 'Inventory Manager', icon: Archive },
    { id: 'expenses', label: 'Expenses Log', icon: Wallet },
    ...(user.role === 'ADMIN' ? [{ id: 'payroll', label: 'Payroll & Salary', icon: CreditCard }] : []),
    { id: 'reports', label: 'Financial Reports', icon: TrendingUp },
    { id: 'vouchers', label: 'Voucher Ledger', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 dark:bg-[#080d19] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* Mobile Topbar */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">FINANCE APP</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-900 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand details */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center shadow shadow-indigo-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">FINANCE APP</span>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 py-6 px-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as Tab);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer profile & logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-900 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="truncate text-xs">
              <p className="font-semibold truncate text-slate-900 dark:text-slate-200">{user.name}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                user.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-500' :
                user.role === 'ACCOUNTANT' ? 'bg-emerald-500/10 text-emerald-500' :
                'bg-slate-500/10 text-slate-400'
              }`}>
                {user.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile menu */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs md:hidden"
        ></div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 p-6 md:p-8 max-h-screen overflow-y-auto">
        {dataLoading && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel text-[10px] font-semibold border border-indigo-500/20 text-indigo-500 shadow-md">
            <span className="w-3 h-3 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></span>
            Syncing Ledger...
          </div>
        )}

        <div className="max-w-6xl mx-auto h-full">
          {activeTab === 'dashboard' && (
            <Dashboard 
              invoices={invoices} 
              clients={clients} 
              expenses={expenses}
              user={user}
              onNavigate={(tab) => setActiveTab(tab as Tab)} 
            />
          )}

          {activeTab === 'clients' && (
            <Clients 
              clients={clients} 
              onRefresh={loadData} 
              user={user}
            />
          )}

          {activeTab === 'invoices' && (
            <Invoices 
              invoices={invoices} 
              onRefresh={loadData}
              user={user}
              onNavigate={(tab) => setActiveTab(tab as Tab)}
            />
          )}

          {activeTab === 'create-invoice' && (
            <CreateInvoice 
              clients={clients} 
              onSuccess={() => {
                loadData();
                setActiveTab('invoices');
              }}
              onNavigate={(tab) => setActiveTab(tab as Tab)}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses 
              expenses={expenses} 
              onRefresh={loadData} 
              user={user}
            />
          )}

          {activeTab === 'payroll' && (
            <Payroll />
          )}

          {activeTab === 'inventory' && (
            <Inventory 
              onNavigate={(tab) => setActiveTab(tab as Tab)} 
              user={user}
            />
          )}

          {activeTab === 'reports' && (
            <Reports />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers 
              suppliers={suppliers}
              onRefresh={loadData}
              user={user}
            />
          )}

          {activeTab === 'vouchers' && (
            <Vouchers 
              user={user}
            />
          )}
        </div>
      </main>

    </div>
  );
}
