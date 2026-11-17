const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const ExcelJS = require('exceljs');
const excelService = require('../utils/excelService');
const { calculateTaxes } = require('./invoiceController');

const prisma = new PrismaClient();

// Multer memory storage configuration for Excel uploads (10MB maximum)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload an Excel (.xlsx) file.'));
    }
  }
});

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh', 
  'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep', 'Andaman and Nicobar Islands'
];

const EXPENSE_CATEGORIES = ['Rent', 'Salary', 'Software', 'Marketing', 'Utilities', 'Travel', 'Other'];

const VOUCHER_TYPES = ['RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL'];

const CHART_OF_ACCOUNTS = [
  'Cash', 'Bank Account', 'Accounts Receivable', 'Inventory', 'Equipment',
  'TDS Receivable', 'Accounts Payable', 'TDS Payable', 'GST Payable', 'TCS Payable',
  'Owner Capital', 'Retained Earnings', 'Sales Revenue', 'Other Income',
  'Salaries & Payroll', 'Rent Expense', 'Office Expenses', 'Utilities',
  'COGS (Cost of Goods Sold)', 'Other Expenses'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Module Definitions for Template, Validation & Processing
const MODULE_CONFIGS = {
  clients: {
    name: 'Clients Directory',
    columns: [
      { key: 'companyName', header: 'Company Name', required: true, width: 25 },
      { key: 'email', header: 'Email Address', required: true, width: 25 },
      { key: 'phone', header: 'Phone Number', required: false, width: 16 },
      { key: 'address', header: 'Office Address', required: false, width: 30 },
      { key: 'state', header: 'State (for GST)', required: true, width: 20 },
      { key: 'city', header: 'City', required: false, width: 18 },
      { key: 'zip', header: 'Postal/ZIP Code', required: false, width: 14 },
      { key: 'gstin', header: 'GSTIN Number', required: false, width: 20 },
      { key: 'pan', header: 'PAN Number', required: false, width: 16 }
    ],
    sampleRows: [
      {
        companyName: 'Acme Technologies Ltd',
        email: 'accounts@acmetech.com',
        phone: '9876543210',
        address: 'Plot 42, Tech Park, Okhla',
        state: 'Delhi',
        city: 'New Delhi',
        zip: '110020',
        gstin: '07AAAAA1111A1Z1',
        pan: 'AAAAA1111A'
      },
      {
        companyName: 'Apex Retailers Pvt Ltd',
        email: 'billing@apexretail.in',
        phone: '9123456789',
        address: '12 MG Road',
        state: 'Maharashtra',
        city: 'Mumbai',
        zip: '400001',
        gstin: '27BBBBB2222B1Z2',
        pan: 'BBBBB2222B'
      }
    ],
    instructions: [
      'Company Name, Email Address, and State are mandatory fields.',
      'State must be a valid Indian state or union territory name (e.g. Delhi, Maharashtra, Karnataka).',
      'GSTIN should be 15 characters if provided (e.g. 07AAAAA1111A1Z1).',
      'PAN should be 10 characters if provided (e.g. ABCDE1234F).',
      'Duplicate company names or email addresses will be rejected.'
    ]
  },

  suppliers: {
    name: 'Suppliers Directory',
    columns: [
      { key: 'companyName', header: 'Company Name', required: true, width: 25 },
      { key: 'contactName', header: 'Contact Person', required: false, width: 20 },
      { key: 'email', header: 'Email Address', required: true, width: 25 },
      { key: 'phone', header: 'Phone Number', required: false, width: 16 },
      { key: 'address', header: 'Address', required: false, width: 30 },
      { key: 'state', header: 'State', required: true, width: 20 },
      { key: 'city', header: 'City', required: false, width: 18 },
      { key: 'zip', header: 'Postal/ZIP Code', required: false, width: 14 },
      { key: 'gstin', header: 'GSTIN Number', required: false, width: 20 },
      { key: 'pan', header: 'PAN Number', required: false, width: 16 }
    ],
    sampleRows: [
      {
        companyName: 'Diamond Traders Ltd',
        contactName: 'Ramesh Sharma',
        email: 'orders@diamondtraders.com',
        phone: '9811223344',
        address: 'Zaveri Bazaar',
        state: 'Maharashtra',
        city: 'Mumbai',
        zip: '400002',
        gstin: '27CCCCC3333C1Z3',
        pan: 'CCCCC3333C'
      }
    ],
    instructions: [
      'Company Name, Email Address, and State are mandatory.',
      'Company name must be unique.',
      'State must be a valid Indian state.'
    ]
  },

  products: {
    name: 'Products & Inventory',
    columns: [
      { key: 'name', header: 'Product Name', required: true, width: 25 },
      { key: 'sku', header: 'SKU Code', required: true, width: 18 },
      { key: 'barcode', header: 'Barcode / UPC', required: false, width: 18 },
      { key: 'description', header: 'Description', required: false, width: 30 },
      { key: 'category', header: 'Category', required: true, width: 18 },
      { key: 'unit', header: 'Unit of Measure', required: true, width: 15 },
      { key: 'purchasePrice', header: 'Purchase Cost Price', required: false, width: 18, numFmt: '₹#,##0.00' },
      { key: 'sellingPrice', header: 'Selling Price', required: false, width: 18, numFmt: '₹#,##0.00' },
      { key: 'taxRate', header: 'GST Tax Rate %', required: false, width: 15, numFmt: '0.00' },
      { key: 'alertThreshold', header: 'Alert Threshold', required: false, width: 15, numFmt: '#,##0' },
      { key: 'currentStock', header: 'Initial Opening Stock', required: false, width: 18, numFmt: '#,##0.00' }
    ],
    sampleRows: [
      {
        name: '22k Gold Engagement Ring',
        sku: 'GLD-RNG-22K-001',
        barcode: '890123456789',
        description: 'Hallmarked 916 gold ring with solitaire mount',
        category: 'Gold Jewellery',
        unit: 'GRAMS',
        purchasePrice: 5800,
        sellingPrice: 6500,
        taxRate: 3,
        alertThreshold: 10,
        currentStock: 45.5
      },
      {
        name: 'Loose Blue Sapphire',
        sku: 'GEM-BLU-SAP-002',
        barcode: '890987654321',
        description: 'Certified natural Ceylon sapphire 3.5 ct',
        category: 'Loose Gemstones',
        unit: 'CARATS',
        purchasePrice: 12000,
        sellingPrice: 18500,
        taxRate: 0.25,
        alertThreshold: 5,
        currentStock: 12.0
      }
    ],
    instructions: [
      'Product Name and SKU Code are mandatory.',
      'SKU Code must be unique.',
      'If Barcode is blank, a unique 12-digit code will be generated.',
      'Categories supported: Gold Jewellery (3% GST), Loose Gemstones (0.25% GST), Silver (3% GST), Other (18% GST).',
      'Units supported: GRAMS, CARATS, PCS.',
      'Initial Opening Stock (>0) will automatically create an initial Inward stock transaction.'
    ]
  },

  restock: {
    name: 'Stock Restock / Purchases',
    columns: [
      { key: 'sku', header: 'Product SKU', required: true, width: 18 },
      { key: 'quantity', header: 'Inward Quantity', required: true, width: 16, numFmt: '#,##0.00' },
      { key: 'unitPrice', header: 'Unit Purchase Cost', required: true, width: 18, numFmt: '₹#,##0.00' },
      { key: 'supplierName', header: 'Supplier Name', required: false, width: 22 },
      { key: 'date', header: 'Date (YYYY-MM-DD)', required: false, width: 18 },
      { key: 'reference', header: 'Invoice / PO Ref', required: false, width: 18 },
      { key: 'notes', header: 'Notes', required: false, width: 25 }
    ],
    sampleRows: [
      {
        sku: 'GLD-RNG-22K-001',
        quantity: 20,
        unitPrice: 5900,
        supplierName: 'Diamond Traders Ltd',
        date: '2026-11-15',
        reference: 'PO-2026-088',
        notes: 'Bullion market purchase'
      }
    ],
    instructions: [
      'Product SKU, Inward Quantity, and Unit Purchase Cost are mandatory.',
      'Product SKU must match an existing product in the catalog.',
      'Inward Quantity must be greater than zero.',
      'Weighted average purchase cost and current stock level will be recalculated automatically.'
    ]
  },

  invoices: {
    name: 'Invoices / Sales Ledger',
    columns: [
      { key: 'invoiceNumber', header: 'Invoice Number', required: false, width: 18 },
      { key: 'clientIdentifier', header: 'Client Name or Email', required: true, width: 25 },
      { key: 'date', header: 'Invoice Date (YYYY-MM-DD)', required: true, width: 18 },
      { key: 'dueDate', header: 'Due Date (YYYY-MM-DD)', required: false, width: 18 },
      { key: 'invoiceType', header: 'Invoice Type', required: false, width: 18 },
      { key: 'productSku', header: 'Product SKU', required: false, width: 18 },
      { key: 'description', header: 'Item Description', required: true, width: 28 },
      { key: 'quantity', header: 'Quantity', required: true, width: 14, numFmt: '#,##0.00' },
      { key: 'price', header: 'Unit Rate / Price', required: true, width: 16, numFmt: '₹#,##0.00' },
      { key: 'taxRate', header: 'GST Tax Rate %', required: false, width: 15, numFmt: '0.00' },
      { key: 'tdsRate', header: 'TDS Rate %', required: false, width: 12, numFmt: '0.00' },
      { key: 'tdsSection', header: 'TDS Section', required: false, width: 14 },
      { key: 'tcsRate', header: 'TCS Rate %', required: false, width: 12, numFmt: '0.00' },
      { key: 'paymentTerms', header: 'Payment Terms', required: false, width: 18 },
      { key: 'notes', header: 'Notes', required: false, width: 25 }
    ],
    sampleRows: [
      {
        invoiceNumber: 'INV-2026-1001',
        clientIdentifier: 'Acme Technologies Ltd',
        date: '2026-11-10',
        dueDate: '2026-11-25',
        invoiceType: 'TAX INVOICE',
        productSku: 'GLD-RNG-22K-001',
        description: '22k Gold Engagement Ring (Hallmarked)',
        quantity: 2,
        price: 6500,
        taxRate: 3,
        tdsRate: 0,
        tdsSection: '',
        tcsRate: 0,
        paymentTerms: 'Due on Receipt',
        notes: 'Corporate gift order'
      },
      {
        invoiceNumber: 'INV-2026-1001',
        clientIdentifier: 'Acme Technologies Ltd',
        date: '2026-11-10',
        dueDate: '2026-11-25',
        invoiceType: 'TAX INVOICE',
        productSku: '',
        description: 'Custom Laser Inscription & Gift Packaging',
        quantity: 2,
        price: 500,
        taxRate: 18,
        tdsRate: 0,
        tdsSection: '',
        tcsRate: 0,
        paymentTerms: 'Due on Receipt',
        notes: 'Service item'
      }
    ],
    instructions: [
      'Client Name or Email, Item Description, Quantity, and Unit Price are mandatory.',
      'Multiple rows sharing the same Invoice Number will be compiled into a single multi-item invoice.',
      'If Invoice Number is blank, sequential numbers will be auto-generated.',
      'Client must already exist in your Clients Directory.',
      'If Product SKU is given, stock deduction will be verified and executed automatically.',
      'Taxes (CGST, SGST, IGST, TDS, TCS) are computed dynamically using state rules. You do not need to calculate them manually.'
    ]
  },

  expenses: {
    name: 'Operating Expenses',
    columns: [
      { key: 'description', header: 'Expense Description', required: true, width: 25 },
      { key: 'amount', header: 'Amount (INR)', required: true, width: 16, numFmt: '₹#,##0.00' },
      { key: 'category', header: 'Category', required: true, width: 16 },
      { key: 'date', header: 'Date (YYYY-MM-DD)', required: true, width: 16 },
      { key: 'supplierName', header: 'Payee / Supplier Name', required: false, width: 22 },
      { key: 'notes', header: 'Notes / References', required: false, width: 25 }
    ],
    sampleRows: [
      {
        description: 'AWS Cloud Server Hosting',
        amount: 8500,
        category: 'Software',
        date: '2026-11-01',
        supplierName: '',
        notes: 'Monthly infrastructure billing'
      },
      {
        description: 'Office Rent November',
        amount: 45000,
        category: 'Rent',
        date: '2026-11-05',
        supplierName: '',
        notes: 'Okhla office premise'
      }
    ],
    instructions: [
      'Description, Amount, Category, and Date are mandatory.',
      'Categories supported: Rent, Salary, Software, Marketing, Utilities, Travel, Other.',
      'Amount must be a positive number.',
      'Date must be in YYYY-MM-DD format.'
    ]
  },

  vouchers: {
    name: 'Vouchers & Journals',
    columns: [
      { key: 'voucherNumber', header: 'Voucher # (or Group ID)', required: true, width: 20 },
      { key: 'type', header: 'Voucher Type', required: true, width: 16 },
      { key: 'date', header: 'Date (YYYY-MM-DD)', required: true, width: 16 },
      { key: 'narration', header: 'Narration / Description', required: true, width: 30 },
      { key: 'reference', header: 'Reference / Cheque #', required: false, width: 18 },
      { key: 'accountName', header: 'Account Name', required: true, width: 25 },
      { key: 'entryType', header: 'Entry Type (DEBIT/CREDIT)', required: true, width: 22 },
      { key: 'amount', header: 'Amount (INR)', required: true, width: 16, numFmt: '₹#,##0.00' }
    ],
    sampleRows: [
      {
        voucherNumber: 'VCH-2026-001',
        type: 'RECEIPT',
        date: '2026-11-12',
        narration: 'Cash received from client for invoice settlement',
        reference: 'UTR981726354',
        accountName: 'Cash',
        entryType: 'DEBIT',
        amount: 25000
      },
      {
        voucherNumber: 'VCH-2026-001',
        type: 'RECEIPT',
        date: '2026-11-12',
        narration: 'Cash received from client for invoice settlement',
        reference: 'UTR981726354',
        accountName: 'Sales Revenue',
        entryType: 'CREDIT',
        amount: 25000
      }
    ],
    instructions: [
      'Every voucher must have at least two entries: at least one DEBIT and one CREDIT.',
      'Rows sharing the same Voucher Number will be grouped together into one double-entry voucher.',
      'Total Debits must EQUAL Total Credits for each voucher number.',
      'Voucher Type must be: RECEIPT, PAYMENT, CONTRA, or JOURNAL.',
      'Account Name should be from the standard Chart of Accounts (e.g. Cash, Bank Account, Sales Revenue, Office Expenses).'
    ]
  },

  employees: {
    name: 'Employee Directory',
    columns: [
      { key: 'name', header: 'Full Name', required: true, width: 22 },
      { key: 'email', header: 'Email Address', required: true, width: 25 },
      { key: 'designation', header: 'Designation', required: true, width: 20 },
      { key: 'department', header: 'Department', required: false, width: 18 },
      { key: 'pan', header: 'PAN Number', required: false, width: 16 },
      { key: 'bankAccount', header: 'Bank Account Number', required: false, width: 22 },
      { key: 'ifscCode', header: 'IFSC Code', required: false, width: 16 },
      { key: 'baseSalary', header: 'Monthly Base Salary', required: true, width: 20, numFmt: '₹#,##0.00' },
      { key: 'allowances', header: 'Monthly Allowances', required: false, width: 20, numFmt: '₹#,##0.00' },
      { key: 'deductions', header: 'Monthly Deductions', required: false, width: 20, numFmt: '₹#,##0.00' }
    ],
    sampleRows: [
      {
        name: 'Amit Verma',
        email: 'amit.verma@financeapp.com',
        designation: 'Senior Accountant',
        department: 'Finance',
        pan: 'ABCDE1234F',
        bankAccount: '123456789012',
        ifscCode: 'HDFC0001234',
        baseSalary: 65000,
        allowances: 10000,
        deductions: 3500
      }
    ],
    instructions: [
      'Full Name, Email Address, Designation, and Monthly Base Salary are mandatory.',
      'Email address must be unique.',
      'Salary, Allowances, and Deductions must be numbers.'
    ]
  },

  payslips: {
    name: 'Payslips / Payroll Records',
    columns: [
      { key: 'employeeIdentifier', header: 'Employee Email or ID', required: true, width: 25 },
      { key: 'month', header: 'Month (1-12)', required: true, width: 14, numFmt: '#,##0' },
      { key: 'year', header: 'Year (YYYY)', required: true, width: 14, numFmt: '#,##0' },
      { key: 'paidDays', header: 'Actual Paid Days', required: true, width: 16, numFmt: '#,##0.0' }
    ],
    sampleRows: [
      {
        employeeIdentifier: 'amit.verma@financeapp.com',
        month: 11,
        year: 2026,
        paidDays: 30
      }
    ],
    instructions: [
      'Employee Email (or ID), Month, Year, and Paid Days are mandatory.',
      'Employee must exist in your Employee Directory.',
      'Month must be between 1 and 12.',
      'Paid days cannot exceed total calendar days in that month.',
      'A payslip cannot be generated twice for the same employee in the same month and year.',
      'Earnings and deductions will be automatically calculated based on the employee profile.'
    ]
  }
};

/**
 * Clean string or return default
 */
function cleanStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Parse numeric values safely
 */
function parseNum(val, defaultVal = 0) {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/[^0-9\.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Validate and normalize dates (handles Excel serial dates and strings)
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  // Excel serial number (days since 1900-01-01)
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // Day, Month, Year
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const testDate = new Date(year, month, day);
      if (!isNaN(testDate.getTime())) return testDate;
    }
  }
  return null;
}

// -------------------------------------------------------------
// CONTROLLER HANDLERS
// -------------------------------------------------------------

exports.MODULE_CONFIGS = MODULE_CONFIGS;

/**
 * Download Excel Template for any supported module
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const moduleKey = req.params.module.toLowerCase();
    const config = MODULE_CONFIGS[moduleKey];

    if (!config) {
      return res.status(404).json({ error: `Unsupported template module: "${moduleKey}"` });
    }

    const workbook = excelService.createTemplateWorkbook(
      config.name,
      config.columns,
      config.sampleRows,
      config.instructions
    );

    await excelService.sendWorkbookResponse(res, workbook, `${moduleKey}_import_template.xlsx`);
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: 'Failed to generate Excel template.' });
  }
};

/**
 * Helper to match header column name to config column key
 */
function mapHeaderToKey(header, columns) {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const col of columns) {
    const colNorm = col.header.toLowerCase().replace(/[^a-z0-9]/g, '');
    const keyNorm = col.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm === colNorm || norm === keyNorm || colNorm.includes(norm) || norm.includes(colNorm)) {
      return col.key;
    }
  }
  return null;
}

/**
 * Preview Excel Import before committing to database
 * Validates file, headers, data types, business rules, duplicate detection.
 */
exports.previewImport = [
  upload.single('file'),
  async (req, res) => {
    try {
      const moduleKey = req.params.module.toLowerCase();
      const config = MODULE_CONFIGS[moduleKey];

      if (!config) {
        return res.status(404).json({ error: `Unsupported import module: "${moduleKey}"` });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No Excel file uploaded. Please upload a .xlsx spreadsheet.' });
      }

      // Parse uploaded buffer
      const { headers, rows } = await excelService.parseExcelBuffer(req.file.buffer);

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Uploaded spreadsheet is empty. No data rows found.' });
      }

      // Map headers to schema keys
      const headerMap = {};
      headers.forEach(h => {
        const key = mapHeaderToKey(h, config.columns);
        if (key) headerMap[h] = key;
      });

      // Check required headers exist
      const mappedKeys = new Set(Object.values(headerMap));
      const missingRequired = config.columns.filter(c => c.required && !mappedKeys.has(c.key));
      if (missingRequired.length > 0) {
        return res.status(400).json({
          error: `Missing required column headers: ${missingRequired.map(c => `"${c.header}"`).join(', ')}`
        });
      }

      // Normalized rows
      const normalizedRows = rows.map(r => {
        const rowData = {};
        Object.entries(r.data).forEach(([headerName, val]) => {
          const key = headerMap[headerName];
          if (key) rowData[key] = val;
        });
        return {
          rowNumber: r.rowNumber,
          data: rowData
        };
      });

      // Module-specific validation
      const validRows = [];
      const invalidRows = [];

      switch (moduleKey) {
        case 'clients': {
          const existingClients = await prisma.client.findMany({ select: { companyName: true, email: true } });
          const dbCompanies = new Set(existingClients.map(c => c.companyName.toLowerCase().trim()));
          const dbEmails = new Set(existingClients.map(c => c.email.toLowerCase().trim()));
          const batchCompanies = new Set();
          const batchEmails = new Set();

          for (const item of normalizedRows) {
            const errors = [];
            const companyName = cleanStr(item.data.companyName);
            const email = cleanStr(item.data.email);
            const state = cleanStr(item.data.state);
            const phone = cleanStr(item.data.phone);
            const address = cleanStr(item.data.address);
            const city = cleanStr(item.data.city);
            const zip = cleanStr(item.data.zip);
            const gstin = cleanStr(item.data.gstin);
            const pan = cleanStr(item.data.pan);

            if (!companyName) errors.push('Company Name is required.');
            if (!email) errors.push('Email Address is required.');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email address format.');

            if (!state) errors.push('State is required for GST determination.');
            else {
              const matchedState = INDIAN_STATES.find(s => s.toLowerCase() === state.toLowerCase());
              if (!matchedState) errors.push(`Unknown state "${state}". Must be a valid Indian state or UT.`);
              else item.data.state = matchedState;
            }

            if (gstin && gstin.length !== 15) errors.push('GSTIN must be exactly 15 characters.');
            if (pan && pan.length !== 10) errors.push('PAN must be exactly 10 characters.');

            // Duplicate checks
            const cLower = companyName.toLowerCase();
            const eLower = email.toLowerCase();
            if (dbCompanies.has(cLower)) errors.push(`A client with company name "${companyName}" already exists in the database.`);
            if (dbEmails.has(eLower)) errors.push(`A client with email "${email}" already exists in the database.`);
            if (batchCompanies.has(cLower)) errors.push(`Duplicate company name "${companyName}" within the same file.`);
            if (batchEmails.has(eLower)) errors.push(`Duplicate email "${email}" within the same file.`);

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              batchCompanies.add(cLower);
              batchEmails.add(eLower);
              validRows.push({
                ...item,
                normalized: { companyName, email, phone, address, state: item.data.state, city, zip, gstin, pan }
              });
            }
          }
          break;
        }

        case 'suppliers': {
          const existingSuppliers = await prisma.supplier.findMany({ select: { companyName: true, email: true } });
          const dbCompanies = new Set(existingSuppliers.map(s => s.companyName.toLowerCase().trim()));
          const batchCompanies = new Set();

          for (const item of normalizedRows) {
            const errors = [];
            const companyName = cleanStr(item.data.companyName);
            const contactName = cleanStr(item.data.contactName);
            const email = cleanStr(item.data.email);
            const phone = cleanStr(item.data.phone);
            const address = cleanStr(item.data.address);
            const state = cleanStr(item.data.state);
            const city = cleanStr(item.data.city);
            const zip = cleanStr(item.data.zip);
            const gstin = cleanStr(item.data.gstin);
            const pan = cleanStr(item.data.pan);

            if (!companyName) errors.push('Company Name is required.');
            if (!email) errors.push('Email is required.');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format.');

            if (!state) errors.push('State is required.');
            else {
              const matchedState = INDIAN_STATES.find(s => s.toLowerCase() === state.toLowerCase());
              if (!matchedState) errors.push(`Unknown state "${state}".`);
              else item.data.state = matchedState;
            }

            const cLower = companyName.toLowerCase();
            if (dbCompanies.has(cLower)) errors.push(`Supplier with company name "${companyName}" already exists.`);
            if (batchCompanies.has(cLower)) errors.push(`Duplicate supplier "${companyName}" in file.`);

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              batchCompanies.add(cLower);
              validRows.push({
                ...item,
                normalized: { companyName, contactName, email, phone, address, state: item.data.state, city, zip, gstin, pan }
              });
            }
          }
          break;
        }

        case 'products': {
          const existingProducts = await prisma.product.findMany({ select: { sku: true, barcode: true } });
          const dbSkus = new Set(existingProducts.map(p => p.sku.toLowerCase().trim()));
          const dbBarcodes = new Set(existingProducts.filter(p => p.barcode).map(p => p.barcode.trim()));
          const batchSkus = new Set();
          const batchBarcodes = new Set();

          for (const item of normalizedRows) {
            const errors = [];
            const name = cleanStr(item.data.name);
            const sku = cleanStr(item.data.sku);
            let barcode = cleanStr(item.data.barcode);
            const description = cleanStr(item.data.description);
            const category = cleanStr(item.data.category) || 'Other';
            const unit = cleanStr(item.data.unit).toUpperCase() || 'PCS';
            const purchasePrice = parseNum(item.data.purchasePrice, 0);
            const sellingPrice = parseNum(item.data.sellingPrice, 0);
            const taxRate = parseNum(item.data.taxRate, 18);
            const alertThreshold = parseNum(item.data.alertThreshold, 5);
            const currentStock = parseNum(item.data.currentStock, 0);

            if (!name) errors.push('Product Name is required.');
            if (!sku) errors.push('SKU Code is required.');
            if (purchasePrice < 0) errors.push('Purchase Price cannot be negative.');
            if (sellingPrice < 0) errors.push('Selling Price cannot be negative.');
            if (currentStock < 0) errors.push('Initial Stock cannot be negative.');

            const sLower = sku.toLowerCase();
            if (dbSkus.has(sLower)) errors.push(`Product with SKU "${sku}" already exists.`);
            if (batchSkus.has(sLower)) errors.push(`Duplicate SKU "${sku}" within file.`);

            if (barcode) {
              if (dbBarcodes.has(barcode)) errors.push(`Barcode "${barcode}" already exists.`);
              if (batchBarcodes.has(barcode)) errors.push(`Duplicate Barcode "${barcode}" in file.`);
            } else {
              barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            }

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              batchSkus.add(sLower);
              if (barcode) batchBarcodes.add(barcode);
              validRows.push({
                ...item,
                normalized: { name, sku, barcode, description, category, unit, purchasePrice, sellingPrice, taxRate, alertThreshold, currentStock }
              });
            }
          }
          break;
        }

        case 'restock': {
          const products = await prisma.product.findMany();
          const prodMap = new Map();
          products.forEach(p => prodMap.set(p.sku.toLowerCase().trim(), p));

          const suppliers = await prisma.supplier.findMany();
          const supMap = new Map();
          suppliers.forEach(s => supMap.set(s.companyName.toLowerCase().trim(), s));

          for (const item of normalizedRows) {
            const errors = [];
            const sku = cleanStr(item.data.sku);
            const quantity = parseNum(item.data.quantity, 0);
            const unitPrice = parseNum(item.data.unitPrice, 0);
            const supplierName = cleanStr(item.data.supplierName);
            const dateVal = parseDate(item.data.date) || new Date();
            const reference = cleanStr(item.data.reference);
            const notes = cleanStr(item.data.notes);

            if (!sku) errors.push('Product SKU is required.');
            else if (!prodMap.has(sku.toLowerCase())) errors.push(`Product SKU "${sku}" does not exist in inventory catalog.`);

            if (quantity <= 0) errors.push('Inward Quantity must be greater than zero.');
            if (unitPrice < 0) errors.push('Unit Purchase Cost cannot be negative.');

            const product = prodMap.get(sku.toLowerCase());
            let supplierId = null;
            if (supplierName && supMap.has(supplierName.toLowerCase())) {
              supplierId = supMap.get(supplierName.toLowerCase()).id;
            }

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              validRows.push({
                ...item,
                normalized: {
                  productId: product.id,
                  productName: product.name,
                  sku: product.sku,
                  quantity,
                  unitPrice,
                  supplierName: supplierName || 'Bulk Excel Inward',
                  supplierId,
                  date: dateVal,
                  reference,
                  notes
                }
              });
            }
          }
          break;
        }

        case 'invoices': {
          const clients = await prisma.client.findMany();
          const clientMap = new Map();
          clients.forEach(c => {
            clientMap.set(c.companyName.toLowerCase().trim(), c);
            clientMap.set(c.email.toLowerCase().trim(), c);
          });

          const products = await prisma.product.findMany();
          const productMap = new Map();
          products.forEach(p => productMap.set(p.sku.toLowerCase().trim(), p));

          const existingInvoices = await prisma.invoice.findMany({ select: { invoiceNumber: true } });
          const dbInvNums = new Set(existingInvoices.map(i => i.invoiceNumber.toLowerCase().trim()));

          // Group by invoice number or row identifier
          let invoiceGroups = {};
          let autoCounter = 1;

          for (const item of normalizedRows) {
            const errors = [];
            const clientIdentifier = cleanStr(item.data.clientIdentifier);
            const invoiceNumber = cleanStr(item.data.invoiceNumber);
            const dateVal = parseDate(item.data.date) || new Date();
            const dueDateVal = parseDate(item.data.dueDate) || new Date(dateVal.getTime() + 15 * 86400000);
            const invoiceType = cleanStr(item.data.invoiceType) || 'TAX INVOICE';
            const productSku = cleanStr(item.data.productSku);
            const description = cleanStr(item.data.description);
            const quantity = parseNum(item.data.quantity, 0);
            const price = parseNum(item.data.price, 0);
            const taxRate = parseNum(item.data.taxRate, 18);
            const tdsRate = parseNum(item.data.tdsRate, 0);
            const tdsSection = cleanStr(item.data.tdsSection);
            const tcsRate = parseNum(item.data.tcsRate, 0);
            const paymentTerms = cleanStr(item.data.paymentTerms) || 'Due on Receipt';
            const notes = cleanStr(item.data.notes);

            if (!clientIdentifier) errors.push('Client Identifier (Name or Email) is required.');
            else if (!clientMap.has(clientIdentifier.toLowerCase())) errors.push(`Client "${clientIdentifier}" not found in database.`);

            if (!description) errors.push('Item Description is required.');
            if (quantity <= 0) errors.push('Quantity must be greater than zero.');
            if (price < 0) errors.push('Price cannot be negative.');

            let matchedProduct = null;
            if (productSku) {
              matchedProduct = productMap.get(productSku.toLowerCase());
              if (!matchedProduct) errors.push(`Product SKU "${productSku}" not found.`);
              else if (matchedProduct.currentStock < quantity) {
                errors.push(`Insufficient stock for "${matchedProduct.name}". Available: ${matchedProduct.currentStock}, Requested: ${quantity}`);
              }
            }

            if (invoiceNumber && dbInvNums.has(invoiceNumber.toLowerCase())) {
              errors.push(`Invoice Number "${invoiceNumber}" already exists in database.`);
            }

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              const client = clientMap.get(clientIdentifier.toLowerCase());
              // Use invoiceNumber if specified, else group by client+date
              const groupKey = invoiceNumber || `AUTO_GRP_${client.id}_${dateVal.toISOString().split('T')[0]}`;
              
              if (!invoiceGroups[groupKey]) {
                invoiceGroups[groupKey] = {
                  invoiceNumber: invoiceNumber || `INV-${new Date().getFullYear()}-${String(existingInvoices.length + autoCounter++).padStart(4, '0')}`,
                  client,
                  date: dateVal,
                  dueDate: dueDateVal,
                  invoiceType,
                  tdsRate,
                  tdsSection,
                  tcsRate,
                  paymentTerms,
                  notes,
                  items: []
                };
              }

              invoiceGroups[groupKey].items.push({
                productId: matchedProduct ? matchedProduct.id : null,
                productSku: matchedProduct ? matchedProduct.sku : null,
                description,
                quantity,
                price,
                taxRate
              });

              validRows.push({
                ...item,
                normalized: {
                  invoiceNumber: invoiceGroups[groupKey].invoiceNumber,
                  clientName: client.companyName,
                  description,
                  quantity,
                  price,
                  taxRate
                }
              });
            }
          }
          break;
        }

        case 'expenses': {
          const suppliers = await prisma.supplier.findMany();
          const supMap = new Map();
          suppliers.forEach(s => supMap.set(s.companyName.toLowerCase().trim(), s));

          for (const item of normalizedRows) {
            const errors = [];
            const description = cleanStr(item.data.description);
            const amount = parseNum(item.data.amount, 0);
            let category = cleanStr(item.data.category);
            const dateVal = parseDate(item.data.date);
            const supplierName = cleanStr(item.data.supplierName);
            const notes = cleanStr(item.data.notes);

            if (!description) errors.push('Description is required.');
            if (amount <= 0) errors.push('Amount must be greater than zero.');
            if (!category) errors.push('Category is required.');
            else {
              const matchedCat = EXPENSE_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
              if (!matchedCat) category = 'Other';
              else category = matchedCat;
            }

            if (!dateVal) errors.push('Valid transaction Date (YYYY-MM-DD) is required.');

            let supplierId = null;
            if (supplierName && supMap.has(supplierName.toLowerCase())) {
              supplierId = supMap.get(supplierName.toLowerCase()).id;
            }

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              validRows.push({
                ...item,
                normalized: { description, amount, category, date: dateVal, supplierId, notes }
              });
            }
          }
          break;
        }

        case 'vouchers': {
          // Group by voucher number
          const groups = {};

          for (const item of normalizedRows) {
            const errors = [];
            const voucherNumber = cleanStr(item.data.voucherNumber);
            const type = cleanStr(item.data.type).toUpperCase();
            const dateVal = parseDate(item.data.date);
            const narration = cleanStr(item.data.narration);
            const reference = cleanStr(item.data.reference);
            const accountName = cleanStr(item.data.accountName);
            const entryType = cleanStr(item.data.entryType).toUpperCase();
            const amount = parseNum(item.data.amount, 0);

            if (!voucherNumber) errors.push('Voucher # or Group ID is required.');
            if (!type || !VOUCHER_TYPES.includes(type)) errors.push(`Voucher type must be one of: ${VOUCHER_TYPES.join(', ')}.`);
            if (!dateVal) errors.push('Valid date is required.');
            if (!narration) errors.push('Narration is required.');
            if (!accountName) errors.push('Account Name is required.');
            if (!['DEBIT', 'CREDIT'].includes(entryType)) errors.push('Entry Type must be DEBIT or CREDIT.');
            if (amount <= 0) errors.push('Amount must be positive.');

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              if (!groups[voucherNumber]) {
                groups[voucherNumber] = {
                  voucherNumber,
                  type,
                  date: dateVal,
                  narration,
                  reference,
                  items: []
                };
              }
              groups[voucherNumber].items.push({
                accountName,
                type: entryType,
                amount,
                rowNumber: item.rowNumber
              });
            }
          }

          // Balance check for each voucher group
          for (const [vNum, group] of Object.entries(groups)) {
            if (group.items.length < 2) {
              group.items.forEach(it => {
                invalidRows.push({
                  rowNumber: it.rowNumber,
                  data: { voucherNumber: vNum, accountName: it.accountName, amount: it.amount },
                  errors: [`Voucher ${vNum} requires at least 2 entries (one DEBIT and one CREDIT).`]
                });
              });
              continue;
            }

            let debitSum = 0;
            let creditSum = 0;
            group.items.forEach(it => {
              if (it.type === 'DEBIT') debitSum += it.amount;
              else creditSum += it.amount;
            });

            const diff = Math.abs(debitSum - creditSum);
            if (diff > 0.02) {
              group.items.forEach(it => {
                invalidRows.push({
                  rowNumber: it.rowNumber,
                  data: { voucherNumber: vNum, accountName: it.accountName, amount: it.amount },
                  errors: [`Voucher ${vNum} is unbalanced. Debits (₹${debitSum.toFixed(2)}) != Credits (₹${creditSum.toFixed(2)}). Diff: ₹${diff.toFixed(2)}`]
                });
              });
            } else {
              group.items.forEach(it => {
                validRows.push({
                  rowNumber: it.rowNumber,
                  data: { voucherNumber: vNum, accountName: it.accountName, type: it.type, amount: it.amount },
                  normalized: {
                    voucherNumber: vNum,
                    type: group.type,
                    date: group.date,
                    narration: group.narration,
                    reference: group.reference,
                    accountName: it.accountName,
                    entryType: it.type,
                    amount: it.amount
                  }
                });
              });
            }
          }
          break;
        }

        case 'employees': {
          const existingEmployees = await prisma.employee.findMany({ select: { email: true } });
          const dbEmails = new Set(existingEmployees.map(e => e.email.toLowerCase().trim()));
          const batchEmails = new Set();

          for (const item of normalizedRows) {
            const errors = [];
            const name = cleanStr(item.data.name);
            const email = cleanStr(item.data.email);
            const designation = cleanStr(item.data.designation);
            const department = cleanStr(item.data.department);
            const pan = cleanStr(item.data.pan);
            const bankAccount = cleanStr(item.data.bankAccount);
            const ifscCode = cleanStr(item.data.ifscCode);
            const baseSalary = parseNum(item.data.baseSalary, -1);
            const allowances = parseNum(item.data.allowances, 0);
            const deductions = parseNum(item.data.deductions, 0);

            if (!name) errors.push('Full Name is required.');
            if (!email) errors.push('Email is required.');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format.');

            if (!designation) errors.push('Designation is required.');
            if (baseSalary < 0) errors.push('Base Salary is required and cannot be negative.');

            const eLower = email.toLowerCase();
            if (dbEmails.has(eLower)) errors.push(`Employee with email "${email}" already exists.`);
            if (batchEmails.has(eLower)) errors.push(`Duplicate email "${email}" in file.`);

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              batchEmails.add(eLower);
              validRows.push({
                ...item,
                normalized: { name, email, designation, department, pan, bankAccount, ifscCode, baseSalary, allowances, deductions }
              });
            }
          }
          break;
        }

        case 'payslips': {
          const employees = await prisma.employee.findMany();
          const empMap = new Map();
          employees.forEach(e => {
            empMap.set(e.email.toLowerCase().trim(), e);
            empMap.set(e.id, e);
          });

          const existingPayslips = await prisma.payslip.findMany();
          const payslipSet = new Set(existingPayslips.map(p => `${p.employeeId}_${p.month}_${p.year}`));
          const batchSet = new Set();

          for (const item of normalizedRows) {
            const errors = [];
            const empIden = cleanStr(item.data.employeeIdentifier);
            const month = parseInt(item.data.month, 10);
            const year = parseInt(item.data.year, 10);
            const paidDays = parseNum(item.data.paidDays, -1);

            if (!empIden) errors.push('Employee Email or ID is required.');
            else if (!empMap.has(empIden.toLowerCase()) && !empMap.has(empIden)) {
              errors.push(`Employee "${empIden}" not found in employee directory.`);
            }

            if (isNaN(month) || month < 1 || month > 12) errors.push('Month must be between 1 and 12.');
            if (isNaN(year) || year < 2000 || year > 2100) errors.push('Valid 4-digit Year is required.');

            const employee = empMap.get(empIden.toLowerCase()) || empMap.get(empIden);

            if (employee && !isNaN(month) && !isNaN(year)) {
              const daysInMonth = new Date(year, month, 0).getDate();
              if (paidDays < 0 || paidDays > daysInMonth) {
                errors.push(`Paid Days must be between 0 and ${daysInMonth} for ${MONTHS[month - 1]} ${year}.`);
              }

              const key = `${employee.id}_${month}_${year}`;
              if (payslipSet.has(key)) errors.push(`Payslip for ${MONTHS[month - 1]} ${year} already generated for this employee.`);
              if (batchSet.has(key)) errors.push(`Duplicate payslip for same month/year in file.`);
              batchSet.add(key);
            }

            if (errors.length > 0) {
              invalidRows.push({ ...item, errors });
            } else {
              validRows.push({
                ...item,
                normalized: {
                  employeeId: employee.id,
                  employeeName: employee.name,
                  month,
                  year,
                  paidDays
                }
              });
            }
          }
          break;
        }
      }

      res.json({
        module: moduleKey,
        moduleName: config.name,
        totalRows: normalizedRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows
      });
    } catch (error) {
      console.error('Preview import error:', error);
      res.status(500).json({ error: error.message || 'Failed to parse and validate Excel file.' });
    }
  }
];

/**
 * Commit Validated Excel Import into the Database
 * Executes atomic transactions to guarantee financial integrity.
 */
exports.commitImport = async (req, res) => {
  try {
    const moduleKey = req.params.module.toLowerCase();
    const { validRows } = req.body;

    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return res.status(400).json({ error: 'No validated rows provided for commit.' });
    }

    let insertedCount = 0;

    switch (moduleKey) {
      case 'clients': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            await tx.client.create({
              data: {
                companyName: data.companyName,
                email: data.email,
                phone: data.phone || null,
                address: data.address || null,
                state: data.state,
                city: data.city || null,
                zip: data.zip || null,
                gstin: data.gstin || null,
                pan: data.pan || null
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'suppliers': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            await tx.supplier.create({
              data: {
                companyName: data.companyName,
                contactName: data.contactName || null,
                email: data.email,
                phone: data.phone || null,
                address: data.address || null,
                state: data.state,
                city: data.city || null,
                zip: data.zip || null,
                gstin: data.gstin || null,
                pan: data.pan || null
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'products': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            const newProduct = await tx.product.create({
              data: {
                name: data.name,
                sku: data.sku,
                barcode: data.barcode,
                description: data.description || null,
                category: data.category,
                unit: data.unit,
                purchasePrice: data.purchasePrice,
                sellingPrice: data.sellingPrice,
                taxRate: data.taxRate,
                alertThreshold: data.alertThreshold,
                currentStock: data.currentStock
              }
            });

            if (data.currentStock > 0) {
              await tx.stockTransaction.create({
                data: {
                  productId: newProduct.id,
                  type: 'INWARD',
                  quantity: data.currentStock,
                  unitPrice: data.purchasePrice,
                  notes: 'Initial opening stock from Excel import',
                  supplierName: 'Excel Bulk Setup'
                }
              });
            }
            insertedCount++;
          }
        });
        break;
      }

      case 'restock': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            const product = await tx.product.findUnique({ where: { id: data.productId } });
            if (!product) throw new Error(`Product not found for SKU: ${data.sku}`);

            const oldStock = product.currentStock;
            const oldPrice = product.purchasePrice || 0;
            const addedQty = parseFloat(data.quantity);
            const costPrice = parseFloat(data.unitPrice) || 0;
            const newStock = oldStock + addedQty;

            let updatedPrice = costPrice;
            if (oldStock > 0 && newStock > 0) {
              updatedPrice = ((oldStock * oldPrice) + (addedQty * costPrice)) / newStock;
            }

            await tx.product.update({
              where: { id: data.productId },
              data: {
                currentStock: newStock,
                purchasePrice: Math.round(updatedPrice * 100) / 100
              }
            });

            await tx.stockTransaction.create({
              data: {
                productId: data.productId,
                type: 'INWARD',
                quantity: addedQty,
                unitPrice: costPrice,
                supplierName: data.supplierName || 'Excel Restock Import',
                supplierId: data.supplierId || null,
                reference: data.reference || null,
                notes: data.notes || 'Inward stock from Excel batch',
                date: data.date ? new Date(data.date) : new Date()
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'invoices': {
        // Group items by invoiceNumber
        const invoiceMap = new Map();
        for (const item of validRows) {
          const norm = item.normalized;
          const invNum = norm.invoiceNumber;
          if (!invoiceMap.has(invNum)) {
            invoiceMap.set(invNum, {
              invoiceNumber: invNum,
              clientName: norm.clientName,
              items: []
            });
          }
          invoiceMap.get(invNum).items.push(norm);
        }

        // Fetch client and product records to compute totals
        const clients = await prisma.client.findMany();
        const clientLookup = new Map();
        clients.forEach(c => clientLookup.set(c.companyName.toLowerCase().trim(), c));

        await prisma.$transaction(async (tx) => {
          for (const [invNum, invData] of invoiceMap.entries()) {
            const client = clientLookup.get(invData.clientName.toLowerCase().trim());
            if (!client) throw new Error(`Client "${invData.clientName}" not found.`);

            const calculated = calculateTaxes(invData.items, client.state, 0, 0);

            const createdInv = await tx.invoice.create({
              data: {
                invoiceNumber: invNum,
                invoiceType: 'TAX INVOICE',
                date: new Date(),
                dueDate: new Date(Date.now() + 15 * 86400000),
                status: 'UNPAID',
                clientId: client.id,
                subTotal: calculated.subTotal,
                cgst: calculated.cgst,
                sgst: calculated.sgst,
                igst: calculated.igst,
                tdsRate: calculated.tdsRate,
                tdsAmount: calculated.tdsAmount,
                tcsRate: calculated.tcsRate,
                tcsAmount: calculated.tcsAmount,
                grandTotal: calculated.grandTotal,
                netPayable: calculated.netPayable,
                totalAmount: calculated.netPayable,
                paymentTerms: 'Due on Receipt',
                notes: 'Imported from Excel spreadsheet',
                items: {
                  create: invData.items.map(it => ({
                    productId: it.productId || null,
                    description: it.description,
                    quantity: it.quantity,
                    price: it.price,
                    taxRate: it.taxRate,
                    amount: it.quantity * it.price
                  }))
                }
              }
            });

            // If products linked, decrement inventory and record outward transactions
            for (const it of invData.items) {
              if (it.productId) {
                await tx.product.update({
                  where: { id: it.productId },
                  data: { currentStock: { decrement: it.quantity } }
                });

                await tx.stockTransaction.create({
                  data: {
                    productId: it.productId,
                    type: 'OUTWARD',
                    quantity: it.quantity,
                    unitPrice: it.price,
                    reference: createdInv.invoiceNumber,
                    notes: `Sold via Invoice ${createdInv.invoiceNumber}`
                  }
                });
              }
            }
            insertedCount++;
          }
        });
        break;
      }

      case 'expenses': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            await tx.expense.create({
              data: {
                description: data.description,
                amount: data.amount,
                category: data.category,
                date: new Date(data.date),
                supplierId: data.supplierId || null,
                notes: data.notes || null
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'vouchers': {
        // Group items by voucherNumber
        const voucherMap = new Map();
        for (const item of validRows) {
          const norm = item.normalized || item.data;
          const vNum = norm.voucherNumber;
          if (!voucherMap.has(vNum)) {
            voucherMap.set(vNum, {
              voucherNumber: vNum,
              type: norm.type,
              date: new Date(norm.date),
              narration: norm.narration,
              reference: norm.reference,
              items: []
            });
          }
          voucherMap.get(vNum).items.push({
            accountName: norm.accountName,
            type: norm.entryType || norm.type,
            amount: norm.amount
          });
        }

        await prisma.$transaction(async (tx) => {
          for (const [vNum, vData] of voucherMap.entries()) {
            await tx.voucher.create({
              data: {
                voucherNumber: vNum,
                type: vData.type,
                date: vData.date,
                narration: vData.narration,
                reference: vData.reference || null,
                items: {
                  create: vData.items.map(it => ({
                    accountName: it.accountName,
                    type: it.type,
                    amount: it.amount
                  }))
                }
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'employees': {
        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            await tx.employee.create({
              data: {
                name: data.name,
                email: data.email,
                designation: data.designation,
                department: data.department || null,
                pan: data.pan || null,
                bankAccount: data.bankAccount || null,
                ifscCode: data.ifscCode || null,
                baseSalary: data.baseSalary,
                allowances: data.allowances || 0,
                deductions: data.deductions || 0
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      case 'payslips': {
        const employees = await prisma.employee.findMany();
        const empLookup = new Map(employees.map(e => [e.id, e]));

        await prisma.$transaction(async (tx) => {
          for (const item of validRows) {
            const data = item.normalized || item.data;
            const employee = empLookup.get(data.employeeId);
            if (!employee) continue;

            const totalDays = new Date(data.year, data.month, 0).getDate();
            const prorationFactor = data.paidDays / totalDays;

            const grossEarnings = Math.round((employee.baseSalary + employee.allowances) * prorationFactor * 100) / 100;
            const totalDeductions = Math.round(employee.deductions * prorationFactor * 100) / 100;
            const netSalary = Math.round((grossEarnings - totalDeductions) * 100) / 100;

            await tx.payslip.create({
              data: {
                employeeId: employee.id,
                month: data.month,
                year: data.year,
                paidDays: data.paidDays,
                grossEarnings,
                totalDeductions,
                netSalary,
                status: 'UNPAID'
              }
            });
            insertedCount++;
          }
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Cannot commit unknown module "${moduleKey}".` });
    }

    res.json({
      success: true,
      module: moduleKey,
      count: insertedCount,
      message: `Successfully imported ${insertedCount} ${MODULE_CONFIGS[moduleKey]?.name || 'records'} into database.`
    });
  } catch (error) {
    console.error('Commit import error:', error);
    res.status(500).json({ error: error.message || 'Transaction failed while saving records to database.' });
  }
};

/**
 * Generate and download an Excel Error Report for rejected rows
 */
exports.downloadErrorReport = async (req, res) => {
  try {
    const moduleKey = req.params.module.toLowerCase();
    const config = MODULE_CONFIGS[moduleKey];
    const { invalidRows } = req.body;

    if (!config) {
      return res.status(404).json({ error: `Unsupported module "${moduleKey}"` });
    }

    if (!invalidRows || !Array.isArray(invalidRows) || invalidRows.length === 0) {
      return res.status(400).json({ error: 'No invalid rows provided for error report.' });
    }

    const workbook = await excelService.generateErrorReport(
      config.name,
      config.columns,
      invalidRows
    );

    await excelService.sendWorkbookResponse(res, workbook, `${moduleKey}_error_report.xlsx`);
  } catch (error) {
    console.error('Download error report error:', error);
    res.status(500).json({ error: 'Failed to generate error report spreadsheet.' });
  }
};

// -------------------------------------------------------------
// EXPORT HANDLERS
// -------------------------------------------------------------

/**
 * Export Clients List to Excel
 */
exports.exportClients = async (req, res) => {
  try {
    const { search } = req.query;
    const clients = await prisma.client.findMany({
      include: {
        invoices: {
          select: { totalAmount: true, status: true }
        }
      },
      orderBy: { companyName: 'asc' }
    });

    const filtered = clients.filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.companyName.toLowerCase().includes(s) ||
             c.email.toLowerCase().includes(s) ||
             (c.gstin && c.gstin.toLowerCase().includes(s)) ||
             (c.pan && c.pan.toLowerCase().includes(s));
    });

    const workbook = excelService.createWorkbook('Clients Directory');
    const sheet = workbook.addWorksheet('Clients');

    // Title
    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - CLIENTS DIRECTORY`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.mergeCells('A2:J2');
    sheet.getCell('A2').value = `Exported on ${new Date().toLocaleString('en-IN')}. Total Clients: ${filtered.length}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    const headers = [
      'Company Name', 'Email Address', 'Phone Number', 'Office Address',
      'City', 'State (GST)', 'ZIP Code', 'GSTIN', 'PAN',
      'Total Invoices', 'Total Invoiced (INR)', 'Total Paid (INR)', 'Balance Due (INR)'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    filtered.forEach((c, idx) => {
      let invoiced = 0;
      let paid = 0;
      c.invoices.forEach(inv => {
        invoiced += inv.totalAmount;
        if (inv.status === 'PAID') paid += inv.totalAmount;
      });
      const balanceDue = invoiced - paid;

      const rowValues = [
        excelService.sanitizeValue(c.companyName),
        excelService.sanitizeValue(c.email),
        excelService.sanitizeValue(c.phone || '-'),
        excelService.sanitizeValue(c.address || '-'),
        excelService.sanitizeValue(c.city || '-'),
        excelService.sanitizeValue(c.state),
        excelService.sanitizeValue(c.zip || '-'),
        excelService.sanitizeValue(c.gstin || '-'),
        excelService.sanitizeValue(c.pan || '-'),
        c.invoices.length,
        Math.round(invoiced * 100) / 100,
        Math.round(paid * 100) / 100,
        Math.round(balanceDue * 100) / 100
      ];

      const row = sheet.addRow(rowValues);
      excelService.styleDataRow(row, idx % 2 === 0, {
        10: { numFmt: '#,##0', align: 'right' },
        11: { numFmt: '₹#,##0.00', align: 'right' },
        12: { numFmt: '₹#,##0.00', align: 'right' },
        13: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Clients_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export clients error:', error);
    res.status(500).json({ error: 'Failed to export clients to Excel.' });
  }
};

/**
 * Export Client Statement to Excel
 */
exports.exportClientStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!client) return res.status(404).json({ error: 'Client not found.' });

    // Ledger entries
    const allEntries = [];
    client.invoices.forEach(inv => {
      allEntries.push({
        date: new Date(inv.date),
        type: 'DEBIT',
        amount: inv.totalAmount,
        reference: inv.invoiceNumber,
        description: `${inv.invoiceType || 'Tax Invoice'} Issued`
      });
      if (inv.status === 'PAID') {
        allEntries.push({
          date: inv.updatedAt ? new Date(inv.updatedAt) : new Date(inv.date),
          type: 'CREDIT',
          amount: inv.totalAmount,
          reference: inv.invoiceNumber,
          description: `Payment Received for #${inv.invoiceNumber}`
        });
      }
    });

    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    let openingBal = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    const filtered = [];

    allEntries.forEach(entry => {
      if (start && entry.date < start) {
        if (entry.type === 'DEBIT') openingBal += entry.amount;
        else openingBal -= entry.amount;
      } else if ((!start || entry.date >= start) && (!end || entry.date <= end)) {
        if (entry.type === 'DEBIT') totalDebits += entry.amount;
        else totalCredits += entry.amount;
        filtered.push(entry);
      }
    });

    const workbook = excelService.createWorkbook('Client Statement');
    const sheet = workbook.addWorksheet('Statement');

    // Title Block
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'STATEMENT OF ACCOUNT';
    sheet.getCell('A1').font = excelService.FONT_TITLE;

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Client: ${client.companyName} | State: ${client.state} | GSTIN: ${client.gstin || 'N/A'}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;

    sheet.mergeCells('A3:F3');
    const sStr = start ? start.toISOString().split('T')[0] : 'All Time';
    const eStr = end ? end.toISOString().split('T')[0] : 'Present';
    sheet.getCell('A3').value = `Period: ${sStr} to ${eStr} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
    sheet.getCell('A3').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    // Summary block
    sheet.addRow(['Opening Balance:', openingBal]);
    sheet.addRow(['Total Invoiced (+):', totalDebits]);
    sheet.addRow(['Total Paid (-):', totalCredits]);
    sheet.addRow(['Closing Balance Due:', openingBal + totalDebits - totalCredits]);
    sheet.addRow([]);

    const headers = ['Date', 'Particulars / Description', 'Reference', 'Debit (+)', 'Credit (-)', 'Running Balance'];
    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    let running = openingBal;
    filtered.forEach((it, idx) => {
      if (it.type === 'DEBIT') running += it.amount;
      else running -= it.amount;

      const row = sheet.addRow([
        it.date.toISOString().split('T')[0],
        it.description,
        it.reference || '-',
        it.type === 'DEBIT' ? it.amount : '',
        it.type === 'CREDIT' ? it.amount : '',
        running
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        4: { numFmt: '₹#,##0.00', align: 'right' },
        5: { numFmt: '₹#,##0.00', align: 'right' },
        6: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Statement_${client.companyName.replace(/\s+/g, '_')}.xlsx`);
  } catch (error) {
    console.error('Export statement error:', error);
    res.status(500).json({ error: 'Failed to export client statement.' });
  }
};

/**
 * Export Invoices / Sales Ledger to Excel
 */
exports.exportInvoices = async (req, res) => {
  try {
    const { startDate, endDate, status, search } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: true,
        items: true
      },
      orderBy: { date: 'desc' }
    });

    const filtered = invoices.filter(inv => {
      if (!search) return true;
      const s = search.toLowerCase();
      return inv.invoiceNumber.toLowerCase().includes(s) ||
             inv.client.companyName.toLowerCase().includes(s);
    });

    const workbook = excelService.createWorkbook('Invoices Sales Ledger');
    const sheet = workbook.addWorksheet('Sales Ledger');

    sheet.mergeCells('A1:P1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - SALES & INVOICE LEDGER`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.mergeCells('A2:P2');
    sheet.getCell('A2').value = `Total Invoices: ${filtered.length} | Generated on ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    const headers = [
      'Invoice #', 'Type', 'Date', 'Due Date', 'Client Name', 'Client State', 'Client GSTIN',
      'Taxable Subtotal (INR)', 'CGST (INR)', 'SGST (INR)', 'IGST (INR)', 'TCS (INR)',
      'Grand Total (INR)', 'TDS Deduction (INR)', 'Net Payable (INR)', 'Payment Status'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    filtered.forEach((inv, idx) => {
      const row = sheet.addRow([
        excelService.sanitizeValue(inv.invoiceNumber),
        inv.invoiceType,
        new Date(inv.date).toISOString().split('T')[0],
        new Date(inv.dueDate).toISOString().split('T')[0],
        excelService.sanitizeValue(inv.client.companyName),
        inv.client.state,
        inv.client.gstin || 'Unregistered',
        inv.subTotal,
        inv.cgst,
        inv.sgst,
        inv.igst,
        inv.tcsAmount,
        inv.grandTotal,
        inv.tdsAmount,
        inv.netPayable,
        inv.status
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        3: { align: 'center' },
        4: { align: 'center' },
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' },
        10: { numFmt: '₹#,##0.00', align: 'right' },
        11: { numFmt: '₹#,##0.00', align: 'right' },
        12: { numFmt: '₹#,##0.00', align: 'right' },
        13: { numFmt: '₹#,##0.00', align: 'right' },
        14: { numFmt: '₹#,##0.00', align: 'right' },
        15: { numFmt: '₹#,##0.00', align: 'right' },
        16: { align: 'center' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Invoices_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export invoices error:', error);
    res.status(500).json({ error: 'Failed to export invoices to Excel.' });
  }
};

/**
 * Export Single Invoice as genuine formatted Excel document
 */
exports.exportSingleInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true }
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    const workbook = excelService.createWorkbook(`Invoice ${invoice.invoiceNumber}`);
    const sheet = workbook.addWorksheet('Invoice');

    // Header Title
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'}`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `${invoice.invoiceType.toUpperCase()} - #${invoice.invoiceNumber}`;
    sheet.getCell('A2').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: '4F46E5' } };

    sheet.mergeCells('A3:F3');
    sheet.getCell('A3').value = `Invoice Date: ${new Date(invoice.date).toLocaleDateString('en-IN')} | Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')} | Status: ${invoice.status}`;
    sheet.getCell('A3').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    // Bill To
    sheet.addRow(['BILL TO:', excelService.sanitizeValue(invoice.client.companyName)]);
    sheet.addRow(['Email:', excelService.sanitizeValue(invoice.client.email)]);
    sheet.addRow(['State:', excelService.sanitizeValue(invoice.client.state), 'GSTIN:', excelService.sanitizeValue(invoice.client.gstin || 'N/A')]);
    sheet.addRow([]);

    // Items table
    const itemHeaders = ['#', 'Description', 'Quantity', 'Rate (INR)', 'GST %', 'Amount (INR)'];
    const hRow = sheet.addRow(itemHeaders);
    excelService.styleHeaderRow(hRow);

    invoice.items.forEach((it, idx) => {
      const row = sheet.addRow([
        idx + 1,
        excelService.sanitizeValue(it.description),
        it.quantity,
        it.price,
        `${it.taxRate}%`,
        it.amount
      ]);
      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        3: { numFmt: '#,##0.00', align: 'right' },
        4: { numFmt: '₹#,##0.00', align: 'right' },
        5: { align: 'center' },
        6: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    sheet.addRow([]);
    // Totals Section
    sheet.addRow(['', '', '', '', 'Subtotal:', invoice.subTotal]);
    sheet.addRow(['', '', '', '', 'CGST:', invoice.cgst]);
    sheet.addRow(['', '', '', '', 'SGST:', invoice.sgst]);
    sheet.addRow(['', '', '', '', 'IGST:', invoice.igst]);
    if (invoice.tcsAmount > 0) sheet.addRow(['', '', '', '', `TCS (${invoice.tcsRate}%):`, invoice.tcsAmount]);
    sheet.addRow(['', '', '', '', 'Grand Total:', invoice.grandTotal]);
    if (invoice.tdsAmount > 0) sheet.addRow(['', '', '', '', `TDS Withheld (${invoice.tdsRate}%):`, -invoice.tdsAmount]);
    sheet.addRow(['', '', '', '', 'Net Payable:', invoice.netPayable]);

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `${invoice.invoiceNumber}.xlsx`);
  } catch (error) {
    console.error('Export single invoice error:', error);
    res.status(500).json({ error: 'Failed to export invoice spreadsheet.' });
  }
};

/**
 * Export Products Catalog to Excel
 */
exports.exportProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });

    const filtered = products.filter(p => {
      if (category && category !== 'ALL' && p.category !== category) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
      }
      return true;
    });

    const workbook = excelService.createWorkbook('Product Catalog');
    const sheet = workbook.addWorksheet('Products');

    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - INVENTORY CATALOG`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.mergeCells('A2:L2');
    sheet.getCell('A2').value = `Total Products: ${filtered.length} | Generated on ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    const headers = [
      'Product Name', 'SKU Code', 'Barcode/UPC', 'Category', 'Unit',
      'Current Stock', 'Cost Price (INR)', 'Retail Price (INR)', 'Total Stock Value (INR)',
      'GST %', 'Alert Threshold', 'Stock Status'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    filtered.forEach((p, idx) => {
      const stockVal = p.currentStock * p.purchasePrice;
      const isLow = p.currentStock <= p.alertThreshold;

      const row = sheet.addRow([
        excelService.sanitizeValue(p.name),
        excelService.sanitizeValue(p.sku),
        excelService.sanitizeValue(p.barcode || '-'),
        p.category,
        p.unit,
        p.currentStock,
        p.purchasePrice,
        p.sellingPrice,
        Math.round(stockVal * 100) / 100,
        p.taxRate,
        p.alertThreshold,
        isLow ? 'LOW STOCK' : 'IN STOCK'
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        6: { numFmt: '#,##0.00', align: 'right' },
        7: { numFmt: '₹#,##0.00', align: 'right' },
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' },
        10: { numFmt: '0.00', align: 'center' },
        11: { numFmt: '#,##0', align: 'right' },
        12: { align: 'center' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Products_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({ error: 'Failed to export products catalog.' });
  }
};

/**
 * Export Stock Transactions / Movement Ledger to Excel
 */
exports.exportStockTransactions = async (req, res) => {
  try {
    const transactions = await prisma.stockTransaction.findMany({
      include: { product: true },
      orderBy: { date: 'desc' }
    });

    const workbook = excelService.createWorkbook('Stock Transactions Ledger');
    const sheet = workbook.addWorksheet('Transactions');

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - STOCK MOVEMENT LEDGER`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.mergeCells('A2:J2');
    sheet.getCell('A2').value = `Total Ledger Transactions: ${transactions.length} | Generated on ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    const headers = [
      'Date & Time', 'Product Name', 'SKU', 'Category', 'Type',
      'Quantity', 'Unit', 'Unit Cost (INR)', 'Total Value (INR)', 'Supplier / Reference', 'Notes'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    transactions.forEach((tx, idx) => {
      const totVal = tx.quantity * tx.unitPrice;
      const row = sheet.addRow([
        new Date(tx.date).toLocaleString('en-IN'),
        excelService.sanitizeValue(tx.product?.name || '-'),
        excelService.sanitizeValue(tx.product?.sku || '-'),
        tx.product?.category || '-',
        tx.type,
        tx.quantity,
        tx.product?.unit || 'PCS',
        tx.unitPrice,
        Math.round(totVal * 100) / 100,
        excelService.sanitizeValue(tx.supplierName || tx.reference || '-'),
        excelService.sanitizeValue(tx.notes || '-')
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        5: { align: 'center' },
        6: { numFmt: '#,##0.00', align: 'right' },
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Stock_Movement_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export stock transactions error:', error);
    res.status(500).json({ error: 'Failed to export stock movements.' });
  }
};

/**
 * Export Suppliers to Excel
 */
exports.exportSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        transactions: { select: { quantity: true, unitPrice: true } },
        expenses: { select: { amount: true } }
      },
      orderBy: { companyName: 'asc' }
    });

    const workbook = excelService.createWorkbook('Suppliers Directory');
    const sheet = workbook.addWorksheet('Suppliers');

    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - SUPPLIERS DIRECTORY`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = [
      'Company Name', 'Contact Person', 'Email Address', 'Phone Number',
      'Address', 'State', 'City', 'GSTIN', 'PAN',
      'Purchases Count', 'Total Spend (INR)'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    suppliers.forEach((s, idx) => {
      const txSpend = s.transactions.reduce((acc, t) => acc + (t.quantity * t.unitPrice), 0);
      const expSpend = s.expenses.reduce((acc, e) => acc + e.amount, 0);
      const totalSpend = txSpend + expSpend;

      const row = sheet.addRow([
        excelService.sanitizeValue(s.companyName),
        excelService.sanitizeValue(s.contactName || '-'),
        excelService.sanitizeValue(s.email),
        excelService.sanitizeValue(s.phone || '-'),
        excelService.sanitizeValue(s.address || '-'),
        s.state,
        s.city || '-',
        s.gstin || '-',
        s.pan || '-',
        s.transactions.length,
        Math.round(totalSpend * 100) / 100
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        10: { numFmt: '#,##0', align: 'right' },
        11: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export suppliers error:', error);
    res.status(500).json({ error: 'Failed to export suppliers.' });
  }
};

/**
 * Export Expenses to Excel
 */
exports.exportExpenses = async (req, res) => {
  try {
    const { category, startDate, endDate, search } = req.query;

    const where = {};
    if (category && category !== 'ALL') where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { supplier: true },
      orderBy: { date: 'desc' }
    });

    const filtered = expenses.filter(e => {
      if (!search) return true;
      const s = search.toLowerCase();
      return e.description.toLowerCase().includes(s) || (e.notes && e.notes.toLowerCase().includes(s));
    });

    const workbook = excelService.createWorkbook('Expenses Log');
    const sheet = workbook.addWorksheet('Expenses');

    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - OPERATING EXPENSES`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = ['Date', 'Description', 'Category', 'Payee / Supplier', 'Amount (INR)', 'Notes'];
    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    filtered.forEach((e, idx) => {
      const row = sheet.addRow([
        new Date(e.date).toISOString().split('T')[0],
        excelService.sanitizeValue(e.description),
        e.category,
        excelService.sanitizeValue(e.supplier?.companyName || '-'),
        e.amount,
        excelService.sanitizeValue(e.notes || '-')
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        5: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export expenses error:', error);
    res.status(500).json({ error: 'Failed to export expenses.' });
  }
};

/**
 * Export Vouchers to Excel
 */
exports.exportVouchers = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    const where = {};
    if (type && type !== 'ALL') where.type = type.toUpperCase();
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const vouchers = await prisma.voucher.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' }
    });

    const workbook = excelService.createWorkbook('Vouchers Ledger');
    const sheet = workbook.addWorksheet('Vouchers');

    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - VOUCHER & JOURNAL LEDGER`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = [
      'Voucher #', 'Type', 'Date', 'Reference', 'Narration',
      'Debited Accounts', 'Credited Accounts', 'Amount (INR)'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    vouchers.forEach((v, idx) => {
      const debits = v.items.filter(it => it.type === 'DEBIT');
      const credits = v.items.filter(it => it.type === 'CREDIT');
      const totalAmt = debits.reduce((acc, it) => acc + it.amount, 0);

      const debText = debits.map(d => `${d.accountName} (₹${d.amount.toFixed(2)})`).join(', ');
      const credText = credits.map(c => `${c.accountName} (₹${c.amount.toFixed(2)})`).join(', ');

      const row = sheet.addRow([
        excelService.sanitizeValue(v.voucherNumber),
        v.type,
        new Date(v.date).toISOString().split('T')[0],
        excelService.sanitizeValue(v.reference || '-'),
        excelService.sanitizeValue(v.narration),
        debText,
        credText,
        totalAmt
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        2: { align: 'center' },
        3: { align: 'center' },
        8: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Vouchers_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export vouchers error:', error);
    res.status(500).json({ error: 'Failed to export vouchers.' });
  }
};

/**
 * Export Employees to Excel
 */
exports.exportEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });

    const workbook = excelService.createWorkbook('Employees Directory');
    const sheet = workbook.addWorksheet('Employees');

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - EMPLOYEE DIRECTORY`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = [
      'Full Name', 'Email Address', 'Designation', 'Department',
      'PAN', 'Bank Account', 'IFSC Code',
      'Monthly Base Salary (INR)', 'Allowances (INR)', 'Deductions (INR)'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    employees.forEach((e, idx) => {
      const row = sheet.addRow([
        excelService.sanitizeValue(e.name),
        excelService.sanitizeValue(e.email),
        e.designation,
        e.department || '-',
        e.pan || '-',
        e.bankAccount || '-',
        e.ifscCode || '-',
        e.baseSalary,
        e.allowances,
        e.deductions
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' },
        10: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Employees_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export employees error:', error);
    res.status(500).json({ error: 'Failed to export employees.' });
  }
};

/**
 * Export Payslips to Excel
 */
exports.exportPayslips = async (req, res) => {
  try {
    const { month, year } = req.query;

    const where = {};
    if (month && month !== 'ALL') where.month = parseInt(month, 10);
    if (year && year !== 'ALL') where.year = parseInt(year, 10);

    const payslips = await prisma.payslip.findMany({
      where,
      include: { employee: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    const workbook = excelService.createWorkbook('Payroll Ledger');
    const sheet = workbook.addWorksheet('Payslips');

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = `${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'} - PAYROLL & SALARY REGISTER`;
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = [
      'Payslip Ref', 'Month & Year', 'Employee Name', 'Designation', 'Department',
      'Paid Days', 'Gross Earnings (INR)', 'Deductions (INR)', 'Net Salary (INR)', 'Status'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    payslips.forEach((ps, idx) => {
      const row = sheet.addRow([
        ps.id.substring(0, 8).toUpperCase(),
        `${MONTHS[ps.month - 1]} ${ps.year}`,
        excelService.sanitizeValue(ps.employee.name),
        ps.employee.designation,
        ps.employee.department || '-',
        ps.paidDays,
        ps.grossEarnings,
        ps.totalDeductions,
        ps.netSalary,
        ps.status
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        2: { align: 'center' },
        6: { numFmt: '#,##0.0', align: 'right' },
        7: { numFmt: '₹#,##0.00', align: 'right' },
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' },
        10: { align: 'center' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Payroll_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export payslips error:', error);
    res.status(500).json({ error: 'Failed to export payslips.' });
  }
};

/**
 * Export Financial & Accounting Reports
 */
exports.exportPLReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: start, lte: end }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: { items: { include: { product: true } } }
    });

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } }
    });

    const payslips = await prisma.payslip.findMany({ where: { status: 'PAID' } });

    let revenue = 0;
    let cogs = 0;
    invoices.forEach(inv => {
      revenue += inv.subTotal;
      inv.items.forEach(it => {
        if (it.product && it.product.purchasePrice) cogs += it.quantity * it.product.purchasePrice;
      });
    });

    let opex = 0;
    const expenseBreakdown = {};
    expenses.forEach(e => {
      opex += e.amount;
      expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + e.amount;
    });

    let payroll = 0;
    payslips.forEach(ps => payroll += ps.netSalary);

    const grossProfit = revenue - cogs;
    const totalExpenses = opex + payroll;
    const netProfit = grossProfit - totalExpenses;

    const workbook = excelService.createWorkbook('Profit & Loss Statement');
    const sheet = workbook.addWorksheet('P&L Statement');

    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = 'PROFIT & LOSS STATEMENT';
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.mergeCells('A2:C2');
    sheet.getCell('A2').value = `Period: ${startDate || 'All Time'} to ${endDate || 'Present'} | Generated on ${new Date().toLocaleString('en-IN')}`;
    sheet.getCell('A2').font = excelService.FONT_SUBTITLE;
    sheet.addRow([]);

    const headers = ['Financial Metric / Category', 'Type', 'Amount (INR)'];
    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    const rows = [
      ['Gross Sales Revenue', 'Revenue (+)', revenue],
      ['Cost of Goods Sold (COGS)', 'Cost (-)', -cogs],
      ['GROSS PROFIT', 'Summary', grossProfit],
      ['Salaries & Payroll', 'Operating Expense (-)', -payroll]
    ];

    Object.entries(expenseBreakdown).forEach(([cat, amt]) => {
      rows.push([cat, 'Operating Expense (-)', -amt]);
    });

    rows.push(['Total Operating Overheads', 'Summary', -totalExpenses]);
    rows.push(['NET PROFIT (EAT)', 'Net Bottom Line', netProfit]);

    rows.forEach((r, idx) => {
      const row = sheet.addRow(r);
      const isHeader = r[1].includes('Summary') || r[1].includes('Net');
      excelService.styleDataRow(row, idx % 2 === 0, {
        3: { numFmt: '₹#,##0.00', align: 'right' }
      });
      if (isHeader) {
        row.font = { name: 'Segoe UI', size: 10, bold: true };
      }
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `Profit_Loss_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export P&L error:', error);
    res.status(500).json({ error: 'Failed to export P&L report.' });
  }
};

/**
 * Export GST Tax Report to Excel
 */
exports.exportGSTReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: start, lte: end }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: { client: true },
      orderBy: { date: 'desc' }
    });

    const workbook = excelService.createWorkbook('GST Tax Report');
    const sheet = workbook.addWorksheet('GSTR-1 Outward');

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = 'GSTR-1 OUTWARD SUPPLIES TAX REGISTER';
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = [
      'Invoice #', 'Invoice Date', 'Client Name', 'Client GSTIN', 'State of Supply',
      'Taxable Value (INR)', 'CGST (INR)', 'SGST (INR)', 'IGST (INR)', 'Invoice Total (INR)'
    ];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    invoices.forEach((inv, idx) => {
      const row = sheet.addRow([
        excelService.sanitizeValue(inv.invoiceNumber),
        new Date(inv.date).toISOString().split('T')[0],
        excelService.sanitizeValue(inv.client.companyName),
        inv.client.gstin || 'URP (Unregistered)',
        inv.client.state,
        inv.subTotal,
        inv.cgst,
        inv.sgst,
        inv.igst,
        inv.grandTotal
      ]);

      excelService.styleDataRow(row, idx % 2 === 0, {
        1: { align: 'center' },
        2: { align: 'center' },
        6: { numFmt: '₹#,##0.00', align: 'right' },
        7: { numFmt: '₹#,##0.00', align: 'right' },
        8: { numFmt: '₹#,##0.00', align: 'right' },
        9: { numFmt: '₹#,##0.00', align: 'right' },
        10: { numFmt: '₹#,##0.00', align: 'right' }
      });
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `GSTR1_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export GST error:', error);
    res.status(500).json({ error: 'Failed to export GST report.' });
  }
};

/**
 * Export TDS & TCS Reports to Excel
 */
exports.exportTDSTCSReport = async (req, res) => {
  try {
    const { startDate, endDate, type = 'tds' } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: start, lte: end }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: { client: true },
      orderBy: { date: 'desc' }
    });

    const isTds = type.toLowerCase() === 'tds';
    const workbook = excelService.createWorkbook(isTds ? 'TDS Compliance Report' : 'TCS Compliance Report');
    const sheet = workbook.addWorksheet(isTds ? 'TDS Compliance' : 'TCS Compliance');

    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = isTds ? 'TDS DEDUCTION & COMPLIANCE LEDGER' : 'TCS COLLECTION & COMPLIANCE LEDGER';
    sheet.getCell('A1').font = excelService.FONT_TITLE;
    sheet.addRow([]);

    const headers = isTds
      ? ['Invoice #', 'Date', 'Client / Deductor', 'Client PAN', 'TDS Section', 'Taxable Amount (INR)', 'TDS Rate %', 'TDS Deducted (INR)']
      : ['Invoice #', 'Date', 'Customer', 'Customer PAN', 'Taxable Amount (INR)', 'TCS Rate %', 'TCS Collected (INR)'];

    const hRow = sheet.addRow(headers);
    excelService.styleHeaderRow(hRow);

    let idx = 0;
    invoices.forEach(inv => {
      if (isTds && (inv.tdsAmount > 0 || inv.tdsRate > 0)) {
        const row = sheet.addRow([
          excelService.sanitizeValue(inv.invoiceNumber),
          new Date(inv.date).toISOString().split('T')[0],
          excelService.sanitizeValue(inv.client.companyName),
          inv.client.pan || 'PAN NOT PROVIDED',
          inv.tdsSection || 'Unspecified',
          inv.subTotal,
          inv.tdsRate,
          inv.tdsAmount
        ]);
        excelService.styleDataRow(row, idx++ % 2 === 0, {
          1: { align: 'center' },
          2: { align: 'center' },
          6: { numFmt: '₹#,##0.00', align: 'right' },
          7: { numFmt: '0.00%', align: 'center' },
          8: { numFmt: '₹#,##0.00', align: 'right' }
        });
      } else if (!isTds && (inv.tcsAmount > 0 || inv.tcsRate > 0)) {
        const row = sheet.addRow([
          excelService.sanitizeValue(inv.invoiceNumber),
          new Date(inv.date).toISOString().split('T')[0],
          excelService.sanitizeValue(inv.client.companyName),
          inv.client.pan || 'PAN NOT PROVIDED',
          inv.subTotal,
          inv.tcsRate,
          inv.tcsAmount
        ]);
        excelService.styleDataRow(row, idx++ % 2 === 0, {
          1: { align: 'center' },
          2: { align: 'center' },
          5: { numFmt: '₹#,##0.00', align: 'right' },
          6: { numFmt: '0.00%', align: 'center' },
          7: { numFmt: '₹#,##0.00', align: 'right' }
        });
      }
    });

    excelService.autoFitColumns(sheet);
    await excelService.sendWorkbookResponse(res, workbook, `${isTds ? 'TDS' : 'TCS'}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Export TDS/TCS error:', error);
    res.status(500).json({ error: 'Failed to export TDS/TCS report.' });
  }
};

/**
 * Export Bookkeeping Statements (Trial Balance, Balance Sheet, General Ledger) to Excel
 */
exports.exportBookkeepingReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType = 'tb' } = req.query;
    // Utilize reportController logic to compile statement
    const reportController = require('./reportController');
    
    // Virtual mock req/res to get bookkeeping report calculations
    let reportData = null;
    const mockRes = {
      json: (data) => { reportData = data; },
      status: () => mockRes
    };
    await reportController.getBookkeepingReports({ query: { startDate, endDate } }, mockRes);

    if (!reportData) return res.status(500).json({ error: 'Failed to retrieve bookkeeping data.' });

    const workbook = excelService.createWorkbook('Bookkeeping Statement');

    if (reportType === 'tb') {
      const sheet = workbook.addWorksheet('Trial Balance');
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'TRIAL BALANCE STATEMENT';
      sheet.getCell('A1').font = excelService.FONT_TITLE;
      sheet.addRow([]);

      const headers = ['Account Name', 'Classification', 'Debit Balance (INR)', 'Credit Balance (INR)', 'Normal Balance'];
      const hRow = sheet.addRow(headers);
      excelService.styleHeaderRow(hRow);

      reportData.trialBalance.forEach((tb, idx) => {
        const row = sheet.addRow([
          tb.accountName,
          tb.category,
          tb.balanceType === 'DEBIT' ? tb.balance : '',
          tb.balanceType === 'CREDIT' ? tb.balance : '',
          tb.balanceType
        ]);
        excelService.styleDataRow(row, idx % 2 === 0, {
          3: { numFmt: '₹#,##0.00', align: 'right' },
          4: { numFmt: '₹#,##0.00', align: 'right' },
          5: { align: 'center' }
        });
      });

      sheet.addRow([]);
      const totRow = sheet.addRow(['TOTALS', '', reportData.totalTrialDebit, reportData.totalTrialCredit, '']);
      totRow.font = { name: 'Segoe UI', size: 10, bold: true };
      totRow.getCell(3).numFmt = '₹#,##0.00';
      totRow.getCell(4).numFmt = '₹#,##0.00';

      excelService.autoFitColumns(sheet);
      await excelService.sendWorkbookResponse(res, workbook, `Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (reportType === 'bs') {
      const sheet = workbook.addWorksheet('Balance Sheet');
      sheet.mergeCells('A1:C1');
      sheet.getCell('A1').value = 'BALANCE SHEET STATEMENT';
      sheet.getCell('A1').font = excelService.FONT_TITLE;
      sheet.addRow([]);

      const headers = ['Category / Item', 'Classification', 'Amount (INR)'];
      const hRow = sheet.addRow(headers);
      excelService.styleHeaderRow(hRow);

      // Assets
      sheet.addRow(['ASSETS', 'Header', '']);
      reportData.balanceSheet.assets.items.forEach(a => sheet.addRow([a.name, 'Asset', a.amount]));
      sheet.addRow(['TOTAL ASSETS', 'Summary', reportData.balanceSheet.assets.total]);
      sheet.addRow([]);

      // Liabilities
      sheet.addRow(['LIABILITIES', 'Header', '']);
      reportData.balanceSheet.liabilities.items.forEach(l => sheet.addRow([l.name, 'Liability', l.amount]));
      sheet.addRow(['TOTAL LIABILITIES', 'Summary', reportData.balanceSheet.liabilities.total]);
      sheet.addRow([]);

      // Equity
      sheet.addRow(['EQUITY', 'Header', '']);
      reportData.balanceSheet.equity.items.forEach(eq => sheet.addRow([eq.name, 'Equity', eq.amount]));
      sheet.addRow(['TOTAL EQUITY', 'Summary', reportData.balanceSheet.equity.total]);

      excelService.autoFitColumns(sheet);
      await excelService.sendWorkbookResponse(res, workbook, `Balance_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      // General Ledger
      const sheet = workbook.addWorksheet('General Ledger');
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'GENERAL LEDGER DETAIL REGISTER';
      sheet.getCell('A1').font = excelService.FONT_TITLE;
      sheet.addRow([]);

      const headers = ['Date', 'Account', 'Source / Journal', 'Narration', 'Reference', 'Debit (+)', 'Credit (-)', 'Running Balance'];
      const hRow = sheet.addRow(headers);
      excelService.styleHeaderRow(hRow);

      let idx = 0;
      Object.entries(reportData.ledgerDetails).forEach(([acctName, entries]) => {
        entries.forEach(p => {
          const row = sheet.addRow([
            new Date(p.date).toISOString().split('T')[0],
            acctName,
            p.source,
            excelService.sanitizeValue(p.narration),
            excelService.sanitizeValue(p.reference || '-'),
            p.type === 'DEBIT' ? p.amount : '',
            p.type === 'CREDIT' ? p.amount : '',
            p.balance
          ]);
          excelService.styleDataRow(row, idx++ % 2 === 0, {
            1: { align: 'center' },
            6: { numFmt: '₹#,##0.00', align: 'right' },
            7: { numFmt: '₹#,##0.00', align: 'right' },
            8: { numFmt: '₹#,##0.00', align: 'right' }
          });
        });
      });

      excelService.autoFitColumns(sheet);
      await excelService.sendWorkbookResponse(res, workbook, `General_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  } catch (error) {
    console.error('Export bookkeeping error:', error);
    res.status(500).json({ error: 'Failed to export bookkeeping statement.' });
  }
};
