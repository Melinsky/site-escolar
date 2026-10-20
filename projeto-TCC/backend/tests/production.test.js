const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {validateEnvironment}=require('../config/environment');
const {validateInput,configure}=require('../scripts/configure-production');
const {spawn}=require('node:child_process');
const {createDatabaseFixture}=require('./database-fixture');
const production={NODE_ENV:'production',DB_DRIVER:'postgres',DB_LOCAL_MANAGED:'false',DB_HOST:'db',DB_USER:'app',DB_NAME:'school',DB_PASSWORD:'test-password',DATA_DIR:path.resolve(os.tmpdir(),'eeafr-data'),PUBLIC_URL:'https://escola.example.org',TRUST_PROXY:'1'};
test('produção recusa conexão incompleta, runtime Windows, HTTP e armazenamento relativo',()=>{
 assert.doesNotThrow(()=>validateEnvironment(production));
 for(const changes of [{DB_DRIVER:'pglite'},{DB_PASSWORD:''},{DB_LOCAL_MANAGED:'true'},{DATA_DIR:'relative'},{PUBLIC_URL:'http://escola.example.org'},{PUBLIC_URL:'https://escola.example.org/path'},{PORT:'abc'},{TRUST_PROXY:'true'}])assert.throws(()=>validateEnvironment({...production,...changes}));
});
test('produção real com PostgreSQL: secrets, cookie Secure, origem e conteúdo inicial vazio',{skip:process.env.TEST_DB_DRIVER!=='postgres'},async()=>{
 const fixture=await createDatabaseFixture();const directory=await fs.mkdtemp(path.join(os.tmpdir(),'eeafr-prod-http-'));let server;
 try{
  const password='Production-test-only-password-12345';
  await fs.writeFile(path.join(directory,'admin.txt'),password);
  await fs.writeFile(path.join(directory,'db.txt'),fixture.env.DB_PASSWORD);
  server=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,...fixture.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3019',DATA_DIR:directory,PUBLIC_URL:'https://escola.example.org',TRUST_PROXY:'1',SEED_CONTENT:'false',ADMIN_EMAIL:'production@example.test',ADMIN_PASSWORD:'',ADMIN_PASSWORD_FILE:path.join(directory,'admin.txt'),DB_PASSWORD:'',DB_PASSWORD_FILE:path.join(directory,'db.txt')},stdio:['ignore','pipe','pipe']});
  let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  const base='http://127.0.0.1:3019';let ready=false;
  for(let i=0;i<80;i++){if(server.exitCode!==null)throw new Error(logs);try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'produção iniciou');
  assert.deepEqual((await (await fetch(base+'/api/cursos')).json()).dados,[]);
  assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \/admin\//);
  assert.match(await (await fetch(base+'/sitemap.xml')).text(),/https:\/\/escola.example.org\/pages\/cursos.html/);
  assert.equal((await fetch(base+'/admin/')).headers.get('x-robots-tag'),'noindex, nofollow');
  const json={'Content-Type':'application/json',Origin:'https://escola.example.org','X-Forwarded-Proto':'https'};
  const body=JSON.stringify({email:'production@example.test',senha:password});
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{...json,Origin:'https://intruso.example.org'},body})).status,403);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:json,body});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const user=(await login.json()).dados;
  const headers={...json,Cookie:cookie.split(';')[0],'X-CSRF-Token':user.csrf};
  assert.equal((await fetch(base+'/api/eventos',{method:'POST',headers,body:JSON.stringify({titulo:'Evento em produção',tipo:'evento'})})).status,201);
  assert.equal((await fetch(base+'/backend/.env')).status,404);
  assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers})).status,200);
 }finally{
  if(server?.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
  await fixture.cleanup();await fs.rm(directory,{recursive:true,force:true});
 }
});
test('configuração de deploy valida domínio e e-mails e não sobrescreve segredos',async()=>{
 assert.throws(()=>validateInput('https://site.com','a@site.com','b@site.com'));
 assert.throws(()=>validateInput('site.com\nDB_PASSWORD=bad','a@site.com','b@site.com'));
 assert.throws(()=>validateInput('site.com','a@site.com\nEXTRA=1','b@site.com'));
 const input=validateInput('escola.example.org','contato@example.org','admin@example.org');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'eeafr-deploy-'));
 try{
  await configure(directory,input);
  const before=await fs.readFile(path.join(directory,'deploy/secrets/admin_password.txt'),'utf8');
  assert.ok(before.trim().length>=32);
  assert.ok(!(await fs.readFile(path.join(directory,'.env.production'),'utf8')).includes(before.trim()));
  await assert.rejects(()=>configure(directory,input));
  assert.equal(await fs.readFile(path.join(directory,'deploy/secrets/admin_password.txt'),'utf8'),before);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
