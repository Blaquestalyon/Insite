// Insite Integrative Wellness — appointment-request backend
// Serves the static site from /public and exposes POST /api/appointment.
// On submit: stores the row in Airtable and sends an email to the office
// via Web3Forms (free, unlimited, no SMTP setup needed).

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// --- env -------------------------------------------------------------------
const {
  WEB3FORMS_ACCESS_KEY,            // from https://web3forms.com  (uses the verified email you signed up with)
  OFFICE_EMAIL = 'info@insiteintegrativewellness.com',
  AIRTABLE_TOKEN,                  // Personal Access Token from https://airtable.com/create/tokens
  AIRTABLE_BASE_ID,                // appXXXXXXXXXXXXXX
  AIRTABLE_TABLE = 'Appointments', // table name (must match the table in your base)
} = process.env;

// --- middleware ------------------------------------------------------------
// Railway terminates TLS at its proxy and forwards the original protocol
// in X-Forwarded-Proto. Tell Express to trust it so req.secure works.
app.set('trust proxy', 1);

// Force HTTPS in production. Runs before anything else so even API calls,
// asset requests, and form posts get upgraded. Disabled when NODE_ENV !== 'production'
// so local `npm run dev` over http://localhost still works.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  // Tell browsers to stick to HTTPS for the next 6 months.
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  maxAge: '1h',
}));

// simple per-IP rate limit (in-memory; fine for a single Railway instance)
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 5;
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again in a minute.' });
  }
  arr.push(now);
  hits.set(ip, arr);
  next();
}

// --- helpers ---------------------------------------------------------------
const isEmail = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (s, max = 2000) => String(s ?? '').trim().slice(0, max);

async function sendEmailViaWeb3Forms(payload) {
  if (!WEB3FORMS_ACCESS_KEY) {
    throw new Error('WEB3FORMS_ACCESS_KEY not configured');
  }
  const body = {
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: `Appointment Request — ${payload.name}`,
    from_name: 'Insite Integrative Wellness Website',
    to: OFFICE_EMAIL,                 // ignored unless verified; the account email is the canonical destination
    replyto: payload.email,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || 'Not provided',
    sms_consent: payload.sms_consent ? 'YES' : 'No',
    service: payload.service,
    message: payload.message || '(none)',
  };
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(`Web3Forms: ${data.message || res.status}`);
  }
  return data;
}

async function storeInAirtable(payload) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable env vars not configured');
  }
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        Name: payload.name,
        Email: payload.email,
        Phone: payload.phone || '',
        Service: payload.service,
        Message: payload.message || '',
        'SMS Consent': !!payload.sms_consent,
        'Submitted At': new Date().toISOString(),
      },
      typecast: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Airtable: ${data?.error?.message || res.status}`);
  }
  return data;
}

// --- routes ----------------------------------------------------------------
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/appointment', rateLimit, async (req, res) => {
  try {
    const payload = {
      name: clean(req.body.name, 200),
      email: clean(req.body.email, 200),
      phone: clean(req.body.phone, 40),
      service: clean(req.body.service, 200),
      message: clean(req.body.message, 4000),
      sms_consent: !!req.body.sms_consent,
    };

    if (!payload.name || !payload.email) {
      return res.status(400).json({ ok: false, error: 'Name and email are required.' });
    }
    if (!isEmail(payload.email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }
    if (payload.phone && !payload.sms_consent) {
      return res.status(400).json({ ok: false, error: 'SMS consent required when a phone number is provided.' });
    }

    // Run email + DB in parallel. If either fails we still return an error,
    // but we log both so the office is not left in the dark.
    const [emailResult, dbResult] = await Promise.allSettled([
      sendEmailViaWeb3Forms(payload),
      storeInAirtable(payload),
    ]);

    const emailOk = emailResult.status === 'fulfilled';
    const dbOk = dbResult.status === 'fulfilled';

    if (!emailOk) console.error('Email error:', emailResult.reason?.message);
    if (!dbOk)    console.error('Airtable error:', dbResult.reason?.message);

    // As long as ONE channel worked we treat it as a success for the user —
    // the office still receives the lead. Only hard-fail if both failed.
    if (!emailOk && !dbOk) {
      return res.status(502).json({ ok: false, error: 'Submission failed. Please call or email the office.' });
    }

    return res.json({ ok: true, email: emailOk, stored: dbOk });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ ok: false, error: 'Server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Insite site listening on :${PORT}`);
});
