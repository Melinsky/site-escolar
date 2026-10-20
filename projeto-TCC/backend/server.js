require('./config/environment').loadEnvironment();
const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const db = require('./config/database');
const auth = require('./auth');
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(helmet({ contentSecurityPolicy: { directives: {
 defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
 fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'],
 frameSrc: ['https://www.google.com', 'https://maps.google.com'], connectSrc: ["'self'"],
 upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
} }, strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false,
 crossOriginOpenerPolicy: { policy: 'same-origin' } }));
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req,res,next) => {
 if (process.env.NODE_ENV==='production' && !['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin!==new URL(process.env.PUBLIC_URL).origin)
  return res.status(403).json({erro:true,mensagem:'Origem da requisição não autorizada.'});
 next();
});
app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); res.set('X-Robots-Tag','noindex, nofollow'); next(); }, require('./api'));
app.use('/api', (req,res) => res.status(404).json({ erro:true, mensagem:'Rota não encontrada.' }));
app.use('/uploads', express.static(path.join(db.dataDir,'uploads'), { dotfiles:'deny' }));
app.use('/admin', (req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow');res.set('Cache-Control','no-store');next();});
app.get('/robots.txt',(req,res)=>res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n'+(process.env.PUBLIC_URL?'Sitemap: '+new URL('/sitemap.xml',process.env.PUBLIC_URL).href+'\n':'')));
app.get('/sitemap.xml',(req,res)=>{
 if(!process.env.PUBLIC_URL)return res.status(404).type('text/plain').send('Configure PUBLIC_URL para publicar o sitemap.');
 const pages=['/','/pages/cursos.html','/pages/eventos.html','/pages/galeria.html','/pages/corpo-docente.html','/pages/secretaria-digital.html','/pages/contato.html','/pages/privacidade.html'];
 res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(route=>'<url><loc>'+new URL(route,process.env.PUBLIC_URL).href+'</loc></url>').join('')+'</urlset>');
});
// Expose only public directories. Never serve backend sources, credentials or database files.
for (const folder of ['CSS','js','imagens','pages','admin']) app.use('/'+folder, express.static(path.join(__dirname,'..',folder), { dotfiles:'deny' }));
app.get(['/', '/index.html'], (req,res) => res.sendFile(path.join(__dirname,'../index.html')));
app.use((req,res) => res.status(404).sendFile(path.join(__dirname,'../pages/404.html')));
app.use(require('./middleware/errorHandler'));
async function start() {
 if (process.env.DB_DRIVER === 'postgres' && process.env.DB_LOCAL_MANAGED === 'true') await require('./scripts/postgres-local').start();
 await db.init(); await auth.bootstrap();
 const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`EEAFR: ${process.env.PUBLIC_URL || 'http://localhost:'+(process.env.PORT || 3000)} | Painel: /admin/`));
 server.on('error', async error => { console.error('Falha ao abrir servidor:',error.message); await db.close();process.exit(1); });
 let stopping=false;
 async function shutdown() {
  if(stopping)return;stopping=true;
  const deadline=setTimeout(()=>process.exit(1),15000);deadline.unref();
  server.close(async () => { try { await db.close();process.exit(0); } catch { process.exit(1); } });
  server.closeIdleConnections();
 }
 process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
 return server;
}
if (require.main === module) start().catch(async error => { console.error('Falha ao iniciar:',error.message); await db.close(); process.exit(1); });
module.exports = { app, start };
