const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Parse .env manually
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.split('DATABASE_URL=')[1].trim();
    break;
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('Connecting to database...');

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected successfully!');
    
    // 1. Update Enum
    const res = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE typname = 'defect_reports_status_enum' AND enumlabel = 'PENDING_ACCOUNTS_REVIEW';
    `);

    if (res.rows.length === 0) {
      console.log('Altering defect_reports_status_enum to add PENDING_ACCOUNTS_REVIEW...');
      await client.query(`ALTER TYPE defect_reports_status_enum ADD VALUE 'PENDING_ACCOUNTS_REVIEW';`);
      console.log('Enum type altered successfully!');
    } else {
      console.log('PENDING_ACCOUNTS_REVIEW already exists in the enum type.');
    }

    // 1b. Update ResponsibleParty Enum
    const resResp = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE typname = 'inspection_details_responsibleparty_enum' AND enumlabel = 'CUSTOMER';
    `);

    if (resResp.rows.length === 0) {
      console.log('Altering inspection_details_responsibleparty_enum to add CUSTOMER...');
      await client.query(`ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE 'CUSTOMER';`);
      console.log('Enum type altered successfully!');
    } else {
      console.log('CUSTOMER already exists in the enum type.');
    }

    // 2. Add Columns
    console.log('Adding columns to inspection_details table...');
    await client.query(`ALTER TABLE inspection_details ADD COLUMN IF NOT EXISTS "materialCost" numeric(10,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE inspection_details ADD COLUMN IF NOT EXISTS "labourCost" numeric(10,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE inspection_details ADD COLUMN IF NOT EXISTS "otherCost" numeric(10,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE inspection_details ADD COLUMN IF NOT EXISTS "costRemarks" text;`);
    console.log('Adding messageToSm column to gm_approval table...');
    await client.query(`ALTER TABLE gm_approval ADD COLUMN IF NOT EXISTS "messageToSm" text;`);
    console.log('Columns added successfully!');
    
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await client.end();
  }
}

main();
