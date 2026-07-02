const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('ecr_db.sqlite');
db.run("UPDATE users SET passwordHash = '$2b$10$eiT2aqv.Jg9lwjR4zS.KFOKphga/MzTKUxg8eeEbsTMyzjuCM2Qsi' WHERE email = 'admin'", (err) => {
  if (err) console.error(err);
  else console.log('Fixed');
});
