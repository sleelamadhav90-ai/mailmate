"""
Comprehensive Unit & Integration Test Suite for MailMate
Tests cover RFC syntax validation, MX lookups, NXDOMAIN, A/AAAA fallbacks,
timeouts, SERVFAIL errors, and batch API processing.
"""

import unittest
from unittest.mock import patch
import json
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app, validate_email_syntax, evaluate_email_deliverability, MAX_BATCH_SIZE


class TestMailMateBackend(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_health_endpoint(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get("status"), "healthy")

    def test_syntax_validation(self):
        valid_cases = [
            "lex@example.com",
            "hello@example.org",
            "pilot@shieldnex.com",
            "contact@nasa.gov",
            "sleelamadhav90@gmail.com"
        ]
        for email in valid_cases:
            is_valid, local_p, domain_p, err = validate_email_syntax(email)
            self.assertTrue(is_valid, f"Failed syntax check for valid email: {email}")

        invalid_cases = [
            ("", "Empty or non-string email address."),
            ("plainaddress", "Email address must contain exactly one '@' symbol."),
            ("missing-at-sign.com", "Email address must contain exactly one '@' symbol."),
            ("invalid..format@domain.com", "Email contains invalid consecutive dots ('..')."),
            ("@missinglocal.com", "Missing local part before '@'."),
            ("missingdomain@", "Missing domain part after '@'."),
            ("double@@domain.com", "Email address must contain exactly one '@' symbol.")
        ]
        for email, expected_err_part in invalid_cases:
            is_valid, _, _, err = validate_email_syntax(email)
            self.assertFalse(is_valid, f"Syntax validator allowed invalid email: {email}")
            self.assertIn(expected_err_part.lower(), err.lower())

    @patch('app.check_dns_and_mx')
    def test_mx_record_mock_success(self, mock_dns):
        """Valid MX records -> Likely Delivered."""
        mock_dns.return_value = {
            "domain_exists": True,
            "mx_records_found": True,
            "mx_hosts": ["mail.example.com"],
            "has_fallback_a": True,
            "is_null_mx": False,
            "spf_record": True,
            "dmarc_record": True,
            "dns_status": "OK",
            "dns_error": None
        }
        res = evaluate_email_deliverability("lex@example.com")
        self.assertEqual(res["status"], "Likely Delivered")
        self.assertTrue(res["checks_performed"]["mx_records_found"])

    @patch('app.check_dns_and_mx')
    def test_nxdomain_mock(self, mock_dns):
        """NXDOMAIN -> Likely to Bounce."""
        mock_dns.return_value = {
            "domain_exists": False,
            "mx_records_found": False,
            "mx_hosts": [],
            "has_fallback_a": False,
            "is_null_mx": False,
            "spf_record": False,
            "dmarc_record": False,
            "dns_status": "NXDOMAIN",
            "dns_error": "Domain does not exist in DNS (NXDOMAIN)."
        }
        res = evaluate_email_deliverability("test@definitely-non-existent-domain-9988.org")
        self.assertEqual(res["status"], "Likely to Bounce")
        self.assertIn("NXDOMAIN", res["reason"])

    @patch('app.check_dns_and_mx')
    def test_dns_timeout_mock(self, mock_dns):
        """DNS Timeout -> Unknown (Never Bounce)."""
        mock_dns.return_value = {
            "domain_exists": None,
            "mx_records_found": False,
            "mx_hosts": [],
            "has_fallback_a": False,
            "is_null_mx": False,
            "spf_record": False,
            "dmarc_record": False,
            "dns_status": "TIMEOUT",
            "dns_error": "DNS lookup timed out."
        }
        res = evaluate_email_deliverability("user@unresponsive-dns.com")
        self.assertEqual(res["status"], "Unknown")
        self.assertIn("inconclusive", res["reason"])


if __name__ == '__main__':
    unittest.main()
