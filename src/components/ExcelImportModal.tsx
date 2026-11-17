'use client';

import React, { useState, useRef } from 'react';
import { 
  X, Upload, Download, FileSpreadsheet, CheckCircle2, 
  AlertCircle, AlertTriangle, ArrowRight, RefreshCw, FileText 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchAPI } from '../utils/api';
import { downloadBlob, downloadErrorReport } from '../utils/excel';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleKey: string;
  moduleTitle: string;
  onSuccess: () => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  moduleKey,
  moduleTitle,
  onSuccess
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [commitResult, setCommitResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const blob = await fetchAPI(`/excel/template/${moduleKey}`);
      downloadBlob(blob, `${moduleKey}_template.xlsx`);
    } catch (err: any) {
      alert(err.message || 'Failed to download template.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.match(/\.(xlsx|xls)$/i)) {
        setError('Please select an Excel (.xlsx) file.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (!dropped.name.match(/\.(xlsx|xls)$/i)) {
        setError('Please drop an Excel (.xlsx) file.');
        return;
      }
      setFile(dropped);
      setError(null);
    }
  };

  const handleInspect = async () => {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('finance_jwt_token');
      const response = await fetch(`/api/excel/preview/${moduleKey}`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to parse and validate spreadsheet.');
      }

      const data = await response.json();
      setPreviewData(data);
      setActiveTab(data.invalidCount > 0 ? 'invalid' : 'valid');
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to validate Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || previewData.validRows.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetchAPI(`/excel/commit/${moduleKey}`, {
        method: 'POST',
        bodyData: { validRows: previewData.validRows }
      });

      setCommitResult(res);
      setStep('success');
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (e) {
        // Confetti fallback
      }
    } catch (err: any) {
      setError(err.message || 'Failed to commit import records.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrors = () => {
    if (previewData && previewData.invalidRows) {
      downloadErrorReport(moduleKey, previewData.invalidRows);
    }
  };

  const handleReset = () => {
    setFile(null);
    setStep('upload');
    setPreviewData(null);
    setError(null);
    setCommitResult(null);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  // Rows to display in table based on filter tab
  const displayedRows = previewData ? (
    activeTab === 'valid' ? previewData.validRows :
    activeTab === 'invalid' ? previewData.invalidRows :
    [...previewData.validRows.map((r: any) => ({ ...r, isValid: true })), 
     ...previewData.invalidRows.map((r: any) => ({ ...r, isValid: false }))].sort((a, b) => a.rowNumber - b.rowNumber)
  ) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] fade-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import {moduleTitle} from Excel
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Download the official template, upload your `.xlsx` spreadsheet, preview validations, and commit safely.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD & TEMPLATE */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Template Download Card */}
              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Download Official Excel Template
                  </h4>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                    Use our pre-formatted spreadsheet template with sample rows and header instructions to guarantee error-free importing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template (.xlsx)
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  file
                    ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10'
                    : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-950/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  {file ? (
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB — Click or drag to replace
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Click to browse or drag and drop your completed spreadsheet
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Supports genuine Microsoft Excel (.xlsx) files up to 10 MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rules and Safety Notes */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Security & Financial Integrity:</span>
                <p>• Data will be validated in memory before any change is made to the database.</p>
                <p>• You will see a complete preview of valid vs invalid rows with clear error explanations.</p>
                <p>• Formulas and calculations (GST, TDS, proration) are checked and computed by the backend engine.</p>
                <p>• Duplicate records are automatically detected using unique business identifiers.</p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & ERROR REPORTING */}
          {step === 'preview' && previewData && (
            <div className="space-y-5">
              
              {/* Summary Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Rows Scanned</span>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {previewData.totalRows}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ready to Import (Valid)</span>
                  <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {previewData.validCount}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  previewData.invalidCount > 0 
                    ? 'border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400' 
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400'
                }`}>
                  <span className="text-[10px] font-bold uppercase">Errors Found (Invalid)</span>
                  <p className="text-xl font-bold font-mono mt-0.5">
                    {previewData.invalidCount}
                  </p>
                </div>
              </div>

              {/* Toolbar with Filter Tabs and Error Report Download */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    All Rows ({previewData.totalRows})
                  </button>
                  <button
                    onClick={() => setActiveTab('valid')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      activeTab === 'valid'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Valid Only ({previewData.validCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('invalid')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      activeTab === 'invalid'
                        ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Errors Only ({previewData.invalidCount})
                  </button>
                </div>

                {previewData.invalidCount > 0 && (
                  <button
                    onClick={handleDownloadErrors}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Error Report (.xlsx)
                  </button>
                )}
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950/40">
                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5 w-16 text-center">Excel Row</th>
                        <th className="px-4 py-2.5 w-24 text-center">Status</th>
                        <th className="px-4 py-2.5">Row Summary / Primary Details</th>
                        <th className="px-4 py-2.5">Validation Remarks / Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                            No rows matching the selected view filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((r: any, idx: number) => {
                          const hasErrors = r.errors && r.errors.length > 0;
                          return (
                            <tr 
                              key={`row-${r.rowNumber}-${idx}`}
                              className={hasErrors ? 'bg-rose-500/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'}
                            >
                              <td className="px-4 py-2.5 text-center font-bold text-slate-500">
                                #{r.rowNumber}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {hasErrors ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500">
                                    <AlertCircle className="w-3 h-3" />
                                    Error
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Valid
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                                <div className="space-y-0.5 font-sans">
                                  {Object.entries(r.normalized || r.data || {})
                                    .slice(0, 4)
                                    .map(([k, v]: any) => (
                                      <span key={k} className="inline-block mr-3 text-slate-600 dark:text-slate-400">
                                        <strong className="text-slate-800 dark:text-slate-200">{k}:</strong> {String(v)}
                                      </span>
                                    ))}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-sans">
                                {hasErrors ? (
                                  <ul className="text-rose-500 space-y-0.5 text-[10px] list-disc list-inside">
                                    {r.errors.map((err: string, i: number) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Passed all schema & business validations
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'success' && commitResult && (
            <div className="py-8 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Import Completed Successfully!
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  {commitResult.message || `Successfully committed ${commitResult.count} records into the ledger.`}
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-left space-y-1 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>Module:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{moduleTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span>Records Imported:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{commitResult.count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transaction Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Committed & Verified</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || loading}
                onClick={handleInspect}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Validating Spreadsheet...
                  </>
                ) : (
                  <>
                    Analyze & Preview File
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
              >
                Choose Different File
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={previewData?.validCount === 0 || loading}
                  onClick={handleCommit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Committing Records...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Commit {previewData?.validCount || 0} Valid Record(s)
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Done & Return to Ledger
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
