/* KaraokeWorld v0.28.3 — pochettes multi-sources + jaquette générée de secours */
(()=>{
 const CACHE_KEY='kw_cover_cache_v3';
 const OLD_CACHE_KEYS=['kw_cover_cache_v2','kw_cover_cache_v1'];
 const COVER_BACKEND='https://karaokeworld-drive-oauth.onrender.com';
 const NEGATIVE_TTL=30*60*1000;
 const POSITIVE_TTL=30*24*60*60*1000;
 const MAX_CONCURRENT=4;
 const esc=s=>String(s??'').trim();
 const norm=s=>esc(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[’']/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
 const cleanTitle=s=>esc(s).replace(/\s*[\(\[].*?[\)\]]\s*/g,' ').replace(/\s+(feat\.?|ft\.?|featuring)\s+.+$/i,' ').replace(/\s+/g,' ').trim();
 const cleanArtist=s=>esc(s).replace(/\s+(feat\.?|ft\.?|featuring|with|x)\s+.+$/i,' ').replace(/\s+/g,' ').trim();
 function load(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return{}}}
 const cache=load();
 try{
   for(const oldKey of OLD_CACHE_KEYS){
     const old=JSON.parse(localStorage.getItem(oldKey)||'{}');
     for(const [k,v] of Object.entries(old||{})){
       if(cache[k]!==undefined)continue;
       if(typeof v==='string'&&v)cache[k]={url:v,ts:Date.now()};
       else if(v&&typeof v==='object'&&v.url)cache[k]={url:v.url,ts:Number(v.ts)||Date.now()};
     }
   }
 }catch{}
 let saveTimer;
 const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}},250)};
 function key(title,artist){return `${norm(title)}|${norm(artist)}`}
 function cachedValue(k){const v=cache[k];if(v===undefined)return null;if(typeof v==='string')return v?{hit:true,url:v}:{hit:false,url:''};const age=Date.now()-Number(v?.ts||0);if(v?.url&&age<POSITIVE_TTL)return{hit:true,url:v.url};if(!v?.url&&age<NEGATIVE_TTL)return{hit:true,url:''};return null}
 function putCache(k,url){cache[k]={url:url||'',ts:Date.now()};save()}
 function youtubeThumb(root){const img=root?.querySelector('img');if(img?.src && /ytimg|youtube/.test(img.src))return img.src;return''}
 function similarity(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .82;const aw=new Set(a.split(' ')),bw=new Set(b.split(' '));let common=0;for(const w of aw)if(bw.has(w))common++;return common/Math.max(aw.size,bw.size)}
 function scoreResult(x,title,artist){const t=similarity(x?.trackName||'',title),a=artist?similarity(x?.artistName||'',artist):.7;let s=t*.72+a*.28;if(norm(x?.trackName||'')===norm(title))s+=.2;if(artist&&norm(x?.artistName||'')===norm(artist))s+=.12;return s}
 let active=0;const waiters=[];
 function queued(task){return new Promise((resolve,reject)=>{const run=()=>{active++;Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;waiters.shift()?.()})};if(active<MAX_CONCURRENT)run();else waiters.push(run)})}
 async function itunesSearch(term,title,artist,country='FR'){
   const u=new URL('https://itunes.apple.com/search');u.searchParams.set('term',term);u.searchParams.set('country',country);u.searchParams.set('media','music');u.searchParams.set('entity','musicTrack');u.searchParams.set('limit','25');
   const r=await queued(()=>fetch(u,{cache:'no-store'}));if(!r.ok)throw new Error('iTunes '+r.status);const j=await r.json();const list=Array.isArray(j.results)?j.results:[];
   let best=null,bestScore=0;for(const x of list){const s=scoreResult(x,title,artist);if(s>bestScore){best=x;bestScore=s}}
   if(!best||bestScore<.53)return'';let url=best.artworkUrl100||'';if(url)url=url.replace(/100x100bb/g,'600x600bb');return url
 }
 async function backendSearch(title,artist){
   const u=new URL(COVER_BACKEND+'/covers/search');u.searchParams.set('title',title);if(artist)u.searchParams.set('artist',artist);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
   try{const r=await queued(()=>fetch(u,{cache:'no-store',signal:controller.signal}));if(!r.ok)return{ok:false,url:''};const j=await r.json();return{ok:true,url:j?.url||'',source:j?.source||''}}
   catch(e){console.warn('KaraokeWorld pochette serveur',e);return{ok:false,url:''}}
   finally{clearTimeout(timer)}
 }
 const pending=new Map();
 async function lookup(title,artist){
   const k=key(title,artist),cv=cachedValue(k);if(cv?.hit)return cv.url;if(pending.has(k))return pending.get(k);if(!title)return'';
   const p=(async()=>{
     const ct=cleanTitle(title)||title,ca=cleanArtist(artist)||artist;const queries=[];const add=q=>{q=esc(q);if(q&&!queries.includes(q))queries.push(q)};
     add([ca,ct].filter(Boolean).join(' '));add([artist,title].filter(Boolean).join(' '));add(ct);if(ca)add(`${ct} ${ca}`);
     let url='';
     try{
       for(const q of queries.slice(0,3)){url=await itunesSearch(q,ct,ca,'FR');if(url)break}
       if(!url&&queries[0])url=await itunesSearch(queries[0],ct,ca,'US');
     }catch(e){console.warn('KaraokeWorld pochette iTunes',e)}
     if(!url){const fb=await backendSearch(ct,ca);if(fb.url)url=fb.url;else if(!fb.ok)return''}
     putCache(k,url);return url
   })().finally(()=>pending.delete(k));pending.set(k,p);return p
 }
 function text(root){const title=esc(root.querySelector('h3,b')?.textContent);let artist=esc(root.querySelector('p,span')?.textContent);artist=artist.split(' · ')[0].replace(/^⭐\s*/,'').trim();return{title,artist}}
 function xml(s){return esc(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
 function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
 function splitTitle(s){
   const words=esc(s).split(/\s+/),lines=['',''];
   for(const word of words){const i=!lines[0]||lines[0].length<20?0:1;if((lines[i]+' '+word).trim().length<=26||!lines[i])lines[i]=(lines[i]+' '+word).trim();else if(i===0)lines[1]=word;else{lines[1]=(lines[1]+'…').slice(0,27);break}}
   return lines.filter(Boolean)
 }
 function generatedCover(title,artist){
   const seed=hash(`${title}|${artist}`),h1=seed%360,h2=(h1+38+(seed%52))%360,lines=splitTitle(title);const a=esc(artist||'KaraokeWorld').slice(0,34);
   const titleSvg=lines.map((line,i)=>`<text x="50%" y="${315+i*64}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="48" font-weight="700">${xml(line)}</text>`).join('');
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${h1} 52% 24%)"/><stop offset="1" stop-color="hsl(${h2} 65% 10%)"/></linearGradient><radialGradient id="r"><stop stop-color="rgba(255,255,255,.19)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect width="600" height="600" rx="28" fill="url(#g)"/><circle cx="480" cy="110" r="220" fill="url(#r)"/><text x="50%" y="175" text-anchor="middle" font-family="Arial,sans-serif" font-size="92">🎤</text>${titleSvg}<text x="50%" y="475" text-anchor="middle" fill="rgba(255,255,255,.78)" font-family="Arial,sans-serif" font-size="29">${xml(a)}</text><text x="50%" y="545" text-anchor="middle" fill="rgba(255,255,255,.42)" font-family="Arial,sans-serif" font-size="19" letter-spacing="3">KARAOKEWORLD</text></svg>`;
   return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
 }
 function apply(root,url,generated=false){if(!root||!url||root.dataset.kwCover===url)return;let slot=root.querySelector('.cover,.home-emoji,.mini');if(!slot)return;slot.dataset.fallback=slot.dataset.fallback||slot.textContent;slot.textContent='';slot.style.backgroundImage=`linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45)),url("${url.replace(/"/g,'%22')}")`;slot.style.backgroundSize='cover';slot.style.backgroundPosition='center';slot.style.color='transparent';slot.setAttribute('aria-label',generated?'Jaquette KaraokeWorld générée automatiquement':'Pochette de la chanson');root.dataset.kwCover=url;root.dataset.kwCoverGenerated=generated?'1':'0'}
 async function enhance(root){
   if(!root||root.dataset.kwCoverBusy==='1')return;root.dataset.kwCoverBusy='1';
   try{
     const yt=youtubeThumb(root);if(yt){apply(root,yt,false);return}
     const {title,artist}=text(root);if(!title)return;
     const url=await lookup(title,artist);if(url)apply(root,url,false);else apply(root,generatedCover(title,artist),true)
   }finally{root.dataset.kwCoverBusy='0'}
 }
 function scanCovers(){document.querySelectorAll('.track,.home-card,.queue-item,.youtube-result').forEach(enhance)}

 function deleteDBTrack(id){return new Promise((resolve,reject)=>{const req=indexedDB.open('karaokeworld_db',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}}})}
 function cleanup(id){
   try{const a=JSON.parse(localStorage.getItem('kw_favorites')||'[]');localStorage.setItem('kw_favorites',JSON.stringify(a.filter(x=>x!==id)))}catch{}
   try{const a=JSON.parse(localStorage.getItem('kw_playlists')||'[]');for(const p of a)p.trackIds=(p.trackIds||[]).filter(x=>x!==id);localStorage.setItem('kw_playlists',JSON.stringify(a));const cur=localStorage.getItem('kw_current_playlist');const p=a.find(x=>x.id===cur)||a[0];localStorage.setItem('kw_queue',JSON.stringify(p?.trackIds||[]))}catch{}
   try{const a=JSON.parse(localStorage.getItem('kw_recently_sung_v1')||'[]');localStorage.setItem('kw_recently_sung_v1',JSON.stringify(a.filter(x=>x.id!==id)))}catch{}
 }
 async function removeTrack(id,title){
   if(!confirm(`Supprimer « ${title} » de la bibliothèque ?\n\nLe fichier sera retiré de KaraokeWorld sur cet appareil.`))return;
   try{await deleteDBTrack(id);cleanup(id);location.reload()}catch(e){alert('Impossible de supprimer ce morceau : '+(e?.message||e))}
 }
 function scanDeleteButtons(){
   document.querySelectorAll('.track').forEach(card=>{
     if(card.querySelector('.kw-delete-track'))return;
     const play=card.querySelector('button[onclick*="playTrack"]');if(!play)return;
     const m=(play.getAttribute('onclick')||'').match(/playTrack\(['"]([^'"]+)['"]\)/);
     const id=m?.[1];if(!id||id.startsWith('demo'))return;
     const actions=card.querySelector('.actions');if(!actions)return;
     const title=card.querySelector('h3')?.textContent?.trim()||'ce morceau';
     const b=document.createElement('button');b.type='button';b.className='secondary kw-delete-track';b.textContent='🗑️ Supprimer';b.title='Supprimer ce morceau de la bibliothèque';
     b.onclick=e=>{e.preventDefault();e.stopPropagation();removeTrack(id,title)};
     actions.appendChild(b);
   });
 }
 function scan(){scanCovers();scanDeleteButtons()}
 const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(scan,120)});
 function start(){scan();obs.observe(document.body,{childList:true,subtree:true});setInterval(scan,5000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 window.KWSongCovers={version:'0.28.3',refresh:scanCovers,clearCache:()=>{localStorage.removeItem(CACHE_KEY);for(const k of OLD_CACHE_KEYS)localStorage.removeItem(k);location.reload()}};
})();