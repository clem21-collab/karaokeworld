/* KaraokeWorld v0.27.9 — Voix ON/OFF + préparation IA indépendante de Google Drive */
(()=>{
  if(window.KaraokeWorldVocalSeparation?.installed)return;
  const VERSION='0.27.9';
  const MODEL='UVR_MDXNET_KARA_2';
  const LIB_URL='https://esm.sh/web-audio-separation@0.3.0?deps=onnxruntime-web@1.29.0';
  const STEM_CACHE='karaokeworld-instrumental-v1';
  const MODEL_CACHE='web-demix2-models';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const CHECKPOINT_KEY='kw_vocal_batch_checkpoint_v1';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const safe=s=>String(s||'').replace(/[\\/:*?"<>|\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120)||'KaraokeWorld';
  const hash=s=>{s=String(s||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};

  let separator=null,separatorPromise=null,processingTrack=null;
  let voiceOff=false,lastCurrentId=null,activeStemUrl='';
  let syncingDrive=false;
  let batch={running:false,stopRequested:false,total:0,done:0,current:null};

  function tracksNow(){try{return Array.isArray(tracks)?tracks:[]}catch(e){return []}}
  function currentTrack(){try{return tracksNow().find(t=>t.id===currentId)||null}catch(e){return null}}
  function manifestOf(t){return t?.cloudBackupManifest||t?.cloudManifest||null}
  function docIdOf(t){return t?.cloudBackupDocId||t?.cloudDocId||null}
  function identityOf(t){return docIdOf(t)||norm(`${t?.artist||''}|${t?.title||''}`)||String(t?.id||'track')}
  function driveToken(){try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return''}}
  function sourceKey(t){
    const m=manifestOf(t)||{};
    if(m.audioFileId)return `drive:${m.audioFileId}`;
    const b=t?.blob;if(b)return `local:${b.name||'audio'}|${b.size||0}|${b.lastModified||0}`;
    return `track:${identityOf(t)}`;
  }
  function sourceHash(t){return hash(sourceKey(t))}
  function stemCacheUrl(t){return new URL(`./__kw_instrumental_cache__/v1-${hash(identityOf(t)+'|'+sourceKey(t))}.wav`,location.href).href}
  function driveReady(t){const m=manifestOf(t);return !!(m?.instrumentalFileId&&(!m.instrumentalSourceKey||m.instrumentalSourceKey===sourceKey(t)))}
  function eligible(t){const m=manifestOf(t);return !!t&&t.kind!=='demo'&&(t.kind==='ultrastar'||t.kind==='ultrastar-cloud')&&!!(t.blob||t.url||m?.audioFileId)}

  async function cacheGet(t){try{const r=await(await caches.open(STEM_CACHE)).match(stemCacheUrl(t));return r?await r.blob():null}catch(e){return null}}
  async function cachePut(t,blob){try{await(await caches.open(STEM_CACHE)).put(stemCacheUrl(t),new Response(blob,{headers:{'Content-Type':'audio/wav','X-KaraokeWorld-Model':MODEL}}));return true}catch(e){console.warn('KaraokeWorld cache instrumental',e);return false}}

  function setStatus(s){const el=$('kwVocalStatus');if(el)el.textContent=s}
  function setBadge(s){const el=$('kwVocalBadge');if(el)el.textContent=s}
  function setProgress(n){const el=$('kwVocalBar');if(el)el.style.width=Math.max(0,Math.min(100,Number(n)||0))+'%'}
  function showDriveAuthorize(show=true){$('kwVocalAuthorize')?.classList.toggle('hidden',!show)}
  function readCheckpoint(){try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null')}catch(e){return null}}
  function saveCheckpoint(data){try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({...data,active:true,updatedAt:Date.now()}))}catch(e){}}
  function clearCheckpoint(){try{localStorage.removeItem(CHECKPOINT_KEY)}catch(e){}}

  async function driveFetch(url,options={}){
    const token=driveToken();if(!token)throw Object.assign(new Error('Autorisation Google Drive expirée.'),{status:401,code:'drive-auth'});
    const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
    const r=await fetch(url,{...options,headers});
    if(!r.ok){let msg=`Google Drive ${r.status}`;try{const j=await r.clone().json();msg=j?.error?.message||msg}catch(e){}throw Object.assign(new Error(msg),{status:r.status,code:r.status===401?'drive-auth':'drive-error'})}
    return r;
  }
  function q(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
  async function findExistingStem(t){
    const m=manifestOf(t),folder=m?.driveFolderId,id=docIdOf(t);if(!folder)return null;
    const query=`trashed=false and '${q(folder)}' in parents and appProperties has { key='kwRole' and value='instrumental' }`;
    const params=new URLSearchParams({spaces:'drive',pageSize:'20',fields:'files(id,name,size,appProperties)',q:query});
    const r=await driveFetch('https://www.googleapis.com/drive/v3/files?'+params);const j=await r.json(),files=j.files||[],fp=sourceHash(t);
    return files.find(f=>(f.appProperties||{}).kwSourceFp===fp)||files.find(f=>(f.appProperties||{}).kwSongId===id)||files[0]||null;
  }
  function uploadBody(location,blob,onProgress){return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();x.open('PUT',location,true);const token=driveToken();if(token)x.setRequestHeader('Authorization','Bearer '+token);x.setRequestHeader('Content-Type','audio/wav');
    x.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(e.loaded/e.total)};
    x.onerror=()=>reject(new Error('Connexion interrompue pendant l’envoi de l’instrumental.'));
    x.onload=()=>{if(x.status>=200&&x.status<300){try{resolve(JSON.parse(x.responseText||'{}'))}catch(e){resolve({})}}else reject(Object.assign(new Error(`Google Drive ${x.status}`),{status:x.status,code:x.status===401?'drive-auth':'drive-error'}))};
    x.send(blob);
  })}
  async function saveManifest(t,file){
    const m=manifestOf(t),id=docIdOf(t);if(!m||!id)return;
    const patch={instrumentalFileId:file.id,instrumentalName:file.name||`${safe(t.artist)} - ${safe(t.title)} - Instrumental.wav`,instrumentalModel:MODEL,instrumentalSourceKey:sourceKey(t),instrumentalUpdatedAt:Date.now()};
    Object.assign(m,patch);
    if(typeof cloudApi!=='undefined'&&cloudApi?.setDoc&&cloudApi?.doc&&cloudApi?.fs&&typeof cloudUser!=='undefined'&&cloudUser?.uid){
      await cloudApi.setDoc(cloudApi.doc(cloudApi.fs,'users',cloudUser.uid,'ultrastar',id),patch,{merge:true});
    }
  }
  async function uploadStem(t,blob,onProgress){
    const m=manifestOf(t),folder=m?.driveFolderId,id=docIdOf(t);if(!folder||!id)return null;
    if(!driveToken())throw Object.assign(new Error('Réautorise Google Drive.'),{status:401,code:'drive-auth'});
    let existing=m.instrumentalFileId?{id:m.instrumentalFileId,name:m.instrumentalName||'',appProperties:{}}:null;
    if(!existing)existing=await findExistingStem(t);
    const fp=sourceHash(t);
    if(existing&&(existing.appProperties||{}).kwSourceFp===fp){await saveManifest(t,existing);return existing}
    const name=`${safe(t.artist)} - ${safe(t.title)} - Instrumental.wav`;
    const metadata={name,appProperties:{kwApp:'KaraokeWorld',kwSongId:id,kwRole:'instrumental',kwModel:MODEL,kwSourceFp:fp}};if(!existing)metadata.parents=[folder];
    const url=existing?`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=resumable&fields=id,name,size,appProperties`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,appProperties';
    const start=await driveFetch(url,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'audio/wav','X-Upload-Content-Length':String(blob.size||0)},body:JSON.stringify(metadata)});
    const loc=start.headers.get('Location');if(!loc)throw new Error('Session d’envoi Drive non créée.');
    const result=await uploadBody(loc,blob,onProgress),file={id:result.id||existing?.id,name:result.name||name,size:result.size||blob.size,appProperties:result.appProperties||metadata.appProperties};
    await saveManifest(t,file);return file;
  }
  async function downloadStem(t){const m=manifestOf(t);if(!m?.instrumentalFileId)return null;const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(m.instrumentalFileId)}?alt=media`);const b=await r.blob();await cachePut(t,b);return b}
  async function sourceBlob(t){
    if(t?.blob instanceof Blob)return t.blob;
    if(t?.url)try{const r=await fetch(t.url);if(r.ok)return r.blob()}catch(e){}
    const m=manifestOf(t);if(m?.audioFileId){const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(m.audioFileId)}?alt=media`);return r.blob()}
    throw new Error('Audio original introuvable.');
  }

  function onModelProgress(p){
    const t=processingTrack;if(!t)return;
    let local=0;if(p?.stage==='loading-model')local=.02*(p.fraction||0);else if(p?.stage==='demixing')local=.03+.90*(p.fraction||0);else if(p?.stage==='writing-output')local=.93+.07*(p.fraction||0);
    if(batch.running&&batch.total)setProgress(((batch.done+local)/batch.total)*100);
    if(p?.stage==='demixing')setStatus(`🎤 ${t.artist} — ${t.title} · séparation ${Math.round((p.fraction||0)*100)} %${batch.running?` · ${batch.done}/${batch.total} terminées`:''}`);
  }
  async function ensureSeparator(){
    if(separator)return separator;if(separatorPromise)return separatorPromise;
    separatorPromise=(async()=>{
      setStatus('⬇️ Premier lancement : chargement du moteur et du modèle IA…');
      const mod=await import(LIB_URL);if(typeof mod.createSeparator!=='function')throw new Error('Moteur IA non chargé.');
      const providers=('gpu'in navigator)?['webgpu','wasm']:['wasm'];
      const s=mod.createSeparator(MODEL,{common:{logLevel:'warning',outputSingleStem:'instrumental',onProgress:onModelProgress},mdx:{batchSize:1,overlap:.25,executionProviders:providers}});
      await s.loadModel();separator=s;return s;
    })();
    try{return await separatorPromise}finally{separatorPromise=null}
  }
  function resetSongState(s){try{s.primarySource=undefined;s.secondarySource=undefined;s.audioFilePath=undefined}catch(e){}}
  async function separateLocally(t){
    processingTrack=t;const input=await sourceBlob(t),src=URL.createObjectURL(input);let urls=[];
    try{
      const s=await ensureSeparator();resetSongState(s);urls=await s.separate(src);if(!urls.length)throw new Error('Aucun instrumental produit.');
      const r=await fetch(urls[urls.length-1]);if(!r.ok)throw new Error('Instrumental produit illisible.');const blob=await r.blob();await cachePut(t,blob);return blob;
    }finally{URL.revokeObjectURL(src);for(const u of urls)try{URL.revokeObjectURL(u)}catch(e){}resetSongState(separator||{});processingTrack=null}
  }
  async function getOrPrepare(t,{generate=false,persistDrive=true}={}){
    let blob=await cacheGet(t);
    if(!blob&&driveReady(t)){
      if(!driveToken())throw Object.assign(new Error('Instrumental disponible sur Drive : réautorise Google Drive pour le charger.'),{status:401,code:'drive-auth'});
      blob=await downloadStem(t);
    }
    if(!blob&&generate)blob=await separateLocally(t);
    if(blob&&persistDrive&&manifestOf(t)?.driveFolderId&&!driveReady(t)){
      if(!driveToken()){showDriveAuthorize(true);return blob}
      try{
        setStatus(`☁ Sauvegarde de l’instrumental · ${t.artist} — ${t.title}…`);
        await uploadStem(t,blob,p=>{if(batch.running&&batch.total)setProgress(((batch.done+.94+.06*p)/batch.total)*100)});
      }catch(e){
        if(e?.code==='drive-auth'||e?.status===401){showDriveAuthorize(true);return blob}
        throw e;
      }
    }
    return blob;
  }
  async function batchReady(t){return driveReady(t)||!!(await cacheGet(t))}
  async function usableReady(t){return driveReady(t)||!!(await cacheGet(t))}

  async function countPendingDrive(){
    let n=0;
    for(const t of tracksNow().filter(eligible)){
      if(!manifestOf(t)?.driveFolderId||driveReady(t))continue;
      if(await cacheGet(t))n++;
    }
    return n;
  }

  async function syncPendingDrive({quiet=false}={}){
    if(syncingDrive||!driveToken())return 0;
    syncingDrive=true;let sent=0;
    try{
      const list=tracksNow().filter(eligible);
      for(const t of list){
        if(!manifestOf(t)?.driveFolderId||driveReady(t))continue;
        const blob=await cacheGet(t);if(!blob)continue;
        if(!quiet)setStatus(`☁ Synchronisation Drive · ${t.artist} — ${t.title}…`);
        try{await uploadStem(t,blob);sent++}
        catch(e){
          if(e?.code==='drive-auth'||e?.status===401){showDriveAuthorize(true);break}
          console.warn('KaraokeWorld synchro instrumental Drive',t?.title,e);
        }
      }
      const left=await countPendingDrive();
      if(!quiet){
        if(left===0&&sent)setStatus(`✅ Google Drive synchronisé · ${sent} instrumental${sent>1?'aux':''} envoyé${sent>1?'s':''}.`);
        else if(left>0)setStatus(`☁ ${left} instrumental${left>1?'aux':''} encore en attente de Google Drive. La préparation IA locale reste utilisable.`);
      }
      return sent;
    }finally{syncingDrive=false;countReady()}
  }

  async function countReady(){const list=tracksNow().filter(eligible);let n=0;for(const t of list)if(await usableReady(t))n++;setBadge(`${n}/${list.length} prêtes`);return{ready:n,total:list.length}}

  async function swapAudio(url){
    const a=$('audio');if(!a)throw new Error('Lecteur audio introuvable.');const playing=!a.paused,pos=Number(a.currentTime||0);a.pause();a.src=url;a.load();
    await new Promise(res=>{let done=false;const end=()=>{if(done)return;done=true;clearTimeout(timer);res()};const timer=setTimeout(end,2500);a.addEventListener('loadedmetadata',end,{once:true});a.addEventListener('canplay',end,{once:true})});
    try{a.currentTime=Number.isFinite(a.duration)?Math.min(pos,Math.max(0,a.duration-.05)):pos}catch(e){}if(playing)await a.play().catch(()=>{});
  }
  function refreshVoiceButtons(){const t=currentTrack(),disabled=!t||t.kind==='demo';for(const id of['kwVoiceToggle','kwVoiceToggleStage']){const b=$(id);if(!b)continue;b.disabled=disabled;b.textContent=voiceOff?'🎶 Voix : OFF':'🎤 Voix : ON';b.title=voiceOff?'Remettre la voix originale':'Retirer la voix principale'}}
  async function toggleVoice(){
    const t=currentTrack();if(!t){setStatus('Choisis d’abord une chanson.');return}const btns=[$('kwVoiceToggle'),$('kwVoiceToggleStage')].filter(Boolean);btns.forEach(b=>{b.disabled=true;b.textContent='⏳ Préparation…'});
    try{
      if(voiceOff){await swapAudio(t.url);voiceOff=false;if(activeStemUrl){URL.revokeObjectURL(activeStemUrl);activeStemUrl=''}setStatus(`🎤 Voix originale · ${t.artist} — ${t.title}`);return}
      setStatus(`🎶 Préparation Voix OFF · ${t.artist} — ${t.title}…`);const blob=await getOrPrepare(t,{generate:true,persistDrive:true});if(!blob)throw new Error('Instrumental indisponible.');
      if(activeStemUrl)URL.revokeObjectURL(activeStemUrl);activeStemUrl=URL.createObjectURL(blob);await swapAudio(activeStemUrl);voiceOff=true;setStatus(`🎶 Voix OFF · ${t.artist} — ${t.title}`);countReady();
    }catch(e){console.error(e);if(e?.code==='drive-auth'||e?.status===401){showDriveAuthorize(true);setStatus('🔐 Réautorise Google Drive puis réessaie.')}else setStatus('Voix OFF impossible : '+(e?.message||e))}
    finally{refreshVoiceButtons()}
  }

  function ensureButtons(){
    const play=$('play');if(play&&!$('kwVoiceToggle')){const b=document.createElement('button');b.id='kwVoiceToggle';b.type='button';b.className='secondary';b.onclick=toggleVoice;play.parentElement?.appendChild(b)}
    const stage=$('stagePlay');if(stage&&!$('kwVoiceToggleStage')){const b=document.createElement('button');b.id='kwVoiceToggleStage';b.type='button';b.className='secondary';b.onclick=toggleVoice;stage.parentElement?.appendChild(b)}refreshVoiceButtons();
  }
  function ensurePanel(){
    let box=$('kwVocalPanel');if(box)return box;const host=$('ultrastarPanel');if(!host)return null;box=document.createElement('div');box.id='kwVocalPanel';box.style.cssText='margin-top:12px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>🎤 Voix ON/OFF · préparation IA</b><span id="kwVocalBadge" class="status">Analyse…</span></div><p class="muted" style="margin:7px 0">Prépare toute la bibliothèque avec <b>${MODEL}</b>. Le calcul IA continue même si l’autorisation Google Drive expire ; les instrumentaux sont alors conservés localement puis synchronisés après réautorisation.</p><div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden"><i id="kwVocalBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#ec4899,#8b5cf6,#38bdf8);transition:width .2s ease"></i></div><div id="kwVocalStatus" class="muted" style="margin-top:7px">Prêt. Chaque instrumental terminé est gardé dans le navigateur et sauvegardé sur Google Drive quand l’autorisation est disponible.</div><div class="controls wrap" style="justify-content:flex-start;margin-top:8px"><button id="kwVocalPrepareAll" type="button">🎶 Préparer toutes les chansons</button><button id="kwVocalStop" class="danger hidden" type="button">⏹ Arrêter après cette chanson</button><button id="kwVocalResume" class="secondary hidden" type="button">▶ Reprendre</button><button id="kwVocalAuthorize" class="secondary hidden" type="button">🔐 Réautoriser Drive</button></div><div class="muted" style="font-size:11px;margin-top:6px">ℹ️ Une expiration Drive ne coupe plus la préparation IA. Les instrumentaux calculés restent en cache et sont envoyés plus tard sans être recalculés.</div>`;
    const ref=$('cloudUltraStarBox');if(ref)ref.insertAdjacentElement('beforebegin',box);else host.appendChild(box);
    $('kwVocalPrepareAll').onclick=startBatch;$('kwVocalStop').onclick=()=>{batch.stopRequested=true;setStatus('⏹ Arrêt demandé : fin de la chanson en cours puis pause.')};$('kwVocalResume').onclick=startBatch;$('kwVocalAuthorize').onclick=()=>$('cloudDriveAuthorize')?.click();
    const cp=readCheckpoint();if(cp?.active){$('kwVocalResume').classList.remove('hidden');setStatus(`⚠️ Préparation interrompue · ${cp.done||0}/${cp.total||'?'} terminées. Clique sur Reprendre.`)}return box;
  }
  function refreshBatchButtons(){const start=$('kwVocalPrepareAll'),stop=$('kwVocalStop'),resume=$('kwVocalResume');if(start)start.disabled=batch.running;if(stop)stop.classList.toggle('hidden',!batch.running);if(resume)resume.classList.toggle('hidden',batch.running||!readCheckpoint()?.active)}
  async function requestPersistence(){try{await navigator.storage?.persist?.()}catch(e){}}

  async function startBatch(){
    if(batch.running)return;ensurePanel();await requestPersistence();const list=tracksNow().filter(eligible);if(!list.length){setStatus('Aucune chanson UltraStar chargée. Connecte d’abord ton dossier.');return}
    if(!driveToken()&&list.some(t=>manifestOf(t)?.driveFolderId&&!driveReady(t))){showDriveAuthorize(true);setStatus('ℹ️ Google Drive n’est pas autorisé pour le moment : la préparation IA va quand même continuer localement. Tu pourras réautoriser Drive ensuite.');await sleep(900)}
    batch={running:true,stopRequested:false,total:list.length,done:0,current:null};saveCheckpoint({total:list.length,done:0,current:''});refreshBatchButtons();setProgress(0);
    try{
      setStatus(`Analyse de ${list.length} chansons…`);for(const t of list)if(await batchReady(t))batch.done++;setBadge(`${batch.done}/${batch.total} prêtes`);saveCheckpoint({total:batch.total,done:batch.done,current:''});
      if(batch.done>=batch.total){clearCheckpoint();setProgress(100);const pending=await countPendingDrive();setStatus(pending?`✅ Les ${batch.total} chansons sont prêtes localement · ${pending} en attente de synchronisation Google Drive.`:`✅ Les ${batch.total} chansons sont déjà prêtes pour Voix ON/OFF.`);if(pending)showDriveAuthorize(true);return}
      await ensureSeparator();
      for(const t of list){
        if(batch.stopRequested)break;if(await batchReady(t))continue;batch.current=t;processingTrack=t;saveCheckpoint({total:batch.total,done:batch.done,current:`${t.artist} — ${t.title}`});setStatus(`🎤 ${t.artist} — ${t.title} · préparation…`);
        try{
          const blob=await getOrPrepare(t,{generate:true,persistDrive:true});if(!blob)throw new Error('Instrumental non généré.');
          batch.done++;setBadge(`${batch.done}/${batch.total} prêtes`);setProgress(batch.done/batch.total*100);saveCheckpoint({total:batch.total,done:batch.done,current:''});
          if(!driveToken()&&manifestOf(t)?.driveFolderId&&!driveReady(t))showDriveAuthorize(true);
        }catch(e){
          console.error('KaraokeWorld préparation vocale',e);
          if((e?.code==='drive-auth'||e?.status===401)&&!(t?.blob instanceof Blob)&&!t?.url){showDriveAuthorize(true);setStatus(`🔐 ${t.artist} — ${t.title} dépend de Google Drive pour lire l’audio source. Cette chanson attendra la réautorisation, les chansons locales continuent.`);await sleep(700);continue}
          setStatus(`⚠️ ${t.artist} — ${t.title} : ${e?.message||e}. Passage à la suivante…`);await sleep(700)
        }finally{batch.current=null;processingTrack=null}
      }
      if(!batch.stopRequested){
        clearCheckpoint();setProgress(100);const pending=await countPendingDrive();
        if(pending){showDriveAuthorize(true);setStatus(`✅ Préparation IA terminée · ${batch.done}/${batch.total} prêtes localement · ☁ ${pending} instrumental${pending>1?'aux':''} à synchroniser après réautorisation Drive.`)}
        else setStatus(`✅ Préparation terminée · ${batch.done}/${batch.total} chansons prêtes. Voix ON/OFF est maintenant instantané.`)
      }else setStatus(`⏸ Préparation arrêtée · ${batch.done}/${batch.total} terminées. Clique sur Reprendre quand tu veux.`)
    }catch(e){console.error(e);setStatus('Préparation interrompue : '+(e?.message||e))}
    finally{batch.running=false;batch.current=null;processingTrack=null;refreshBatchButtons();countReady();refreshVoiceButtons()}
  }

  function watchTrack(){let id=null;try{id=currentId}catch(e){}if(id!==lastCurrentId){lastCurrentId=id;voiceOff=false;if(activeStemUrl){try{URL.revokeObjectURL(activeStemUrl)}catch(e){}activeStemUrl=''}refreshVoiceButtons()}}
  function markVersion(){const s=document.querySelector('.brand small');if(s&&s.textContent!==' BETA · v0.27.9 · Drive résilient ☁️')s.textContent=' BETA · v0.27.9 · Drive résilient ☁️'}
  function boot(){ensureButtons();ensurePanel();markVersion();[300,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{ensureButtons();ensurePanel();markVersion();countReady()},ms));setInterval(()=>{ensureButtons();ensurePanel();watchTrack();markVersion()},1500);setInterval(()=>countReady(),15000)}

  window.addEventListener('beforeunload',e=>{if(batch.running){e.preventDefault();e.returnValue=''}});
  window.addEventListener('kw-drive-token',()=>{showDriveAuthorize(false);countReady();setTimeout(()=>syncPendingDrive({quiet:false}),300)});
  window.KaraokeWorldVocalSeparation={version:VERSION,installed:true,model:MODEL,startAll:startBatch,toggle:toggleVoice,countPrepared:countReady,syncPendingDrive,countPendingDrive,stemCacheName:STEM_CACHE,modelCacheName:MODEL_CACHE};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
