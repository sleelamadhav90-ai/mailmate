import http from 'http';

interface TestCase {
  email: string;
  expectedStatus: string;
  expectedReasonSubstring?: string;
  checkFn?: (result: any) => boolean;
}

async function testBackend() {
  console.log('=== RUNNING MAILMATE BACKEND CLASSIFICATION AUDIT TESTS ===\n');

  const testCases: TestCase[] = [
    {
      email: 'invalid..format@domain.com',
      expectedStatus: 'Invalid Format',
      expectedReasonSubstring: 'valid email address',
      checkFn: (r) => r.checks_performed?.dns_check_skipped === true
    },
    {
      email: 'missing-at-sign.com',
      expectedStatus: 'Invalid Format',
      expectedReasonSubstring: 'valid email address',
      checkFn: (r) => r.checks_performed?.dns_check_skipped === true
    },
    {
      email: 'lex@example.com',
      expectedStatus: 'Likely to Bounce',
      expectedReasonSubstring: 'does not accept email',
      checkFn: (r) => r.checks_performed?.is_null_mx === true
    },
    {
      email: 'hello@example.org',
      expectedStatus: 'Likely to Bounce',
      expectedReasonSubstring: 'does not accept email',
      checkFn: (r) => r.checks_performed?.is_null_mx === true
    },
    {
      email: 'test@definitely-non-existent-domain-9988.org',
      expectedStatus: 'Likely to Bounce',
      expectedReasonSubstring: 'No DNS domain found',
      checkFn: (r) => r.checks_performed?.domain_exists === false
    },
    {
      email: 'user@mailinator.com',
      expectedStatus: 'Likely Deliverable',
      checkFn: (r) => r.checks_performed?.disposable_domain === true && r.checks_performed?.mx_records_found === true
    },
    {
      email: 'contact@nasa.gov',
      expectedStatus: 'Likely Deliverable',
      expectedReasonSubstring: 'Individual mailbox existence is unconfirmed',
      checkFn: (r) => r.checks_performed?.mx_records_found === true
    },
    {
      email: 'sleelamadhav90@gmail.com',
      expectedStatus: 'Likely Deliverable',
      expectedReasonSubstring: 'Individual mailbox existence is unconfirmed',
      checkFn: (r) => r.checks_performed?.mx_records_found === true
    },
    {
      email: 'pilot@shieldnex.com',
      expectedStatus: 'Likely Deliverable',
      expectedReasonSubstring: 'fallback mail-routing records',
      checkFn: (r) => r.checks_performed?.has_fallback_a === true
    }
  ];

  const testEmails = testCases.map(tc => tc.email);
  const postData = JSON.stringify({ emails: testEmails });

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/check',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(`API Total Batch Size: ${json.total}`);
        let totalPassed = 0;
        let totalFailed = 0;

        json.results.forEach((r: any, idx: number) => {
          const tc = testCases[idx];
          let statusMatches = r.status === tc.expectedStatus;
          let reasonMatches = tc.expectedReasonSubstring ? (r.reason || '').includes(tc.expectedReasonSubstring) : true;
          let customMatches = tc.checkFn ? tc.checkFn(r) : true;

          const passed = statusMatches && reasonMatches && customMatches;

          if (passed) {
            totalPassed++;
            console.log(`✅ [PASS] Email: "${r.email}"`);
            console.log(`    Status: "${r.status}" (Expected: "${tc.expectedStatus}")`);
            console.log(`    Reason: "${r.reason}"`);
          } else {
            totalFailed++;
            console.log(`❌ [FAIL] Email: "${r.email}"`);
            console.log(`    Received Status: "${r.status}" | Expected Status: "${tc.expectedStatus}"`);
            console.log(`    Received Reason: "${r.reason}" | Expected Substring: "${tc.expectedReasonSubstring}"`);
          }
          console.log('');
        });

        console.log(`=== SUMMARY: ${totalPassed}/${testCases.length} PASSED, ${totalFailed} FAILED ===`);

        console.log('\n--- VERIFYING SUMMARY / KPI METRICS ---');
        const summary = json.summary || {};
        console.log(`Total Processed: ${summary.total} (Expected: ${testCases.length})`);
        console.log(`Likely Deliverable: ${summary.likely_deliverable}`);
        console.log(`Likely to Bounce: ${summary.likely_to_bounce}`);
        console.log(`Unknown: ${summary.unknown}`);
        console.log(`Invalid Format: ${summary.invalid_format}`);

        const sumCategoryCounts = (summary.likely_deliverable || 0) + (summary.likely_to_bounce || 0) + (summary.unknown || 0) + (summary.invalid_format || 0);
        if (summary.total === testCases.length && sumCategoryCounts === testCases.length) {
          console.log('✅ [PASS] Summary KPI categories sum up to 100% of processed addresses.');
        } else {
          console.log(`❌ [FAIL] Summary KPI mismatch: sum is ${sumCategoryCounts}, expected ${testCases.length}`);
        }
      } catch (e: any) {
        console.error('Failed to parse API response:', e);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with HTTP request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

testBackend();

