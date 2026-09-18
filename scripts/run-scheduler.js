#!/usr/bin/env node

/**
 * Personal University Dispatch CLI
 * Usage:
 *   node scripts/run-scheduler.js status       - Check scheduler status
 *   node scripts/run-scheduler.js dispatch     - Trigger immediate dispatch test
 */

const http = require('http');

const command = process.argv[2] || 'status';
const PORT = process.env.PORT || 3000;

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  try {
    if (command === 'status') {
      const res = await request('/api/scheduler');
      console.log('\n=== Personal University Scheduler Status ===');
      console.log(JSON.stringify(res, null, 2));
    } else if (command === 'dispatch') {
      console.log('\nTriggering immediate scheduled dispatch via server...');
      const res = await request('/api/scheduler', 'POST', { action: 'dispatch_now' });
      console.log('\n=== Dispatch Result ===');
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log('Unknown command. Use "status" or "dispatch".');
    }
  } catch (err) {
    console.error('Error contacting Personal University server on port', PORT, ':', err.message);
    console.error('Ensure `npm run dev` is running.');
  }
}

main();
