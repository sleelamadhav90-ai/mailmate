# MailSure — Email Deliverability Checker

**ShieldNex Aerospace — Software Development Internship Selection Task**

MailSure is a professional, high-performance email deliverability and syntax verification system built for **ShieldNex Aerospace**. It enables users to perform batch inspections on email addresses, evaluating syntax compliance, domain existence, DNS Mail Exchanger (MX) record availability, disposable provider detection, and security authentication records (SPF & DMARC).

---

## 1. Project Overview & Problem Statement

### Problem Statement
In aerospace engineering, defense logistics, and corporate operations, automated communication systems face deliverability failures when handling unverified email lists. Invalid email addresses increase bounce rates, damage domain sender reputation, and cause mission-critical alerts to fail.

However, **traditional email verification tools often mislead users** by labeling an address "100% Verified" simply because its domain has an MX record. In reality, a domain's MX record only proves that a mail server is configured to accept mail for that domain—it **does not prove that an individual mailbox exists**.

### Objective & Core Principles
MailSure solves this problem by providing **honest, evidence-based deliverability classification**:
- **Likely Delivered**: Only assigned when strong positive infrastructure evidence exists (valid RFC syntax, active DNS domain, verified MX records, and published SPF/DMARC records) without any bounce indicators.
- **Likely to Bounce**: Assigned when reliable checks indicate a definitive delivery failure (invalid syntax, nonexistent domain, Null MX records, disposable email domains, or lack of mail routing records).
- **Unknown**: Assigned when deliverability or mailbox existence cannot be established with certainty (DNS timeouts, network ambiguity, server errors, or standard domains where mailbox-level verification is unavailable without sending an email).

> **Core Guarantee:** MailSure never sends spam or test emails, never conducts invasive SMTP `RCPT TO` probing against third-party servers, and never falsely claims that a mailbox is guaranteed to exist without absolute evidence.

---

## 2. Key Features

- **Batch Processing**: Input multiple email addresses separated by newlines, commas, or semicolons (up to 100 emails per batch).
- **RFC 5322 Syntax Inspection**: Checks local part length (<= 64 chars), domain length (<= 255 chars), total length (<= 254 chars), consecutive dots, TLD validity, and disallowed characters.
- **DNS & MX Record Lookup**: Queries authoritative DNS servers for MX records with priority sorting. Supports RFC 5.1 fallback to A/AAAA records for domains without explicit MX records.
- **RFC 7505 Null MX Detection**: Identifies domains that explicitly decline incoming email (`0 .`).
- **Disposable Domain Blacklist Filter**: Automatically flags temporary email providers (e.g., Mailinator, TempMail, TrashMail) that drop incoming mail.
- **Role Account Flagging**: Identifies functional addresses (e.g., `admin@`, `support@`, `info@`, `billing@`).
- **SPF & DMARC Authentication Checks**: Queries DNS `TXT` records for `v=spf1` and `_dmarc` to assess domain mail security maturity.
- **Aerospace & Cybersecurity UI**: High-contrast, responsive interface inspired by aerospace telemetry systems, featuring deep navy palette, real-time batch counter, filterable results table, summary KPI cards, and CSV report export.
- **RESTful API & Health Check**: Includes `/api/check` POST endpoint and `/health` monitoring endpoint.
- **Automated Unit & Integration Test Suite**: Mocked DNS test suite ensuring 100% test independence from live network environments.

---

## 3. Technology Stack

- **Backend Framework**: Python 3.10+ with Flask (WSGI)
- **DNS Resolver Engine**: `dnspython` (with standard library `socket` fallback)
- **Production Application Server**: Gunicorn
- **Frontend Interface**: HTML5, CSS3 (Tailwind CSS styling), Vanilla JavaScript (ES6+)
- **Icons & Typography**: Lucide Icons, Plus Jakarta Sans, JetBrains Mono
- **Testing Framework**: Python `unittest` & `pytest` with `unittest.mock`

---

## 4. How Classification Logic Works

MailSure executes a sequential, multi-stage evaluation pipeline for every submitted address:

```
[ Input Email ]
       │
       ▼
 [ 1. RFC 5322 Syntax Check ] ── (Invalid Syntax) ──────────────► [ Likely to Bounce ]
       │ (Valid)
       ▼
 [ 2. Disposable Domain Check ] ── (Matches Blacklist) ─────────► [ Likely to Bounce ]
       │ (Clean)
       ▼
 [ 3. DNS Domain & MX Lookup ] ── (NXDOMAIN / Null MX / No Routing) ─► [ Likely to Bounce ]
       │
       ├── (DNS Timeout / Server Failure) ─────────────────────► [ Unknown ]
       │
       ▼ (MX Records Active)
 [ 4. Infrastructure & Security Check (SPF / DMARC) ]
       │
       ├── (MX Verified + SPF/DMARC Active) ───────────────────► [ Likely Delivered ]
       └── (Insufficient Evidence) ─────────────────────────────► [ Unknown ]
```

### Classification Status Definitions

| Status | Badge | Criteria & Rationale |
| :--- | :--- | :--- |
| **Likely Delivered** | `● Likely Delivered` | Valid RFC syntax + domain resolves + active MX records verified + published SPF/DMARC records + no bounce indicators. *(Note: Mailbox presence is estimated from domain infrastructure).* |
| **Likely to Bounce** | `✖ Likely to Bounce` | Invalid email format, domain does not exist (`NXDOMAIN`), domain published Null MX (`0 .`), domain lacks MX & A/AAAA mail routing records, or disposable email service detected. |
| **Unknown** | `▲ Unknown` | DNS lookup timed out, temporary network failure occurred, or domain has valid MX records but mailbox existence cannot be confirmed without sending an actual email. |

---

## 5. Limitations of Email Verification

It is technically impossible to guarantee 100% mailbox presence without sending a real email. Understanding these technical limitations is essential:

1. **MX Records Do Not Prove Mailbox Existence**: An MX record indicates that a server is listening for emails addressed to that domain. It does not disclose whether a specific username (e.g. `john.doe@domain.com`) exists on that server.
2. **Catch-All Mail Servers**: Many corporate domains configure "Catch-All" rules where the mail server accepts messages for *any* address under the domain, even non-existent ones, discarding invalid ones internally after receipt.
3. **SMTP Probing Restrictions**: In the past, tools attempted SMTP `RCPT TO` commands to probe mailboxes. Today, major providers (Google Workspace, Microsoft 365, Proofpoint, Mimecast) block, rate-limit, or fake `250 OK` responses to prevent dictionary attacks. MailSure intentionally avoids SMTP probing to prevent IP blacklisting and maintain ethical compliance.
4. **Disposable Service Evolution**: Temporary email services constantly generate new domain names. MailSure updates its disposable list regularly, but newly registered temporary domains may initially return `Unknown`.

---

## 6. Local Setup Instructions (Windows)

Follow these step-by-step instructions to run MailSure locally on Windows.

### Prerequisites
- Windows 10 / 11
- Python 3.10 or higher ([Download Python](https://www.python.org/downloads/))
- Git ([Download Git](https://git-scm.com/))

### Step 1: Open Terminal / Command Prompt
Press `Win + R`, type `cmd` (or open PowerShell), and navigate to your working directory:
```cmd
cd C:\Projects
```

### Step 2: Clone Repository (or create folder)
```cmd
git clone https://github.com/your-username/mailsure.git
cd mailsure
```

### Step 3: Create and Activate Virtual Environment
```cmd
python -m venv venv
venv\Scripts\activate
```
*(You should see `(venv)` prefix in your terminal prompt).*

### Step 4: Install Dependencies
```cmd
pip install -r requirements.txt
```

### Step 5: Run the Flask Application
```cmd
python app.py
```

Output:
```
 * Serving Flask app 'app'
 * Debug mode: off
 * Running on http://127.0.0.1:5000
```

Open your browser and navigate to **`http://127.0.0.1:5000`**.

---

## 7. Running Tests

MailSure includes comprehensive unit tests with mocked DNS lookups. To run the test suite:

### Using Python Standard Unittest:
```cmd
python test_app.py
```

### Using Pytest:
```cmd
pytest -v test_app.py
```

Expected Output:
```
test_api_response_structure (test_app.TestMailSureBackend) ... ok
test_disposable_email_detection (test_app.TestMailSureBackend) ... ok
test_dns_timeout_mock (test_app.TestMailSureBackend) ... ok
test_empty_submission (test_app.TestMailSureBackend) ... ok
test_health_endpoint (test_app.TestMailSureBackend) ... ok
test_mx_record_mock_success (test_app.TestMailSureBackend) ... ok
test_nonexistent_domain_mock (test_app.TestMailSureBackend) ... ok
test_oversized_submission (test_app.TestMailSureBackend) ... ok
test_syntax_validation (test_app.TestMailSureBackend) ... ok

----------------------------------------------------------------------
Ran 9 tests in 0.124s

OK
```

---

## 8. API Documentation

### 1. Health Check Endpoint
- **URL**: `/health`
- **Method**: `GET`
- **Response Example**:
```json
{
  "has_dnspython": true,
  "service": "MailSure Deliverability Checker",
  "status": "healthy",
  "timestamp": 1740000000.0
}
```

### 2. Batch Email Check Endpoint
- **URL**: `/api/check`
- **Method**: `POST`
- **Header**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "emails": [
    "pilot@shieldnex.com",
    "invalid..email@domain.com",
    "spammer@mailinator.com",
    "test@non-existent-domain-99.org"
  ]
}
```

- **Response Body**:
```json
{
  "total": 4,
  "summary": {
    "total": 4,
    "likely_delivered": 1,
    "likely_to_bounce": 3,
    "unknown": 0
  },
  "results": [
    {
      "email": "pilot@shieldnex.com",
      "domain": "shieldnex.com",
      "status": "Likely Delivered",
      "reason": "Valid syntax, domain active with 2 MX record(s) and SPF authentication. Mailbox existence estimated from domain infrastructure.",
      "checks_performed": {
        "syntax_valid": true,
        "domain_exists": true,
        "mx_records_found": true,
        "mx_hosts": ["mail1.shieldnex.com", "mail2.shieldnex.com"],
        "has_fallback_a": true,
        "is_null_mx": false,
        "disposable_domain": false,
        "role_account": false,
        "spf_record": true,
        "dmarc_record": true
      },
      "mailbox_verified": false
    },
    {
      "email": "invalid..email@domain.com",
      "domain": "domain.com",
      "status": "Likely to Bounce",
      "reason": "Email contains invalid consecutive dots ('..').",
      "checks_performed": {
        "syntax_valid": false,
        "domain_exists": false,
        "mx_records_found": false,
        "disposable_domain": false,
        "role_account": false
      },
      "mailbox_verified": false
    }
  ],
  "disclaimer": "Results are heuristic estimates based on RFC syntax, domain DNS, and MX records. Mailbox-level presence is not guaranteed without sending an email."
}
```

---

## 9. GitHub Upload & Cloud Deployment Instructions

### Step 1: Push Project to GitHub
```cmd
git init
git add .
git commit -m "Initial commit: MailSure Email Deliverability Checker"
git branch -M main
git remote add origin https://github.com/your-username/mailsure.git
git push -u origin main
```

### Step 2: Deploy to Render (Free Cloud Hosting)
1. Sign up for a free account at [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository `mailsure`.
4. Configure service settings:
   - **Name**: `mailsure-checker`
   - **Environment**: `Python 3`
   - **Region**: Oregon (US West) or Frankfurt (EU)
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
5. Click **Create Web Service**.
6. Once deployed, Render will provide your public URL (e.g. `https://mailsure-checker.onrender.com`).

### Hosting & Network Considerations
- **Cold Starts**: Render free instances sleep after 15 minutes of inactivity. The first request after sleep may take 30-50 seconds to warm up.
- **Outbound DNS (Port 53)**: Free hosting environments permit standard DNS UDP/TCP port 53 queries. If DNS queries fail in certain cloud environments, `app.py` falls back gracefully to standard library `socket.getaddrinfo`.

---

## 10. Privacy & Security

- **Data Retention**: MailSure does not store, log, or database submitted email addresses. All evaluations occur purely in memory.
- **XSS Mitigation**: All email addresses rendered in the browser UI are sanitized with HTML entity escaping (`escapeHtml()`) to prevent Script Injection attacks.
- **Input Limits**: The API enforces a strict `100` email limit per request to prevent Denial of Service (DoS) and DNS amplification abuse.

---

## 11. Project Directory Structure

```
mailsure/
├── app.py              # Main Flask Backend API & Verification Logic
├── requirements.txt    # Production Python Dependencies
├── Procfile            # Deployment Gunicorn Command
├── README.md           # Documentation & Internship Report
├── test_app.py         # Pytest / Unittest Suite (Mocked DNS)
├── .gitignore          # Git Exclusion Patterns
├── templates/
│   └── index.html      # Responsive Aerospace UI Layout
└── static/
    ├── style.css       # Tailwind & Aerospace Theme Styling
    └── script.js       # Client-side Batch Input, Filters & CSV Exporter
```

---

*Built with precision for ShieldNex Aerospace Software Internship Selection Task.*
