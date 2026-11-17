const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to convert number to words (Indian Rupees format)
function numberToWords(num) {
  if (num === 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatTens = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  const formatHundreds = (n) => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      str += formatTens(n);
    }
    return str.trim();
  };

  let integer = Math.floor(num);
  let fraction = Math.round((num - integer) * 100);

  let wordStr = '';
  
  if (integer > 0) {
    let parts = [];
    
    // Crore
    if (integer >= 10000000) {
      parts.push(formatHundreds(Math.floor(integer / 10000000)) + ' Crore');
      integer %= 10000000;
    }
    // Lakh
    if (integer >= 100000) {
      parts.push(formatHundreds(Math.floor(integer / 100000)) + ' Lakh');
      integer %= 100000;
    }
    // Thousand
    if (integer >= 1000) {
      parts.push(formatHundreds(Math.floor(integer / 1000)) + ' Thousand');
      integer %= 1000;
    }
    // Remaining hundreds
    if (integer > 0) {
      parts.push(formatHundreds(integer));
    }
    
    wordStr = parts.join(' ') + ' Rupees';
  } else {
    wordStr = 'Zero Rupees';
  }

  if (fraction > 0) {
    wordStr += ' and ' + formatTens(fraction) + ' Paise';
  }

  return wordStr + ' Only';
}

// Generate a monthly payslip record
exports.generatePayslip = async (req, res) => {
  try {
    const { employeeId, month, year, paidDays } = req.body;

    if (!employeeId || !month || !year || paidDays === undefined) {
      return res.status(400).json({ error: 'Employee ID, month, year, and actual paid days are required.' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Check for duplicate payslip
    const duplicate = await prisma.payslip.findFirst({
      where: {
        employeeId,
        month: Number(month),
        year: Number(year)
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: `Payslip for ${MONTHS[Number(month) - 1]} ${year} has already been generated for this employee.` });
    }

    // Proration math based on days in the month
    const totalDays = new Date(Number(year), Number(month), 0).getDate();
    const prorationFactor = Number(paidDays) / totalDays;

    const baseSalary = employee.baseSalary;
    const allowances = employee.allowances;
    const deductions = employee.deductions;

    const grossEarnings = Math.round((baseSalary + allowances) * prorationFactor * 100) / 100;
    const totalDeductions = Math.round(deductions * prorationFactor * 100) / 100;
    const netSalary = Math.round((grossEarnings - totalDeductions) * 100) / 100;

    const payslip = await prisma.payslip.create({
      data: {
        employeeId,
        month: Number(month),
        year: Number(year),
        paidDays: Number(paidDays),
        grossEarnings,
        totalDeductions,
        netSalary,
        status: 'UNPAID'
      },
      include: { employee: true }
    });

    res.status(201).json(payslip);
  } catch (error) {
    console.error('Generate payslip error:', error);
    res.status(500).json({ error: 'Failed to generate payroll sheet.' });
  }
};

// Retrieve all payslips
exports.getPayslips = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const payslips = await prisma.payslip.findMany({
      where,
      include: { employee: true },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.json(payslips);
  } catch (error) {
    console.error('Get payslips error:', error);
    res.status(500).json({ error: 'Failed to retrieve payslips.' });
  }
};

// Toggle payslip payment status
exports.updatePayslipStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const payslip = await prisma.payslip.update({
      where: { id: req.params.id },
      data: { status },
      include: { employee: true }
    });

    res.json(payslip);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update payslip payment status.' });
  }
};

// Delete payslip record
exports.deletePayslip = async (req, res) => {
  try {
    await prisma.payslip.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Payslip record deleted successfully.' });
  } catch (error) {
    console.error('Delete payslip error:', error);
    res.status(500).json({ error: 'Failed to delete payslip record.' });
  }
};

// Download payslip as PDF
exports.downloadPayslipPDF = async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id: req.params.id },
      include: { employee: true }
    });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.employee.name.replace(/\s+/g, '-').toLowerCase()}-${MONTHS[payslip.month - 1].toLowerCase()}-${payslip.year}.pdf"`);
    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#0f172a').fontSize(20).text('PAYSLIP', 50, 50, { align: 'left' });
    doc.fontSize(10).fillColor('#64748b').text(`Month: ${MONTHS[payslip.month - 1]} ${payslip.year}`, 50, 75);
    doc.text(`Payslip ID: ${payslip.id.substring(0, 8).toUpperCase()}`, 50, 90);
    doc.text(`Status: ${payslip.status}`, 50, 105);

    // Corporate info
    doc.fontSize(14).fillColor('#0f172a').text(process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#64748b').text('Regd. Office: 456 Financial District', 350, 70, { align: 'right' });
    doc.text(`State: ${process.env.MY_BUSINESS_STATE || 'Delhi'}`, 350, 85, { align: 'right' });

    // Divider Line
    doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#cbd5e1').lineWidth(1).stroke();

    // --- Employee & Bank Details Grid ---
    doc.fillColor('#0f172a').fontSize(11).text('EMPLOYEE DETAILS', 50, 150);
    
    // Left Grid
    let textY = 170;
    doc.fontSize(9).fillColor('#475569');
    doc.text(`Employee Name:`, 50, textY);
    doc.font('Helvetica-Bold').fillColor('#1e293b').text(payslip.employee.name, 150, textY);
    doc.font('Helvetica').fillColor('#475569');
    textY += 16;

    doc.text(`Designation:`, 50, textY);
    doc.fillColor('#1e293b').text(payslip.employee.designation, 150, textY);
    doc.fillColor('#475569');
    textY += 16;

    doc.text(`Department:`, 50, textY);
    doc.fillColor('#1e293b').text(payslip.employee.department || 'General', 150, textY);
    doc.fillColor('#475569');
    textY += 16;

    doc.text(`PAN:`, 50, textY);
    doc.fillColor('#1e293b').text(payslip.employee.pan || '-', 150, textY);
    doc.fillColor('#475569');

    // Right Grid
    textY = 170;
    doc.text(`Bank Account:`, 320, textY);
    doc.fillColor('#1e293b').text(payslip.employee.bankAccount || '-', 420, textY);
    doc.fillColor('#475569');
    textY += 16;

    doc.text(`IFSC Code:`, 320, textY);
    doc.fillColor('#1e293b').text(payslip.employee.ifscCode || '-', 420, textY);
    doc.fillColor('#475569');
    textY += 16;

    const totalDays = new Date(payslip.year, payslip.month, 0).getDate();
    doc.text(`Days in Month:`, 320, textY);
    doc.fillColor('#1e293b').text(totalDays.toString(), 420, textY);
    doc.fillColor('#475569');
    textY += 16;

    doc.text(`Paid Days:`, 320, textY);
    doc.fillColor('#1e293b').text(payslip.paidDays.toString(), 420, textY);
    doc.fillColor('#475569');

    // Divider Line
    doc.moveTo(50, 250).lineTo(550, 250).strokeColor('#cbd5e1').stroke();

    // --- Earnings vs Deductions Table ---
    const tableTop = 270;
    doc.rect(50, tableTop, 500, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    
    // Headers
    doc.text('Earnings Description', 60, tableTop + 6, { width: 170 });
    doc.text('Amount (INR)', 220, tableTop + 6, { width: 60, align: 'right' });
    doc.text('Deductions Description', 300, tableTop + 6, { width: 170 });
    doc.text('Amount (INR)', 460, tableTop + 6, { width: 80, align: 'right' });

    // Table rows
    const proration = payslip.paidDays / totalDays;
    const proratedBase = Math.round(payslip.employee.baseSalary * proration * 100) / 100;
    const proratedAllowances = Math.round(payslip.employee.allowances * proration * 100) / 100;
    const proratedDeductions = Math.round(payslip.employee.deductions * proration * 100) / 100;

    let currentY = tableTop + 20;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');

    // Row 1: Base Salary vs Standard Deductions
    doc.rect(50, currentY, 500, 20).fill('#f8fafc');
    doc.fillColor('#334155');
    doc.text('Basic Salary', 60, currentY + 6);
    doc.text(proratedBase.toFixed(2), 220, currentY + 6, { width: 60, align: 'right' });
    doc.text('Standard Deductions (PF/PT)', 300, currentY + 6);
    doc.text(proratedDeductions.toFixed(2), 460, currentY + 6, { width: 80, align: 'right' });
    currentY += 20;

    // Row 2: Allowances vs Empty
    doc.rect(50, currentY, 500, 20).fill('#ffffff');
    doc.fillColor('#334155');
    doc.text('House Rent & Special Allowance', 60, currentY + 6);
    doc.text(proratedAllowances.toFixed(2), 220, currentY + 6, { width: 60, align: 'right' });
    doc.text('-', 300, currentY + 6);
    doc.text('0.00', 460, currentY + 6, { width: 80, align: 'right' });
    currentY += 20;

    // Draw bottom table border
    doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#cbd5e1').stroke();
    currentY += 15;

    // --- Sub-Totals ---
    doc.fontSize(9).fillColor('#475569');
    doc.text('Gross Earnings:', 50, currentY, { width: 170, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#1e293b').text(`INR ${payslip.grossEarnings.toFixed(2)}`, 220, currentY, { width: 60, align: 'right' });
    
    doc.font('Helvetica').fillColor('#475569');
    doc.text('Total Deductions:', 290, currentY, { width: 170, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#1e293b').text(`INR ${payslip.totalDeductions.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
    
    currentY += 30;

    // --- Net Payout (Highlight Banner) ---
    doc.rect(50, currentY, 500, 35).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
    doc.text('NET SALARY PAYOUT (TAKE-HOME):', 65, currentY + 12);
    doc.text(`INR ${payslip.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 420, currentY + 12, { width: 120, align: 'right' });
    
    currentY += 50;

    // --- Net Payout in Words ---
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Oblique');
    doc.text('Amount in Words:', 50, currentY);
    doc.font('Helvetica-Bold').fillColor('#1e293b').text(numberToWords(payslip.netSalary), 50, currentY + 14);

    // Signatures
    currentY += 60;
    doc.moveTo(50, currentY + 40).lineTo(200, currentY + 40).strokeColor('#94a3b8').stroke();
    doc.moveTo(400, currentY + 40).lineTo(550, currentY + 40).strokeColor('#94a3b8').stroke();

    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text("Employer Signature", 50, currentY + 45, { width: 150, align: 'center' });
    doc.text("Employee Signature / Acknowledgment", 400, currentY + 45, { width: 150, align: 'center' });

    doc.fontSize(8).fillColor('#94a3b8').text('This is a computer generated document and does not require a physical stamp. Generated by Finance App.', 50, 720, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('PDF payslip generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF payslip.' });
  }
};
