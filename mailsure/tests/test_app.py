"""
Unit & Integration Tests for MailSure — Email Deliverability Checker
"""

import unittest
from unittest.mock import patch
import json
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app, validate_email_syntax, evaluate_email_deliverability, MAX_BATCH_SIZE


class TestMailSureBackend(unittest.TestCase):
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
            "alex@example.com",
            "hello@example.org",
            "john.doe@subdomain.co.uk"
        ]
        for email in valid_cases:
            is_valid, local_p, domain_p, err = validate_email_syntax(email)
            self.assertTrue(is_valid, f"Failed syntax check for valid email: {email}")

        invalid_cases = [
            "",
            "plainaddress",
            "@missinglocal.com",
            "missingdomain@",
            "double@@domain.com",
            "user..double-dot@domain.com"
        ]
        for email in invalid_cases:
            is_valid, _, _, _ = validate_email_syntax(email)
            self.assertFalse(is_valid, f"Syntax validator allowed invalid email: {email}")

    @patch('app.check_dns_and_mx')
    def test_mx_record_mock_success(self, mock_dns):
        mock_dns.return_value = {
            "domain_exists": True,
            "mx_records_found": True,
            "mx_hosts": ["mail.example.com"],
            "has_fallback_a": True,
            "is_null_mx": False,
            "spf_record": True,
            "dmarc_record": True,
            "dns_error": None
        }
        res = evaluate_email_deliverability("alex@example.com")
        self.assertEqual(res["status"], "Likely Delivered")
        self.assertTrue(res["checks_performed"]["mx_records_found"])

    @patch('app.check_dns_and_mx')
    def test_nonexistent_domain_mock(self, mock_dns):
        mock_dns.return_value = {
            "domain_exists": False,
            "mx_records_found": False,
            "mx_hosts": [],
            "has_fallback_a": False,
            "is_null_mx": False,
            "spf_record": False,
            "dmarc_record": False,
            "dns_error": "Domain does not exist (NXDOMAIN)."
        }
        res = evaluate_email_deliverability("test@definitely-non-existent-domain-9988.org")
        self.assertEqual(res["status"], "Likely to Bounce")

    @patch('app.check_dns_and_mx')
    def test_dns_timeout_mock(self, mock_dns):
        mock_dns.return_value = {
            "domain_exists": True,
            "mx_records_found": False,
            "mx_hosts": [],
            "has_fallback_a": False,
            "is_null_mx": False,
            "spf_record": False,
            "dmarc_record": False,
            "dns_error": "DNS lookup timed out."
        }
        res = evaluate_email_deliverability("user@unresponsive-dns.com")
        self.assertEqual(res["status"], "Unknown")

    def test_disposable_email_detection(self):
        res = evaluate_email_deliverability("spammer@mailinator.com")
        self.assertEqual(res["status"], "Likely to Bounce")
        self.assertTrue(res["checks_performed"]["disposable_domain"])

    def test_empty_submission(self):
        response = self.client.post('/api/check', data=json.dumps({}), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_oversized_submission(self):
        large_batch = [f"user{i}@example.com" for i in range(MAX_BATCH_SIZE + 5)]
        response = self.client.post(
            '/api/check',
            data=json.dumps({"emails": large_batch}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
