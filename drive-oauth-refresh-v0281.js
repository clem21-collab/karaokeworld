/* KaraokeWorld v0.28.1 — renouvellement automatique Google Drive via backend OAuth sécurisé */
(()=>{
  if(window.KaraokeWorldDriveOAuth?.installed)return;
  const VERSION='0.28.1';
  const BACKEND_KEY='kw_drive_oauth_backend_v1';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const EXP_KEY='kw_drive_access_exp_v1';
  const $=id=>document.getElementById(id);

  let refreshTimer=0;
  let refreshPromise=null;
  let checking=false;

  function backendBase(){
    try{return String(localStorage.getItem(BACKEND_KEY)||'').trim().replace(/\/+$/,'')}catch(e){return''}
  }
  function setBackend(value){
    try{
      if(!value){localStorage.removeItem(BACKEND_KEY);return ''}
      const u=new URL(String(value).trim());
      if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')throw new Error('Le serveur doit utiliser HTTPS.');
      const base=(u.origin+u.pathname).replace(/\/+$/,'');
      localStorage.setItem(BACKEND_KEY,base);return base;
    }catch(e){alert('Adresse du serveur invalide : '+(e?.message||e));return null}
  }
  function backendOrigin(){try{return new URL(backendBase()).origin}catch(e){return''}}
  function tokenExpiry(){try{return Number(sessionStorage.getItem(EXP_KEY)||0)}catch(e){return 0}}
  function saveAccessToken(token,expiresIn){
    if(!token)return false;
    const seconds=Math.max(60,Number(expiresIn)||3600);
    const exp=Date.now()+Math.max(30,seconds-20)*1000;
    try{sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem(EXP_KEY,String(exp))}catch(e){}
    window.dispatchEvent(new CustomEvent('kw-drive-token',{detail:{source:'oauth-backend',expiresAt:exp,expiresIn:seconds}}));
    schedule(exp);return true;
  }
  function schedule(exp=tokenExpiry()){
    clearTimeout(refreshTimer);refreshTimer=0;
    if(!backendBase()||!exp)return;
    // Renouvelle cinq minutes avant l'expiration réelle, minimum dans 30 s.
    const delay=Math.max(30000,exp-Date.now()-5*60*1000);
    refreshTimer=setTimeout(()=>refreshAccessToken({quiet:true}),delay);
  }
  function setStatus(text,kind=''){
    const el=$('kwDriveAutoStatus');if(el){el.textContent=text;el.dataset.kind=kind}
  }
  function setConnectedUI(connected,configured=true){
    const connect=$('kwDriveAutoConnect'),refresh=$('kwDriveAutoRefresh');
    if(connect){connect.textContent=connected?'✅ Drive automatique actif':'🔐 Activer Drive automatique';connect.disabled=connected||!configured}
    if(refresh){refresh.classList.toggle('hidden',!connected);refresh.disabled=!connected}
  }
  async function currentFirebaseUser(){
    try{if(typeof cloudUser!=='undefined'&&cloudUser)return cloudUser}catch(e){}
    try{return cloudApi?.auth?.currentUser||null}catch(e){return null}
  }
  async function firebaseToken(){
    const u=await currentFirebaseUser();
    if(!u?.getIdToken)throw new Error('Connecte-toi d’abord à ton compte Google dans KaraokeWorld.');
    return u.getIdToken();
  }
  async function backendFetch(path,options={}){
    const base=backendBase();if(!base)throw new Error('Serveur OAuth Drive non configuré.');
    const idToken=await firebaseToken();
    const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+idToken);
    if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    let r;
    try{r=await fetch(base+path,{...options,headers,cache:'no-store'})}catch(e){throw new Error('Serveur OAuth Drive inaccessible.')}
    let data={};try{data=await r.json()}catch(e){}
    if(!r.ok){const err=new Error(data?.detail||`Serveur OAuth ${r.status}`);err.status=r.status;throw err}
    return data;
  }

  async function refreshAccessToken({quiet=false}={}){
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      try{
        if(!quiet)setStatus('🔄 Renouvellement automatique du jeton Drive…');
        const data=await backendFetch('/google/oauth/token',{method:'POST'});
        if(!data?.access_token)throw new Error('Le serveur n’a pas renvoyé de jeton Drive.');
        saveAccessToken(data.access_token,data.expires_in);
        const min=Math.max(1,Math.round((Number(data.expires_in)||3600)/60));
        setConnectedUI(true,true);setStatus(`✅ Drive automatique actif · prochain renouvellement avant ~${min} min.`,'ok');
        return data.access_token;
      }catch(e){
        console.warn('KaraokeWorld Drive refresh',e);
        if(e?.status===404||e?.status===401){setConnectedUI(false,true);setStatus('🔐 Drive automatique à reconnecter. Le mode manuel reste disponible.','warn')}
        else if(!quiet)setStatus('⚠️ Renouvellement automatique indisponible : '+(e?.message||e),'warn');
        // Réessaie plus tard sans casser le jeton manuel encore valide.
        clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshAccessToken({quiet:true}),60000);
        return '';
      }finally{refreshPromise=null}
    })();
    return refreshPromise;
  }

  async function checkBackend({refreshIfConnected=true}={}){
    if(checking)return;checking=true;
    try{
      const base=backendBase();
      if(!base){setConnectedUI(false,false);setStatus('⚙️ Non configuré · le mode Drive manuel continue de fonctionner.');return}
      setStatus('🔎 Vérification du serveur Drive automatique…');
      const data=await backendFetch('/google/oauth/status');
      if(!data?.configured){setConnectedUI(false,false);setStatus('⚠️ Serveur trouvé, mais ses secrets OAuth ne sont pas encore configurés.','warn');return}
      if(data.connected){
        setConnectedUI(true,true);setStatus('✅ Serveur Drive automatique connecté.','ok');
        if(refreshIfConnected)await refreshAccessToken({quiet:true});else schedule();
      }else{
        setConnectedUI(false,true);setStatus('🔐 Serveur prêt · active Drive automatique une seule fois.');
      }
    }catch(e){setConnectedUI(false,true);setStatus('⚠️ Serveur OAuth inaccessible · le mode Drive manuel reste disponible.','warn')}
    finally{checking=false}
  }

  async function startOAuth(){
    const base=backendBase();
    if(!base){configureBackend();return}
    const popup=window.open('about:blank','kwGoogleDriveOAuth','width=560,height=760,resizable=yes,scrollbars=yes');
    if(!popup){setStatus('Autorise les fenêtres pop-up pour KaraokeWorld puis réessaie.','warn');return}
    try{
      popup.document.write('<title>KaraokeWorld</title><p style="font-family:system-ui;padding:24px">Préparation de l’autorisation Google Drive…</p>');
      const data=await backendFetch('/google/oauth/start',{method:'POST'});
      if(!data?.authorizationUrl)throw new Error('URL Google OAuth absente.');
      popup.location.href=data.authorizationUrl;
      setStatus('🔐 Termine l’autorisation Google dans la fenêtre ouverte…');
    }catch(e){try{popup.close()}catch(_){}setStatus('⚠️ '+(e?.message||e),'warn')}
  }

  function configureBackend(){
    const old=backendBase();
    const value=prompt('Adresse HTTPS de ton serveur KaraokeWorld Sync/OAuth :',old||'https://');
    if(value===null)return;
    const next=setBackend(value.trim());if(next===null)return;
    if(!next){setConnectedUI(false,false);setStatus('⚙️ Serveur supprimé · Drive repasse en mode manuel.');clearTimeout(refreshTimer);return}
    checkBackend({refreshIfConnected:true});
  }

  async function disconnect(){
    if(!backendBase())return;
    if(!confirm('Désactiver le renouvellement automatique Google Drive pour ce compte ?'))return;
    try{await backendFetch('/google/oauth/disconnect',{method:'DELETE'});setConnectedUI(false,true);setStatus('Drive automatique désactivé. Le mode manuel reste disponible.')}catch(e){setStatus('Impossible de désactiver : '+(e?.message||e),'warn')}
  }

  function ensureUI(){
    if($('kwDriveAutoBox'))return true;
    const host=$('cloudUltraStarBox');if(!host)return false;
    const box=document.createElement('div');box.id='kwDriveAutoBox';
    box.style.cssText='margin-top:10px;padding:10px 11px;border:1px solid #29415e;border-radius:11px;background:#0b2036';
    box.innerHTML=`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b>🔁 Google Drive automatique</b><span id="kwDriveAutoStatus" class="muted" style="font-size:12px">Initialisation…</span></div><div class="controls wrap" style="justify-content:flex-start;margin-top:8px"><button id="kwDriveAutoConnect" class="secondary" type="button">🔐 Activer Drive automatique</button><button id="kwDriveAutoRefresh" class="secondary hidden" type="button">🔄 Renouveler maintenant</button><button id="kwDriveAutoConfig" class="secondary" type="button">⚙️ Serveur</button><button id="kwDriveAutoDisconnect" class="secondary" type="button">Déconnecter auto</button></div><div class="muted" style="font-size:11px;margin-top:6px">Le refresh token reste chiffré sur ton serveur. KaraokeWorld reçoit uniquement des jetons Drive temporaires.</div>`;
    host.appendChild(box);
    $('kwDriveAutoConnect').onclick=startOAuth;
    $('kwDriveAutoRefresh').onclick=()=>refreshAccessToken({quiet:false});
    $('kwDriveAutoConfig').onclick=configureBackend;
    $('kwDriveAutoDisconnect').onclick=disconnect;
    return true;
  }

  function onOAuthMessage(e){
    if(!backendOrigin()||e.origin!==backendOrigin())return;
    if(e.data?.type!=='kw-drive-oauth-complete')return;
    if(e.data.ok){setStatus('✅ Autorisation enregistrée · récupération du premier jeton Drive…');setTimeout(()=>refreshAccessToken({quiet:false}),150)}
    else setStatus('⚠️ '+(e.data?.message||'Autorisation Drive refusée.'),'warn');
  }

  function periodic(){
    if(!backendBase())return;
    const exp=tokenExpiry();
    if(!exp||exp-Date.now()<6*60*1000)refreshAccessToken({quiet:true});
  }
  function boot(){
    ensureUI();
    [300,800,1600,3000,5000].forEach(ms=>setTimeout(()=>{ensureUI();if(ms===800)checkBackend({refreshIfConnected:true})},ms));
    setInterval(()=>{ensureUI();periodic()},60000);
    window.addEventListener('message',onOAuthMessage);
    window.addEventListener('focus',periodic);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)periodic()});
    schedule();
  }

  window.KaraokeWorldDriveOAuth={version:VERSION,installed:true,configure:configureBackend,connect:startOAuth,refresh:()=>refreshAccessToken({quiet:false}),check:checkBackend,disconnect,getBackend:backendBase};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
