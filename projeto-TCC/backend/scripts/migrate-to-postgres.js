const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { PGlite } = require('@electric-sql/pglite');
const { Client } = require('pg');
const local = require('./postgres-local');
const tables = [
 ['app_migrations','name'], ['cursos','id'], ['eventos','id'], ['avisos','id'], ['comunicados','id'],
 ['galeria','id'], ['professores','id'], ['escola_dados','id'], ['contato_mensagens','id'],
 ['usuarios','id'], ['sessoes','token_hash'], ['auditoria','id'],
];
const checksum = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(row => Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))))).digest('hex');
async function migrate() {
 const envPath=path.join(local.backend,'.env');
 const envText=await fs.readFile(envPath,'utf8');const env=dotenv.parse(envText);
 if (env.DB_DRIVER==='postgres') throw new Error('O projeto já está configurado com PostgreSQL. A migração não foi repetida.');
 const appPort=Number(process.env.PORT||env.PORT||3000);
 if(await local.occupied(appPort))throw new Error('Pare o site antes da migração para evitar alterações durante a cópia.');
 const sourceDir=path.resolve(process.env.DATA_DIR||env.DATA_DIR||path.join(local.backend,'.data'),'postgres');
 if (!(await fs.stat(path.join(sourceDir,'PG_VERSION')).catch(()=>null)))throw new Error('Banco PGlite de origem não encontrado. Nenhum dado foi alterado.');
 const config=await local.readConfig();await local.start();
 const target=new Client(local.connection(config));let source;
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const backupDir=path.join(local.backend,'.data','backups');await fs.mkdir(backupDir,{recursive:true});
 const snapshot={createdAt:new Date().toISOString(),tables:{}};
 let inTransaction=false;
 try {
  await target.connect();
  const existing=await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if(existing.rows.length)throw new Error('O destino contém tabelas. A migração só aceita um banco vazio e não apaga dados existentes.');
  source=await PGlite.create(sourceDir);
  for(const [table,key]of tables) snapshot.tables[table]=(await source.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY ${key}`)).rows.map(item=>item.row);
  await source.close();source=null;
  await fs.writeFile(path.join(backupDir,`pglite-before-postgres-${stamp}.json`),JSON.stringify(snapshot,null,2),{mode:0o600,flag:'wx'});
  await fs.copyFile(envPath,path.join(backupDir,`env-before-postgres-${stamp}.txt`));
  await target.query('BEGIN');inTransaction=true;
  await target.query(await fs.readFile(path.join(local.backend,'models','schema.sql'),'utf8'));
  for(const [table,key]of tables){
   const rows=snapshot.tables[table];
   for(const row of rows){
    const columns=Object.keys(row);
    await target.query(`INSERT INTO ${table} (${columns.map(c=>`"${c}"`).join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
   }
   if(key==='id')await target.query(`SELECT setval(pg_get_serial_sequence($1,'id'),COALESCE((SELECT MAX(id) FROM ${table}),1),EXISTS(SELECT 1 FROM ${table}))`,[table]);
   const copied=(await target.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY ${key}`)).rows.map(item=>item.row);
   if(checksum(copied)!==checksum(rows))throw new Error('Verificação de integridade falhou em '+table+'. A cópia foi cancelada.');
  }
  await target.query('COMMIT');inTransaction=false;
  const changes={DB_DRIVER:'postgres',DB_LOCAL_MANAGED:'true',DB_HOST:'127.0.0.1',DB_PORT:String(config.port),DB_USER:config.user,DB_PASSWORD:config.password,DB_NAME:config.database,DB_SSL:'false'};
  const lines=envText.split(/\r?\n/).filter(line=>!Object.keys({...changes,DATABASE_URL:1}).some(key=>new RegExp('^\\s*'+key+'\\s*=').test(line)));
  const nextEnv=lines.join('\n').trimEnd()+'\n\n# PostgreSQL local do projeto (senha gerada automaticamente)\n'+Object.entries(changes).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
  await fs.writeFile(envPath+'.pending',nextEnv,{mode:0o600});await fs.rename(envPath+'.pending',envPath);
  const report={createdAt:new Date().toISOString(),database:config.database,port:config.port,tables:Object.fromEntries(tables.map(([table])=>[table,{count:snapshot.tables[table].length,sha256:checksum(snapshot.tables[table])}]))};
  await fs.writeFile(path.join(local.root,'migration-report.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log('Migração concluída e integridade verificada em todas as tabelas.');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(report.tables).map(([table,info])=>[table,info.count])),null,2));
  console.log('O banco PGlite original e os uploads foram preservados. O .env já utiliza PostgreSQL. Inicie o site com npm start.');
 } catch(error){if(inTransaction)await target.query('ROLLBACK');throw error;}
 finally{if(source)await source.close();await target.end();}
}
migrate().catch(error=>{console.error(error.message);process.exitCode=1;});
