# MailMate — Email Deliverability Checker

**Check first. Send smarter.**

MailMate is an editorial, high-performance email deliverability and syntax assessment system built with Node.js/Express, React 19, TypeScript, and Tailwind CSS. It analyzes email lists without sending messages or accessing user mailboxes, providing clear, trustworthy deliverability assessments grounded in RFC standards and real DNS records.

---

## 1. Core Status Classifications

MailMate standardizes all email evaluations into four distinct, unambiguous status classifications:

| Status Label | Meaning & Assessment Criteria | Technical Guardrails & Guarantees |
|---|---|---|
| **Likely Deliverable** | Assigned when an email passes RFC 5322 syntax validation, resolves an existing domain, and publishes active mail-routing records (authoritative `MX` records or RFC 5321 fallback `A`/`AAAA` host records). | **Does not confirm actual mailbox existence.** Clearly indicates that mail routing is configured, while acknowledging individual mailbox presence and spam-filtering decisions require sending email. |
| **Likely to Bounce** | Assigned when positive, verifiable evidence demonstrates delivery failure: confirmed non-existent domain (`NXDOMAIN`), confirmed RFC 7505 Null MX record (`0 .`), or an active domain with neither MX records nor fallback `A`/`AAAA` routing. | Never assigned based on speculation or network hiccups. Confirmed domain failures and Null MX records are strictly separated from syntax errors. |
| **Unknown** | Assigned whenever verification evidence is inconclusive: DNS query timeouts, `SERVFAIL`, `REFUSED`, network resolver limits, or blocked queries. | Protects users from false assumptions. DNS timeouts and temporary server errors are **never** converted into bounces or deliverability claims. |
| **Invalid Format** | Assigned immediately when an address violates RFC 5322 syntax specifications (e.g. missing `@`, consecutive dots, invalid local/domain lengths, malformed TLDs). | **DNS checks are completely skipped** for invalid formats, preventing unnecessary network queries and ensuring immediate, deterministic responses. |

---

## 2. Interactive KPI & Summary Cards

MailMate provides five dynamic metric cards at the top of the assessment results:

- **Total Processed**: Total addresses evaluated in the batch (`count — percentage%`, e.g., `10 — 100%`). Clicking resets active filters to show all results.
- **Likely to be delivered**: Addresses with verified mail-routing records (`count — percentage%`, e.g., `4 — 40%`). Clicking filters the table to deliverable addresses.
- **Likely to bounce**: Addresses confirmed to fail due to NXDOMAIN, Null MX, or missing routing (`count — percentage%`, e.g., `3 — 30%`). Clicking filters to potential bounces.
- **Unknown**: Addresses with inconclusive DNS checks or timeouts (`count — percentage%`, e.g., `0 — 0%`). Clicking filters to uncertain results.
- **Invalid Format**: Addresses failing RFC 5322 syntax rules (`count — percentage%`, e.g., `3 — 30%`). Clicking filters to invalid syntax entries.

### Key Formatting & Behavior Features:
- **Single-Line Formatting**: Numbers and percentages are displayed on one line with an em dash separator (`count — percentage%`), avoiding cramped concatenation.
- **Dynamic Calculations**: Percentages are calculated using the total processed batch size as denominator (`(count / total) * 100`), safely handling empty states without division-by-zero errors.
- **Interactive Filtering & Active State Highlighting**: Clicking any card filters the results table; clicking the active card or Total Processed resets the filter to show all. Active filters feature colored borders, rings, and an explicit state badge (`Active filter (click to reset)` vs `Click to filter`).

---

## 3. Verification Pipeline & Architecture

MailMate executes a sequential multi-stage verification pipeline for every submitted email address:

1. **RFC 5322 Syntax Inspection**: Validates local part (≤64 characters), domain length (≤255 characters), total length (≤254 characters), single `@` delimiter, dot placement, consecutive dots, and top-level domain validity. If invalid, the check returns `Invalid Format` and bypasses network queries.
2. **Authoritative DNS Resolution**: Queries domain existence with an asynchronous non-blocking resolver and a 3.0-second abort controller. Differentiates `NXDOMAIN` (domain non-existent) from transient DNS timeouts or `SERVFAIL`.
3. **RFC 7505 Null MX Detection**: Checks if the domain publishes a Null MX record (`0 .`), indicating the domain owner explicitly refuses all incoming email.
4. **MX Record Lookup & Priority Sorting**: Queries authoritative DNS servers for Mail Exchanger (`MX`) records and sorts host records by preference priority.
5. **RFC 5321 Fallback Mail Routing**: If no explicit MX record is found, checks for root `A` and `AAAA` host records as permitted by RFC 5321 mail-routing fallback rules.
6. **Role Account Detection**: Flags functional and department addresses (e.g., `support@`, `info@`, `admin@`, `billing@`) as an informational badge without forcing an artificial bounce status.
7. **Disposable Provider Identification**: Identifies known temporary email domains (Mailinator, TempMail, YopMail, etc.) with an informative badge while respecting true mail-routing status.
8. **SPF & DMARC Authentication Inspection**: Queries domain TXT records for `v=spf1` (Sender Policy Framework) and `_dmarc` (Domain-based Message Authentication, Reporting, and Conformance) records.

---

## 4. Why Mailbox Existence Cannot Be Verified Without Sending Mail

MailMate adheres to modern email engineering realities and does not make misleading claims:

1. **Catch-All Servers**: Millions of mail servers accept all incoming addresses during SMTP handshakes (`250 OK`), only to silently discard non-existent mailboxes later.
2. **Anti-Harvesting Defense**: Major providers (Google Workspace, Microsoft 365, Yahoo) return false `250 OK` responses to unauthenticated SMTP `RCPT TO` probes to prevent directory harvesting.
3. **Cloud Port 25 Restrictions**: Modern cloud runtimes block outbound TCP port 25 to prevent spam. Attempting direct socket probes from dynamic cloud IPs triggers immediate blacklisting (DNSBL).
4. **Privacy-First Guarantee**: MailMate checks deliverability heuristics via public DNS and RFC syntax without sending unsolicited test messages or accessing recipient mailboxes.

---

## 5. UI & Design System

The MailMate interface follows a minimal, warm editorial SaaS aesthetic:

- **Color Palette**:
  - Warm Ivory Canvas: `#F6F3EB` / `#FAF7F0`
  - Inset Panels: `#EFECE4` with borders `#D9D0C1`
  - Primary Text: `#1F1C18` / `#262522`
  - Secondary Text: `#787167` / `#77736D`
  - Golden Accents & Primary CTA: `#C6A87C`, `#B88A4C`, gradient `#7A4B1B` → `#593410`
  - Status Indicators: Soft Green (`#2B5C40` / `#D4EAD9`), Soft Red (`#902A24` / `#FADBD8`), Amber (`#855B21` / `#FEFAF0`), Neutral Gray (`#4A4742` / `#EFECE6`)
- **Typography**:
  - Headings: `DM Serif Display`
  - Interface & Body: `Inter`
  - Code & Email Tokens: `JetBrains Mono`
- **Results Table & Badges**:
  - Clean separated check pills with non-breaking whitespace (`Syntax · Valid`, `DNS · Resolved`, `MX · Found`, `Role Address`).
  - Search filter by email address, domain, or reason.
  - One-click CSV export with standardized status labels and assessment reasons.
  - Detailed inspection modal for viewing raw DNS and MX record priority details.

---

## 6. Project Structure

```
├── server.ts              # Full-stack Node.js Express server with DNS engine & Vite middleware
├── app.py                 # Alternative Python Flask application with dnspython
├── src/
│   ├── App.tsx            # Main React 19 application with 5 KPI cards & results interface
│   ├── main.tsx           # React DOM client entry point
│   └── index.css          # Tailwind CSS stylesheet
├── static/                # Static assets for HTML/Flask template (style.css, script.js)
├── templates/             # HTML templates with matching 5 KPI cards and filter controls
├── test_backend.ts        # Automated verification test suite (9 classification tests + KPI checks)
├── metadata.json          # Applet metadata configuration
└── README.md              # Project documentation
```

---

## 7. Running & Testing

### Development Server
```bash
# Start full-stack Node.js Express + React Vite server (Port 3000)
npm run dev
```

### Automated Backend Test Suite
```bash
# Execute classification audit and KPI verification tests
npx tsx test_backend.ts
```

Test suite verifies:
- Invalid format short-circuiting (bypassing DNS)
- Confirmed RFC 7505 Null MX handling (`Likely to Bounce`)
- Non-existent domain / NXDOMAIN handling (`Likely to Bounce`)
- MX record detection (`Likely Deliverable` with mailbox disclaimer)
- Fallback `A`/`AAAA` routing (RFC 5321)
- Disposable domain flag separation from routing validity
- 5-card KPI summary count and percentage calculation consistency
