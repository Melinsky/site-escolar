const fs = require('node:fs/promises');
const path = require('node:path');
let db;
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '.data');
const postgres = process.env.DB_DRIVER === 'postgres';
async function init() {
  await fs.mkdir(dataDir, { recursive: true });
  if (postgres) {
    const { Pool } = require('pg');
    db = new Pool({ connectionString: process.env.DATABASE_URL, host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA_FILE ? { ca: await fs.readFile(process.env.DB_SSL_CA_FILE,'utf8') } : {}) } : false,
      connectionTimeoutMillis: 5000, max: 10 });
    db.on('error', error => console.error('Conexão PostgreSQL:', error.message));
    for (let attempt = 1; ; attempt++) {
      try { await db.query('SELECT 1'); break; }
      catch (e) { if (attempt === 3) throw e; await new Promise(r => setTimeout(r, 500 * attempt)); }
    }
  } else {
    const { PGlite } = require('@electric-sql/pglite');
    db = await PGlite.create(path.join(dataDir, 'postgres'));
  }
  const schema = await fs.readFile(path.join(__dirname, '../models/schema.sql'), 'utf8');
  await transaction(async client => {
    if (postgres) await client.query('SELECT pg_advisory_xact_lock(2182026)');
    await client.exec(schema);
    const existing = await client.query("SELECT 1 FROM app_migrations WHERE name = 'initial-content'");
    if (!existing.rows.length) {
      if(process.env.SEED_CONTENT!=='false') {
        const seed = await fs.readFile(path.join(__dirname, '../models/seed.sql'), 'utf8');
        await client.exec(seed);
      }
      await client.query("INSERT INTO app_migrations(name) VALUES ('initial-content')");
    }
    if (!(await client.query("SELECT 1 FROM app_migrations WHERE name='calendar-content'")).rows.length) {
      if(process.env.SEED_CONTENT!=='false') await client.exec(await fs.readFile(path.join(__dirname, '../models/calendar.sql'), 'utf8'));
      await client.query("INSERT INTO app_migrations(name) VALUES ('calendar-content')");
    }
  });
}
async function query(sql, params = []) { return db.query(sql, params); }
async function transaction(callback) {
  if (!postgres) return db.transaction(callback);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql) });
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function close() { if (db) await (postgres ? db.end() : db.close()); }
module.exports = { init, query, transaction, close, dataDir };
