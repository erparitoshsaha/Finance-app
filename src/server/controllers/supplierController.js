const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        transactions: {
          select: {
            quantity: true,
            unitPrice: true
          }
        },
        expenses: {
          select: {
            amount: true
          }
        }
      },
      orderBy: { companyName: 'asc' },
    });

    const enriched = suppliers.map(s => {
      const transactionTotal = s.transactions.reduce((sum, t) => sum + (t.quantity * t.unitPrice), 0);
      const expenseTotal = s.expenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        ...s,
        totalSpend: Math.round((transactionTotal + expenseTotal) * 100) / 100,
        transactionsCount: s.transactions.length,
        expensesCount: s.expenses.length,
        transactions: undefined,
        expenses: undefined
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to retrieve suppliers.' });
  }
};

// Get supplier by ID with history details
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        transactions: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit: true
              }
            }
          },
          orderBy: { date: 'desc' }
        },
        expenses: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve supplier details.' });
  }
};

// Create a new supplier
exports.createSupplier = async (req, res) => {
  try {
    const { companyName, contactName, gstin, pan, email, phone, address, state, city, zip } = req.body;
    
    if (!companyName || !email || !state) {
      return res.status(400).json({ error: 'Company Name, Email, and State are required fields.' });
    }

    // Check if supplier already exists with same company name
    const existing = await prisma.supplier.findUnique({
      where: { companyName }
    });
    if (existing) {
      return res.status(400).json({ error: 'A supplier with this company name already exists.' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyName,
        contactName,
        gstin: gstin || null,
        pan: pan || null,
        email,
        phone: phone || null,
        address: address || null,
        state,
        city: city || null,
        zip: zip || null
      }
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier.' });
  }
};

// Update supplier details
exports.updateSupplier = async (req, res) => {
  try {
    const { companyName, contactName, gstin, pan, email, phone, address, state, city, zip } = req.body;
    
    if (!companyName || !email || !state) {
      return res.status(400).json({ error: 'Company Name, Email, and State are required fields.' });
    }

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        companyName,
        contactName,
        gstin: gstin || null,
        pan: pan || null,
        email,
        phone: phone || null,
        address: address || null,
        state,
        city: city || null,
        zip: zip || null
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier.' });
  }
};

// Delete a supplier
exports.deleteSupplier = async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Supplier deleted successfully.' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier.' });
  }
};
