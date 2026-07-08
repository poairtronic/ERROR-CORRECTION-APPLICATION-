const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pgClient.connect();
  
  // Check index on notifications
  const idxRes = await pgClient.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'notifications' AND indexdef LIKE '%"read"%'
  `);
  console.log('Notification read index found:', idxRes.rows.length > 0);

  // Check updatedAt on notifications
  const colRes = await pgClient.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'updatedAt'
  `);
  console.log('Notification updatedAt column found:', colRes.rows.length > 0);

  // Perform a test API request to login (which will trigger LoginHistory save)
  const http = require('http');
  const postData = JSON.stringify({
    username: 'admin@agipl.com',
    password: 'password'
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'VerificationScript/1.0'
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', async () => {
      console.log('Login API Response:', res.statusCode);
      
      // Wait a moment for background save
      setTimeout(async () => {
        const histRes = await pgClient.query(`SELECT * FROM "login_history" ORDER BY timestamp DESC LIMIT 1`);
        console.log('Login History Record Found:', histRes.rows.length > 0);
        if (histRes.rows.length > 0) {
           console.log('User Agent:', histRes.rows[0].userAgent);
        }
        await pgClient.end();
        process.exit(0);
      }, 1000);
    });
  });

  req.on('error', (e) => {
    console.error('API Error:', e);
    pgClient.end();
  });
  
  req.write(postData);
  req.end();
}

run();
