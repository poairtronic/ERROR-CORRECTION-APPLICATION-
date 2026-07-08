const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pgClient.connect();
  await pgClient.query('CREATE INDEX IF NOT EXISTS idx_notifications_read ON "notifications" ("read");');
  console.log('Index created successfully');
  await pgClient.end();
}

run().catch(console.error);
