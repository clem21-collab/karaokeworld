/* KaraokeWorld v0.26.7 — correctifs Arrêt/Reprise conversions + connexion Google */
(()=>{
  const VERSION='0.26.7';
  const $=id=>document.getElementById(id);

  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('#ultraStarStopConversions,#ultraStarResumeConversions');
    if(!target)return;
    const api=window.KaraokeWorldVideoPreconvert;
    if(!api)return;
    if(target.id==='ultraStarStopConversions'){
      e.preventDefault();
      try{api.stopAll?.()}catch(err){console.error('KaraokeWorld stop conversions',err)}
    }else if(target.id==='ultraStarResumeConversions'){
      e.preventDefault();
      try{api.resumeAll?.()}catch(err){console.error('KaraokeWorld resume conversions',err)}
    }
  },true);

  async function waitCloud(){
    for(let i=0;i<100;i++){
      try{if(typeof cloudApi!=='undefined'&&cloudApi?.auth)return cloudApi.auth}catch(e){}
      await new Promise(r=>setTimeout(r,100));
    }
    return null;
  }

  async function patchGoogleAuth(){
    const btn=$('googleSignIn');
    if(!btn||btn.dataset.kwAuthFix==='1')return;
    const auth=await waitCloud();
    if(!auth)return;
    try{
      const mod=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js');
      btn.dataset.kwAuthFix='1';
      btn.onclick=async()=>{
        const status=$('cloudStatus');
        try{
          if(status)status.textContent='Connexion Google…';
          const provider=new mod.GoogleAuthProvider();
          await mod.signInWithPopup(auth,provider,mod.browserPopupRedirectResolver);
        }catch(e){
          console.error('KaraokeWorld Google Auth',e);
          const code=String(e?.code||'');
          if(status){
            if(code.includes('unauthorized-domain')){
              status.textContent=`Connexion refusée : ajoute ${location.hostname} aux domaines autorisés dans Firebase Authentication.`;
            }else if(code.includes('popup-blocked')){
              status.textContent='Le popup Google a été bloqué par Chrome. Autorise les fenêtres pop-up pour KaraokeWorld puis réessaie.';
            }else{
              status.textContent='Connexion impossible : '+(e?.message||e||'erreur Firebase');
            }
          }
        }
      };
    }catch(e){console.warn('Correctif Firebase Auth non chargé',e)}
  }

  function markVersion(){
    const small=document.querySelector('.brand small');
    if(small&&small.textContent!==' BETA · v0.26.7 · UltraStar 🎤')small.textContent=' BETA · v0.26.7 · UltraStar 🎤';
  }
  function start(){
    markVersion();
    patchGoogleAuth();
    setTimeout(markVersion,250);
    setTimeout(markVersion,800);
    setTimeout(markVersion,1600);
    setTimeout(markVersion,3000);
    setTimeout(patchGoogleAuth,1200);
    setTimeout(patchGoogleAuth,3000);
    const brand=document.querySelector('.brand');
    if(brand)new MutationObserver(markVersion).observe(brand,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
