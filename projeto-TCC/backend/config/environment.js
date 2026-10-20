const fs = require('node:fs');
const path = require('node:path');
function loadEnvironment() {
 require('dotenv').config({ path: path.join(__dirname, '../.env') });
 for (const key of ['DB_PASSWORD', 'ADMIN_PASSWORD', 'DATABASE_URL']) {
  if (!process.env[key+'_FILE']) continue;
  if (process.env[key]) throw new Error(`Configure ${key} ou ${key}_FILE, não os dois.`);
  const value=fs.readFileSync(process.env[key+'_FILE'],'utf8').trim();
  if (!value) throw new Error(`Arquivo ${key}_FILE vazio.`);
  process.env[key]=value;
 }
 validateEnvironment(process.env);
}
function validateEnvironment(env) {
 if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT)<1 || Number(env.PORT)>65535)) throw new Error('PORT deve estar entre 1 e 65535.');
 if (env.DB_DRIVER && !['postgres','pglite'].includes(env.DB_DRIVER)) throw new Error('DB_DRIVER deve ser postgres ou pglite.');
 if (env.TRUST_PROXY && (!/^\d+$/.test(env.TRUST_PROXY)||Number(env.TRUST_PROXY)>10)) throw new Error('TRUST_PROXY deve ser um número de saltos entre 0 e 10.');
 if (env.NODE_ENV==='production') {
  if (env.DB_DRIVER!=='postgres') throw new Error('Produção exige DB_DRIVER=postgres.');
  if (env.DB_LOCAL_MANAGED==='true') throw new Error('Produção usa PostgreSQL do servidor, não o runtime local Windows.');
  if (!env.DATABASE_URL && (!env.DB_HOST||!env.DB_USER||!env.DB_NAME||!env.DB_PASSWORD)) throw new Error('Configure DATABASE_URL ou a conexão PostgreSQL completa.');
  if (!env.DATA_DIR || !path.isAbsolute(env.DATA_DIR)) throw new Error('Produção exige DATA_DIR absoluto em armazenamento persistente.');
  if (!env.PUBLIC_URL) throw new Error('Produção exige PUBLIC_URL com o domínio HTTPS.');
  let url; try { url=new URL(env.PUBLIC_URL); } catch { throw new Error('PUBLIC_URL inválida.'); }
  if (url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('PUBLIC_URL deve conter apenas a origem HTTPS do site.');
 }
}
module.exports={loadEnvironment,validateEnvironment};
