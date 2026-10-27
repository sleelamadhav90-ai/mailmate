import express from 'express';
import { createServer as createViteServer } from 'vite';
import dnsPromises from 'dns/promises';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Known Disposable Domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "trashmail.com", "dispostable.com", "yopmail.com", "getnada.com",
  "throwawaymail.com", "sharklasers.com", "maildrop.cc", "temp-mail.org",
  "crazymailing.com", "binkmail.com", "safetymail.info"
]);

// Role Prefixes
const ROLE_PREFIXES = new Set([
  "admin", "administrator", "support", "info", "sales", "billing", "contact",
  "help", "jobs", "careers", "marketing", "postmaster", "hostmaster", "webmaster",
  "security", "privacy", "abuse", "no-reply", "noreply"
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateSyntax(email: string) {
  if (!email || typeof email !== 'string') {
    return { ok: false, local: '', domain: '', error: 'Invalid email format. Enter an address with a valid local part and domain.' };
  }
  const clean = email.trim();
  if (clean.length > 254) {
    return { ok: false, local: '', domain: '', error: 'Invalid email format. Email address exceeds maximum allowed length.' };
  }
  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { ok: false, local: '', domain: '', error: 'Invalid email format. Enter an address with a valid local part and domain.' };
  }
  const local = parts[0];
  const domain = parts[1].toLowerCase();
  if (!local) return { ok: false, local: '', domain, error: 'Invalid email format. Enter an address with a valid local part and domain.' };
  if (local.length > 64) return { ok: false, local, domain, error: 'Invalid email format. Local part before @ is too long.' };
  if (!domain) return { ok: false, local, domain: '', error: 'Invalid email format. Add a domain after the @ symbol.' };
  if (domain.length > 255) return { ok: false, local, domain, error: 'Invalid email format. Domain name is too long.' };
  if (domain.includes('..') || local.includes('..')) {
    return { ok: false, local, domain, error: 'Invalid email format. Check for consecutive dots or special characters.' };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { ok: false, local, domain, error: 'Invalid email format. Enter an address with a valid local part and domain.' };
  }
  const labels = domain.split('.');
  if (labels.length < 2 || labels[labels.length - 1].length < 2) {
    return { ok: false, local, domain, error: 'Invalid email format. Add a valid domain extension.' };
  }
  return { ok: true, local, domain, error: '' };
}

async function resolveDns(domain: string) {
  const res = {
    domain_exists: null as boolean | null,
    mx_records_found: false,
    mx_hosts: [] as string[],
    has_fallback_a: false,
    is_null_mx: false,
    spf_record: false,
    dmarc_record: false,
    dns_status: 'OK',
    dns_error: null as string | null
  };

  const timeoutMs = 3000;

  async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  // 1. Resolve MX Records
  try {
    const mxRecords = await withTimeout((signal) => dnsPromises.resolveMx(domain));
    if (mxRecords && mxRecords.length > 0) {
      res.domain_exists = true;
      mxRecords.sort((a, b) => a.priority - b.priority);
      const hosts = mxRecords.map(r => r.exchange.replace(/\.$/, ''));
      if (hosts.includes('') || hosts.includes('.')) {
        res.is_null_mx = true;
      } else {
        res.mx_hosts = hosts;
        res.mx_records_found = true;
      }
    }
  } catch (err: any) {
    const code = err.code || err.name;
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
      res.domain_exists = false;
      res.dns_status = 'NXDOMAIN';
      res.dns_error = 'Domain does not exist in DNS (NXDOMAIN).';
      return res;
    } else if (code === 'ENODATA') {
      // Domain exists, but has no explicit MX records
      res.domain_exists = true;
      res.mx_records_found = false;
    } else if (code === 'ETIMEDOUT' || err.name === 'AbortError') {
      res.dns_status = 'TIMEOUT';
      res.dns_error = 'DNS lookup timed out.';
      return res;
    } else if (code === 'SERVFAIL' || code === 'ESERVFAIL' || code === 'EREFUSED') {
      res.dns_status = 'DNS_SERVER_ERROR';
      res.dns_error = `DNS server error (${code}).`;
      return res;
    } else {
      res.dns_status = 'DNS_ERROR';
      res.dns_error = err.message || 'DNS resolution failed.';
      return res;
    }
  }

  // 2. Check Fallback A/AAAA if no MX found
  if (!res.mx_records_found && !res.is_null_mx && res.domain_exists !== false) {
    try {
      const aRecs = await withTimeout((signal) => dnsPromises.resolve4(domain));
      if (aRecs && aRecs.length > 0) {
        res.has_fallback_a = true;
        res.domain_exists = true;
      }
    } catch (err: any) {
      const code = err.code || err.name;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        res.domain_exists = false;
        res.dns_error = 'Domain does not exist in DNS (NXDOMAIN).';
      } else if (!res.has_fallback_a) {
        try {
          const aaaaRecs = await withTimeout((signal) => dnsPromises.resolve6(domain));
          if (aaaaRecs && aaaaRecs.length > 0) {
            res.has_fallback_a = true;
            res.domain_exists = true;
          }
        } catch (e: any) {
          // ignore AAAA lookup errors
        }
      }
    }
  }

  // 3. Query SPF and DMARC TXT records
  if (res.domain_exists) {
    try {
      const txtRecords = await withTimeout((signal) => dnsPromises.resolveTxt(domain));
      if (txtRecords) {
        const flatTxt = txtRecords.map(r => r.join('')).join(' ').toLowerCase();
        if (flatTxt.includes('v=spf1')) {
          res.spf_record = true;
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const dmarcRecords = await withTimeout((signal) => dnsPromises.resolveTxt(`_dmarc.${domain}`));
      if (dmarcRecords) {
        const flatDmarc = dmarcRecords.map(r => r.join('')).join(' ').toLowerCase();
        if (flatDmarc.includes('v=dmarc1')) {
          res.dmarc_record = true;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return res;
}

async function evaluateEmail(emailStr: string) {
  const clean = (emailStr || '').trim();
  const syn = validateSyntax(clean);

  // Syntax Error -> Invalid Format
  if (!syn.ok) {
    return {
      email: clean,
      domain: syn.domain || 'N/A',
      status: 'Invalid Format',
      reason: 'Enter a valid email address containing a local part and domain.',
      checks_performed: {
        syntax_valid: false,
        domain_exists: false,
        mx_records_found: false,
        dns_check_skipped: true,
        dns_status: 'Skipped (Invalid Syntax)',
        disposable_domain: false,
        role_account: false
      },
      mailbox_verified: false
    };
  }

  const isRole = ROLE_PREFIXES.has(syn.local.toLowerCase());
  const isDisposable = DISPOSABLE_DOMAINS.has(syn.domain.toLowerCase());

  // Perform DNS Resolution on backend
  const dnsRes = await resolveDns(syn.domain);

  const checks = {
    syntax_valid: true,
    domain_exists: dnsRes.domain_exists ?? false,
    mx_records_found: dnsRes.mx_records_found,
    mx_hosts: dnsRes.mx_hosts.slice(0, 3),
    has_fallback_a: dnsRes.has_fallback_a,
    is_null_mx: dnsRes.is_null_mx,
    disposable_domain: isDisposable,
    role_account: isRole,
    spf_record: dnsRes.spf_record,
    dmarc_record: dnsRes.dmarc_record,
    dns_status: dnsRes.dns_status
  };

  // Case 1: Disposable provider -> Likely to Bounce
  if (isDisposable) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'Temporary or disposable email provider detected.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 2: DNS Error, Timeout, or SERVFAIL -> Unknown (Never report as NXDOMAIN or Bounce)
  if (dnsRes.dns_error && !dnsRes.dns_error.includes('NXDOMAIN')) {
    let reasonText = 'DNS lookup was inconclusive. Deliverability remains unknown.';
    if (dnsRes.dns_status === 'TIMEOUT') {
      reasonText = 'DNS check timed out. Deliverability remains unknown.';
    } else if (dnsRes.dns_status === 'DNS_SERVER_ERROR') {
      reasonText = 'DNS server error occurred. Deliverability remains unknown.';
    }
    return {
      email: clean,
      domain: syn.domain,
      status: 'Unknown',
      reason: reasonText,
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 3: Confirmed Null MX (RFC 7505) -> Likely to Bounce
  if (dnsRes.is_null_mx) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'This domain explicitly indicates that it does not accept email.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 4: Confirmed Nonexistent Domain (NXDOMAIN) -> Likely to Bounce
  if (dnsRes.domain_exists === false) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'No DNS domain found. This address is unlikely to receive email.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 5: Domain exists, but NO MX and NO A/AAAA fallback -> Likely to Bounce
  if (!dnsRes.mx_records_found && !dnsRes.has_fallback_a) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'No MX records found. Additional routing checks are needed before determining deliverability.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 6: Domain has active MX records -> Likely Deliverable
  if (dnsRes.mx_records_found && dnsRes.mx_hosts.length >= 1) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely Deliverable',
      reason: 'Mail-routing records found. Individual mailbox existence is unconfirmed.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Case 7: Fallback A/AAAA routing available -> Likely Deliverable
  if (dnsRes.has_fallback_a) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely Deliverable',
      reason: 'Domain publishes fallback mail-routing records (RFC 5321). Individual mailbox unconfirmed.',
      checks_performed: checks,
      mailbox_verified: false
    };
  }

  // Default: Unknown
  return {
    email: clean,
    domain: syn.domain,
    status: 'Unknown',
    reason: 'DNS lookup was inconclusive. Deliverability remains unknown.',
    checks_performed: checks,
    mailbox_verified: false
  };
}

// ==========================================
// 1. API ROUTES REGISTERED FIRST
// ==========================================

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MailMate Deliverability Checker',
    runtime: 'Node Express Proxy & Flask Engine',
    timestamp: Date.now() / 1000
  });
});

// Batch Check API Endpoint
app.post('/api/check', async (req, res) => {
  const rawInput = req.body?.emails;
  if (!rawInput) {
    return res.status(400).json({ error: "No email addresses provided in 'emails' field." });
  }

  let emailList: string[] = [];
  if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (typeof item === 'string') {
        const tokens = item.split(/[\r\n,;\s]+/);
        for (const t of tokens) if (t.trim()) emailList.push(t.trim());
      }
    }
  } else if (typeof rawInput === 'string') {
    const tokens = rawInput.split(/[\r\n,;\s]+/);
    for (const t of tokens) if (t.trim()) emailList.push(t.trim());
  } else {
    return res.status(400).json({ error: "Field 'emails' must be a list of strings or a multi-line string." });
  }

  if (emailList.length === 0) {
    return res.status(400).json({ error: "Add at least one email address to continue." });
  }

  if (emailList.length > 100) {
    return res.status(400).json({
      error: `Batch size limit exceeded. Submitted ${emailList.length} emails, but maximum limit is 100 per request.`
    });
  }

  const results = [];
  const summary = {
    total: emailList.length,
    likely_deliverable: 0,
    likely_delivered: 0, // legacy alias
    likely_to_bounce: 0,
    unknown: 0,
    invalid_format: 0
  };

  for (const emailStr of emailList) {
    const evalRes = await evaluateEmail(emailStr);
    results.push(evalRes);

    const key = evalRes.status.toLowerCase().replace(/ /g, '_');
    if (key in summary) {
      (summary as any)[key]++;
    }
  }
  // Sync legacy alias
  summary.likely_delivered = summary.likely_deliverable;

  res.json({
    total: emailList.length,
    summary,
    results,
    disclaimer: "Results are heuristic estimates based on RFC syntax, domain DNS, and MX records. Mailbox-level presence is not guaranteed without sending an email."
  });
});

// Explicit JSON 404 for unhandled /api/* calls
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found.` });
});

// Serve Static Assets
app.use('/static', express.static(path.join(process.cwd(), 'static')));

// ==========================================
// 2. VITE MIDDLEWARE & HTML FALLBACK
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;

      if (url.startsWith('/api') || url.startsWith('/health')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(templatePath)) {
          let html = fs.readFileSync(templatePath, 'utf-8');
          html = await vite.transformIndexHtml(url, html);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        }
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`MailMate Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
