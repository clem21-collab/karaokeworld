// KaraokeWorld v0.25.5 — boutons de disposition accessibles en paroles seules / plein écran
(()=>{
  function syncFallbackActive(){
    const stage=document.getElementById('karaokeStage'); if(!stage)return;
    const layout=stage.classList.contains('layout-100')?'100':stage.classList.contains('layout-80')?'80':'72';
    document.querySelectorAll('.stage-layout-fallback').forEach(b=>b.classList.toggle('active',b.dataset.layout===layout));
  }
  function bind(){
    const stage=document.getElementById('karaokeStage'); if(!stage)return;
    document.querySelectorAll('.stage-layout-fallback').forEach(b=>{
      b.onclick=()=>{
        const original=document.querySelector(`.stage-layout[data-layout="${b.dataset.layout}"]`);
        if(original) original.click();
        else {
          stage.classList.remove('layout-80','layout-100');
          if(b.dataset.layout==='80') stage.classList.add('layout-80');
          if(b.dataset.layout==='100') stage.classList.add('layout-100');
        }
        syncFallbackActive();
      };
    });
    const quit=document.getElementById('exitFullscreenFallback');
    if(quit) quit.onclick=()=>document.getElementById('exitFullscreen')?.click();
    new MutationObserver(syncFallbackActive).observe(stage,{attributes:true,attributeFilter:['class']});
    syncFallbackActive();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();

// v0.26.7 — le moteur de conversion est chargé par le chargeur principal v0.26.6/0.26.7.
// Ne plus le charger ici : deux instances créaient deux files de conversion concurrentes.
(()=>{
  function loadFix(){
    if(document.querySelector('script[data-kw-v0267]'))return;
    const s=document.createElement('script');
    s.src='./hotfix-v0267.js?v=0267';
    s.async=false;
    s.dataset.kwV0267='1';
    document.body.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadFix);else loadFix();
})();
