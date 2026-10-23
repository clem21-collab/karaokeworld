/* KaraokeWorld v0.28.0 — expiration Google Drive basée sur le jeton réel */
(()=>{
  if(window.KaraokeWorldDriveTokenExpiry?.installed)return;
  const VERSION='0.28.0';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const EXP_KEY='kw_drive_access_exp_v1';
  const CLIENT_KEY='kw_google_oauth_client_id_v1';
  let lastToken='';
  let busy=false;

  function readToken(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(e){return''}}
  function setExp(ts){try{sessionStorage.setItem(EXP_KEY,String(ts))}catch(e){}}
  function setClient(id){try{if(id)localStorage.setItem(CLIENT_KEY,id)}catch(e){}}

  async function inspect(token){
    if(!token||busy)return false;
    busy=true;
    try{
      const r=await fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(token),{cache:'no-store'});
      if(!r.ok)throw new Error('tokeninfo '+r.status);
      const j=await r.json();
      const sec=Math.max(60,Number(j.expires_in||0));
      // 20 s de marge uniquement pour éviter une requête Drive pendant l'expiration exacte.
      const exp=Date.now()+Math.max(30,sec-20)*1000;
      setExp(exp);
      setClient(j.azp||j.aud||j.audience||j.issued_to||'');
      window.dispatchEvent(new CustomEvent('kw-drive-token-expiry-updated',{detail:{expiresAt:exp,expiresIn:sec,clientId:j.azp||j.aud||j.audience||j.issued_to||''}}));
      const s=document.getElementById('cloudUltraStarStatus');
      if(s&&!/Chanson|Envoi|Préparation|Sauvegarde/i.test(s.textContent||'')){
        const min=Math.max(1,Math.round(sec/60));
        s.textContent=`✅ Google Drive autorisé · jeton valide encore environ ${min} min.`;
      }
      return true;
    }catch(e){
      console.warn('KaraokeWorld : expiration réelle Drive indisponible, conservation de la durée de secours.',e);
      return false;
    }finally{busy=false}
  }

  async function scan(){
    const token=readToken();
    if(!token){lastToken='';return}
    if(token!==lastToken){lastToken=token;await inspect(token)}
  }

  window.addEventListener('kw-drive-token',()=>setTimeout(scan,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
  window.addEventListener('focus',scan);
  setInterval(scan,15000);
  setTimeout(scan,250);

  window.KaraokeWorldDriveTokenExpiry={version:VERSION,installed:true,inspectCurrent:()=>inspect(readToken()),getClientId:()=>{try{return localStorage.getItem(CLIENT_KEY)||''}catch(e){return''}}};
})();
