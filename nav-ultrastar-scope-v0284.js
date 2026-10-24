/* KaraokeWorld v0.28.4 — Bibliothèque UltraStar visible uniquement dans l'onglet Bibliothèque */
(()=>{
  if(window.KaraokeWorldNavUltraStarScope?.installed)return;
  const VERSION='0.28.4';

  function currentPage(){
    return document.querySelector('.nav[data-page].active,[data-page].active')?.dataset?.page||'home';
  }

  function sync(page=currentPage()){
    const panel=document.getElementById('ultrastarPanel');
    if(!panel)return false;
    panel.classList.toggle('hidden',page!=='library');
    return true;
  }

  function bind(){
    document.querySelectorAll('[data-page]').forEach(btn=>{
      if(btn.dataset.kwUltraStarScopeBound)return;
      btn.dataset.kwUltraStarScopeBound='1';
      btn.addEventListener('click',()=>setTimeout(()=>sync(btn.dataset.page),0));
    });

    const navHost=document.querySelector('aside');
    if(navHost){
      const observer=new MutationObserver(()=>sync());
      observer.observe(navHost,{subtree:true,attributes:true,attributeFilter:['class']});
    }

    sync();
    [250,700,1500,3000].forEach(ms=>setTimeout(()=>{bindButtonsOnly();sync()},ms));
  }

  function bindButtonsOnly(){
    document.querySelectorAll('[data-page]').forEach(btn=>{
      if(btn.dataset.kwUltraStarScopeBound)return;
      btn.dataset.kwUltraStarScopeBound='1';
      btn.addEventListener('click',()=>setTimeout(()=>sync(btn.dataset.page),0));
    });
  }

  window.KaraokeWorldNavUltraStarScope={version:VERSION,installed:true,sync};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();