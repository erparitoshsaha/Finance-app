'use client';

import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  Plus, Search, Mail, Trash2, Edit3, X, AlertTriangle, 
  Download, Upload, CheckCircle, Clock, Calendar, Users, 
  CreditCard, ShieldAlert, BadgeInfo 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Payroll() {
  const [activeTab, setActiveTab] = useState<'employees' | 'run-payroll' | 'payslips'>('employees');
  const [employees, setEmployees] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search and Filter states
  const [empSearch, setEmpSearch] = useState('');
  const [payslipSearch, setPayslipSearch] = useState('');
  const [selectedPayslipMonth, setSelectedPayslipMonth] = useState('ALL');
  const [selectedPayslipYear, setSelectedPayslipYear] = useState('ALL');

  // Employee Modal state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isEmployeeImportOpen, setIsEmployeeImportOpen] = useState(false);
  const [isPayslipImportOpen, setIsPayslipImportOpen] = useState(false);
  
  // Employee Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [pan, setPan] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');

  // Run Payroll Form State
  const [runEmployeeId, setRunEmployeeId] = useState('');
  const [runMonth, setRunMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [runYear, setRunYear] = useState(() => new Date().getFullYear().toString());
  const [runPaidDays, setRunPaidDays] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState('');

  // Live Payroll Preview calculations
  const [previewData, setPreviewData] = useState<any>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await fetchAPI('/employees');
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch employees.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const data = await fetchAPI('/payroll/payslips');
      setPayslips(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payslips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchPayslips();
  }, []);

  // Recalculate Live Preview data
  useEffect(() => {
    if (!runEmployeeId || !runPaidDays) {
      setPreviewData(null);
      return;
    }

    const selectedEmp = employees.find(e => e.id === runEmployeeId);
    if (!selectedEmp) {
      setPreviewData(null);
      return;
    }

    const totalDaysInMonth = new Date(Number(runYear), Number(runMonth), 0).getDate();
    const paid = Math.min(Number(runPaidDays), totalDaysInMonth);
    const prorationFactor = paid / totalDaysInMonth;

    const base = selectedEmp.baseSalary;
    const allowancesAmt = selectedEmp.allowances || 0;
    const deductionsAmt = selectedEmp.deductions || 0;

    const grossEarnings = Math.round((base + allowancesAmt) * prorationFactor * 100) / 100;
    const totalDeductions = Math.round(deductionsAmt * prorationFactor * 100) / 100;
    const netSalary = Math.round((grossEarnings - totalDeductions) * 100) / 100;

    setPreviewData({
      totalDaysInMonth,
      paidDays: paid,
      prorationFactor,
      grossEarnings,
      totalDeductions,
      netSalary
    });
  }, [runEmployeeId, runMonth, runYear, runPaidDays, employees]);

  const openAddEmployeeModal = () => {
    setEditingEmployee(null);
    setName('');
    setEmail('');
    setDesignation('');
    setDepartment('');
    setPan('');
    setBankAccount('');
    setIfscCode('');
    setBaseSalary('');
    setAllowances('');
    setDeductions('');
    setError('');
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp: any) => {
    setEditingEmployee(emp);
    setName(emp.name || '');
    setEmail(emp.email || '');
    setDesignation(emp.designation || '');
    setDepartment(emp.department || '');
    setPan(emp.pan || '');
    setBankAccount(emp.bankAccount || '');
    setIfscCode(emp.ifscCode || '');
    setBaseSalary(emp.baseSalary?.toString() || '');
    setAllowances(emp.allowances?.toString() || '0');
    setDeductions(emp.deductions?.toString() || '0');
    setError('');
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !designation || !baseSalary) {
      setError('Name, email, designation, and base salary are required.');
      return;
    }

    setLoading(true);
    setError('');

    const bodyData = {
      name,
      email,
      designation,
      department,
      pan,
      bankAccount,
      ifscCode,
      baseSalary: Number(baseSalary),
      allowances: Number(allowances || 0),
      deductions: Number(deductions || 0)
    };

    try {
      if (editingEmployee) {
        await fetchAPI(`/employees/${editingEmployee.id}`, {
          method: 'PUT',
          bodyData
        });
      } else {
        await fetchAPI('/employees', {
          method: 'POST',
          bodyData
        });
      }
      setIsEmployeeModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || 'Failed to save employee profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee? This will purge all associated payslips.')) {
      return;
    }
    try {
      await fetchAPI(`/employees/${id}`, { method: 'DELETE' });
      fetchEmployees();
      fetchPayslips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee profile.');
    }
  };

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runEmployeeId || !runMonth || !runYear || !runPaidDays) {
      setRunError('Please select employee, month, year, and enter paid days.');
      return;
    }

    setRunLoading(true);
    setRunError('');

    try {
      await fetchAPI('/payroll/generate', {
        method: 'POST',
        bodyData: {
          employeeId: runEmployeeId,
          month: Number(runMonth),
          year: Number(runYear),
          paidDays: Number(runPaidDays)
        }
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Clear run state
      setRunEmployeeId('');
      setRunPaidDays('');
      
      // Refresh & Navigate
      fetchPayslips();
      setActiveTab('payslips');
    } catch (err: any) {
      setRunError(err.message || 'Failed to generate payslip.');
    } finally {
      setRunLoading(false);
    }
  };

  const handleDeletePayslip = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payslip record?')) {
      return;
    }
    try {
      await fetchAPI(`/payroll/${id}`, { method: 'DELETE' });
      fetchPayslips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payslip.');
    }
  };

  const handleTogglePayslipStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    try {
      await fetchAPI(`/payroll/${id}/status`, {
        method: 'PUT',
        bodyData: { status: nextStatus }
      });
      fetchPayslips();
    } catch (err: any) {
      alert(err.message || 'Failed to update payslip status.');
    }
  };

  const handleDownloadPDF = async (id: string, empName: string, monthNum: number, yearNum: number) => {
    try {
      const blob = await fetchAPI(`/payroll/${id}/pdf`, { method: 'GET' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileMonth = MONTHS[monthNum - 1].toLowerCase();
      link.setAttribute('download', `payslip-${empName.replace(/\s+/g, '-').toLowerCase()}-${fileMonth}-${yearNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to download payslip PDF.');
    }
  };

  // Filter Employees
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.designation.toLowerCase().includes(empSearch.toLowerCase())
  );

  // Filter Payslips
  const filteredPayslips = payslips.filter(ps => {
    const matchesSearch = ps.employee?.name.toLowerCase().includes(payslipSearch.toLowerCase()) ||
      ps.employee?.designation.toLowerCase().includes(payslipSearch.toLowerCase());
    
    const matchesMonth = selectedPayslipMonth === 'ALL' || ps.month === Number(selectedPayslipMonth);
    const matchesYear = selectedPayslipYear === 'ALL' || ps.year === Number(selectedPayslipYear);

    return matchesSearch && matchesMonth && matchesYear;
  });

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Payroll & Salary Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage staff directory, run monthly pay configurations, and print PDF payslips.
          </p>
        </div>
        {activeTab === 'employees' && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => downloadExcel('/employees/export', `employees_${new Date().toISOString().split('T')[0]}.xlsx`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title="Export staff directory to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Directory</span>
            </button>
            <button
              onClick={() => setIsEmployeeImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title="Bulk import staff profiles from Excel"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Import Staff</span>
            </button>
            <button
              onClick={openAddEmployeeModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Staff Member
            </button>
          </div>
        )}
        {activeTab === 'payslips' && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => downloadExcel(`/payroll/payslips/export?month=${selectedPayslipMonth}&year=${selectedPayslipYear}`, `payslips_${selectedPayslipMonth}_${selectedPayslipYear}.xlsx`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title="Export payslip journal to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Payslips</span>
            </button>
            <button
              onClick={() => setIsPayslipImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              title="Bulk import payslips from Excel"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Import Payslips</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs subnavigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold cursor-pointer text-xs ${
            activeTab === 'employees'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory
        </button>
        <button
          onClick={() => setActiveTab('run-payroll')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold cursor-pointer text-xs ${
            activeTab === 'run-payroll'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Run Monthly Payroll
        </button>
        <button
          onClick={() => setActiveTab('payslips')}
          className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-semibold cursor-pointer text-xs ${
            activeTab === 'payslips'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payslip Journal
        </button>
      </div>

      {/* Tab: Employees Directory */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, designation..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <Users className="w-8 h-8 text-slate-500" />
              <span>No staff member records found.</span>
            </div>
          ) : (
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Employee Name</th>
                      <th className="px-5 py-3">Designation</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3 text-right">Base Salary</th>
                      <th className="px-5 py-3 text-right">Allowances</th>
                      <th className="px-5 py-3 text-right">Deductions</th>
                      <th className="px-5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-200">
                          <div>{emp.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.email}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-800 dark:text-slate-300">{emp.designation}</td>
                        <td className="px-5 py-3.5 text-slate-450 dark:text-slate-450">{emp.department || '-'}</td>
                        <td className="px-5 py-3.5 text-slate-450 font-mono">
                          <div>PAN: {emp.pan || '-'}</div>
                          <div className="text-[10px] mt-0.5">A/C: {emp.bankAccount || '-'}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold font-mono text-slate-800 dark:text-slate-200">₹{emp.baseSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-500">+₹{emp.allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-500 dark:text-rose-400">-₹{emp.deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditEmployeeModal(emp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Run Monthly Payroll */}
      {activeTab === 'run-payroll' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Side */}
          <div className="md:col-span-2 glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white/40 dark:bg-slate-950/20">
            <h2 className="text-md font-bold mb-4 text-slate-900 dark:text-slate-200">Generate Salary Sheet</h2>
            {runError && (
              <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold">
                {runError}
              </div>
            )}
            <form onSubmit={handleRunPayroll} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Select Employee *</label>
                <select
                  value={runEmployeeId}
                  required
                  onChange={(e) => setRunEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-300"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Month *</label>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-350"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={(idx + 1).toString()}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Year *</label>
                  <select
                    value={runYear}
                    onChange={(e) => setRunYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-350"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Paid Days / Attendance *</label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    step="any"
                    required
                    placeholder="e.g. 30"
                    value={runPaidDays}
                    onChange={(e) => setRunPaidDays(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={runLoading || !runEmployeeId || !runPaidDays}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {runLoading ? 'Generating...' : 'Generate Pay Sheet'}
                </button>
              </div>
            </form>
          </div>

          {/* Real-time Calculation Summary Side */}
          <div className="glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50/40 dark:bg-slate-900/10 flex flex-col justify-between">
            <div>
              <h2 className="text-md font-bold mb-4 text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                <BadgeInfo className="w-4 h-4 text-slate-450" />
                Live Payroll Invoice Detail
              </h2>
              {previewData ? (
                <div className="space-y-3 font-semibold text-slate-600 dark:text-slate-450">
                  <div className="flex justify-between">
                    <span>Days in Month:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">{previewData.totalDaysInMonth} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proration Factor:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">{(previewData.prorationFactor * 100).toFixed(1)}%</span>
                  </div>
                  <hr className="border-slate-200 dark:border-slate-800" />
                  <div className="flex justify-between">
                    <span>Gross Earnings:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">₹{previewData.grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-rose-500">
                    <span>Tax & PF Deductions:</span>
                    <span className="font-mono">-₹{previewData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <hr className="border-slate-200 dark:border-slate-800" />
                  <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 font-bold">
                    <span>Take-Home Pay:</span>
                    <span className="text-lg font-mono">₹{previewData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic text-center py-10">
                  Please select an employee and enter attendance details to calculate live parameters.
                </div>
              )}
            </div>
            
            <div className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
              Base salary and HRA calculations are adjusted based on working days proration. Deductions are subtracted as defined in the profile.
            </div>
          </div>
        </div>
      )}

      {/* Tab: Payslips Journal */}
      {activeTab === 'payslips' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search payslips by employee..."
                value={payslipSearch}
                onChange={(e) => setPayslipSearch(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={selectedPayslipMonth}
                onChange={(e) => setSelectedPayslipMonth(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-600 dark:text-slate-300"
              >
                <option value="ALL">All Months</option>
                {MONTHS.map((m, idx) => (
                  <option key={m} value={(idx + 1).toString()}>{m}</option>
                ))}
              </select>

              <select
                value={selectedPayslipYear}
                onChange={(e) => setSelectedPayslipYear(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-600 dark:text-slate-300"
              >
                <option value="ALL">All Years</option>
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredPayslips.length === 0 ? (
            <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <CreditCard className="w-8 h-8 text-slate-500" />
              <span>No payslips found matching the criteria.</span>
            </div>
          ) : (
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Employee Name</th>
                      <th className="px-5 py-3">Pay Run Month</th>
                      <th className="px-5 py-3">Attendance</th>
                      <th className="px-5 py-3 text-right">Gross Earnings</th>
                      <th className="px-5 py-3 text-right">Total Deductions</th>
                      <th className="px-5 py-3 text-right">Net Payout</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {filteredPayslips.map((ps) => (
                      <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-200">
                          <div>{ps.employee?.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ps.employee?.designation}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-800 dark:text-slate-300 font-medium">
                          {MONTHS[ps.month - 1]} {ps.year}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-450">
                          {ps.paidDays} Days
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-800 dark:text-slate-200">₹{ps.grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-500 dark:text-rose-450">-₹{ps.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5 text-right font-bold font-mono text-slate-950 dark:text-slate-100">
                          ₹{ps.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleTogglePayslipStatus(ps.id, ps.status)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                              ps.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                            }`}
                            title="Click to toggle payment status"
                          >
                            {ps.status === 'PAID' ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Paid
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDownloadPDF(ps.id, ps.employee?.name || 'employee', ps.month, ps.year)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded transition-colors cursor-pointer"
                              title="Download Payslip PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayslip(ps.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Delete Pay Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Employee Modal overlay */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h2 className="text-md font-bold text-slate-950 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-slate-400" />
                {editingEmployee ? 'Edit Employee Profile' : 'Add Staff Member'}
              </h2>
              <button 
                onClick={() => setIsEmployeeModalOpen(false)}
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

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paritosh Saha"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. employee@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Software Engineer"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering, Sales"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Base Salary *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0.00"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Allowances</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. HRA, Special"
                    value={allowances}
                    onChange={(e) => setAllowances(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Deductions</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. PF, Tax"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-450" />
                  Statutory & Bank Transfer Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Employee PAN</label>
                    <input
                      type="text"
                      placeholder="PAN Number"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Bank Account No.</label>
                    <input
                      type="text"
                      placeholder="Account Number"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">Bank IFSC Code</label>
                    <input
                      type="text"
                      placeholder="IFSC Code"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Employee Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Directory Excel Import Modal */}
      <ExcelImportModal
        isOpen={isEmployeeImportOpen}
        onClose={() => setIsEmployeeImportOpen(false)}
        moduleKey="employees"
        moduleTitle="Staff Directory"
        onSuccess={fetchEmployees}
      />

      {/* Payslip Journal Excel Import Modal */}
      <ExcelImportModal
        isOpen={isPayslipImportOpen}
        onClose={() => setIsPayslipImportOpen(false)}
        moduleKey="payslips"
        moduleTitle="Payslips"
        onSuccess={fetchPayslips}
      />
    </div>
  );
}
