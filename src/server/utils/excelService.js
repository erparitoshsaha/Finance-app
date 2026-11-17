const ExcelJS = require('exceljs');

/**
 * Excel Service for Antigravity Finance Application
 * Provides unified styling, formula injection prevention,
 * workbook generation, template creation, parsing, and error reporting.
 */

// Corporate Theme Colors
const COLORS = {
  headerBg: '1E293B',       // Slate 800
  headerText: 'FFFFFF',     // White
  subHeaderBg: 'F1F5F9',    // Slate 100
  subHeaderText: '0F172A',  // Slate 900
  zebraLight: 'F8FAFC',     // Slate 50
  zebraDark: 'FFFFFF',      // White
  border: 'CBD5E1',         // Slate 300
  accent: '4F46E5',         // Indigo 600
  successBg: 'DCFCE7',      // Emerald 100
  successText: '166534',    // Emerald 800
  errorBg: 'FEE2E2',        // Rose 100
  errorText: '991B1B',      // Rose 800
  warningBg: 'FEF3C7',      // Amber 100
  warningText: '92400E',    // Amber 800
};

// Standard Font
const FONT_BASE = { name: 'Segoe UI', size: 10 };
const FONT_HEADER = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.headerText } };
const FONT_TITLE = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };
const FONT_SUBTITLE = { name: 'Segoe UI', size: 9, italic: true, color: { argb: '64748B' } };

// Cell Borders
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } },
};

/**
 * Sanitize cell values against CSV/Excel Formula Injection (CWE-1236).
 * Prepend a single quote if the value starts with =, +, -, @, \t, or \r.
 */
function sanitizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }
  const str = String(value);
  if (/^[=\+\-\@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Clean and un-sanitize value during import
 */
function desanitizeValue(value) {
  if (typeof value === 'string' && value.startsWith("'") && /^[=\+\-\@\t\r]/.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

/**
 * Create a base configured workbook with default metadata
 */
function createWorkbook(title = 'Finance Export') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD';
  workbook.lastModifiedBy = 'Finance App Engine';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

/**
 * Apply auto-fit column width to a worksheet
 */
function autoFitColumns(worksheet, minWidth = 12, maxWidth = 45) {
  worksheet.columns.forEach(column => {
    let maxLen = minWidth;
    if (column && column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.value ? cell.value.toString() : '';
        // If cell has line breaks, check longest line
        const lines = val.split('\n');
        lines.forEach(l => {
          if (l.length > maxLen) {
            maxLen = l.length;
          }
        });
      });
    }
    column.width = Math.min(Math.max(maxLen + 3, minWidth), maxWidth);
  });
}

/**
 * Style header row
 */
function styleHeaderRow(row, bgHex = COLORS.headerBg) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = FONT_HEADER;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgHex },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });
}

/**
 * Style data rows with alternating striping and format alignment
 */
function styleDataRow(row, isEven = false, formats = {}) {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = FONT_BASE;
    cell.border = THIN_BORDER;
    
    // Background fill
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? COLORS.zebraLight : COLORS.zebraDark },
    };

    // Number / alignment formatting
    const format = formats[colNumber] || formats[cell.col];
    if (format) {
      if (format.numFmt) cell.numFmt = format.numFmt;
      if (format.align) cell.alignment = { vertical: 'middle', horizontal: format.align };
    } else {
      if (typeof cell.value === 'number') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });
}

/**
 * Pipe workbook to Express response as downloadable .xlsx
 */
async function sendWorkbookResponse(res, workbook, filename) {
  const safeFilename = (filename || 'export.xlsx').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename}"`
  );
  
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

/**
 * Parse an uploaded Excel file buffer into raw data rows
 * Returns { headers, rows: [{ rowNumber, raw: { ... } }] }
 */
async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Look for the primary data sheet (prefer sheet named 'data' / 'template' or non-instruction sheet)
  let sheet = workbook.worksheets.find(s => s.name.toLowerCase().includes('data') || s.name.toLowerCase().includes('template'))
           || workbook.worksheets.find(s => !s.name.toLowerCase().includes('instruction'))
           || workbook.worksheets[0];
  if (!sheet) {
    throw new Error('The uploaded Excel file has no worksheets.');
  }

  // Find header row (skip empty rows or instructions)
  let headerRowIndex = 1;
  let headerRow = null;
  let headers = [];

  for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const nonBlankCount = row.actualCellCount;
    if (nonBlankCount >= 2) {
      const candidateHeaders = [];
      let looksLikeHeader = true;
      row.eachCell((cell, colNumber) => {
        const val = (cell.value || '').toString().trim();
        if (val) {
          candidateHeaders.push({ colNumber, name: val });
        }
      });
      // Header heuristic: contains distinct strings and at least 2 distinct columns (avoids merged title banners)
      const distinctNames = new Set(candidateHeaders.map(c => c.name.toLowerCase()));
      if (candidateHeaders.length >= 2 && distinctNames.size >= 2) {
        headerRowIndex = r;
        headers = candidateHeaders;
        break;
      }
    }
  }

  if (headers.length === 0) {
    throw new Error('Could not identify a valid header row in the uploaded Excel spreadsheet.');
  }

  const rows = [];
  for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    let hasData = false;
    const rowData = {};

    headers.forEach(({ colNumber, name }) => {
      const cell = row.getCell(colNumber);
      let val = cell.value;

      // Handle ExcelJS rich text or formula result
      if (val && typeof val === 'object') {
        if (val.result !== undefined) val = val.result;
        else if (val.richText) val = val.richText.map(t => t.text).join('');
        else if (val.text !== undefined) val = val.text;
      }

      val = desanitizeValue(val);
      if (val !== null && val !== undefined && val !== '') {
        hasData = true;
      }
      rowData[name] = val;
    });

    if (hasData) {
      rows.push({
        rowNumber: r,
        data: rowData
      });
    }
  }

  return {
    headers: headers.map(h => h.name),
    rows
  };
}

/**
 * Generate an Excel Error Report for invalid rows
 */
async function generateErrorReport(moduleName, columns, invalidRows) {
  const workbook = createWorkbook(`${moduleName} Import Errors`);
  const sheet = workbook.addWorksheet('Import Errors');

  // Title Block
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `${moduleName.toUpperCase()} IMPORT ERROR REPORT`;
  sheet.getCell('A1').font = FONT_TITLE;

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `Generated on ${new Date().toLocaleString('en-IN')}. Please correct the rows below and re-upload.`;
  sheet.getCell('A2').font = FONT_SUBTITLE;

  sheet.addRow([]); // Blank row 3

  // Headers: Row Number, Error Reason, followed by original columns
  const headerTitles = ['Excel Row #', 'Error Reasons', ...columns.map(c => c.header)];
  const headerRow = sheet.addRow(headerTitles);
  styleHeaderRow(headerRow, '991B1B'); // Red header for error report

  invalidRows.forEach((item, idx) => {
    const rowValues = [
      item.rowNumber,
      item.errors ? item.errors.join('; ') : 'Invalid data',
      ...columns.map(c => item.data[c.key] !== undefined ? item.data[c.key] : (item.data[c.header] || ''))
    ];
    const row = sheet.addRow(rowValues);
    styleDataRow(row, idx % 2 === 0);

    // Highlight error message cell
    const errorCell = row.getCell(2);
    errorCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: '991B1B' } };
    errorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FEE2E2' }
    };
  });

  autoFitColumns(sheet);
  return workbook;
}

/**
 * Create a downloadable Template workbook
 */
function createTemplateWorkbook(moduleName, columns, sampleRows = [], instructions = []) {
  const workbook = createWorkbook(`${moduleName} Template`);
  
  // Sheet 1: Instructions
  if (instructions.length > 0) {
    const instSheet = workbook.addWorksheet('Instructions');
    instSheet.addRow([`${moduleName.toUpperCase()} IMPORT INSTRUCTIONS`]);
    instSheet.getCell('A1').font = FONT_TITLE;
    instSheet.addRow([`Please follow these requirements when preparing your spreadsheet:`]);
    instSheet.getCell('A2').font = FONT_SUBTITLE;
    instSheet.addRow([]);

    instructions.forEach((inst, i) => {
      const r = instSheet.addRow([`${i + 1}.`, inst]);
      r.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.accent } };
      r.getCell(2).font = FONT_BASE;
    });

    instSheet.columns = [{ width: 5 }, { width: 80 }];
  }

  // Sheet 2: Data Template
  const sheet = workbook.addWorksheet('Data');
  
  // Header row
  const headerRow = sheet.addRow(columns.map(c => c.header + (c.required ? ' *' : '')));
  styleHeaderRow(headerRow, COLORS.accent);

  // Add sample rows
  sampleRows.forEach((sample, idx) => {
    const rowValues = columns.map(c => sample[c.key] !== undefined ? sample[c.key] : '');
    const row = sheet.addRow(rowValues);
    styleDataRow(row, idx % 2 === 0);
  });

  // Apply column formatting hints
  columns.forEach((c, idx) => {
    const colNumber = idx + 1;
    const col = sheet.getColumn(colNumber);
    if (c.numFmt) col.numFmt = c.numFmt;
    if (c.width) col.width = c.width;
  });

  autoFitColumns(sheet, 14, 45);

  return workbook;
}

module.exports = {
  COLORS,
  FONT_BASE,
  FONT_HEADER,
  FONT_TITLE,
  FONT_SUBTITLE,
  THIN_BORDER,
  sanitizeValue,
  desanitizeValue,
  createWorkbook,
  autoFitColumns,
  styleHeaderRow,
  styleDataRow,
  sendWorkbookResponse,
  parseExcelBuffer,
  generateErrorReport,
  createTemplateWorkbook,
};
