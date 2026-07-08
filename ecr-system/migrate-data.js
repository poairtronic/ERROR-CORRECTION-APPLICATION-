const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const dotenv = require('dotenv');

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

async function getPgBooleanColumns(tableName) {
  const res = await pgClient.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND data_type = 'boolean'
  `, [tableName]);
  return res.rows.map(r => r.column_name);
}

async function migrate() {
  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL');

    for (const table of tablesToMigrate) {
      console.log(`Migrating table: ${table}...`);
      const rows = await runSqliteQuery(`SELECT * FROM "${table}"`);
      if (rows.length === 0) {
        console.log(`- Table ${table} has 0 rows. Skipping.`);
        continue;
      }

      const booleanColumns = await getPgBooleanColumns(table);

      const columns = Object.keys(rows[0]);
      const colString = columns.map(c => `"${c}"`).join(', ');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Convert SQLite boolean (1/0) to true/false for PostgreSQL
        const values = columns.map(c => {
          if (booleanColumns.includes(c) && row[c] !== null) {
            return row[c] === 1 || row[c] === '1' || row[c] === 'true';
          }
          return row[c];
        });
        
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const insertQuery = `INSERT INTO "${table}" (${colString}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        
        try {
          await pgClient.query(insertQuery, values);
        } catch (err) {
          console.error(`Error inserting into ${table}:`, err.message);
          throw err;
        }
      }
      console.log(`- Successfully migrated ${rows.length} rows to ${table}.`);
    }

    console.log('Data migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

migrate();
