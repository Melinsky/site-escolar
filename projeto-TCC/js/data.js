// All public content comes from the same API used by the administration panel.
document.addEventListener('DOMContentLoaded', async () => {
 const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const date = value => value ? new Date(String(value).slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data a confirmar';
 const lines = value => String(value || '').split('\n').filter(Boolean);
 async function load(resource, render) {
  try {
   const response = await fetch('/api/' + resource);
   const result = await response.json();
   if (!response.ok || result.erro) throw new Error(result.mensagem);
   render(result.dados);
  } catch (error) {
   if (!document.querySelector('.api-notice')) {
    const notice = document.createElement('p'); notice.className = 'api-notice'; notice.setAttribute('role','status');
    notice.textContent = 'Não foi possível atualizar o conteúdo. As informações exibidas são a versão de referência. Tente recarregar a página.';
    document.querySelector('main')?.prepend(notice);
   }
  }
 }
 function tabs(container, items, body) {
  container.innerHTML = `<div class="tabs-nav">${items.map((item,i) => `<button type="button" class="tab-btn ${i===0?'active':''}" data-live-tab="${escape(item.id)}" aria-selected="${i===0}">${escape(item.nome)}</button>`).join('')}</div><div class="tabs-content">${items.map((item,i) => `<div class="tab-panel ${i===0?'active':''}" data-live-panel="${escape(item.id)}">${body(item)}</div>`).join('')}</div>`;
  container.addEventListener('click', event => {
   const button = event.target.closest('[data-live-tab]'); if (!button) return;
   container.querySelectorAll('[data-live-tab]').forEach(b => { const active = b===button; b.classList.toggle('active',active); b.setAttribute('aria-selected',active); });
   container.querySelectorAll('[data-live-panel]').forEach(p => p.classList.toggle('active',p.dataset.livePanel===button.dataset.liveTab));
  });
 }
 const empty = '<p class="content-empty">Nenhum conteúdo publicado nesta seção.</p>';
 const tasks = [];
 if (document.querySelector('.cursos-grid') || location.pathname.endsWith('/cursos.html')) tasks.push(load('cursos', courses => {
  const grid = document.querySelector('.cursos-grid');
  if (grid) grid.innerHTML = courses.map(c => `<article class="card-curso"><span class="tab-panel-tag">${escape(c.categoria)}</span><h3>${escape(c.nome)}</h3><p>${escape(c.descricao)}</p><a class="btn" href="/pages/cursos.html#curso-${c.id}">Conheça o curso →</a></article>`).join('') || empty;
  if (!location.pathname.endsWith('/cursos.html')) return;
  const container = document.querySelector('.cursos-tabs');
  if (!courses.length) { container.innerHTML=empty; return; }
  tabs(container, courses, c => `<div class="tab-panel-header" id="curso-${c.id}"><span class="tab-panel-tag">${escape(c.categoria)}</span><h2>${escape(c.nome)}</h2><p>${escape(c.descricao)}</p></div><div class="tab-panel-body"><div class="tab-sobre"><div class="tab-sobre-texto"><h3>Sobre o curso</h3><p class="preserve-lines">${escape(c.sobre || c.descricao)}</p></div><div class="tab-sobre-info">${[['Duração',c.duracao],['Turno',c.turno],['Certificação',c.certificacao],['Vagas',c.vagas]].map(([label,value])=>`<div class="tab-info-item"><span class="tab-info-label">${label}</span><span class="tab-info-valor">${escape(value)}</span></div>`).join('')}</div></div>${[['Matriz curricular',c.modulos],['Habilidades desenvolvidas',c.habilidades],['Opções de carreira',c.carreira]].map(([label,value])=>value?`<section class="tab-modulos"><h3>${label}</h3><div class="modulos-grid">${lines(value).map((line,i)=>`<div class="modulo-card"><div class="modulo-numero">${String(i+1).padStart(2,'0')}</div><p>${escape(line)}</p></div>`).join('')}</div></section>`:'').join('')}<a class="btn" href="/pages/contato.html">Consultar a secretaria</a></div>`);
  const id = location.hash.replace('#curso-',''); container.querySelector(`[data-live-tab="${CSS.escape(id)}"]`)?.click();
 }));
 if (location.pathname.endsWith('/eventos.html')) {
  tasks.push(load('eventos', events => {
   const eventMarkup = e => `<article class="evento-item"><div class="evento-data"><span class="evento-dia">${e.data_evento ? escape(String(e.data_evento).slice(8,10)) : '—'}</span><span class="evento-mes">${e.data_evento ? escape(new Date(String(e.data_evento).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'})) : ''}</span></div><div class="evento-conteudo">${e.destaque?'<span class="tab-panel-tag">Destaque</span>':''}<h4>${escape(e.titulo)}</h4><p>${escape(e.descricao)}</p><div class="evento-meta"><span>${date(e.data_evento)}</span><span>${escape(e.hora_inicio)}</span><span>${escape(e.local_evento)}</span></div></div></article>`;
   document.querySelector('#tab-eventos .tab-panel-body').innerHTML = '<div class="eventos-lista">' + (events.filter(e=>e.tipo==='evento').map(eventMarkup).join('') || empty) + '</div>';
   const calendar = document.querySelector('#tab-calendário .tab-panel-body');
   if (calendar) calendar.innerHTML = '<div class="eventos-lista">' + (events.filter(e=>e.tipo==='calendario').map(eventMarkup).join('') || '<p>Nenhuma data do calendário publicada. Consulte também a aba Eventos.</p>') + '</div>';
  }));
  tasks.push(load('avisos', items => { document.querySelector('#tab-avisos .tab-panel-body').innerHTML = '<div class="avisos-lista">' + (items.map(a=>`<article class="aviso-item"><span class="aviso-tipo aviso-${escape(a.tipo)}">${a.urgente?'Urgente':escape(a.tipo)}</span><div class="aviso-conteudo"><h4>${escape(a.titulo)}</h4><p>${escape(a.descricao)}</p><span class="aviso-data">Publicado em ${date(a.data_publicacao)}</span></div></article>`).join('') || empty) + '</div>'; }));
  tasks.push(load('comunicados', items => { document.querySelector('#tab-comunicados .tab-panel-body').innerHTML = '<div class="comunicados-grid">' + (items.map(c=>`<article class="comunicado-card"><span class="tab-panel-tag">${escape(c.tag)}</span><h3>${escape(c.titulo)}</h3><p>${escape(c.descricao)}</p><small>${date(c.data_publicacao)}</small></article>`).join('') || empty) + '</div>'; }));
 }
 const gallery = document.querySelector('.galeria-page-grid');
 if (gallery) tasks.push(load('galeria', items => {
  gallery.innerHTML = items.map(p=>`<figure class="galeria-item"><img src="/${escape(p.caminho_imagem.replace(/^\//,''))}" alt="${escape(p.descricao || p.titulo)}" class="galeria-foto" loading="lazy"><figcaption class="galeria-caption">${escape(p.titulo)}</figcaption></figure>`).join('') || empty;
  gallery.querySelectorAll('img').forEach(img=> { img.tabIndex=0; img.setAttribute('role','button'); img.setAttribute('aria-label','Ampliar: '+img.alt); const open = () => {
   const dialog=document.createElement('dialog'); dialog.className='photo-viewer';
   const close=document.createElement('button');close.textContent='Fechar ×';close.onclick=()=>dialog.close();
   const photo=document.createElement('img');photo.src=img.src;photo.alt=img.alt;
   dialog.append(close,photo);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }; img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}}; });
 }));
 if (location.pathname.endsWith('/corpo-docente.html')) tasks.push(load('professores', items => {
  for (const area of ['Linguagem','Exatas','Humanas','Tecnicos']) {
   const grid = document.querySelector(`#tab-${area.toLowerCase()} .docente-grid`);
   if(grid) grid.innerHTML=items.filter(p=>p.area===area).map(p=>`<article class="card-docente"><div class="foto-texto-placeholder-small">${escape(p.sigla)}</div><h4>${escape(p.nome)}</h4><p>${escape(p.disciplina)}</p></article>`).join('') || empty;
  }
 }));
 tasks.push(load('escola', data => {
  document.querySelectorAll('[data-school]').forEach(el=>{const value=data[el.dataset.school];if(value!==undefined) el.textContent=value;});
  const digits=String(data.telefone||'').replace(/\D/g,'');
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(el=>{if(digits){el.href='https://wa.me/'+(digits.length<=11?'55':'')+digits;if(/\(11\)/.test(el.textContent))el.textContent=data.telefone;}});
  if(/^[a-zA-Z0-9._]{1,30}$/.test(data.instagram||''))document.querySelectorAll('a[href^="https://www.instagram.com/"]').forEach(el=>{el.href='https://www.instagram.com/'+data.instagram+'/';if(el.textContent.trim().startsWith('@'))el.textContent='@'+data.instagram;});
  const map=document.querySelector('iframe[title^="Localização"]');
  if(map && data.endereco){map.src='https://www.google.com/maps?q='+encodeURIComponent([data.endereco,data.bairro,data.cidade,data.uf].filter(Boolean).join(', '))+'&output=embed';map.title='Localização: '+data.endereco;}
  const keys=['alunos_matriculados','turmas','ideb','professores_qtd'];
  document.querySelectorAll('.stat-number').forEach((el,i)=>{if(data[keys[i]]!==undefined){el.dataset.target=parseFloat(data[keys[i]])||0;el.textContent=data[keys[i]];}});
  for(const [selector,key] of [['a[href^="tel:"]','telefone'],['a[href^="mailto:"]','email']]) document.querySelectorAll(selector).forEach(el=>{if(data[key]){el.href=(key==='email'?'mailto:':'tel:')+(key==='email'?data[key]:data[key].replace(/\D/g,''));if(el.textContent.trim().includes('@') || /\(11\)/.test(el.textContent))el.textContent=data[key];}});
 }));
 await Promise.allSettled(tasks);
});
