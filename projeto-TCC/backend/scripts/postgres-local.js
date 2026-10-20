const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { Client } = require('pg');
const backend = path.join(__dirname, '..');
const root = path.join(backend, '.data', 'postgresql-local');
const configFile = path.join(root, 'connection.json');
const binary = name => path.join(root, 'pgsql', 'bin', name + '.exe');
const cluster = path.join(root, 'cluster');
function run(file, args) {
 return new Promise((resolve, reject) => {
  const child = spawn(file, args, { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', value => output += value);
  child.stderr.on('data', value => output += value);
  child.on('error', reject);
  child.on('exit', code => {
   child.stdout.destroy(); child.stderr.destroy();
   code === 0 ? resolve(output.trim()) : reject(new Error(`${path.basename(file)} falhou (${code}): ${output.trim()}`));
  });
 });
}
async function readConfig() {
 try { return JSON.parse(await fs.readFile(configFile, 'utf8')); }
 catch (error) { if (error.code === 'ENOENT') throw new Error('PostgreSQL local ainda não preparado. Execute npm run db:setup.'); throw error; }
}
function connection(config, admin = false) {
 return { host: '127.0.0.1', port: config.port, database: admin ? 'postgres' : config.database,
  user: admin ? config.adminUser : config.user, password: admin ? config.adminPassword : config.password, connectionTimeoutMillis: 5000 };
}
async function occupied(port) {
 return new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
 });
}
async function start() {
 const config = await readConfig();
 try { await run(binary('pg_ctl'), ['status', '-D', cluster]); return; }
 catch (error) { if (!(await fs.stat(path.join(cluster,'PG_VERSION')).catch(() => null))) throw error; }
 if (await occupied(config.port)) throw new Error(`Porta ${config.port} ocupada por outro processo. O PostgreSQL do projeto não foi iniciado.`);
 await run(binary('pg_ctl'), ['start', '-D', cluster, '-l', path.join(root,'postgresql.log'), '-w', '-t', '30']);
 console.log(`PostgreSQL local iniciado em 127.0.0.1:${config.port}.`);
}
async function setup() {
 if (process.platform !== 'win32') throw new Error('Este instalador local é para Windows x64. Em outro sistema configure PostgreSQL externo pelo .env.');
 if (process.arch !== 'x64') throw new Error('O pacote local exige Windows x64.');
 await run('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'install-postgres.ps1')]);
 await fs.mkdir(root, { recursive: true });
 let config;
 try { config = await readConfig(); }
 catch (error) {
  if (await fs.stat(configFile).catch(() => null)) throw error;
  const port = await occupied(5432) ? 5433 : 5432;
  if (await occupied(port)) throw new Error('Portas 5432 e 5433 ocupadas. Configure um PostgreSQL externo.');
  config = { port, database: 'eeafr_database', user: 'eeafr_app', password: crypto.randomBytes(32).toString('base64url'),
   adminUser: 'eeafr_owner', adminPassword: crypto.randomBytes(32).toString('base64url') };
  await fs.writeFile(configFile, JSON.stringify(config,null,2), { mode: 0o600, flag: 'wx' });
 }
 if (!(await fs.stat(path.join(cluster,'PG_VERSION')).catch(() => null))) {
  const passwordFile = path.join(root, 'bootstrap-password.txt');
  await fs.writeFile(passwordFile, config.adminPassword, { mode: 0o600 });
  try { await run(binary('initdb'), ['-D',cluster,'-U',config.adminUser,'--pwfile='+passwordFile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions']); }
  finally { await fs.unlink(passwordFile); }
  await fs.appendFile(path.join(cluster,'postgresql.conf'), `\n# EEAFR: somente conexões deste computador\nlisten_addresses = '127.0.0.1'\nport = ${config.port}\nmax_connections = 40\nshared_buffers = '64MB'\ntimezone = 'UTC'\npassword_encryption = 'scram-sha-256'\n`);
 }
 await start();
 const admin = new Client(connection(config,true));
 try {
  await admin.connect();
  const literal = value => "'" + value.replace(/'/g,"''") + "'";
  if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[config.user])).rows.length)
   await admin.query(`CREATE ROLE eeafr_app LOGIN PASSWORD ${literal(config.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[config.database])).rows.length)
   await admin.query('CREATE DATABASE eeafr_database OWNER eeafr_app ENCODING \'UTF8\' TEMPLATE template0');
 } finally { await admin.end(); }
 console.log(`Banco ${config.database} preparado. Execute npm run db:migrate com o site parado para transferir os dados e ativar a conexão.`);
}
async function status() {
 const config = await readConfig();
 const client = new Client(connection(config));
 try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS banco,current_user AS usuario,version() AS versao");
  console.log(JSON.stringify({ ...result.rows[0], host:'127.0.0.1', port: config.port },null,2));
 } finally { await client.end(); }
}
async function stop() {
 await readConfig();
 await run(binary('pg_ctl'), ['stop','-D',cluster,'-m','fast','-w','-t','30']);
 console.log('PostgreSQL local encerrado.');
}
async function backup() {
 require('dotenv').config({ path: path.join(backend,'.env') });
 const config = await readConfig(); await start();
 const directory = path.join(backend,'.data','backups'); await fs.mkdir(directory,{recursive:true});
 const stamp = new Date().toISOString().replace(/[:.]/g,'-');
 const destination = path.join(directory,`eeafr-postgres-${stamp}.dump`);
 const passFile = path.join(root,`pgpass-${crypto.randomUUID()}.txt`);
 await fs.writeFile(passFile,`127.0.0.1:${config.port}:${config.database}:${config.user}:${config.password}\n`,{mode:0o600});
 try {
  await new Promise((resolve,reject) => {
   const child=spawn(binary('pg_dump'),['-h','127.0.0.1','-p',String(config.port),'-U',config.user,'-d',config.database,'-Fc','--no-password','-f',destination],{windowsHide:true,env:{...process.env,PGPASSFILE:passFile},stdio:['ignore','ignore','pipe']});
   let error='';child.stderr.on('data',data=>error+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Backup falhou: '+error)));
  });
 } finally { await fs.unlink(passFile); }
 const uploadSource=path.resolve(process.env.DATA_DIR || path.join(backend,'.data'),'uploads');
 if (await fs.stat(uploadSource).catch(()=>null)) await fs.cp(uploadSource,path.join(directory,`uploads-${stamp}`),{recursive:true,errorOnExist:true,force:false});
 console.log('Backup criado: '+destination+' (uploads copiados separadamente, se existentes).');
 return {dump:destination,uploads:await fs.stat(uploadSource).catch(()=>null)?path.join(directory,`uploads-${stamp}`):null};
}
module.exports = { start, setup, status, stop, backup, readConfig, connection, occupied, run, root, backend };
if (require.main === module) {
 require('dotenv').config({path:path.join(backend,'.env')});
 const commands={setup,start,stop,status,backup};
 const command=commands[process.argv[2]];
 if (!command) { console.error('Use setup, start, stop, status ou backup.'); process.exitCode=1; }
 else command().catch(error=>{console.error(error.message);process.exitCode=1;});
}
