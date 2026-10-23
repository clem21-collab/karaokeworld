/* KaraokeWorld v0.27.0 — conversions, connexion Google et autorisation Drive */
(()=>{
  const VERSION='0.27.0';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
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

  function markVersion(){
    const small=document.querySelector('.brand small');
    if(small&&small.textContent!==' BETA · v0.27.0 · Google Drive ☁️')small.textContent=' BETA · v0.27.0 · Google Drive ☁️';
  }
  function start(){
    markVersion();patchGoogleAuth();
    [250,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{markVersion();patchGoogleAuth()},ms));
    const brand=document.querySelector('.brand');if(brand)new MutationObserver(markVersion).observe(brand,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
