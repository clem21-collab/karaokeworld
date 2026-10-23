/* KaraokeWorld v0.27.6 — Voix ON/OFF + préparation instrumentale IA persistante */
(()=>{
  if(window.KaraokeWorldVocalSeparation?.installed)return;
  const VERSION='0.27.6';
  const MODEL='UVR_MDXNET_KARA_2';
  const LIB_URL='https://esm.sh/web-audio-separation@0.3.0?deps=onnxruntime-web@1.29.0';
  const CACHE='karaokeworld-instrumental-v1';
  const MODEL_CACHE='web-demix2-models';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const CHECKPOINT_KEY='kw_vocal_batch_checkpoint_v1';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const safe=s=>String(s||'').replace(/[\\/:*?"<>|\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120)||'KaraokeWorld';
  const hash=s=>{let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let separator=null,separatorPromise=null,currentModelProgress=null;
  let voiceOff=false,lastCurrentId=null,activeInstrumentalUrl='';
  let batch={running:false,stopRequested:false,total:0,done:0,current:null};

  function getTracks(){try{return Array.isArray(tracks)?tracks:[]}catch(e){return []}}
  function currentTrack(){try{return getTracks().find(t=>t.id===currentId)||null}catch(e){return null}}
  function driveToken(){try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return ''}}
  function manifestOf(t){return t?.cloudBackupManifest||t?.cloudManifest||null}
  function docIdOf(t){return t?.cloudBackupDocId||t?.cloudDocId||null}
  function identityOf(t){return docIdOf(t)||norm(`${t?.artist||''}|${t?.title||''}`)||String(t?.id||'track')}
  function sourceFingerprint(t){
    const m=manifestOf(t)||{},b=t?.blob;
    if(b)return `${b.name||'audio'}|${b.size||0}|${b.lastModified||0}`;
    if(m.audioFileId)return `drive:${m.audioFileId}`;
    return `${identityOf(t)}|${t?.url||''}`;
  }
  function sourceFpHash(t){return hash(sourceFingerprint(t))}
  function cacheUrl(t){return new URL(`./__kw_instrumental_cache__/v1-${hash(identityOf(t)+'|'+sourceFingerprint(t))}.wav`,location.href).href}
  async function cachedBlob(t){try{const r=await(await caches.open(CACHE)).match(cacheUrl(t));return r?await r.blob():null}catch(e){return null}}
  async function cacheBlob(t,blob){try{await(await caches.open(CACHE)).put(cacheUrl(t),new Response(blob,{headers:{'Content-Type':'audio/wav','X-KaraokeWorld-Model':MODEL}}));return true}catch(e){console.warn('KaraokeWorld cache instrumental',e);return false}}
  function drivePrepared(t){const m=manifestOf(t);return !!(m?.instrumentalFileId&&(!m.instrumentalSourceFingerprint||m.instrumentalSourceFingerprint===sourceFingerprint(t)))}
  function eligible(t){const m=manifestOf(t);return !!t&&!t.demo&&t.kind!=='demo'&&(t.kind==='ultrastar'||t.kind==='ultrastar-cloud')&&!!(t.blob||t.url||m?.audioFileId)}

  function setStatus(text){const el=$('kwVocalStatus');if(el)el.textContent=text}
  function setProgress(pct){const el=$('kwVocalBar');if(el)el.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%'}
  function setBadge(text){const el=$('kwVocalBadge');if(el)el.textContent=text}
  function checkpoint(data){try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({...data,active:true,updatedAt:Date.now()}))}catch(e){}}
  function readCheckpoint(){try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null')}catch(e){return null}}
  function clearCheckpoint(){try{localStorage.removeItem(CHECKPOINT_KEY)}catch(e){}}

  async function driveFetch(url,options={}){
    const token=driveToken();if(!token)throw Object.assign(new Error('Autorisation Google Drive expirée.'),{status:401,code:'drive-auth'});
    const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
    const r=await fetch(url,{...options,headers});
    if(!r.ok){let msg=`Google Drive ${r.status}`;try{const j=await r.json();msg=j?.error?.message||msg}catch(e){}throw Object.assign(new Error(msg),{status:r.status,code:r.status===401?'drive-auth':'drive-error'})}
    return r;
  }
  function q(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
  async function findDriveInstrumental(t){
    const m=manifestOf(t),folderId=m?.driveFolderId,docId=docIdOf(t);if(!folderId)return null;
    const query=`trashed=false and '${q(folderId)}' in parents and appProperties has { key='kwRole' and value='instrumental' }`;
    const params=new URLSearchParams({spaces:'drive',pageSize:'20',fields:'files(id,name,size,appProperties)',q:query});
    const r=await driveFetch('https://www.googleapis.com/drive/v3/files?'+params.toString());const j=await r.json();
    const files=j.files||[],fp=sourceFpHash(t);
    return files.find(f=>(f.appProperties||{}).kwSourceFp===fp)||files.find(f=>(f.appProperties||{}).kwSongId===docId)||files[0]||null;
  }
  function putResumable(location,blob,onPct){return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('PUT',location,true);const token=driveToken();if(token)xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type','audio/wav');
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onPct?.(e.loaded/e.total)};
    xhr.onerror=()=>reject(new Error('Connexion interrompue pendant l’envoi de l’instrumental.'));
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){try{resolve(JSON.parse(xhr.responseText||'{}'))}catch(e){resolve({})}}else reject(Object.assign(new Error(`Google Drive ${xhr.status}`),{status:xhr.status,code:xhr.status===401?'drive-auth':'drive-error'}))};
    xhr.send(blob);
  })}
  async function saveManifest(t,fileInfo){
    const docId=docIdOf(t),m=manifestOf(t);if(!docId||!m)return;
    const patch={instrumentalFileId:fileInfo.id,instrumentalName:fileInfo.name||`${safe(t.artist)} - ${safe(t.title)} - Instrumental.wav`,instrumentalModel:MODEL,instrumentalSourceFingerprint:sourceFingerprint(t),instrumentalUpdatedAt:Date.now()};
    Object.assign(m,patch);
    try{
      if(typeof cloudApi!=='undefined'&&cloudApi?.setDoc&&cloudApi?.doc&&cloudApi?.fs&&typeof cloudUser!=='undefined'&&cloudUser?.uid){
        await cloudApi.setDoc(cloudApi.doc(cloudApi.fs,'users',cloudUser.uid,'ultrastar',docId),patch,{merge:true});
      }
    }catch(e){console.warn('KaraokeWorld Firestore instrumental',e);throw e}
  }
  async function uploadInstrumental(t,blob,onPct){
    const m=manifestOf(t),folderId=m?.driveFolderId,docId=docIdOf(t);if(!folderId||!docId)return null;
    if(!driveToken())throw Object.assign(new Error('Réautorise Google Drive avant de continuer.'),{status:401,code:'drive-auth'});
    let existing=null;
    if(m.instrumentalFileId)existing={id:m.instrumentalFileId,name:m.instrumentalName||''};
    if(!existing)try{existing=await findDriveInstrumental(t)}catch(e){if(e?.status===401)throw e}
    const fp=sourceFpHash(t);
    if(existing&&(existing.appProperties||{}).kwSourceFp===fp){await saveManifest(t,existing);return existing}
    const name=`${safe(t.artist)} - ${safe(t.title)} - Instrumental.wav`;
    const metadata={name,appProperties:{kwApp:'KaraokeWorld',kwSongId:docId,kwRole:'instrumental',kwModel:MODEL,kwSourceFp:fp}};
    if(!existing)metadata.parents=[folderId];
    const base=existing?`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=resumable&fields=id,name,size,appProperties`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,appProperties';
    const start=await driveFetch(base,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'audio/wav','X-Upload-Content-Length':String(blob.size||0)},body:JSON.stringify(metadata)});
    const loc=start.headers.get('Location');if(!loc)throw new Error('Google Drive n’a pas créé la session d’envoi instrumental.');
    const out=await putResumable(loc,blob,onPct);const fileInfo={id:out.id||existing?.id,name:out.name||name,size:out.size||blob.size,appProperties:out.appProperties||metadata.appProperties};
    await saveManifest(t,fileInfo);return fileInfo;
  }
  async function downloadDriveInstrumental(t){
    const m=manifestOf(t);if(!m?.instrumentalFileId)return null;
    const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(m.instrumentalFileId)}?alt=media`);const b=await r.blob();await cacheBlob(t,b);return b;
  }
  async function originalBlob(t){
    if(t?.blob instanceof Blob)return t.blob;
    if(t?.url){try{const r=await fetch(t.url);if(r.ok)return await r.blob()}catch(e){}}
    const m=manifestOf(t);if(m?.audioFileId){const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(m.audioFileId)}?alt=media`);return r.blob()}
    throw new Error('Audio original introuvable pour cette chanson.');
  }

  function modelProgress(p){
    currentModelProgress=p||null;if(!batch.running||!batch.current)return;
    let frac=0;
    if(p?.stage==='loading-model')frac=.02*Math.max(0,Math.min(1,p.fraction||0));
    else if(p?.stage==='demixing')frac=.03+.90*Math.max(0,Math.min(1,p.fraction||0));
    else if(p?.stage==='writing-output')frac=.93+.07*Math.max(0,Math.min(1,p.fraction||0));
    const totalPct=batch.total?((batch.done+frac)/batch.total)*100:0;setProgress(totalPct);
    if(p?.stage==='demixing')setStatus(`🎤 ${batch.current.artist} — ${batch.current.title} · séparation de la voix ${Math.round((p.fraction||0)*100)} % · ${batch.done}/${batch.total} terminées`);
  }
  async function ensureSeparator(){
    if(separator)return separator;if(separatorPromise)return separatorPromise;
    separatorPromise=(async()=>{
      setStatus('⬇️ Chargement du moteur de séparation vocale et du modèle IA…');
      const mod=await import(LIB_URL);const createSeparator=mod.createSeparator;if(typeof createSeparator!=='function')throw new Error('Moteur de séparation vocale non chargé.');
      const executionProviders=('gpu'in navigator)?['webgpu','wasm']:['wasm'];
      const s=createSeparator(MODEL,{common:{logLevel:'warning',outputSingleStem:'instrumental',onProgress:modelProgress},mdx:{batchSize:1,overlap:.25,executionProviders}});
      await s.loadModel();separator=s;return s;
    })();
    try{return await separatorPromise}finally{separatorPromise=null}
  }
  function resetSeparatorSongState(s){
    try{s.primarySource=undefined;s.secondarySource=undefined;s.audioFilePath=undefined}catch(e){}
  }
  async function separateTrack(t){
    const source=await originalBlob(t),srcUrl=URL.createObjectURL(source);let urls=[];
    try{
      const s=await ensureSeparator();resetSeparatorSongState(s);urls=await s.separate(srcUrl);if(!urls?.length)throw new Error('Le moteur IA n’a produit aucun instrumental.');
      const r=await fetch(urls[urls.length-1]);if(!r.ok)throw new Error('Instrumental généré illisible.');const blob=await r.blob();await cacheBlob(t,blob);return blob;
    }finally{URL.revokeObjectURL(srcUrl);for(const u of urls||[])try{URL.revokeObjectURL(u)}catch(e){}resetSeparatorSongState(separator||{})}
  }
  async function preparedBlob(t,{allowGenerate=false,upload=true}={}){
    let blob=await cachedBlob(t);
    if(!blob&&drivePrepared(t)){
      if(!driveToken())throw Object.assign(new Error('L’instrumental est sur Google Drive. Réautorise Drive pour le charger.'),{status:401,code:'drive-auth'});
      blob=await downloadDriveInstrumental(t);
    }
    if(!blob&&allowGenerate)blob=await separateTrack(t);
    if(blob&&upload&&!drivePrepared(t)&&manifestOf(t)?.driveFolderId){
      setStatus(`☁ Envoi de l’instrumental de ${t.artist} — ${t.title} sur Google Drive…`);
      await uploadInstrumental(t,blob,p=>{if(batch.running&&batch.total)setProgress(((batch.done+.94+.06*p)/batch.total)*100)});
    }
    return blob;
  }

  async function isPrepared(t){if(drivePrepared(t))return true;return !!(await cachedBlob(t))}
  async function countPrepared(){
    const list=getTracks().filter(eligible);let ready=0;
    for(const t of list)if(await isPrepared(t))ready++;
    setBadge(`${ready}/${list.length} prêtes`);return{ready,total:list.length}
  }

  async function swapAudio(url){
    const a=$('audio');if(!a)throw new Error('Lecteur audio introuvable.');const wasPlaying=!a.paused,time=Number(a.currentTime||0);
    a.pause();a.src=url;a.load();await new Promise(res=>{let done=false;const end=()=>{if(done)return;done=true;clearTimeout(to);res()};const to=setTimeout(end,2500);a.addEventListener('loadedmetadata',end,{once:true});a.addEventListener('canplay',end,{once:true})});
    try{if(Number.isFinite(a.duration))a.currentTime=Math.min(time,Math.max(0,a.duration-.05));else a.currentTime=time}catch(e){}
    if(wasPlaying)await a.play().catch(()=>{});
  }
  function updateToggleButtons(){
    const t=currentTrack(),disabled=!t||t.kind==='demo';
    for(const id of ['kwVoiceToggle','kwVoiceToggleStage']){const b=$(id);if(!b)continue;b.disabled=disabled;b.textContent=voiceOff?'🎶 Voix : OFF':'🎤 Voix : ON';b.title=voiceOff?'Cliquer pour remettre la voix originale':'Cliquer pour retirer la voix principale'}
  }
  async function toggleVoice(){
    const t=currentTrack();if(!t){setStatus('Choisis d’abord une chanson.');return}
    const buttons=[$('kwVoiceToggle'),$('kwVoiceToggleStage')].filter(Boolean);buttons.forEach(b=>{b.disabled=true;b.textContent='⏳ Préparation…'});
    try{
      if(voiceOff){await swapAudio(t.url);voiceOff=false;setStatus(`🎤 Voix originale activée · ${t.artist} — ${t.title}`);return}
      setStatus(`🎶 Préparation de la version sans voix · ${t.artist} — ${t.title}…`);
      const blob=await preparedBlob(t,{allowGenerate:true,upload:true});if(!blob)throw new Error('Instrumental indisponible.');
      if(activeInstrumentalUrl)try{URL.revokeObjectURL(activeInstrumentalUrl)}catch(e){}activeInstrumentalUrl=URL.createObjectURL(blob);await swapAudio(activeInstrumentalUrl);voiceOff=true;setStatus(`🎶 Voix OFF · ${t.artist} — ${t.title}`);countPrepared();
    }catch(e){console.error(e);if(e?.code==='drive-auth'||e?.status===401)setStatus('🔐 Réautorise Google Drive, puis réessaie Voix OFF.');else setStatus('Séparation vocale impossible : '+(e?.message||e))}
    finally{updateToggleButtons()}
  }

  function ensurePlayerButtons(){
    const play=$('play');if(play&&!$('kwVoiceToggle')){const b=document.createElement('button');b.id='kwVoiceToggle';b.type='button';b.className='secondary';b.textContent='🎤 Voix : ON';b.onclick=toggleVoice;play.parentElement?.appendChild(b)}
    const stage=$('stagePlay');if(stage&&!$('kwVoiceToggleStage')){const b=document.createElement('button');b.id='kwVoiceToggleStage';b.type='button';b.className='secondary';b.textContent='🎤 Voix : ON';b.onclick=toggleVoice;stage.parentElement?.appendChild(b)}
    updateToggleButtons();
  }

  function ensurePanel(){
    let box=$('kwVocalPanel');if(box)return box;const host=$('ultrastarPanel');if(!host)return null;
    box=document.createElement('div');box.id='kwVocalPanel';box.style.cssText='margin-top:12px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>🎤 Voix ON/OFF · préparation IA</b><span id="kwVocalBadge" class="status">Analyse…</span></div>
      <p class="muted" style="margin:7px 0">Prépare automatiquement une version instrumentale de toute ta bibliothèque avec <b>${MODEL}</b>. Le traitement se fait sur ce PC, une chanson à la fois. Le modèle est téléchargé une seule fois puis mis en cache.</p>
      <div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden"><i id="kwVocalBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#ec4899,#8b5cf6,#38bdf8);transition:width .2s ease"></i></div>
      <div id="kwVocalStatus" class="muted" style="margin-top:7px">Prêt. Les instrumentaux terminés sont conservés dans le navigateur et, lorsque Drive est disponible, dans KaraokeWorld/UltraStar.</div>
      <div class="controls wrap" style="justify-content:flex-start;margin-top:8px"><button id="kwVocalPrepareAll" type="button">🎶 Préparer toutes les chansons</button><button id="kwVocalStop" class="danger hidden" type="button">⏹ Arrêter après cette chanson</button><button id="kwVocalResume" class="secondary hidden" type="button">▶ Reprendre</button><button id="kwVocalAuthorize" class="secondary hidden" type="button">🔐 Réautoriser Drive</button></div>
      <div class="muted" style="font-size:11px;margin-top:6px">ℹ️ Pendant la préparation, évite de fermer l’onglet. Si tu l’interromps, KaraokeWorld reprend en ignorant automatiquement tout ce qui est déjà prêt.</div>`;
    const ref=$('cloudUltraStarBox');if(ref)ref.insertAdjacentElement('beforebegin',box);else host.appendChild(box);
    $('kwVocalPrepareAll').onclick=startBatch;$('kwVocalStop').onclick=()=>{batch.stopRequested=true;setStatus('⏹ Arrêt demandé : la chanson en cours se termine puis la file s’arrête.')};$('kwVocalResume').onclick=startBatch;$('kwVocalAuthorize').onclick=()=>{$('cloudDriveAuthorize')?.click()};
    const cp=readCheckpoint();if(cp?.active){$('kwVocalResume').classList.remove('hidden');setStatus(`⚠️ Préparation précédente interrompue · ${cp.done||0}/${cp.total||'?'} terminées. Clique sur Reprendre.`)}
    return box;
  }
  function updateBatchButtons(){
    const prep=$('kwVocalPrepareAll'),stop=$('kwVocalStop'),resume=$('kwVocalResume');if(prep)prep.disabled=batch.running;if(stop)stop.classList.toggle('hidden',!batch.running);if(resume)resume.classList.toggle('hidden',batch.running||!readCheckpoint()?.active)
  }
  async function requestPersistence(){try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(e){}}

  async function startBatch(){
    if(batch.running)return;await requestPersistence();ensurePanel();
    const list=getTracks().filter(eligible);if(!list.length){setStatus('Aucune chanson UltraStar avec audio n’est chargée. Connecte d’abord ton dossier UltraStar.');return}
    batch={running:true,stopRequested:false,total:list.length,done:0,current:null};updateBatchButtons();checkpoint({total:list.length,done:0,current:''});
    try{
      setStatus(`Analyse de ${list.length} chansons…`);setProgress(0);
      const ready=[];for(const t of list)if(await isPrepared(t))ready.push(t);batch.done=ready.length;setBadge(`${batch.done}/${batch.total} prêtes`);checkpoint({total:batch.total,done:batch.done,current:''});
      if(batch.done>=batch.total){setProgress(100);setStatus(`✅ Les ${batch.total} chansons sont déjà prêtes pour Voix ON/OFF.`);clearCheckpoint();return}
      await ensureSeparator();
      for(const t of list){
        if(batch.stopRequested)break;if(await isPrepared(t))continue;
        batch.current=t;checkpoint({total:batch.total,done:batch.done,current:`${t.artist} — ${t.title}`});
        setStatus(`🎤 ${t.artist} — ${t.title} · préparation de l’instrumental…`);
        try{
          const blob=await preparedBlob(t,{allowGenerate:true,upload:true});if(!blob)throw new Error('Instrumental non généré.');batch.done++;setBadge(`${batch.done}/${batch.total} prêtes`);setProgress(batch.done/batch.total*100);checkpoint({total:batch.total,done:batch.done,current:''});
        }catch(e){
          console.error('KaraokeWorld batch vocal',e);
          if(e?.code==='drive-auth'||e?.status===401){batch.stopRequested=true;$('kwVocalAuthorize')?.classList.remove('hidden');setStatus(`🔐 Google Drive a expiré après ${batch.done}/${batch.total}. Réautorise Drive puis clique sur Reprendre. L’instrumental déjà calculé est conservé, il ne sera pas recalculé.`);break}
          setStatus(`⚠️ ${t.artist} — ${t.title} : ${e?.message||e}. Passage à la suivante…`);await sleep(700);
        }
      }
      if(batch.done>=batch.total){clearCheckpoint();setProgress(100);setStatus(`✅ Préparation terminée · ${batch.done}/${batch.total} chansons prêtes. Le bouton Voix ON/OFF est maintenant disponible instantanément.`)}
      else if(batch.stopRequested&&!/Réautorise Drive/.test($('kwVocalStatus')?.textContent||'')){setStatus(`⏸ Préparation arrêtée · ${batch.done}/${batch.total} terminées. Clique sur Reprendre quand tu veux.`)}
    }catch(e){console.error(e);setStatus('Préparation vocale interrompue : '+(e?.message||e))}
    finally{batch.running=false;batch.current=null;updateBatchButtons();countPrepared();updateToggleButtons()}
  }

  function watchCurrent(){
    let id=null;try{id=currentId}catch(e){}
    if(id!==lastCurrentId){lastCurrentId=id;voiceOff=false;if(activeInstrumentalUrl){try{URL.revokeObjectURL(activeInstrumentalUrl)}catch(e){}activeInstrumentalUrl=''}updateToggleButtons()}
  }
  function markVersion(){const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.27.6 · Voix ON/OFF 🎤'}
  async function boot(){
    ensurePlayerButtons();ensurePanel();markVersion();
    [300,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{ensurePlayerButtons();ensurePanel();markVersion();countPrepared()},ms));
    setInterval(()=>{ensurePlayerButtons();ensurePanel();watchCurrent();markVersion()},1500);
    setInterval(()=>countPrepared(),15000);
  }
  window.addEventListener('beforeunload',e=>{if(batch.running){e.preventDefault();e.returnValue=''}});
  window.addEventListener('kw-drive-token',()=>{$('kwVocalAuthorize')?.classList.add('hidden');countPrepared()});
  window.KaraokeWorldVocalSeparation={version:VERSION,installed:true,model:MODEL,startAll:startBatch,toggle:toggleVoice,countPrepared,cacheName:CACHE,modelCacheName:MODEL_CACHE};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
