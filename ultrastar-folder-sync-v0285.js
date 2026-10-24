/* KaraokeWorld v0.28.5 — synchronisation des suppressions du dossier UltraStar vers Drive */
(()=>{
  if(window.KaraokeWorldUltraStarFolderSync?.installed)return;
  const VERSION='0.28.5';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const AUDIO_RX=/\.(mp3|ogg|m4a|wav|aac|flac|opus)$/i;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const safe=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'titre';
  const shortHash=s=>{let h=2166136261;s=String(s||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
  const relDir=f=>{const p=String(f?.webkitRelativePath||f?.name||'').replace(/\\/g,'/');return p.split('/').slice(0,-1).join('/')};
  const token=()=>{try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return''}};
  const currentUser=()=>{try{return cloudUser||cloudApi?.auth?.currentUser||null}catch(e){return window.cloudApi?.auth?.currentUser||null}};
  const status=(text,kind='')=>{const el=$('cloudUltraStarStatus');if(el){el.textContent=text;el.dataset.kind=kind}};
  const setProgress=p=>{const el=$('cloudUltraStarBar');if(el)el.style.width=Math.max(0,Math.min(100,Number(p)||0))+'%'};

  function setBusy(on){
    const b=$('kwUltraStarSyncFolder');
    if(b){b.disabled=!!on;b.textContent=on?'🔄 Synchronisation…':'🔄 Synchroniser le dossier UltraStar'}
    ['cloudUltraStarUpload','cloudUltraStarReload','cloudDriveAuthorize'].forEach(id=>{const el=$(id);if(el&&on)el.disabled=true});
    if(!on){
      const reload=$('cloudUltraStarReload');if(reload)reload.disabled=!currentUser();
      const auth=$('cloudDriveAuthorize');if(auth)auth.disabled=!currentUser();
      const upload=$('cloudUltraStarUpload');if(upload)upload.disabled=!currentUser()||!token();
    }
  }

  function findAudio(files,dir,name){
    const exact=name&&files.find(f=>relDir(f)===dir&&String(f.name||'').toLowerCase()===String(name).toLowerCase());
    return exact||files.find(f=>relDir(f)===dir&&AUDIO_RX.test(String(f.name||'')));
  }

  async function localSongs(fileList){
    const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(f.name)),out=[];
    for(const tf of txts){
      try{
        const parsed=parseUltraStar(usDecode(await tf.arrayBuffer()));
        const dir=relDir(tf),meta=parsed.meta||{};
        const mp3=String(meta.MP3||'').replace(/\\/g,'/').split('/').pop();
        const audio=findAudio(files,dir,mp3);if(!audio)continue;
        const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu';
        const songId=safe(artist)+'--'+safe(title)+'--'+shortHash(dir+'|'+artist+'|'+title);
        out.push({songId,title,artist,dir});
      }catch(e){console.warn('Synchronisation UltraStar : TXT ignoré',tf.name,e)}
    }
    return out;
  }

  async function waitCloudTracks(){
    try{await window.KaraokeWorldCloudUltraStar?.reload?.()}catch(e){}
    for(let i=0;i<40;i++){
      let list=[];try{list=Array.isArray(tracks)?tracks.filter(t=>t.cloudUltraStar):[]}catch(e){}
      const badge=$('cloudUltraStarBadge')?.textContent||'';
      if(list.length||/\d+\s+sur Drive/i.test(badge))return list;
      await sleep(150);
    }
    try{return Array.isArray(tracks)?tracks.filter(t=>t.cloudUltraStar):[]}catch(e){return[]}
  }

  async function driveTrash(folderId,trashed=true){
    if(!folderId)return true;
    const t=token();if(!t)throw Object.assign(new Error('Google Drive doit être réautorisé.'),{code:'drive-auth'});
    const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`,{
      method:'PATCH',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({trashed})
    });
    if(r.status===404&&trashed)return true;
    if(!r.ok){let msg=`Google Drive ${r.status}`;try{const j=await r.json();msg=j?.error?.message||msg}catch(e){}throw Object.assign(new Error(msg),{status:r.status})}
    return true;
  }

  async function firestoreDelete(docId){
    const u=currentUser();if(!u)throw new Error('Compte Google non connecté.');
    if(typeof cloudApi==='undefined'||!cloudApi?.fs)throw new Error('Firebase non disponible.');
    const fire=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js');
    await fire.deleteDoc(fire.doc(cloudApi.fs,'users',u.uid,'ultrastar',docId));
  }

  function cleanupLocalReferences(docId){
    const ids=new Set([docId,'cloudus_'+docId]);
    try{const a=JSON.parse(localStorage.getItem('kw_favorites')||'[]');localStorage.setItem('kw_favorites',JSON.stringify(a.filter(x=>!ids.has(x))))}catch(e){}
    try{const a=JSON.parse(localStorage.getItem('kw_playlists')||'[]');for(const p of a)p.trackIds=(p.trackIds||[]).filter(x=>!ids.has(x));localStorage.setItem('kw_playlists',JSON.stringify(a))}catch(e){}
    try{const a=JSON.parse(localStorage.getItem('kw_recently_sung_v1')||'[]');localStorage.setItem('kw_recently_sung_v1',JSON.stringify(a.filter(x=>!ids.has(x.id)&&!ids.has(x))))}catch(e){}
  }

  async function removeCloudTrack(t,index,total){
    const docId=t.cloudDocId||String(t.id||'').replace(/^cloudus_/,'');
    if(!docId)throw new Error('Identifiant cloud manquant pour '+(t.title||'une chanson'));
    const folderId=t.cloudManifest?.driveFolderId||'';
    setProgress(total?index/total*100:0);
    status(`🧹 Suppression ${index+1}/${total} · ${t.artist||''} — ${t.title||''}…`);
    let trashed=false;
    try{
      if(folderId){await driveTrash(folderId,true);trashed=true}
      await firestoreDelete(docId);
      cleanupLocalReferences(docId);
    }catch(e){
      if(trashed&&folderId){try{await driveTrash(folderId,false)}catch(restoreError){console.warn('Impossible de restaurer le dossier Drive après échec Firebase',restoreError)}}
      throw e;
    }
  }

  async function syncFolder(fileList){
    if(!fileList?.length)return;
    if(!currentUser()){status('Connecte-toi avec Google avant de synchroniser le dossier.','error');return}
    if(!token()){status('🔐 Autorise Google Drive puis relance « Synchroniser le dossier UltraStar ».','error');$('cloudDriveAuthorize')?.focus();return}
    setBusy(true);setProgress(0);
    try{
      status('🔎 Analyse du dossier UltraStar sélectionné…');
      const local=await localSongs(fileList);
      if(!local.length){status('⚠️ Aucune chanson UltraStar complète trouvée. Rien n’a été supprimé.','error');return}
      status(`🔎 ${local.length} chansons locales trouvées · comparaison avec Google Drive…`);
      const cloud=await waitCloudTracks();
      if(!cloud.length){status(`✅ ${local.length} chansons trouvées localement. Aucune chanson Drive à retirer.`);setProgress(100);return}
      const localIds=new Set(local.map(s=>s.songId));
      const stale=cloud.filter(t=>!localIds.has(t.cloudDocId||String(t.id||'').replace(/^cloudus_/,'')));
      const cloudIds=new Set(cloud.map(t=>t.cloudDocId||String(t.id||'').replace(/^cloudus_/,'')));
      const newLocal=local.filter(s=>!cloudIds.has(s.songId));
      if(!stale.length){
        setProgress(100);
        status(newLocal.length?`✅ Aucun ancien titre à supprimer · ${newLocal.length} nouveau${newLocal.length>1?'x':''} titre${newLocal.length>1?'s':''} local${newLocal.length>1?'aux':''} détecté${newLocal.length>1?'s':''}. Utilise « Envoyer un dossier sur Drive » pour les ajouter.`:`✅ Dossier synchronisé : ${local.length} chansons correspondent à la bibliothèque Drive.`);
        return;
      }
      const first=stale.slice(0,6).map(t=>`• ${t.artist||'Artiste'} — ${t.title||'Titre'}`).join('\n');
      const more=stale.length>6?`\n… et ${stale.length-6} autre${stale.length-6>1?'s':''}.`:'';
      const ok=confirm(`KaraokeWorld a trouvé ${stale.length} chanson${stale.length>1?'s':''} présente${stale.length>1?'s':''} sur Drive mais absente${stale.length>1?'s':''} du dossier sélectionné.\n\n${first}${more}\n\nLes retirer du catalogue et déplacer leurs dossiers Google Drive dans la corbeille ?`);
      if(!ok){status('Synchronisation annulée. Aucune chanson n’a été supprimée.');return}
      if(stale.length>=20&&local.length<cloud.length*.65){
        const ok2=confirm(`⚠️ Vérification de sécurité\n\nLe dossier sélectionné contient ${local.length} chansons alors que Drive en contient ${cloud.length}.\n${stale.length} chansons seraient retirées.\n\nConfirmer une seconde fois ?`);
        if(!ok2){status('Synchronisation annulée par la vérification de sécurité.');return}
      }
      let done=0,failed=[];
      for(const t of stale){
        try{await removeCloudTrack(t,done,stale.length);done++}
        catch(e){console.error('Suppression synchro UltraStar',t,e);failed.push({t,e});done++}
      }
      setProgress(100);
      try{await window.KaraokeWorldCloudUltraStar?.reload?.()}catch(e){}
      try{window.KaraokeWorldVocalSeparation?.countPrepared?.()}catch(e){}
      if(failed.length){status(`⚠️ Synchronisation partielle : ${stale.length-failed.length}/${stale.length} ancien${stale.length>1?'s':''} titre${stale.length>1?'s':''} retiré${stale.length>1?'s':''}. ${failed.length} suppression${failed.length>1?'s':''} à réessayer.`,'error')}
      else status(`✅ Synchronisation terminée · ${stale.length} ancien${stale.length>1?'s':''} titre${stale.length>1?'s':''} retiré${stale.length>1?'s':''} de KaraokeWorld et placé${stale.length>1?'s':''} dans la corbeille Drive.${newLocal.length?` · ${newLocal.length} nouveau${newLocal.length>1?'x':''} titre${newLocal.length>1?'s':''} local${newLocal.length>1?'aux':''} à envoyer sur Drive.`:''}`);
    }catch(e){
      console.error('Synchronisation dossier UltraStar',e);
      status('Synchronisation impossible : '+(e?.message||e),'error');
    }finally{
      setBusy(false);const input=$('kwUltraStarSyncInput');if(input)input.value='';
    }
  }

  function mount(){
    const box=$('cloudUltraStarBox');if(!box)return false;
    if($('kwUltraStarSyncFolder'))return true;
    const controls=box.querySelector('.controls.wrap');if(!controls)return false;
    const b=document.createElement('button');b.id='kwUltraStarSyncFolder';b.type='button';b.className='secondary';b.textContent='🔄 Synchroniser le dossier UltraStar';b.title='Retirer de KaraokeWorld les chansons qui ont été supprimées de ton dossier UltraStar';
    const input=document.createElement('input');input.id='kwUltraStarSyncInput';input.type='file';input.multiple=true;input.hidden=true;input.setAttribute('webkitdirectory','');
    b.onclick=()=>{
      if(!currentUser()){status('Connecte-toi avec Google avant la synchronisation.','error');return}
      if(!token()){status('🔐 Autorise Google Drive avant la synchronisation.','error');$('cloudDriveAuthorize')?.focus();return}
      input.click();
    };
    input.onchange=e=>syncFolder(e.target.files);
    controls.appendChild(b);controls.appendChild(input);
    const note=document.createElement('div');note.id='kwUltraStarSyncHelp';note.className='muted';note.style.cssText='font-size:11px;margin-top:7px';note.textContent='🔄 Synchronisation du dossier : compare ton dossier actuel à la bibliothèque Drive et retire uniquement les chansons qui n’existent plus localement.';
    controls.insertAdjacentElement('afterend',note);
    return true;
  }

  function boot(){
    let n=0;const timer=setInterval(()=>{if(mount()||++n>80)clearInterval(timer)},150);
    [600,1500,3000,5000].forEach(ms=>setTimeout(mount,ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.KaraokeWorldUltraStarFolderSync={version:VERSION,installed:true,mount,syncFolder};
})();
