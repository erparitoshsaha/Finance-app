const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get list of vouchers
exports.getVouchers = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-12-31');

    const whereClause = {
      date: {
        gte: start,
        lte: end
      }
    };

    if (type) {
      whereClause.type = type.toUpperCase();
    }

    const vouchers = await prisma.voucher.findMany({
      where: whereClause,
      include: {
        items: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.json(vouchers);
  } catch (error) {
    console.error('Failed to get vouchers:', error);
    res.status(500).json({ error: 'Failed to retrieve vouchers.' });
  }
};

// Create a new voucher
exports.createVoucher = async (req, res) => {
  try {
    const { type, date, narration, reference, items } = req.body;

    // 1. Basic validation
    if (!type || !date || !narration || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Voucher details and journal items are required.' });
    }

    if (items.length < 2) {
      return res.status(400).json({ error: 'Double-entry bookkeeping requires at least two ledger entries.' });
    }

    // 2. Validate double-entry balancing
    let totalDebit = 0;
    let totalCredit = 0;
    const validatedItems = [];

    for (const item of items) {
      const { accountName, type: itemType, amount } = item;

      if (!accountName || !itemType || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Each ledger entry must have an Account name, Type (DEBIT/CREDIT), and Amount.' });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Ledger amounts must be positive numbers.' });
      }

      const upperType = itemType.toUpperCase();
      if (upperType !== 'DEBIT' && upperType !== 'CREDIT') {
        return res.status(400).json({ error: 'Ledger item type must be DEBIT or CREDIT.' });
      }

      if (upperType === 'DEBIT') {
        totalDebit += numAmount;
      } else {
        totalCredit += numAmount;
      }

      validatedItems.push({
        accountName,
        type: upperType,
        amount: Math.round(numAmount * 100) / 100
      });
    }

    // Rounding check to prevent floating point issues (allowing 0.01 margin)
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.02) {
      return res.status(400).json({
        error: `Voucher is unbalanced. Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
      });
    }

    // 3. Generate sequential voucher number
    const voucherDate = new Date(date);
    const year = voucherDate.getFullYear();
    const prefix = `VCH-${year}-`;

    const lastVoucher = await prisma.voucher.findFirst({
      where: {
        voucherNumber: {
          startsWith: prefix
        }
      },
      orderBy: {
        voucherNumber: 'desc'
      }
    });

    let nextNum = 1;
    if (lastVoucher) {
      const lastNumStr = lastVoucher.voucherNumber.replace(prefix, '');
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    const voucherNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // 4. Save to Database in transaction
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        type: type.toUpperCase(),
        date: voucherDate,
        narration,
        reference: reference || null,
        items: {
          create: validatedItems
        }
      },
      include: {
        items: true
      }
    });

    res.status(201).json(voucher);
  } catch (error) {
    console.error('Failed to create voucher:', error);
    res.status(500).json({ error: 'Failed to create financial voucher.' });
  }
};

// Delete a voucher
exports.deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await prisma.voucher.findUnique({
      where: { id }
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found.' });
    }

    await prisma.voucher.delete({
      where: { id }
    });

    res.json({ message: 'Voucher successfully deleted.' });
  } catch (error) {
    console.error('Failed to delete voucher:', error);
    res.status(500).json({ error: 'Failed to delete voucher.' });
  }
};
