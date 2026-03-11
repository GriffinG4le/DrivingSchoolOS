const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '..', 'db.sqlite');

const db = new sqlite3.Database(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function generateAdmissionNumber(prefix = 'SCH') {
  const year = new Date().getFullYear().toString();
  const row = await get(
    "SELECT COUNT(*) AS count FROM admissions WHERE strftime('%Y', created_at) = ?",
    [year]
  );
  const seq = (row?.count || 0) + 1;
  const serial = String(seq).padStart(6, '0');
  return `${prefix}-${year}-${serial}`;
}

module.exports = {
  db,
  DB_PATH,
  run,
  get,
  all,
  generateAdmissionNumber,
};
