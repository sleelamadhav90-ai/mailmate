# MailMate — Email Deliverability Checker

**Check first. Send smarter.**

MailMate is a professional, high-performance email deliverability and syntax verification system created for the ShieldNex Aerospace Software Development selection task.

---

## 1. Verification Checks Performed

MailMate executes a sequential 7-layer verification pipeline for every submitted email address:

1. **RFC 5322 Syntax Validation**: Validates address structure, local part (≤64 chars), domain length (≤255 chars), total length (≤254 chars), single `@` delimiter, dot placement, disallowed characters, and valid top-level domain (TLD). Malformed addresses are flagged with clear, explicit syntax error reasons.
2. **Disposable Email Filter**: Compares domain against an updated blacklist of temporary email services (Mailinator, TempMail, YopMail, 10MinuteMail, TrashMail, Dispostable, etc.) whose addresses expire or drop incoming mail.
3. **Role Account Detection**: Flags functional or team addresses (e.g., `admin@`, `support@`, `info@`, `billing@`, `jobs@`) that may not belong to a single human user.
4. **DNS Domain Resolution (A / AAAA)**: Resolves the domain name in authoritative DNS servers with strict timeout handling (3.0s) to determine if the domain actually exists on the internet (`NXDOMAIN` check).
5. **RFC 7505 Null MX Detection**: Checks if the domain explicitly publishes a Null MX record (`0 .`), indicating the domain owners explicitly refuse all incoming email.
6. **MX Record Lookup & Priority Sorting**: Queries authoritative DNS servers for Mail Exchanger (`MX`) records and sorts host records by preference priority. If no explicit MX record is found, performs RFC 5321 fallback resolution to root `A`/`AAAA` host records.
7. **SPF & DMARC Security Authentication Inspection**: Queries domain TXT records for `v=spf1` (Sender Policy Framework) and `_dmarc` (Domain-based Message Authentication, Reporting, and Conformance) to evaluate sender authentication maturity.

---

## 2. Classification Meanings & Limitations

| Classification | Meaning & Criteria | Limitations & Disclaimers |
|---|---|---|
| **Likely Delivered** | Assigned when an email passes RFC 5322 syntax validation, belongs to an active domain, and resolves active MX (or RFC 5321 fallback A/AAAA) routing records without any bounce indicators (such as Null MX or disposable provider flags). | **Does NOT guarantee final delivery or mailbox existence.** Active domain mail infrastructure proves the domain can route email, but individual mailbox existence, mailbox quotas, anti-spam filters, and user account status cannot be verified without sending an email. |
| **Likely to Bounce** | Assigned when reliable positive evidence demonstrates that the email will fail: invalid syntax, confirmed non-existent domain (`NXDOMAIN`), confirmed Null MX record (`0 .`), disposable email service provider, or absence of both MX and fallback A/AAAA records. | Synthetic or mock test emails sent to real domains without mail routing will bounce. Syntax errors are explicitly separated from domain routing errors. |
| **Unknown** | Assigned whenever available evidence is inconclusive, including DNS query timeouts, `SERVFAIL`/`REFUSED` DNS responses, network socket blocks, rate-limiting by DNS resolvers, or unexpected exceptions. | Protects users from making false assumptions. Generic DNS glitches, timeouts, or network blocks are **never** converted into `NXDOMAIN` or "Likely to Bounce". |

---

## 3. Deployment Environment & Connectivity

MailMate runs as a full-stack Node.js/Express application with Vite in containerized cloud environments, and includes a parallel Python/Flask service option.

- **DNS Connectivity (Port 53 / UDP)**: The container runtime permits outbound DNS queries over port 53 UDP. MailMate uses asynchronous non-blocking DNS resolution (`dns/promises` in Node.js, `dnspython` in Python) with a 3.0-second abort-controller timeout.
- **Outbound SMTP Connectivity (Port 25 / TCP)**: Cloud container platforms (including Google Cloud Run, AWS EC2, and Heroku) routinely block or throttle outbound TCP port 25 to prevent spam abuse. In addition, major mail receivers (Google Workspace, Microsoft 365, Fastmail) block or rate-limit unauthenticated IP addresses attempting direct port 25 socket connections.
- **Network Resilience**: MailMate is built to handle environment restrictions gracefully. If DNS resolution encounters network blocks or transient resolver failures, the application reports `Unknown` with exact error details rather than failing silently or fabricating false deliverability claims.

---

## 4. Working vs. Unavailable Checks

### Fully Operational Checks
- ✅ **RFC 5322 Syntax Inspection** (100% reliable local/client & server-side validation)
- ✅ **Disposable Email Blacklist Detection**
- ✅ **Role Address Identification**
- ✅ **Authoritative DNS Resolution & Timeout Abort**
- ✅ **RFC 7505 Null MX Detection**
- ✅ **MX Record Query & Priority Sorting**
- ✅ **RFC 5321 Fallback A/AAAA Host Lookup**
- ✅ **SPF (`v=spf1`) & DMARC (`_dmarc`) Authentication Records Query**

### Intentionally Omitted / Unavailable Checks
- ❌ **SMTP `RCPT TO` Socket Probing**: Direct SMTP mailbox handshake is omitted because cloud environments block port 25, and major mail providers block, rate-limit, or fake `250 OK` responses for unauthenticated IPs.
- ❌ **Actual Email Delivery Attempt**: MailMate never sends test emails or messages to addresses the user does not own.

---

## 5. Why Mailbox Existence Cannot Be Confirmed Without Sending Email

Many legacy verification tools claim to offer "100% Guaranteed Mailbox Existence" using SMTP `RCPT TO` socket probing without sending an email. In modern email infrastructure, **this claim is technically impossible and inaccurate** due to four industry-standard defensive measures:

1. **Catch-All Mail Server Configurations**: Millions of domain mail servers are configured as "Catch-All". They accept any local part (`anything@domain.com`) during the initial SMTP handshake (`250 OK`), but quietly discard non-existent mailboxes later or send a non-delivery report (NDR).
2. **Anti-Harvesting & False `250 OK` Responses**: Major mail providers (such as Microsoft Exchange Online, Gmail, and Yahoo) detect automated SMTP probing and intentionally return `250 OK` for every query to prevent spammers from harvesting active employee directory usernames.
3. **Graylisting & Rate Limiting**: Security gateways (Proofpoint, Mimecast, Barracuda) defer unknown connections with transient `451` errors ("Graylisting") or temporarily block IPs attempting unauthenticated socket connections.
4. **Outbound Port 25 Cloud Blocks & IP Reputation**: Modern cloud platforms strictly block outbound TCP port 25. Attempting unauthenticated socket probes from dynamic cloud IPs leads to immediate IP blacklisting (DNSBL).

> **Conclusion**: Real-world mail infrastructure can only be accurately evaluated by assessing syntax correctness, domain existence, active mail routing records (MX/A), and security policy records (SPF/DMARC). MailMate delivers honest, transparent results based on these verifiable factors without making false promises.

---

## 6. Project Architecture & Setup

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (Express + React Vite on Port 3000)
npm run dev

# 3. Run automated backend test suite
npx tsx test_backend.ts
```

### Python Flask Alternative
```bash
# Run Flask app with dnspython
python3 app.py
```

### Project Structure
```
├── server.ts              # Full-stack Node.js Express server with Async DNS Engine
├── app.py                 # Alternative Python Flask application server
├── src/
│   ├── App.tsx            # Main React 19 SPA interface with Classic Ivory/Burnt Orange design
│   ├── main.tsx           # React DOM entry point
│   └── index.css          # Global CSS with Tailwind styling rules
├── static/                # Static assets for Flask alternative (style.css, script.js)
├── templates/             # Jinja2 HTML templates for Flask alternative
├── test_backend.ts        # Backend verification test suite (9 test cases)
├── metadata.json          # Applet metadata (MailMate)
└── README.md              # Project documentation
```
