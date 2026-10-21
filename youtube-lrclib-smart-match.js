/* KaraokeWorld Smart Match v0.23.2 TEST — exact LRCLIB selection */
(()=>{
const $=id=>document.getElementById(id),fmt=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const sim=(a,b)=>{let A=new Set(norm(a).split(/\W+/).filter(x=>x.length>1)),B=new Set(norm(b).split(/\W+/).filter(x=>x.length>1)),n=0;A.forEach(x=>B.has(x)&&n++);return n/Math.max(A.size,B.size,1)};
const iso=s=>{let m=String(s||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);return m?(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0):0};
async function lrclib(t,a){let r=await fetch("https://lrclib.net/api/search?track_name="+encodeURIComponent(t)+"&artist_name="+encodeURIComponent(a),{headers:{"Lrclib-Client":"KaraokeWorld SmartMatch v0.23.2"}});if(!r.ok)throw Error("LRCLIB indisponible");return(await r.json()).filter(x=>x.syncedLyrics&&x.duration).sort((x,y)=>(sim(y.trackName,t)+sim(y.artistName,a))-(sim(x.trackName,t)+sim(x.artistName,a)))}
async function ys(q,key){let p=new URLSearchParams({part:"snippet",type:"video",maxResults:"10",q,videoCategoryId:"10",videoEmbeddable:"true",regionCode:"FR",key}),r=await fetch("https://www.googleapis.com/youtube/v3/search?"+p),j=await r.json();if(!r.ok)throw Error(j?.error?.message||"Erreur YouTube");return j.items||[]}
async function vd(items,key){let ids=[...new Set(items.map(x=>x.id?.videoId).filter(Boolean))],p=new URLSearchParams({part:"contentDetails,snippet",id:ids.join(","),key}),r=await fetch("https://www.googleapis.com/youtube/v3/videos?"+p),j=await r.json();if(!r.ok)throw Error(j?.error?.message||"Erreur YouTube");return j.items||[]}
async function run(t,a,key){let L=await lrclib(t,a);if(!L.length)throw Error("Aucune parole synchronisée LRCLIB trouvée");let hit=L[0],items=[...await ys(`${a} - ${t} Topic`,key),...await ys(`${a} - ${t} Official Audio`,key)],D=await vd(items,key),target=Number(hit.duration);let ranked=D.map(v=>{let d=iso(v.contentDetails?.duration),diff=Math.abs(d-target),sn=v.snippet||{},s=Math.round(sim(sn.title,t)*45)+Math.round(Math.max(sim(sn.title,a),sim(sn.channelTitle,a))*35);if(/topic/i.test(sn.channelTitle))s+=28;if(/official audio|audio officiel/i.test(sn.title))s+=24;if(/live|concert|remix|cover|karaoke|instrumental/i.test(sn.title))s-=30;if(diff<=1)s+=55;else if(diff<=2)s+=48;else if(diff<=4)s+=35;else if(diff<=7)s+=18;else if(diff>20)s-=40;return{v,d,diff,s}}).sort((x,y)=>y.s-x.s);return{hit,ranked}}
async function loadExactLyrics(hit){
 // Cancel/overwrite any bad YouTube-derived identification with the exact LRCLIB identity.
 const tq=$("lyricsQuery"), ar=$("lyricsArtist");
 if(tq)tq.value=hit.trackName||""; if(ar)ar.value=hit.artistName||"";
 const out=$("lyricsResults");
 if(out)out.innerHTML='<p class="empty">Chargement des paroles LRCLIB exactes du Smart Match…</p>';
 // Find the real existing search button by its visible text.
 const btn=[...document.querySelectorAll("button")].find(b=>/rechercher des paroles/i.test(b.textContent||""));
 if(!btn)throw Error("Bouton de recherche des paroles introuvable.");
 btn.click();
 // Wait for results, then choose the closest exact result by visible title/artist/duration.
 let tries=0;
 const timer=setInterval(()=>{
   tries++;
   const cards=[...document.querySelectorAll("#lyricsResults .lyric-result")];
   if(cards.length){
     clearInterval(timer);
     const wantedT=norm(hit.trackName),wantedA=norm(hit.artistName),wantedD=fmt(Number(hit.duration||0));
     let best=null,bestScore=-1;
     for(const c of cards){
       const text=norm(c.textContent),raw=c.textContent||"";
       let s=(text.includes(wantedT)?4:0)+(wantedA&&text.includes(wantedA)?4:0)+(raw.includes(wantedD)?3:0);
       if(s>bestScore){bestScore=s;best=c}
     }
     const use=best?.querySelector("button");
     if(use&&bestScore>=7)use.click();
     else if(out)out.insertAdjacentHTML("afterbegin",'<p class="empty">⚠️ La version LRCLIB exacte n’a pas été retrouvée dans la liste. Ne sélectionne pas une autre version.</p>');
   } else if(tries>30){clearInterval(timer)}
 },200);
}
async function choose(video,hit,title,artist){
 // First load YouTube.
 const input=$("youtubeUrl");
 if(input){input.value="https://www.youtube.com/watch?v="+video.id;$("loadYoutube")?.click()}
 // Then, after app.js starts its automatic identification, overwrite it with the exact
 // title/artist and invoke the normal LRCLIB UI. This prevents "Vidéo YouTube"/Chris Cornell.
 setTimeout(()=>loadExactLyrics(hit).catch(e=>{if($("lyricsResults"))$("lyricsResults").innerHTML='<p class="empty">Erreur Smart Match : '+e.message+'</p>'}),650);
}
function install(){let host=$("online");if(!host||$("kwSmartMatch"))return;let p=document.createElement("div");p.id="kwSmartMatch";p.className="panel online-panel";p.innerHTML='<div class="row-head"><div><div class="eyebrow">TEST v0.23.2</div><h2>🎯 Smart Match YouTube ↔ LRCLIB</h2></div></div><p class="muted">Verrouille le titre, l’artiste et la durée LRCLIB avant de charger les paroles.</p><div class="online-search"><input id="kwMT" placeholder="Titre"><input id="kwMA" placeholder="Artiste"><button id="kwMG">Analyser</button></div><div id="kwMS" class="muted"></div><div id="kwMR" class="online-results"></div>';host.prepend(p);
$("kwMG").onclick=async()=>{let t=$("kwMT").value.trim(),a=$("kwMA").value.trim(),key=$("youtubeApiKey")?.value.trim()||localStorage.getItem("karaokeworld_youtube_api_key_v1")||"";if(!t||!a)return $("kwMS").textContent="Entre le titre et l’artiste.";if(!key)return $("kwMS").textContent="Enregistre d’abord ta clé YouTube Data API.";$("kwMS").textContent="Analyse LRCLIB + YouTube…";try{let r=await run(t,a,key),top=r.ranked.slice(0,5);$("kwMS").textContent=`LRCLIB ${fmt(Number(r.hit.duration))} · ${r.hit.trackName} — ${r.hit.artistName}`;$("kwMR").innerHTML=top.map((x,i)=>`<article class="lyric-result"><h3>${i===0?"🏆 ":""}${x.v.snippet?.title||""}</h3><p>${x.v.snippet?.channelTitle||""} · ${fmt(x.d)} · écart ${x.diff.toFixed(1)} s · score ${x.s}</p><button data-id="${x.v.id}">▶ Tester avec le LRC ${fmt(Number(r.hit.duration))}</button></article>`).join("");document.querySelectorAll("#kwMR [data-id]").forEach(b=>b.onclick=()=>{let x=top.find(y=>y.v.id===b.dataset.id);if(x)choose(x.v,r.hit,t,a)})}catch(e){$("kwMS").textContent="Erreur : "+e.message}}}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",install):install();
})();