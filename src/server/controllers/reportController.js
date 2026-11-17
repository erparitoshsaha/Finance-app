const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to generate months in a range
function getMonthsInRange(start, end) {
  const months = [];
  const curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (curr <= last) {
    months.push({
      year: curr.getFullYear(),
      month: curr.getMonth() + 1, // 1-12
      label: curr.toLocaleString('en-IN', { month: 'short', year: 'numeric' }) // e.g. "Jun 2026"
    });
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
}

// Get Profit & Loss statement
exports.getProfitAndLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    // 1. Fetch Invoices in range (excluding DRAFT and CANCELLED)
    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED']
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // 2. Fetch Expenses in range
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      }
    });

    // 3. Fetch Paid Payslips
    // We fetch all paid payslips and filter in-memory to match year and month precisely
    const payslips = await prisma.payslip.findMany({
      where: {
        status: 'PAID'
      }
    });

    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endYear = end.getFullYear();
    const endMonth = end.getMonth() + 1;

    const filteredPayslips = payslips.filter(p => {
      const pVal = p.year * 12 + p.month;
      const startVal = startYear * 12 + startMonth;
      const endVal = endYear * 12 + endMonth;
      return pVal >= startVal && pVal <= endVal;
    });

    // Calculate core P&L components
    let revenue = 0; // Gross Revenue based on subTotal
    let cogs = 0; // Cost of Goods Sold

    invoices.forEach(inv => {
      revenue += inv.subTotal;
      inv.items.forEach(item => {
        if (item.product && item.product.purchasePrice) {
          cogs += item.quantity * item.product.purchasePrice;
        }
      });
    });

    let operatingExpenses = 0;
    const expenseBreakdown = {};

    expenses.forEach(exp => {
      operatingExpenses += exp.amount;
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + exp.amount;
    });

    let payroll = 0;
    filteredPayslips.forEach(ps => {
      payroll += ps.netSalary;
    });

    // Group payroll into the breakdown for visualization
    if (payroll > 0) {
      expenseBreakdown['Salaries & Payroll'] = payroll;
    }

    const grossProfit = revenue - cogs;
    const totalExpenses = operatingExpenses + payroll;
    const netProfit = grossProfit - totalExpenses;

    // Calculate 6-month trend ending at the 'end' date (or today)
    const trendEnd = endDate ? new Date(endDate) : new Date();
    const trendStart = new Date(trendEnd.getFullYear(), trendEnd.getMonth() - 5, 1);
    const trendMonths = getMonthsInRange(trendStart, trendEnd);

    // Fetch historical records for trends
    const historicalInvoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: trendStart,
          lte: trendEnd
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED']
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    const historicalExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: trendStart,
          lte: trendEnd
        }
      }
    });

    const trends = trendMonths.map(tm => {
      const monthInvoices = historicalInvoices.filter(inv => {
        const d = new Date(inv.date);
        return d.getFullYear() === tm.year && (d.getMonth() + 1) === tm.month;
      });

      const monthExpenses = historicalExpenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getFullYear() === tm.year && (d.getMonth() + 1) === tm.month;
      });

      const monthPayslips = payslips.filter(p => p.year === tm.year && p.month === tm.month);

      let rev = 0;
      let cost = 0;
      monthInvoices.forEach(inv => {
        rev += inv.subTotal;
        inv.items.forEach(item => {
          if (item.product && item.product.purchasePrice) {
            cost += item.quantity * item.product.purchasePrice;
          }
        });
      });

      let opex = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      let pay = monthPayslips.reduce((sum, p) => sum + p.netSalary, 0);
      const totExp = opex + pay;

      return {
        label: tm.label,
        revenue: Math.round(rev * 100) / 100,
        cogs: Math.round(cost * 100) / 100,
        expenses: Math.round(totExp * 100) / 100,
        netProfit: Math.round((rev - cost - totExp) * 100) / 100
      };
    });

    res.json({
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      operatingExpenses: Math.round(operatingExpenses * 100) / 100,
      payroll: Math.round(payroll * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      expenseBreakdown,
      trends
    });
  } catch (error) {
    console.error('Profit & Loss calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate Profit & Loss statement.' });
  }
};

// Get GST Tax report
exports.getGSTReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    // Fetch all Invoices in range (except DRAFT and CANCELLED)
    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED']
        }
      },
      include: {
        client: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    let taxableValue = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    let intraStateTaxable = 0;
    let interStateTaxable = 0;

    const outwardSupplies = invoices.map(inv => {
      taxableValue += inv.subTotal;
      cgst += inv.cgst;
      sgst += inv.sgst;
      igst += inv.igst;

      const hasIgst = inv.igst > 0;
      if (hasIgst) {
        interStateTaxable += inv.subTotal;
      } else {
        intraStateTaxable += inv.subTotal;
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType,
        date: inv.date,
        clientName: inv.client.companyName,
        clientGstin: inv.client.gstin || 'URP (Unregistered)',
        state: inv.client.state,
        taxableValue: Math.round(inv.subTotal * 100) / 100,
        cgst: Math.round(inv.cgst * 100) / 100,
        sgst: Math.round(inv.sgst * 100) / 100,
        igst: Math.round(inv.igst * 100) / 100,
        grandTotal: Math.round(inv.grandTotal * 100) / 100
      };
    });

    const totalGst = cgst + sgst + igst;

    res.json({
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      outwardSupplies,
      gstr3b: {
        intraState: {
          taxableValue: Math.round(intraStateTaxable * 100) / 100,
          cgst: Math.round(cgst * 100) / 100,
          sgst: Math.round(sgst * 100) / 100
        },
        interState: {
          taxableValue: Math.round(interStateTaxable * 100) / 100,
          igst: Math.round(igst * 100) / 100
        },
        totalLiability: Math.round(totalGst * 100) / 100
      }
    });
  } catch (error) {
    console.error('GST Report aggregation error:', error);
    res.status(500).json({ error: 'Failed to aggregate GST Tax report.' });
  }
};

// Get TDS & TCS compliance report
exports.getTDSTCSReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    // Fetch all Invoices in range (excluding DRAFT and CANCELLED)
    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED']
        }
      },
      include: {
        client: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    let taxableValue = 0;
    let totalTds = 0;
    let totalTcs = 0;

    const tdsBySection = {};
    const tdsRecords = [];
    const tcsRecords = [];

    invoices.forEach(inv => {
      // 1. Process TDS records
      if (inv.tdsAmount > 0 || inv.tdsRate > 0) {
        taxableValue += inv.subTotal;
        totalTds += inv.tdsAmount;

        const section = inv.tdsSection || 'UNSPECIFIED';
        if (!tdsBySection[section]) {
          tdsBySection[section] = { taxableValue: 0, amount: 0, rate: inv.tdsRate };
        }
        tdsBySection[section].taxableValue += inv.subTotal;
        tdsBySection[section].amount += inv.tdsAmount;

        tdsRecords.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          clientName: inv.client.companyName,
          clientPan: inv.client.pan || 'PAN NOT PROVIDED',
          section: section,
          taxableValue: Math.round(inv.subTotal * 100) / 100,
          tdsRate: inv.tdsRate,
          tdsAmount: Math.round(inv.tdsAmount * 100) / 100
        });
      }

      // 2. Process TCS records
      if (inv.tcsAmount > 0 || inv.tcsRate > 0) {
        totalTcs += inv.tcsAmount;

        tcsRecords.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          clientName: inv.client.companyName,
          clientPan: inv.client.pan || 'PAN NOT PROVIDED',
          taxableValue: Math.round(inv.subTotal * 100) / 100,
          tcsRate: inv.tcsRate,
          tcsAmount: Math.round(inv.tcsAmount * 100) / 100
        });
      }
    });

    // Round section totals
    Object.keys(tdsBySection).forEach(sec => {
      tdsBySection[sec].taxableValue = Math.round(tdsBySection[sec].taxableValue * 100) / 100;
      tdsBySection[sec].amount = Math.round(tdsBySection[sec].amount * 100) / 100;
    });

    res.json({
      taxableValue: Math.round(taxableValue * 100) / 100,
      totalTds: Math.round(totalTds * 100) / 100,
      totalTcs: Math.round(totalTcs * 100) / 100,
      tdsBySection,
      tdsRecords,
      tcsRecords
    });
  } catch (error) {
    console.error('TDS/TCS Report calculation error:', error);
    res.status(500).json({ error: 'Failed to aggregate TDS & TCS report.' });
  }
};

// Map expense categories to standard Chart of Accounts
function mapExpenseCategory(cat) {
  const c = cat.toLowerCase();
  if (c.includes('rent')) return 'Rent Expense';
  if (c.includes('salary') || c.includes('payroll')) return 'Salaries & Payroll';
  if (c.includes('utilities') || c.includes('electricity') || c.includes('water')) return 'Utilities';
  if (c.includes('office') || c.includes('software') || c.includes('marketing')) return 'Office Expenses';
  if (c.includes('cogs')) return 'COGS (Cost of Goods Sold)';
  return 'Other Expenses';
}

// Get General Ledger, Trial Balance, and Balance Sheet bookkeeping reports
exports.getBookkeepingReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    // 1. Fetch Invoices in range (excluding DRAFT and CANCELLED)
    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED']
        }
      },
      include: {
        client: true
      }
    });

    // 2. Fetch Vouchers and items in range
    const vouchers = await prisma.voucher.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: true
      }
    });

    // 3. Fetch Expenses in range
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      }
    });

    // 4. Fetch Payslips
    const payslips = await prisma.payslip.findMany({
      where: {
        status: 'PAID'
      }
    });

    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endYear = end.getFullYear();
    const endMonth = end.getMonth() + 1;

    const filteredPayslips = payslips.filter(p => {
      const pVal = p.year * 12 + p.month;
      const startVal = startYear * 12 + startMonth;
      const endVal = endYear * 12 + endMonth;
      return pVal >= startVal && pVal <= endVal;
    });

    // 5. Generate virtual postings list
    const postings = [];

    // Postings from Vouchers
    vouchers.forEach(v => {
      v.items.forEach(item => {
        postings.push({
          date: v.date,
          accountName: item.accountName,
          type: item.type, // "DEBIT" or "CREDIT"
          amount: item.amount,
          source: `VOUCHER (${v.voucherNumber})`,
          narration: v.narration,
          reference: v.reference || '-'
        });
      });
    });

    // Postings from Invoices
    invoices.forEach(inv => {
      const clientName = inv.client.companyName;
      const pan = inv.client.pan || 'PAN NOT PROVIDED';

      // Debit Accounts Receivable
      postings.push({
        date: inv.date,
        accountName: 'Accounts Receivable',
        type: 'DEBIT',
        amount: inv.totalAmount,
        source: `INVOICE (${inv.invoiceNumber})`,
        narration: `Sales invoice to ${clientName}`,
        reference: clientName
      });

      // Credit Sales Revenue
      postings.push({
        date: inv.date,
        accountName: 'Sales Revenue',
        type: 'CREDIT',
        amount: inv.subTotal,
        source: `INVOICE (${inv.invoiceNumber})`,
        narration: 'Taxable sales revenue',
        reference: clientName
      });

      // Credit GST Payable (CGST + SGST + IGST)
      const gstCollected = inv.cgst + inv.sgst + inv.igst;
      if (gstCollected > 0) {
        postings.push({
          date: inv.date,
          accountName: 'GST Payable',
          type: 'CREDIT',
          amount: gstCollected,
          source: `INVOICE (${inv.invoiceNumber})`,
          narration: 'GST tax collected on sales',
          reference: inv.client.gstin || 'Unregistered'
        });
      }

      // Debit TDS Receivable
      if (inv.tdsAmount > 0) {
        postings.push({
          date: inv.date,
          accountName: 'TDS Receivable',
          type: 'DEBIT',
          amount: inv.tdsAmount,
          source: `INVOICE (${inv.invoiceNumber})`,
          narration: `TDS withheld under Sec ${inv.tdsSection || 'N/A'}`,
          reference: clientName
        });
      }

      // Credit TCS Payable
      if (inv.tcsAmount > 0) {
        postings.push({
          date: inv.date,
          accountName: 'TCS Payable',
          type: 'CREDIT',
          amount: inv.tcsAmount,
          source: `INVOICE (${inv.invoiceNumber})`,
          narration: 'TCS collected on sales',
          reference: clientName
        });
      }
    });

    // Postings from Expenses
    expenses.forEach(exp => {
      const accountName = mapExpenseCategory(exp.category);

      // Debit Expense Account
      postings.push({
        date: exp.date,
        accountName: accountName,
        type: 'DEBIT',
        amount: exp.amount,
        source: 'EXPENSE',
        narration: exp.description,
        reference: exp.notes || '-'
      });

      // Credit Cash Asset
      postings.push({
        date: exp.date,
        accountName: 'Cash',
        type: 'CREDIT',
        amount: exp.amount,
        source: 'EXPENSE',
        narration: `Payment for ${exp.description}`,
        reference: '-'
      });
    });

    // Postings from Paid Payslips
    filteredPayslips.forEach(ps => {
      const payoutDate = new Date(ps.year, ps.month - 1, 28); // Assume paid on the 28th of the payroll month

      // Debit Salaries Expense
      postings.push({
        date: payoutDate,
        accountName: 'Salaries & Payroll',
        type: 'DEBIT',
        amount: ps.netSalary,
        source: `PAYROLL (${ps.year}-${ps.month})`,
        narration: 'Net salaries disbursement',
        reference: `Employee ID: ${ps.employeeId}`
      });

      // Credit Bank Asset
      postings.push({
        date: payoutDate,
        accountName: 'Bank Account',
        type: 'CREDIT',
        amount: ps.netSalary,
        source: `PAYROLL (${ps.year}-${ps.month})`,
        narration: 'Net payroll bank disburse',
        reference: `Employee ID: ${ps.employeeId}`
      });
    });

    // 6. Aggregate by account for General Ledger & Trial Balance
    const accountBalances = {};
    const ledgerDetails = {};

    // Group postings by account name
    postings.forEach(p => {
      const name = p.accountName;
      if (!accountBalances[name]) {
        accountBalances[name] = { debit: 0, credit: 0 };
        ledgerDetails[name] = [];
      }
      if (p.type === 'DEBIT') {
        accountBalances[name].debit += p.amount;
      } else {
        accountBalances[name].credit += p.amount;
      }
      ledgerDetails[name].push(p);
    });

    // Sort postings chronologically and calculate rolling balance for each account
    const coaCategories = {};
    CHART_OF_ACCOUNTS_MAP.forEach(c => {
      coaCategories[c.name] = c.category;
    });

    Object.keys(ledgerDetails).forEach(name => {
      // Sort
      ledgerDetails[name].sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate rolling balance
      let currentBal = 0;
      const cat = coaCategories[name] || 'Asset';
      const isDebitNormal = (cat === 'Asset' || cat === 'Expense');

      ledgerDetails[name].forEach(p => {
        if (p.type === 'DEBIT') {
          currentBal += isDebitNormal ? p.amount : -p.amount;
        } else {
          currentBal += isDebitNormal ? -p.amount : p.amount;
        }
        p.balance = Math.round(currentBal * 100) / 100;
      });
    });

    // Compile Trial Balance
    const trialBalance = [];
    let totalTrialDebit = 0;
    let totalTrialCredit = 0;

    CHART_OF_ACCOUNTS_MAP.forEach(coa => {
      const name = coa.name;
      const bal = accountBalances[name];
      if (bal && (bal.debit > 0 || bal.credit > 0)) {
        const isDebitNormal = (coa.category === 'Asset' || coa.category === 'Expense');
        let endingBal = 0;
        let balanceType = 'DEBIT';

        if (isDebitNormal) {
          endingBal = bal.debit - bal.credit;
          balanceType = endingBal >= 0 ? 'DEBIT' : 'CREDIT';
          endingBal = Math.abs(endingBal);
        } else {
          endingBal = bal.credit - bal.debit;
          balanceType = endingBal >= 0 ? 'CREDIT' : 'DEBIT';
          endingBal = Math.abs(endingBal);
        }

        if (balanceType === 'DEBIT') {
          totalTrialDebit += endingBal;
        } else {
          totalTrialCredit += endingBal;
        }

        trialBalance.push({
          accountName: name,
          category: coa.category,
          debit: Math.round(bal.debit * 100) / 100,
          credit: Math.round(bal.credit * 100) / 100,
          balance: Math.round(endingBal * 100) / 100,
          balanceType
        });
      }
    });

    // Compile Balance Sheet
    const assetsList = [];
    const liabilitiesList = [];
    const equityList = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Calculate P&L summary in range to generate dynamic Net Income
    let totalRevenues = 0;
    let totalExpenses = 0;

    trialBalance.forEach(tb => {
      if (tb.category === 'Asset') {
        const amt = tb.balanceType === 'DEBIT' ? tb.balance : -tb.balance;
        assetsList.push({ name: tb.accountName, amount: amt });
        totalAssets += amt;
      } else if (tb.category === 'Liability') {
        const amt = tb.balanceType === 'CREDIT' ? tb.balance : -tb.balance;
        liabilitiesList.push({ name: tb.accountName, amount: amt });
        totalLiabilities += amt;
      } else if (tb.category === 'Equity') {
        const amt = tb.balanceType === 'CREDIT' ? tb.balance : -tb.balance;
        equityList.push({ name: tb.accountName, amount: amt });
        totalEquity += amt;
      } else if (tb.category === 'Revenue') {
        totalRevenues += tb.balanceType === 'CREDIT' ? tb.balance : -tb.balance;
      } else if (tb.category === 'Expense') {
        totalExpenses += tb.balanceType === 'DEBIT' ? tb.balance : -tb.balance;
      }
    });

    // Retained Earnings mapping from P&L Net Income
    const netIncome = totalRevenues - totalExpenses;
    equityList.push({ name: 'Retained Earnings (Net Income)', amount: Math.round(netIncome * 100) / 100 });
    totalEquity += netIncome;

    const balanceSheetDiff = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const isBalanced = balanceSheetDiff < 0.05;

    res.json({
      trialBalance,
      totalTrialDebit: Math.round(totalTrialDebit * 100) / 100,
      totalTrialCredit: Math.round(totalTrialCredit * 100) / 100,
      balanceSheet: {
        assets: {
          items: assetsList,
          total: Math.round(totalAssets * 100) / 100
        },
        liabilities: {
          items: liabilitiesList,
          total: Math.round(totalLiabilities * 100) / 100
        },
        equity: {
          items: equityList,
          total: Math.round(totalEquity * 100) / 100
        },
        isBalanced,
        difference: Math.round(balanceSheetDiff * 100) / 100
      },
      ledgerDetails
    });
  } catch (error) {
    console.error('Failed to compile bookkeeping reports:', error);
    res.status(500).json({ error: 'Failed to aggregate bookkeeping statements.' });
  }
};

// Chart of Accounts metadata map helper
const CHART_OF_ACCOUNTS_MAP = [
  { name: 'Cash', category: 'Asset' },
  { name: 'Bank Account', category: 'Asset' },
  { name: 'Accounts Receivable', category: 'Asset' },
  { name: 'Inventory', category: 'Asset' },
  { name: 'Equipment', category: 'Asset' },
  { name: 'TDS Receivable', category: 'Asset' },
  { name: 'Accounts Payable', category: 'Liability' },
  { name: 'TDS Payable', category: 'Liability' },
  { name: 'GST Payable', category: 'Liability' },
  { name: 'TCS Payable', category: 'Liability' },
  { name: 'Owner Capital', category: 'Equity' },
  { name: 'Retained Earnings', category: 'Equity' },
  { name: 'Sales Revenue', category: 'Revenue' },
  { name: 'Other Income', category: 'Revenue' },
  { name: 'Salaries & Payroll', category: 'Expense' },
  { name: 'Rent Expense', category: 'Expense' },
  { name: 'Office Expenses', category: 'Expense' },
  { name: 'Utilities', category: 'Expense' },
  { name: 'COGS (Cost of Goods Sold)', category: 'Expense' },
  { name: 'Other Expenses', category: 'Expense' }
];

