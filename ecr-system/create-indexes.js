const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const queries = [
  'CREATE INDEX IF NOT EXISTS idx_defect_reports_reportnumber ON "defect_reports" ("reportNumber");',
  'CREATE INDEX IF NOT EXISTS idx_defect_reports_status ON "defect_reports" ("status");',
  'CREATE INDEX IF NOT EXISTS idx_defect_reports_createdat ON "defect_reports" ("createdAt");',
  'CREATE INDEX IF NOT EXISTS idx_defect_reports_updatedat ON "defect_reports" ("updatedAt");',
  'CREATE INDEX IF NOT EXISTS idx_users_email ON "users" ("email");',
  'CREATE INDEX IF NOT EXISTS idx_audit_log_report_id ON "audit_log" ("report_id");',
  'CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON "audit_log" ("actor_id");',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_status ON "email_logs" ("status");',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON "email_logs" ("recipient");',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON "notifications" ("user_id");',
  'CREATE INDEX IF NOT EXISTS idx_notifications_status ON "notifications" ("isRead");'
];

async function run() {
  try {
    await pgClient.connect();
    for (const q of queries) {
      await pgClient.query(q);
      console.log('Executed:', q);
    }
    console.log('Indexes created successfully.');
  } catch (err) {
    console.error('Error creating indexes:', err.message);
  } finally {
    await pgClient.end();
  }
}

run();
