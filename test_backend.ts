import { exec } from 'child_process';
import http from 'http';

async function testBackend() {
  console.log('=== RUNNING MAILMATE BACKEND VERIFICATION TESTS ===');

  const testEmails = [
    'lex@example.com',
    'hello@example.org',
    'pilot@shieldnex.com',
    'invalid..format@domain.com',
    'missing-at-sign.com',
    'test@definitely-non-existent-domain-9988.org',
    'user@mailinator.com',
    'contact@nasa.gov',
    'sleelamadhav90@gmail.com'
  ];

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
        console.log(`API Total Results: ${json.total}`);
        let passed = 0;
        json.results.forEach((r: any) => {
          console.log(`[TEST] Email: "${r.email}" -> Status: ${r.status} -> Reason: ${r.reason}`);
          if (r.status) passed++;
        });
        console.log(`=== TEST SUMMARY: ${passed}/${testEmails.length} PASSED ===`);
      } catch (e: any) {
        console.error('Failed to parse response:', e);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

testBackend();
