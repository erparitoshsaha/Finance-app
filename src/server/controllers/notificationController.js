const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const configPath = path.join(process.cwd(), 'config/notifications.json');

// Ensure config file exists
function getSettings() {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    const defaultSettings = {
      remindersEnabled: true,
      ccAdmin: true,
      lastRun: null,
      logs: []
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    return { remindersEnabled: true, ccAdmin: true, lastRun: null, logs: [] };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
}

// Get notification settings
exports.getSettings = async (req, res) => {
  try {
    const settings = getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notification settings.' });
  }
};

// Update notification settings
exports.updateSettings = async (req, res) => {
  try {
    const { remindersEnabled, ccAdmin } = req.body;
    const settings = getSettings();

    settings.remindersEnabled = remindersEnabled !== undefined ? remindersEnabled : settings.remindersEnabled;
    settings.ccAdmin = ccAdmin !== undefined ? ccAdmin : settings.ccAdmin;

    saveSettings(settings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification settings.' });
  }
};

// Trigger past-due reminder emails manual scanner
exports.triggerReminders = async (req, res) => {
  try {
    const settings = getSettings();
    const today = new Date();

    // 1. Query past-due invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['UNPAID', 'PARTIALLY_PAID']
        },
        dueDate: {
          lt: today
        }
      },
      include: {
        client: true
      }
    });

    if (overdueInvoices.length === 0) {
      return res.json({ 
        message: 'Scan completed. No past-due invoices found.', 
        sentCount: 0,
        logs: settings.logs.slice(-10)
      });
    }

    // 2. Configure Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass'
      }
    });

    let sentCount = 0;
    const runLogs = [];

    // 3. Dispatch reminder emails
    for (const inv of overdueInvoices) {
      const clientEmail = inv.client.email;
      if (!clientEmail) continue;

      const subject = `OVERDUE REMINDER: Invoice ${inv.invoiceNumber} is past due`;
      const text = `Dear ${inv.client.companyName},\n\nThis is a friendly reminder that invoice ${inv.invoiceNumber} was due on ${new Date(inv.dueDate).toLocaleDateString('en-IN')}.\n\nAccording to our records, we have not yet received full payment for this invoice.\n\nOutstanding Balance: INR ${inv.netPayable.toFixed(2)}\n\nPlease arrange for payment as soon as possible.\n\nThank you for your prompt attention to this matter.\n\nRegards,\n${process.env.MY_BUSINESS_NAME || 'FINANCE CORP LTD'}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Finance App" <invoices@financeapp.com>',
        to: clientEmail,
        subject,
        text
      };

      let status = 'SUCCESS';
      if (!process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user') {
        status = 'SIMULATED';
        console.log(`[SIMULATED REMINDER] To: ${clientEmail} | Subject: ${subject}`);
      } else {
        try {
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error(`Failed to send reminder for ${inv.invoiceNumber}:`, err);
          status = 'FAILED';
        }
      }

      if (status !== 'FAILED') {
        sentCount++;
      }

      runLogs.push({
        timestamp: new Date().toISOString(),
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.companyName,
        recipient: clientEmail,
        amount: inv.netPayable,
        status
      });
    }

    // 4. Save results to log
    settings.lastRun = new Date().toISOString();
    settings.logs = [...runLogs, ...settings.logs].slice(0, 50); // Keep last 50 logs
    saveSettings(settings);

    res.json({
      message: `Scanner completed. Sent ${sentCount} reminders.`,
      sentCount,
      logs: settings.logs
    });
  } catch (error) {
    console.error('Trigger reminders error:', error);
    res.status(500).json({ error: 'Failed to run past-due reminders scan.' });
  }
};
