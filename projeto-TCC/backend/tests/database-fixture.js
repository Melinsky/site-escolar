// PostgreSQL tests use a new database, never the application database.
const { Client } = require('pg');
const crypto = require('node:crypto');
const local = require('../scripts/postgres-local');
async function createDatabaseFixture() {
 if (process.env.TEST_DB_DRIVER !== 'postgres') return { env: { DB_DRIVER:'pglite', DB_LOCAL_MANAGED:'false', DATABASE_URL:'' }, cleanup:async()=>{} };
 let config,adminConnection;
 if(process.env.TEST_DATABASE_URL){
  const url=new URL(process.env.TEST_DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('TEST_DATABASE_URL inválida.');
  config={port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),host:url.hostname};
  adminConnection={connectionString:process.env.TEST_DATABASE_URL,connectionTimeoutMillis:5000};
 }else{config=await local.readConfig();await local.start();adminConnection=local.connection(config,true);}
 const name = 'eeafr_test_' + crypto.randomBytes(10).toString('hex');
 const admin = new Client(adminConnection);
 const owner='"'+config.user.replace(/"/g,'""')+'"';
 try { await admin.connect(); await admin.query(`CREATE DATABASE ${name} OWNER ${owner} TEMPLATE template0`); }
 finally { await admin.end(); }
 return {
  env: { DB_DRIVER:'postgres', DB_LOCAL_MANAGED:'false', DATABASE_URL:'', DB_HOST:config.host||'127.0.0.1',DB_PORT:String(config.port),DB_NAME:name,DB_USER:config.user,DB_PASSWORD:config.password,DB_SSL:'false' },
  cleanup:async()=>{
   if (!/^eeafr_test_[a-f0-9]{20}$/.test(name)) throw new Error('Nome de banco de teste inválido.');
   const client=new Client(adminConnection);
   try { await client.connect(); await client.query(`DROP DATABASE ${name} WITH (FORCE)`); }
   finally { await client.end(); }
  },
 };
}
module.exports = { createDatabaseFixture };
