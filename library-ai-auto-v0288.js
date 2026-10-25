/* KaraokeWorld v0.28.8 — préparation IA automatique après mise à jour de bibliothèque */
(()=>{
  if(window.KaraokeWorldLibraryAiAuto?.installed)return;
  const VERSION='0.28.8';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const STEM_CACHE='karaokeworld-instrumental-v1';
  const AUDIO_RX=/\.(mp3|ogg|m4a|wav|aac|flac|opus)$/i;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const safe=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'titre';
  const shortHash=s=>{let h=2166136261;s=String(s||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
  const hash=s=>{s=String(s||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
  const relDir=f=>{const p=String(f?.webkitRelativePath||f?.name||'').replace(/\\/g,'/');return p.split('/').slice(0,-1).join('/')};
  const token=()=>{try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return''}};
  const status=(text,kind='')=>{const el=$('cloudUltraStarStatus');if(el){el.textContent=text;el.dataset.kind=kind}};

  function findAudio(files,dir,name){
    const exact=name&&files.find(f=>relDir(f)===dir&&String(f.name||'').toLowerCase()===String(name).toLowerCase());
    return exact||files.find(f=>relDir(f)===dir&&AUDIO_RX.test(String(f.name||'')));
  }

  async function localSongs(fileList){
    const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(String(f.name||''))),out=[];
    for(let i=0;i<txts.length;i++){
      const tf=txts[i];
      try{
        const parsed=parseUltraStar(usDecode(await tf.arrayBuffer())),dir=relDir(tf),meta=parsed.meta||{};
        const audioName=String(meta.MP3||'').replace(/\\/g,'/').split('/').pop();
        const audio=findAudio(files,dir,audioName);if(!audio)continue;
        const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu';
        const songId=safe(artist)+'--'+safe(title)+'--'+shortHash(dir+'|'+artist+'|'+title);
        out.push({songId,title,artist,audio});
        if(i%35===0)await sleep(0);
      }catch(e){console.warn('KaraokeWorld IA auto : TXT ignoré',tf?.name,e)}
    }
    return out;
  }

  async function driveAudioInventory(){
    const t=token();if(!t)return new Map();
    const map=new Map();let pageToken='';
    do{
      const params=new URLSearchParams({spaces:'drive',pageSize:'1000',fields:'nextPageToken,files(id,name,size,appProperties)',q:"trashed=false and appProperties has { key='kwApp' and value='KaraokeWorld' }"});
      if(pageToken)params.set('pageToken',pageToken);
      const r=await fetch('https://www.googleapis.com/drive/v3/files?'+params.toString(),{headers:{Authorization:'Bearer '+t}});
      if(!r.ok)throw new Error(`Inventaire Drive impossible (${r.status})`);
      const j=await r.json();
      for(const f of j.files||[]){const ap=f.appProperties||{};if(ap.kwSongId&&ap.kwRole==='audio')map.set(ap.kwSongId,f)}
      pageToken=j.nextPageToken||'';
    }while(pageToken);
    return map;
  }

  async function detectChangedAudio(fileList){
    if(!token())return new Set();
    try{
      const [songs,remote]=await Promise.all([localSongs(fileList),driveAudioInventory()]);
      const changed=new Set();
      for(const s of songs){
        const r=remote.get(s.songId);if(!r)continue;
        if(String(r.name||'')!==String(s.audio.name||'')||Number(r.size||0)!==Number(s.audio.size||0))changed.add(s.songId);
      }
      return changed;
    }catch(e){console.warn('KaraokeWorld IA auto : détection audio modifié indisponible',e);return new Set()}
  }

  async function clearOldInstrumentalCache(track){
    try{
      const m=track?.cloudBackupManifest||track?.cloudManifest||{};
      const id=track?.cloudBackupDocId||track?.cloudDocId||String(track?.id||'').replace(/^cloudus_/,'');
      if(!id||!m.audioFileId)return;
      const source=`drive:${m.audioFileId}`;
      const url=new URL(`./__kw_instrumental_cache__/v1-${hash(id+'|'+source)}.wav`,location.href).href;
      await (await caches.open(STEM_CACHE)).delete(url);
    }catch(e){console.warn('KaraokeWorld IA auto : ancien cache non supprimé',e)}
  }

  async function invalidateChanged(changedIds){
    if(!changedIds?.size)return 0;
    let n=0,list=[];try{list=Array.isArray(tracks)?tracks:[]}catch(e){}
    for(const t of list){
      const id=t?.cloudBackupDocId||t?.cloudDocId||String(t?.id||'').replace(/^cloudus_/,'');
      if(!changedIds.has(id))continue;
      const m=t?.cloudBackupManifest||t?.cloudManifest;if(!m)continue;
      await clearOldInstrumentalCache(t);
      m.instrumentalSourceKey='__kw_audio_changed__'+Date.now();
      n++;
    }
    return n;
  }

  async function autoPrepare(changedIds){
    const ai=window.KaraokeWorldVocalSeparation;
    if(!ai?.countPrepared||!ai?.startAll)return;
    if(changedIds?.size)await invalidateChanged(changedIds);
    const before=await ai.countPrepared();
    const missing=Math.max(0,(before?.total||0)-(before?.ready||0));
    if(!missing){status(`✅ Bibliothèque à jour · ${before.total||0} chanson${before.total>1?'s':''} déjà préparée${before.total>1?'s':''} par l’IA. Aucun recalcul.`);return}
    status(`🤖 Bibliothèque à jour · préparation IA automatique de ${missing} chanson${missing>1?'s':''} seulement…`);
    await ai.startAll();
    const after=await ai.countPrepared();
    const left=Math.max(0,(after?.total||0)-(after?.ready||0));
    if(left)status(`⚠️ Bibliothèque mise à jour · IA : ${after.ready}/${after.total} prêtes · ${left} chanson${left>1?'s':''} reste${left>1?'nt':''} à préparer.`,'error');
    else status(`✅ Bibliothèque mise à jour · IA terminée · ${after.ready}/${after.total} chansons prêtes. Les anciennes préparations n’ont pas été refaites.`);
  }

  function improveCopy(){
    const simple=$('kwLibrarySimpleBox');if(!simple)return;
    const text=simple.querySelector('.muted');
    if(text&&!/IA automatique/i.test(text.textContent||''))text.textContent+=' Préparation IA automatique uniquement pour les chansons nouvelles ou modifiées.';
  }

  function install(){
    const input=$('kwLibraryUpdateInput');if(!input||typeof input.onchange!=='function')return false;
    if(input.dataset.kwAiAuto==='1'){improveCopy();return true}
    input.dataset.kwAiAuto='1';
    const original=input.onchange;
    input.onchange=async function(e){
      const files=[...(e?.target?.files||[])];if(!files.length)return;
      status('🔎 Mise à jour · vérification des changements audio…');
      const changed=await detectChangedAudio(files);
      await original.call(input,e);
      const after=String($('cloudUltraStarStatus')?.textContent||'');
      if(/annulée|annulé|impossible|Aucune chanson UltraStar complète|réautorisé/i.test(after))return;
      try{await window.KaraokeWorldCloudUltraStar?.reload?.()}catch(err){}
      await autoPrepare(changed);
    };
    improveCopy();return true;
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{if(install()||++tries>140)clearInterval(timer)},200);
    [900,1800,3500,6000,9000].forEach(ms=>setTimeout(()=>{install();improveCopy()},ms));
  }

  window.KaraokeWorldLibraryAiAuto={version:VERSION,installed:true,install,detectChangedAudio,autoPrepare};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
