import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query(
    'SELECT id, "reportNumber", status, "raisedByRole", "createdAt" FROM defect_reports ORDER BY "createdAt" DESC;'
  );
  console.log('CURRENT DEFECT REPORTS IN DB:');
  console.table(res.rows);
  await client.end();
}

main();
