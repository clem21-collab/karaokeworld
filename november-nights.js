/* November Nights — présentation de la version principale uniquement. */
(()=>{
  // La version 60 ans embarque l'application principale dans une iframe.
  if(window.self!==window.top)return;

  document.documentElement.classList.add('november-nights');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#0f1118');

  function decorate(){
    const hero=document.getElementById('homeHero');
    if(!hero)return;
    hero.querySelector('.eyebrow').textContent='L’ÉDITION DE NOVEMBRE · 2026';
    const heading=hero.querySelector('h1');
    heading.setAttribute('aria-label','KaraokeWorld — November Nights 🍂');
    heading.innerHTML='<span class="nn-brand">KaraokeWorld —</span><span class="nn-title">November<br>Nights <span class="nn-title-leaf" aria-hidden="true">🍂</span></span>';
    hero.querySelector(':scope > p').textContent='Une ambiance automnale pour vos soirées karaoké';

    const scenery=document.createElement('div');
    scenery.className='nn-scenery';
    scenery.setAttribute('aria-hidden','true');
    scenery.innerHTML='<div class="nn-window"><div class="nn-moon"></div><div class="nn-horizon"></div><div class="nn-orbit"></div><span class="nn-music">♪</span><span class="nn-star">✦</span></div><span class="nn-caption">LES NUITS SONT PLUS BELLES EN MUSIQUE</span><i class="nn-leaf leaf-one"></i><i class="nn-leaf leaf-two"></i><i class="nn-leaf leaf-three"></i><i class="nn-leaf leaf-four"></i>';
    hero.prepend(scenery);

    const settings=document.getElementById('settings');
    const motion=document.createElement('div');
    motion.className='nn-motion-setting';
    const label=document.createElement('label');
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.id='novemberReduceMotion';
    try{checkbox.checked=localStorage.getItem('kw_november_reduce_motion')==='1'}catch(e){}
    function applyMotion(){document.documentElement.classList.toggle('november-still',checkbox.checked)}
    applyMotion();
    checkbox.addEventListener('change',()=>{
      applyMotion();
      try{localStorage.setItem('kw_november_reduce_motion',checkbox.checked?'1':'0')}catch(e){}
    });
    label.append(checkbox,document.createTextNode(' Réduire les animations du thème'));
    const help=document.createElement('p');
    help.className='muted';
    help.textContent='Les feuilles deviennent immobiles. La préférence de réduction des animations de votre appareil est aussi respectée automatiquement.';
    motion.append(label,help);
    settings?.append(motion);

    // Les feuilles n'animent que l'accueil visible et s'arrêtent pendant le chant.
    const stage=document.getElementById('karaokeStage');
    function syncMotion(){
      const home=document.querySelector('.nav[data-page="home"]');
      const singing=stage&&!stage.classList.contains('hidden');
      document.documentElement.classList.toggle('november-paused',document.hidden||!home?.classList.contains('active')||singing);
    }
    const observer=new MutationObserver(syncMotion);
    document.querySelectorAll('.nav[data-page],#karaokeStage').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
    document.addEventListener('visibilitychange',syncMotion);
    syncMotion();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});
  else decorate();
})();
