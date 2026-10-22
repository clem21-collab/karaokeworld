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
