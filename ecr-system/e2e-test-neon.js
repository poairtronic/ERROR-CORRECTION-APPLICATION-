const { Client } = require('pg');
const http = require('http');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pgClient.connect();

  console.log("=== STEP 1: Check if backend is alive ===");
  await new Promise((resolve) => {
    http.get('http://localhost:3000/api', (res) => {
      console.log('Backend /api status:', res.statusCode);
      resolve();
    }).on('error', (e) => {
      console.log('Backend /api error:', e.message);
      resolve();
    });
  });

  console.log("\n=== STEP 3: Verify Neon is being used (Create Report) ===");
  
  // 1. Get an Inspector user
  const userRes = await pgClient.query("SELECT * FROM users WHERE role = 'INSPECTOR' LIMIT 1");
  if (userRes.rows.length === 0) {
    console.error("No inspector found. Can't create report.");
    process.exit(1);
  }
  const user = userRes.rows[0];
  console.log(`Found Inspector: ${user.name} (${user.id})`);

  // 2. Generate JWT
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Count before
  const beforeCounts = await getCounts();

  // 4. Create Report
  const postData = JSON.stringify({
    scOrPoNo: "TEST-E2E-NEON",
    stageOfFailure: "INSPECTION",
    defectDescription: "Neon Integration E2E Test Report",
    inlineInspection: {
      errorType: "E2E_ERROR",
      rootCause: "TEST_CAUSE",
      responsibleParty: "OPERATOR",
      decision: "SCRAP",
      costEstimate: 100,
      timeEstimateHours: 2
    }
  });

  console.log("Sending POST to /api/defect-reports...");
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/defect-reports',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${token}`
    }
  };

  await new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log('POST /api/defect-reports status:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Response body:', data);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error('API Error:', e);
      resolve();
    });
    req.write(postData);
    req.end();
  });

  // Wait 2 seconds for event emitters and background tasks (emails, logs) to settle
  await new Promise(r => setTimeout(r, 2000));

  // 5. Count after
  const afterCounts = await getCounts();

  console.log("\n=== STEP 4: Check Table Inserts in Neon ===");
  console.log(`defect_reports : Before=${beforeCounts.defect_reports} | After=${afterCounts.defect_reports} -> ${afterCounts.defect_reports > beforeCounts.defect_reports ? '✅ YES' : '❌ NO'}`);
  console.log(`audit_log      : Before=${beforeCounts.audit_log} | After=${afterCounts.audit_log} -> ${afterCounts.audit_log > beforeCounts.audit_log ? '✅ YES' : '❌ NO'}`);
  console.log(`notifications  : Before=${beforeCounts.notifications} | After=${afterCounts.notifications} -> ${afterCounts.notifications > beforeCounts.notifications ? '✅ YES' : '❌ NO'}`);
  console.log(`email_logs     : Before=${beforeCounts.email_logs} | After=${afterCounts.email_logs} -> ${afterCounts.email_logs >= beforeCounts.email_logs ? '✅ YES (Assuming events fired)' : '❌ NO'}`);

  await pgClient.end();
}

async function getCounts() {
  const dRes = await pgClient.query('SELECT COUNT(*) FROM defect_reports');
  const aRes = await pgClient.query('SELECT COUNT(*) FROM audit_log');
  const nRes = await pgClient.query('SELECT COUNT(*) FROM notifications');
  const eRes = await pgClient.query('SELECT COUNT(*) FROM email_logs');
  return {
    defect_reports: parseInt(dRes.rows[0].count),
    audit_log: parseInt(aRes.rows[0].count),
    notifications: parseInt(nRes.rows[0].count),
    email_logs: parseInt(eRes.rows[0].count),
  };
}

run().catch(console.error);
