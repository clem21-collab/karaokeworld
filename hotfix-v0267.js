/* KaraokeWorld v0.27.1 — conversions, connexion Google, autorisation Drive et reprise d'envoi */
(()=>{
  const VERSION='0.27.1';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const CKPT_KEY='kw_drive_upload_checkpoint_v1';
  const $=id=>document.getElementById(id);

  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('#ultraStarStopConversions,#ultraStarResumeConversions');
    if(!target)return;
    const api=window.KaraokeWorldVideoPreconvert;if(!api)return;
    if(target.id==='ultraStarStopConversions'){
      e.preventDefault();try{api.stopAll?.()}catch(err){console.error('KaraokeWorld stop conversions',err)}
    }else if(target.id==='ultraStarResumeConversions'){
      e.preventDefault();try{api.resumeAll?.()}catch(err){console.error('KaraokeWorld resume conversions',err)}
    }
  },true);

  async function waitCloud(){
    for(let i=0;i<100;i++){
      try{if(typeof cloudApi!=='undefined'&&cloudApi?.auth)return cloudApi.auth}catch(e){}
      await new Promise(r=>setTimeout(r,100));
    }
    return null;
  }

  function saveDriveToken(token){
    if(!token)return;
    try{sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem(TOKEN_EXP_KEY,String(Date.now()+50*60*1000))}catch(e){}
    window.dispatchEvent(new CustomEvent('kw-drive-token'));
  }

  async function patchGoogleAuth(){
    const btn=$('googleSignIn');if(!btn||btn.dataset.kwAuthFix==='1')return;
    const auth=await waitCloud();if(!auth)return;
    try{
      const mod=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js');
      btn.dataset.kwAuthFix='1';
      btn.onclick=async()=>{
        const status=$('cloudStatus');
        try{
          if(status)status.textContent='Connexion Google + autorisation Drive…';
          const provider=new mod.GoogleAuthProvider();provider.addScope(DRIVE_SCOPE);
          const result=await mod.signInWithPopup(auth,provider,mod.browserPopupRedirectResolver);
          const credential=mod.GoogleAuthProvider.credentialFromResult(result);if(credential?.accessToken)saveDriveToken(credential.accessToken);
          if(status)status.textContent='✓ Connecté à Google. Google Drive est prêt pour KaraokeWorld.';
        }catch(e){
          console.error('KaraokeWorld Google Auth',e);const code=String(e?.code||'');
          if(status){
            if(code.includes('unauthorized-domain'))status.textContent=`Connexion refusée : ajoute ${location.hostname} aux domaines autorisés dans Firebase Authentication.`;
            else if(code.includes('popup-blocked'))status.textContent='Le popup Google a été bloqué par Chrome. Autorise les fenêtres pop-up pour KaraokeWorld puis réessaie.';
            else status.textContent='Connexion impossible : '+(e?.message||e||'erreur Firebase');
          }
        }
      };
    }catch(e){console.warn('Correctif Firebase Auth non chargé',e)}
  }

  function readCheckpoint(){
    try{return JSON.parse(localStorage.getItem(CKPT_KEY)||'null')}catch(e){return null}
  }
  function writeCheckpoint(data){
    const next={...(readCheckpoint()||{}),...data,active:true,updatedAt:Date.now()};
    try{localStorage.setItem(CKPT_KEY,JSON.stringify(next))}catch(e){}
    renderResumeUI();return next;
  }
  function clearCheckpoint(){
    try{localStorage.removeItem(CKPT_KEY)}catch(e){}
    renderResumeUI();
  }
  function uploadRunning(){
    const b=$('cloudUltraStarUpload'),s=$('cloudUltraStarStatus');
    return /Envoi vers Drive/i.test(b?.textContent||'')||/Préparation de \d+ chanson|Chanson \d+\/\d+|✅ \d+\/\d+ terminée/i.test(s?.textContent||'');
  }
  function ensureResumeUI(){
    const status=$('cloudUltraStarStatus');if(!status)return null;
    let box=$('driveResumeBox');
    if(!box){
      box=document.createElement('div');box.id='driveResumeBox';
      box.style.cssText='display:none;margin-top:8px;padding:9px 10px;border:1px solid #29415e;border-radius:10px;background:#0b2036';
      status.insertAdjacentElement('afterend',box);
    }
    return box;
  }
  function renderResumeUI(){
    const box=ensureResumeUI();if(!box)return false;
    const cp=readCheckpoint();
    if(!cp?.active){
      box.style.display='block';
      box.innerHTML='<span class="muted">🛡 Reprise sécurisée active : si Chrome se ferme ou si Internet coupe, relance le même dossier. Les gros fichiers déjà présents sur Drive seront ignorés.</span>';
      return true;
    }
    const done=Math.max(0,Number(cp.done||0)),total=Math.max(0,Number(cp.total||0)),current=Math.max(done,Number(cp.current||0));
    const pct=total?Math.min(100,done/total*100):0;
    const label=cp.song?` · ${cp.song}`:'';
    box.style.display='block';
    if(uploadRunning()){
      box.innerHTML=`<b>💾 Reprise sécurisée</b><div class="muted" style="margin-top:4px">Avancement mémorisé : ${done}/${total||'?'} terminé${done>1?'s':''}${label}. Le point de reprise est sauvegardé automatiquement.</div>`;
    }else{
      box.innerHTML=`<b>⚠️ Envoi précédent interrompu</b><div class="muted" style="margin:4px 0 8px">${done}/${total||'?'} chanson${done>1?'s':''} terminée${done>1?'s':''}${label}. Reprends avec le même dossier : les gros fichiers audio/vidéo déjà envoyés ne seront pas renvoyés.</div><div style="height:6px;background:#172a40;border-radius:99px;overflow:hidden;margin-bottom:8px"><i style="display:block;height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,#8b5cf6,#38bdf8)"></i></div><button id="driveResumeUpload" type="button">▶ Reprendre l’envoi</button>`;
      const btn=$('driveResumeUpload');if(btn)btn.onclick=()=>{
        const upload=$('cloudUltraStarUpload'),authBtn=$('cloudDriveAuthorize');
        if(upload&&!upload.disabled){upload.click();return}
        if(authBtn&&!authBtn.disabled){authBtn.click();const msg=$('cloudUltraStarStatus');if(msg)msg.textContent='Réautorise Google Drive, puis clique de nouveau sur « Reprendre l’envoi ».'}
      };
    }
    box.dataset.current=String(current);return true;
  }

  function inspectUploadStatus(){
    const el=$('cloudUltraStarStatus');if(!el)return;
    const text=String(el.textContent||'').trim();if(!text)return;
    let m=text.match(/Préparation de\s+(\d+)\s+chanson/i);
    if(m){writeCheckpoint({total:Number(m[1]),current:0,done:0,song:'',startedAt:Date.now(),lastStatus:text});return}
    m=text.match(/Chanson\s+(\d+)\/(\d+)\s*·\s*(.*?)\s*·\s*(?:Paroles|Audio|Vidéo|Jaquette)\b/i);
    if(m){const cp=readCheckpoint()||{};writeCheckpoint({total:Number(m[2]),current:Number(m[1]),done:Number(cp.done||0),song:m[3],lastStatus:text});return}
    m=text.match(/✅\s*(\d+)\/(\d+)\s+terminée/i);
    if(m){writeCheckpoint({total:Number(m[2]),current:Number(m[1]),done:Number(m[1]),lastStatus:text});return}
    m=text.match(/✅\s*(\d+)\s+chanson(?:s)?\s+disponible(?:s)?\s+sur Google Drive/i);
    if(m){clearCheckpoint();return}
    const cp=readCheckpoint();
    if(cp?.active&&/Session Google Drive expirée|Connexion interrompue|Google Drive :|échec de l’envoi|network/i.test(text))writeCheckpoint({lastStatus:text,error:text});
    else renderResumeUI();
  }

  function watchUpload(){
    const el=$('cloudUltraStarStatus');if(!el||el.dataset.kwResumeWatch==='1')return !!el;
    el.dataset.kwResumeWatch='1';
    new MutationObserver(inspectUploadStatus).observe(el,{childList:true,characterData:true,subtree:true});
    const input=$('cloudUltraStarInput');
    if(input&&!input.dataset.kwResumeInput){
      input.dataset.kwResumeInput='1';
      input.addEventListener('change',()=>{
        if(input.files?.length){const txt=[...input.files].filter(f=>/\.txt$/i.test(f.name)).length;writeCheckpoint({total:txt||0,current:0,done:0,song:'',selectedAt:Date.now()})}
      },true);
    }
    inspectUploadStatus();renderResumeUI();return true;
  }

  window.addEventListener('beforeunload',e=>{
    if(!readCheckpoint()?.active||!uploadRunning())return;
    e.preventDefault();e.returnValue='';
  });

  function markVersion(){
    const small=document.querySelector('.brand small');
    if(small&&small.textContent!==' BETA · v0.27.1 · Google Drive ☁️')small.textContent=' BETA · v0.27.1 · Google Drive ☁️';
  }
  function start(){
    markVersion();patchGoogleAuth();watchUpload();
    [250,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{markVersion();patchGoogleAuth();watchUpload();renderResumeUI()},ms));
    const brand=document.querySelector('.brand');if(brand)new MutationObserver(markVersion).observe(brand,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
