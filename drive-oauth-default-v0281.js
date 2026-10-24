/* KaraokeWorld v0.28.1 — serveur OAuth Drive par défaut */
(()=>{
  const KEY='kw_drive_oauth_backend_v1';
  const DEFAULT='https://karaokeworld-drive-oauth.onrender.com';
  try{
    const current=String(localStorage.getItem(KEY)||'').trim();
    if(!current)localStorage.setItem(KEY,DEFAULT);
  }catch(e){}
  window.KaraokeWorldDriveOAuthDefault={version:'0.28.1',backend:DEFAULT};
})();
