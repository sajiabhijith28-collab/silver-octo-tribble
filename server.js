require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'enquiries.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

function clean(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max) : '';
}
function readLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
  catch { throw new Error('Enquiry storage is unreadable'); }
}
function saveLead(lead) {
  const leads = readLeads();
  leads.push(lead);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'AIWave API' }));

app.post('/api/contact', async (req, res) => {
  const name = clean(req.body?.name, 100);
  const contact = clean(req.body?.contact, 160);
  const message = clean(req.body?.message, 5000);
  // Honeypot field: bots often fill hidden fields.
  if (clean(req.body?.website, 200)) return res.status(200).json({ ok: true, message: 'Message received.' });
  if (name.length < 2 || !contact || message.length < 5) {
    return res.status(400).json({ ok: false, message: 'Please provide your name, contact details, and a message (at least 5 characters).' });
  }
  if (contact.length > 160) return res.status(400).json({ ok: false, message: 'Contact details are too long.' });

  const lead = {
    id: require('crypto').randomUUID(),
    name, contact, message,
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  try {
    saveLead(lead);
  } catch (err) {
    console.error('Could not save enquiry:', err.message);
    return res.status(500).json({ ok: false, message: 'Could not save your message right now. Please try again later.' });
  }

  // Email notifications are optional; saved enquiries remain available if SMTP is not configured.
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NOTIFY_EMAIL) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.NOTIFY_EMAIL,
        replyTo: contact.includes('@') ? contact : undefined,
        subject: `New AIWave enquiry from ${name}`,
        text: `Name: ${name}\nContact: ${contact}\nReceived: ${lead.createdAt}\n\nMessage:\n${message}`
      });
    } catch (err) {
      console.error('Email notification failed (enquiry was saved):', err.message);
    }
  }
  return res.status(201).json({ ok: true, message: 'Thanks! Your message has been received. We will contact you soon.', id: lead.id });
});

app.use('/api', (_req, res) => res.status(404).json({ ok: false, message: 'API route not found.' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`AIWave website and API running at http://localhost:${PORT}`));
