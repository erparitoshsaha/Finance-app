const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get list of products in inventory catalog
exports.getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to retrieve inventory products.' });
  }
};

// Create a new product in catalog
exports.createProduct = async (req, res) => {
  try {
    const { name, sku, barcode, description, category, unit, purchasePrice, sellingPrice, taxRate, alertThreshold, currentStock } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: 'Product name and SKU are required.' });
    }

    // Auto-generate barcode (12-digit UPC-style) if none is provided
    let finalBarcode = barcode;
    if (!finalBarcode) {
      finalBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    }

    // Check if SKU already exists
    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku) {
      return res.status(400).json({ error: `Product with SKU "${sku}" already exists.` });
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        sku,
        barcode: finalBarcode,
        description: description || null,
        category: category || 'Other',
        unit: unit || 'PCS',
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        taxRate: parseFloat(taxRate) || 18,
        alertThreshold: parseFloat(alertThreshold) || 5,
        currentStock: parseFloat(currentStock) || 0
      }
    });

    // If starting stock is greater than 0, create a transaction
    const initialStock = parseFloat(currentStock) || 0;
    if (initialStock > 0) {
      await prisma.stockTransaction.create({
        data: {
          productId: newProduct.id,
          type: 'INWARD',
          quantity: initialStock,
          unitPrice: parseFloat(purchasePrice) || 0,
          notes: 'Initial stock on creation',
          supplierName: 'Internal Setup'
        }
      });
    }

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to register product.' });
  }
};

// Find product by Barcode/UPC or SKU
exports.getProductByBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { barcode: code },
          { sku: code }
        ]
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found with this code.' });
    }
    res.json(product);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup product.' });
  }
};

// Inward restock for existing products
exports.restockProduct = async (req, res) => {
  try {
    const { productId, quantity, unitPrice, supplierName, supplierId, notes, date } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product ID and valid inward quantity are required.' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const oldStock = product.currentStock;
    const oldPrice = product.purchasePrice || 0;
    const addedQty = parseFloat(quantity);
    const costPrice = parseFloat(unitPrice) || 0;
    const newStock = oldStock + addedQty;

    // Calculate moving weighted average cost price
    let updatedPrice = costPrice;
    if (oldStock > 0 && newStock > 0) {
      updatedPrice = ((oldStock * oldPrice) + (addedQty * costPrice)) / newStock;
    }

    // Update product stock and purchasePrice
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        currentStock: newStock,
        purchasePrice: Math.round(updatedPrice * 100) / 100
      }
    });

    let finalSupplierName = supplierName || 'Unknown Supplier';
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (supplier) {
        finalSupplierName = supplier.companyName;
      }
    }

    // Log the transaction
    await prisma.stockTransaction.create({
      data: {
        productId,
        type: 'INWARD',
        quantity: addedQty,
        unitPrice: costPrice,
        supplierName: finalSupplierName,
        supplierId: supplierId || null,
        notes: notes || 'Stock manual inward',
        date: date ? new Date(date) : new Date()
      }
    });

    res.json({ message: 'Stock updated successfully.', product: updatedProduct });
  } catch (error) {
    console.error('Restock error:', error);
    res.status(500).json({ error: 'Failed to update stock.' });
  }
};

// Bulk Import Products from parsed CSV JSON
exports.bulkImportProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid request payload. Products array required.' });
    }

    let importedCount = 0;

    for (const item of products) {
      const name = (item.name || '').trim();
      const sku = (item.sku || '').trim();
      if (!name || !sku) continue;

      const barcode = (item.barcode || '').trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const category = (item.category || 'Other').trim();
      const unit = (item.unit || 'PCS').trim();
      const purchasePrice = parseFloat(item.purchasePrice) || 0;
      const sellingPrice = parseFloat(item.sellingPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 18;
      const alertThreshold = parseFloat(item.alertThreshold) || 5;
      const currentStock = parseFloat(item.currentStock) || 0;

      const prod = await prisma.product.upsert({
        where: { sku },
        update: {
          name,
          barcode,
          category,
          unit,
          purchasePrice,
          sellingPrice,
          taxRate,
          alertThreshold,
          currentStock: { increment: currentStock }
        },
        create: {
          name,
          sku,
          barcode,
          description: item.description || '',
          category,
          unit,
          purchasePrice,
          sellingPrice,
          taxRate,
          alertThreshold,
          currentStock
        }
      });

      // Log transaction if stock was introduced
      if (currentStock > 0) {
        await prisma.stockTransaction.create({
          data: {
            productId: prod.id,
            type: 'INWARD',
            quantity: currentStock,
            unitPrice: purchasePrice,
            supplierName: 'Bulk CSV Import',
            notes: 'Initial stock from bulk import'
          }
        });
      }
      importedCount++;
    }

    res.json({ message: `Successfully processed bulk import.`, count: importedCount });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import products.' });
  }
};

// Calculate total asset valuation and category splits
exports.getInventoryValuation = async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    
    let totalValue = 0;
    const categoryBreakdown = {};

    products.forEach(p => {
      const itemVal = (p.currentStock || 0) * (p.purchasePrice || 0);
      totalValue += itemVal;

      const cat = p.category || 'Other';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = 0;
      }
      categoryBreakdown[cat] += itemVal;
    });

    res.json({
      totalValue: Math.round(totalValue * 100) / 100,
      categoryBreakdown
    });
  } catch (error) {
    console.error('Valuation calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate inventory valuation.' });
  }
};

// Retrieve ledger of all inward/outward transactions
exports.getStockTransactions = async (req, res) => {
  try {
    const transactions = await prisma.stockTransaction.findMany({
      include: {
        product: {
          select: { name: true, sku: true, category: true, unit: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to retrieve stock transaction ledger.' });
  }
};
