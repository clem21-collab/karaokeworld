/* KaraokeWorld v0.27.3 — bibliothèque UltraStar privée sur Google Drive + envoi parallèle */
(()=>{
const VERSION='0.27.3';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY='kw_drive_access_token_v1';
const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
const UPLOAD_CONCURRENCY_KEY='kw_drive_upload_concurrency_v1';
const AUDIO_RX=/\.(mp3|ogg|m4a|wav|aac|flac|opus)$/i;
const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
const COVER_RX=/\.(jpg|jpeg|png|webp)$/i;
let sdk=null,fs=null,auth=null,loading=false,authBusy=false,driveFolders=null;
const $id=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'titre';
function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shortHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function fmtBytes(n){n=Number(n||0);if(n<1024)return `${Math.round(n)} o`;if(n<1024*1024)return `${(n/1024).toFixed(1)} Ko`;if(n<1024*1024*1024)return `${(n/1024/1024).toFixed(1)} Mo`;return `${(n/1024/1024/1024).toFixed(2)} Go`}
function roleName(role){return role==='txt'?'Paroles':role==='audio'?'Audio':role==='video'?'Vidéo':role==='cover'?'Jaquette':role}
function status(text,kind=''){const el=$id('cloudUltraStarStatus');if(el){el.textContent=text;el.dataset.kind=kind}}
function progress(pct,text){const bar=$id('cloudUltraStarBar');if(bar)bar.style.width=Math.max(0,Math.min(100,pct||0))+'%';if(text)status(text)}
function user(){try{return cloudUser||auth?.currentUser||null}catch(e){return auth?.currentUser||null}}
function uploadConcurrency(){const n=parseInt(localStorage.getItem(UPLOAD_CONCURRENCY_KEY)||'4',10);return Math.max(1,Math.min(4,Number.isFinite(n)?n:4))}
function setUploadConcurrency(n){localStorage.setItem(UPLOAD_CONCURRENCY_KEY,String(Math.max(1,Math.min(4,parseInt(n,10)||4))))}
function getDriveToken(){try{const t=sessionStorage.getItem(TOKEN_KEY)||'';const exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return ''}}
function saveDriveToken(token){try{sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem(TOKEN_EXP_KEY,String(Date.now()+50*60*1000))}catch(e){}driveFolders=null;updateDriveAuthUI()}
function clearDriveToken(){try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_EXP_KEY)}catch(e){}driveFolders=null;updateDriveAuthUI()}
function setBusy(on){
  const up=$id('cloudUltraStarUpload'),reload=$id('cloudUltraStarReload'),authBtn=$id('cloudDriveAuthorize'),sel=$id('cloudUploadConcurrency');
  if(up){up.disabled=!!on||!user()||!getDriveToken();up.textContent=on?'☁ Envoi parallèle vers Drive…':'☁ Envoyer un dossier sur Drive'}
  if(reload)reload.disabled=!!on||!user();
  if(authBtn)authBtn.disabled=!!on||authBusy||!user();
  if(sel)sel.disabled=!!on;
}
function updateDriveAuthUI(){
  const btn=$id('cloudDriveAuthorize'),up=$id('cloudUltraStarUpload'),sel=$id('cloudUploadConcurrency');
  const ok=!!getDriveToken(),u=user();
  if(btn){btn.textContent=ok?'✅ Google Drive autorisé':'🔐 Autoriser Google Drive';btn.disabled=authBusy||loading||!u}
  if(up)up.disabled=loading||!u||!ok;
  if(sel)sel.value=String(uploadConcurrency());
}
function ensureUI(){
  if($id('cloudUltraStarBox')){updateDriveAuthUI();return}
  const panel=$id('ultrastarPanel');if(!panel)return;
  const box=document.createElement('div');box.id='cloudUltraStarBox';
  box.style.cssText='margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#08182a';
  box.innerHTML=`<div class="row-head"><div><div class="eyebrow">GOOGLE DRIVE · CLOUD PRIVÉ</div><h3 style="margin:2px 0">☁ Ma bibliothèque UltraStar sur Google Drive</h3></div><span id="cloudUltraStarBadge" class="status">Hors ligne</span></div>
  <p class="muted">Les fichiers UltraStar sont stockés dans ton Google Drive/Google One, dans le dossier <b>KaraokeWorld/UltraStar</b>. Firebase conserve seulement le catalogue, les favoris et les playlists.</p>
  <div class="controls wrap"><button id="cloudDriveAuthorize" class="secondary" type="button">🔐 Autoriser Google Drive</button><button id="cloudUltraStarUpload" type="button" disabled>☁ Envoyer un dossier sur Drive</button><button id="cloudUltraStarReload" class="secondary" type="button">🔄 Charger ma bibliothèque Drive</button><input id="cloudUltraStarInput" type="file" webkitdirectory multiple hidden></div>
  <div class="controls wrap" style="justify-content:flex-start;margin-top:8px"><label for="cloudUploadConcurrency" class="muted">Envois simultanés</label><select id="cloudUploadConcurrency" aria-label="Nombre de chansons envoyées simultanément"><option value="1">1 · Stable</option><option value="2">2 · Modéré</option><option value="3">3 · Rapide</option><option value="4">4 · Maximum</option></select><span id="cloudUploadConcurrencyHint" class="status">4 chansons à la fois</span></div>
  <div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden;margin-top:9px"><i id="cloudUltraStarBar" style="display:block;width:0;height:100%;background:linear-gradient(90deg,#8b5cf6,#38bdf8);transition:width .2s ease"></i></div>
  <p id="cloudUltraStarStatus" class="muted" style="margin:7px 0 0">Connecte-toi avec Google puis autorise Google Drive.</p>
  <div id="cloudUltraStarList" style="display:grid;gap:6px;margin-top:8px"></div>`;
  panel.appendChild(box);
  const input=$id('cloudUltraStarInput'),sel=$id('cloudUploadConcurrency'),hint=$id('cloudUploadConcurrencyHint');
  $id('cloudDriveAuthorize').onclick=authorizeDrive;
  $id('cloudUltraStarUpload').onclick=()=>{if(!user()){status('Connecte-toi d’abord avec Google dans ⚙ Paramètres.');return}if(!getDriveToken()){status('Autorise d’abord Google Drive avec le bouton 🔐.');return}input.click()};
  $id('cloudUltraStarReload').onclick=()=>loadCatalog(true);
  input.onchange=e=>uploadFolder(e.target.files);
  if(sel){sel.value=String(uploadConcurrency());sel.onchange=()=>{setUploadConcurrency(sel.value);sel.value=String(uploadConcurrency());if(hint)hint.textContent=`${uploadConcurrency()} chanson${uploadConcurrency()>1?'s':''} à la fois`}}
  if(hint)hint.textContent=`${uploadConcurrency()} chanson${uploadConcurrency()>1?'s':''} à la fois`;
  updateDriveAuthUI();
}
async function waitForCloud(){
  ensureUI();
  for(let i=0;i<80;i++){
    try{if(typeof cloudApi!=='undefined'&&cloudApi?.auth&&cloudApi?.fs){auth=cloudApi.auth;fs=cloudApi.fs;break}}catch(e){}
    await sleep(100);
  }
  if(!auth||!fs)throw new Error('Connexion Firebase non initialisée');
  if(!sdk){
    const [fire,au]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
    ]);
    sdk={...fire,...au};
    au.onAuthStateChanged(auth,u=>{
      const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=u?'Connecté':'Hors ligne';
      updateDriveAuthUI();
      if(u)loadCatalog(false);else{clearDriveToken();clearCloudTracks()}
    });
  }
  return true;
}
async function authorizeDrive(){
  if(authBusy)return;authBusy=true;updateDriveAuthUI();
  try{
    await waitForCloud();const u=user();if(!u)throw new Error('Connecte-toi d’abord avec Google dans ⚙ Paramètres.');
    status('Autorisation Google Drive…');
    const provider=new sdk.GoogleAuthProvider();provider.addScope(DRIVE_SCOPE);
    const result=await sdk.signInWithPopup(auth,provider,sdk.browserPopupRedirectResolver);
    const credential=sdk.GoogleAuthProvider.credentialFromResult(result);
    if(!credential?.accessToken)throw new Error('Google n’a pas fourni de jeton Drive. Réessaie la connexion.');
    saveDriveToken(credential.accessToken);
    status('✅ Google Drive autorisé pour KaraokeWorld.');
    await ensureDriveFolders();
    await loadCatalog(false);
  }catch(e){console.error('KaraokeWorld Drive Auth',e);const code=String(e?.code||'');if(code.includes('popup-blocked'))status('Le popup Google a été bloqué. Autorise les fenêtres pop-up pour KaraokeWorld puis réessaie.','error');else status('Autorisation Drive impossible : '+(e?.message||e),'error')}
  finally{authBusy=false;updateDriveAuthUI()}
}
function explainDriveError(e){
  const msg=String(e?.message||e||'Erreur Google Drive'),reason=String(e?.reason||'');
  if(e?.status===401||/invalid credentials|login required/i.test(msg)){clearDriveToken();return 'Session Google Drive expirée. Clique sur « Autoriser Google Drive » puis réessaie.'}
  if(e?.status===403&&(/has not been used|accessnotconfigured|api.*disabled|disabled/i.test(msg)||/accessNotConfigured/i.test(reason)))return 'L’API Google Drive n’est pas activée pour le projet Google Cloud de KaraokeWorld. Active « Google Drive API » dans Google Cloud → API et services → Bibliothèque.';
  if(/storageQuotaExceeded|quota.*storage|storage quota/i.test(reason+' '+msg))return 'Ton espace Google Drive/Google One est insuffisant pour ce fichier.';
  if(e?.status===403)return 'Google Drive refuse cette opération : '+msg;
  return msg;
}
async function driveFetch(url,options={}){
  const token=getDriveToken();if(!token)throw Object.assign(new Error('Google Drive non autorisé.'),{status:401});
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
  const res=await fetch(url,{...options,headers});
  if(!res.ok){let data=null,text='';try{data=await res.clone().json()}catch(err){try{text=await res.text()}catch(e){}}const er=data?.error;const msg=er?.message||text||`Erreur Google Drive ${res.status}`;const reason=er?.errors?.[0]?.reason||er?.status||'';const e=Object.assign(new Error(msg),{status:res.status,reason});if(res.status===401)clearDriveToken();throw e}
  return res;
}
function q(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
async function listDriveFiles(query){
  const all=[];let pageToken='';
  do{
    const params=new URLSearchParams({spaces:'drive',pageSize:'1000',fields:'nextPageToken,files(id,name,mimeType,size,parents,appProperties)',q:query});
    if(pageToken)params.set('pageToken',pageToken);
    const r=await driveFetch('https://www.googleapis.com/drive/v3/files?'+params.toString());const data=await r.json();all.push(...(data.files||[]));pageToken=data.nextPageToken||'';
  }while(pageToken);
  return all;
}
async function createDriveFolder(name,parentId,appProperties={}){
  const body={name,mimeType:'application/vnd.google-apps.folder',appProperties};if(parentId)body.parents=[parentId];
  const r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,appProperties',{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(body)});return r.json();
}
async function ensureDriveFolders(){
  if(driveFolders&&getDriveToken())return driveFolders;
  let roots=await listDriveFiles(`trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='kwRoot' and value='1' }`);
  let root=roots[0]||await createDriveFolder('KaraokeWorld',null,{kwRoot:'1',kwApp:'KaraokeWorld'});
  let us=await listDriveFiles(`trashed=false and '${q(root.id)}' in parents and mimeType='application/vnd.google-apps.folder' and appProperties has { key='kwUltraStar' and value='1' }`);
  let ultra=us[0]||await createDriveFolder('UltraStar',root.id,{kwUltraStar:'1',kwApp:'KaraokeWorld'});
  driveFolders={rootId:root.id,ultraStarId:ultra.id};return driveFolders;
}
function relDir(f){const p=String(f.webkitRelativePath||f.name).replace(/\\/g,'/');return p.split('/').slice(0,-1).join('/')}
function findSame(files,dir,name,rx){const exact=name&&files.find(f=>relDir(f)===dir&&f.name.toLowerCase()===name.toLowerCase());return exact||files.find(f=>relDir(f)===dir&&rx.test(f.name))}
async function buildSongs(fileList){
  const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(f.name)),songs=[];
  for(const tf of txts){
    try{
      const parsed=parseUltraStar(usDecode(await tf.arrayBuffer()));const dir=relDir(tf),meta=parsed.meta||{};
      const mp3=String(meta.MP3||'').replace(/\\/g,'/').split('/').pop(),vid=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop(),cov=String(meta.COVER||'').replace(/\\/g,'/').split('/').pop();
      const audio=findSame(files,dir,mp3,AUDIO_RX);if(!audio)continue;const video=findSame(files,dir,vid,VIDEO_RX),cover=findSame(files,dir,cov,COVER_RX);
      const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu',songId=safe(artist)+'--'+safe(title)+'--'+shortHash(dir+'|'+artist+'|'+title);
      songs.push({songId,title,artist,genre:meta.GENRE||'Sans genre',dir,tf,audio,video,cover,parsed});
    }catch(e){console.warn('UltraStar Drive: TXT ignoré',tf.name,e)}
  }
  return songs;
}
async function createSongFolder(s,parentId){
  const name=(s.artist+' - '+s.title).replace(/[\r\n]+/g,' ').slice(0,180);return createDriveFolder(name,parentId,{kwSongId:s.songId,kwType:'song',kwApp:'KaraokeWorld'});
}
function putResumable(location,file,onPct){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('PUT',location,true);const token=getDriveToken();if(token)xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onPct?.(e.loaded,e.total)};
    xhr.onerror=()=>reject(new Error('Connexion interrompue pendant l’envoi vers Google Drive.'));
    xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){try{resolve(JSON.parse(xhr.responseText||'{}'))}catch(e){resolve({})}}else reject(Object.assign(new Error(`Google Drive ${xhr.status} : ${xhr.responseText||'échec de l’envoi'}`),{status:xhr.status}))};
    xhr.send(file);
  });
}
async function uploadDriveAsset(folderId,songId,role,file,onPct,existing=null){
  if(existing&&role!=='txt'&&role!=='cover'&&existing.name===file.name&&Number(existing.size||0)===Number(file.size||0))return {id:existing.id,name:existing.name,size:existing.size,skipped:true,appProperties:existing.appProperties};
  const metadata={name:file.name,appProperties:{kwSongId:songId,kwRole:role,kwApp:'KaraokeWorld'}};if(!existing)metadata.parents=[folderId];
  const base=existing?`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=resumable&fields=id,name,size,appProperties`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,appProperties';
  const start=await driveFetch(base,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':file.type||'application/octet-stream','X-Upload-Content-Length':String(file.size||0)},body:JSON.stringify(metadata)});
  const location=start.headers.get('Location');if(!location)throw new Error('Google Drive n’a pas créé la session d’envoi.');
  const result=await putResumable(location,file,onPct);return {id:result.id||existing?.id,name:result.name||file.name,size:result.size||file.size,skipped:false,appProperties:result.appProperties||metadata.appProperties};
}
async function uploadFolder(fileList){
  if(loading)return;loading=true;setBusy(true);
  try{
    await waitForCloud();const u=user();if(!u)throw new Error('Connecte-toi avec Google avant l’envoi.');if(!getDriveToken())throw new Error('Autorise Google Drive avant l’envoi.');
    const songs=await buildSongs(fileList);if(!songs.length)throw new Error('Aucune chanson UltraStar complète trouvée dans ce dossier.');
    const allAssets=songs.flatMap(s=>[s.tf,s.audio,s.video,s.cover].filter(Boolean)),totalBytes=allAssets.reduce((n,f)=>n+(f.size||0),0)||1;
    const badge=$id('cloudUltraStarBadge'),folders=await ensureDriveFolders(),workersCount=Math.min(uploadConcurrency(),songs.length);
    progress(0,`Préparation de ${songs.length} chanson${songs.length>1?'s':''} · ${fmtBytes(totalBytes)} · inventaire Drive…`);

    const inventory=await listDriveFiles(`trashed=false and appProperties has { key='kwApp' and value='KaraokeWorld' }`);
    const folderMap=new Map(),assetMap=new Map();
    for(const f of inventory){
      const ap=f.appProperties||{};
      if(f.mimeType==='application/vnd.google-apps.folder'&&ap.kwType==='song'&&ap.kwSongId&&(!f.parents||f.parents.includes(folders.ultraStarId)))folderMap.set(ap.kwSongId,f);
      if(ap.kwSongId&&ap.kwRole)assetMap.set(ap.kwSongId+'|'+ap.kwRole,f);
    }

    let settledBytes=0,doneSongs=0,nextIndex=0,fatalError=null;const inflight=new Map();
    const bytesNow=()=>settledBytes+[...inflight.values()].reduce((a,b)=>a+b,0);
    const paintUpload=(i,s,role,sent,fileTotal)=>{
      const k=`${i}|${role}`;inflight.set(k,sent||0);const totalSent=bytesNow(),totalPct=totalSent/totalBytes*100,filePct=fileTotal?sent/fileTotal*100:0;
      progress(totalPct,`☁ Drive · ${workersCount} envois simultanés · Chanson ${i+1}/${songs.length} · ${s.artist} — ${s.title} · ${roleName(role)} ${Math.round(filePct)} % · Total ${totalPct.toFixed(1)} % · ${fmtBytes(totalSent)} / ${fmtBytes(totalBytes)} · ✅ ${doneSongs}/${songs.length}`);
    };
    const processSong=async(i)=>{
      const s=songs[i];let songFolder=folderMap.get(s.songId);
      if(!songFolder){songFolder=await createSongFolder(s,folders.ultraStarId);folderMap.set(s.songId,songFolder)}
      const ids={driveFolderId:songFolder.id};
      const assets=[['txt',s.tf],['audio',s.audio],['video',s.video],['cover',s.cover]].filter(x=>x[1]);
      for(const [role,file] of assets){
        if(fatalError)throw fatalError;
        const k=`${i}|${role}`,mapKey=s.songId+'|'+role,existing=assetMap.get(mapKey)||null;
        const uploaded=await uploadDriveAsset(songFolder.id,s.songId,role,file,(sent,fileTotal)=>paintUpload(i,s,role,sent,fileTotal),existing);
        inflight.delete(k);settledBytes+=file.size||0;assetMap.set(mapKey,{...existing,...uploaded,appProperties:{kwSongId:s.songId,kwRole:role,kwApp:'KaraokeWorld'}});
        ids[role+'FileId']=uploaded.id;ids[role+'Name']=file.name;
        if(uploaded.skipped){const totalSent=bytesNow(),totalPct=totalSent/totalBytes*100;progress(totalPct,`↪ ${roleName(role)} déjà présent · ${s.artist} — ${s.title} · ${workersCount} envois simultanés · Total ${totalPct.toFixed(1)} % · ${fmtBytes(totalSent)} / ${fmtBytes(totalBytes)} · ✅ ${doneSongs}/${songs.length}`)}
      }
      const vg=parseFloat(String(s.parsed.meta?.VIDEOGAP||'0').replace(',','.'));
      const manifest={schema:3,provider:'google-drive',title:s.title,artist:s.artist,genre:s.genre,bpm:s.parsed.bpm,gap:s.parsed.gap,videoGap:Number.isFinite(vg)?vg:0,originalDir:s.dir,...ids,updatedAt:Date.now(),createdAt:Date.now()};
      await sdk.setDoc(sdk.doc(fs,'users',u.uid,'ultrastar',s.songId),manifest,{merge:true});
      doneSongs++;if(badge)badge.textContent=`${doneSongs}/${songs.length} sur Drive`;const totalSent=bytesNow(),totalPct=totalSent/totalBytes*100;
      progress(totalPct,`✅ ${doneSongs}/${songs.length} terminée${doneSongs>1?'s':''} · ${s.artist} — ${s.title} · ${workersCount} envois simultanés · Total ${totalPct.toFixed(1)} % · ${fmtBytes(totalSent)} / ${fmtBytes(totalBytes)}`);
    };
    const worker=async()=>{
      while(!fatalError){const i=nextIndex++;if(i>=songs.length)return;try{await processSong(i)}catch(e){fatalError=e;throw e}}
    };
    progress(0,`🚀 Envoi parallèle lancé · ${workersCount} chanson${workersCount>1?'s':''} à la fois · ${songs.length} au total · ${fmtBytes(totalBytes)}.`);
    const results=await Promise.allSettled(Array.from({length:workersCount},()=>worker()));
    if(fatalError)throw fatalError;
    const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
    progress(100,`✅ ${songs.length} chanson${songs.length>1?'s':''} disponible${songs.length>1?'s':''} sur Google Drive · ${fmtBytes(totalBytes)} traités · envoi parallèle terminé.`);await loadCatalog(true);
  }catch(e){console.error(e);status('Google Drive : '+explainDriveError(e),'error')}
  finally{loading=false;setBusy(false);const input=$id('cloudUltraStarInput');if(input)input.value=''}
}
function clearCloudTracks(){try{tracks=tracks.filter(t=>!t.cloudUltraStar);drawTracks();drawPlaylists()}catch(e){}const list=$id('cloudUltraStarList');if(list)list.innerHTML=''}
async function loadCatalog(show=true){
  try{
    await waitForCloud();const u=user();if(!u){if(show)status('Connecte-toi avec Google pour charger ta bibliothèque Drive.');return}
    if(show)status('Chargement du catalogue Google Drive…');
    const snap=await sdk.getDocs(sdk.collection(fs,'users',u.uid,'ultrastar')),cloud=[];
    snap.forEach(d=>{const m=d.data()||{};if(m.provider!=='google-drive'&&!m.audioFileId)return;cloud.push({id:'cloudus_'+d.id,title:m.title||'Titre UltraStar',artist:m.artist||'Artiste inconnu',genre:m.genre||'Sans genre',emoji:'☁️',kind:'ultrastar-cloud',type:'audio',created:m.updatedAt||m.createdAt||0,lrc:[],cloudUltraStar:true,cloudDocId:d.id,cloudManifest:m})});
    tracks=tracks.filter(t=>!t.cloudUltraStar);tracks.unshift(...cloud);drawTracks();drawPlaylists();renderCloudList(cloud);
    const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=`${cloud.length} sur Drive`;
    if(show||cloud.length)status(cloud.length?`☁ ${cloud.length} chanson${cloud.length>1?'s':''} dans ta bibliothèque Google Drive.${getDriveToken()?'':' Autorise Drive pour les lire.'}`:'Ta bibliothèque Google Drive est vide.');
  }catch(e){console.error(e);if(show)status('Impossible de charger le catalogue : '+(e?.message||e),'error')}
  finally{updateDriveAuthUI()}
}
function renderCloudList(items){
  const box=$id('cloudUltraStarList');if(!box)return;
  box.innerHTML=items.slice(0,12).map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid #1c334d;border-radius:9px"><span>☁️</span><div style="min-width:0;flex:1"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${html(t.title)}</b><span class="muted">${html(t.artist)} · Google Drive</span></div><button class="secondary" type="button" data-cloud-play="${html(t.id)}">▶</button></div>`).join('')+(items.length>12?`<div class="muted">+ ${items.length-12} autre${items.length-12>1?'s':''} dans Drive.</div>`:'');
  box.querySelectorAll('[data-cloud-play]').forEach(b=>b.onclick=()=>playTrack(b.dataset.cloudPlay));
}
async function driveBlob(fileId){const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);return r.blob()}
async function hydrateCloudTrack(t){
  if(t.cloudHydrated)return t;await waitForCloud();if(!getDriveToken())throw new Error('Autorise Google Drive avec le bouton 🔐 avant de lire une chanson cloud.');
  const m=t.cloudManifest||{};if(!m.txtFileId||!m.audioFileId)throw new Error('Fichiers Google Drive incomplets pour ce titre.');
  status(`Téléchargement depuis Drive : ${t.artist} — ${t.title}…`);
  const txtBlob=await driveBlob(m.txtFileId),parsed=parseUltraStar(usDecode(await txtBlob.arrayBuffer())),audioBlob=await driveBlob(m.audioFileId),audioUrl=URL.createObjectURL(audioBlob);
  let videoBlob=null,videoName=m.videoName||'';if(m.videoFileId){try{videoBlob=await driveBlob(m.videoFileId);videoName=m.videoName||parsed.meta?.VIDEO||''}catch(e){console.warn('Vidéo Drive non chargée',e)}}
  let coverUrl='';if(m.coverFileId){try{coverUrl=URL.createObjectURL(await driveBlob(m.coverFileId))}catch(e){}}
  t.kind='ultrastar';t.type='audio';t.url=audioUrl;t.lrc=parsed.lines;t.ultraStar={bpm:parsed.bpm,gap:parsed.gap,groups:parsed.groups,meta:parsed.meta,video:parsed.meta?.VIDEO||videoName,videoGap:Number(m.videoGap||0)};t.videoBlob=videoBlob;t.videoName=videoName;t.coverUrl=coverUrl;t.cloudHydrated=true;
  status(`✅ ${t.artist} — ${t.title} chargé depuis Google Drive.`);return t;
}
let basePlay=null;
function installPlayHook(){
  if(basePlay)return;try{basePlay=playTrack}catch(e){return}
  playTrack=async function(id){
    const t=tracks.find(x=>x.id===id);
    if(t?.kind==='ultrastar-cloud'){
      try{if(!getDriveToken()){status('🔐 Autorise Google Drive avant de lire cette chanson.','error');$id('cloudDriveAuthorize')?.focus();return}const state=$id('state');if(state)state.textContent='☁ Chargement depuis Google Drive…';await hydrateCloudTrack(t);drawTracks();return basePlay(id)}catch(e){console.error(e);status('Lecture Drive impossible : '+explainDriveError(e),'error');const state=$id('state');if(state)state.textContent='Erreur Drive';return}
    }
    return basePlay(id);
  };
}
async function init(){
  ensureUI();installPlayHook();window.addEventListener('kw-drive-token',()=>{driveFolders=null;updateDriveAuthUI();status('✅ Google Drive autorisé pour KaraokeWorld.');loadCatalog(false)});
  try{await waitForCloud();const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=user()?'Connecté':'Hors ligne';if(user())loadCatalog(false)}catch(e){status('Bibliothèque Google Drive prête dès que Firebase est disponible.')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.KaraokeWorldCloudUltraStar={version:VERSION,provider:'google-drive',reload:()=>loadCatalog(true),authorizeDrive,getUploadConcurrency:uploadConcurrency,setUploadConcurrency};
})();
