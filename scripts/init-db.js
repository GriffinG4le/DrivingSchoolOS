/* Initializes database schema (Postgres or SQLite based on DB_CLIENT / DATABASE_URL) */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const DB_CLIENT = (process.env.DB_CLIENT || '').toLowerCase() || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');

async function initPostgres() {
  const schemaPath = path.join(__dirname, '..', 'schema.postgres.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await pool.query(schemaSql);
    console.log('Postgres schema initialized from schema.postgres.sql');
  } finally {
    await pool.end();
  }
}

function initSqlite() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'db.sqlite');
  const db = new sqlite3.Database(dbPath);

  db.exec(schemaSql, (err) => {
    if (err) {
      console.error('Failed to apply schema.sql:', err.message);
      process.exitCode = 1;
      return;
    }
    console.log(`SQLite database initialized at ${dbPath}`);
    db.close();
  });
}

if (DB_CLIENT === 'postgres') {
  initPostgres().catch((err) => {
    console.error('Failed to apply schema.postgres.sql:', err.message);
    process.exitCode = 1;
  });
} else {
  initSqlite();
}

