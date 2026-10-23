/* KaraokeWorld — historique local des chansons lancées */
(()=>{const KEY='kw_recently_sung_v1',MAX=12,$=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}},save=a=>localStorage.setItem(KEY,JSON.stringify(a.slice(0,MAX)));
function infoFor(id){const el=document.querySelector(`[onclick*="playTrack('${CSS.escape(id)}')"]`);if(el){const card=el.closest('.track,.home-card,.queue-item');if(card){const title=card.querySelector('h3,b')?.textContent?.trim()||id;const p=card.querySelector('p,span')?.textContent?.trim()||'';const artist=p.split(' · ')[0];return{id,title,artist,emoji:card.querySelector('.cover,.home-emoji,.mini')?.textContent?.trim()||'🎵'}}}return{id,title:id,artist:'',emoji:'🎵'}}
function remember(id){const t=infoFor(id),item={...t,at:Date.now()};save([item,...load().filter(x=>x.id!==id)]);render()}
function render(){const host=$('kwRecentlySung');if(!host)return;const a=load();host.innerHTML=a.length?a.slice(0,6).map(x=>`<article class="home-card" data-r="${esc(x.id)}"><div class="home-emoji">${esc(x.emoji)}</div><b>${esc(x.title)}</b><span>${esc(x.artist)}</span></article>`).join(''):'<div class="home-card empty-card">Les chansons que tu lances apparaîtront ici.</div>';host.querySelectorAll('[data-r]').forEach(e=>e.onclick=()=>window.playTrack?.(e.dataset.r))}
function mount(){const fav=$('favoritesSection');if(!fav||$('recentlySungSection'))return;const s=document.createElement('div');s.className='home-section';s.id='recentlySungSection';s.innerHTML='<div class="row-head"><div><div class="eyebrow">VOTRE HISTORIQUE</div><h2>🕘 Chantés récemment</h2></div><button id="clearRecentlySung" class="secondary" type="button">Effacer</button></div><div id="kwRecentlySung" class="home-shelf"></div>';fav.after(s);$('clearRecentlySung').onclick=()=>{localStorage.removeItem(KEY);render()};render()}
function hook(){if(typeof window.playTrack!=='function')return false;const original=window.playTrack;if(original.__recent)return true;const wrapped=function(id){const out=original.apply(this,arguments);remember(id);return out};wrapped.__recent=true;window.playTrack=wrapped;return true}
function start(){mount();let n=0,t=setInterval(()=>{if(hook()||++n>50)clearInterval(t)},100)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();window.KWRecentlySung={render,clear:()=>{localStorage.removeItem(KEY);render()}}})();

/* v0.26.6 — chargeur des extensions UltraStar/cloud/catalogue public */
(()=>{
  const addons=['./video-preconvert-v0261.js','./cloud-ultrastar-v0266.js','./public-starter-v0266.js'];
  function fixCopy(){
    const note=document.querySelector('#cloudSignedOut .muted');
    if(note)note.textContent='La clé API YouTube reste locale. Les fichiers audio/vidéo ne sont envoyés dans le cloud que si tu utilises volontairement « Bibliothèque UltraStar en ligne ».';
    const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.26.6 · UltraStar 🎤';
  }
  function load(i=0){
    if(i>=addons.length){fixCopy();return}
    const src=addons[i];
    if(document.querySelector(`script[data-kw-addon="${src}"]`)){load(i+1);return}
    const s=document.createElement('script');s.src=src+'?v=0266';s.async=false;s.dataset.kwAddon=src;
    s.onload=()=>load(i+1);s.onerror=()=>{console.warn('Extension KaraokeWorld non chargée',src);load(i+1)};
    document.body.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{fixCopy();load()},{once:true});else{fixCopy();load()}
})();