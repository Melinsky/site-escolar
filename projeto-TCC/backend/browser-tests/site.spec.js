const { test, expect }=require('@playwright/test');
const { spawn }=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
let server,directory,fixture;
const { createDatabaseFixture } = require('../tests/database-fixture');
test.beforeEach(async ({page})=>{await page.route('https://**/*',route=>route.abort());});
test.beforeAll(async()=>{
 directory=await fs.mkdtemp(path.join(os.tmpdir(),'eeafr-browser-'));
 fixture=await createDatabaseFixture();
 server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,...fixture.env,PORT:'3018',HOST:'127.0.0.1',NODE_ENV:'test',DATA_DIR:directory,ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD:'Browser-test-password-12345'},stdio:'pipe'});
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3018/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}
 throw new Error('Servidor de teste indisponível.');
});
test.afterAll(async()=>{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}if(fixture)await fixture.cleanup();if(directory)await fs.rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:300});});
async function login(page){await page.goto('/admin/');await page.locator('#login-form [name=email]').fill('admin@example.test');await page.locator('#login-form [name=senha]').fill('Browser-test-password-12345');await page.getByRole('button',{name:'Entrar no painel'}).click();await expect(page.locator('#main h1')).toHaveText('Visão geral');}
test('todas as páginas públicas carregam pela API sem erros de JavaScript',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const url of ['/','/pages/cursos.html','/pages/eventos.html','/pages/galeria.html','/pages/corpo-docente.html','/pages/secretaria-digital.html','/pages/contato.html']){
  await page.goto(url);await page.waitForLoadState('networkidle');
  await expect(page.locator('.api-notice')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>i.complete && i.naturalWidth===0).map(i=>i.src));expect(broken,url).toEqual([]);
 }
 expect(errors).toEqual([]);
});
test('administrador cria, busca, edita e exclui conteúdo que aparece no site',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);
 await page.locator('[data-nav=eventos]').click();await page.getByRole('button',{name:'Adicionar registro'}).click();
 await page.locator('[name=titulo]').fill('Feira de integração do painel');await page.locator('[name=descricao]').fill('Evento cadastrado pelo painel administrativo.');
 await page.locator('[name=data_evento]').fill('2026-11-21');await page.getByRole('button',{name:'Salvar alterações'}).click();
 await expect(page.locator('#editor')).not.toBeVisible();await page.locator('#search').fill('Feira de integração');
 await expect(page.locator('tbody tr')).toHaveCount(1);
 const publicPage=await context.newPage();await publicPage.goto('/pages/eventos.html');await expect(publicPage.locator('#tab-eventos')).toContainText('Feira de integração do painel');
 await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=titulo]').fill('Feira atualizada no painel');await page.getByRole('button',{name:'Salvar alterações'}).click();
 await expect(page.locator('#editor')).not.toBeVisible();
 await publicPage.reload();await expect(publicPage.locator('#tab-eventos')).toContainText('Feira atualizada no painel');
 await page.locator('#search').fill('Feira atualizada');await page.getByRole('button',{name:'Excluir',exact:true}).click();await page.getByRole('button',{name:'Excluir registro',exact:true}).click();
 await expect(page.getByText('Feira atualizada no painel',{exact:true})).toHaveCount(0);
 await publicPage.reload();await expect(publicPage.locator('#tab-eventos')).not.toContainText('Feira atualizada no painel');await publicPage.close();expect(errors).toEqual([]);
});
test('formulário de contato entrega mensagem na caixa administrativa',async({page})=>{
 await page.goto('/pages/contato.html');await page.locator('#nome').fill('Família teste navegador');await page.locator('#email').fill('familia@example.test');await page.locator('#assunto').fill('Informações de matrícula');await page.locator('#mensagem').fill('Gostaria de conhecer os cursos da escola.');
 await page.locator('.contato-form [type=submit]').click();await expect(page.locator('.contato-form [role=status]')).toContainText('Protocolo:');
 await login(page);await page.locator('[data-nav=contato]').click();await expect(page.locator('tbody')).toContainText('Família teste navegador');
 await page.getByRole('button',{name:'Abrir',exact:true}).click();await expect(page.locator('.message-detail')).toContainText('Gostaria de conhecer os cursos');
 await page.getByRole('button',{name:'Marcar como lida',exact:true}).click();await expect(page.locator('tbody .tag')).toHaveText('Lida');
});
test('galeria amplia imagens e abas funcionam',async({page})=>{
 await page.goto('/pages/galeria.html');await expect(page.locator('.galeria-item')).toHaveCount(12);await page.locator('.galeria-foto').first().click();await expect(page.locator('.photo-viewer')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.photo-viewer')).toHaveCount(0);
 await page.goto('/pages/cursos.html');await expect(page.locator('[data-live-tab]')).toHaveCount(3);await page.locator('[data-live-tab]').nth(2).click();await expect(page.locator('[data-live-panel].active')).toContainText('Desenvolvimento de Sistemas');
});
test('painel e menu público funcionam em celular sem rolagem horizontal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#menu-toggle').click();await expect(page.locator('#sidebar')).toHaveClass(/open/);await page.locator('[data-nav=professores]').click();await expect(page.locator('#sidebar')).not.toHaveClass(/open/);await expect(page.locator('#main h1')).toHaveText('Corpo docente');
 await page.goto('/');await page.locator('.mobile-menu-toggle').click();await expect(page.locator('header nav')).toHaveClass(/active/);await page.keyboard.press('Escape');await expect(page.locator('header nav')).not.toHaveClass(/active/);
});
test('capturas do painel em desktop e celular',async({page})=>{
 await page.setViewportSize({width:1440,height:1080});await login(page);await page.screenshot({path:path.join(__dirname,'../.data/painel-desktop.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../.data/painel-celular.png'),fullPage:true,animations:'disabled'});
});
