# MailMate — Email Deliverability Checker

**Check first. Send smarter.**  
*A privacy-first email deliverability and syntax assessment platform built for the ShieldNex Aerospace internship assignment.*

---

## 1. Project Overview

**MailMate** is a high-performance email list deliverability and syntax assessment system. Designed as a pre-flight hygiene and verification tool for outreach campaigns, MailMate allows users to paste up to 100 email addresses and instantly assess their deliverability without sending a single message or requiring mailbox access. By combining strict RFC 5322 syntax validation with non-blocking authoritative DNS lookups (MX records, RFC 7505 Null MX, and RFC 5321 fallback routing), MailMate categorizes addresses into four clear, trustworthy classifications so senders can protect domain reputation and prevent bounces.

---

## 2. Features

All features listed below are fully implemented and verified in the codebase:

- **Bulk Email Checking**: Accepts up to 100 email addresses per batch, separated by commas, semicolons, or line breaks. Includes one-click sample address loading and input clearing.
- **Strict RFC 5322 Syntax Validation**: Validates local part (≤64 characters), domain length (≤255 characters), total length (≤254 characters), valid characters, dot placement, and single `@` delimiter. Skips DNS queries immediately if syntax is invalid.
- **Authoritative DNS & Mail-Routing Verification**:
  - Resolves domain existence (`NXDOMAIN` detection).
  - Detects RFC 7505 Null MX records (`0 .`) indicating domains that explicitly refuse incoming email.
  - Queries authoritative Mail Exchanger (`MX`) records and sorts hosts by priority preference.
  - Inspects RFC 5321 fallback `A` and `AAAA` address routing when explicit MX records are absent.
- **Four Standardized Classifications**:
  - **Likely Deliverable**: Valid syntax, active domain, and verified mail-routing records (MX or fallback A/AAAA).
  - **Likely to Bounce**: Confirmed domain failure (`NXDOMAIN`), explicit RFC 7505 Null MX, or domain with no mail-routing hosts.
  - **Unknown**: Inconclusive results caused by DNS query timeouts, `SERVFAIL`, `REFUSED`, or network resolver limits (never falsely marked as bounces).
  - **Invalid Format**: RFC 5322 syntax errors (DNS checks bypassed).
- **Dynamic KPI Summary Cards**: Five real-time metric cards (`Total Processed`, `Likely to be delivered`, `Likely to bounce`, `Unknown`, `Invalid Format`) displaying count and percentage formatted on one line (`count — percentage%`). Calculated dynamically across the entire processed batch.
- **Interactive Filtering & Search**:
  - Click any KPI card or status pill to filter the results table; click the active card or `Total Processed` to reset.
  - Instant client-side search across email addresses, domains, and assessment reasons.
- **Detailed Inspection Modal**: Click *View details* on any row to inspect raw MX host records, priority order, fallback routing status, SPF/DMARC record presence, and role/disposable flags.
- **CSV Export**: Instant export of all evaluated addresses with standardized status labels and detailed technical reasons.

---

## 3. How It Works

MailMate uses a sequential, multi-stage evaluation pipeline to inspect each email address safely and deterministically:

1. **Syntax Validation (Pre-Filter)**:  
   The address is checked against RFC 5322 formatting standards. If the format is invalid (e.g. missing `@`, double dots, illegal characters, or length overflow), the engine immediately assigns **Invalid Format** and skips DNS queries entirely to eliminate wasteful network overhead.

2. **Domain & DNS Resolution**:  
   If syntax is valid, MailMate performs an asynchronous DNS query with a 3.0-second timeout. If the authoritative name server returns `NXDOMAIN` (domain does not exist), the email is classified as **Likely to Bounce** with a clear explanation that the domain does not exist.

3. **Mail Exchanger (MX) & Routing Lookup**:  
   - **Null MX Check (RFC 7505)**: If the domain advertises `0 .`, it explicitly does not accept mail. The address is classified as **Likely to Bounce**.
   - **MX Records**: If valid MX hosts are returned, the address is classified as **Likely Deliverable**.
   - **RFC 5321 Fallback Routing**: If no MX records are found, MailMate checks for root `A` or `AAAA` records. In accordance with email RFC standards, mail servers fall back to the domain host record when no MX record is published. If host records exist, it is classified as **Likely Deliverable**; if neither MX nor A/AAAA records exist, it is classified as **Likely to Bounce**.

4. **Resilience & Inconclusive Handling**:  
   Temporary network issues, query timeouts, `SERVFAIL`, or upstream rate limits are never flagged as bounces. Instead, they are classified as **Unknown**, protecting senders from falsely purging legitimate contacts.

5. **Heuristic Badges**:  
   Domains are checked against known disposable email providers (e.g., Mailinator, TempMail) and role-based prefixes (e.g., `support@`, `admin@`, `info@`). These are displayed as informative badges to guide sender discretion.

---

## 4. Limitations

MailMate prioritizes privacy, sender safety, and technical transparency. To ensure realistic expectations:

- **No Emails Are Sent**: MailMate operates strictly via non-intrusive DNS and RFC analysis. It never transmits test emails, SMTP `RCPT TO` handshake pings, or verification messages.
- **Individual Mailbox Existence Is Unconfirmed**: MailMate verifies that the domain and mail-routing infrastructure exist and are configured to accept mail. It cannot confirm whether a specific local mailbox (e.g. `user@`) currently exists, is full, or is disabled, because receiving mail servers frequently return false `250 OK` responses (catch-all behavior) or block port 25 probes to protect user privacy and prevent directory harvesting attacks.
- **Deliverability Is Not a Delivery Guarantee**: A status of **Likely Deliverable** indicates that all public routing prerequisites are met. Actual inbox placement also depends on sender reputation, content filtering, authentication (SPF/DKIM/DMARC alignment), and recipient mail server spam policies.

---

## 5. Tech Stack

MailMate is built across two complementary, fully functional architectures:

### Production Deployed Application (Render)
- **Backend**: Python 3, Flask 3.0.3, Gunicorn 22.0.0
- **DNS Engine**: `dnspython` 2.6.1 with socket fallback
- **Frontend**: Responsive Semantic HTML5, Vanilla JavaScript (`static/script.js`), CSS3 (`static/style.css`)
- **Testing**: Python `unittest`, `pytest`

### Modern Development Application (AI Studio / Vite)
- **Server**: Node.js, Express 4.21, TypeScript, `tsx`
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React, Motion
- **Testing**: Node.js automated HTTP and status normalization test suite (`test_backend.ts`)

---

## 6. Installation and Local Setup

### Prerequisites
- Python 3.10+ (for Flask/Python environment)
- Node.js 18+ and npm (for Node.js/React environment)

---

### Option A: Flask / Python Setup (Matches Deployed Production App)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sleelamadhav90-ai/mailmate.git
   cd mailmate
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Flask application**:
   ```bash
   # Development server (Port 5000)
   python app.py

   # Or run via Gunicorn (production configuration from Procfile)
   gunicorn app:app --bind 0.0.0.0:5000
   ```

5. Open [http://localhost:5000](http://localhost:5000) in your browser.

---

### Option B: Node.js / React Development Setup (Full-Stack Architecture)

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   # Starts Express backend and Vite React frontend on Port 3000
   npm run dev
   ```

3. **Run TypeScript type checking**:
   ```bash
   npm run lint
   ```

4. **Build the production frontend bundle**:
   ```bash
   npm run build
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Testing

This repository includes automated test suites covering syntax rules, DNS resolution mocks, live batch API responses, and KPI calculations.

### Running Python Tests
Execute the unit and integration test suite:
```bash
# Using Python's built-in unittest
python -m unittest test_app.py

# Or using pytest
pytest test_app.py
```

### Running Node.js Backend & KPI Audit Tests
Execute the full verification script (`test_backend.ts`), which runs three sequential test suites against the live API:
```bash
npx tsx test_backend.ts
```

**Test Coverage Highlights**:
- RFC 5322 syntax validation and DNS check short-circuiting.
- Confirmed RFC 7505 Null MX detection (`Likely to Bounce`).
- Non-existent domain / `NXDOMAIN` handling (`Likely to Bounce`).
- Confirmed MX record detection (`Likely Deliverable` with mailbox disclaimer).
- RFC 5321 fallback `A`/`AAAA` mail-routing resolution.
- Timeout and `SERVFAIL` classification (`Unknown`).
- Exact five-address KPI calculation audit (`Total: 5`, `Deliverable: 2`, `Bounce: 2`, `Unknown: 0`, `Invalid Format: 1`).
- Immunity of summary KPI counts against active table filtering and searching.

---

## 8. Live Demo and Repository

- **Live Demo**: [https://mailmate-qtbp.onrender.com/](https://mailmate-qtbp.onrender.com/)
- **GitHub Repository**: [https://github.com/sleelamadhav90-ai/mailmate](https://github.com/sleelamadhav90-ai/mailmate)
