const { test, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createDatabaseFixture } = require('../tests/database-fixture');
const base = 'http://127.0.0.1:3024';
let server, directory, fixture;
test.use({ isMobile: true, hasTouch: true });
test.beforeEach(async ({ page }) => { await page.route('https://**/*', route => route.abort()); });
test.beforeAll(async () => {
 directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eeafr-mobile-test-'));
 fixture = await createDatabaseFixture();
 server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), windowsHide: true,
  env: { ...process.env, ...fixture.env, HOST: '127.0.0.1', PORT: '3024', NODE_ENV: 'test', DATA_DIR: directory,
   ADMIN_EMAIL: 'mobile@example.test', ADMIN_PASSWORD: 'Mobile-test-password-12345' }, stdio: 'pipe' });
 for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 150)); }
 throw Error('Servidor mobile de teste indisponível.');
});
test.afterAll(async () => {
 if (server?.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
 if (fixture) await fixture.cleanup();
 if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 300 });
});
async function fits(page) {
 const dimensions = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
 expect(dimensions.viewport).toBe(dimensions.client);
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
}
async function login(page) {
 await page.goto(base + '/admin/');
 await page.locator('[name=email]').fill('mobile@example.test');
 await page.locator('[name=senha]').fill('Mobile-test-password-12345');
 await page.getByRole('button', { name: 'Entrar no painel' }).click();
 await expect(page.locator('#main h1')).toHaveText('Visão geral');
}
for (const width of [320, 390, 768]) {
 test(`páginas e todas as abas cabem em ${width}px com menu acessível ao toque`, async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 740 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const route of ['/', ...['cursos', 'eventos', 'galeria', 'corpo-docente', 'secretaria-digital', 'contato', 'privacidade', '404'].map(name => '/pages/' + name + '.html')]) {
   await page.goto(base + route); await page.waitForLoadState('networkidle');
   await expect(page.locator('.api-notice')).toHaveCount(0); await fits(page);
   if(await page.locator('#mascote').count()) expect(await page.locator('#mascote').evaluate(el=>getComputedStyle(el).position)).toBe('static');
   for (const tab of await page.locator('.tab-btn').all()) { await tab.tap(); await fits(page); }
   const cta = page.locator('.btn-page');
   if (await cta.count()) { const box = await cta.boundingBox(); expect(box.width).toBeGreaterThan(150); expect(box.height).toBeLessThan(120); }
   const toggle = page.locator('.mobile-menu-toggle');
   await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
   await expect(page.locator('header nav')).toBeVisible(); await fits(page);
   await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
   expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
  expect(errors).toEqual([]);
 });
}
test('menu fecha ao girar a tela e preserva navegação por teclado', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base);
 const toggle = page.locator('.mobile-menu-toggle'); await toggle.tap();
 await page.keyboard.press('Shift+Tab'); await expect(page.locator('header nav a').last()).toBeFocused();
 await page.keyboard.press('Tab'); await expect(toggle).toBeFocused();
 await page.keyboard.press('Escape'); await expect(toggle).toHaveAttribute('aria-expanded', 'false'); await expect(toggle).toBeFocused();
 await toggle.tap(); await page.setViewportSize({ width: 844, height: 390 });
 await expect(page.locator('header nav')).not.toHaveClass(/active/);
 expect(await page.evaluate(() => document.body.style.overflow)).toBe(''); await fits(page);
 await page.setViewportSize({ width: 390, height: 844 }); await toggle.tap();
 await page.locator('header nav a').filter({ hasText: 'Contato' }).tap(); await expect(page).toHaveURL(/contato.html/);
 await page.setViewportSize({ width: 740, height: 360 }); await toggle.tap();
 await page.locator('header nav a').last().tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
test('contato galeria e administração funcionam em celular pequeno', async ({ page }) => {
 test.setTimeout(60000); await page.setViewportSize({ width: 320, height: 740 });
 await page.goto(base + '/pages/galeria.html'); await page.locator('.galeria-foto').first().tap();
 await expect(page.locator('.photo-viewer')).toBeVisible(); await fits(page); await page.getByRole('button', { name: 'Fechar ×' }).tap();
 await page.goto(base + '/pages/contato.html');
 expect(await page.locator('#email').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 for (const [id, value] of Object.entries({ nome: 'Teste mobile', email: 'mobile@example.test', assunto: 'Contato pelo celular', mensagem: 'Mensagem de teste em tela pequena.' })) await page.locator('#' + id).fill(value);
 await page.locator('.contato-form [type=submit]').tap(); await expect(page.locator('.contato-form [role=status]')).toContainText('Protocolo:'); await fits(page);
 await login(page); await fits(page);
 await page.screenshot({path:path.join(__dirname,'../.data/mobile-review/admin-320.png'),fullPage:true});
 for (const name of ['cursos', 'eventos', 'avisos', 'comunicados', 'galeria', 'professores', 'escola', 'usuarios', 'contato', 'senha']) {
  await page.locator('#menu-toggle').tap(); await page.locator(`[data-nav=${name}]`).tap(); await fits(page);
  if (name === 'eventos') {
   await page.getByRole('button', { name: 'Adicionar registro' }).tap(); await page.locator('[name=titulo]').fill('Evento pelo celular');
   const titleBox=await page.locator('#editor-title').boundingBox(),closeBox=await page.locator('#close-editor').boundingBox();
   expect(titleBox.x+titleBox.width).toBeLessThanOrEqual(closeBox.x);
   expect(closeBox.width).toBeGreaterThanOrEqual(44);
   await page.screenshot({path:path.join(__dirname,'../.data/mobile-review/editor-320.png')});
   await page.getByRole('button', { name: 'Salvar alterações' }).tap(); await expect(page.locator('#editor')).not.toBeVisible(); await fits(page);
  }
 }
});
