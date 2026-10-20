(() => {
 const $ = selector => document.querySelector(selector);
 const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date = value => value ? new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—';
 let user, resources={}, current='overview', records=[], page=1, search='', filter='', editRow=null, generation=0;
 const icons={overview:'◫',cursos:'▤',eventos:'▦',avisos:'♧',comunicados:'☷',galeria:'▧',professores:'♙',escola:'⌂',contato:'✉',usuarios:'♧',senha:'⚙'};
 const labels={overview:'Visão geral',contato:'Mensagens',usuarios:'Usuários e acessos',senha:'Minha conta'};
 const apiPath=key=>key==='usuarios'?'admin/usuarios':key;
 let toastTimer;
 function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
 function loginScreen(){user=null;$('#app').hidden=true;$('#login-screen').hidden=false;$('#editor').close();}
 async function api(path,options={}){
  const headers={...options.headers};
  if(options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  if(user)headers['X-CSRF-Token']=user.csrf;
  const response=await fetch('/api/'+path,{...options,headers});
  const result=await response.json();
  if(!response.ok || result.erro){if(response.status===401 && path!=='auth/login')loginScreen();throw new Error(result.mensagem || 'Não foi possível concluir a operação.');}
  return result.dados;
 }
 async function initialize(){
  resources=await api('admin/resources');
  Object.entries(resources).forEach(([key,value])=>labels[key]=value.label);
  $('#app').hidden=false;$('#login-screen').hidden=true;$('#profile-name').textContent=user.nome;$('#avatar').textContent=user.nome.split(' ').map(s=>s[0]).slice(0,2).join('');
  $('#navigation').innerHTML=['overview',...Object.keys(resources),'contato',...(user.papel==='admin'?['usuarios']:[]),'senha'].map(key=>`<a href="#${key}" data-nav="${key}"><span class="nav-icon">${icons[key]}</span>${esc(labels[key])}${key==='contato'?'<span class="nav-count" id="unread-count">0</span>':''}</a>`).join('');
  await navigate();
 }
 $('#today').textContent=new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'});
 $('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('#login-error').textContent='';
  try{user=await api('auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});event.target.reset();await initialize();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}
 });
 $('#logout').onclick=async()=>{try{await api('auth/logout',{method:'POST'});loginScreen();}catch(error){toast(error.message);}};
 $('#profile-button').onclick=()=>{location.hash='senha';};
 $('#menu-toggle').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',open);};
 $('#menu-backdrop').onclick=()=>{$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
 window.addEventListener('hashchange',()=>{if(user)navigate();});
 async function navigate(){
  const revision=++generation;
  current=location.hash.slice(1)||'overview'; if(!labels[current] || (current==='usuarios' && user.papel!=='admin'))current='overview';
  search='';filter='';page=1;
  $('#breadcrumb').textContent=labels[current];document.title=labels[current]+' · EEAFR';
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===current));
  $('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');$('#main').innerHTML='<p class="empty-state">Carregando informações…</p>';
  try{
   if(current==='overview'){const data=await api('admin/stats');if(revision!==generation)return;renderOverview(data);}
   else if(current==='senha')renderAccount();
   else {const data=await api(apiPath(current));if(revision!==generation)return;records=current==='escola'?Object.entries(data).map(([campo,valor])=>({campo,valor})):data;renderList();}
  }catch(error){if(revision===generation)$('#main').innerHTML=`<div class="empty-state"><h3>Não foi possível carregar</h3><p>${esc(error.message)}</p><button class="secondary" id="retry">Tentar novamente</button></div>`;$('#retry')?.addEventListener('click',navigate);}
 }
 function heading(title,description,action=''){return `<div class="page-heading"><div><span class="eyebrow">PAINEL ADMINISTRATIVO</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`;}
 function renderOverview({counts,recent,activity}){
  $('#unread-count').textContent=counts.nao_lidas;
  const contentKeys=['cursos','eventos','avisos','comunicados','galeria','professores'];const max=Math.max(1,...contentKeys.map(k=>counts[k]));
  $('#main').innerHTML=heading('Visão geral','Acompanhe o site e mantenha a comunidade escolar informada.','<span class="status-pill"><span class="live-dot"></span> Sistema conectado</span>')+`<section class="welcome-banner"><div><span class="eyebrow">BOM TER VOCÊ POR AQUI</span><h2>Olá, ${esc(user.nome.split(' ')[0])}. Vamos cuidar da escola?</h2><p>As novidades começam aqui. Organize os conteúdos, acompanhe as mensagens e mantenha nosso site sempre atualizado.</p></div><div class="banner-icon" aria-hidden="true">⌂</div></section><div class="stats-grid">${[['Cursos publicados',counts.cursos,'Formação para o futuro','▤'],['Eventos cadastrados',counts.eventos,'Agenda da comunidade','▦'],['Mensagens recebidas',counts.mensagens,counts.nao_lidas+' aguardando leitura','✉'],['Professores',counts.professores,'Nossa equipe de ensino','♙']].map(([label,value,caption,icon])=>`<article class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><small>${caption}</small></article>`).join('')}</div><div class="dashboard-grid"><div><section class="panel"><div class="panel-heading"><div><h2>Mensagens recentes</h2><p>O que a comunidade está dizendo</p></div><a href="#contato">Ver todas →</a></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Remetente / assunto</th><th>Data</th><th>Status</th></tr></thead><tbody>${recent.map(m=>`<tr><td><strong>${esc(m.nome)}</strong><small>${esc(m.assunto)}</small></td><td>${date(m.created_at)}</td><td><span class="tag ${m.lida?'green':'orange'}">${m.lida?'Lida':'Nova'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h3>Sua caixa de entrada está em dia</h3>As mensagens enviadas pelo site aparecerão aqui.</div>'}</section><section class="panel"><div class="panel-heading"><div><h2>Acesso rápido</h2><p>Suas próximas ações, a um clique</p></div></div><div class="panel-body quick-grid">${[['eventos','Novo evento','Atualize a agenda'],['avisos','Publicar aviso','Informe a comunidade'],['galeria','Adicionar foto','Compartilhe momentos'],['professores','Adicionar professor','Mantenha a equipe atualizada']].map(([key,title,caption])=>`<button class="quick-action" data-quick="${key}"><span>${icons[key]}</span><div><strong>${title}</strong><small>${caption}</small></div></button>`).join('')}</div></section></div><div><section class="panel"><div class="panel-heading"><div><h2>Conteúdo do site</h2><p>Distribuição das publicações</p></div><span class="tag">${contentKeys.reduce((s,k)=>s+counts[k],0)} itens</span></div><div class="panel-body">${contentKeys.map(k=>`<div class="bar-row"><span>${esc(k==='professores'?'Professores':labels[k].split(' e ')[0])}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(counts[k]/max*100)}%"></div></div><b>${counts[k]}</b></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><div><h2>Atividade recente</h2><p>Histórico de alterações da equipe</p></div></div><div class="panel-body">${activity.length?activity.slice(0,5).map(a=>`<div class="activity"><span class="activity-icon">↻</span><div><strong>${esc(a.autor)} · ${esc({criar:'criou',editar:'editou',excluir:'excluiu'}[a.acao]||a.acao)} em ${esc(labels[a.recurso]||a.recurso)}</strong><small>${date(a.created_at)} · registro ${esc(a.registro)}</small></div></div>`).join(''):'<p class="empty-state">As alterações realizadas no painel aparecerão aqui.</p>'}</div></section></div></div>`;
  document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=async()=>{const key=b.dataset.quick;location.hash=key;await new Promise(r=>setTimeout(r,0));if(current===key)openEditor(null);});
 }
 function getFields(){
  if(current==='usuarios')return {nome:{label:'Nome',required:true,max:100},email:{label:'E-mail',type:'email',required:true,max:200},papel:{label:'Perfil',type:'select',options:['admin','editor'],required:true},ativo:{label:'Conta ativa',type:'checkbox'},senha:{label:editRow?'Nova senha (deixe vazio para manter)':'Senha (mínimo 12 caracteres)',type:'password',required:!editRow,max:200}};
  return resources[current]?.fields || {};
 }
 function renderList(){
  const messaging=current==='contato';
  const description=messaging?'Leia as solicitações recebidas pelo formulário de contato.':current==='usuarios'?'Administradores gerenciam acessos. Editores podem atualizar o conteúdo do site.':'As alterações salvas aqui são exibidas nas páginas públicas do site.';
  const optionField=Object.entries(getFields()).find(([,f])=>f.options);
  $('#main').innerHTML=heading(labels[current],description,messaging?'':`<button class="primary" id="new-record">＋ Adicionar ${current==='usuarios'?'usuário':'registro'}</button>`)+`<section class="panel"><div class="toolbar"><input type="search" id="search" class="search" placeholder="Buscar nesta seção…" aria-label="Buscar registros">${messaging?'<select id="filter" aria-label="Filtrar mensagens"><option value="">Todas as mensagens</option><option value="unread">Não lidas</option><option value="read">Lidas</option></select>':optionField?`<select id="filter" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${optionField[1].options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>`:''}<button class="secondary" id="refresh">↻ Atualizar</button></div><div id="records"></div></section>`;
  $('#new-record')?.addEventListener('click',()=>openEditor(null));
  $('#refresh').onclick=navigate;
  $('#search').oninput=e=>{search=e.target.value.toLocaleLowerCase('pt-BR');page=1;renderRows();};
  $('#filter')?.addEventListener('change',e=>{filter=e.target.value;page=1;renderRows();});
  renderRows();
 }
 function renderRows(){
  const optionField=Object.entries(getFields()).find(([,f])=>f.options)?.[0];
  const filtered=records.filter(row=>(!search || Object.values(row).join(' ').toLocaleLowerCase('pt-BR').includes(search)) && (!filter || (current==='contato'?(filter==='read'?row.lida:!row.lida):row[optionField]===filter)));
  const pages=Math.max(1,Math.ceil(filtered.length/10));page=Math.min(page,pages);
  const visible=filtered.slice((page-1)*10,page*10);
  let cols=['Conteúdo','Detalhes','Atualização','Ações'];
  if(current==='contato')cols=['Remetente / assunto','E-mail','Status','Ações'];
  if(current==='escola')cols=['Identificador','Valor','Ações'];
  if(current==='usuarios')cols=['Usuário','Perfil','Status','Ações'];
  $('#records').innerHTML=visible.length?`<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${visible.map(row=>{
   const key=String(row.campo||row.id);const action=`<div class="row-actions"><button data-edit="${esc(key)}">${current==='contato'?'Abrir':'Editar'}</button>${current==='usuarios'?'':`<button class="delete" data-delete="${esc(key)}">Excluir</button>`}</div>`;
   if(current==='escola')return `<tr><td><strong>${esc(row.campo)}</strong></td><td>${esc(row.valor)}</td><td>${action}</td></tr>`;
   if(current==='contato')return `<tr><td><strong>${esc(row.nome)}</strong><small>${esc(row.assunto)}</small></td><td>${esc(row.email)}</td><td><span class="tag ${row.lida?'green':'orange'}">${row.lida?'Lida':'Nova'}</span></td><td>${action}</td></tr>`;
   if(current==='usuarios')return `<tr><td><strong>${esc(row.nome)}</strong><small>${esc(row.email)}</small></td><td><span class="tag">${esc(row.papel)}</span></td><td><span class="tag ${row.ativo?'green':'orange'}">${row.ativo?'Ativo':'Inativo'}</span></td><td>${action}</td></tr>`;
   return `<tr><td>${current==='galeria'?`<img class="thumb" src="/${esc(row.caminho_imagem.replace(/^\//,''))}" alt="">`:''}<strong>${esc(row.nome||row.titulo)}</strong><small>${esc(String(row.descricao||row.disciplina||'').slice(0,95))}</small></td><td><span class="tag">${esc(row.area||row.categoria||row.tipo||row.tag||(current==='galeria'?'Ordem '+row.ordem:'Publicado'))}</span></td><td>${date(row.data_evento||row.data_publicacao||row.updated_at||row.created_at)}</td><td>${action}</td></tr>`;
  }).join('')}</tbody></table></div><div class="pagination"><span>${filtered.length} registro(s) · Página ${page} de ${pages}</span><div><button id="prev" ${page===1?'disabled':''}>← Anterior</button><button id="next" ${page===pages?'disabled':''}>Próxima →</button></div></div>`:`<div class="empty-state"><h3>${search||filter?'Nenhum resultado encontrado':'Nenhum registro por aqui'}</h3>${search||filter?'Ajuste a busca ou o filtro.':'Os registros adicionados aparecerão nesta seção.'}</div>`;
  $('#prev')?.addEventListener('click',()=>{page--;renderRows();});$('#next')?.addEventListener('click',()=>{page++;renderRows();});
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(records.find(r=>String(r.campo||r.id)===b.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.delete));
 }
 function closeEditor(){ $('#editor').close(); }
 $('#close-editor').onclick=closeEditor;$('#cancel-editor').onclick=closeEditor;
 function openEditor(row){
  editRow=row;$('#editor-error').textContent='';$('#editor-form').hidden=false;
  $('#editor-title').textContent=current==='contato'?'Mensagem recebida':(row?'Editar':'Adicionar')+' · '+labels[current];
  $('#editor-form .dialog-actions').hidden=current==='contato';
  if(current==='contato'){
   $('#editor-fields').innerHTML=`<div class="wide"><h3>${esc(row.assunto)}</h3><p>${esc(row.nome)} · <a href="mailto:${esc(row.email)}">${esc(row.email)}</a></p><small>Recebida em ${date(row.created_at)} · Protocolo ${row.id}</small><p class="message-detail">${esc(row.mensagem)}</p><button type="button" class="secondary" id="toggle-read">${row.lida?'Marcar como não lida':'Marcar como lida'}</button></div>`;
   $('#toggle-read').onclick=async()=>{try{await api(`contato/${row.id}/lida`,{method:'PUT',body:JSON.stringify({lida:!row.lida})});closeEditor();toast('Status da mensagem atualizado.');await navigate();}catch(error){$('#editor-error').textContent=error.message;}};
  }else{
   const fields=getFields();
   $('#editor-fields').innerHTML=Object.entries(fields).map(([key,f])=>{
    let value=row?.[key] ?? (f.type==='checkbox'?(current==='usuarios'):f.type==='number'?0:f.type==='date'?new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}):f.options?.[0]||'');
    if(f.type==='password')value='';if(f.type==='date' && value)value=String(value).slice(0,10);
    const attr=`name="${key}" ${f.required?'required':''} ${f.max && f.type!=='number'?`maxlength="${f.max}"`:''} ${key==='campo'&&row?'readonly':''}`;
    if(f.type==='checkbox')return `<label class="checkbox-label"><input type="checkbox" ${attr} ${value?'checked':''}>${esc(f.label)}</label>`;
    const field=f.type==='textarea'?`<textarea ${attr}>${esc(value)}</textarea>`:f.options?`<select ${attr}>${f.options.map(v=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input type="${f.type==='image'?'text':f.type||'text'}" ${attr} value="${esc(value)}" ${f.type==='number'?`min="0" max="${f.max}"`:''} ${f.type==='password'?'minlength="12" autocomplete="new-password"':''}>`;
    return `<label class="${['textarea','image'].includes(f.type)?'wide':''}">${esc(f.label)}${f.required?' *':''}${field}${f.type==='image'?'<input type="file" id="image-upload" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP · máximo 5 MB. Faça upload ou informe um caminho em imagens/.</small><img class="upload-preview" id="image-preview" alt="Prévia da imagem" hidden>':''}</label>`;
   }).join('');
   $('#image-upload')?.addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    const submit=$('#editor-form [type=submit]');submit.disabled=true;$('#editor-error').textContent='Enviando imagem…';
    try{const body=new FormData();body.append('imagem',file);const data=await api('admin/upload',{method:'POST',body});$('#editor-form [name=caminho_imagem]').value=data.caminho_imagem;$('#image-preview').src=data.caminho_imagem;$('#image-preview').hidden=false;$('#editor-error').textContent='';}catch(error){$('#editor-error').textContent=error.message;}finally{submit.disabled=false;}
   });
  }
  if(!$('#editor').open)$('#editor').showModal();
 }
 $('#editor-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;$('#editor-error').textContent='';
  try{
   const body={};for(const [key,f] of Object.entries(getFields())){const input=event.target.elements[key];body[key]=f.type==='checkbox'?input.checked:f.type==='number'?Number(input.value):input.value;if(f.type==='password'&&!body[key])delete body[key];}
   const key=editRow?.campo||editRow?.id;
   await api(apiPath(current)+(editRow?'/'+encodeURIComponent(key):''),{method:editRow?'PUT':'POST',body:JSON.stringify(body)});
   closeEditor();toast('Alterações salvas. O site já está atualizado.');await navigate();
  }catch(error){$('#editor-error').textContent=error.message;}finally{button.disabled=false;}
 });
 async function remove(key){
  const dialog=$('#confirm-dialog');dialog.returnValue='';dialog.showModal();
  dialog.addEventListener('close',async()=>{if(dialog.returnValue!=='delete')return;try{await api(apiPath(current)+'/'+encodeURIComponent(key),{method:'DELETE'});toast('Registro excluído.');await navigate();}catch(error){toast(error.message);}},{once:true});
 }
 function renderAccount(){
  $('#main').innerHTML=heading('Minha conta','Mantenha seus dados de acesso protegidos.')+`<section class="panel"><div class="panel-heading"><div><h2>${esc(user.nome)}</h2><p>${esc(user.email)} · ${esc(user.papel==='admin'?'Administrador':'Editor')}</p></div></div><form id="password-form" class="panel-body"><div class="form-grid"><label class="wide">Senha atual<input type="password" name="atual" autocomplete="current-password" required maxlength="200"></label><label>Nova senha<input type="password" name="nova" autocomplete="new-password" required minlength="12" maxlength="200"></label><label>Confirme a nova senha<input type="password" name="confirmacao" autocomplete="new-password" required minlength="12" maxlength="200"></label></div><p class="form-error" id="password-error" role="alert"></p><button class="primary">Atualizar senha</button><p><small>A nova senha deve ter pelo menos 12 caracteres. Após a troca, entre novamente.</small></p></form></section>`;
  $('#password-form').onsubmit=async event=>{event.preventDefault();const form=event.target;if(form.nova.value!==form.confirmacao.value){$('#password-error').textContent='As senhas não coincidem.';return;}const button=form.querySelector('button');button.disabled=true;try{await api('auth/senha',{method:'PUT',body:JSON.stringify({atual:form.atual.value,nova:form.nova.value})});loginScreen();toast('Senha atualizada. Entre novamente.');}catch(error){$('#password-error').textContent=error.message;}finally{button.disabled=false;}};
 }
 api('auth/me').then(async data=>{user=data;await initialize();}).catch(()=>loginScreen());
})();
