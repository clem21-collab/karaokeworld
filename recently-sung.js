/* KaraokeWorld — Historique des chansons chantées v1
   Module isolé : mémorise les titres lancés via playTrack() sans modifier le lecteur.
*/
(()=>{
  const KEY='kw_recently_sung_v1', MAX=12;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  const save=a=>localStorage.setItem(KEY,JSON.stringify(a.slice(0,MAX)));
  function remember(t){
    if(!t?.id)return;
    const item={id:t.id,title:t.title||'Sans titre',artist:t.artist||'',emoji:t.emoji||'🎵',at:Date.now()};
    save([item,...load().filter(x=>x.id!==item.id)]); render();
  }
  function render(){
    const host=document.getElementById('kwRecentlySung'); if(!host)return;
    const items=load();
    host.innerHTML=items.length?items.slice(0,6).map(x=>`<article class="home-card" data-recent-id="${esc(x.id)}"><div class="home-emoji">${esc(x.emoji)}</div><b>${esc(x.title)}</b><span>${esc(x.artist)}</span></article>`).join(''):'<div class="home-card empty-card">Les chansons que vous lancez apparaîtront ici.</div>';
    host.querySelectorAll('[data-recent-id]').forEach(el=>el.onclick=()=>{const id=el.dataset.recentId;if(typeof window.playTrack==='function')window.playTrack(id)});
  }
  function mount(){
    if(document.getElementById('recentlySungSection')){render();return}
    const fav=document.getElementById('favoritesSection'), parent=fav?.parentNode;if(!fav||!parent)return;
    const section=document.createElement('div');section.className='home-section';section.id='recentlySungSection';
    section.innerHTML='<div class="row-head"><div><div class="eyebrow">VOTRE HISTORIQUE</div><h2>🕘 Chantés récemment</h2></div><button id="clearRecentlySung" class="secondary" type="button">Effacer</button></div><div id="kwRecentlySung" class="home-shelf"></div>';
    fav.insertAdjacentElement('afterend',section);
    document.getElementById('clearRecentlySung').onclick=()=>{localStorage.removeItem(KEY);render()};render();
  }
  function hook(){
    if(typeof window.playTrack!=='function')return false;
    const original=window.playTrack;if(original.__kwRecentHook)return true;
    function wrapped(id){const t=Array.isArray(window.tracks)?window.tracks.find(x=>x.id===id):null;const out=original.apply(this,arguments);if(t)remember(t);return out}
    wrapped.__kwRecentHook=true;window.playTrack=wrapped;return true;
  }
  window.KWRecentlySung={remember,render,clear:()=>{localStorage.removeItem(KEY);render()}};
  const start=()=>{mount();let tries=0;const timer=setInterval(()=>{if(hook()||++tries>40)clearInterval(timer)},100)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();