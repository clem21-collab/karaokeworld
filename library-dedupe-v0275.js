/* KaraokeWorld v0.27.5 — dédoublonnage local + Google Drive au rendu */
(()=>{
  if(window.KaraokeWorldLibraryDedupe?.installed)return;
  const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const songKey=t=>norm(`${t?.artist||''}|${t?.title||''}`);
  let patched=false;

  function prune(){
    try{
      if(typeof tracks==='undefined'||!Array.isArray(tracks)||!tracks.length)return false;
      const locals=new Map();
      for(const t of tracks){
        if(t?.cloudUltraStar)continue;
        const k=songKey(t);if(k&&!locals.has(k))locals.set(k,t);
      }
      const seenCloud=new Set(),next=[];let removed=0;
      for(const t of tracks){
        const k=songKey(t);
        if(t?.cloudUltraStar&&k){
          const local=locals.get(k);
          if(local){
            local.cloudBackup=true;
            local.cloudBackupDocId=t.cloudDocId||local.cloudBackupDocId;
            local.cloudBackupManifest=t.cloudManifest||local.cloudBackupManifest;
            removed++;continue;
          }
          if(seenCloud.has(k)){removed++;continue}
          seenCloud.add(k);
        }
        next.push(t);
      }
      if(removed){
        tracks.splice(0,tracks.length,...next);
        console.info(`KaraokeWorld : ${removed} doublon${removed>1?'s':''} Drive masqué${removed>1?'s':''}.`);
        return true;
      }
      return false;
    }catch(e){console.warn('KaraokeWorld dédoublonnage renforcé',e);return false}
  }

  function patch(){
    if(patched)return true;
    try{
      if(typeof drawTracks!=='function')return false;
      if(drawTracks._kwDedupeV0275){patched=true;return true}
      const original=drawTracks;
      const wrapped=function(){prune();return original.apply(this,arguments)};
      wrapped._kwDedupeV0275=true;
      drawTracks=wrapped;
      patched=true;
      prune();
      drawTracks();
      return true;
    }catch(e){console.warn('KaraokeWorld patch drawTracks',e);return false}
  }

  function sweep(){
    patch();
    try{
      const changed=prune();
      if(changed&&typeof drawTracks==='function')drawTracks();
    }catch(e){}
  }

  window.KaraokeWorldLibraryDedupe={version:'0.27.5',installed:true,prune,sweep};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(sweep,0),{once:true});else setTimeout(sweep,0);
  [250,600,1200,2000,3500,6000].forEach(ms=>setTimeout(sweep,ms));
  setInterval(sweep,1200);
})();
