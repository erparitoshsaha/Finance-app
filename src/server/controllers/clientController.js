const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();

exports.getClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to retrieve clients.' });
  }
};

exports.getClientById = async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { invoices: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve client details.' });
  }
};

exports.createClient = async (req, res) => {
  try {
    const { companyName, gstin, pan, email, phone, address, state, city, zip } = req.body;
    if (!companyName || !email || !state) {
      return res.status(400).json({ error: 'Company Name, Email, and State are required fields.' });
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        gstin,
        pan,
        email,
        phone,
        address,
        state,
        city,
        zip,
      },
    });
    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client.' });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { companyName, gstin, pan, email, phone, address, state, city, zip } = req.body;
    if (!companyName || !email || !state) {
      return res.status(400).json({ error: 'Company Name, Email, and State are required fields.' });
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        companyName,
        gstin,
        pan,
        email,
        phone,
        address,
        state,
        city,
        zip,
      },
    });
    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client.' });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Client deleted successfully.' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client.' });
  }
};

// Helper to compute statement logs
async function computeStatementData(clientId, startDate, endDate) {
  const client = await prisma.client.findUnique({
    where: { id: clientId }
  });

  if (!client) {
    throw new Error('Client not found.');
  }

  // Fetch all invoices for this client (excluding DRAFT and CANCELLED)
  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: clientId,
      status: {
        notIn: ['DRAFT', 'CANCELLED']
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  // Construct virtual ledger entries
  const allEntries = [];

  invoices.forEach(inv => {
    // 1. Debit entry (Invoice issued)
    allEntries.push({
      date: new Date(inv.date),
      type: 'DEBIT',
      amount: inv.totalAmount, // netPayable
      reference: inv.invoiceNumber,
      description: `${inv.invoiceType || 'Tax Invoice'} Issued`
    });

    // 2. Credit entry (Payment received)
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

  // Sort chronologically by date
  allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  let openingBalance = 0;
  let totalDebits = 0;
  let totalCredits = 0;
  const filtered = [];

  allEntries.forEach(entry => {
    if (start && entry.date < start) {
      if (entry.type === 'DEBIT') {
        openingBalance += entry.amount;
      } else {
        openingBalance -= entry.amount;
      }
    } else if ((!start || entry.date >= start) && (!end || entry.date <= end)) {
      if (entry.type === 'DEBIT') {
        totalDebits += entry.amount;
      } else {
        totalCredits += entry.amount;
      }
      filtered.push(entry);
    }
  });

  // Calculate running balance inside the filtered list
  let running = openingBalance;
  const ledger = filtered.map(entry => {
    if (entry.type === 'DEBIT') {
      running += entry.amount;
    } else {
      running -= entry.amount;
    }
    return {
      date: entry.date,
      type: entry.type,
      amount: Math.round(entry.amount * 100) / 100,
      reference: entry.reference,
      description: entry.description,
      runningBalance: Math.round(running * 100) / 100
    };
  });

  const closingBalance = Math.round(running * 100) / 100;

  return {
    client,
    startDate: start ? start.toISOString().split('T')[0] : 'All Time',
    endDate: end ? end.toISOString().split('T')[0] : 'Present',
    openingBalance: Math.round(openingBalance * 100) / 100,
    closingBalance,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    ledger
  };
}

// JSON endpoint for Client Statement
exports.getClientStatement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await computeStatementData(req.params.id, startDate, endDate);
    res.json(data);
  } catch (error) {
    console.error('Get client statement error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve client statement.' });
  }
};

// PDF endpoint for Client Statement
exports.getClientStatementPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await computeStatementData(req.params.id, startDate, endDate);
    const client = data.client;

    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers to prompt download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement_${client.companyName.replace(/\s+/g, '_')}.pdf"`);

    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text('STATEMENT OF ACCOUNT', 50, 50);
    
    // Date Range
    doc.fontSize(10).fillColor('#64748b').font('Helvetica');
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-IN') : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-IN') : 'Present';
    doc.text(`Statement Period: ${startStr} to ${endStr}`, 50, 75);
    doc.text(`Report Generated On: ${new Date().toLocaleDateString('en-IN')}`, 50, 90);

    // Business Name (Supplier Info)
    doc.fontSize(14).fillColor('#0f172a').font('Helvetica-Bold').text(process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#64748b').font('Helvetica').text('Regd. Office: 456 Financial District', 350, 70, { align: 'right' });
    doc.text(`State: ${process.env.MY_BUSINESS_STATE || 'Delhi'}`, 350, 85, { align: 'right' });
    doc.text('GSTIN: 07AAAAA1111A1Z1', 350, 100, { align: 'right' });

    // Divider Line
    doc.moveTo(50, 120).lineTo(550, 120).strokeColor('#cbd5e1').lineWidth(1).stroke();

    // --- Client Details ---
    let y = 135;
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('STATEMENT FOR:', 50, y);
    doc.fontSize(12).fillColor('#1e293b').text(client.companyName, 50, y + 15);
    doc.fontSize(9).fillColor('#475569').font('Helvetica');
    if (client.address) doc.text(`Address: ${client.address}, ${client.city || ''}, ${client.state} - ${client.zip || ''}`, 50, y + 32, { width: 220 });
    doc.text(`Email: ${client.email}`, 50, y + 60);
    if (client.phone) doc.text(`Phone: ${client.phone}`, 50, y + 72);
    if (client.gstin) doc.text(`GSTIN: ${client.gstin}`, 50, y + 84);

    // --- Summary Box ---
    const summaryY = y;
    doc.rect(320, summaryY, 230, 96).fill('#f8fafc');
    doc.rect(320, summaryY, 230, 96).strokeColor('#cbd5e1').lineWidth(1).stroke();
    
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
    doc.text('ACCOUNT SUMMARY', 335, summaryY + 10);
    doc.font('Helvetica');
    
    doc.text('Opening Balance:', 335, summaryY + 28);
    doc.text(`INR ${data.openingBalance.toFixed(2)}`, 450, summaryY + 28, { align: 'right', width: 90 });

    doc.text('Total Invoiced (+):', 335, summaryY + 44);
    doc.text(`INR ${data.totalDebits.toFixed(2)}`, 450, summaryY + 44, { align: 'right', width: 90 });

    doc.text('Total Paid (-):', 335, summaryY + 60);
    doc.text(`INR ${data.totalCredits.toFixed(2)}`, 450, summaryY + 60, { align: 'right', width: 90 });

    // Closing Balance highlights
    doc.moveTo(335, summaryY + 74).lineTo(540, summaryY + 74).strokeColor('#cbd5e1').stroke();
    doc.fillColor('#4f46e5').font('Helvetica-Bold');
    doc.text('Balance Due:', 335, summaryY + 80);
    doc.text(`INR ${data.closingBalance.toFixed(2)}`, 450, summaryY + 80, { align: 'right', width: 90 });

    // --- Table Headers ---
    let tableTop = 260;
    doc.rect(50, tableTop, 500, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('Date', 55, tableTop + 6, { width: 60 });
    doc.text('Particulars / Description', 120, tableTop + 6, { width: 140 });
    doc.text('Reference', 270, tableTop + 6, { width: 60 });
    doc.text('Debit (+)', 340, tableTop + 6, { width: 65, align: 'right' });
    doc.text('Credit (-)', 415, tableTop + 6, { width: 65, align: 'right' });
    doc.text('Balance', 485, tableTop + 6, { width: 60, align: 'right' });

    // --- Table Body ---
    let currentY = tableTop + 20;
    doc.font('Helvetica');
    
    data.ledger.forEach((item, idx) => {
      // Page break check
      if (currentY > 700) {
        doc.addPage();
        
        // Redraw Table Headers on new page
        tableTop = 50;
        doc.rect(50, tableTop, 500, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('Date', 55, tableTop + 6, { width: 60 });
        doc.text('Particulars / Description', 120, tableTop + 6, { width: 140 });
        doc.text('Reference', 270, tableTop + 6, { width: 60 });
        doc.text('Debit (+)', 340, tableTop + 6, { width: 65, align: 'right' });
        doc.text('Credit (-)', 415, tableTop + 6, { width: 65, align: 'right' });
        doc.text('Balance', 485, tableTop + 6, { width: 60, align: 'right' });
        
        currentY = tableTop + 20;
        doc.font('Helvetica');
      }

      // Alternate row backgrounds
      if (idx % 2 === 0) {
        doc.rect(50, currentY, 500, 20).fill('#f8fafc');
      } else {
        doc.rect(50, currentY, 500, 20).fill('#ffffff');
      }

      doc.fillColor('#334155').fontSize(8);
      doc.text(new Date(item.date).toLocaleDateString('en-IN'), 55, currentY + 6, { width: 60 });
      doc.text(item.description, 120, currentY + 6, { width: 140, height: 12, ellipsis: true });
      doc.text(item.reference || '-', 270, currentY + 6, { width: 60 });
      
      const debitText = item.type === 'DEBIT' ? item.amount.toFixed(2) : '-';
      const creditText = item.type === 'CREDIT' ? item.amount.toFixed(2) : '-';
      doc.text(debitText, 340, currentY + 6, { width: 65, align: 'right' });
      doc.text(creditText, 415, currentY + 6, { width: 65, align: 'right' });
      doc.text(item.runningBalance.toFixed(2), 485, currentY + 6, { width: 60, align: 'right' });

      currentY += 20;
    });

    // Draw bottom border
    doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#cbd5e1').stroke();
    
    // --- Footer ---
    doc.fillColor('#94a3b8').fontSize(7).text('Thank you for your business. For queries, contact accounts@financeapp.com', 50, doc.page.height - 40, { align: 'center', width: 500 });

    doc.end();
  } catch (error) {
    console.error('PDF statement generation error:', error);
    res.status(500).json({ error: 'Failed to generate statement PDF.' });
  }
};
