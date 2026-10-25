/* KaraokeWorld — Track matching + real sync test v0.5 */
(()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const fmt=s=>Number.isFinite(Number(s))?`${Math.floor(Number(s)/60)}:${String(Math.round(Number(s)%60)).padStart(2,'0')}`:'—';
 let selected=null,lines=[],yt=null,timer=null;
 const providerName=x=>x==='lrclib'?'LRCLIB':x==='synclrc'?'SyncLRC':x==='liriqo'?'LiriQo':x||'Source inconnue';
 function badge(m){return m?.confidence==='exact'?'🟢 Correspondance exacte':m?.confidence==='probable'?'🟠 Correspondance probable':'🔴 Correspondance non fiable'}
 function sourceBadge(s){
   const name=providerName(s?.provider),st=s?.status||'error';
   if(st==='ok')return `<article class="lyric-result"><h3>🟢 ${esc(name)} disponible</h3>${s?.results?.length?`<p>${s.results.length} candidat${s.results.length>1?'s':''} trouvé${s.results.length>1?'s':''}</p>`:''}</article>`;
   if(st==='no-match')return `<article class="lyric-result"><h3>⚪ ${esc(name)} : aucun résultat</h3></article>`;
   if(st==='temporarily-unavailable')return `<article class="lyric-result"><h3>🟠 ${esc(name)} temporairement indisponible</h3></article>`;
   return `<article class="lyric-result"><h3>🔴 ${esc(name)} indisponible</h3></article>`;
 }
 function parseLrc(text){return String(text||'').split(/\r?\n/).flatMap(row=>{const times=[...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];const lyric=row.replace(/\[[^\]]+\]/g,'').trim();return times.map(m=>({time:Number(m[1])*60+Number(m[2]),text:lyric}))}).filter(x=>Number.isFinite(x.time)&&x.text).sort((a,b)=>a.time-b.time)}
 function inject(){
   const s=$('lyrics-search');if(!s||$('kwMatchTest'))return;
   const b=document.createElement('div');b.id='kwMatchTest';
   b.innerHTML=`<hr><div class="row-head"><h3>🧪 Nouveau moteur multi-sources</h3><span class="status">LRCLIB · SyncLRC · LiriQo</span></div><p class="muted">KaraokeWorld teste LRCLIB en priorité puis bascule automatiquement sur SyncLRC et LiriQo si nécessaire.</p><div class="online-search"><input id="kwMatchTitle" placeholder="Titre exact…"><input id="kwMatchArtist" placeholder="Artiste…"><input id="kwMatchDuration" type="number" min="0" step="0.1" placeholder="Durée en secondes"><button id="kwMatchRun">Tester</button></div><div id="kwMatchResults" class="online-results"><p class="empty">Exemple : Stolen Car · Mylène Farmer feat. Sting · 246.62 s</p></div>`;
   s.appendChild(b);$('kwMatchRun').onclick=run;$('kwLoadVideo')?.addEventListener('click',loadVideo)
 }
 async function run(){
   const out=$('kwMatchResults'),track={title:$('kwMatchTitle').value.trim(),artist:$('kwMatchArtist').value.trim(),duration:Number($('kwMatchDuration').value)||undefined};if(!track.title)return;
   out.innerHTML='<p class="empty">Recherche multi-sources en cours…</p>';
   try{
     const r=await KWTrackIdentity.searchLyricsMultiSource(track),rows=r.results||[];
     let html=(r.sources||[]).map(sourceBadge).join('');
     if(r.usedProvider)html+=`<article class="lyric-result"><h3>✅ Source retenue : ${esc(providerName(r.usedProvider))}</h3></article>`;
     const usable=rows.filter(x=>x.syncedLyrics);
     if(!usable.length){out.innerHTML=html+'<p class="empty">Aucune parole synchronisée fiable trouvée sur les trois sources.</p>';return}
     const shown=usable.slice(0,10);
     out.innerHTML=html+shown.map((x,i)=>`<article class="lyric-result"><h3>${esc(x.title)}</h3><p>${esc(x.artist)}${x.album?' · '+esc(x.album):''}</p><p><b>${badge(x.match)}</b> · score ${x.match.score} · durée ${fmt(x.duration)}</p><p>✓ Paroles synchronisées · source <b>${esc(providerName(x.provider))}</b>${x.providerDetail?` · ${esc(x.providerDetail)}`:''}${x.syncLevel?` · synchro ${esc(x.syncLevel)}`:''}</p>${x.match.confidence==='weak'?'<button disabled>Refusé automatiquement</button>':`<button data-use="${i}">Utiliser ces paroles pour le test</button>`}</article>`).join('');
     shown.forEach((x,i)=>{const b=out.querySelector(`[data-use="${i}"]`);if(b)b.onclick=()=>selectCandidate(x,b)})
   }catch(e){out.innerHTML=`<p class="empty">Erreur : ${esc(e.message)}</p>`}
 }
 function selectCandidate(x,b){selected=x;lines=parseLrc(x.syncedLyrics);document.querySelectorAll('[data-use]').forEach(z=>z.textContent='Utiliser ces paroles pour le test');b.textContent='✓ Paroles sélectionnées';$('kwSyncInfo').textContent=`${x.title} — ${x.artist} · ${lines.length} lignes synchronisées · source ${providerName(x.provider)}${x.providerDetail?' / '+x.providerDetail:''}`;$('kwLiveLyrics').innerHTML='<div class="artist">Paroles prêtes</div><div class="highlight">Charge la vidéo puis lance la lecture ▶</div>'}
 function videoId(v){try{const u=new URL(v);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1);return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()}catch{return v.trim()}}
 function loadVideo(){const id=videoId($('kwYoutubeUrl').value);if(!id)return;if(!window.YT?.Player){$('kwSyncInfo').textContent='YouTube se charge encore. Réessaie dans quelques secondes.';return}if(yt?.destroy)yt.destroy();yt=new YT.Player('kwVideoHost',{videoId:id,playerVars:{playsinline:1},events:{onReady:()=>{$('kwSyncInfo').textContent=selected?'Vidéo prête. Lance ▶ pour vérifier la synchronisation.':'Vidéo prête. Choisis maintenant un candidat de paroles.'},onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING)startTick();else stopTick()}}})}
 function startTick(){stopTick();timer=setInterval(update,100)}
 function stopTick(){if(timer)clearInterval(timer);timer=null}
 function update(){if(!yt||!lines.length)return;const t=yt.getCurrentTime();let i=-1;for(let n=0;n<lines.length;n++){if(lines[n].time<=t)i=n;else break}const prev=i>0?lines[i-1]?.text:'',cur=i>=0?lines[i]?.text:'♪ Intro ♪',next=lines[i+1]?.text||'';$('kwLiveLyrics').innerHTML=`<div class="artist">${esc(prev)}</div><div class="highlight">${esc(cur)}</div><div class="artist">${esc(next)}</div>`;$('kwSyncInfo').textContent=`Vidéo ${fmt(t)} · ligne LRC ${i>=0?fmt(lines[i].time):'—'} · ${selected?.title||''}`}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject()
})();
