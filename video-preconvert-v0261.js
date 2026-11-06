/* KaraokeWorld v0.26.5 — dossier UltraStar mémorisé + arrêt/reprise + cycle de vie */
(()=>{
const WORKER='./video-compat-worker-v0260.js';
const HANDLE_DB='karaokeworld_handles',HANDLE_STORE='handles',HANDLE_KEY='ultrastar-root';
const jobs=new Map(),active=new Map(),workerTasks=new Map(),unsavedResults=new Map();
let scan=null,storageNotice='',persistenceRequested=false;
let total=0,done=0,currentRun=null,ticker=0,rememberedHandle=null,backgroundSince=0,folderScanBusy=false;
const $=id=>document.getElementById(id),key=f=>[f?.name||'video',f?.size||0,f?.lastModified||0].join('|'),limit=n=>Math.max(1,Math.min(4,parseInt(n,10)||2));
const concurrency=()=>limit(localStorage.getItem('kw_video_concurrency')||2),setConcurrency=n=>localStorage.setItem('kw_video_concurrency',String(limit(n)));
function errorMessage(error){return error?.message||String(error)}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const cacheApi=()=>window.KaraokeWorldVideoCompat;
const stateKey=f=>'kw_video_result_v1:'+JSON.stringify([f.webkitRelativePath||f.name,key(f)]);
function resultFor(f){
  const id=stateKey(f);
  if(unsavedResults.has(id))return unsavedResults.get(id);
  try{return JSON.parse(localStorage.getItem(id))}catch(error){return null}
}
function saveResult(f,result){
  const id=stateKey(f);
  try{
    if(result.status==='converted')localStorage.removeItem(id);
    else localStorage.setItem(id,JSON.stringify(result));
    unsavedResults.delete(id);
  }catch(error){
    unsavedResults.set(id,result.status==='converted'?null:result);
    storageNotice='Le navigateur n’a pas pu mémoriser certains résultats vidéo.';
  }
}
function requestPersistence(){
  if(persistenceRequested||!navigator.storage?.persist)return;
  persistenceRequested=true;
  navigator.storage.persist().catch(()=>{});
}
function fmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));if(sec<60)return `${sec} s`;const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;if(h)return `${h} h ${String(m).padStart(2,'0')} min`;return `${m} min ${String(s).padStart(2,'0')} s`}
function phase(label){if(/Conversion MP4/i.test(label))return'transcode';if(/Adaptation/i.test(label))return'remux';if(/Vérification|Démarrage/i.test(label))return'check';return'other'}
function box(){
  let b=$('ultraStarPreconvert');if(b)return b;const p=$('ultrastarPanel');if(!p)return null;
  b=document.createElement('div');b.id='ultraStarPreconvert';b.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a;display:none';
  b.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>🎬 Préparation automatique des vidéos</b><span id="ultraStarPreconvertCount" class="status">0/0</span></div><div id="ultraStarPreconvertText" class="muted" style="margin-top:6px"></div><div id="ultraStarPreconvertEta" style="margin-top:7px;font-weight:800">⏱ Calcul du temps restant…</div><div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden;margin-top:8px"><i id="ultraStarPreconvertBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#34d399,#56dfff)"></i></div><div id="ultraStarPreconvertPool" class="muted" style="font-size:11px;margin-top:7px"></div><div id="ultraStarLifecycle" class="muted" style="font-size:11px;margin-top:5px"></div><div class="controls wrap" style="justify-content:flex-start;margin-top:8px"><button id="ultraStarStopConversions" class="danger" type="button">⏹ Arrêter toutes les conversions</button><button id="ultraStarResumeConversions" class="secondary hidden" type="button">▶ Reprendre les conversions</button><button id="ultraStarRetryConversions" class="secondary hidden" type="button">↻ Relancer les vidéos en échec</button></div><div id="ultraStarPreconvertFailures"></div><div id="ultraStarPreconvertActive" style="display:grid;gap:5px;margin-top:8px"></div>';
  p.appendChild(b);bindControlButtons();return b;
}
function activeEta(x){if(!x||x.p<=1)return null;const ph=phase(x.label);if(ph!=='remux'&&ph!=='transcode')return null;const elapsed=(Date.now()-(x.phaseStartedAt||x.startedAt||Date.now()))/1000;if(elapsed<4||x.p<3)return null;const rate=x.p/elapsed;if(rate<=0)return null;return Math.max(0,(100-x.p)/rate)}
function globalEta(){
  const run=currentRun;if(!run||run.paused||!total||done>=total)return null;
  const now=Date.now(),rates=[];
  for(const x of active.values()){const ph=phase(x.label);if((ph==='remux'||ph==='transcode')&&x.p>=3){const sec=(now-(x.phaseStartedAt||x.startedAt||now))/1000;if(sec>=4)rates.push({bps:(x.size||1)/(sec/(x.p/100)),secPerFile:sec/(x.p/100)})}}
  const hist=run.history||[];let avgSec=hist.length?hist.reduce((a,b)=>a+b,0)/hist.length:null;
  if(!avgSec&&rates.length)avgSec=rates.reduce((a,b)=>a+b.secPerFile,0)/rates.length;
  if(!avgSec)return null;
  let activeRemaining=0;for(const x of active.values()){const e=activeEta(x);activeRemaining+=e==null?avgSec:e}
  const queued=run.queue.length;const slots=Math.max(1,concurrency());const waves=Math.ceil(queued/slots);return Math.max(activeRemaining/Math.max(1,Math.min(slots,active.size||1)),waves*avgSec);
}
function updateControls(){const run=currentRun;const retry=$('ultraStarRetryConversions');if(retry)retry.classList.toggle('hidden',!!scan||!run?.finished||!run.failures.length);const stop=$('ultraStarStopConversions'),resume=$('ultraStarResumeConversions');if(!stop||!resume)return;const paused=!!run?.paused;stop.classList.toggle('hidden',!run||run.finished||paused);resume.classList.toggle('hidden',!run||run.finished||!paused);resume.textContent=run?.pauseReason==='lifecycle'?'▶ Reprendre après mise en veille':'▶ Reprendre les conversions'}
function paint(text=''){
  const b=box();if(b)b.style.display='block';const run=currentRun,n=concurrency(),queued=run?run.queue.length:0,running=run?.running||active.size;
  if($('ultraStarPreconvertCount'))$('ultraStarPreconvertCount').textContent=`${done}/${total}`;
  if(text&&$('ultraStarPreconvertText'))$('ultraStarPreconvertText').textContent=text;
  if($('ultraStarPreconvertBar'))$('ultraStarPreconvertBar').style.width=`${total?Math.round(done/total*100):100}%`;
  if($('ultraStarPreconvertPool'))$('ultraStarPreconvertPool').textContent=run?.paused?`Conversions arrêtées · ${queued+running} restante${queued+running>1?'s':''}`:`${running} active${running>1?'s':''} / ${n} autorisée${n>1?'s':''}${queued?` · ${queued} en attente`:''}`;
  const eta=$('ultraStarPreconvertEta');if(eta){if(run?.paused)eta.textContent='⏸ Temps restant suspendu';else if(!scan&&(!total||done>=total))eta.textContent=total?'✅ Vérification terminée':'';else{const e=globalEta();eta.textContent=e==null?'⏱ Calcul du temps restant…':`⏱ Temps restant estimé : ~${fmtTime(e)}`}}
  const life=$('ultraStarLifecycle');if(life){if(document.hidden&&run&&!run.paused)life.textContent='⚠️ Onglet en arrière-plan : Chrome peut ralentir les conversions. Elles seront mises en pause proprement si la page est gelée.';else if(run?.pauseReason==='lifecycle')life.textContent='⏸ Chrome a suspendu la page : conversions mises en pause sans perdre celles déjà terminées.';else if(run&&!run.finished)life.textContent='ℹ️ Les conversions déjà terminées restent en cache même si tu arrêtes ou recharges la page.';else life.textContent=storageNotice}
  if($('ultraStarPreconvertActive'))$('ultraStarPreconvertActive').innerHTML=[...active.values()].map(x=>{const e=activeEta(x);return `<div style="padding:6px 8px;border:1px solid #1c334d;border-radius:8px"><div style="display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</span><b>${x.p}%</b></div><div class="muted" style="font-size:11px">${esc(x.label)}${e!=null?` · ~${esc(fmtTime(e))} restante${e>1?'s':''}`:''}</div></div>`}).join('');
  updateControls();
}
function progress(f,label,p){const k=key(f),old=active.get(k),ph=phase(label),oldPh=phase(old?.label||'');active.set(k,{name:f.name,label,p:Math.max(0,Math.min(100,Math.round(p||0))),size:f.size||0,startedAt:old?.startedAt||Date.now(),phaseStartedAt:(!old||ph!==oldPh)?Date.now():(old.phaseStartedAt||Date.now())});paint()}
function startTicker(){clearInterval(ticker);ticker=setInterval(()=>{if(currentRun&&!currentRun.finished)paint()},1000)}
function stopTicker(){clearInterval(ticker);ticker=0}
function settings(){if($('videoConcurrency'))return;const s=$('settings');if(!s)return;const d=document.createElement('div');d.innerHTML='<hr><h3>🎬 Conversion vidéo UltraStar</h3><p class="muted">Nombre de vidéos incompatibles préparées en même temps. Le changement est appliqué immédiatement à la file en cours.</p><div class="controls wrap" style="justify-content:flex-start"><label for="videoConcurrency">Conversions simultanées</label><select id="videoConcurrency"><option value="1">1 · Économie</option><option value="2">2 · Recommandé</option><option value="3">3 · Rapide</option><option value="4">4 · Très rapide</option></select><span id="videoConcurrencyHint" class="status"></span></div>';s.appendChild(d);const sel=$('videoConcurrency'),hint=$('videoConcurrencyHint'),sync=()=>{sel.value=String(concurrency());hint.textContent=`${concurrency()} à la fois`};sel.onchange=()=>{setConcurrency(sel.value);sync();if(currentRun&&!currentRun.paused)currentRun.pump();paint(`Limite modifiée : ${concurrency()} conversion${concurrency()>1?'s':''} simultanée${concurrency()>1?'s':''}`)};sync()}
function playable(blob,ms=3500){return new Promise(r=>{const v=document.createElement('video'),u=URL.createObjectURL(blob);let x=0;const end=ok=>{if(x)return;x=1;clearTimeout(t);v.removeAttribute('src');try{v.load()}catch(e){}URL.revokeObjectURL(u);r(ok)},hasVideo=()=>v.videoWidth>0&&v.videoHeight>0,t=setTimeout(()=>end(hasVideo()),ms);v.preload='metadata';v.muted=true;v.onloadedmetadata=()=>end(hasVideo());v.oncanplay=()=>end(hasVideo());v.onerror=()=>end(false);v.src=u;v.load()})}
function cancelAllWorkers(){for(const task of [...workerTasks.values()])task.cancel()}
async function convert(f,mode,cb,run){
  const buf=await f.arrayBuffer();
  if(run.paused||run.finished)return {cancelled:true};
  const w=new Worker(WORKER),job='pre-'+Date.now()+'-'+Math.random(),k=key(f);
  return new Promise(resolve=>{
    let ended=false;
    const end=result=>{
      if(ended)return;
      ended=true;
      workerTasks.delete(k);
      w.terminate();
      resolve(result);
    };
    workerTasks.set(k,{cancel:()=>end({cancelled:true})});
    w.onmessage=e=>{
      const d=e.data||{};
      if(d.job!==job)return;
      if(d.type==='progress')cb(Math.round(Math.max(0,Math.min(1,d.progress||0))*100));
      else if(d.type==='done')end({blob:new Blob([d.buffer],{type:'video/mp4'})});
      else if(d.type==='error')end({reason:d.message||'Erreur FFmpeg'});
    };
    w.onerror=e=>end({reason:e.message||'Le moteur vidéo n’a pas pu démarrer'});
    w.onmessageerror=()=>end({reason:'Réponse illisible du moteur vidéo'});
    try{w.postMessage({type:'convert',job,name:f.name,mode,buffer:buf},[buf])}
    catch(error){end({reason:errorMessage(error)})}
  });
}
async function knownResult(f,retry){
  try{if(await cacheApi().matchConverted(f))return {status:'cached'}}
  catch(error){throw Object.assign(new Error(errorMessage(error)),{cacheReadError:true})}
  const result=resultFor(f);
  return result?.status==='failed'&&retry?null:result;
}
async function one(f,run){
  const prepare=()=>prepareOne(f,run);
  return navigator.locks?.request
    ? navigator.locks.request('kw-video:'+key(f),prepare)
    : prepare();
}
async function prepareOne(f,run){
  if(run.finished||run.paused)return {status:'paused'};
  progress(f,'Vérification…',4);
  const known=await knownResult(f,run.retry);
  if(run.finished||run.paused)return {status:'paused'};
  if(known)return known;
  const native=await playable(f);
  if(run.finished||run.paused)return {status:'paused'};
  if(native){const result={status:'native'};saveResult(f,result);return result}

  const attempts=[['remux','Adaptation rapide'],['transcode','Conversion MP4 H.264/AAC']];
  const reasons=[];
  for(const [mode,label] of attempts){
    progress(f,label+'…',0);
    const result=await convert(f,mode,p=>progress(f,label+'…',p),run);
    if(result.cancelled||run.finished||run.paused)return {status:'paused'};
    const readable=result.blob&&await playable(result.blob);
    if(run.finished||run.paused)return {status:'paused'};
    if(readable){
      try{await cacheApi().putConverted(f,result.blob)}
      catch(error){const failed={status:'failed',reason:'Enregistrement en cache impossible · '+errorMessage(error)};saveResult(f,failed);return failed}
      const converted={status:'converted'};saveResult(f,converted);return converted;
    }
    reasons.push(label+' · '+(result.reason||'résultat illisible par le navigateur'));
  }
  const failed={status:'failed',reason:reasons.join(' / ')};
  saveResult(f,failed);
  return failed;
}
function settleEntry(e,result){if(e.settled)return;e.settled=true;e.resolve(result);jobs.delete(key(e.f))}
function abortRun(run){if(!run||run.finished)return;run.finished=true;run.paused=false;cancelAllWorkers();for(const e of run.entries)if(!e.settled)settleEntry(e,{status:'cancel'});run.queue.length=0;active.clear();run.running=0;run.finishResolve?.();if(currentRun===run)currentRun=null;stopTicker()}
function pauseRun(reason='user'){
  const run=currentRun;if(!run||run.finished||run.paused)return;run.paused=true;run.pauseReason=reason;cancelAllWorkers();paint(reason==='user'?'⏹ Conversions arrêtées. Clique sur Reprendre pour continuer.':'⏸ Conversions mises en pause par Chrome.');
}
function resumeRun(auto=false){const run=currentRun;if(!run||run.finished||!run.paused)return;if(run.pauseReason==='user'&&auto)return;run.paused=false;run.pauseReason='';paint('▶ Reprise des conversions…');run.pump();startTicker()}
function bindControlButtons(){const stop=$('ultraStarStopConversions'),resume=$('ultraStarResumeConversions');if(stop&&!stop.dataset.bound){stop.dataset.bound='1';stop.onclick=()=>pauseRun('user')}if(resume&&!resume.dataset.bound){resume.dataset.bound='1';resume.onclick=()=>resumeRun(false)}const retry=$('ultraStarRetryConversions');if(retry)retry.onclick=()=>retryFailures()}
function retryFailures(){
  if(scan||!currentRun?.finished||!currentRun.failures.length)return;
  return start(currentRun.failures.map(({f})=>f),true);
}

async function start(list,retry=false){
  if(currentRun)abortRun(currentRun);
  currentRun=null;
  const fs=[...new Map(list.map(f=>[key(f),f])).values()];
  total=fs.length;done=0;active.clear();storageNotice='';
  $('ultraStarPreconvertFailures')?.replaceChildren();
  if(!total){scan=null;paint('Aucune vidéo UltraStar à préparer.');return}

  requestPersistence();
  const pending={keys:new Set(fs.map(key)),promise:Promise.all(fs.map(f=>knownResult(f,retry)))};
  scan=pending;
  paint('Recherche des vidéos déjà traitées…');
  let results;
  try{results=await pending.promise}
  catch(error){
    if(scan!==pending)return;
    scan=null;
    storageNotice='Cache vidéo inaccessible · '+errorMessage(error);
    paint('Préparation suspendue. Réessaie en actualisant le dossier.');
    return;
  }
  if(scan!==pending)return;
  scan=null;
  const stats={native:0,cached:0,converted:0,failed:0},entries=[],failures=[];
  function count(f,result){
    stats[result.status]++;
    if(result.status==='failed')failures.push({f,reason:result.reason});
    done++;
  }
  for(const [i,f] of fs.entries()){
    if(results[i]){count(f,results[i]);continue}
    let resolve;
    const promise=new Promise(r=>resolve=r);
    entries.push({f,resolve,settled:false,startedAt:0});
    jobs.set(key(f),promise);
  }
  let finishResolve;
  const finished=new Promise(r=>finishResolve=r);
  const run={entries,queue:[...entries],running:0,finished:false,paused:false,pauseReason:'',history:[],finishResolve,pump:null,failures,retry};
  currentRun=run;

  function finishIfDone(){
    if(run.finished||done<total||run.running||run.queue.length)return;
    run.finished=true;
    active.clear();
    stopTicker();
    const suffix=stats.failed?' · '+stats.failed+' échec'+(stats.failed>1?'s':''):'';
    const prefix=entries.length?'Terminé':'Aucune conversion à lancer';
    paint(prefix+' · '+stats.native+' compatibles · '+stats.converted+' préparées · '+stats.cached+' en cache'+suffix);
    if(failures.length){
      const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');
      summary.textContent='Voir les échecs vidéo';
      for(const {f,reason} of failures){
        const item=document.createElement('li');
        item.textContent=(f.webkitRelativePath||f.name)+' · '+reason;
        list.appendChild(item);
      }
      details.append(summary,list);
      $('ultraStarPreconvertFailures')?.appendChild(details);
    }
    finishResolve();
  }

  async function launch(entry){
    const {f}=entry;
    run.running++;
    entry.startedAt=Date.now();
    progress(f,'Démarrage…',1);
    let result;
    try{result=await one(f,run)}
    catch(error){
      if(run.finished)return;
      result=run.paused?{status:'paused'}:{status:'failed',reason:errorMessage(error)};
      // Un cache temporairement inaccessible doit pouvoir être relu à la prochaine visite.
      if(result.status==='failed'&&!error.cacheReadError)saveResult(f,result);
    }
    if(run.finished)return;
    active.delete(key(f));
    run.running--;
    if(result.status==='paused')run.queue.unshift(entry);
    else{
      count(f,result);
      const elapsed=(Date.now()-entry.startedAt)/1000;
      if(result.status==='converted'&&elapsed>2)run.history.push(elapsed);
      settleEntry(entry,result);
    }
    if(!run.paused)paint('Préparation en cours · '+done+'/'+total+' terminées');
    run.pump();
    finishIfDone();
  }

  run.pump=()=>{
    if(run.finished||run.paused)return;
    const wanted=concurrency();
    while(run.running<wanted&&run.queue.length)launch(run.queue.shift());
    paint();
  };
  if(entries.length){
    paint(entries.length+' vidéo(s) à vérifier ou préparer');
    startTicker();
    run.pump();
  }
  finishIfDone();
  return finished;
}

/* Dossier UltraStar mémorisé */
function openHandleDB(){return new Promise((res,rej)=>{const q=indexedDB.open(HANDLE_DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(HANDLE_STORE))q.result.createObjectStore(HANDLE_STORE)};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function handleGet(){const d=await openHandleDB();return await new Promise((res,rej)=>{const q=d.transaction(HANDLE_STORE).objectStore(HANDLE_STORE).get(HANDLE_KEY);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}
async function handleSet(h){const d=await openHandleDB();return await new Promise((res,rej)=>{const q=d.transaction(HANDLE_STORE,'readwrite').objectStore(HANDLE_STORE).put(h,HANDLE_KEY);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
async function handleDelete(){const d=await openHandleDB();return await new Promise((res,rej)=>{const q=d.transaction(HANDLE_STORE,'readwrite').objectStore(HANDLE_STORE).delete(HANDLE_KEY);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
function folderUI(){
  let c=$('ultraStarFolderMemory');if(c)return c;const panel=$('ultrastarPanel');if(!panel)return null;c=document.createElement('div');c.id='ultraStarFolderMemory';c.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a';
  c.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>📁 Dossier UltraStar mémorisé</b><span id="ultraStarFolderMemoryBadge" class="status">Non connecté</span></div><p id="ultraStarFolderMemoryText" class="muted" style="margin:7px 0">Connecte ton dossier une fois : KaraokeWorld pourra le retrouver après une mise à jour.</p><div class="controls wrap" style="justify-content:flex-start"><button id="ultraStarConnectFolder" type="button">🔗 Connecter mon dossier</button><button id="ultraStarGrantFolder" class="secondary hidden" type="button">🔓 Autoriser l’accès</button><button id="ultraStarRefreshFolder" class="secondary hidden" type="button">🔄 Actualiser le dossier</button><button id="ultraStarForgetFolder" class="secondary hidden" type="button">✕ Oublier le dossier</button></div>';
  panel.insertBefore(c,$('ultraStarPreconvert')||null);bindFolderButtons();return c
}
function folderStatus(text,badge=''){folderUI();if($('ultraStarFolderMemoryText'))$('ultraStarFolderMemoryText').textContent=text;if(badge&&$('ultraStarFolderMemoryBadge'))$('ultraStarFolderMemoryBadge').textContent=badge;const has=!!rememberedHandle;if($('ultraStarRefreshFolder'))$('ultraStarRefreshFolder').classList.toggle('hidden',!has);if($('ultraStarForgetFolder'))$('ultraStarForgetFolder').classList.toggle('hidden',!has)}
async function permission(h,request=false){if(!h)return'denied';try{if(await h.queryPermission({mode:'read'})==='granted')return'granted';if(request)return await h.requestPermission({mode:'read'});return'prompt'}catch(e){return'denied'}}
function pathFile(file,path){try{Object.defineProperty(file,'webkitRelativePath',{value:path,configurable:true});return file}catch(e){const f=new File([file],file.name,{type:file.type,lastModified:file.lastModified});try{Object.defineProperty(f,'webkitRelativePath',{value:path,configurable:true})}catch(_){}return f}}
async function readDirectory(root){const out=[];async function walk(dir,rel){const tasks=[];for await(const [name,h] of dir.entries()){const p=rel?`${rel}/${name}`:name;if(h.kind==='directory')tasks.push(walk(h,p));else tasks.push(h.getFile().then(f=>out.push(pathFile(f,`${root.name}/${p}`))))}await Promise.all(tasks)}await walk(root,'');return out}
async function waitApp(){const started=Date.now();while(Date.now()-started<6000){try{if(typeof tracks!=='undefined'&&Array.isArray(tracks)&&tracks.length>=8&&typeof importUltraStarFolder==='function')return true}catch(e){}await new Promise(r=>setTimeout(r,100))}return typeof importUltraStarFolder==='function'}
async function scanRemembered({request=false,automatic=false}={}){
  if(folderScanBusy||!rememberedHandle)return;const p=await permission(rememberedHandle,request);const grant=$('ultraStarGrantFolder');if(grant)grant.classList.toggle('hidden',p==='granted');
  if(p!=='granted'){folderStatus(`Dossier mémorisé : ${rememberedHandle.name}. Clique sur « Autoriser l’accès » pour le recharger.`,rememberedHandle.name);return}
  folderScanBusy=true;folderStatus(`Lecture de « ${rememberedHandle.name} »…`,rememberedHandle.name);
  try{await waitApp();const files=await readDirectory(rememberedHandle);folderStatus(`${files.length} fichiers détectés · import UltraStar en cours…`,rememberedHandle.name);await importUltraStarFolder(files);folderStatus(`✅ ${rememberedHandle.name} chargé automatiquement${automatic?' après la mise à jour':''}.`,rememberedHandle.name)}catch(e){console.error(e);folderStatus(`Impossible de relire le dossier : ${e.message||e}`,rememberedHandle.name)}finally{folderScanBusy=false}
}
function bindFolderButtons(){
  const connect=$('ultraStarConnectFolder'),grant=$('ultraStarGrantFolder'),refresh=$('ultraStarRefreshFolder'),forget=$('ultraStarForgetFolder');
  if(connect&&!connect.dataset.bound){connect.dataset.bound='1';connect.onclick=async()=>{if(!window.showDirectoryPicker){folderStatus('Ce navigateur ne permet pas de mémoriser un dossier. Utilise le bouton UltraStar classique.','Non compatible');return}try{const h=await window.showDirectoryPicker({id:'karaokeworld-ultrastar',mode:'read'});rememberedHandle=h;await handleSet(h);folderStatus(`Dossier connecté : ${h.name}`,h.name);await scanRemembered({request:false})}catch(e){if(e?.name!=='AbortError')folderStatus(`Connexion impossible : ${e.message||e}`)}}}
  if(grant&&!grant.dataset.bound){grant.dataset.bound='1';grant.onclick=()=>scanRemembered({request:true})}
  if(refresh&&!refresh.dataset.bound){refresh.dataset.bound='1';refresh.onclick=()=>scanRemembered({request:true})}
  if(forget&&!forget.dataset.bound){forget.dataset.bound='1';forget.onclick=async()=>{if(currentRun)pauseRun('user');await handleDelete();rememberedHandle=null;folderStatus('Dossier oublié. Tu peux en connecter un autre.','Non connecté');grant.classList.add('hidden');refresh.classList.add('hidden');forget.classList.add('hidden')}}
}
async function restoreFolder(){folderUI();if(!window.showDirectoryPicker){folderStatus('La mémorisation automatique du dossier n’est pas disponible dans ce navigateur.','Non compatible');return}try{rememberedHandle=await handleGet()}catch(e){rememberedHandle=null}if(!rememberedHandle){folderStatus('Connecte ton dossier une fois : KaraokeWorld pourra le retrouver après une mise à jour.','Non connecté');return}folderStatus(`Dossier mémorisé : ${rememberedHandle.name}`,rememberedHandle.name);const p=await permission(rememberedHandle,false);if(p==='granted')scanRemembered({automatic:true});else{const g=$('ultraStarGrantFolder');if(g)g.classList.remove('hidden');folderStatus(`Dossier mémorisé : ${rememberedHandle.name}. Une autorisation suffit pour le recharger.`,rememberedHandle.name)}}

/* Lecture d’une vidéo en cours de préparation */
const old=window.setUltraStarStageVideo;
let stageRequest=0;
if(typeof old==='function')window.setUltraStarStageVideo=function(track){
  const request=++stageRequest;
  const f=track?.videoBlob||track?.compatVideoBlob;
  const k=f&&key(f);
  const play=()=>{
    if(request!==stageRequest)return;
    const job=jobs.get(k);
    if(job&&!currentRun?.paused){
      old(null);
      if($('state'))$('state').textContent='🎬 Vidéo en cours de préparation…';
      job.then(play);
      return;
    }
    return old(track);
  };
  if(scan?.keys.has(k)){old(null);scan.promise.then(play,play);return}
  return play();
};

/* Onglet en arrière-plan / cycle de vie */
document.addEventListener('visibilitychange',()=>{if(document.hidden){backgroundSince=Date.now();paint()}else{if(backgroundSince&&currentRun&&!currentRun.finished){const sec=Math.round((Date.now()-backgroundSince)/1000);paint(`Onglet de nouveau actif${sec>2?` après ${fmtTime(sec)}`:''}.`)}backgroundSince=0;if(currentRun?.pauseReason==='lifecycle')resumeRun(true);else paint()}});
document.addEventListener('freeze',()=>{if(currentRun&&!currentRun.paused)pauseRun('lifecycle')});
document.addEventListener('resume',()=>{if(currentRun?.pauseReason==='lifecycle')resumeRun(true)});
window.addEventListener('pageshow',()=>{if(currentRun?.pauseReason==='lifecycle')resumeRun(true)});

settings();folderUI();box();document.addEventListener('DOMContentLoaded',()=>{settings();folderUI();box();restoreFolder()},{once:true});if(document.readyState!=='loading')restoreFolder();
const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.26.5 · UltraStar 🎤';
window.KaraokeWorldVideoPreconvert={version:'0.26.5',start,retryFailures,shouldSkipConversion:f=>!!(scan?.keys.has(key(f))||jobs.has(key(f))||resultFor(f)?.status==='failed'),getConcurrency:concurrency,setConcurrency:n=>{setConcurrency(n);if(currentRun&&!currentRun.paused)currentRun.pump();paint()},stopAll:()=>pauseRun('user'),resumeAll:()=>resumeRun(false),refreshRememberedFolder:()=>scanRemembered({request:true}),waitForFile:f=>jobs.get(key(f))||Promise.resolve(),isPreparing:f=>jobs.has(key(f))};
})();
