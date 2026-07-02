const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ecr_db.sqlite');
db.all('SELECT email, role, isActive, passwordHash FROM users WHERE email="admin"', [], (err, rows) => {
  if (err) console.error(err);
  console.log(rows);
});
