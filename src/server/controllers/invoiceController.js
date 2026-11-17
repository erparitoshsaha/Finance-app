const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

// Helper to determine and calculate GST components, TDS, and TCS
function calculateTaxes(items, clientState, tdsRateValue, tcsRateValue) {
  const businessState = (process.env.MY_BUSINESS_STATE || 'Delhi').trim().toLowerCase();
  const targetState = (clientState || '').trim().toLowerCase();
  const isIntraState = businessState === targetState;

  let subTotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  items.forEach(item => {
    const itemAmount = item.quantity * item.price;
    subTotal += itemAmount;
    
    const taxRate = item.taxRate || 0; // e.g. 18
    const taxAmount = itemAmount * (taxRate / 100);

    if (isIntraState) {
      cgst += taxAmount / 2;
      sgst += taxAmount / 2;
    } else {
      igst += taxAmount;
    }
  });

  const gstAmount = cgst + sgst + igst;
  const tcsRate = tcsRateValue || 0;
  const tcsAmount = (subTotal + gstAmount) * (tcsRate / 100);
  const grandTotal = subTotal + gstAmount + tcsAmount;

  const tdsRate = tdsRateValue || 0;
  const tdsAmount = subTotal * (tdsRate / 100);
  const netPayable = grandTotal - tdsAmount;

  return {
    subTotal: Math.round(subTotal * 100) / 100,
    cgst: isIntraState ? Math.round(cgst * 100) / 100 : 0.0,
    sgst: isIntraState ? Math.round(sgst * 100) / 100 : 0.0,
    igst: !isIntraState ? Math.round(igst * 100) / 100 : 0.0,
    tcsRate,
    tcsAmount: Math.round(tcsAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    tdsRate,
    tdsAmount: Math.round(tdsAmount * 100) / 100,
    netPayable: Math.round(netPayable * 100) / 100
  };
}

// Generate PDF into buffer helper
function generateInvoicePDFBuffer(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // --- Header ---
      const docTitle = (invoice.invoiceType || 'TAX INVOICE').toUpperCase();
      doc.fillColor('#0f172a').fontSize(20).text(docTitle, 50, 50, { align: 'left' });
      doc.fontSize(10).fillColor('#64748b').text(`Invoice No: ${invoice.invoiceNumber}`, 50, 75);
      doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 50, 90);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, 50, 105);

      // Business Name / Logo Section (Supplier Info)
      doc.fontSize(14).fillColor('#0f172a').text(process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD', 350, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#64748b').text('Regd. Office: 456 Financial District', 350, 70, { align: 'right' });
      doc.text(`State: ${process.env.MY_BUSINESS_STATE || 'Delhi'}`, 350, 85, { align: 'right' });
      doc.text('GSTIN: 07AAAAA1111A1Z1', 350, 100, { align: 'right' });

      // Divider Line
      doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#cbd5e1').lineWidth(1).stroke();

      // --- Bill To ---
      doc.fillColor('#0f172a').fontSize(11).text('BILL TO:', 50, 150);
      doc.fontSize(12).fillColor('#1e293b').text(invoice.client.companyName, 50, 165);
      doc.fontSize(9).fillColor('#475569').text(`Email: ${invoice.client.email}`, 50, 182);
      if (invoice.client.phone) doc.text(`Phone: ${invoice.client.phone}`, 50, 195);
      if (invoice.client.address) doc.text(`Address: ${invoice.client.address}, ${invoice.client.city || ''}, ${invoice.client.state} - ${invoice.client.zip || ''}`, 50, 208);
      if (invoice.client.gstin) doc.text(`GSTIN: ${invoice.client.gstin}`, 50, 221);
      if (invoice.client.pan) doc.text(`PAN: ${invoice.client.pan}`, 50, 234);

      // --- Table Header ---
      const tableTop = 270;
      doc.rect(50, tableTop, 500, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(9);
      doc.text('Description', 60, tableTop + 6, { width: 200 });
      doc.text('Qty', 270, tableTop + 6, { width: 40, align: 'right' });
      doc.text('Rate (INR)', 320, tableTop + 6, { width: 70, align: 'right' });
      doc.text('GST %', 400, tableTop + 6, { width: 50, align: 'right' });
      doc.text('Amount', 460, tableTop + 6, { width: 80, align: 'right' });

      // --- Table Body ---
      let currentY = tableTop + 20;
      doc.fillColor('#334155');
      invoice.items.forEach((item, idx) => {
        if (idx % 2 === 0) {
          doc.rect(50, currentY, 500, 20).fill('#f8fafc');
        } else {
          doc.rect(50, currentY, 500, 20).fill('#ffffff');
        }
        doc.fillColor('#334155');

        doc.text(item.description, 60, currentY + 6, { width: 200, height: 12, ellipsis: true });
        doc.text(item.quantity.toString(), 270, currentY + 6, { width: 40, align: 'right' });
        doc.text(item.price.toFixed(2), 320, currentY + 6, { width: 70, align: 'right' });
        doc.text(`${item.taxRate}%`, 400, currentY + 6, { width: 50, align: 'right' });
        doc.text(item.amount.toFixed(2), 460, currentY + 6, { width: 80, align: 'right' });
        
        currentY += 20;
      });

      // Draw bottom border of table
      doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#cbd5e1').stroke();
      currentY += 15;

      // --- Side-by-side Calculations ---
      const startTotalsY = currentY;

      // Left side details (Payment info, bank, notes)
      let leftY = startTotalsY;
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold').text('PAYMENT INFORMATION', 50, leftY);
      leftY += 14;
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Payment Terms: ${invoice.paymentTerms || 'Due on Receipt'}`, 50, leftY);
      leftY += 12;

      if (invoice.bankName || invoice.bankAccount || invoice.upiId) {
        doc.font('Helvetica-Bold').text('Bank / UPI Details:', 50, leftY);
        leftY += 12;
        doc.font('Helvetica');
        if (invoice.bankName) {
          doc.text(`Bank Name: ${invoice.bankName}`, 60, leftY);
          leftY += 11;
        }
        if (invoice.bankAccount) {
          doc.text(`Account No: ${invoice.bankAccount}`, 60, leftY);
          leftY += 11;
        }
        if (invoice.ifscCode) {
          doc.text(`IFSC Code: ${invoice.ifscCode}`, 60, leftY);
          leftY += 11;
        }
        if (invoice.upiId) {
          doc.text(`UPI ID: ${invoice.upiId}`, 60, leftY);
          leftY += 11;
        }
      }
      
      if (invoice.notes) {
        leftY += 5;
        doc.font('Helvetica-Bold').text('Terms & Conditions / Notes:', 50, leftY);
        leftY += 12;
        doc.font('Helvetica-Oblique').text(invoice.notes, 50, leftY, { width: 250 });
      }

      // Right side details (Subtotal, taxes, TCS, Grand Total, TDS, Net Payable)
      let rightY = startTotalsY;
      const calcX = 350;
      const calcW = 110;
      const valW = 80;

      doc.fontSize(9).fillColor('#475569').font('Helvetica');

      // Subtotal
      doc.text('Subtotal:', calcX, rightY, { width: calcW, align: 'right' });
      doc.text(`INR ${invoice.subTotal.toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
      rightY += 14;

      // CGST
      doc.text('CGST:', calcX, rightY, { width: calcW, align: 'right' });
      doc.text(`INR ${(invoice.cgst || 0).toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
      rightY += 14;

      // SGST
      doc.text('SGST:', calcX, rightY, { width: calcW, align: 'right' });
      doc.text(`INR ${(invoice.sgst || 0).toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
      rightY += 14;

      // IGST
      doc.text('IGST:', calcX, rightY, { width: calcW, align: 'right' });
      doc.text(`INR ${(invoice.igst || 0).toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
      rightY += 14;

      // TCS
      if (invoice.tcsAmount > 0) {
        doc.text(`TCS (${invoice.tcsRate}%):`, calcX, rightY, { width: calcW, align: 'right' });
        doc.text(`INR ${invoice.tcsAmount.toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
        rightY += 14;
      }

      // Grand Total
      doc.font('Helvetica-Bold').text('Grand Total:', calcX, rightY, { width: calcW, align: 'right' });
      doc.text(`INR ${invoice.grandTotal.toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
      rightY += 16;
      doc.font('Helvetica');

      // TDS
      if (invoice.tdsAmount > 0) {
        doc.text(`TDS Deduction (${invoice.tdsRate}%):`, calcX, rightY, { width: calcW, align: 'right' });
        doc.text(`- INR ${invoice.tdsAmount.toFixed(2)}`, calcX + calcW, rightY, { width: valW, align: 'right' });
        rightY += 14;
      }

      // Net Payable
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
      doc.text('Net Payable:', calcX, rightY + 2, { width: calcW, align: 'right' });
      doc.text(`INR ${invoice.netPayable.toFixed(2)}`, calcX + calcW, rightY + 2, { width: valW, align: 'right' });
      rightY += 25;

      // Authorized Signatory and Digital Signature
      if (invoice.authorizedSignatory || invoice.digitalSignature) {
        rightY += 10;
        doc.rect(calcX + 20, rightY, 170, 65).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        
        if (invoice.digitalSignature) {
          doc.rect(calcX + 25, rightY + 5, 160, 25).fill('#e0f2fe');
          doc.fillColor('#0284c7').fontSize(7).font('Helvetica-Bold')
             .text('DIGITALLY SIGNED & VERIFIED', calcX + 25, rightY + 10, { width: 160, align: 'center' });
          doc.fillColor('#64748b').fontSize(6).font('Helvetica')
             .text(`By: ${invoice.authorizedSignatory || 'Finance Corp Supplier'}`, calcX + 25, rightY + 20, { width: 160, align: 'center' });
        } else {
          doc.moveTo(calcX + 35, rightY + 40).lineTo(calcX + 175, rightY + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();
          doc.fillColor('#64748b').fontSize(7).font('Helvetica')
             .text('Authorized Signatory', calcX + 25, rightY + 45, { width: 160, align: 'center' });
        }
        
        if (invoice.authorizedSignatory && !invoice.digitalSignature) {
          doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold')
             .text(invoice.authorizedSignatory, calcX + 25, rightY + 15, { width: 160, align: 'center' });
        }
      }

      doc.fontSize(8).fillColor('#94a3b8').text('Thank you for your business. Generated automatically by Finance App.', 50, 720, { align: 'center' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

exports.getInvoices = async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        client: {
          select: { companyName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to retrieve invoices.' });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        items: true
      }
    });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve invoice details.' });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const { 
      clientId, 
      date, 
      dueDate, 
      status, 
      items, 
      tdsRate, 
      tdsSection, 
      tcsRate, 
      paymentTerms, 
      bankName, 
      bankAccount, 
      ifscCode, 
      upiId, 
      authorizedSignatory, 
      digitalSignature, 
      notes, 
      invoiceType 
    } = req.body;

    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Client ID and Invoice Items are required.' });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Validate stock levels before creating invoice
    for (const item of items) {
      if (item.productId) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          return res.status(404).json({ error: `Product not found for ID "${item.productId}"` });
        }
        if (product.currentStock < Number(item.quantity)) {
          return res.status(400).json({ 
            error: `Insufficient stock for "${product.name}". Available: ${product.currentStock} ${product.unit}, Requested: ${item.quantity} ${product.unit}` 
          });
        }
      }
    }

    // Auto-generate invoice number if not provided
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date(date || Date.now()).getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Calculate tax amounts
    const taxCalcs = calculateTaxes(items, client.state, tdsRate, tcsRate);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: invoiceType || 'TAX INVOICE',
        date: new Date(date || Date.now()),
        dueDate: new Date(dueDate || Date.now()),
        status: status || 'UNPAID',
        clientId,
        subTotal: taxCalcs.subTotal,
        cgst: taxCalcs.cgst,
        sgst: taxCalcs.sgst,
        igst: taxCalcs.igst,
        tdsRate: taxCalcs.tdsRate,
        tdsAmount: taxCalcs.tdsAmount,
        tdsSection: tdsSection || null,
        tcsRate: taxCalcs.tcsRate,
        tcsAmount: taxCalcs.tcsAmount,
        grandTotal: taxCalcs.grandTotal,
        netPayable: taxCalcs.netPayable,
        totalAmount: taxCalcs.netPayable, // Store netPayable in totalAmount for backwards-compatibility
        paymentTerms: paymentTerms || 'Due on Receipt',
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
        authorizedSignatory: authorizedSignatory || null,
        digitalSignature: !!digitalSignature,
        notes,
        items: {
          create: items.map(item => ({
            productId: item.productId || null,
            description: item.description,
            quantity: Number(item.quantity),
            price: Number(item.price),
            taxRate: Number(item.taxRate || 0),
            amount: Number(item.quantity) * Number(item.price)
          }))
        }
      },
      include: {
        client: true,
        items: true
      }
    });

    // Deduct stock and create OUTWARD transactions for linked products
    for (const item of invoice.items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: Number(item.quantity) }
          }
        });

        await prisma.stockTransaction.create({
          data: {
            productId: item.productId,
            type: 'OUTWARD',
            quantity: Number(item.quantity),
            unitPrice: Number(item.price),
            reference: invoice.invoiceNumber,
            notes: `Sold via Invoice ${invoice.invoiceNumber}`
          }
        });
      }
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status },
      include: { client: true }
    });
    res.json(invoice);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await prisma.invoice.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Invoice deleted successfully.' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
};

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const pdfBuffer = await generateInvoicePDFBuffer(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
};

// Email generated invoice to customer
exports.emailInvoice = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const clientEmail = invoice.client.email;
    if (!clientEmail) {
      return res.status(400).json({ error: 'Client email is missing.' });
    }

    const pdfBuffer = await generateInvoicePDFBuffer(invoice);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass'
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Finance App" <invoices@financeapp.com>',
      to: clientEmail,
      subject: `${invoice.invoiceType || 'Tax Invoice'} ${invoice.invoiceNumber} from ${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'}`,
      text: `Dear Customer,\n\nPlease find attached invoice ${invoice.invoiceNumber} dated ${new Date(invoice.date).toLocaleDateString('en-IN')} for your payment.\n\nNet Payable: INR ${invoice.netPayable.toFixed(2)}\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}\n\nThank you for your business.\n\nRegards,\n${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'}`,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer
        }
      ]
    };

    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user') {
      console.log('--- MOCK EMAIL DISPATCH ---');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Text: ${mailOptions.text}`);
      console.log(`Attachment: ${mailOptions.attachments[0].filename} (${mailOptions.attachments[0].content.length} bytes)`);
      console.log('---------------------------');
      return res.json({ message: 'Invoice simulated email sent successfully (Mock Mode).' });
    }

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Invoice emailed successfully to customer.' });
  } catch (error) {
    console.error('Email invoice error:', error);
    res.status(500).json({ error: 'Failed to email invoice. Please verify SMTP configuration.' });
  }
};

// Export invoice as Excel-compatible CSV format
exports.exportInvoiceExcel = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    let csvContent = '';
    
    // Header details
    csvContent += `Invoice Number,${escapeCsv(invoice.invoiceNumber)}\n`;
    csvContent += `Invoice Date,${escapeCsv(new Date(invoice.date).toLocaleDateString('en-IN'))}\n`;
    csvContent += `Due Date,${escapeCsv(new Date(invoice.dueDate).toLocaleDateString('en-IN'))}\n`;
    csvContent += `Invoice Type,${escapeCsv(invoice.invoiceType)}\n`;
    csvContent += `Payment Status,${escapeCsv(invoice.status)}\n`;
    csvContent += `Payment Terms,${escapeCsv(invoice.paymentTerms)}\n`;
    csvContent += `Authorized Signatory,${escapeCsv(invoice.authorizedSignatory)}\n`;
    csvContent += `Digital Signature,${invoice.digitalSignature ? 'YES' : 'NO'}\n`;
    csvContent += '\n';

    // Client Details
    csvContent += 'CLIENT DETAILS\n';
    csvContent += `Customer/Company Name,${escapeCsv(invoice.client.companyName)}\n`;
    csvContent += `Email,${escapeCsv(invoice.client.email)}\n`;
    csvContent += `Mobile Number,${escapeCsv(invoice.client.phone)}\n`;
    csvContent += `GST Number,${escapeCsv(invoice.client.gstin)}\n`;
    csvContent += `PAN Number,${escapeCsv(invoice.client.pan)}\n`;
    csvContent += `Address,${escapeCsv(invoice.client.address)}\n`;
    csvContent += `City,${escapeCsv(invoice.client.city)}\n`;
    csvContent += `State,${escapeCsv(invoice.client.state)}\n`;
    csvContent += `Zip,${escapeCsv(invoice.client.zip)}\n`;
    csvContent += '\n';

    // Item Details Header
    csvContent += 'PRODUCT/SERVICE DETAILS\n';
    csvContent += 'Product/Service,Description,Quantity,Rate,GST %,Amount\n';

    // Item Details Rows
    invoice.items.forEach(item => {
      csvContent += `Product/Service,${escapeCsv(item.description)},${item.quantity},${item.price},${item.taxRate}%,${item.amount.toFixed(2)}\n`;
    });
    csvContent += '\n';

    // Calculations
    csvContent += 'TOTALS\n';
    csvContent += `Subtotal,,,,,${invoice.subTotal.toFixed(2)}\n`;
    csvContent += `CGST,,,,,${invoice.cgst.toFixed(2)}\n`;
    csvContent += `SGST,,,,,${invoice.sgst.toFixed(2)}\n`;
    csvContent += `IGST,,,,,${invoice.igst.toFixed(2)}\n`;
    csvContent += `TCS Percentage,,,,,${invoice.tcsRate}%\n`;
    csvContent += `TCS Amount,,,,,${invoice.tcsAmount.toFixed(2)}\n`;
    csvContent += `Grand Total,,,,,${invoice.grandTotal.toFixed(2)}\n`;
    csvContent += `TDS Section,,,,,${invoice.tdsSection || 'N/A'}\n`;
    csvContent += `TDS Percentage,,,,,${invoice.tdsRate}%\n`;
    csvContent += `TDS Deduction Amount,,,,,-${invoice.tdsAmount.toFixed(2)}\n`;
    csvContent += `Net Payable Amount,,,,,${invoice.netPayable.toFixed(2)}\n`;
    csvContent += '\n';

    // Bank Info
    if (invoice.bankName || invoice.bankAccount || invoice.upiId) {
      csvContent += 'BANK / UPI DETAILS\n';
      if (invoice.bankName) csvContent += `Bank Name,${escapeCsv(invoice.bankName)}\n`;
      if (invoice.bankAccount) csvContent += `Account Number,${escapeCsv(invoice.bankAccount)}\n`;
      if (invoice.ifscCode) csvContent += `IFSC Code,${escapeCsv(invoice.ifscCode)}\n`;
      if (invoice.upiId) csvContent += `UPI ID,${escapeCsv(invoice.upiId)}\n`;
      csvContent += '\n';
    }

    if (invoice.notes) {
      csvContent += `Notes,${escapeCsv(invoice.notes)}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export CSV/Excel error:', error);
    res.status(500).json({ error: 'Failed to export Excel spreadsheet.' });
  }
};

exports.calculateTaxes = calculateTaxes;

