require('dotenv').config();
const express = require('express');
const next = require('next');
const cors = require('cors');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Import Express Routes
const authRoutes = require('./src/server/routes/authRoutes');
const clientRoutes = require('./src/server/routes/clientRoutes');
const invoiceRoutes = require('./src/server/routes/invoiceRoutes');
const expenseRoutes = require('./src/server/routes/expenseRoutes');
const employeeRoutes = require('./src/server/routes/employeeRoutes');
const payrollRoutes = require('./src/server/routes/payrollRoutes');
const inventoryRoutes = require('./src/server/routes/inventoryRoutes');
const reportRoutes = require('./src/server/routes/reportRoutes');
const supplierRoutes = require('./src/server/routes/supplierRoutes');
const voucherRoutes = require('./src/server/routes/voucherRoutes');
const notificationRoutes = require('./src/server/routes/notificationRoutes');
const excelRoutes = require('./src/server/routes/excelRoutes');

app.prepare().then(() => {
  const server = express();
  const PORT = process.env.PORT || 3000;

  server.use(cors());
  server.use(express.json());

  // Serve static uploads
  server.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Mount API Routes
  server.use('/api/auth', authRoutes);
  server.use('/api/clients', clientRoutes);
  server.use('/api/invoices', invoiceRoutes);
  server.use('/api/expenses', expenseRoutes);
  server.use('/api/employees', employeeRoutes);
  server.use('/api/payroll', payrollRoutes);
  server.use('/api/inventory', inventoryRoutes);
  server.use('/api/reports', reportRoutes);
  server.use('/api/suppliers', supplierRoutes);
  server.use('/api/vouchers', voucherRoutes);
  server.use('/api/notifications', notificationRoutes);
  server.use('/api/excel', excelRoutes);

  // Health Check
  server.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Finance API Server is active and operational' });
  });

  // Express Error handling middleware
  server.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error'
    });
  });

  // Fallback to Next.js page handler
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    
    // Start notification daemon
    const { startNotificationDaemon } = require('./src/server/cron');
    startNotificationDaemon();
  });
});
