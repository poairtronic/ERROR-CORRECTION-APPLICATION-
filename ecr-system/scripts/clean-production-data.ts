import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

const TABLES_TO_TRUNCATE = [
  'audit_log',
  'email_logs',
  'email_monitoring_audit_logs',
  'login_history',
  'notifications',
  'inspection_details',
  'sm_review',
  'gm_approval',
  'component_issue',
  'salary_deduction',
  'vendor_fault_log',
  'defect_reports',
  'report_sequence',
];

const MASTER_TABLES_TO_KEEP = [
  'users',
  'notification_preferences',
  'error_types',
  'cost_rates',
  'components',
  'operators',
  'vendors',
];

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL database.');

  try {
    // 1. Fetch all existing public table names
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const existingTables = tablesRes.rows.map((r) => r.table_name);
    console.log('\n--- EXISTING TABLES IN DATABASE ---');
    console.log(existingTables.join(', '));

    // 2. Count rows BEFORE cleaning
    console.log('\n--- ROW COUNTS BEFORE CLEANING ---');
    for (const table of existingTables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${table}";`);
      console.log(`  - ${table}: ${countRes.rows[0].count} rows`);
    }

    // 3. Filter valid tables to truncate
    const validTruncateTables = TABLES_TO_TRUNCATE.filter((t) =>
      existingTables.includes(t),
    );

    if (validTruncateTables.length > 0) {
      console.log('\n--- ERASING TRANSACTIONAL & LOG DATA ---');
      const truncateSql = `TRUNCATE TABLE ${validTruncateTables
        .map((t) => `"${t}"`)
        .join(', ')} CASCADE;`;
      console.log(`Executing SQL: ${truncateSql}`);
      await client.query(truncateSql);
      console.log('SUCCESS: Transactional & log data cleared!');
    }

    // 4. Reset sequence in report_sequence table if present
    if (existingTables.includes('report_sequence')) {
      console.log('\n--- RESETTING ECR REPORT NUMBER SEQUENCE ---');
      await client.query(`DELETE FROM "report_sequence";`);
      console.log('SUCCESS: ECR report sequences reset!');
    }

    // 5. Count rows AFTER cleaning
    console.log('\n--- ROW COUNTS AFTER CLEANING ---');
    for (const table of existingTables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${table}";`);
      const isMaster = MASTER_TABLES_TO_KEEP.includes(table);
      const tag = isMaster ? '[MASTER DATA PRESERVED]' : '[CLEARED]';
      console.log(`  - ${table}: ${countRes.rows[0].count} rows ${tag}`);
    }

    console.log('\n✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY! Neon DB is ready for fresh production launch.');
  } catch (err) {
    console.error('\n❌ ERROR DURING DATABASE CLEANUP:', err);
  } finally {
    await client.end();
  }
}

main();
