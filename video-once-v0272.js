/* KaraokeWorld v0.27.3 — conversion vidéo une seule fois + réutilisation cache/Drive */
(()=>{
  const VERSION='0.27.3';
  const CACHE='karaokeworld-converted-video-v1';
  const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const key=f=>[f?.name||'video',f?.size||0,f?.lastModified||0].join('|');
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
  function ensureNotice(){
    const panel=$('ultraStarPreconvert');if(!panel)return false;
    let n=$('ultraStarConversionOnce');if(n)return true;
    n=document.createElement('div');n.id='ultraStarConversionOnce';n.className='muted';
    n.style.cssText='font-size:11px;margin-top:6px';
    n.textContent='✅ Conversion unique active : une vidéo déjà préparée est réutilisée automatiquement. Le cache de conversion est conservé pendant les mises à jour de KaraokeWorld.';
    panel.appendChild(n);return true;
  }
  async function prepareFilesForDrive(files){
    const out=[],seen=new Map();let reused=0;
    for(const f of [...files]){
      if(VIDEO_RX.test(f.name)){
        const pf=await getPreparedFile(f);
        if(pf){out.push(pf);seen.set(key(f),true);reused++;continue}
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
  function markVersion(){const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.27.3 · Google Drive ☁️'}
  async function start(){
    for(let i=0;i<80;i++){
      attachApi();patchDriveInput();ensureNotice();markVersion();
      if(i%5===0)reuseForTracks();
      if(attachApi()&&patchDriveInput()&&ensureNotice()&&i>10)break;
      await sleep(250);
    }
    reuseForTracks();
    setInterval(()=>{attachApi();patchDriveInput();ensureNotice();reuseForTracks();markVersion()},5000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.KaraokeWorldVideoOnce={version:VERSION,getPreparedBlob,getPreparedFile,reuseForTracks};
})();
