/* KaraokeWorld — pochettes automatiques v1
   Utilise les miniatures YouTube déjà disponibles et tente une pochette iTunes pour les cartes du catalogue.
*/
(()=>{
 const CACHE_KEY='kw_cover_cache_v1';
 const esc=s=>String(s??'').trim();
 const load=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return{}}};
 const cache=load(); let saveTimer;
 const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}},250)};
 function key(title,artist){return `${esc(title).toLowerCase()}|${esc(artist).toLowerCase()}`}
 function youtubeThumb(root){const img=root?.querySelector('img');if(img?.src && /ytimg|youtube/.test(img.src))return img.src;return''}
 async function lookup(title,artist){const k=key(title,artist);if(cache[k]!==undefined)return cache[k];if(!title)return'';
   try{const term=encodeURIComponent([artist,title].filter(Boolean).join(' '));const r=await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=5`);if(!r.ok)throw 0;const j=await r.json();const wantedTitle=title.toLowerCase();const wantedArtist=(artist||'').toLowerCase();let hit=j.results?.find(x=>x.trackName?.toLowerCase()===wantedTitle && (!wantedArtist||x.artistName?.toLowerCase().includes(wantedArtist)))||j.results?.[0];let url=hit?.artworkUrl100||'';if(url)url=url.replace(/100x100bb/g,'600x600bb');cache[k]=url;save();return url}catch{cache[k]='';save();return''}}
 function text(root){const title=esc(root.querySelector('h3,b')?.textContent);let artist=esc(root.querySelector('p,span')?.textContent);artist=artist.split(' · ')[0].replace(/^⭐\s*/,'').trim();return{title,artist}}
 function apply(root,url){if(!root||!url||root.dataset.kwCover===url)return;let slot=root.querySelector('.cover,.home-emoji,.mini');if(!slot)return;slot.dataset.fallback=slot.textContent;slot.textContent='';slot.style.backgroundImage=`linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45)),url("${url.replace(/"/g,'%22')}")`;slot.style.backgroundSize='cover';slot.style.backgroundPosition='center';slot.style.color='transparent';slot.setAttribute('aria-label','Pochette de la chanson');root.dataset.kwCover=url}
 async function enhance(root){if(!root||root.dataset.kwCoverBusy)return;root.dataset.kwCoverBusy='1';const yt=youtubeThumb(root);if(yt){apply(root,yt);return}const {title,artist}=text(root);if(!title)return;const url=await lookup(title,artist);if(url)apply(root,url)}
 function scan(){document.querySelectorAll('.track,.home-card,.queue-item,.youtube-result').forEach(enhance)}
 const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(scan,120)});
 function start(){scan();obs.observe(document.body,{childList:true,subtree:true});setInterval(scan,5000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 window.KWSongCovers={refresh:scan,clearCache:()=>{localStorage.removeItem(CACHE_KEY);location.reload()}};
})();