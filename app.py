"""
MailMate — Email Deliverability Checker
Backend Flask Application
"""

import os
import re
import time
from typing import Dict, List, Any, Tuple
from flask import Flask, request, jsonify, render_template

try:
    import dns.resolver
    import dns.exception
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False

import socket

app = Flask(__name__, static_folder='static', template_folder='templates')

MAX_BATCH_SIZE = 100
DNS_TIMEOUT = 3.0

DISPOSABLE_DOMAINS = {
    "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
    "trashmail.com", "dispostable.com", "yopmail.com", "getnada.com",
    "throwawaymail.com", "sharklasers.com", "maildrop.cc", "temp-mail.org",
    "crazymailing.com", "binkmail.com", "safetymail.info"
}

ROLE_PREFIXES = {
    "admin", "administrator", "support", "info", "sales", "billing", "contact",
    "help", "jobs", "careers", "marketing", "postmaster", "hostmaster", "webmaster",
    "security", "privacy", "abuse", "no-reply", "noreply"
}

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

def validate_email_syntax(email: str) -> Tuple[bool, str, str, str]:
    if not email or not isinstance(email, str):
        return False, "", "", "Invalid Email Syntax: Empty or non-string email address."
    
    email = email.strip()
    if len(email) > 254:
        return False, "", "", "Invalid Email Syntax: Email address exceeds maximum length of 254 characters."
    
    parts = email.split('@')
    if len(parts) != 2:
        return False, "", "", "Invalid Email Syntax: Address must contain exactly one '@' symbol."
    
    local_part, domain_part = parts[0], parts[1].lower()
    
    if not local_part:
        return False, "", domain_part, "Invalid Email Syntax: Missing local part before '@'."
    if len(local_part) > 64:
        return False, local_part, domain_part, "Invalid Email Syntax: Local part exceeds maximum length of 64 characters."
    
    if not domain_part:
        return False, local_part, "", "Invalid Email Syntax: Missing domain part after '@'."
    if len(domain_part) > 255:
        return False, local_part, domain_part, "Invalid Email Syntax: Domain name exceeds maximum length of 255 characters."
    
    if ".." in domain_part or ".." in local_part:
        return False, local_part, domain_part, "Invalid Email Syntax: Email contains invalid consecutive dots ('..')."
    
    if not EMAIL_REGEX.match(email):
        return False, local_part, domain_part, "Invalid Email Syntax: Address does not match standard RFC 5322 syntax format."
    
    domain_labels = domain_part.split('.')
    if len(domain_labels) < 2 or len(domain_labels[-1]) < 2:
        return False, local_part, domain_part, "Invalid Email Syntax: Domain must contain a valid top-level domain (TLD)."
    
    return True, local_part, domain_part, ""


def check_dns_and_mx(domain: str) -> Dict[str, Any]:
    result = {
        "domain_exists": None,
        "mx_records_found": False,
        "mx_hosts": [],
        "has_fallback_a": False,
        "is_null_mx": False,
        "spf_record": False,
        "dmarc_record": False,
        "dns_status": "OK",
        "dns_error": None
    }
    
    if HAS_DNSPYTHON:
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT
        resolver.timeout = DNS_TIMEOUT
        
        try:
            mx_answers = resolver.resolve(domain, 'MX')
            mx_list = []
            for rdata in mx_answers:
                exchange_str = str(rdata.exchange).rstrip('.')
                if exchange_str == '' or exchange_str == '.':
                    result["is_null_mx"] = True
                else:
                    mx_list.append((rdata.preference, exchange_str))
            
            mx_list.sort(key=lambda x: x[0])
            result["mx_hosts"] = [host for pref, host in mx_list]
            result["mx_records_found"] = len(result["mx_hosts"]) > 0
            result["domain_exists"] = True
            
        except dns.resolver.NXDOMAIN:
            result["domain_exists"] = False
            result["dns_status"] = "NXDOMAIN"
            result["dns_error"] = "Domain does not exist in DNS (NXDOMAIN)."
            return result
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            result["mx_records_found"] = False
            result["domain_exists"] = True
        except dns.exception.Timeout:
            result["dns_status"] = "TIMEOUT"
            result["dns_error"] = "DNS lookup timed out."
            return result
        except Exception as e:
            result["dns_status"] = "DNS_ERROR"
            result["dns_error"] = f"DNS resolution failed: {str(e)}"
            return result
        
        if not result["mx_records_found"] and not result["is_null_mx"] and result["domain_exists"] is not False:
            try:
                a_answers = resolver.resolve(domain, 'A')
                if len(a_answers) > 0:
                    result["has_fallback_a"] = True
                    result["domain_exists"] = True
            except dns.resolver.NXDOMAIN:
                result["domain_exists"] = False
                result["dns_status"] = "NXDOMAIN"
                result["dns_error"] = "Domain does not exist in DNS (NXDOMAIN)."
            except Exception:
                try:
                    aaaa_answers = resolver.resolve(domain, 'AAAA')
                    if len(aaaa_answers) > 0:
                        result["has_fallback_a"] = True
                        result["domain_exists"] = True
                except Exception:
                    pass
        
        if result["domain_exists"]:
            try:
                txt_answers = resolver.resolve(domain, 'TXT')
                for rdata in txt_answers:
                    txt_str = "".join([b.decode('utf-8', errors='ignore') for b in rdata.strings])
                    if "v=spf1" in txt_str.lower():
                        result["spf_record"] = True
                        break
            except Exception:
                pass
            
            try:
                dmarc_answers = resolver.resolve(f"_dmarc.{domain}", 'TXT')
                for rdata in dmarc_answers:
                    txt_str = "".join([b.decode('utf-8', errors='ignore') for b in rdata.strings])
                    if "v=dmarc1" in txt_str.lower():
                        result["dmarc_record"] = True
                        break
            except Exception:
                pass

    else:
        try:
            addresses = socket.getaddrinfo(domain, 80, socket.AF_UNSPEC, socket.SOCK_STREAM)
            if addresses:
                result["domain_exists"] = True
                result["has_fallback_a"] = True
        except socket.gaierror as e:
            if e.errno == socket.EAI_NONAME or "not known" in str(e).lower():
                result["domain_exists"] = False
                result["dns_status"] = "NXDOMAIN"
                result["dns_error"] = "Domain does not exist in DNS (NXDOMAIN)."
            else:
                result["dns_status"] = "DNS_ERROR"
                result["dns_error"] = f"DNS lookup failed: {str(e)}"
        except Exception as e:
            result["dns_status"] = "DNS_ERROR"
            result["dns_error"] = f"DNS lookup error: {str(e)}"

    return result


def evaluate_email_deliverability(email: str) -> Dict[str, Any]:
    raw_email = email.strip() if email else ""
    
    syntax_ok, local_part, domain_part, syntax_error = validate_email_syntax(raw_email)
    
    if not syntax_ok:
        return {
            "email": raw_email,
            "domain": domain_part if domain_part else "N/A",
            "status": "Invalid Format",
            "reason": "Enter a valid email address containing a local part and domain.",
            "checks_performed": {
                "syntax_valid": False,
                "domain_exists": False,
                "mx_records_found": False,
                "dns_check_skipped": True,
                "dns_status": "Skipped (Invalid Syntax)",
                "disposable_domain": False,
                "role_account": False
            },
            "mailbox_verified": False
        }
    
    is_role = local_part.lower() in ROLE_PREFIXES
    is_disposable = domain_part in DISPOSABLE_DOMAINS
    
    dns_res = check_dns_and_mx(domain_part)
    
    checks_performed = {
        "syntax_valid": True,
        "domain_exists": dns_res["domain_exists"] if dns_res["domain_exists"] is not None else False,
        "mx_records_found": dns_res["mx_records_found"],
        "mx_hosts": dns_res["mx_hosts"][:3] if dns_res["mx_hosts"] else [],
        "has_fallback_a": dns_res["has_fallback_a"],
        "is_null_mx": dns_res["is_null_mx"],
        "disposable_domain": is_disposable,
        "role_account": is_role,
        "spf_record": dns_res["spf_record"],
        "dmarc_record": dns_res["dmarc_record"],
        "dns_status": dns_res["dns_status"]
    }

    if dns_res.get("dns_error") and not ("NXDOMAIN" in dns_res["dns_error"]):
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Unknown",
            "reason": f"DNS check inconclusive: {dns_res['dns_error']}",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    if dns_res["is_null_mx"]:
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Likely to Bounce",
            "reason": "This domain explicitly indicates that it does not accept email.",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    if dns_res["domain_exists"] is False:
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Likely to Bounce",
            "reason": "No DNS domain found. This address is unlikely to receive email.",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    if dns_res["mx_records_found"] and len(dns_res["mx_hosts"]) >= 1:
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Likely Deliverable",
            "reason": "Mail-routing records found. Individual mailbox existence is unconfirmed.",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    if dns_res["has_fallback_a"]:
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Likely Deliverable",
            "reason": "Domain publishes fallback mail-routing records (RFC 5321). Individual mailbox unconfirmed.",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    if dns_res["domain_exists"] is True and not dns_res["mx_records_found"] and not dns_res["has_fallback_a"]:
        return {
            "email": raw_email,
            "domain": domain_part,
            "status": "Likely to Bounce",
            "reason": "Domain exists but has no MX records or fallback mail routing (A/AAAA) configured.",
            "checks_performed": checks_performed,
            "mailbox_verified": False
        }
    
    return {
        "email": raw_email,
        "domain": domain_part,
        "status": "Unknown",
        "reason": "DNS lookup was inconclusive. Deliverability remains unknown.",
        "checks_performed": checks_performed,
        "mailbox_verified": False
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "MailMate Deliverability Checker",
        "has_dnspython": HAS_DNSPYTHON,
        "timestamp": time.time()
    }), 200


@app.route('/api/check', methods=['POST'])
def check_emails_api():
    if not request.is_json and not request.form:
        return jsonify({
            "error": "Invalid input format. Request content-type must be application/json or form-data."
        }), 400
    
    data = request.get_json(silent=True) if request.is_json else request.form
    if not data:
        return jsonify({"error": "Malformed JSON or empty request payload."}), 400
    
    raw_input = data.get("emails")
    if not raw_input:
        return jsonify({"error": "No email addresses provided in 'emails' field."}), 400
    
    email_list: List[str] = []
    if isinstance(raw_input, list):
        for item in raw_input:
            if isinstance(item, str):
                tokens = re.split(r'[\r\n,;\s]+', item)
                for t in tokens:
                    if t.strip():
                        email_list.append(t.strip())
    elif isinstance(raw_input, str):
        tokens = re.split(r'[\r\n,;\s]+', raw_input)
        for t in tokens:
            if t.strip():
                email_list.append(t.strip())
    else:
        return jsonify({"error": "Field 'emails' must be a list of strings or a multi-line string."}), 400
    
    if not email_list:
        return jsonify({"error": "No valid email strings extracted from input."}), 400
    
    if len(email_list) > MAX_BATCH_SIZE:
        return jsonify({
            "error": f"Batch size limit exceeded. Submitted {len(email_list)} emails, but maximum limit is {MAX_BATCH_SIZE} per request."
        }), 400
    
    results = []
    for email_str in email_list:
        res = evaluate_email_deliverability(email_str)
        st = (res.get("status") or "").strip().lower()
        st_clean = re.sub(r'[\s_-]+', ' ', st)
        if st_clean in ["likely deliverable", "likely delivered", "likely to be delivered", "delivered", "deliverable"]:
            res["status"] = "Likely Deliverable"
        elif st_clean in ["likely to bounce", "bounce", "bounced"]:
            res["status"] = "Likely to Bounce"
        elif st_clean in ["invalid format", "invalid", "invalid syntax"]:
            res["status"] = "Invalid Format"
        else:
            res["status"] = "Unknown"
        results.append(res)
    
    deliv_count = sum(1 for r in results if r["status"] == "Likely Deliverable")
    bounce_count = sum(1 for r in results if r["status"] == "Likely to Bounce")
    unknown_count = sum(1 for r in results if r["status"] == "Unknown")
    invalid_count = sum(1 for r in results if r["status"] == "Invalid Format")

    summary = {
        "total": len(email_list),
        "likely_deliverable": deliv_count,
        "likely_delivered": deliv_count,
        "likely_to_bounce": bounce_count,
        "unknown": unknown_count,
        "invalid_format": invalid_count
    }
    
    return jsonify({
        "total": len(email_list),
        "summary": summary,
        "results": results,
        "disclaimer": "Results are heuristic estimates based on RFC syntax, domain DNS, and MX records. Mailbox-level presence is not guaranteed without sending an email."
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
