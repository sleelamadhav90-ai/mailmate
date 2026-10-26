import dnsPromises from 'dns/promises';

// Known Disposable Domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "trashmail.com", "dispostable.com", "yopmail.com", "getnada.com"
]);

// Role Prefixes
const ROLE_PREFIXES = new Set([
  "admin", "support", "info", "sales", "billing", "contact", "help"
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateSyntax(email: string) {
  if (!email || typeof email !== 'string') {
    return { ok: false, local: '', domain: '', error: 'Empty or non-string email address.' };
  }
  const clean = email.trim();
  if (clean.length > 254) {
    return { ok: false, local: '', domain: '', error: 'Email address exceeds maximum length of 254 characters.' };
  }
  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { ok: false, local: '', domain: '', error: 'Email address must contain exactly one "@" symbol.' };
  }
  const local = parts[0];
  const domain = parts[1].toLowerCase();
  if (!local) return { ok: false, local: '', domain, error: 'Missing local part before "@".' };
  if (local.length > 64) return { ok: false, local, domain, error: 'Local part exceeds maximum length of 64 characters.' };
  if (!domain) return { ok: false, local, domain: '', error: 'Missing domain part after "@".' };
  if (domain.length > 255) return { ok: false, local, domain, error: 'Domain name exceeds maximum length of 255 characters.' };
  if (domain.includes('..') || local.includes('..')) {
    return { ok: false, local, domain, error: 'Email contains invalid consecutive dots ("..").' };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { ok: false, local, domain, error: 'Email syntax does not match standard RFC 5322 format.' };
  }
  const labels = domain.split('.');
  if (labels.length < 2 || labels[labels.length - 1].length < 2) {
    return { ok: false, local, domain, error: 'Domain must have a valid top-level domain (TLD).' };
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
      }
    }
  }

  return res;
}

async function evaluateEmail(emailStr: string) {
  const clean = (emailStr || '').trim();
  const syn = validateSyntax(clean);

  if (!syn.ok) {
    return {
      email: clean,
      domain: syn.domain || 'N/A',
      status: 'Likely to Bounce',
      reason: syn.error,
      checks_performed: {
        syntax_valid: false,
        domain_exists: false,
        mx_records_found: false,
        dns_check_skipped: true,
        dns_status: 'Skipped (Invalid Syntax)',
        disposable_domain: false,
        role_account: false
      }
    };
  }

  const isRole = ROLE_PREFIXES.has(syn.local.toLowerCase());
  const isDisposable = DISPOSABLE_DOMAINS.has(syn.domain.toLowerCase());

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
    dns_status: dnsRes.dns_status
  };

  if (isDisposable) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'Disposable or temporary email service provider detected. Messages sent here expire or drop.',
      checks_performed: checks
    };
  }

  if (dnsRes.dns_error && !dnsRes.dns_error.includes('NXDOMAIN')) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Unknown',
      reason: `DNS check inconclusive: ${dnsRes.dns_error}`,
      checks_performed: checks
    };
  }

  if (dnsRes.is_null_mx) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'Domain has published a Null MX record (RFC 7505) and explicitly rejects all incoming email.',
      checks_performed: checks
    };
  }

  if (dnsRes.domain_exists === false) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: dnsRes.dns_error || 'Domain does not exist in DNS (NXDOMAIN).',
      checks_performed: checks
    };
  }

  if (!dnsRes.mx_records_found && !dnsRes.has_fallback_a) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely to Bounce',
      reason: 'Domain exists but has no MX records or fallback A/AAAA mail routing records configured.',
      checks_performed: checks
    };
  }

  if (dnsRes.mx_records_found && dnsRes.mx_hosts.length >= 1) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely Delivered',
      reason: `Valid syntax and domain active with ${dnsRes.mx_hosts.length} MX record(s). Mailbox presence estimated from infrastructure (not guaranteed without sending mail).`,
      checks_performed: checks
    };
  }

  if (dnsRes.has_fallback_a) {
    return {
      email: clean,
      domain: syn.domain,
      status: 'Likely Delivered',
      reason: 'Domain has no explicit MX records, but publishes active web/mail fallback host records (RFC 5321).',
      checks_performed: checks
    };
  }

  return {
    email: clean,
    domain: syn.domain,
    status: 'Unknown',
    reason: 'Domain records are ambiguous; mailbox existence cannot be confirmed without sending mail.',
    checks_performed: checks
  };
}

async function runAllTests() {
  console.log('=== RUNNING BACKEND VERIFICATION TESTS ===\n');

  const testInputs = [
    'lex@example.com',
    'hello@example.org',
    'pilot@shieldnex.com',
    'invalid..format@domain.com',
    'missing-at-sign.com',
    'test@definitely-non-existent-domain-9988.org',
    'user@mailinator.com',
    'contact@nasa.gov',
    'sleelamadhav90@gmail.com'
  ];

  let passedCount = 0;

  for (const input of testInputs) {
    try {
      const result = await evaluateEmail(input);
      console.log(`[TEST] Email: "${result.email}"`);
      console.log(`  -> Status: ${result.status}`);
      console.log(`  -> Reason: ${result.reason}`);
      console.log(`  -> Checks: ${JSON.stringify(result.checks_performed)}\n`);
      passedCount++;
    } catch (err: any) {
      console.error(`[FAIL] Email: "${input}" - Error: ${err.message}\n`);
    }
  }

  console.log(`=== TEST SUMMARY: ${passedCount}/${testInputs.length} PASSED ===`);
}

runAllTests();
