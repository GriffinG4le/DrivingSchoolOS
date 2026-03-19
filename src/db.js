const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const DB_CLIENT = (process.env.DB_CLIENT || '').toLowerCase() || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
const IS_POSTGRES = DB_CLIENT === 'postgres';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db.sqlite');

let db = null;
let pgPool = null;

if (IS_POSTGRES) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  db = new sqlite3.Database(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
}

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => {
    i += 1;
    return `$${i}`;
  });
}

async function run(sql, params = []) {
  if (IS_POSTGRES) {
    const result = await pgPool.query(toPgSql(sql), params);
    return { lastID: null, changes: result.rowCount || 0 };
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function get(sql, params = []) {
  if (IS_POSTGRES) {
    const result = await pgPool.query(toPgSql(sql), params);
    return result.rows[0];
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

async function all(sql, params = []) {
  if (IS_POSTGRES) {
    const result = await pgPool.query(toPgSql(sql), params);
    return result.rows;
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function generateAdmissionNumber({ school_id, prefix = 'SCH' }) {
  const year = new Date().getFullYear().toString();
  const row = IS_POSTGRES
    ? await get(
        "SELECT COUNT(*)::int AS count FROM admissions WHERE school_id = ? AND EXTRACT(YEAR FROM created_at) = ?",
        [school_id, Number(year)]
      )
    : await get(
        "SELECT COUNT(*) AS count FROM admissions WHERE school_id = ? AND strftime('%Y', created_at) = ?",
        [school_id, year]
      );
  const seq = (row?.count || 0) + 1;
  const serial = String(seq).padStart(6, '0');
  return `${prefix}-${year}-${serial}`;
}

module.exports = {
  db,
  pgPool,
  DB_PATH,
  DB_CLIENT,
  IS_POSTGRES,
  run,
  get,
  all,
  generateAdmissionNumber,
};
