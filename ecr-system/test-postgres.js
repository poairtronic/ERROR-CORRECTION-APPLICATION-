const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log('PostgreSQL connection successful!');
    return client.query('SELECT version()');
  })
  .then(res => {
    console.log('PostgreSQL Version:', res.rows[0].version);
    process.exit(0);
  })
  .catch(err => {
    console.error('PostgreSQL connection failed:', err.message);
    process.exit(1);
  });
