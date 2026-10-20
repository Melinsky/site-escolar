const crypto = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('./config/database');
const scrypt = promisify(crypto.scrypt);
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
async function verify(password, saved) {
  const [salt, value] = saved.split(':');
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(value, 'hex'));
}
async function bootstrap() {
  if ((await db.query('SELECT id FROM usuarios LIMIT 1')).rows.length) return;
  if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD para o primeiro acesso em produção.');
  const email = process.env.ADMIN_EMAIL || 'admin@eeafr.local';
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  if (password.length < 12 || password.length > 200) throw new Error('ADMIN_PASSWORD deve ter entre 12 e 200 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>200) throw new Error('ADMIN_EMAIL inválido.');
  await db.query('INSERT INTO usuarios(nome,email,senha_hash,papel) VALUES ($1,$2,$3,$4)', ['Administrador', email.toLowerCase(), await hash(password), 'admin']);
  if (!process.env.ADMIN_PASSWORD) {
    await fs.writeFile(path.join(db.dataDir, 'primeiro-acesso.txt'), `Painel: http://localhost:${process.env.PORT || 3000}/admin/\nE-mail: ${email}\nSenha: ${password}\nTroque a senha no painel após entrar.\n`, { mode: 0o600 });
    console.log('Credenciais iniciais salvas em backend/.data/primeiro-acesso.txt');
  }
}
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600000 };
function token(req) { return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('eeafr_session='))?.slice(14); }
const requireAuth = wrap(async (req, res, next) => {
  const value = token(req);
  if (!value) throw fail(401, 'Entre no painel para continuar.');
  const { rows } = await db.query('SELECT u.id,u.nome,u.email,u.papel,s.csrf FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=$1 AND s.expira>CURRENT_TIMESTAMP AND u.ativo=TRUE', [digest(value)]);
  if (!rows.length) throw fail(401, 'Sua sessão expirou. Entre novamente.');
  req.user = rows[0];
  if (!['GET','HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== req.user.csrf) throw fail(403, 'Sessão inválida. Recarregue a página.');
  next();
});
function adminOnly(req, res, next) { if (req.user.papel !== 'admin') return next(fail(403, 'Apenas administradores podem fazer isso.')); next(); }
function routes(router, limiter) {
  router.post('/auth/login', limiter, wrap(async (req, res) => {
    const { email, senha } = req.body || {};
    if (typeof email !== 'string' || typeof senha !== 'string' || senha.length > 200) throw fail(400, 'Informe e-mail e senha.');
    const user = (await db.query('SELECT * FROM usuarios WHERE email=$1 AND ativo=TRUE', [email.trim().toLowerCase()])).rows[0];
    if (!user || !(await verify(senha, user.senha_hash))) throw fail(401, 'E-mail ou senha incorretos.');
    const value = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(32).toString('hex');
    await db.query('DELETE FROM sessoes WHERE expira<CURRENT_TIMESTAMP');
    await db.query('INSERT INTO sessoes(token_hash,usuario_id,csrf,expira) VALUES ($1,$2,$3,$4)', [digest(value), user.id, csrf, new Date(Date.now() + 8 * 3600000)]);
    res.cookie('eeafr_session', value, cookieOptions).json({ erro: false, dados: { id: user.id, nome: user.nome, email: user.email, papel: user.papel, csrf } });
  }));
  router.get('/auth/me', requireAuth, (req, res) => res.json({ erro: false, dados: req.user }));
  router.post('/auth/logout', requireAuth, wrap(async (req, res) => {
    await db.query('DELETE FROM sessoes WHERE token_hash=$1', [digest(token(req))]);
    res.clearCookie('eeafr_session', { ...cookieOptions, maxAge: undefined }).json({ erro: false });
  }));
  router.put('/auth/senha', requireAuth, wrap(async (req, res) => {
    const { atual, nova } = req.body || {};
    if (typeof atual !== 'string' || atual.length > 200 || typeof nova !== 'string' || nova.length < 12 || nova.length > 200) throw fail(400, 'A nova senha deve ter entre 12 e 200 caracteres.');
    const user = (await db.query('SELECT senha_hash FROM usuarios WHERE id=$1', [req.user.id])).rows[0];
    if (!(await verify(atual, user.senha_hash))) throw fail(400, 'Senha atual incorreta.');
    await db.transaction(async client => {
      await client.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [await hash(nova), req.user.id]);
      await client.query('DELETE FROM sessoes WHERE usuario_id=$1', [req.user.id]);
    });
    res.clearCookie('eeafr_session', { ...cookieOptions, maxAge: undefined }).json({ erro: false });
  }));
}
module.exports = { wrap, fail, hash, requireAuth, adminOnly, bootstrap, routes };
