/* Ranking SST · web pública independiente v1.0.0.
 * Exclusivamente lectura: reutiliza RPC públicos de Estudia y el histórico central de XP.
 * No ejecuta INSERT/UPDATE/DELETE en ninguna tabla. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bRnkA6PA8-v073nrw9zxiQ_8rVGiOn1';
  const APP_VIEWS = new Set(['inicio','ranking','misxp','niveles','mas']);
  const PAGE_SIZE = 500;
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escXml = escapeHtml;
  const format = number => Number(number || 0).toLocaleString('es-VE');
  const niceDate = date => { const d = new Date(date); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'}); };
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const safePhoto = url => {
    try {
      const u = new URL(String(url || '').trim());
      if (u.protocol !== 'https:') return null;
      if (['drive.google.com','docs.google.com'].includes(u.hostname.toLowerCase())) {
        const matched = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{15,})/);
        const id = matched?.[1] || u.searchParams.get('id');
        return id && /^[A-Za-z0-9_-]{15,}$/.test(id)
          ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w600'
          : null;
      }
      return u.href;
    } catch { return null; }
  };
  let sb = null;
  let toastTimer;
  const state = {view:'inicio',global:[],levels:[],studies:[],scope:'global',studyId:'',visible:20,ranking:[],loadSerial:0,privateData:null,loaded:false};

  function toast(message,isError=false){
    const e=$('appToast');clearTimeout(toastTimer);e.textContent=message;e.className='toast'+(isError?' error':'');e.hidden=false;
    toastTimer=setTimeout(()=>{e.hidden=true;},4500);
  }
  async function rpc(name,args={}) {
    if(!sb) throw new Error('No se pudo iniciar la conexión con la base de datos. Comprueba tu conexión.');
    const {data,error}=await sb.rpc(name,args);
    if(error) throw new Error(error.message||`Error de consulta: ${name}`);
    return data;
  }
  function navigate(page,updateHash=true){
    const target=APP_VIEWS.has(page)?page:'inicio';state.view=target;
    document.querySelectorAll('.page').forEach(n=>n.hidden=n.dataset.page!==target);
    document.querySelectorAll('.nav-item').forEach(n=>{
      const active=n.dataset.target===target;n.classList.toggle('active',active);
      if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
    });
    if(updateHash && location.hash!==`#${target}`) history.replaceState(null,'',`#${target}`);
    if(target==='ranking')renderRanking();
    if(target==='niveles')renderLevels();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function initials(name) {
    const words=String(name||'').trim().split(/\s+/).filter(Boolean);
    return (words.length>1?words[0][0]+words[1][0]:words[0]?.slice(0,2)||'S').toUpperCase();
  }
  function avatar(person,klass){
    const src=safePhoto(person.foto_url),letters=escapeHtml(initials(person.nombre));
    return `<div class="${klass}" aria-hidden="true">${src?`<img src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${letters}</span></div>`;
  }
  function renderPodium(rows,elementId){
    const wrap=$(elementId);if(!wrap)return;
    if(!rows.length){wrap.innerHTML='<div class="empty-state">El ranking todavía no tiene posiciones que mostrar.</div>';return;}
    const medals=['ORO','PLATA','BRONCE'];
    const order=rows.length>=3?[rows[1],rows[0],rows[2]]:rows.slice(0,3);
    wrap.innerHTML=order.map(r=>{
      const rank=Number(r.posicion),kind=rank===1?'first':rank===2?'second':'third';
      return `<article class="podium-card is-${kind}"><div class="podium-card-head"><span class="place-medal">${escapeHtml(medals[rank-1]||`#${rank}`)}</span><b class="place-number">${String(rank).padStart(2,'0')}</b></div>${avatar(r,'podium-avatar')}<strong class="podium-name">${escapeHtml(r.nombre)}</strong><span class="podium-level">${escapeHtml(r.nivel_icono||'')} ${escapeHtml(r.nivel||'Participante')}</span><div class="podium-score">${format(r.puntos)} <small>XP</small></div></article>`;
    }).join('');
  }
  function renderHome(){
    const arr=state.global;
    const totals=arr.reduce((n,r)=>n+Number(r.puntos||0),0);
    const stats=[['Profesionales en el ranking',arr.length],['XP reconocidos',totals],['Niveles de progreso',state.levels.length]];
    $('homeStats').innerHTML=stats.map(([label,num])=>`<div class="stat-tile"><span>${escapeHtml(label)}</span><strong>${format(num)}</strong></div>`).join('');
    renderPodium(arr.slice(0,3),'homePodium');
  }
  function createStudyOptions(){
    const selected=state.studyId;
    $('studySelect').innerHTML='<option value="">Selecciona un estudio</option>' + state.studies.map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===selected?'selected':''}>${escapeHtml(`${s.codigo||'EST'} · ${s.tema||'Estudio'}`)}</option>`).join('');
  }
  function createLevelOptions(){
    $('levelFilter').innerHTML='<option value="">Todos los niveles</option>'+state.levels.map(s=>`<option value="${escapeHtml(s.nombre)}">${escapeHtml(s.nombre)}</option>`).join('');
  }
  async function fetchGlobal(){
    const all=[];
    for(let offset=0;offset<=10000;offset+=PAGE_SIZE){
      const chunk=await rpc('ranking_publico',{p_limit:PAGE_SIZE,p_offset:offset});
      if(!Array.isArray(chunk))throw new Error('El ranking no devolvió un listado válido.');
      all.push(...chunk);
      if(chunk.length<PAGE_SIZE)break;
    }
    return all;
  }
  async function loadAll(){
    try{
      const [global,levels,studies]=await Promise.all([
        fetchGlobal(),rpc('estudia_niveles_publicos'),rpc('estudia_sesiones_publicas')
      ]);
      state.global=Array.isArray(global)?global:[];
      state.levels=Array.isArray(levels)?levels:[];
      state.studies=Array.isArray(studies)?studies:[];
      state.ranking=state.global;
      state.loaded=true;
      createStudyOptions();createLevelOptions();renderHome();renderLevels();renderRanking();
    }catch(err){
      console.error('Ranking SST - carga',err);
      $('homeStats').innerHTML='<div class="stat-tile" style="grid-column:1/-1"><span>No se pudieron cargar las cifras.</span><strong style="font-size:14px">Reintenta cuando haya conexión.</strong></div>';
      $('homePodium').innerHTML='<div class="empty-state">No se pudo consultar el podio. Intenta actualizar el ranking.</div>';
      $('rankingList').innerHTML='<div class="empty-state">No se pudo conectar con el ranking. Usa «Actualizar» para reintentar.</div>';
      toast('No se pudieron cargar los datos del ranking.',true);
    }
  }
  function filteredRanks(){
    const query=$('rankingSearch').value.trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const nivel=$('levelFilter').value;
    return state.ranking.filter(r=>{
      const text=String(r.nombre||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
      return (!query||text.includes(query))&&(!nivel||r.nivel===nivel);
    });
  }
  function setScope(scope){
    state.scope=scope;state.visible=20;
    const isStudy=scope==='study';
    $('scopeGlobal').classList.toggle('selected',!isStudy);
    $('scopeStudies').classList.toggle('selected',isStudy);
    $('scopeGlobal').setAttribute('aria-pressed',String(!isStudy));
    $('scopeStudies').setAttribute('aria-pressed',String(isStudy));
    $('studyField').hidden=!isStudy;
    if(isStudy){state.ranking=[];if(state.studyId)loadStudy();else renderRanking();}
    else{state.ranking=state.global;renderRanking();}
  }
  async function loadStudy(){
    const id=state.studyId,seq=++state.loadSerial;
    if(!id){state.ranking=[];renderRanking();return;}
    $('rankingList').innerHTML=`<div class="loading-inline"><span class="loader"></span> Cargando estudio…</div>`;
    try{
      const rows=await rpc('ranking_sesion_publico',{p_sesion_id:id,p_limit:500});
      if(seq!==state.loadSerial||state.scope!=='study'||state.studyId!==id)return;
      state.ranking=Array.isArray(rows)?rows:[];
      state.visible=20;renderRanking();
    }catch(err){if(seq!==state.loadSerial)return;state.ranking=[];renderRanking();toast('No fue posible consultar el estudio.',true);}
  }
  function renderRanking(){
    if(!state.loaded)return;
    const isStudy=state.scope==='study';
    const scopeChosen=!isStudy||!!state.studyId;
    const filtered=scopeChosen?filteredRanks():[];
    const searching=!!$('rankingSearch').value.trim()||!!$('levelFilter').value;
    const showPodium=!searching&&filtered.length>0;
    $('rankingPodium').hidden=!showPodium;
    if(showPodium)renderPodium(filtered.slice(0,3),'rankingPodium');
    const rest=showPodium?filtered.slice(3):filtered;
    const visible=rest.slice(0,state.visible);
    $('rankingCount').textContent=scopeChosen?`${format(filtered.length)} profesionales`:'—';
    $('rankingCaption').textContent=isStudy?(state.studyId?'Resultados de este estudio':'Selecciona un estudio para consultar su ranking'):'Resultados del ranking general';
    $('rankingList').innerHTML=visible.length?visible.map(r=>`<div class="ranking-row"><span class="rank-number">#${format(r.posicion)}</span>${avatar(r,'row-avatar')}<div class="ranking-row-name"><strong>${escapeHtml(r.nombre)}</strong><small>${escapeHtml(r.nivel_icono||'')} ${escapeHtml(r.nivel||'Participante')}${r.estado?' · '+escapeHtml(r.estado):''}</small></div><div class="ranking-row-points">${format(r.puntos)}<small>XP</small></div></div>`).join(''):
      `<div class="empty-state">${!scopeChosen?'Selecciona un estudio.':searching?'No encontramos profesionales con estos filtros.':'Todavía no hay posiciones en este ranking.'}</div>`;
    $('showMoreRank').hidden=rest.length<=state.visible;
    $('downloadPodium').disabled=filtered.length===0;
  }
  function renderLevels(){
    if(!state.levels.length){$('levelsGrid').innerHTML='<div class="empty-state">Los niveles se mostrarán cuando haya conexión.</div>';return;}
    const tints=['#b17d4b','#a1aebd','#f5bd3c','#68a5b9','#795da9','#238c81','#d6a323'];
    $('levelsGrid').innerHTML=state.levels.map((r,i)=>`<article class="level-card" style="--level-color:${tints[i%tints.length]}"><span class="level-index">NIVEL ${String(i+1).padStart(2,'0')}</span><div class="level-emoji">${escapeHtml(r.icono||'✦')}</div><h3>${escapeHtml(r.nombre)}</h3><p>A partir de</p><strong>${format(r.xp_min)} XP</strong></article>`).join('');
  }
  function classifyHistory(row){
    const tipo=String(row.tipo||''),motivo=String(row.motivo||'');
    if(tipo==='actividad' && /^participaci[oó]n en grupo WhatsApp/i.test(motivo))return 'pulso';
    if(tipo==='actividad' && row.sesion_id)return 'estudia';
    if(tipo==='actividad')return 'participa';
    if(row.sesion_id||tipo==='whatsapp_participacion'||tipo==='calidad_tecnica'||tipo==='moderacion')return 'estudia';
    return 'otros';
  }
  function renderMySources(data){
    const sums={estudia:0,participa:0,pulso:0,otros:0};
    const history=Array.isArray(data.historial)?data.historial:[];
    for(const row of history)sums[classifyHistory(row)]+=Number(row.puntos||0);
    const sources=[['Estudia','estudia','book'],['Participa','participa','check'],['Pulso de la Comunidad','pulso','chat'],['Histórico y ajustes','otros','medal']];
    $('sourceBreakdown').innerHTML=sources.map(([label,id,ico])=>`<div class="my-source"><span>${icon(ico)} ${escapeHtml(label)}</span><b>${format(sums[id])} XP</b><small>${id==='otros'?'Reconocimientos previos / ajustes':'XP en el historial consultado'}</small></div>`).join('');
    const totalHistory=history.reduce((sum,r)=>sum+Number(r.puntos||0),0);
    const total=Number(data.ranking?.puntos||0);
    const caveat=$('breakdownCaveat');
    if(total!==totalHistory){caveat.hidden=false;caveat.textContent='El desglose por fuente corresponde a los movimientos recientes disponibles. Tu total de XP y tu nivel muestran el acumulado completo.';}
    else{caveat.hidden=true;caveat.textContent='';}
  }
  function renderProgress(data){
    const p=data.perfil||{},r=data.ranking||{};
    $('privateLoginWrap').hidden=true;$('progressResult').hidden=false;
    $('myName').textContent=p.nombre||'Integrante';$('myState').textContent=p.estado||'La Movida de SST+';
    const ph=safePhoto(p.foto_url),avatarBox=$('myAvatar');
    avatarBox.textContent=initials(p.nombre);
    if(ph){const img=document.createElement('img');img.src=ph;img.alt='Foto de perfil';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();avatarBox.appendChild(img);}
    $('myLevelIcon').textContent=r.nivel_icono||'✦';$('myLevelName').textContent=r.nivel||'Participante';
    $('myXp').textContent=format(r.puntos);
    $('myPosition').textContent=r.fuera_de_ranking?'Fuera de clasificación':Number(r.posicion)>0?`#${format(r.posicion)}`:'—';
    const begin=Number(r.nivel_xp_min||0),next=Number(r.siguiente_nivel_xp||0),xp=Number(r.puntos||0),left=Number(r.xp_faltante||0);
    if(r.fuera_de_ranking){$('nextLevelName').textContent='Consulta personal';$('levelProgressText').textContent='Esta cuenta conserva sus XP, pero no participa en la clasificación pública.';}
    else{$('nextLevelName').textContent=next?`${r.siguiente_nivel_icono||''} ${r.siguiente_nivel||''}`:'Nivel máximo';$('levelProgressText').textContent=next?`Faltan ${format(left)} XP para llegar a ${r.siguiente_nivel||'tu siguiente nivel'}.`:'¡Has alcanzado el nivel máximo del ranking!';}
    $('levelProgressBar').style.width=`${next?Math.min(100,Math.max(0,(xp-begin)/Math.max(1,next-begin)*100)):100}%`;
    renderMySources(data);
    const history=Array.isArray(data.historial)?data.historial:[];
    $('historyTotal').textContent=`${history.length} movimientos`;
    const labels={estudia:'Estudia',participa:'Participa',pulso:'Pulso de la Comunidad',otros:'Histórico / ajustes'};
    $('historyList').innerHTML=history.length?history.map(h=>`<div class="history-row"><div><strong>${escapeHtml(h.motivo||labels[classifyHistory(h)])}</strong><small>${escapeHtml(labels[classifyHistory(h)])} · ${escapeHtml(niceDate(h.fecha))}</small></div><span class="${Number(h.puntos)>=0?'pos':'neg'}">${Number(h.puntos)>0?'+':''}${format(h.puntos)} XP</span></div>`).join(''):'<div class="empty-state">Todavía no tienes movimientos registrados.</div>';
    const studies=Array.isArray(data.detalle_estudios)?data.detalle_estudios:[];
    $('studyXpList').innerHTML=studies.length?studies.map(s=>`<div class="study-xp-row"><div><strong>${escapeHtml(s.codigo||'ESTUDIO')} · ${escapeHtml(s.tema||'')}</strong><small>${format(s.eventos)} reconocimientos · ${format(s.dias_activos)} días activos</small></div><span class="pos">${Number(s.xp_total)>0?'+':''}${format(s.xp_total)} XP</span></div>`).join(''):'<div class="empty-state">No hay estudios con movimientos registrados.</div>';
    $('codigoInput').value='';$('cedulaInput').value='';
  }
  async function submitProgress(event){
    event.preventDefault();const cedula=$('cedulaInput').value.replace(/\D/g,'');const codigo=$('codigoInput').value.trim().toUpperCase();
    if(!/^\d{5,12}$/.test(cedula)||!/^[A-Z0-9]{5}$/.test(codigo)){toast('Revisa tu documento y el código de cinco caracteres.',true);return;}
    const btn=$('progressSubmit');btn.disabled=true;btn.textContent='Verificando credencial…';
    try{
      const response=await rpc('estudia_mi_progreso',{p_cedula:cedula,p_codigo:codigo});
      if(!response?.ok)throw new Error('Las credenciales no coinciden. Revisa tu documento y código.');
      state.privateData=response;renderProgress(response);toast('Tu historial se cargó correctamente.');
    }catch(err){toast(err.message||'No fue posible consultar los puntos.',true);$('codigoInput').value='';}
    finally{btn.disabled=false;btn.innerHTML=`Ver mis puntos ${icon('arrow')}`;}
  }
  function clearProgress(){
    state.privateData=null;$('progressResult').hidden=true;$('privateLoginWrap').hidden=false;
    $('progressForm').reset();$('codigoInput').type='password';$('myAvatar').textContent='S';
    $('historyList').replaceChildren();$('studyXpList').replaceChildren();$('sourceBreakdown').replaceChildren();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function shareRanking(){
    const data={title:'Ranking XP · La Movida de SST+',text:'Conoce el ranking de participación y aprendizaje de La Movida de SST+.',url:'https://ranking.movidasst.com/'};
    try{
      if(navigator.share){await navigator.share(data);return;}
      if(navigator.clipboard){await navigator.clipboard.writeText(data.url);toast('Enlace copiado para compartir.');return;}
      throw new Error('No disponible');
    }catch(err){if(err.name==='AbortError')return;toast('Comparte este enlace: ranking.movidasst.com');}
  }
  async function downloadPodium(){
    const entries=filteredRanks().slice(0,3);
    if(!entries.length){toast('Aún no hay posiciones para exportar.',true);return;}
    const safeRows=entries.map((r,i)=>{
      const y=265+i*101;
      const name=escXml(String(r.nombre||'').slice(0,44));
      return `<rect x="105" y="${y}" rx="19" width="990" height="85" fill="${i%2?'#f4f8fa':'#fff'}"/><text x="139" y="${y+54}" font-size="27" fill="#007b85" font-weight="800">#${i+1}</text><text x="226" y="${y+50}" font-size="27" fill="#00205b" font-weight="750">${name}</text><text x="1050" y="${y+50}" text-anchor="end" font-size="30" fill="#00205b" font-weight="800">${format(r.puntos)} XP</text>`;
    }).join('');
    const svgText=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f5f8fc"/><rect width="1200" height="195" fill="#00205b"/><rect width="1200" height="8" fill="#ffb600"/><text x="105" y="81" font-family="Arial,sans-serif" font-weight="800" font-size="34" fill="#fff">LA MOVIDA DE SST+</text><text x="105" y="146" font-family="Arial,sans-serif" font-weight="800" font-size="54" fill="#fff">${state.scope==='study'?'Podio del estudio':'Ranking de la comunidad'}</text><g font-family="Arial,sans-serif">${safeRows}</g><text x="105" y="598" font-family="Arial,sans-serif" font-size="20" fill="#007b85">ranking.movidasst.com · De la Reacción a la Prevención</text></svg>`;
    try{
      const dataURL=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}));
      const img=new Image();
      img.onload=()=>{
        try{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;canvas.getContext('2d').drawImage(img,0,0);
          canvas.toBlob(blob=>{if(!blob){toast('No se pudo exportar el podio.',true);return;}const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='ranking-movida-sst-podio.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);},'image/png');
        }finally{URL.revokeObjectURL(dataURL);}
      };
      img.onerror=()=>{URL.revokeObjectURL(dataURL);toast('Error al generar la imagen.',true);};img.src=dataURL;
    }catch{toast('No se pudo crear la imagen.',true);}
  }
  function wireEvents(){
    document.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();navigate(b.dataset.target);}));
    window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),false));
    $('scopeGlobal').addEventListener('click',()=>setScope('global'));
    $('scopeStudies').addEventListener('click',()=>setScope('study'));
    $('studySelect').addEventListener('change',e=>{state.studyId=e.target.value;loadStudy();});
    $('rankingSearch').addEventListener('input',()=>{state.visible=20;renderRanking();});
    $('levelFilter').addEventListener('change',()=>{state.visible=20;renderRanking();});
    $('showMoreRank').addEventListener('click',()=>{state.visible+=20;renderRanking();});
    $('refreshRank').addEventListener('click',async()=>{const btn=$('refreshRank');btn.disabled=true;try{await loadAll();if(state.scope==='study'&&state.studyId)await loadStudy();toast('Ranking actualizado.');}finally{btn.disabled=false;}});
    $('progressForm').addEventListener('submit',submitProgress);
    $('toggleCode').addEventListener('click',()=>{$('codigoInput').type=$('codigoInput').type==='password'?'text':'password';});
    $('closeMyProfile').addEventListener('click',clearProgress);
    $('resetProfile').addEventListener('click',clearProgress);
    $('headerShare').addEventListener('click',shareRanking);
    $('shareFromMore').addEventListener('click',shareRanking);
    $('downloadPodium').addEventListener('click',downloadPodium);
  }
  async function start(){
    wireEvents();navigate(location.hash.slice(1),false);
    if(window.supabase?.createClient){sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
    else{console.warn('Supabase library not loaded');}
    await loadAll();
    if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),{once:true});
  }
  start();
})();