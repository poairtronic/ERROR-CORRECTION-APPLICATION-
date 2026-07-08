const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const sqliteDb = new sqlite3.Database('ecr_db.sqlite', sqlite3.OPEN_READONLY);

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const tablesToMigrate = [
  'users',
  'error_types',
  'cost_rates',
  'components',
  'vendors',
  'report_sequence',
  'defect_reports',
  'inspection_details',
  'sm_review',
  'gm_approval',
  'component_issue',
  'vendor_fault_log',
  'salary_deduction',
  'notification_preferences',
  'notifications',
  'email_logs',
  'audit_log'
];

const runSqliteQuery = (query) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function validate() {
  try {
    await pgClient.connect();
    
    let allMatched = true;
    const report = ['# Row Count Validation Report\n', '| Table | SQLite Count | PostgreSQL Count | Status |', '|---|---|---|---|'];

    for (const table of tablesToMigrate) {
      const sqliteRows = await runSqliteQuery(`SELECT COUNT(*) as count FROM "${table}"`);
      const pgRows = await pgClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
      
      const sCount = sqliteRows[0].count;
      const pCount = parseInt(pgRows.rows[0].count, 10);
      
      const match = sCount === pCount;
      if (!match) allMatched = false;
      
      report.push(`| ${table} | ${sCount} | ${pCount} | ${match ? '✅ MATCH' : '❌ MISMATCH'} |`);
    }

    fs.writeFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/ae3d4279-0790-45d1-8903-293498308759/validation_report.md', report.join('\n'));
    console.log(allMatched ? 'VALIDATION PASSED' : 'VALIDATION FAILED');
  } catch (err) {
    console.error('Validation failed:', err);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

validate();
