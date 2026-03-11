/* Initializes the SQLite database using schema.sql */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const schemaPath = path.join(__dirname, '..', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '..', 'db.sqlite');

const db = new sqlite3.Database(DB_PATH);

db.exec(schemaSql, (err) => {
  if (err) {
    console.error('Failed to apply schema.sql:', err.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Database initialized at ${DB_PATH}`);
  db.close();
});

