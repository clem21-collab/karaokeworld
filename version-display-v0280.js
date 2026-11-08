/* KaraokeWorld v0.29.3 — affichage de version stable */
(()=>{
  if(window.KaraokeWorldVersionDisplay?.installed)return;
  let birthday=false;
  try{birthday=window.parent!==window&&/\/60ans(?:\/|$)/.test(window.parent.location.pathname)}catch(e){}
  const VERSION=birthday?'0.29.0':(typeof APP_VERSION==='string'?APP_VERSION:'0.29.3');
  const LABEL='BETA · v'+VERSION+' · Catalogue public 🌐';

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
  }

  window.KaraokeWorldVersionDisplay={version:VERSION,installed:true,refresh:install};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();