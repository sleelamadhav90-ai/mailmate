# MailMate — Email Deliverability Checker

**Check first. Send smarter.**  
A privacy-first email syntax and deliverability assessment tool built for the ShieldNex Aerospace internship assignment.

---

## 1. Project Overview

**MailMate** is a lightweight, privacy-focused email deliverability and syntax checker. It analyzes lists of email addresses to detect potential bounces, syntax errors, and valid mail exchangers before campaigns are sent. MailMate performs non-intrusive DNS and RFC checks without sending test messages or requiring access to user mailboxes.

---

## 2. Features

- **Bulk Verification**: Assess up to 100 email addresses per batch, separated by line breaks, commas, or semicolons.
- **RFC 5322 Syntax Validation**: Validates email format and short-circuits invalid addresses before DNS queries.
- **Authoritative DNS & MX Lookups**: Resolves domain records, detects RFC 7505 Null MX (`0 .`), and checks RFC 5321 fallback A/AAAA routing.
- **Dynamic KPI Summary Cards**: Real-time counts and percentages (`count — percentage%`) calculated across all processed addresses.
- **Interactive Filtering & Search**: Filter by status card or pill button, and search results by address or reason.
- **Record Inspection Modal**: View raw MX hosts, priority rankings, SPF/DMARC indicators, and role/disposable flags.
- **CSV Export**: Download complete assessment results in one click.

---

## 3. How It Works

1. **Syntax Validation**: Validates the local part and domain against RFC 5322 specifications. Malformed addresses are immediately marked **Invalid Format** without making network requests.
2. **DNS & MX Verification**: Domains are queried with a 3-second timeout to verify existence and retrieve mail-routing records.
3. **Result Classifications**:
   - **Likely Deliverable**: Valid syntax with confirmed mail-routing records (MX or fallback A/AAAA).
   - **Likely to Bounce**: Confirmed `NXDOMAIN` (domain does not exist), explicit Null MX (`0 .`), or missing mail routing.
   - **Unknown**: Inconclusive results due to DNS timeouts or server errors (`SERVFAIL`). Never falsely marked as bounces.
   - **Invalid Format**: Failed RFC 5322 syntax validation.
4. **Privacy-First Design**: No emails are sent, and individual mailbox existence is unconfirmed (avoiding catch-all traps and port 25 blocking).

---

## 4. Tech Stack

Technologies used in the deployed application:

- **Backend**: Python 3, Flask 3.0.3, Gunicorn 22.0.0
- **DNS Resolution**: `dnspython` 2.6.1
- **Frontend**: Semantic HTML5, Vanilla JavaScript (`static/script.js`), CSS3 (`static/style.css`)
- **Testing**: `pytest` 8.1.1, `unittest`
- **Deployment**: Render

---

## 5. Installation & Run

### Prerequisites
- Python 3.10+ and `pip`

### Local Setup
```bash
# Clone the repository
git clone https://github.com/sleelamadhav90-ai/mailmate.git
cd mailmate

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the application
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

### Run Tests
```bash
pytest test_app.py
```

---

## 6. Live Demo & Repository

- **Live Demo**: [https://mailmate-qtbp.onrender.com/](https://mailmate-qtbp.onrender.com/)
- **GitHub Repository**: [https://github.com/sleelamadhav90-ai/mailmate](https://github.com/sleelamadhav90-ai/mailmate)
