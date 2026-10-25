/* KaraokeWorld v0.28.9 — affichage de version stable */
(()=>{
  if(window.KaraokeWorldVersionDisplay?.installed)return;
  const VERSION='0.28.9';
  const LABEL='BETA · v0.28.9 · Préparation IA accélérée ⚡';

  function install(){
    const brand=document.querySelector('.brand');
    if(!brand)return false;
    const legacy=brand.querySelector('small');
    if(legacy)legacy.style.display='none';
    let badge=document.getElementById('kwCurrentVersion');
    if(!badge){
      badge=document.createElement('span');
      badge.id='kwCurrentVersion';
      badge.style.cssText='font-size:11px;font-weight:600;opacity:.72;margin-left:7px;white-space:nowrap';
      brand.appendChild(badge);
    }
    badge.textContent=' '+LABEL;
    return true;
  }

  function start(){
    install();
    [250,700,1500,3000,5000].forEach(ms=>setTimeout(install,ms));
    setInterval(install,2000);
  }

  window.KaraokeWorldVersionDisplay={version:VERSION,installed:true,refresh:install};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();