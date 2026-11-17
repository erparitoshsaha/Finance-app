const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const configPath = path.join(process.cwd(), 'config/notifications.json');

function getSettings() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    // Ignore
  }
  return { remindersEnabled: true, ccAdmin: true, lastRun: null, logs: [] };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    // Ignore
  }
}

async function runReminderScanner() {
  console.log('[AUTO REMINDER SCANNER] Starting scheduled past-due check...');
  const settings = getSettings();
  if (!settings.remindersEnabled) {
    console.log('[AUTO REMINDER SCANNER] Automatic reminders are disabled in settings.');
    return;
  }

  try {
    const today = new Date();
    // Query unpaid or partially paid overdue invoices
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
      console.log('[AUTO REMINDER SCANNER] No past-due invoices found.');
      return;
    }

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
        console.log(`[SIMULATED AUTO-REMINDER] To: ${clientEmail} | Subject: ${subject}`);
      } else {
        try {
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error(`[AUTO-REMINDER ERROR] Failed to send reminder for ${inv.invoiceNumber}:`, err);
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

    settings.lastRun = new Date().toISOString();
    settings.logs = [...runLogs, ...settings.logs].slice(0, 50);
    saveSettings(settings);

    console.log(`[AUTO REMINDER SCANNER] Scan finished. Sent ${sentCount} reminders.`);
  } catch (error) {
    console.error('[AUTO REMINDER SCANNER] Failed to run automated checks:', error);
  }
}

// Start daily check interval (runs every 24 hours + once at startup after a short delay)
function startNotificationDaemon() {
  // Wait 10 seconds before first run to prevent interfering with server boot sequence
  setTimeout(runReminderScanner, 10000);

  // Run every 24 hours (86,400,000 milliseconds)
  setInterval(runReminderScanner, 24 * 60 * 60 * 1000);
}

module.exports = {
  startNotificationDaemon
};
