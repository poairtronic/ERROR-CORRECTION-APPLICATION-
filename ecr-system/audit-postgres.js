const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  await pgClient.connect();
  const auditData = {};

  // 1. Connection Version
  const v = await pgClient.query('SELECT version()');
  auditData.version = v.rows[0].version;

  // 2. Table Validation
  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  `;
  const tablesRes = await pgClient.query(tablesQuery);
  const tables = tablesRes.rows.map(r => r.table_name);
  auditData.tables = {};

  for (const table of tables) {
    const countRes = await pgClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
    auditData.tables[table] = {
      count: countRes.rows[0].count
    };
  }

  // 11. Index Validation
  const indexQuery = `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  const indexRes = await pgClient.query(indexQuery);
  auditData.indexes = indexRes.rows;

  // 13. Data Integrity (duplicates, nulls)
  // Check duplicate reportNumbers in defect_reports
  if (tables.includes('defect_reports')) {
    const dupReports = await pgClient.query(`
      SELECT "reportNumber", COUNT(*) 
      FROM "defect_reports" 
      GROUP BY "reportNumber" 
      HAVING COUNT(*) > 1
    `);
    auditData.integrity = { duplicateReportNumbers: dupReports.rows.length };
  }
  
  // Check duplicate emails in users
  if (tables.includes('users')) {
    const dupEmails = await pgClient.query(`
      SELECT "email", COUNT(*) 
      FROM "users" 
      GROUP BY "email" 
      HAVING COUNT(*) > 1
    `);
    auditData.integrity.duplicateEmails = dupEmails.rows.length;
  }

  // FK validation (Check if any orphan inspection_details exist for missing defect_reports)
  if (tables.includes('inspection_details')) {
    const orphanInspections = await pgClient.query(`
      SELECT COUNT(*) as orphans
      FROM "inspection_details" i
      LEFT JOIN "defect_reports" d ON i.report_id = d.id
      WHERE d.id IS NULL
    `);
    auditData.integrity.orphanInspections = orphanInspections.rows[0].orphans;
  }

  fs.writeFileSync('audit-result.json', JSON.stringify(auditData, null, 2));
  await pgClient.end();
  console.log('Audit data collection complete.');
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
