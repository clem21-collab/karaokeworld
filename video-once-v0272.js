/* KaraokeWorld v0.27.4 — conversion vidéo une seule fois + réutilisation cache/Drive + dédoublonnage bibliothèque */
(()=>{
  const VERSION='0.27.4';
  const CACHE='karaokeworld-converted-video-v1';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const key=f=>[f?.name||'video',f?.size||0,f?.lastModified||0].join('|');
  const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const songKey=t=>norm(`${t?.artist||''}|${t?.title||''}`);
  function cacheUrl(f){let h=2166136261,s=key(f);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return new URL(`./__kw_video_cache__/v1-${(h>>>0).toString(16)}.mp4`,location.href).href}
  async function getPreparedBlob(f){
    if(!f)return null;
    try{const hit=await(await caches.open(CACHE)).match(cacheUrl(f));return hit?await hit.blob():null}catch(e){return null}
  }
  async function getPreparedFile(f){
    const blob=await getPreparedBlob(f);if(!blob)return null;
    const out=new File([blob],f.name,{type:'video/mp4',lastModified:f.lastModified||Date.now()});
    try{Object.defineProperty(out,'webkitRelativePath',{value:f.webkitRelativePath||f.name,configurable:true})}catch(e){}
    return out;
  }
  function attachApi(){
    const api=window.KaraokeWorldVideoPreconvert;if(!api)return false;
    api.getPreparedBlob=getPreparedBlob;
    api.getPreparedFile=getPreparedFile;
    api.conversionIsPersistent=true;
    api.version=VERSION;
    return true;
  }
  async function reuseForTracks(){
    try{
      if(typeof tracks==='undefined'||!Array.isArray(tracks))return;
      for(const t of tracks){
        if(t?.kind!=='ultrastar'||!t.videoBlob||t._kwPreparedChecked)continue;
        t._kwPreparedChecked=true;
        const blob=await getPreparedBlob(t.videoBlob);
        if(blob){t.compatVideoBlob=blob;t._kwPreparedFromCache=true}
      }
    }catch(e){console.warn('KaraokeWorld conversion unique: réutilisation cache',e)}
  }
  function reconcileCloudDuplicates(){
    try{
      if(typeof tracks==='undefined'||!Array.isArray(tracks)||!tracks.length)return false;
      const locals=new Map();
      for(const t of tracks){
        if(t?.cloudUltraStar)continue;
        const k=songKey(t);if(k&&!locals.has(k))locals.set(k,t);
      }
      let changed=false;
      const next=[];
      for(const t of tracks){
        if(t?.cloudUltraStar){
          const local=locals.get(songKey(t));
          if(local){
            local.cloudBackup=true;
            local.cloudBackupDocId=t.cloudDocId||local.cloudBackupDocId;
            local.cloudBackupManifest=t.cloudManifest||local.cloudBackupManifest;
            changed=true;
            continue;
          }
        }
        next.push(t);
      }
      if(changed){
        tracks=next;
        try{drawTracks()}catch(e){}
        try{drawPlaylists()}catch(e){}
        console.info('KaraokeWorld: doublons local + Google Drive masqués dans la bibliothèque.');
      }
      return changed;
    }catch(e){console.warn('KaraokeWorld dédoublonnage bibliothèque',e);return false}
  }
  function ensureNotice(){
    const panel=$('ultraStarPreconvert');if(!panel)return false;
    let n=$('ultraStarConversionOnce');if(n)return true;
    n=document.createElement('div');n.id='ultraStarConversionOnce';n.className='muted';
    n.style.cssText='font-size:11px;margin-top:6px';
    n.textContent='✅ Conversion unique active : une vidéo déjà préparée est réutilisée automatiquement. Le cache de conversion est conservé pendant les mises à jour de KaraokeWorld.';
    panel.appendChild(n);return true;
  }
  async function prepareFilesForDrive(files){
    const out=[];let reused=0;
    for(const f of [...files]){
      if(VIDEO_RX.test(f.name)){
        const pf=await getPreparedFile(f);
        if(pf){out.push(pf);reused++;continue}
      }
      out.push(f);
    }
    return {files:out,reused};
  }
  function patchDriveInput(){
    const input=$('cloudUltraStarInput');if(!input||input.dataset.kwVideoOnce==='1'||typeof input.onchange!=='function')return false;
    const original=input.onchange;input.dataset.kwVideoOnce='1';
    input.onchange=async e=>{
      const raw=e?.target?.files;if(!raw?.length)return original.call(input,e);
      const status=$('cloudUltraStarStatus');
      try{
        const prepared=await prepareFilesForDrive(raw);
        if(prepared.reused&&status)status.textContent=`🎬 ${prepared.reused} vidéo${prepared.reused>1?'s':''} déjà convertie${prepared.reused>1?'s':''} réutilisée${prepared.reused>1?'s':''} pour Google Drive. Démarrage de l’envoi…`;
        return original.call(input,{target:{files:prepared.files}});
      }catch(err){console.warn('KaraokeWorld Drive: versions converties non injectées',err);return original.call(input,e)}
    };
    return true;
  }
  function driveToken(){try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return ''}}
  async function migrateLegacySongFolders(){
    const token=driveToken();if(!token)return 0;
    try{
      const q="trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='kwType' and value='song' }";
      let pageToken='',changed=0;
      do{
        const params=new URLSearchParams({spaces:'drive',pageSize:'1000',fields:'nextPageToken,files(id,appProperties)',q});if(pageToken)params.set('pageToken',pageToken);
        const r=await fetch('https://www.googleapis.com/drive/v3/files?'+params.toString(),{headers:{Authorization:'Bearer '+token}});if(!r.ok)return changed;
        const data=await r.json();
        for(const f of data.files||[]){
          const ap=f.appProperties||{};if(!ap.kwSongId||ap.kwApp==='KaraokeWorld')continue;
          const p=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?fields=id`,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({appProperties:{...ap,kwApp:'KaraokeWorld'}})});
          if(p.ok)changed++;
        }
        pageToken=data.nextPageToken||'';
      }while(pageToken);
      if(changed)console.info(`KaraokeWorld: ${changed} ancien${changed>1?'s':''} dossier${changed>1?'s':''} Drive migré${changed>1?'s':''}.`);
      return changed;
    }catch(e){console.warn('KaraokeWorld migration anciens dossiers Drive',e);return 0}
  }
  function markVersion(){const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.27.4 · Google Drive ☁️'}
  async function start(){
    for(let i=0;i<80;i++){
      attachApi();patchDriveInput();ensureNotice();markVersion();reconcileCloudDuplicates();
      if(i%5===0)reuseForTracks();
      if(attachApi()&&patchDriveInput()&&ensureNotice()&&i>10)break;
      await sleep(250);
    }
    reuseForTracks();reconcileCloudDuplicates();migrateLegacySongFolders();
    window.addEventListener('kw-drive-token',()=>setTimeout(()=>{migrateLegacySongFolders();reconcileCloudDuplicates()},300));
    setInterval(()=>{attachApi();patchDriveInput();ensureNotice();reuseForTracks();reconcileCloudDuplicates();markVersion()},2500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.KaraokeWorldVideoOnce={version:VERSION,getPreparedBlob,getPreparedFile,reuseForTracks,migrateLegacySongFolders,reconcileCloudDuplicates};
})();
