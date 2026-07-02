const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../ecr-system/ecr.sqlite');
db.all('SELECT email, role FROM users', [], (err, rows) => {
  console.log(rows);
});
