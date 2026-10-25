/* KaraokeWorld v0.28.6 — envoi Drive incrémental : nouvelles chansons / fichiers modifiés uniquement */
(()=>{
  if(window.KaraokeWorldDriveIncrementalUpload?.installed)return;
  const VERSION='0.28.6';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const AUDIO_RX=/\.(mp3|ogg|m4a|wav|aac|flac|opus)$/i;
  const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
  const COVER_RX=/\.(jpg|jpeg|png|webp)$/i;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const safe=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'titre';
  const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const shortHash=s=>{let h=2166136261;s=String(s||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
  const relDir=f=>{const p=String(f?.webkitRelativePath||f?.name||'').replace(/\\/g,'/');return p.split('/').slice(0,-1).join('/')};
  const driveToken=()=>{try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return''}};
  const status=text=>{const el=$('cloudUltraStarStatus');if(el)el.textContent=text};
  const progress=p=>{const el=$('cloudUltraStarBar');if(el)el.style.width=Math.max(0,Math.min(100,Number(p)||0))+'%'};

  function findSame(files,dir,name,rx){
    const exact=name&&files.find(f=>relDir(f)===dir&&String(f.name||'').toLowerCase()===String(name).toLowerCase());
    return exact||files.find(f=>relDir(f)===dir&&rx.test(String(f.name||'')));
  }

  async function parseLocal(fileList){
    const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(String(f.name||''))),songs=[];
    for(let i=0;i<txts.length;i++){
      const tf=txts[i];
      try{
        const parsed=parseUltraStar(usDecode(await tf.arrayBuffer()));
        const dir=relDir(tf),meta=parsed.meta||{};
        const audioName=String(meta.MP3||'').replace(/\\/g,'/').split('/').pop();
        const videoName=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop();
        const coverName=String(meta.COVER||'').replace(/\\/g,'/').split('/').pop();
        const audio=findSame(files,dir,audioName,AUDIO_RX);if(!audio)continue;
        const video=findSame(files,dir,videoName,VIDEO_RX),cover=findSame(files,dir,coverName,COVER_RX);
        const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu';
        const songId=safe(artist)+'--'+safe(title)+'--'+shortHash(dir+'|'+artist+'|'+title);
        songs.push({songId,title,artist,dir,tf,audio,video,cover});
        if(i%30===0){progress(txts.length?Math.min(18,(i/txts.length)*18):0);await sleep(0)}
      }catch(e){console.warn('Analyse incrémentale UltraStar : TXT ignoré',tf?.name,e)}
    }
    return songs;
  }

  async function listInventory(){
    const token=driveToken();if(!token)throw new Error('Google Drive doit être autorisé avant la comparaison.');
    const all=[];let pageToken='';
    do{
      const params=new URLSearchParams({spaces:'drive',pageSize:'1000',fields:'nextPageToken,files(id,name,mimeType,size,appProperties)',q:"trashed=false and appProperties has { key='kwApp' and value='KaraokeWorld' }"});
      if(pageToken)params.set('pageToken',pageToken);
      const r=await fetch('https://www.googleapis.com/drive/v3/files?'+params.toString(),{headers:{Authorization:'Bearer '+token}});
      if(!r.ok)throw new Error(`Inventaire Google Drive impossible (${r.status}).`);
      const j=await r.json();all.push(...(j.files||[]));pageToken=j.nextPageToken||'';
    }while(pageToken);
    return all;
  }

  function cloudIdForSong(song,assetMap){
    if(['txt','audio','video','cover'].some(role=>assetMap.has(song.songId+'|'+role)))return song.songId;
    try{
      const key=norm(song.artist+'|'+song.title);
      const match=(Array.isArray(tracks)?tracks:[]).find(t=>t?.cloudUltraStar&&norm((t.artist||'')+'|'+(t.title||''))===key&&t.cloudDocId);
      return match?.cloudDocId||song.songId;
    }catch(e){return song.songId}
  }

  function roleChanged(remote,file){
    if(!file)return false;
    if(!remote)return true;
    if(String(remote.name||'')!==String(file.name||''))return true;
    const rs=Number(remote.size||0),ls=Number(file.size||0);
    return !rs||rs!==ls;
  }

  async function filterChanged(files){
    status('🔎 Analyse du dossier : recherche des nouveautés et modifications…');progress(1);
    const songs=await parseLocal(files);
    if(!songs.length)throw new Error('Aucune chanson UltraStar complète trouvée dans ce dossier.');
    status(`🔎 ${songs.length} chansons trouvées · comparaison avec Google Drive…`);progress(20);
    const inventory=await listInventory(),assetMap=new Map();
    for(const f of inventory){const ap=f.appProperties||{};if(ap.kwSongId&&ap.kwRole)assetMap.set(ap.kwSongId+'|'+ap.kwRole,f)}
    progress(45);

    const changed=[],unchanged=[];
    for(let i=0;i<songs.length;i++){
      const s=songs[i],remoteId=cloudIdForSong(s,assetMap);
      const roles=[['txt',s.tf],['audio',s.audio],['video',s.video],['cover',s.cover]];
      const dirty=roles.some(([role,file])=>file&&roleChanged(assetMap.get(remoteId+'|'+role),file));
      (dirty?changed:unchanged).push(s);
      if(i%40===0){progress(45+(i/songs.length)*35);await sleep(0)}
    }

    if(!changed.length){
      progress(100);status(`✅ ${songs.length} chansons vérifiées · tout est déjà à jour sur Google Drive. Aucun fichier renvoyé.`);
      return {songs,changed,unchanged,files:[]};
    }

    const selected=new Set();
    for(const s of changed)[s.tf,s.audio,s.video,s.cover].filter(Boolean).forEach(f=>selected.add(f));
    progress(82);
    return {songs,changed,unchanged,files:[...selected]};
  }

  function install(){
    const input=$('cloudUltraStarInput'),button=$('cloudUltraStarUpload');
    if(!input||typeof input.onchange!=='function')return false;
    if(input.dataset.kwIncremental==='1')return true;
    input.dataset.kwIncremental='1';
    const original=input.onchange;
    input.onchange=async function(e){
      const originalFiles=[...(e?.target?.files||[])];
      if(!originalFiles.length)return;
      if(!driveToken())return original.call(input,e);
      try{
        const result=await filterChanged(originalFiles);
        if(!result.files.length){try{input.value=''}catch(err){}return}
        status(`🚀 ${result.changed.length} chanson${result.changed.length>1?'s':''} à envoyer ou mettre à jour · ${result.unchanged.length} déjà à jour ignorée${result.unchanged.length>1?'s':''}.`);
        progress(0);
        return original.call(input,{target:{files:result.files}});
      }catch(err){
        console.error('KaraokeWorld envoi incrémental',err);
        status('⚠️ Comparaison rapide impossible : '+(err?.message||err)+' Envoi classique utilisé.');
        return original.call(input,e);
      }
    };
    if(button&&!button.dataset.kwIncrementalLabel){button.dataset.kwIncrementalLabel='1';button.textContent='☁ Ajouter / mettre à jour le dossier'}
    return true;
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{if(install()||++tries>120)clearInterval(timer)},250);
    [800,1800,3500,6000].forEach(ms=>setTimeout(install,ms));
  }

  window.KaraokeWorldDriveIncrementalUpload={version:VERSION,installed:true,install};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
