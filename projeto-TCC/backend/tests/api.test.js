const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let server, directory, cookie, csrf, editorCookie, editorCsrf, fixture;
const { createDatabaseFixture } = require('./database-fixture');
const base = 'http://127.0.0.1:3017';
async function request(url, method='GET', body, authenticated=false, override={}) {
 const headers={...(authenticated?{Cookie:cookie,'X-CSRF-Token':csrf}:{}),...override};
 if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
 const res=await fetch(base+'/api/'+url,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json(),res};
}
async function start() {
 server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,...fixture.env,PORT:'3017',HOST:'127.0.0.1',NODE_ENV:'test',DATA_DIR:directory,ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD:'Test-only-password-12345'},stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw new Error(output);
  try{const response=await fetch(base+'/api/health');if(response.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 throw new Error('Servidor não iniciou: '+output);
}
async function stop() {if(server?.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}}
before(async()=>{directory=await fs.mkdtemp(path.join(os.tmpdir(),'eeafr-test-'));fixture=await createDatabaseFixture();await start();});
after(async()=>{await stop();if(fixture)await fixture.cleanup();if(directory)await fs.rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:300});});
test('API integrada, autenticação, autorização, upload e persistência',async t=>{
 await t.test('conteúdo inicial e isolamento dos arquivos privados',async()=>{
  for(const name of ['cursos','eventos','avisos','comunicados','galeria','professores']){const response=await request(name);assert.equal(response.status,200);assert.ok(response.data.dados.length>0,name);}
  assert.equal((await request('professores')).data.dados.length,15);
  for(const url of ['/backend/.env','/backend/server.js','/backend/.data/primeiro-acesso.txt','/package.json'])assert.equal((await fetch(base+url)).status,404);
  assert.equal((await request('nao-existe')).status,404);
  assert.equal((await request('contato')).status,401);
  assert.equal((await request('cursos','POST',{nome:'Intruso'})).status,401);
 });
 await t.test('login e proteção CSRF',async()=>{
  assert.equal((await request('auth/login','POST',{email:'admin@example.test',senha:'errada'})).status,401);
  const login=await request('auth/login','POST',{email:'admin@example.test',senha:'Test-only-password-12345'});
  assert.equal(login.status,200);cookie=login.res.headers.get('set-cookie').split(';')[0];csrf=login.data.dados.csrf;
  assert.match(login.res.headers.get('set-cookie'),/HttpOnly/);assert.match(login.res.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await request('auth/me','GET',null,true)).data.dados.papel,'admin');
  assert.equal((await request('cursos','POST',{nome:'Sem CSRF'},false,{Cookie:cookie})).status,403);
 });
 await t.test('CRUD de todos os recursos e validação',async()=>{
  const payloads={cursos:{nome:'Curso de teste',vagas:5},eventos:{titulo:'Evento de teste',tipo:'evento',data_evento:'2026-11-21'},avisos:{titulo:'Aviso de teste',tipo:'importante'},comunicados:{titulo:'Comunicado de teste',tag:'novidade'},galeria:{titulo:'Foto de teste',caminho_imagem:'imagens/Escola/Patio.jpeg',ordem:0},professores:{nome:'Professor de teste',area:'Exatas'},escola:{campo:'teste_integracao',valor:'Inicial'}};
  for(const [resource,body]of Object.entries(payloads)){
   const created=await request(resource,'POST',body,true);assert.equal(created.status,201,JSON.stringify(created.data));
   const key=resource==='escola'?created.data.dados.campo:created.data.dados.id;
   assert.equal((await request(resource+'/'+key)).status,200);
   const changed=resource==='escola'?{valor:'Atualizado'}:resource==='cursos'||resource==='professores'?{nome:'Atualizado'}:{titulo:'Atualizado'};
   const update=await request(resource+'/'+key,'PUT',changed,true);assert.equal(update.status,200);assert.equal(update.data.dados[Object.keys(changed)[0]],'Atualizado');
   assert.equal((await request(resource+'/'+key,'DELETE',null,true)).status,200);
   assert.equal((await request(resource+'/'+key)).status,404);
  }
  assert.equal((await request('cursos','POST',{nome:'',vagas:-3},true)).status,400);
  assert.equal((await request('eventos','POST',{titulo:'Inválido',tipo:'evento',data_evento:'2026-02-30'},true)).status,400);
  assert.equal((await request('professores','POST',{nome:'Teste',area:'Inexistente'},true)).status,400);
  assert.equal((await request('galeria','POST',{titulo:'XSS',caminho_imagem:'javascript:alert(1)'},true)).status,400);
  assert.equal((await request('galeria','POST',{titulo:'Travessia',caminho_imagem:'imagens/../../backend/secret.png'},true)).status,400);
  assert.equal((await request('cursos/invalido')).status,400);
  assert.equal((await request('cursos/999999','PUT',{nome:'X'},true)).status,404);
 });
 await t.test('contato público, leitura privada e auditoria',async()=>{
  assert.equal((await request('contato','POST',{nome:'Teste',email:'invalido',assunto:'Teste',mensagem:'Teste'})).status,400);
  const created=await request('contato','POST',{nome:'Responsável',email:'familia@example.test',assunto:'Matrícula',mensagem:'Quero informações sobre vagas.'});assert.equal(created.status,201);
  const id=created.data.dados.id;
  assert.equal((await request('contato','GET',null,true)).data.dados[0].lida,false);
  assert.equal((await request(`contato/${id}/lida`,'PUT',{lida:true},true)).data.dados.lida,true);
  const stats=await request('admin/stats','GET',null,true);assert.equal(stats.data.dados.counts.nao_lidas,0);assert.ok(stats.data.dados.activity.length);
  assert.equal((await request('contato/'+id,'DELETE',null,true)).status,200);
 });
 await t.test('upload autenticado e validação de tipo',async()=>{
  const bad=new FormData();bad.append('imagem',new Blob(['<svg onload="alert(1)">']), 'x.png');assert.equal((await request('admin/upload','POST',bad,true)).status,400);
  const good=new FormData();good.append('imagem',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKe8AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'image.png');
  const upload=await request('admin/upload','POST',good,true);assert.equal(upload.status,201);assert.equal((await fetch(base+upload.data.dados.caminho_imagem)).status,200);
 });
 await t.test('editor pode publicar e não pode administrar acessos',async()=>{
  const created=await request('admin/usuarios','POST',{nome:'Editor de teste',email:'editor@example.test',senha:'Editor-password-12345',papel:'editor',ativo:true},true);assert.equal(created.status,201);assert.equal(created.data.dados.senha_hash,undefined);
  const login=await request('auth/login','POST',{email:'editor@example.test',senha:'Editor-password-12345'});editorCookie=login.res.headers.get('set-cookie').split(';')[0];editorCsrf=login.data.dados.csrf;
  const headers={Cookie:editorCookie,'X-CSRF-Token':editorCsrf};
  assert.equal((await request('admin/usuarios','GET',null,false,headers)).status,403);
  assert.equal((await request('admin/usuarios','POST',{nome:'Intruso'},false,headers)).status,403);
  const post=await request('avisos','POST',{titulo:'Publicação por editor',tipo:'informativo'},false,headers);assert.equal(post.status,201);
  await request('avisos/'+post.data.dados.id,'DELETE',null,false,headers);
  assert.equal((await request('admin/usuarios/1','PUT',{ativo:false},true)).status,400);
  await request('admin/usuarios/'+created.data.dados.id,'PUT',{ativo:false},true);
  assert.equal((await request('auth/me','GET',null,false,headers)).status,401);
 });
 await t.test('banco persiste e seed não duplica depois de reiniciar',async()=>{
  const before=(await request('cursos')).data.dados.length;
  await request('escola','POST',{campo:'persistencia_teste',valor:'Preservado após reiniciar'},true);
  await stop();await start();
  assert.equal((await request('cursos')).data.dados.length,before);
  assert.equal((await request('escola/persistencia_teste')).data.dados.valor,'Preservado após reiniciar');
  assert.equal((await request('auth/me','GET',null,true)).status,200);
 });
 await t.test('troca de senha invalida sessões',async()=>{
  assert.equal((await request('auth/senha','PUT',{atual:'Test-only-password-12345',nova:'Nova-senha-teste-12345'},true)).status,200);
  assert.equal((await request('auth/me','GET',null,true)).status,401);
  assert.equal((await request('auth/login','POST',{email:'admin@example.test',senha:'Test-only-password-12345'})).status,401);
  assert.equal((await request('auth/login','POST',{email:'admin@example.test',senha:'Nova-senha-teste-12345'})).status,200);
 });
});
