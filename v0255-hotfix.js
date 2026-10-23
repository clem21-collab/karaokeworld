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

// v0.28.0 — chargeur des correctifs complémentaires.
// Le moteur vidéo principal reste chargé par recently-sung.js pour éviter deux files concurrentes.
(()=>{
  const addons=[
    {src:'./hotfix-v0267.js?v=0280b',key:'hotfix'},
    {src:'./video-once-v0272.js?v=0280b',key:'video-once'},
    {src:'./library-dedupe-v0275.js?v=0280b',key:'dedupe'},
    {src:'./vocal-separation-v0276.js?v=0280b',key:'vocals'},
    {src:'./vocal-button-fix-v0277.js?v=0280b',key:'voice-button-fix'},
    {src:'./vocal-loudness-v0278.js?v=0280b',key:'voice-loudness'},
    {src:'./drive-token-expiry-v0280.js?v=0280b',key:'drive-token-expiry'},
    {src:'./version-display-v0280.js?v=0280b',key:'version-display'}
  ];
  function load(i=0){
    if(i>=addons.length)return;
    const a=addons[i],sel=`script[data-kw-extra="${a.key}"]`;
    if(document.querySelector(sel)){load(i+1);return}
    const s=document.createElement('script');s.src=a.src;s.async=false;s.dataset.kwExtra=a.key;
    s.onload=()=>load(i+1);s.onerror=()=>{console.warn('Extension KaraokeWorld non chargée',a.src);load(i+1)};
    document.body.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>load(),{once:true});else load();
})();
