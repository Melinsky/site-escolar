const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('./config/database');
const auth = require('./auth');
const { wrap, fail, requireAuth, adminOnly } = auth;
const resources = require('./resources');
const router = express.Router();
const limit = (max, windowMs) => rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
 message: { erro: true, mensagem: 'Muitas tentativas. Aguarde alguns minutos.' } });
auth.routes(router, limit(10, 15 * 60000));
const ok = (res, dados, status = 200) => res.status(status).json({ erro: false, dados });
function validate(fields, body, partial = false) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Dados inválidos.');
 const result = {};
 for (const [key, field] of Object.entries(fields)) {
  if (!(key in body)) { if (!partial && field.required) throw fail(400, `Preencha: ${field.label}.`); continue; }
  let value = body[key];
  if (field.type === 'checkbox') { if (typeof value !== 'boolean') throw fail(400, `${field.label}: valor inválido.`); }
  else if (field.type === 'number') {
   if (typeof value !== 'number' || !Number.isInteger(value) || value < field.min || value > field.max) throw fail(400, `${field.label}: informe um número entre ${field.min} e ${field.max}.`);
  } else if (field.type === 'date') {
   if (value === '' || value === null) value = null;
   else if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw fail(400, `${field.label}: data inválida.`);
  } else {
   if (typeof value !== 'string') throw fail(400, `${field.label}: texto inválido.`);
   value = value.trim();
   if ((field.required && !value) || value.length > (field.max || 200)) throw fail(400, `Verifique: ${field.label}.`);
   if (field.options && !field.options.includes(value)) throw fail(400, `${field.label}: opção inválida.`);
   if (field.type === 'email') { value = value.toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw fail(400, 'E-mail inválido.'); }
   if (field.type === 'image' && !/^(?:\/?imagens\/|\/uploads\/)[^?#]*\.(?:png|jpe?g|webp)$/i.test(value)) throw fail(400, 'Use uma imagem local JPG, PNG ou WebP.');
   if (field.type === 'image' && value.split('/').includes('..')) throw fail(400, 'Caminho da imagem inválido.');
   if (key === 'campo' && !/^[a-z][a-z0-9_]{0,99}$/.test(value)) throw fail(400, 'Use letras minúsculas, números e _ no identificador.');
  }
  result[key] = value;
 }
 if (!Object.keys(result).length) throw fail(400, 'Nenhum campo informado.');
 return result;
}
async function audit(client, req, action, resource, id) {
 await client.query('INSERT INTO auditoria(usuario_id,autor,acao,recurso,registro) VALUES ($1,$2,$3,$4,$5)', [req.user.id, req.user.nome, action, resource, String(id)]);
}
async function insert(client, table, values) {
 const keys = Object.keys(values);
 return (await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i) => '$' + (i+1)).join(',')}) RETURNING *`, Object.values(values))).rows[0];
}
router.get('/health', wrap(async (req, res) => { await db.query('SELECT 1'); ok(res, { status: 'ok' }); }));
router.get('/admin/resources', requireAuth, (req,res) => ok(res, resources));
router.get('/admin/stats', requireAuth, wrap(async (req,res) => {
 const counts = {};
 for (const [key,resource] of Object.entries(resources)) counts[key] = Number((await db.query(`SELECT COUNT(*) AS total FROM ${resource.table}`)).rows[0].total);
 counts.mensagens = Number((await db.query('SELECT COUNT(*) AS total FROM contato_mensagens')).rows[0].total);
 counts.nao_lidas = Number((await db.query('SELECT COUNT(*) AS total FROM contato_mensagens WHERE lida=FALSE')).rows[0].total);
 const recent = (await db.query('SELECT id,nome,assunto,lida,created_at FROM contato_mensagens ORDER BY id DESC LIMIT 5')).rows;
 const activity = (await db.query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 12')).rows;
 ok(res, { counts, recent, activity });
}));
for (const [resource, config] of Object.entries(resources)) {
 const { table, fields, order } = config;
 const key = config.key || 'id';
 router.get('/' + resource, wrap(async (req,res) => {
  const filter = resource === 'professores' ? 'area' : resource === 'eventos' ? 'tipo' : null;
  const rows = (await db.query(`SELECT * FROM ${table}${filter && req.query[filter] ? ` WHERE ${filter}=$1` : ''} ORDER BY ${order}`, filter && req.query[filter] ? [String(req.query[filter])] : [])).rows;
  ok(res, resource === 'escola' ? Object.fromEntries(rows.map(r => [r.campo,r.valor])) : rows);
 }));
 router.get('/' + resource + '/:id', wrap(async (req,res) => {
  if (key === 'id' && !/^[1-9]\d*$/.test(req.params.id)) throw fail(400, 'Identificador inválido.');
  const row = (await db.query(`SELECT * FROM ${table} WHERE ${key}=$1`, [req.params.id])).rows[0];
  if (!row) throw fail(404, 'Registro não encontrado.'); ok(res,row);
 }));
 router.post('/' + resource, requireAuth, wrap(async (req,res) => {
  const values = validate(fields,req.body);
  const row = await db.transaction(async client => { const row = await insert(client,table,values); await audit(client,req,'criar',resource,row[key]); return row; });
  ok(res,row,201);
 }));
 router.put('/' + resource + '/:id', requireAuth, wrap(async (req,res) => {
  if (key === 'id' && !/^[1-9]\d*$/.test(req.params.id)) throw fail(400, 'Identificador inválido.');
  const values = validate(fields,req.body,true); if (key === 'campo') delete values.campo;
  const keys = Object.keys(values); if (!keys.length) throw fail(400,'Informe o valor.');
  const row = await db.transaction(async client => {
   const row = (await client.query(`UPDATE ${table} SET ${keys.map((k,i) => k + '=$' + (i+1)).join(',')}${['cursos','escola'].includes(resource) ? ',updated_at=CURRENT_TIMESTAMP' : ''} WHERE ${key}=$${keys.length+1} RETURNING *`, [...Object.values(values), req.params.id])).rows[0];
   if (!row) throw fail(404,'Registro não encontrado.'); await audit(client,req,'editar',resource,row[key]); return row;
  }); ok(res,row);
 }));
 router.delete('/' + resource + '/:id', requireAuth, wrap(async (req,res) => {
  if (key === 'id' && !/^[1-9]\d*$/.test(req.params.id)) throw fail(400,'Identificador inválido.');
  await db.transaction(async client => {
   const row = (await client.query(`DELETE FROM ${table} WHERE ${key}=$1 RETURNING *`, [req.params.id])).rows[0];
   if (!row) throw fail(404,'Registro não encontrado.'); await audit(client,req,'excluir',resource,req.params.id);
  }); ok(res,null);
 }));
}
router.post('/contato', limit(5, 15 * 60000), wrap(async (req,res) => {
 const fields = { nome: {label:'Nome',max:200,required:true},email: {label:'E-mail',type:'email',max:200,required:true},assunto:{label:'Assunto',max:200,required:true},mensagem:{label:'Mensagem',max:10000,required:true} };
 const row = await insert(db,'contato_mensagens',validate(fields,req.body)); ok(res,{ id:row.id },201);
}));
router.get('/contato', requireAuth, wrap(async (req,res) => ok(res,(await db.query('SELECT * FROM contato_mensagens ORDER BY id DESC')).rows)));
router.put('/contato/:id/lida', requireAuth, wrap(async (req,res) => {
 const value = validate({lida:{label:'Lida',type:'checkbox'}},req.body);
 if (!/^[1-9]\d*$/.test(req.params.id)) throw fail(400,'Identificador inválido.');
 const row = await db.transaction(async client => {
  const row = (await client.query('UPDATE contato_mensagens SET lida=$1 WHERE id=$2 RETURNING *',[value.lida,req.params.id])).rows[0];
  if (!row) throw fail(404,'Mensagem não encontrada.'); await audit(client,req,'editar','contato',row.id); return row;
 }); ok(res,row);
}));
router.delete('/contato/:id', requireAuth, wrap(async (req,res) => {
 if (!/^[1-9]\d*$/.test(req.params.id)) throw fail(400,'Identificador inválido.');
 await db.transaction(async client => {
  if (!(await client.query('DELETE FROM contato_mensagens WHERE id=$1 RETURNING id',[req.params.id])).rows.length) throw fail(404,'Mensagem não encontrada.');
  await audit(client,req,'excluir','contato',req.params.id);
 }); ok(res,null);
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024, files: 1, fields: 0 } });
router.post('/admin/upload', requireAuth, upload.single('imagem'), wrap(async (req,res) => {
 const b = req.file?.buffer;
 const ext = b && b.length > 12 ? b.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'jpg' : b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP' ? 'webp' : null : null;
 if (!ext) throw fail(400,'Envie uma imagem JPG, PNG ou WebP válida.');
 const folder = path.join(db.dataDir,'uploads'); await fs.mkdir(folder,{recursive:true});
 const name = crypto.randomUUID() + '.' + ext; await fs.writeFile(path.join(folder,name),b);
 ok(res,{ caminho_imagem: '/uploads/' + name },201);
}));
router.get('/admin/usuarios', requireAuth, adminOnly, wrap(async (req,res) => ok(res,(await db.query('SELECT id,nome,email,papel,ativo,created_at FROM usuarios ORDER BY id')).rows)));
const userFields = { nome:{label:'Nome',max:100,required:true},email:{label:'E-mail',type:'email',max:200,required:true},papel:{label:'Perfil',type:'select',options:['admin','editor'],required:true},ativo:{label:'Ativo',type:'checkbox'},senha:{label:'Senha',max:200} };
router.post('/admin/usuarios', requireAuth, adminOnly, wrap(async (req,res) => {
 const values = validate(userFields,req.body);
 if (!values.senha || values.senha.length < 12) throw fail(400,'A senha deve ter pelo menos 12 caracteres.');
 values.senha_hash = await auth.hash(values.senha); delete values.senha;
 const row = await db.transaction(async client => { const row = await insert(client,'usuarios',values); await audit(client,req,'criar','usuarios',row.id); return row; });
 delete row.senha_hash; ok(res,row,201);
}));
router.put('/admin/usuarios/:id', requireAuth, adminOnly, wrap(async (req,res) => {
 if (!/^[1-9]\d*$/.test(req.params.id)) throw fail(400,'Identificador inválido.');
 const values = validate(userFields,req.body,true);
 if (Number(req.params.id) === req.user.id && (values.papel === 'editor' || values.ativo === false)) throw fail(400,'Você não pode remover seu próprio acesso administrativo.');
 if (values.senha) { if (values.senha.length < 12) throw fail(400,'A senha deve ter pelo menos 12 caracteres.'); values.senha_hash = await auth.hash(values.senha); }
 delete values.senha;
 const keys = Object.keys(values); if (!keys.length) throw fail(400,'Nenhuma alteração informada.');
 const row = await db.transaction(async client => {
  const row = (await client.query(`UPDATE usuarios SET ${keys.map((k,i) => k+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1} RETURNING id,nome,email,papel,ativo`,[...Object.values(values),req.params.id])).rows[0];
  if (!row) throw fail(404,'Usuário não encontrado.');
  await client.query('DELETE FROM sessoes WHERE usuario_id=$1',[row.id]); await audit(client,req,'editar','usuarios',row.id); return row;
 }); ok(res,row);
}));
module.exports = router;
