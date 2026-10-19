(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const key = 'little-drawer.collection.v1', favoriteKey = 'little-drawer.favorites.v1';
  const passwordKey = 'little-drawer.editor-password.v1';
  const deployedPassword = JSON.stringify(window.EDITOR_CONFIG);
  let authEpoch = 0;
  function editorConfig() {
    let saved;
    try { saved = localStorage.getItem(passwordKey); } catch { return window.EDITOR_CONFIG; }
    if (!saved) return window.EDITOR_CONFIG;
    const record = JSON.parse(saved);
    // 새 설정 파일을 배포하면 이전 배포에서 변경한 로컬 비밀번호보다 우선합니다.
    return record.base === deployedPassword ? EditorAuth.validateConfig(record.config) : window.EDITOR_CONFIG;
  }
  function endEditing() {
    authEpoch++; admin = false;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    render();
  }
  const categories = ['3학년 수업', '수업', '업무'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.folders) || value.projects.length > 2000 || value.folders.length > 200) throw Error('올바른 컬렉션 JSON 파일이 아닙니다.');
    const ids = new Set();
    const folders = value.folders.map(f => { if (!f || typeof f.id !== 'string' || !f.id || ids.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || !categories.includes(f.category)) throw Error('폴더 데이터가 올바르지 않습니다.'); ids.add(f.id); return {id:f.id,name:f.name.slice(0,80),category:f.category}; });
    const projectIds = new Set();
    const projects = value.projects.map(p => { if (!p || typeof p.id !== 'string' || !p.id || projectIds.has(p.id) || typeof p.title !== 'string' || !p.title.trim() || !safeUrl(p.url) || !categories.includes(p.category) || (p.folder && !ids.has(p.folder))) throw Error('프로젝트 데이터가 올바르지 않습니다.'); projectIds.add(p.id); return {id:p.id,title:p.title.slice(0,80),url:safeUrl(p.url),description:String(p.description || '').slice(0,240),category:p.category,folder:p.folder || ''}; });
    return {version:1,folders,projects};
  }
  let data = validate(window.COLLECTION_DATA), favorites = [], view = 'all', category = '전체', admin = false, list = false;
  let storageAvailable = true;
  try { const saved = localStorage.getItem(key); if (saved) data = validate(JSON.parse(saved)); const f = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); if (Array.isArray(f)) favorites = f.filter(x => typeof x === 'string'); } catch { storageAvailable = false; }
  let toastTimer;
  function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
  function save() { if (!admin) return; try { localStorage.setItem(key,JSON.stringify(data)); toast('이 브라우저에 저장했습니다.'); } catch { storageAvailable = false; toast('브라우저 저장이 불가능합니다. JSON 백업을 내려받으세요.'); } render(); }
  function setView(next) { view = next; category = '전체'; $('#search').value = ''; render(); }
  function navButton(id, icon, name, count) { return `<button data-view="${esc(id)}" class="${view === id ? 'active' : ''}" ${view === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${esc(name)}<small>${count}</small></button>`; }
  function currentProjects() {
    const q = $('#search').value.trim().toLocaleLowerCase('ko');
    let projects = data.projects.filter(p => (q || view === 'all' || (view === 'favorites' ? favorites.includes(p.id) : p.folder === view)) && (category === '전체' || p.category === category) && (!q || `${p.title} ${p.description} ${p.category} ${data.folders.find(f=>f.id===p.folder)?.name || ''}`.toLocaleLowerCase('ko').includes(q)));
    const sort = $('#sort').value;
    if (sort === 'name') projects.sort((a,b) => a.title.localeCompare(b.title,'ko'));
    if (sort === 'recent') projects.reverse();
    if (sort === 'favorite') projects.sort((a,b) => Number(favorites.includes(b.id))-Number(favorites.includes(a.id)));
    return projects;
  }
  const palettes = { '업무':['#ebeee6','#647c52'], '수업':['#f6eadd','#bc8650'], '3학년 수업':['#e7edf0','#678899'] };
  const symbols = ['✎','▤','⚗','✓','☑','✳','♧','♙','◈','×','✣','≈','▥','⌖','✧'];
  function render() {
    $('#navigation').innerHTML = navButton('all','▦','전체 컬렉션',data.projects.length) + navButton('favorites','☆','즐겨찾기',data.projects.filter(p=>favorites.includes(p.id)).length) + '<div class="nav-separator"></div>' + data.folders.map(f=>navButton(f.id,'▱',f.name,data.projects.filter(p=>p.folder===f.id).length)).join('');
    $('#total').textContent = data.projects.length;
    $('#categoryCount').textContent = new Set(data.projects.map(p=>p.category)).size;
    $('#view-title').textContent = view === 'all' ? '전체 컬렉션' : view === 'favorites' ? '즐겨찾기' : data.folders.find(f=>f.id===view)?.name || '전체 컬렉션';
    $('#filters').innerHTML = ['전체',...categories].map(c=>`<button data-category="${esc(c)}" aria-pressed="${category===c}">${esc(c)}<span>${data.projects.filter(p=>(c==='전체'||p.category===c)&&(view==='all'||view==='favorites'&&favorites.includes(p.id)||p.folder===view)).length}</span></button>`).join('');
    const visibleFolders = view === 'all' && !$('#search').value.trim() ? data.folders.filter(f=>category==='전체'||f.category===category) : [];
    $('.folder-section').hidden = !visibleFolders.length && !admin;
    $('#folders').innerHTML = visibleFolders.map(f=>`<div class="folder-wrap"><button class="folder" data-view="${esc(f.id)}"><span class="folder-icon" aria-hidden="true"></span><span><strong>${esc(f.name)}</strong><small>${esc(f.category)} · ${data.projects.filter(p=>p.folder===f.id).length}개 프로젝트</small></span><span class="folder-arrow">↗</span></button>${admin?`<div class="card-admin"><button data-edit-folder="${esc(f.id)}">수정</button><button data-delete-folder="${esc(f.id)}">폴더 삭제</button></div>`:''}</div>`).join('');
    const projects = currentProjects();
    $('#result-count').textContent = `${projects.length}`;
    $('#search-note').textContent = $('#search').value.trim() ? '모든 폴더에서 검색한 결과입니다' : '작은 도구로 만드는 더 나은 하루';
    $('#projects').classList.toggle('list-mode',list);
    $('#projects').innerHTML = projects.map(p=>{
      const [tint,color] = palettes[p.category];
      const domain = new URL(p.url).hostname;
      const index = data.projects.findIndex(x=>x.id===p.id);
      return `<article class="card" style="--tint:${tint};--color:${color}" ${admin?'draggable="true"':''} data-id="${esc(p.id)}"><div class="card-top"><span class="project-icon" aria-hidden="true">${symbols[index%symbols.length]}</span><button class="favorite" data-favorite="${esc(p.id)}" aria-label="${esc(p.title)} 즐겨찾기" aria-pressed="${favorites.includes(p.id)}">${favorites.includes(p.id)?'★':'☆'}</button></div><span class="category">${esc(p.category)}</span><h4><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(p.title)} (새 창)">${esc(p.title)}</a></h4><p>${esc(p.description)}</p><div class="card-bottom"><span aria-hidden="true">⊙</span><span class="domain">${esc(domain)}</span><b aria-hidden="true">↗</b></div>${admin?`<div class="card-admin"><button data-edit="${esc(p.id)}">수정 · 이동</button><button data-copy="${esc(p.id)}">복사</button><button data-delete="${esc(p.id)}">삭제</button><button data-up="${esc(p.id)}" aria-label="${esc(p.title)} 앞으로 이동">↑</button><button data-down="${esc(p.id)}" aria-label="${esc(p.title)} 뒤로 이동">↓</button></div>`:''}</article>`;
    }).join('');
    $('#empty').hidden = projects.length > 0;
    document.querySelectorAll('.admin-only').forEach(el=>el.hidden=!admin);
    $('#admin-panel').hidden = !admin;
    $('#manage').setAttribute('aria-pressed',String(admin));
    $('#manage span').textContent = admin ? '편집 종료' : '편집자 로그인';
    $('#access-mode').textContent = admin ? '편집자 모드' : '뷰어 모드';
  }
  function editor(kind, id) {
    if (!admin) return;
    const form = $('#editor-form'); form.reset();
    const item = kind==='folder' ? data.folders.find(f=>f.id===id) : data.projects.find(p=>p.id===id);
    form.elements.kind.value=kind; form.elements.id.value=id||'';
    $('#editor-title').textContent = `${id?'수정할':'새'} ${kind==='folder'?'폴더':'프로젝트'}`;
    document.querySelectorAll('.project-field').forEach(el=>el.hidden=kind==='folder');
    form.elements.url.required = kind!=='folder';
    form.elements.folder.innerHTML = '<option value="">폴더 없음</option>'+data.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    form.elements.title.value = item?.title || item?.name || '';
    form.elements.category.value = item?.category || (categories.includes(category)?category:'수업');
    form.elements.folder.value = item?.folder || (data.folders.some(f=>f.id===view)?view:'');
    form.elements.url.value = item?.url || ''; form.elements.description.value = item?.description || '';
    $('#editor').showModal(); form.elements.title.focus();
  }
  function confirmAction(title,message,action) { $('#confirm-title').textContent=title; $('#confirm-message').textContent=message; const dialog=$('#confirm-dialog'); dialog.returnValue=''; dialog.onclose=()=>{if(dialog.returnValue==='yes' && admin) action();}; dialog.showModal(); }
  function download(name,content,type) { const url=URL.createObjectURL(new Blob([content],{type})); const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    if(b.hasAttribute('data-close')) { b.closest('dialog').close(); return; }
    if(b.dataset.view) return setView(b.dataset.view);
    if(b.dataset.category) {category=b.dataset.category;render();return;}
    if(b.dataset.favorite) { const id=b.dataset.favorite; favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];try{localStorage.setItem(favoriteKey,JSON.stringify(favorites));}catch{toast('즐겨찾기를 영구 저장할 수 없습니다.');}render(); return; }
    if(!admin)return;
    if(b.dataset.edit)editor('project',b.dataset.edit);
    if(b.dataset.editFolder)editor('folder',b.dataset.editFolder);
    if(b.dataset.delete)confirmAction('프로젝트 삭제','현재 브라우저의 목록에서 삭제합니다. GitHub 기본 목록은 바뀌지 않습니다.',()=>{data.projects=data.projects.filter(p=>p.id!==b.dataset.delete);save();});
    if(b.dataset.deleteFolder)confirmAction('폴더 삭제','폴더 안의 프로젝트는 전체 목록에 그대로 남습니다.',()=>{data.projects.forEach(p=>{if(p.folder===b.dataset.deleteFolder)p.folder='';});data.folders=data.folders.filter(f=>f.id!==b.dataset.deleteFolder);if(view===b.dataset.deleteFolder)view='all';save();});
    if(b.dataset.copy){const p=data.projects.find(p=>p.id===b.dataset.copy);data.projects.push({...p,id:crypto.randomUUID(),title:`${p.title} (복사)`});save();}
    if(b.dataset.up||b.dataset.down){const id=b.dataset.up||b.dataset.down; const visible=currentProjects(); const vi=visible.findIndex(p=>p.id===id);const target=visible[vi+(b.dataset.up?-1:1)];if(!target)return toast('더 이동할 수 없습니다.');const i=data.projects.findIndex(p=>p.id===id),j=data.projects.findIndex(p=>p.id===target.id);[data.projects[i],data.projects[j]]=[data.projects[j],data.projects[i]];$('#sort').value='custom';save();}
  });
  $('#editor-form').addEventListener('submit',e=>{e.preventDefault();if(!admin)return;const f=e.target.elements;const title=f.title.value.trim();if(!title)return toast('이름을 입력해 주세요.');const id=f.id.value||crypto.randomUUID();if(f.kind.value==='folder'){const folder={id,name:title,category:f.category.value};const i=data.folders.findIndex(x=>x.id===id);i<0?data.folders.push(folder):data.folders.splice(i,1,folder);}else{const url=safeUrl(f.url.value);if(!url)return toast('http 또는 https 주소를 입력해 주세요.');const project={id,title,url,description:f.description.value.trim(),category:f.category.value,folder:f.folder.value};const i=data.projects.findIndex(x=>x.id===id);i<0?data.projects.push(project):data.projects.splice(i,1,project);}$('#editor').close();save();});
  $('#manage').onclick=()=>{
    if(admin){endEditing();toast('편집을 종료했습니다. 뷰어 모드로 전환합니다.');return;}
    $('#login-form').reset();$('#login-error').textContent='';$('#login-dialog').showModal();$('#editor-password').focus();
  };
  $('#login-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('#login-submit');if(button.disabled)return;
    const epoch=authEpoch;const password=$('#editor-password').value;button.disabled=true;button.textContent='확인 중…';$('#login-error').textContent='';
    try {
      const valid=await EditorAuth.verify(password,editorConfig());
      if(!$('#login-dialog').open||epoch!==authEpoch)return;
      if(!valid){$('#login-error').textContent='비밀번호가 올바르지 않습니다.';$('#editor-password').value='';$('#editor-password').focus();return;}
      admin=true;$('#login-dialog').close();render();toast(storageAvailable?'편집자 모드입니다. 추가·수정·삭제할 수 있습니다.':'편집 후 JSON 백업을 내려받으세요. 브라우저 저장을 사용할 수 없습니다.');
    } catch(error){if($('#login-dialog').open)$('#login-error').textContent=error.message;}
    finally{button.disabled=false;button.textContent='편집 시작';}
  });
  $('#login-dialog').addEventListener('close',()=>{authEpoch++;$('#editor-password').value='';$('#login-error').textContent='';});
  $('#change-password').onclick=()=>{
    if(!admin)return;
    $('#password-form').reset();$('#password-error').textContent='';
    $('#password-dialog').showModal();$('#current-password').focus();
  };
  $('#password-dialog').addEventListener('close',()=>{authEpoch++;$('#password-form').reset();$('#password-error').textContent='';});
  $('#password-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!admin)return;
    const button=$('#password-submit');if(button.disabled)return;
    const epoch=authEpoch;
    button.disabled=true;button.textContent='변경 중…';$('#password-error').textContent='';
    try {
      const before=editorConfig();
      const config=await EditorAuth.changePassword($('#current-password').value,$('#new-password').value,$('#confirm-password').value,before);
      if(!admin||!$('#password-dialog').open||epoch!==authEpoch)return;
      if(JSON.stringify(before)!==JSON.stringify(editorConfig()))throw Error('다른 창에서 비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
      try {localStorage.setItem(passwordKey,JSON.stringify({base:deployedPassword,config}));}
      catch {throw Error('브라우저에 저장할 수 없어 비밀번호를 변경하지 않았습니다. 저장소 설정을 확인해 주세요.');}
      endEditing();toast('이 브라우저의 비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.');
    } catch(error){if($('#password-dialog').open)$('#password-error').textContent=error.message;}
    finally{button.disabled=false;button.textContent='비밀번호 변경';}
  });
  $('#export-password').onclick=()=>{
    if(!admin)return;
    try{download('editor-config.js','// 편집 화면 잠금 설정. 평문 비밀번호는 포함되지 않습니다.\nwindow.EDITOR_CONFIG = '+JSON.stringify(editorConfig(),null,2)+';\n','text/javascript;charset=utf-8');}
    catch(error){toast(error.message);}
  };
  window.addEventListener('storage',e=>{
    if(e.key===passwordKey||e.key===null){endEditing();toast('비밀번호 설정이 바뀌었습니다. 다시 로그인해 주세요.');}
  });
  $('#add-project').onclick=()=>editor('project');$('#add-folder').onclick=()=>editor('folder');
  $('#search').addEventListener('input',render);$('#sort').onchange=render;
  $('#grid-view').onclick=()=>{list=false;$('#grid-view').setAttribute('aria-pressed','true');$('#list-view').setAttribute('aria-pressed','false');render();};
  $('#list-view').onclick=()=>{list=true;$('#grid-view').setAttribute('aria-pressed','false');$('#list-view').setAttribute('aria-pressed','true');render();};
  $('#clear').onclick=()=>setView('all');$('#help').onclick=()=>$('#help-dialog').showModal();
  $('#export-js').onclick=()=>admin&&download('data.js',`// 공용 컬렉션 데이터\nwindow.COLLECTION_DATA = ${JSON.stringify(data,null,2)};\n`,'text/javascript;charset=utf-8');
  $('#export-json').onclick=()=>admin&&download('collection-backup.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  $('#reset').onclick=()=>admin&&confirmAction('기본 목록 복원','이 브라우저의 편집 내용을 data.js의 공용 목록으로 되돌립니다. 필요한 내용은 먼저 JSON으로 백업하세요.',()=>{data=validate(window.COLLECTION_DATA);view='all';save();});
  $('#import').onchange=async e=>{if(!admin){e.target.value='';return;}const file=e.target.files[0];if(!file)return;try{if(file.size>3000000)throw Error('3MB 이하의 JSON 파일을 선택하세요.');const imported=validate(JSON.parse(await file.text()));if(!admin)return;confirmAction('백업 가져오기',`${imported.projects.length}개 프로젝트와 ${imported.folders.length}개 폴더로 현재 목록을 교체합니다.`,()=>{data=imported;view='all';save();});}catch(error){toast(error.message);}e.target.value='';};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus();}});
  let draggedId;
  $('#projects').addEventListener('dragstart',e=>{const card=e.target.closest('.card');if(!admin||!card)return;draggedId=card.dataset.id;e.dataTransfer.setData('text/plain',draggedId);e.dataTransfer.effectAllowed='move';});
  document.addEventListener('dragover',e=>{if(admin&&draggedId&&(e.target.closest('.folder')||e.target.closest('.card')))e.preventDefault();});
  document.addEventListener('drop',e=>{if(!admin||!draggedId)return;const folder=e.target.closest('.folder'),card=e.target.closest('.card');if(folder){e.preventDefault();data.projects.find(p=>p.id===draggedId).folder=folder.dataset.view;save();}else if(card&&card.dataset.id!==draggedId){e.preventDefault();const from=data.projects.findIndex(p=>p.id===draggedId);const [p]=data.projects.splice(from,1);const to=data.projects.findIndex(p=>p.id===card.dataset.id);data.projects.splice(to,0,p);$('#sort').value='custom';save();}draggedId=null;});
  document.addEventListener('dragend',()=>{draggedId=null;});
  render();
})();
