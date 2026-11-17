const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Get all expenses with optional filters
exports.getExpenses = async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;

    const where = {};
    if (category) {
      where.category = category;
    }
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

    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to retrieve expenses.' });
  }
};

// Get single expense detail
exports.getExpenseById = async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id }
    });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    res.json(expense);
  } catch (error) {
    console.error('Get expense details error:', error);
    res.status(500).json({ error: 'Failed to retrieve expense details.' });
  }
};

// Log new expense
exports.createExpense = async (req, res) => {
  try {
    const { description, amount, category, date, notes, supplierId } = req.body;

    if (!description || !amount || !category || !date) {
      return res.status(400).json({ error: 'Description, amount, category, and date are required.' });
    }

    const receiptUrl = req.file ? `uploads/receipts/${req.file.filename}` : null;

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: Number(amount),
        category,
        date: new Date(date),
        notes,
        receiptUrl,
        supplierId: supplierId && supplierId !== 'null' && supplierId !== 'undefined' ? supplierId : null
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to log expense.' });
  }
};

// Update existing expense
exports.updateExpense = async (req, res) => {
  try {
    const { description, amount, category, date, notes, supplierId } = req.body;

    if (!description || !amount || !category || !date) {
      return res.status(400).json({ error: 'Description, amount, category, and date are required.' });
    }

    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    let receiptUrl = existing.receiptUrl;
    if (req.file) {
      // Delete old receipt file if it exists
      if (existing.receiptUrl) {
        const oldPath = path.join(__dirname, '../../', existing.receiptUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      receiptUrl = `uploads/receipts/${req.file.filename}`;
    } else if (req.body.removeReceipt === 'true' || req.body.removeReceipt === true) {
      if (existing.receiptUrl) {
        const oldPath = path.join(__dirname, '../../', existing.receiptUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      receiptUrl = null;
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        description,
        amount: Number(amount),
        category,
        date: new Date(date),
        notes,
        receiptUrl,
        supplierId: supplierId && supplierId !== 'null' && supplierId !== 'undefined' ? supplierId : null
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense.' });
  }
};

// Delete expense record
exports.deleteExpense = async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id }
    });
    if (existing && existing.receiptUrl) {
      const filePath = path.join(__dirname, '../../', existing.receiptUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.expense.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
};

// Get Profit & Loss Summary (Cash vs Accrual basis)
exports.getPLSummary = async (req, res) => {
  try {
    // 1. Fetch Invoices data
    const invoices = await prisma.invoice.findMany();
    
    let revenuePaid = 0;
    let revenueUnpaid = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalTDS = 0;

    invoices.forEach(inv => {
      if (inv.status === 'PAID') {
        revenuePaid += inv.totalAmount;
      } else {
        revenueUnpaid += inv.totalAmount;
      }
      totalCGST += inv.cgst || 0;
      totalSGST += inv.sgst || 0;
      totalIGST += inv.igst || 0;
      totalTDS += inv.tdsAmount || 0;
    });

    const totalRevenue = revenuePaid + revenueUnpaid;

    // 2. Fetch Expenses data
    const expenses = await prisma.expense.findMany();
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 3. Compute Net Profits
    const cashNetProfit = revenuePaid - totalExpenses;
    const accrualNetProfit = totalRevenue - totalExpenses;

    res.json({
      revenuePaid: Math.round(revenuePaid * 100) / 100,
      revenueUnpaid: Math.round(revenueUnpaid * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      cashNetProfit: Math.round(cashNetProfit * 100) / 100,
      accrualNetProfit: Math.round(accrualNetProfit * 100) / 100,
      taxesCollected: {
        cgst: Math.round(totalCGST * 100) / 100,
        sgst: Math.round(totalSGST * 100) / 100,
        igst: Math.round(totalIGST * 100) / 100,
        tds: Math.round(totalTDS * 100) / 100,
        totalGst: Math.round((totalCGST + totalSGST + totalIGST) * 100) / 100
      }
    });
  } catch (error) {
    console.error('P&L summary calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate Profit & Loss summary.' });
  }
};
