/* KaraokeWorld v0.26.8 — conversions, connexion Google et diagnostic Cloud Storage */
(()=>{
  const VERSION='0.26.8';
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
            if(code.includes('unauthorized-domain')) status.textContent=`Connexion refusée : ajoute ${location.hostname} aux domaines autorisés dans Firebase Authentication.`;
            else if(code.includes('popup-blocked')) status.textContent='Le popup Google a été bloqué par Chrome. Autorise les fenêtres pop-up pour KaraokeWorld puis réessaie.';
            else status.textContent='Connexion impossible : '+(e?.message||e||'erreur Firebase');
          }
        }
      };
    }catch(e){console.warn('Correctif Firebase Auth non chargé',e)}
  }

  function explainStorageStatus(){
    const el=$('cloudUltraStarStatus');
    if(!el)return;
    const raw=String(el.textContent||'');
    if(!/Cloud UltraStar|Impossible de charger le cloud/i.test(raw))return;
    const s=raw.toLowerCase();
    let msg='';
    if(s.includes('quota-exceeded')||s.includes('402')||s.includes('payment required')||s.includes('billing')){
      msg='❌ Firebase Storage est bloqué par le forfait du projet. Depuis février 2026, Cloud Storage nécessite le forfait Blaze. Active Blaze dans Firebase puis réessaie.';
    }else if(s.includes('unauthorized')||s.includes('permission')||s.includes('403')){
      msg='❌ Firebase Storage refuse l’accès. Vérifie Storage → Rules : l’utilisateur connecté doit pouvoir lire/écrire uniquement dans users/{uid}/**.';
    }else if(s.includes('bucket-not-found')||s.includes('no-default-bucket')||s.includes('bucket')){
      msg='❌ Aucun bucket Firebase Storage utilisable n’est disponible. Ouvre Firebase → Storage et initialise le bucket du projet.';
    }else if(s.includes('unauthenticated')){
      msg='❌ La session Google n’est pas reconnue par Storage. Déconnecte-toi puis reconnecte-toi avant de relancer l’envoi.';
    }
    if(msg&&el.textContent!==msg){el.dataset.kwRawError=raw;el.textContent=msg}
  }

  function watchStorageStatus(){
    const el=$('cloudUltraStarStatus');
    if(!el)return false;
    if(el.dataset.kwDiag==='1')return true;
    el.dataset.kwDiag='1';
    new MutationObserver(explainStorageStatus).observe(el,{childList:true,characterData:true,subtree:true});
    explainStorageStatus();
    return true;
  }

  function markVersion(){
    const small=document.querySelector('.brand small');
    if(small&&small.textContent!==' BETA · v0.26.8 · UltraStar 🎤')small.textContent=' BETA · v0.26.8 · UltraStar 🎤';
  }
  function start(){
    markVersion();patchGoogleAuth();watchStorageStatus();
    [250,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{markVersion();watchStorageStatus()},ms));
    setTimeout(patchGoogleAuth,1200);setTimeout(patchGoogleAuth,3000);
    const brand=document.querySelector('.brand');
    if(brand)new MutationObserver(markVersion).observe(brand,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
