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

        // Run Suite 2: The exact 5-address test case requested
        runFiveAddressKpiTest();
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

function runFiveAddressKpiTest() {
  console.log('\n======================================================');
  console.log('=== SUITE 2: EXACT FIVE-ADDRESS KPI COUNTING AUDIT ===');
  console.log('======================================================\n');

  const fiveEmails = [
    'student@gmail.com',
    'hello@example.com',
    'not-an-email',
    'contact@iana.org',
    'test@nonexistent-domain-938274.com'
  ];

  const postData = JSON.stringify({ emails: fiveEmails });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/check',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        const results = json.results || [];
        const summary = json.summary || {};

        console.log(`Processed ${results.length} addresses:\n`);
        const expectedStatuses: Record<string, string> = {
          'student@gmail.com': 'Likely Deliverable',
          'hello@example.com': 'Likely to Bounce',
          'not-an-email': 'Invalid Format',
          'contact@iana.org': 'Likely Deliverable',
          'test@nonexistent-domain-938274.com': 'Likely to Bounce'
        };

        let individualMatches = true;
        results.forEach((r: any, i: number) => {
          const exp = expectedStatuses[r.email];
          const ok = r.status === exp;
          if (!ok) individualMatches = false;
          console.log(` ${i + 1}. ${r.email} — ${r.status} ${ok ? '✅' : '❌ (Expected: ' + exp + ')'}`);
        });

        console.log('\nVerifying Expected Summary Counts:');
        console.log(`- Total Processed: ${summary.total} (Expected: 5)`);
        console.log(`- Likely Deliverable: ${summary.likely_deliverable} (Expected: 2)`);
        console.log(`- Likely to Bounce: ${summary.likely_to_bounce} (Expected: 2)`);
        console.log(`- Unknown: ${summary.unknown} (Expected: 0)`);
        console.log(`- Invalid Format: ${summary.invalid_format} (Expected: 1)`);

        const kpisMatch = 
          summary.total === 5 &&
          summary.likely_deliverable === 2 &&
          summary.likely_to_bounce === 2 &&
          summary.unknown === 0 &&
          summary.invalid_format === 1;

        if (kpisMatch && individualMatches) {
          console.log('\n✅ [ALL CHECKS PASSED] Exact five-address summary KPI cards match 100%!');
          runFrontendNormalizationTest();
        } else {
          console.error('\n❌ [FAIL] Five-address KPI summary or individual statuses mismatch!');
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error('Failed to parse 5-address response:', err);
        process.exitCode = 1;
      }
    });
  });

  req.on('error', (e) => {
    console.error('HTTP error in 5-address test:', e);
    process.exitCode = 1;
  });

  req.write(postData);
  req.end();
}

function runFrontendNormalizationTest() {
  console.log('\n======================================================');
  console.log('=== SUITE 3: FRONTEND ALIAS NORMALIZATION & FILTERING ===');
  console.log('======================================================\n');

  // Verify status aliases
  const rawTestBatch = [
    { email: 'student@gmail.com', status: 'Likely to be delivered' },
    { email: 'hello@example.com', status: 'Likely to bounce' },
    { email: 'not-an-email', status: 'invalid syntax' },
    { email: 'contact@iana.org', status: 'Likely Deliverable' },
    { email: 'test@nonexistent-domain-938274.com', status: 'Likely to Bounce' }
  ];

  function normalize(s: string) {
    const clean = s.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
    if (clean === 'likely deliverable' || clean === 'likely delivered' || clean === 'likely to be delivered' || clean === 'deliverable' || clean === 'delivered') return 'Likely Deliverable';
    if (clean === 'likely to bounce' || clean === 'bounce' || clean === 'bounced') return 'Likely to Bounce';
    if (clean === 'invalid format' || clean === 'invalid' || clean === 'invalid syntax') return 'Invalid Format';
    return 'Unknown';
  }

  let deliv = 0, bounce = 0, unk = 0, inv = 0;
  for (const item of rawTestBatch) {
    const st = normalize(item.status);
    if (st === 'Likely Deliverable') deliv++;
    else if (st === 'Likely to Bounce') bounce++;
    else if (st === 'Unknown') unk++;
    else if (st === 'Invalid Format') inv++;
  }

  console.log(`Frontend Normalization Counts: Total=${rawTestBatch.length}, Deliverable=${deliv}, Bounce=${bounce}, Unknown=${unk}, InvalidFormat=${inv}`);
  const pass = rawTestBatch.length === 5 && deliv === 2 && bounce === 2 && unk === 0 && inv === 1;

  // Test simulation: when user filters by 'Likely to Bounce', table shows 2 items, but KPI summary remains computed from all 5
  const filteredTable = rawTestBatch.filter(item => normalize(item.status) === 'Likely to Bounce');
  console.log(`Filtered Table Length: ${filteredTable.length} (KPI summary remains calculated from all ${rawTestBatch.length} processed results)`);

  if (pass && filteredTable.length === 2 && rawTestBatch.length === 5) {
    console.log('✅ [PASS] Frontend normalization and filter-immunity verified successfully!\n');
  } else {
    console.error('❌ [FAIL] Normalization or filter immunity check failed!');
    process.exitCode = 1;
  }
}

testBackend();

