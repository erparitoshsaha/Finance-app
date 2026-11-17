'use client';

import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { Plus, Trash2, Calendar, ClipboardList, User, Percent, Receipt, IndianRupee, ArrowLeft, Shield, Barcode } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CreateInvoiceProps {
  clients: any[];
  onSuccess: () => void;
  onNavigate: (tab: string) => void;
}

interface InvoiceItemField {
  productId?: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number; // e.g. 18
}

const TDS_SECTIONS = [
  { id: '194C_INDIVIDUAL', label: 'Sec 194C (Contractor - Individual/HUF)', rate: 1, section: '194C' },
  { id: '194C_COMPANY', label: 'Sec 194C (Contractor - Company/Others)', rate: 2, section: '194C' },
  { id: '194I_MACHINERY', label: 'Sec 194I (Rent - Plant & Machinery)', rate: 2, section: '194I' },
  { id: '194I_LAND_BUILDING', label: 'Sec 194I (Rent - Land/Building/Furniture)', rate: 10, section: '194I' },
  { id: '194J_TECHNICAL', label: 'Sec 194J (Technical/Call Center/Royalty)', rate: 2, section: '194J' },
  { id: '194J_PROFESSIONAL', label: 'Sec 194J (Professional/Director Fees)', rate: 10, section: '194J' },
  { id: '194O', label: 'Sec 194O (E-commerce Transactions)', rate: 0.1, section: '194O' },
  { id: '194Q', label: 'Sec 194Q (Purchase of Goods)', rate: 0.1, section: '194Q' },
  { id: '194R', label: 'Sec 194R (Business Benefits/Perquisites)', rate: 10, section: '194R' }
];

const TCS_SECTIONS = [
  { id: '206C_GOODS', label: 'Sec 206C(1H) (Sale of Goods > 50L)', rate: 0.1 },
  { id: '206C_MOTOR_VEHICLE', label: 'Sec 206C(1F) (Motor Vehicle > 10L)', rate: 1.0 },
  { id: '206C_SCRAP', label: 'Sec 206C(1) (Sale of Scrap)', rate: 1.0 },
  { id: '206C_OVERSEAS_TOUR', label: 'Sec 206C(1G) (Overseas Tour Package)', rate: 5.0 }
];

export default function CreateInvoice({ clients, onSuccess, onNavigate }: CreateInvoiceProps) {
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // Default 30 days due
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItemField[]>([
    { description: '', quantity: 1, price: 0, taxRate: 18 }
  ]);
  
  // Inventory products state
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [scanCode, setScanCode] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');

  // Tax & Payment States
  const [applyTds, setApplyTds] = useState(false);
  const [tdsRate, setTdsRate] = useState(10); // Default 10%
  const [tdsSection, setTdsSection] = useState('194J_PROFESSIONAL');
  
  const [applyTcs, setApplyTcs] = useState(false);
  const [tcsRate, setTcsRate] = useState(0.1); // Default 0.1% for Goods

  const [paymentTerms, setPaymentTerms] = useState('Due on Receipt');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  
  const [authorizedSignatory, setAuthorizedSignatory] = useState('');
  const [digitalSignature, setDigitalSignature] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceType, setInvoiceType] = useState('TAX INVOICE');

  // Selected client's details for local calculations
  const [selectedClient, setSelectedClient] = useState<any>(null);

  useEffect(() => {
    // Load products list from inventory
    const loadProducts = async () => {
      try {
        const prods = await fetchAPI('/inventory/products');
        setInventoryProducts(prods);
      } catch (err) {
        console.error('Failed to load inventory products:', err);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [clientId, clients]);

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, price: 0, taxRate: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemField, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  // Helper to handle product selection drop-downs
  const handleProductSelect = (index: number, productId: string) => {
    const updated = [...items];
    if (!productId) {
      // Revert to custom item
      updated[index] = {
        productId: undefined,
        description: '',
        quantity: updated[index].quantity,
        price: 0,
        taxRate: 18
      };
    } else {
      const prod = inventoryProducts.find(p => p.id === productId);
      if (prod) {
        updated[index] = {
          productId: prod.id,
          description: prod.name,
          quantity: updated[index].quantity,
          price: prod.sellingPrice,
          taxRate: prod.taxRate
        };
      }
    }
    setItems(updated);
  };

  // Quick scan lookup
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    setError('');
    setScanSuccess('');
    try {
      const product = await fetchAPI(`/inventory/products/barcode/${scanCode.trim()}`);
      if (product) {
        const newItem: InvoiceItemField = {
          productId: product.id,
          description: product.name,
          quantity: 1,
          price: product.sellingPrice,
          taxRate: product.taxRate
        };

        // If the first row is completely blank, replace it
        if (items.length === 1 && !items[0].description && items[0].price === 0) {
          setItems([newItem]);
        } else {
          setItems([...items, newItem]);
        }

        setScanSuccess(`Scanned: ${product.name} (SKU: ${product.sku}) added to invoice.`);
        setScanCode('');
      }
    } catch (err: any) {
      setError(err.message || 'Product not found with scanned barcode/SKU.');
    }
  };

  // Perform client-side calculations for the live UI summary
  const subTotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price || 0)), 0);
  
  // Tax calculations
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  const businessState = 'Delhi'; // Configured default
  const isIntraState = selectedClient ? (selectedClient.state || '').trim().toLowerCase() === businessState.toLowerCase() : true;

  items.forEach(item => {
    const amount = Number(item.quantity || 0) * Number(item.price || 0);
    const taxAmount = amount * (Number(item.taxRate || 0) / 100);
    if (selectedClient) {
      if (isIntraState) {
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      } else {
        igst += taxAmount;
      }
    }
  });

  const gstAmount = cgst + sgst + igst;
  const tcsAmount = applyTcs ? (subTotal + gstAmount) * (tcsRate / 100) : 0;
  const grandTotal = subTotal + gstAmount + tcsAmount;
  const tdsAmount = applyTds ? subTotal * (tdsRate / 100) : 0;
  const netPayable = grandTotal - tdsAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Please select a client.');
      return;
    }

    // Validation
    const invalidItems = items.some(item => !item.description || Number(item.quantity || 0) <= 0 || Number(item.price || 0) < 0);
    if (invalidItems) {
      setError('Please fill in description, quantity, and rate for all line items.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await fetchAPI('/invoices', {
        method: 'POST',
        bodyData: {
          clientId,
          date,
          dueDate,
          notes,
          items: items.map(item => ({
            productId: item.productId,
            description: item.description,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            taxRate: Number(item.taxRate || 0)
          })),
          tdsRate: applyTds ? tdsRate : 0,
          tdsSection: applyTds ? TDS_SECTIONS.find(s => s.id === tdsSection)?.section : null,
          tcsRate: applyTcs ? tcsRate : 0,
          paymentTerms,
          bankName,
          bankAccount,
          ifscCode,
          upiId,
          authorizedSignatory,
          digitalSignature,
          status: 'UNPAID',
          invoiceType
        }
      });

      // Confetti celebration!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b']
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onNavigate('invoices')}
          className="p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create Invoice</h1>
          <p className="text-slate-500 dark:text-slate-400">Assemble line items, link inventory items, calculate taxes, and sign digitally.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-500 font-semibold">
          {error}
        </div>
      )}
      {scanSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 font-semibold">
          {scanSuccess}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <p>No clients found in the directory. You must add at least one client before generating an invoice.</p>
          <button
            onClick={() => onNavigate('clients')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer transition-colors"
          >
            Add Client Now
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Settings */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Select Client Company *
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName} ({c.state})</option>
                  ))}
                </select>
                {selectedClient && (
                  <div className="mt-2 text-[10px] text-slate-400 space-y-0.5">
                    <span>GSTIN: {selectedClient.gstin || 'None'}</span>
                    <span className="mx-2">|</span>
                    <span>State: {selectedClient.state} ({isIntraState ? 'Intra-state CGST+SGST' : 'Inter-state IGST'})</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  Invoice Type *
                </label>
                <select
                  required
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="SIMPLE INVOICE">Simple Invoice</option>
                  <option value="TAX INVOICE">Tax Invoice</option>
                  <option value="PROFORMA INVOICE">Proforma Invoice</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Issue Date
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
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Barcode Quick-Scan Section */}
            <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 bg-indigo-500/5 dark:bg-indigo-500/10">
              <div className="flex items-center gap-2">
                <Barcode className="w-8 h-8 text-indigo-500" />
                <div>
                  <h4 className="font-bold text-slate-850 dark:text-slate-100">Barcode Quick-Add</h4>
                  <p className="text-slate-400 text-[9px] mt-0.5">Scan a barcode/SKU tag directly to append products automatically.</p>
                </div>
              </div>
              <div className="flex w-full sm:w-auto shrink-0">
                <input
                  type="text"
                  placeholder="Focus scanner & scan..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan(e)}
                  className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l focus:outline-none focus:border-indigo-500 font-mono text-xs w-full sm:w-48"
                />
                <button
                  type="button"
                  onClick={handleBarcodeScan}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-r transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-slate-400" />
                  Line Items Table
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 rounded bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              </div>

               <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2 pr-2 w-44">Link Inventory Item</th>
                      <th className="py-2 pr-4 w-48">Description / Name</th>
                      <th className="py-2 px-2 text-right w-24">Qty</th>
                      <th className="py-2 px-2 text-right w-36">Rate (INR)</th>
                      <th className="py-2 px-2 text-right w-28">GST %</th>
                      <th className="py-2 px-2 text-right w-28">Total</th>
                      <th className="py-2 pl-4 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {items.map((item, index) => (
                      <tr key={index} className="align-middle">
                        <td className="py-2.5 pr-2 w-44">
                          <select
                            value={item.productId || ''}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 text-[10px]"
                          >
                            <option value="">-- Custom Line Item --</option>
                            {inventoryProducts.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku} | Stock: {p.currentStock})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-4 w-48">
                          <input
                             type="text"
                             required
                             placeholder="e.g. Software consulting services"
                             value={item.description}
                             onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                             className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right w-24">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 text-right font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right w-36">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 text-right font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right w-28">
                          <select
                            value={item.taxRate}
                            onChange={(e) => handleItemChange(index, 'taxRate', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 text-[10px]"
                          >
                            <option value="0">0% (Nil / Exempt Items)</option>
                            <option value="0.25">0.25% (Loose Gem Stones)</option>
                            <option value="3">3% (Gold Jewellery)</option>
                            <option value="5">5% (Necessities / Transport)</option>
                            <option value="18">18% (IT / Consulting / Services)</option>
                            <option value="28">28% (Luxury / Sin Goods)</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300 w-28">
                          ₹{(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}
                        </td>
                        <td className="py-2.5 pl-4 text-center w-10">
                          <button
                            type="button"
                            disabled={items.length === 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 rounded hover:bg-rose-500/15 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Info, Bank & Signatory details */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                Payment & Digital Signatory Settings
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15 (Payable in 15 days)</option>
                    <option value="Net 30">Net 30 (Payable in 30 days)</option>
                    <option value="Net 45">Net 45 (Payable in 45 days)</option>
                    <option value="Net 60">Net 60 (Payable in 60 days)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Authorized Signatory Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Finance Officer / Director Name"
                    value={authorizedSignatory}
                    onChange={(e) => setAuthorizedSignatory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-[10px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 501002345678"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-[10px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0000123"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-[10px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[10px] text-slate-500 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. billing@okaxis"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-[10px]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/40">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={digitalSignature}
                    onChange={(e) => setDigitalSignature(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    Apply Digital Signature stamp and verification seal on invoice PDF
                  </span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Notes & Terms</label>
              <textarea
                rows={3}
                placeholder="Specify general terms, conditions, warranty notes, or special considerations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Pricing Calculations Summary panel */}
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                <Receipt className="w-4 h-4 text-slate-400" />
                Invoice Summary
              </h3>

              {/* Live tax calculations layout */}
              <div className="space-y-3 font-medium text-slate-500 dark:text-slate-400 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono">₹{subTotal.toFixed(2)}</span>
                </div>

                {!selectedClient && (
                  <div className="text-[10px] text-amber-500 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                    Select a client to evaluate GST routing (CGST/SGST vs IGST).
                  </div>
                )}

                {selectedClient && (
                  <div className="space-y-3 border-t border-b border-slate-200 dark:border-slate-800/60 py-3">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3 text-slate-400" />
                        CGST:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-mono">
                        ₹{(isIntraState ? cgst : 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3 text-slate-400" />
                        SGST:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-mono">
                        ₹{(isIntraState ? sgst : 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3 text-slate-400" />
                        IGST:
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-mono">
                        ₹{(!isIntraState ? igst : 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* TCS Section */}
                <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={applyTcs}
                      onChange={(e) => setApplyTcs(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span>Apply TCS (Tax Collected at Source)</span>
                  </label>
                  
                  {applyTcs && (
                    <div className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded space-y-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-slate-500">TCS Category / Rate:</label>
                        <select
                          value={tcsRate}
                          onChange={(e) => setTcsRate(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-200 font-medium"
                        >
                          {TCS_SECTIONS.map(sec => (
                            <option key={sec.id} value={sec.rate}>
                              {sec.label} ({sec.rate}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold pt-1">
                        <span>TCS Amount:</span>
                        <span className="font-mono">+ ₹{tcsAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grand Total Row */}
                <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3 flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                  <span>Grand Total:</span>
                  <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
                </div>

                {/* TDS Section */}
                <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={applyTds}
                      onChange={(e) => setApplyTds(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span>Apply TDS deduction</span>
                  </label>
                  
                  {applyTds && (
                    <div className="mt-2.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded space-y-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-slate-500">TDS Category / Section:</label>
                        <select
                          value={tdsSection}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTdsSection(val);
                            const matched = TDS_SECTIONS.find(s => s.id === val);
                            if (matched) {
                              setTdsRate(matched.rate);
                            }
                          }}
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-200 font-medium"
                        >
                          {TDS_SECTIONS.map(sec => (
                            <option key={sec.id} value={sec.id}>
                              {sec.label} ({sec.rate}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-between text-rose-500 font-semibold pt-1">
                        <span>TDS Deducted:</span>
                        <span className="font-mono">- ₹{tdsAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Net Payable Row */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center text-slate-850 dark:text-slate-100 font-bold text-sm">
                  <span>Net Payable:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 text-base">₹{netPayable.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded shadow-md hover:shadow-indigo-500/10 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <IndianRupee className="w-4 h-4" />
                    Save & Generate Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
