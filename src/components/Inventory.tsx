'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../utils/api';
import { 
  Plus, Search, ShieldAlert, ClipboardList, TrendingUp, Archive, 
  ArrowDownLeft, ArrowUpRight, Barcode, Printer, Upload, Download, CheckCircle, HelpCircle
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import ExcelImportModal from './ExcelImportModal';
import { downloadExcel } from '../utils/excel';

interface InventoryProps {
  onNavigate: (tab: string) => void;
  user?: any;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  alertThreshold: number;
  currentStock: number;
  createdAt: string;
}

interface StockTransaction {
  id: string;
  productId: string;
  type: string; // INWARD, OUTWARD, ADJUSTMENT
  quantity: number;
  unitPrice: number;
  supplierName: string | null;
  reference: string | null;
  notes: string | null;
  date: string;
  product: {
    name: string;
    sku: string;
    category: string;
    unit: string;
  };
}

export default function Inventory({ onNavigate, user }: InventoryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [valuation, setValuation] = useState<{ totalValue: number; categoryBreakdown: any }>({ totalValue: 0, categoryBreakdown: {} });
  
  const [activeTab, setActiveTab] = useState<'ledger' | 'restock' | 'new-product' | 'import' | 'history'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [excelImportModule, setExcelImportModule] = useState<string | null>(null);

  // Forms States
  // 1. Restock Form
  const [restockProductId, setRestockProductId] = useState('');
  const [restockQty, setRestockQty] = useState<number>(0);
  const [restockPrice, setRestockPrice] = useState<number>(0);
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [restockNotes, setRestockNotes] = useState('');

  // 2. New Product Form
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Gold Jewellery');
  const [newProductUnit, setNewProductUnit] = useState('GRAMS');
  const [newProductPurchasePrice, setNewProductPurchasePrice] = useState<number>(0);
  const [newProductSellingPrice, setNewProductSellingPrice] = useState<number>(0);
  const [newProductTaxRate, setNewProductTaxRate] = useState<number>(3); // Default to Gold 3%
  const [newProductThreshold, setNewProductThreshold] = useState<number>(10);
  const [newProductInitialStock, setNewProductInitialStock] = useState<number>(0);

  // 3. Import CSV
  const [csvText, setCsvText] = useState('');

  // 4. Barcode Printable Modal
  const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (printingProduct && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, printingProduct.barcode || printingProduct.sku, {
          format: "CODE128",
          width: 1.5,
          height: 35,
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000000"
        });
      } catch (err) {
        console.error('Failed to generate barcode SVG:', err);
      }
    }
  }, [printingProduct]);

  const refreshData = async () => {
    try {
      const prods = await fetchAPI('/inventory/products');
      setProducts(prods);

      const txs = await fetchAPI('/inventory/transactions');
      setTransactions(txs);

      const val = await fetchAPI('/inventory/valuation');
      setValuation(val);
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
    }
  };

  useEffect(() => {
    refreshData();
    fetchAPI('/suppliers')
      .then(setSuppliers)
      .catch(err => console.error('Failed to load suppliers in inventory:', err));
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await fetchAPI('/inventory/products', {
        method: 'POST',
        bodyData: {
          name: newProductName,
          sku: newProductSku,
          barcode: newProductBarcode || null,
          description: newProductDesc,
          category: newProductCategory,
          unit: newProductUnit,
          purchasePrice: newProductPurchasePrice,
          sellingPrice: newProductSellingPrice,
          taxRate: newProductTaxRate,
          alertThreshold: newProductThreshold,
          currentStock: newProductInitialStock
        }
      });

      setSuccessMsg(`Product "${newProductName}" registered successfully.`);
      // Reset form
      setNewProductName('');
      setNewProductSku('');
      setNewProductBarcode('');
      setNewProductDesc('');
      setNewProductPurchasePrice(0);
      setNewProductSellingPrice(0);
      setNewProductInitialStock(0);
      refreshData();
      setActiveTab('ledger');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register product.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetchAPI('/inventory/products/restock', {
        method: 'POST',
        bodyData: {
          productId: restockProductId,
          quantity: restockQty,
          unitPrice: restockPrice,
          supplierName,
          supplierId: supplierId || null,
          notes: restockNotes
        }
      });

      setSuccessMsg(res.message || 'Stock updated successfully.');
      setRestockProductId('');
      setRestockQty(0);
      setRestockPrice(0);
      setSupplierName('');
      setSupplierId('');
      setRestockNotes('');
      refreshData();
      setActiveTab('ledger');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update stock.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!csvText.trim()) {
      setErrorMsg('Please enter or paste CSV data.');
      setLoading(false);
      return;
    }

    try {
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const productsList = [];

      for (let i = 1; i < lines.length; i++) {
        const lineValues = lines[i].split(',').map(v => v.trim());
        if (lineValues.length < headers.length) continue;

        const prodObj: any = {};
        headers.forEach((header, index) => {
          prodObj[header] = lineValues[index];
        });
        productsList.push(prodObj);
      }

      const res = await fetchAPI('/inventory/products/import', {
        method: 'POST',
        bodyData: { products: productsList }
      });

      setSuccessMsg(res.message || `Successfully processed CSV bulk import.`);
      setCsvText('');
      refreshData();
      setActiveTab('ledger');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import CSV data. Make sure headers are correct.');
    } finally {
      setLoading(false);
    }
  };

  // Filter products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));

    const matchesCategory = 
      categoryFilter === 'ALL' || 
      p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => p.currentStock <= p.alertThreshold);

  // Helper to draw a mock barcode tag with CSS
  const renderCSSBarcode = (code: string) => {
    const bars = [];
    // Simple deterministic hash of barcode to generate variable width lines
    for (let i = 0; i < code.length; i++) {
      const digit = parseInt(code[i]) || 0;
      bars.push(<div key={`b1-${i}`} className="h-full bg-slate-900 dark:bg-white" style={{ width: `${(digit % 3) + 1}px` }} />);
      bars.push(<div key={`w1-${i}`} className="h-full bg-transparent" style={{ width: `${((digit + 1) % 3) + 1}px` }} />);
    }
    return <div className="h-10 flex items-center justify-center gap-[1px] bg-white p-1 rounded border border-slate-200">{bars}</div>;
  };

  const handlePrintTag = () => {
    window.print();
  };

  return (
    <div className="space-y-6 fade-in text-xs select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Inventory Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor asset valuation, track raw material/finished goods stocks, print barcode tags, and log inflows.
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg">
          {((user?.role === 'USER' 
            ? ['ledger', 'history'] 
            : ['ledger', 'restock', 'new-product', 'import', 'history']
          ) as ('ledger' | 'restock' | 'new-product' | 'import' | 'history')[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`px-3 py-1.5 rounded-md font-semibold capitalize transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Summary Valuation Cards */}
      {activeTab === 'ledger' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 font-semibold text-[10px]">Total Assets Valuation</p>
              <h3 className="text-lg font-bold font-mono text-slate-850 dark:text-slate-100">
                ₹{valuation.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 font-semibold text-[10px]">Total Registered Items</p>
              <h3 className="text-lg font-bold font-mono text-slate-850 dark:text-slate-100">
                {products.length} Products
              </h3>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg ${lowStockProducts.length > 0 ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-slate-500/10 text-slate-400'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 font-semibold text-[10px]">Low-Stock Alerts</p>
              <h3 className="text-lg font-bold font-mono text-slate-850 dark:text-slate-100">
                {lowStockProducts.length} Items Warning
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 1: LEDGER TABLE --- */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by product, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
            {/* Category Filter and Excel Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-semibold text-slate-600 dark:text-slate-350 text-[10px]"
              >
                <option value="ALL">All Categories</option>
                <option value="Gold Jewellery">Gold Jewellery</option>
                <option value="Loose Gemstones">Loose Gemstones</option>
                <option value="Silver">Silver</option>
                <option value="Other">Other</option>
              </select>

              <button
                onClick={() => downloadExcel(`/inventory/products/export?category=${categoryFilter}&search=${encodeURIComponent(searchQuery)}`, `Products_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-[10px] cursor-pointer shadow-xs transition-colors"
                title="Export products catalog to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                Export Products
              </button>

              {user?.role !== 'USER' && (
                <button
                  onClick={() => setExcelImportModule('products')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-[10px] cursor-pointer shadow-xs transition-colors"
                  title="Bulk import products from Excel (.xlsx)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Products
                </button>
              )}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <Archive className="w-8 h-8 text-slate-500" />
              <span>No products in catalog matching filters. Click "New Product" to add.</span>
            </div>
          ) : (
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Product Name</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3">Barcode/UPC</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3 text-right">Available Stock</th>
                      <th className="px-5 py-3 text-right">Avg Cost</th>
                      <th className="px-5 py-3 text-right">Retail Price</th>
                      <th className="px-5 py-3 text-center">GST %</th>
                      <th className="px-5 py-3 text-center">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {filteredProducts.map((p) => {
                      const isLow = p.currentStock <= p.alertThreshold;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-150">{p.name}</td>
                          <td className="px-5 py-3.5 font-mono">{p.sku}</td>
                          <td className="px-5 py-3.5 font-mono">{p.barcode || 'N/A'}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[9px] font-bold">
                              {p.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-bold font-mono px-2 py-1 rounded ${isLow ? 'bg-rose-500/10 text-rose-500 font-extrabold animate-pulse' : 'text-slate-800 dark:text-slate-200'}`}>
                              {p.currentStock.toLocaleString('en-IN')} {p.unit}
                            </span>
                            {isLow && (
                              <span className="block text-[8px] text-rose-500 font-bold mt-0.5">
                                Reorder (limit {p.alertThreshold})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-slate-500">₹{p.purchasePrice.toFixed(2)}</td>
                          <td className="px-5 py-3.5 text-right font-semibold font-mono text-slate-900 dark:text-slate-100">₹{p.sellingPrice.toFixed(2)}</td>
                          <td className="px-5 py-3.5 text-center font-mono">{p.taxRate}%</td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => setPrintingProduct(p)}
                              className="p-1 hover:text-indigo-500 hover:bg-indigo-500/10 rounded cursor-pointer transition-colors"
                              title="Print Barcode Tag"
                            >
                              <Printer className="w-4 h-4 text-slate-400 hover:text-indigo-500" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT 2: MANUAL RESTOCK FORM --- */}
      {activeTab === 'restock' && (
        <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-indigo-500" />
              Inward Stock (Purchase / Restock)
            </h3>
            <p className="text-slate-400 mt-0.5">Add quantities to existing product SKUs. Recalculates weighted average costs automatically.</p>
          </div>

          <form onSubmit={handleRestock} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Select Product to Inward *</label>
              <select
                required
                value={restockProductId}
                onChange={(e) => {
                  setRestockProductId(e.target.value);
                  const selected = products.find(p => p.id === e.target.value);
                  if (selected) {
                    setRestockPrice(selected.purchasePrice);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Choose Stock Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (SKU: {p.sku} | Available: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Inward Quantity *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  placeholder="e.g. 15.5"
                  value={restockQty || ''}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Purchase Cost per Unit (INR) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="e.g. 5800.00"
                  value={restockPrice || ''}
                  onChange={(e) => setRestockPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Registered Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSupplierId(id);
                    const selected = suppliers.find(s => s.id === id);
                    if (selected) {
                      setSupplierName(selected.companyName);
                    } else {
                      setSupplierName('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-350"
                >
                  <option value="">-- Custom / Unregistered --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.companyName} ({s.state})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Diamond Traders Ltd"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Remittance / Transaction Notes</label>
              <textarea
                rows={2}
                placeholder="Reference receipts, invoice tags, purity checks..."
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Submit Inward Stock'
              )}
            </button>
          </form>
        </div>
      )}

      {/* --- TAB CONTENT 3: REGISTER NEW PRODUCT --- */}
      {activeTab === 'new-product' && (
        <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-indigo-500" />
              Register New Inventory Item
            </h3>
            <p className="text-slate-400 mt-0.5">Add a new SKU/barcode product template to your catalog profile.</p>
          </div>

          <form onSubmit={handleCreateProduct} className="space-y-4 text-slate-800 dark:text-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Product/Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 22k Gold Engagement Ring"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">SKU Code (Must be unique) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GLD-RNG-22K-001"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Barcode / UPC (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  value={newProductBarcode}
                  onChange={(e) => setNewProductBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Category *</label>
                <select
                  value={newProductCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setNewProductCategory(cat);
                    // Match tax default settings
                    if (cat === 'Gold Jewellery') {
                      setNewProductTaxRate(3);
                      setNewProductUnit('GRAMS');
                    } else if (cat === 'Loose Gemstones') {
                      setNewProductTaxRate(0.25);
                      setNewProductUnit('CARATS');
                    } else {
                      setNewProductTaxRate(18);
                      setNewProductUnit('PCS');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="Gold Jewellery">Gold Jewellery (3% GST)</option>
                  <option value="Loose Gemstones">Loose Gemstones (0.25% GST)</option>
                  <option value="Silver">Silver (3% GST)</option>
                  <option value="Other">Other Goods/Services (18% GST)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Unit of Measurement *</label>
                <select
                  value={newProductUnit}
                  onChange={(e) => setNewProductUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="GRAMS">Grams (g)</option>
                  <option value="CARATS">Carats (ct)</option>
                  <option value="PCS">Pieces (pcs)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Purchase Cost Price *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={newProductPurchasePrice || ''}
                  onChange={(e) => setNewProductPurchasePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Default Retail Sell Price *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={newProductSellingPrice || ''}
                  onChange={(e) => setNewProductSellingPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">GST Rate Percentage *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={newProductTaxRate || ''}
                  onChange={(e) => setNewProductTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Alert Level Threshold *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="Low stock alert when below this count"
                  value={newProductThreshold || ''}
                  onChange={(e) => setNewProductThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Initial Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Initial quantities available"
                  value={newProductInitialStock || ''}
                  onChange={(e) => setNewProductInitialStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Item Description</label>
              <textarea
                rows={2}
                placeholder="Describe details: gemstone dimensions, metal purity (e.g. 22 Karat / 916), design name..."
                value={newProductDesc}
                onChange={(e) => setNewProductDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Register Item & Generate SKU/Barcode'
              )}
            </button>
          </form>
        </div>
      )}

      {/* --- TAB CONTENT 4: CSV IMPORT --- */}
      {activeTab === 'import' && (
        <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              <Upload className="w-5 h-5 text-indigo-500" />
              CSV Bulk Stock Import
            </h3>
            <p className="text-slate-400 mt-0.5">Parse and import a bulk list of products. Copy the format template below and paste your CSV content.</p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <span className="font-semibold text-slate-500 text-[10px] block">Expected Headers Template:</span>
            <code className="block p-2 bg-slate-100 dark:bg-slate-900/60 rounded text-[9px] font-mono text-indigo-600 dark:text-indigo-400 select-all">
              name,sku,barcode,category,unit,purchasePrice,sellingPrice,taxRate,alertThreshold,currentStock
            </code>
            <span className="font-semibold text-slate-500 text-[10px] block">Example Row:</span>
            <code className="block p-2 bg-slate-100 dark:bg-slate-900/60 rounded text-[9px] font-mono text-slate-600 dark:text-slate-450 select-all">
              22k Gold Bangle,GLD-BGL-22K-01,123456789012,Gold Jewellery,GRAMS,5600,6200,3,15,50.5
            </code>
          </div>

          <form onSubmit={handleImportCSV} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1.5">CSV Raw Text Content *</label>
              <textarea
                rows={8}
                required
                placeholder="Paste CSV rows here..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:border-indigo-500 font-mono text-[10px]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Import Bulk Products'
              )}
            </button>
          </form>
        </div>
      )}

      {/* --- TAB CONTENT 5: STOCK TRANSACTION LOG --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              Stock Inward/Outward Ledger History
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadExcel('/inventory/transactions/export', `Stock_Movements_${new Date().toISOString().split('T')[0]}.xlsx`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-[10px] cursor-pointer shadow-xs transition-colors"
                title="Export stock ledger history to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                Export Stock Movements
              </button>
              {user?.role !== 'USER' && (
                <button
                  onClick={() => setExcelImportModule('restock')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-[10px] cursor-pointer shadow-xs transition-colors"
                  title="Bulk import restock / purchases from Excel (.xlsx)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Restock
                </button>
              )}
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="glass-panel py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <ClipboardList className="w-8 h-8 text-slate-500" />
              <span>No stock transactions recorded yet. Create restocks or generate invoices.</span>
            </div>
          ) : (
            <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Product Name</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3 text-center">Type</th>
                      <th className="px-5 py-3 text-right">Quantity</th>
                      <th className="px-5 py-3 text-right">Price</th>
                      <th className="px-5 py-3">Reference / Supplier</th>
                      <th className="px-5 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 text-xs">
                    {transactions.map((tx) => {
                      const isInward = tx.type === 'INWARD';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-5 py-3 text-slate-400">{new Date(tx.date).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3 font-semibold">{tx.product?.name}</td>
                          <td className="px-5 py-3 font-mono">{tx.product?.sku}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                              isInward 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-rose-500/10 text-rose-500'
                            }`}>
                              {isInward ? (
                                <>
                                  <ArrowDownLeft className="w-3 h-3" />
                                  Stock Inward
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3 h-3" />
                                  Sale Outward
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold font-mono">
                            {isInward ? '+' : '-'}{tx.quantity.toLocaleString('en-IN')} {tx.product?.unit}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-slate-500">₹{tx.unitPrice.toFixed(2)}</td>
                          <td className="px-5 py-3 text-slate-500 font-semibold">{tx.supplierName || tx.reference || 'N/A'}</td>
                          <td className="px-5 py-3 text-slate-400 italic">{tx.notes || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- BARCODE PRINT MODAL --- */}
      {printingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-5 max-h-[95vh] overflow-y-auto print:border-none print:shadow-none print:bg-white print:text-black">
            <div className="text-center space-y-1 print:hidden">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100">Print Barcode Tag</h3>
              <p className="text-[10px] text-slate-500">Format tags for jewelry tags or box packaging label prints.</p>
            </div>

            {/* Loop Tag template */}
            <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-white text-slate-900 flex flex-col items-center justify-center gap-2 max-w-[250px] mx-auto shadow-inner">
              <span className="font-bold text-[10px] tracking-tight uppercase block text-center">
                {valuation.totalValue > 0 ? 'FINANCE CORP LTD' : 'JEWELLERY GROUP'}
              </span>
              <span className="text-[8px] font-semibold text-center leading-tight">
                {printingProduct.name}
              </span>
              
              {/* Real SVG Barcode */}
              <div className="bg-white p-2 rounded flex justify-center items-center w-full">
                <svg ref={barcodeRef} className="max-w-full" />
              </div>
              
              <span className="font-mono text-[9px] font-bold block leading-none">
                *{printingProduct.barcode || printingProduct.sku}*
              </span>
              <div className="flex justify-between w-full text-[8px] font-bold border-t border-slate-100 pt-1.5 font-mono">
                <span>SKU: {printingProduct.sku}</span>
                <span>GST: {printingProduct.taxRate}%</span>
              </div>
              <div className="flex justify-between w-full text-[8px] font-bold leading-none font-mono">
                <span>Category: {printingProduct.category}</span>
                <span>Price: ₹{printingProduct.sellingPrice.toFixed(0)}</span>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex gap-3 print:hidden">
              <button
                onClick={() => setPrintingProduct(null)}
                className="flex-1 py-2 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 font-semibold rounded cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrintTag}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Tag Label
              </button>
            </div>
          </div>
        </div>
      )}

      {excelImportModule && (
        <ExcelImportModal
          isOpen={!!excelImportModule}
          onClose={() => setExcelImportModule(null)}
          moduleKey={excelImportModule}
          moduleTitle={excelImportModule === 'restock' ? 'Stock Restock / Purchases' : 'Inventory Catalog'}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}
