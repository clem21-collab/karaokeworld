const $=id=>document.getElementById(id);
const DB_NAME="karaokeworld_db", DB_VERSION=1, STORE="tracks";
let db=null, tracks=[], queueIds=[], playlists=[], currentPlaylistId="default", favorites=[], currentId=null, activeGenre="Tous", lrc=[], micStream=null, audioCtx=null, analyser=null, raf=0, installPrompt=null, youtubeMode="karaoke", ytPlayer=null, ytTimer=0, lyricOffset=0, youtubeQuery="";
const demo=[
["Dernière danse","Indila","Variété française","🌙"],["Believer","Imagine Dragons","Rock","⚡"],["Someone Like You","Adele","Pop","💜"],["Shape of You","Ed Sheeran","Pop","🎸"],["J'irai où tu iras","Céline Dion","Variété française","🌟"],["Bohemian Rhapsody","Queen","Rock","👑"],["Alors on danse","Stromae","Rap","🎧"],["Fly Me to the Moon","Frank Sinatra","Jazz","🌃"]
].map((x,i)=>({id:"demo"+i,title:x[0],artist:x[1],genre:x[2],emoji:x[3],kind:"demo",url:"",created:i}));
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function tx(mode="readonly"){return db.transaction(STORE,mode).objectStore(STORE)}
function saveTrack(t){return new Promise((res,rej)=>{const r=tx("readwrite").put(t);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function getAll(){return new Promise((res,rej)=>{const r=tx().getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function deleteAll(){return new Promise((res,rej)=>{const r=tx("readwrite").clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function currentPlaylist(){return playlists.find(p=>p.id===currentPlaylistId)||playlists[0]}
function syncQueue(){const p=currentPlaylist();queueIds=p?p.trackIds:[];localStorage.setItem("kw_playlists",JSON.stringify(playlists));localStorage.setItem("kw_current_playlist",currentPlaylistId);localStorage.setItem("kw_queue",JSON.stringify(queueIds))}
function visible(){const q=$("query").value.toLowerCase().trim();let arr=tracks.filter(t=>(activeGenre==="Tous"||t.genre===activeGenre)&&(!$("favoritesOnly").checked||favorites.includes(t.id))&&(!q||(t.title+" "+t.artist+" "+t.genre).toLowerCase().includes(q)));const sort=$("sort").value;if(sort==="artist")arr.sort((a,b)=>a.artist.localeCompare(b.artist,"fr"));else if(sort==="recent")arr.sort((a,b)=>(b.created||0)-(a.created||0));else arr.sort((a,b)=>a.title.localeCompare(b.title,"fr"));return arr}
function drawTracks(){const arr=visible();$("resultCount").textContent=`${arr.length} titre${arr.length!==1?"s":""}`;$("tracks").innerHTML=arr.length?arr.map(t=>`<article class="track"><div class="track-top"><div class="cover" style="flex:1">${t.emoji||"🎵"}</div><button class="favorite ${favorites.includes(t.id)?"on":""}" title="${favorites.includes(t.id)?"Retirer des favoris":"Ajouter aux favoris"}" aria-label="Favori" onclick="toggleFavorite('${t.id}')">${favorites.includes(t.id)?"★":"☆"}</button></div><h3 title="${esc(t.title)}">${esc(t.title)}</h3><p>${esc(t.artist)} · ${esc(t.genre||"Sans genre")}</p><div class="actions"><button onclick="playTrack('${t.id}')">▶ Lire</button><button class="secondary" onclick="addQueue('${t.id}')">＋ Playlist</button></div></article>`).join(""):'<div class="empty-state">Aucun titre trouvé.<br>Modifiez votre recherche ou importez vos fichiers audio/vidéo.</div>'}
function drawPlaylists(){const select=$("playlistSelect");if(!select)return;select.innerHTML=playlists.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${p.trackIds.length})</option>`).join("");select.value=currentPlaylistId;const p=currentPlaylist();queueIds=p?p.trackIds:[];drawQueue()}
function drawQueue(){$("queue").innerHTML=queueIds.length?queueIds.map((id,i)=>{const t=tracks.find(x=>x.id===id);return t?`<div class="queue-item"><span class="queue-number">${i+1}.</span><div class="mini">${t.emoji||"🎵"}</div><div class="info"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><button title="Lire" onclick="playTrack('${t.id}')">▶</button><button class="secondary" title="Retirer" onclick="removeQueue(${i})">×</button></div>`:""}).join(""):'<p class="empty">Cette playlist est vide. Ajoutez des morceaux depuis la bibliothèque.</p>';const p=currentPlaylist();$("clear").disabled=!p||!p.trackIds.length;$("renamePlaylist").disabled=!p;$("deletePlaylist").disabled=playlists.length<=1}
function saveQueue(){syncQueue();drawPlaylists()}
function addQueue(id){const p=currentPlaylist();if(!p)return;if(!p.trackIds.includes(id)){p.trackIds.push(id);syncQueue();drawPlaylists()}else{$("backupStatus").textContent="Ce titre est déjà dans cette playlist."}}
function removeQueue(i){queueIds.splice(i,1);syncQueue();drawPlaylists()}
function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem("kw_favorites",JSON.stringify(favorites));drawTracks()}
function createPlaylist(){const name=prompt("Nom de la nouvelle playlist :","Ma playlist");if(!name||!name.trim())return;const p={id:"pl_"+crypto.randomUUID(),name:name.trim().slice(0,60),trackIds:[]};playlists.push(p);currentPlaylistId=p.id;syncQueue();drawPlaylists();$("backupStatus").textContent="Playlist créée."}
function renamePlaylist(){const p=currentPlaylist();if(!p)return;const name=prompt("Nouveau nom de la playlist :",p.name);if(!name||!name.trim())return;p.name=name.trim().slice(0,60);syncQueue();drawPlaylists()}
function deletePlaylist(){if(playlists.length<=1)return;const p=currentPlaylist();if(!p||!confirm(`Supprimer la playlist « ${p.name} » ? Les fichiers de la bibliothèque ne seront pas supprimés.`))return;playlists=playlists.filter(x=>x.id!==p.id);currentPlaylistId=playlists[0].id;syncQueue();drawPlaylists()}
function fmt(s){return Number.isFinite(s)?Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0"):"0:00"}
function renderLyrics(sec=0){let idx=-1;if(!lrc.length){$("lyrics").innerHTML=`<div class="artist">${currentId?esc(tracks.find(t=>t.id===currentId)?.title||""):"Sélectionnez un fichier audio ou vidéo."}</div><div class="highlight">${currentId?"Paroles non chargées":"La scène est à vous ✨"}</div><div class="artist">Chargez un fichier .LRC pour les paroles synchronisées.</div>`;renderStageLyrics(-1);return}lrc.forEach((x,i)=>{if(x.time<=sec)idx=i});$("lyrics").innerHTML=lrc.map((x,i)=>`<div class="${i===idx?'highlight':''}">${esc(x.text)}</div>`).join("");renderStageLyrics(idx)}
function renderStageLyrics(idx){const box=$("stageLyrics");if(!box)return;if(!lrc.length){box.innerHTML='<div class="stage-empty">Les paroles synchronisées apparaîtront ici 🎤</div>';return}box.innerHTML=lrc.map((x,i)=>`<div class="stage-line ${i===idx?'active':Math.abs(i-idx)<=2?'near':''}" data-stage-line="${i}">${esc(x.text||'♪')}</div>`).join('');if(idx>=0){const el=box.querySelector(`[data-stage-line="${idx}"]`);if(el)el.scrollIntoView({behavior:'smooth',block:'center'})}}
function playTrack(id){const t=tracks.find(x=>x.id===id);if(!t)return;currentId=id;lrc=t.lrc||[];$("state").textContent=t.kind==="demo"?"Démo sans audio":"Fichier local";$("audio").pause();$("video").pause();$("audio").classList.add("hidden");$("video").classList.add("hidden");if(t.kind==="demo"||t.kind==="missing"){renderLyrics(0);$("state").textContent=t.kind==="demo"?"Démo : importez l'audio":"Fichier à réimporter";return}const media=t.type==="video"?$("video") :$("audio");media.classList.remove("hidden");media.src=t.url;media.play().catch(()=>{});renderLyrics(0);$("player").scrollIntoView({behavior:"smooth",block:"nearest"})}
function step(dir){const list=queueIds.length?queueIds:visible().map(t=>t.id);if(!list.length)return;let i=list.indexOf(currentId);playTrack(list[(i+dir+list.length)%list.length])}
async function importFiles(files){for(const f of files){if(f.name.toLowerCase().endsWith(".lrc")||f.name.toLowerCase().endsWith(".txt")){if(currentId){const txt=await f.text(),parsed=[];for(const line of txt.split(/\r?\n/)){const m=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,2})?)\](.*)$/);if(m)parsed.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()})}const t=tracks.find(x=>x.id===currentId);if(t){t.lrc=parsed;await saveTrack(t);lrc=parsed;renderLyrics(0)}}continue}if(!f.type.startsWith("audio/")&&!f.type.startsWith("video/"))continue;const id="local_"+crypto.randomUUID();const t={id,title:f.name.replace(/\.[^.]+$/,""),artist:"Fichier local",genre:"Sans genre",emoji:f.type.startsWith("video/")?"🎬":"🎶",kind:"local",type:f.type.startsWith("video/")?"video":"audio",blob:f,created:Date.now(),lrc:[]};try{await saveTrack(t);tracks.unshift({...t,url:URL.createObjectURL(f)});const p=currentPlaylist();if(p)p.trackIds.push(id)}catch(e){alert("Stockage impossible : "+e.message)}}syncQueue();drawTracks();drawPlaylists();$("backupStatus").textContent="Importation terminée : fichiers ajoutés à la bibliothèque et à la playlist sélectionnée."}
async function boot(){try{db=await openDB();const stored=await getAll();tracks=[...demo,...stored.map(t=>({...t,url:t.blob?URL.createObjectURL(t.blob):""}))];}catch(e){tracks=[...demo];$("backupStatus").textContent="Stockage local indisponible : "+e.message}try{playlists=JSON.parse(localStorage.getItem("kw_playlists")||"null")||[];favorites=JSON.parse(localStorage.getItem("kw_favorites")||"[]");}catch(e){playlists=[];favorites=[]}if(!playlists.length){const old=JSON.parse(localStorage.getItem("kw_queue")||"[]");playlists=[{id:"default",name:"Ma playlist",trackIds:old.filter(id=>tracks.some(t=>t.id===id))}]}playlists=playlists.map(p=>({...p,trackIds:(p.trackIds||[]).filter(id=>tracks.some(t=>t.id===id))}));currentPlaylistId=localStorage.getItem("kw_current_playlist")||playlists[0].id;if(!playlists.some(p=>p.id===currentPlaylistId))currentPlaylistId=playlists[0].id;syncQueue();drawTracks();drawPlaylists();if("serviceWorker"in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(()=>{})}
$("import").onclick=()=>$ ("files").click();$("files").onchange=e=>{importFiles(e.target.files);e.target.value=""};$("query").oninput=drawTracks;$("sort").onchange=drawTracks;$("favoritesOnly").onchange=drawTracks;
document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{activeGenre=b.dataset.g;document.querySelectorAll("[data-g]").forEach(x=>x.classList.toggle("active",x===b));drawTracks()});
$("playlistSelect").onchange=()=>{currentPlaylistId=$("playlistSelect").value;syncQueue();drawPlaylists()};$("newPlaylist").onclick=createPlaylist;$("renamePlaylist").onclick=renamePlaylist;$("deletePlaylist").onclick=deletePlaylist;
$("start").onclick=()=>{const id=queueIds[0]||visible()[0]?.id;if(id)playTrack(id);else $("files").click()};
$("play").onclick=()=>{
  if(ytPlayer&&typeof ytPlayer.playVideo==="function"){
    try{ytPlayer.playVideo();$("state").textContent="YouTube · Lecture";startYoutubeSync();return}catch(e){}
  }
  const m=$("video").classList.contains("hidden")?$("audio") :$("video");
  if(!currentId){$("files").click();return}
  if(tracks.find(t=>t.id===currentId)?.kind==="demo"){alert("Ce titre est un exemple sans audio. Importez un fichier audio/vidéo autorisé ou cherchez une version karaoké en ligne.");return}
  m.play().catch(()=>{});
};
$("pause").onclick=()=>{
  if(ytPlayer&&typeof ytPlayer.pauseVideo==="function"){try{ytPlayer.pauseVideo();$("state").textContent="YouTube · Pause";return}catch(e){}}
  const m=$("video").classList.contains("hidden")?$("audio") :$("video");m.pause();$("state").textContent="Pause";
};
$("stop").onclick=()=>{
  if(ytPlayer&&typeof ytPlayer.stopVideo==="function"){try{ytPlayer.stopVideo();ytPlayer.seekTo(0,true);$("seek").value=0;$("elapsed").textContent="0:00";renderLyrics(0);$("state").textContent="YouTube · Arrêté";return}catch(e){}}
  [$("audio"),$("video")].forEach(m=>{m.pause();m.currentTime=0});$("seek").value=0;renderLyrics(0);$("state").textContent="Arrêté";
};$("prev").onclick=()=>step(-1);$("next").onclick=()=>step(1);$("clear").onclick=()=>{const p=currentPlaylist();if(p){p.trackIds=[];syncQueue();drawPlaylists()}};
function update(m){if(!m.duration)return;$("elapsed").textContent=fmt(m.currentTime);$("duration").textContent=fmt(m.duration);$("seek").value=m.currentTime/m.duration*100;renderLyrics(m.currentTime)}[$("audio"),$("video")].forEach(m=>{m.ontimeupdate=()=>update(m);m.onended=()=>step(1)});$("seek").oninput=()=>{if(ytPlayer&&typeof ytPlayer.getDuration==="function"&&ytPlayer.getDuration()){ytPlayer.seekTo(ytPlayer.getDuration()*Number($("seek").value)/100,true);return}const m=$("video").classList.contains("hidden")?$("audio") :$("video");if(m.duration)m.currentTime=m.duration*Number($("seek").value)/100};
$("web").onclick=()=>{const t=tracks.find(t=>t.id===currentId);const q=t?t.title+" "+t.artist+" karaoké":$("query").value+" karaoké";window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(q),"_blank","noopener")};$("loadLrc").onclick=()=>$("lrc").click();$("lrc").onchange=e=>{if(!currentId){alert("Sélectionnez d’abord un titre.");return}importFiles(e.target.files)};
async function startMic(deviceId){micStream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId}}:true});audioCtx=new(window.AudioContext||window.webkitAudioContext)();const src=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();analyser.fftSize=256;src.connect(analyser);const data=new Uint8Array(analyser.frequencyBinCount);const tick=()=>{if(!analyser)return;analyser.getByteTimeDomainData(data);let sum=0;for(const v of data)sum+=((v-128)/128)**2;$("meter").style.width=Math.min(100,Math.round(Math.sqrt(sum/data.length)*260))+"%";raf=requestAnimationFrame(tick)};tick();const devs=await navigator.mediaDevices.enumerateDevices();$("device").innerHTML='<option value="">Micro par défaut</option>'+devs.filter(d=>d.kind==="audioinput").map(d=>`<option value="${esc(d.deviceId)}">${esc(d.label||"Microphone")}</option>`).join("");$("device").value=deviceId||"";$("micState").textContent="Actif";$("micOn").disabled=true;$("micOff").disabled=false}
$("micOn").onclick=async()=>{try{await startMic($("device").value)}catch(e){alert("Le micro nécessite une autorisation et une page HTTPS ou localhost. "+e.message)}};$("micOff").onclick=()=>{if(raf)cancelAnimationFrame(raf);micStream?.getTracks().forEach(t=>t.stop());audioCtx?.close();micStream=null;audioCtx=null;analyser=null;$("meter").style.width="0";$("micState").textContent="Désactivé";$("micOn").disabled=false;$("micOff").disabled=true};$("device").onchange=async()=>{if(!micStream)return;const id=$("device").value;$("micOff").click();try{await startMic(id)}catch(e){alert(e.message)}};
$("export").onclick=async()=>{const data=tracks.filter(t=>t.kind!=="demo").map(t=>({id:t.id,title:t.title,artist:t.artist,genre:t.genre,emoji:t.emoji,type:t.type,lrc:t.lrc||[]}));const blob=new Blob([JSON.stringify({app:"KaraokeWorld",version:3,playlists,favorites,tracks:data},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="karaokeworld-backup.json";a.click();URL.revokeObjectURL(a.href);$("backupStatus").textContent="Sauvegarde JSON exportée. Les fichiers audio/vidéo eux-mêmes ne sont pas inclus."};
$("importBackup").onclick=()=>$("backupFile").click();$("backupFile").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.tracks))throw Error("Fichier de sauvegarde invalide");for(const t of d.tracks){if(!t.id||!t.title)continue;if(tracks.some(x=>x.id===t.id))continue;tracks.push({...t,kind:"missing",url:"",blob:null})}if(Array.isArray(d.playlists)&&d.playlists.length)playlists=d.playlists.map(p=>({...p,trackIds:(p.trackIds||[])}));if(Array.isArray(d.favorites))favorites=d.favorites;currentPlaylistId=playlists[0]?.id||"default";syncQueue();localStorage.setItem("kw_favorites",JSON.stringify(favorites));drawTracks();drawPlaylists();$("backupStatus").textContent="Métadonnées importées. Réimportez les fichiers audio correspondants pour les lire."}catch(err){alert("Import impossible : "+err.message)}e.target.value=""};
$("forget").onclick=async()=>{if(confirm("Effacer les fichiers et métadonnées stockés par KaraokeWorld sur cet appareil ?")){await deleteAll();tracks=[...demo];playlists=[{id:"default",name:"Ma playlist",trackIds:[]}];currentPlaylistId="default";favorites=[];localStorage.removeItem("kw_favorites");syncQueue();drawTracks();drawPlaylists();$("backupStatus").textContent="Bibliothèque locale effacée."}};
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x===b));const p=b.dataset.page;if(p==="settings"){$("settings").classList.remove("hidden");$("page-home").classList.add("hidden");$("player").parentElement.classList.add("hidden")}else{$("settings").classList.add("hidden");$("page-home").classList.remove("hidden");$("player").parentElement.classList.remove("hidden");if(p==="playlist")$("queue-panel").scrollIntoView({behavior:"smooth"});if(p==="mic")$("micOn").scrollIntoView({behavior:"smooth"});if(p==="library")$("query").focus();if(p==="home")window.scrollTo({top:0,behavior:"smooth"})}});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("install").classList.remove("hidden")});$("install").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").classList.add("hidden")}};

function youtubeVideoId(value){try{const u=new URL(value.trim());if(u.hostname==="youtu.be")return u.pathname.split("/").filter(Boolean)[0]||"";if(u.hostname.endsWith("youtube.com")||u.hostname.endsWith("youtube-nocookie.com")){if(u.pathname==="/watch")return u.searchParams.get("v")||"";const m=u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);return m?m[1]:""}}catch(e){}return ""}
function parseLrc(text){const parsed=[];for(const line of (text||"").split(/\r?\n/)){const m=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);if(m)parsed.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()})}return parsed}
function ensureYouTubeApi(){return new Promise((resolve,reject)=>{if(window.YT&&YT.Player)return resolve();const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{if(typeof old==="function")old();resolve()};if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const sc=document.createElement("script");sc.src="https://www.youtube.com/iframe_api";sc.onerror=()=>reject(new Error("Impossible de charger le lecteur YouTube."));document.head.appendChild(sc)}})}
function startYoutubeSync(){clearInterval(ytTimer);ytTimer=setInterval(()=>{try{if(!ytPlayer||typeof ytPlayer.getCurrentTime!=="function")return;const sec=ytPlayer.getCurrentTime()||0,dur=ytPlayer.getDuration()||0;$('elapsed').textContent=fmt(sec);$('duration').textContent=fmt(dur);if(dur)$('seek').value=sec/dur*100;renderLyrics(Math.max(0,sec+lyricOffset))}catch(e){}},200)}
function normMatch(x){return String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function cleanYoutubeTitle(x){return String(x||"").replace(/\([^)]*(official|officiel|lyrics?|paroles|karaoke|karaoké|audio|video|clip)[^)]*\)/ig," ").replace(/\[[^\]]*(official|officiel|lyrics?|paroles|karaoke|karaoké|audio|video|clip)[^\]]*\]/ig," ").replace(/\b(official|officiel|lyrics?|paroles|karaoke|karaoké|instrumental|audio|video|clip|hd|4k)\b/ig," ").replace(/\s+/g," ").trim()}
function guessTitleArtist(query,videoTitle="",channelTitle=""){
  const q=cleanYoutubeTitle(String(query||"")), v=cleanYoutubeTitle(videoTitle), ch=cleanYoutubeTitle(channelTitle).replace(/\b(vevo|topic|official)\b/ig," ").replace(/\s+/g," ").trim();
  const split=s=>{for(const sep of [" - "," – "," — "," | "," : "]){if(s.includes(sep)){const a=s.split(sep).map(x=>x.trim()).filter(Boolean);if(a.length>=2)return [a[0],a.slice(1).join(" ")]}}return null};
  const parts=split(v)||split(q);let title=q,artist="";
  if(parts){
    const [a,b]=parts, na=normMatch(a), nb=normMatch(b), nc=normMatch(ch);
    // Si le nom de la chaîne ressemble à une des deux parties, cette partie est probablement l'artiste.
    if(nc && (nc.includes(na)||na.includes(nc))){artist=a;title=b}
    else if(nc && (nc.includes(nb)||nb.includes(nc))){artist=b;title=a}
    else {artist=a;title=b}
  }
  return {title:cleanYoutubeTitle(title),artist:cleanYoutubeTitle(artist)}
}
function prepareLyricsForYouTube(query,videoTitle="",channelTitle=""){
  const guessed=guessTitleArtist(query,videoTitle,channelTitle);
  $('lyricsQuery').value=guessed.title||cleanYoutubeTitle(query);
  $('lyricsArtist').value=guessed.artist||"";
  lrc=[];renderLyrics(0);
  $('state').textContent="Vidéo YouTube · identification automatique…";
  $('lyricsResults').innerHTML='<p class="empty">KaraokeWorld identifie automatiquement le morceau et cherche les meilleures paroles LRCLIB…</p>';
}
async function autoLyricsForYouTube(query,videoTitle="",channelTitle="",videoDuration=0){
  const q=(query||"").trim();
  const guessed=guessTitleArtist(q,videoTitle,channelTitle);
  const title=guessed.title||cleanYoutubeTitle(videoTitle)||q;
  let artist=guessed.artist||"";
  // Une chaîne officielle/VEVO/Topic donne un indice artiste supplémentaire.
  const channelArtist=cleanYoutubeTitle(channelTitle).replace(/\b(vevo|topic|official|officiel|music)\b/ig," ").replace(/\s+/g," ").trim();
  if(!artist && channelArtist) artist=channelArtist;
  $('lyricsQuery').value=title;$('lyricsArtist').value=artist;
  $('lyricsResults').innerHTML='<p class="empty">Recherche automatique des paroles synchronisées…</p>';$('state').textContent="Recherche des paroles…";
  try{
    const headers={"Lrclib-Client":"KaraokeWorld v0.14"}, urls=[];
    if(title&&artist) urls.push("https://lrclib.net/api/search?track_name="+encodeURIComponent(title)+"&artist_name="+encodeURIComponent(artist));
    if(title) urls.push("https://lrclib.net/api/search?q="+encodeURIComponent([title,artist].filter(Boolean).join(" ")));
    if(title) urls.push("https://lrclib.net/api/search?track_name="+encodeURIComponent(title));
    let all=[];
    for(const url of urls){
      const res=await fetch(url,{headers});
      if(res.status===429)throw new Error("Trop de recherches LRCLIB. Réessaie dans quelques instants.");
      if(!res.ok)continue;
      const found=await res.json();if(Array.isArray(found))all.push(...found);
    }
    const seen=new Set();
    const items=all.filter(x=>{const k=x.id??[x.trackName,x.artistName,x.albumName,x.duration].join("|");if(seen.has(k))return false;seen.add(k);return !!x.syncedLyrics});
    const nt=normMatch(title),na=normMatch(artist),nq=normMatch(q),nv=normMatch(cleanYoutubeTitle(videoTitle));
    const score=x=>{
      const tt=normMatch(x.trackName),aa=normMatch(x.artistName);let s=0;
      if(tt===nt)s+=45;else if(nt&&(tt.includes(nt)||nt.includes(tt)))s+=24;
      if(na){if(aa===na)s+=40;else if(aa.includes(na)||na.includes(aa))s+=22;else s-=35}
      if(nq&&tt&&aa&&nq.includes(tt)&&nq.includes(aa))s+=18;
      if(nv&&tt&&nv.includes(tt))s+=12;if(nv&&aa&&nv.includes(aa))s+=12;
      const d=Number(x.duration||0);if(videoDuration>0&&d>0){const diff=Math.abs(videoDuration-d);if(diff<=3)s+=18;else if(diff<=8)s+=12;else if(diff<=15)s+=6;else if(diff>45)s-=12}
      return s;
    };
    items.sort((a,b)=>score(b)-score(a));
    const hit=items[0],second=items[1],best=hit?score(hit):-999,runner=second?score(second):-999;
    // On exige une forte cohérence et une marge sur le second résultat pour éviter FOPOSS/Johnny.
    const good=hit && best>=(artist?55:48) && (best-runner>=8 || best>=85);
    if(!good){
      lrc=[];renderLyrics(0);$('state').textContent="Vidéo YouTube · identification incertaine";
      const choices=items.slice(0,3).map((x,i)=>`<article class="lyric-result"><h3>${esc(x.trackName||"Titre inconnu")}</h3><p>${esc(x.artistName||"Artiste inconnu")}${x.duration?" · "+fmt(Number(x.duration)):""}</p><button data-auto-choice="${i}">Utiliser ces paroles</button></article>`).join("");
      $('lyricsResults').innerHTML='<p class="empty">Je n’ai pas trouvé une correspondance assez sûre pour charger des paroles automatiquement. Choisis seulement si nécessaire :</p>'+choices;
      items.slice(0,3).forEach((x,i)=>{const b=document.querySelector(`[data-auto-choice="${i}"]`);if(b)b.onclick=()=>useAutoLyrics(x)});
      return;
    }
    useAutoLyrics(hit,true);
  }catch(e){$('state').textContent="Vidéo YouTube · paroles non chargées";$('lyricsResults').innerHTML=`<p class="empty">Recherche automatique impossible : ${esc(e.message)}</p>`}
}
function useAutoLyrics(hit,automatic=false){
  const parsed=parseLrc(hit.syncedLyrics);if(!parsed.length)return;
  lrc=parsed;$('lyricsQuery').value=hit.trackName||$('lyricsQuery').value;$('lyricsArtist').value=hit.artistName||$('lyricsArtist').value;
  $('state').textContent="YouTube + paroles synchronisées";
  $('lyricsResults').innerHTML=`<article class="lyric-result"><h3>${esc(hit.trackName||"")}</h3><p>${esc(hit.artistName||"")} · ✓ ${automatic?"trouvé et chargé automatiquement":"paroles chargées"}</p></article>`;
  renderLyrics(0);$('player').scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function youtubeEmbed(id,title="Vidéo YouTube",query="",channelTitle=""){
  const watch=`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;youtubeQuery=(query||$('onlineQuery').value||title).trim();currentId=null;$('audio').pause();$('video').pause();$('audio').classList.add('hidden');$('video').classList.add('hidden');lrc=[];renderLyrics(0);
  $('youtubePlayer').innerHTML=`<div class="youtube-frame"><div id="ytApiPlayer"></div></div><div class="youtube-fallback"><span>Lecture YouTube synchronisée avec les paroles.</span><a class="button-link" href="${watch}" target="_blank" rel="noopener noreferrer">▶ Ouvrir sur YouTube</a></div>`;$('youtubePlayer').classList.remove('hidden');
  try{await ensureYouTubeApi();if(ytPlayer&&typeof ytPlayer.destroy==="function")try{ytPlayer.destroy()}catch(e){}ytPlayer=new YT.Player('ytApiPlayer',{videoId:id,playerVars:{rel:0,playsinline:1,origin:(location.protocol==='http:'||location.protocol==='https:')?location.origin:undefined},events:{onReady:()=>{startYoutubeSync();prepareLyricsForYouTube(youtubeQuery,title,channelTitle);setTimeout(()=>{let d=0;try{d=ytPlayer.getDuration()||0}catch(e){}autoLyricsForYouTube(youtubeQuery,title,channelTitle,d)},250)},onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING)startYoutubeSync()}}});}catch(e){$('onlineStatus').textContent=e.message}
  $('state').textContent='YouTube prêt';$('player').scrollIntoView({behavior:"smooth",block:"nearest"});
}
const YT_KEY_STORAGE="karaokeworld_youtube_api_key_v1";
function setYoutubeMode(mode){youtubeMode=mode==="original"?"original":"karaoke";$('modeKaraoke').classList.toggle('active',youtubeMode==='karaoke');$('modeKaraoke').classList.toggle('secondary',youtubeMode!=='karaoke');$('modeOriginal').classList.toggle('active',youtubeMode==='original');$('modeOriginal').classList.toggle('secondary',youtubeMode!=='original');$('youtubeModeHelp').textContent=youtubeMode==='karaoke'?"Mode Karaoké : recherche en priorité des versions karaoké/instrumentales sans voix principale.":"Mode Original : recherche la chanson avec la voix du chanteur. Certaines vidéos officielles peuvent interdire la lecture intégrée."}
$('modeKaraoke').onclick=()=>setYoutubeMode('karaoke');$('modeOriginal').onclick=()=>setYoutubeMode('original');setYoutubeMode('karaoke');
$('youtubeApiKey').value=localStorage.getItem(YT_KEY_STORAGE)||"";$('saveYoutubeKey').onclick=()=>{const k=$('youtubeApiKey').value.trim();if(!k){$('onlineStatus').textContent="Colle d’abord ta clé YouTube Data API.";return}localStorage.setItem(YT_KEY_STORAGE,k);$('onlineStatus').textContent="Clé enregistrée uniquement dans ce navigateur."};$('forgetYoutubeKey').onclick=()=>{localStorage.removeItem(YT_KEY_STORAGE);$('youtubeApiKey').value="";$('onlineStatus').textContent="Clé YouTube oubliée sur cet appareil."};
async function searchYouTubeCompatible(query){const q=query.trim();if(!q){$('onlineStatus').textContent="Saisis un titre ou un artiste.";return}const key=$('youtubeApiKey').value.trim()||localStorage.getItem(YT_KEY_STORAGE)||"";if(!key){$('onlineStatus').textContent="Ajoute d’abord une clé YouTube Data API v3.";return}$('youtubeResults').innerHTML='<p class="empty">Recherche YouTube en cours…</p>';try{const searchText=youtubeMode==='karaoke'?q+' karaoké instrumental':q+' officiel audio';const params=new URLSearchParams({part:'snippet',type:'video',maxResults:'12',q:searchText,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'fr',regionCode:'FR',safeSearch:'moderate',key});const r=await fetch('https://www.googleapis.com/youtube/v3/search?'+params);const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||('Erreur YouTube '+r.status));const items=(data.items||[]).filter(x=>x.id?.videoId);if(!items.length){$('youtubeResults').innerHTML='<p class="empty">Aucune vidéo intégrable trouvée.</p>';return}$('youtubeResults').innerHTML=items.map(x=>{const id=x.id.videoId,sn=x.snippet||{},thumb=sn.thumbnails?.medium?.url||sn.thumbnails?.default?.url||'';return `<article class="youtube-result"><img src="${esc(thumb)}" alt="" loading="lazy"><div class="youtube-result-info"><h3>${esc(sn.title||'Vidéo YouTube')}</h3><p>${esc(sn.channelTitle||'')}</p><button class="play-youtube-result" data-id="${esc(id)}" data-title="${esc(sn.title||'')}" data-channel="${esc(sn.channelTitle||'')}">▶ Lire + préparer les paroles</button><a class="yt-open" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">Voir sur YouTube</a></div></article>`}).join('');document.querySelectorAll('.play-youtube-result').forEach(b=>b.onclick=()=>youtubeEmbed(b.dataset.id,b.dataset.title,q,b.dataset.channel||''));$('onlineStatus').textContent=items.length+' vidéo(s) compatible(s) trouvée(s). Choisis-en une : KaraokeWorld identifiera automatiquement le morceau et chargera les meilleures paroles LRCLIB.'}catch(e){$('youtubeResults').innerHTML='<p class="empty">Impossible d’effectuer la recherche YouTube.</p>';$('onlineStatus').textContent='Erreur YouTube : '+e.message}}
function searchYouTubeFor(query){$('onlineQuery').value=query.trim();searchYouTubeCompatible(query);$('online').scrollIntoView({behavior:'smooth',block:'start'})}
$('searchEverywhere').onclick=()=>searchYouTubeFor($('query').value);$('query').addEventListener('keydown',e=>{if(e.key==='Enter')searchYouTubeFor($('query').value)});$('youtubeSearch').onclick=()=>searchYouTubeCompatible($('onlineQuery').value);$('onlineQuery').addEventListener('keydown',e=>{if(e.key==='Enter')$('youtubeSearch').click()});
$('loadYoutube').onclick=()=>{const raw=$('youtubeUrl').value.trim(),id=youtubeVideoId(raw);if(!id){$('onlineStatus').textContent='Lien YouTube non reconnu.';return}youtubeEmbed(id,'Vidéo YouTube',$('onlineQuery').value);$('onlineStatus').textContent='Lien chargé. Vérifie ensuite le titre et l’artiste avant de rechercher les paroles.'};$('youtubeUrl').addEventListener('keydown',e=>{if(e.key==='Enter')$('loadYoutube').click()});
$('offsetMinus').onclick=()=>{lyricOffset=Math.round((lyricOffset-.5)*10)/10;$('offsetValue').textContent=(lyricOffset>0?'+':'')+lyricOffset.toFixed(1)+' s'};$('offsetPlus').onclick=()=>{lyricOffset=Math.round((lyricOffset+.5)*10)/10;$('offsetValue').textContent=(lyricOffset>0?'+':'')+lyricOffset.toFixed(1)+' s'};$('offsetReset').onclick=()=>{lyricOffset=0;$('offsetValue').textContent='0.0 s'};
async function searchOnlineLyrics(){
  const title=$("lyricsQuery").value.trim(), artist=$("lyricsArtist")?.value.trim()||"", out=$("lyricsResults");
  if(!title){out.innerHTML='<p class="empty">Saisis au moins le titre de la chanson.</p>';return}
  out.innerHTML='<p class="empty">Recherche en cours…</p>';
  try{
    const headers={"Lrclib-Client":"KaraokeWorld v0.14"};
    const urls=[];
    if(artist) urls.push("https://lrclib.net/api/search?track_name="+encodeURIComponent(title)+"&artist_name="+encodeURIComponent(artist));
    urls.push("https://lrclib.net/api/search?q="+encodeURIComponent([title,artist].filter(Boolean).join(" ")));
    if(artist) urls.push("https://lrclib.net/api/search?q="+encodeURIComponent(title));
    let all=[];
    for(const url of urls){
      const res=await fetch(url,{headers});
      if(res.status===429) throw new Error("Trop de recherches en peu de temps. Réessaie dans quelques instants.");
      if(!res.ok) continue;
      const found=await res.json();
      if(Array.isArray(found)) all.push(...found);
      if(found?.length) break;
      await new Promise(r=>setTimeout(r,250));
    }
    const seen=new Set();
    let items=all.filter(t=>{const k=t.id??[t.trackName,t.artistName,t.albumName,t.duration].join("|");if(seen.has(k))return false;seen.add(k);return true});
    const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const nt=norm(title), na=norm(artist);
    items.sort((a,b)=>{
      const score=x=>(norm(x.trackName)===nt?8:norm(x.trackName).includes(nt)?4:0)+(na?(norm(x.artistName)===na?6:norm(x.artistName).includes(na)?3:0):0)+(x.syncedLyrics?2:x.plainLyrics?1:0);
      return score(b)-score(a);
    });
    if(!items.length){out.innerHTML='<p class="empty">Aucun résultat. Vérifie le titre et l’artiste, puis réessaie.</p>';return}
    const shown=items.slice(0,10);
    out.innerHTML=shown.map((t,i)=>`<article class="lyric-result"><h3>${esc(t.trackName||t.name||"Titre inconnu")}</h3><p>${esc(t.artistName||"Artiste inconnu")}${t.albumName?" · "+esc(t.albumName):""}</p><p>${t.syncedLyrics?"✓ Paroles synchronisées":t.plainLyrics?"Paroles non synchronisées":"Aucune parole disponible"}</p><div class="controls"><button class="secondary" data-preview="${i}">Aperçu</button>${t.syncedLyrics?`<button data-use="${i}">Utiliser les paroles</button>`:""}</div><pre class="lyric-preview hidden" id="lyric-preview-${i}"></pre></article>`).join("");
    shown.forEach((t,i)=>{
      const prev=out.querySelector(`[data-preview="${i}"]`);
      prev.onclick=()=>{const el=$("lyric-preview-"+i);el.textContent=t.syncedLyrics||t.plainLyrics||"Aucune parole disponible.";el.classList.toggle("hidden")};
      const use=out.querySelector(`[data-use="${i}"]`);
      if(use)use.onclick=()=>{
        if(!currentId&& !ytPlayer){alert("Sélectionne d’abord une chanson locale ou une vidéo YouTube, puis reviens ici.");return}
        const parsed=[];
        for(const line of (t.syncedLyrics||"").split(String.fromCharCode(10))){const m=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);if(m)parsed.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()})}
        if(!parsed.length){alert("Aucune ligne synchronisée exploitable dans ce résultat.");return}
        const track=tracks.find(x=>x.id===currentId);lrc=parsed;renderLyrics(0);$("state").textContent="Paroles LRC chargées";$("player").scrollIntoView({behavior:"smooth",block:"nearest"});if(track){track.lrc=parsed;saveTrack(track).catch(e=>alert("Impossible de sauvegarder les paroles : "+e.message))}
      };
    });
  }catch(e){out.innerHTML=`<p class="empty">${esc(e.message||"Erreur pendant la recherche.")}</p>`}
}
$("searchLyrics").onclick=searchOnlineLyrics;$("lyricsQuery").addEventListener("keydown",e=>{if(e.key==="Enter")searchOnlineLyrics()});$("lyricsArtist")?.addEventListener("keydown",e=>{if(e.key==="Enter")searchOnlineLyrics()});

let youtubeHome=null;
function updateStageOffset(){if($("stageOffset"))$("stageOffset").textContent=(lyricOffset>0?'+':'')+lyricOffset.toFixed(1)+' s'}
async function enterKaraokeStage(){const stage=$("karaokeStage"),yp=$("youtubePlayer");if(!stage)return;if(yp&&!yp.classList.contains('hidden')){youtubeHome={parent:yp.parentNode,next:yp.nextSibling};$("stageVideoSlot").appendChild(yp)}stage.classList.remove('hidden');stage.setAttribute('aria-hidden','false');renderStageLyrics(-1);updateStageOffset();try{if(stage.requestFullscreen)await stage.requestFullscreen()}catch(e){}}
function exitKaraokeStage(){const stage=$("karaokeStage"),yp=$("youtubePlayer");if(youtubeHome&&yp){youtubeHome.parent.insertBefore(yp,youtubeHome.next);youtubeHome=null}stage.classList.add('hidden');stage.setAttribute('aria-hidden','true');if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
$("fullscreenKaraoke").onclick=enterKaraokeStage;$("exitFullscreen").onclick=exitKaraokeStage;
$("stagePlay").onclick=()=>$("play").click();$("stagePause").onclick=()=>$("pause").click();$("stageStop").onclick=()=>$("stop").click();
$("stageMinus").onclick=()=>{$("offsetMinus").click();updateStageOffset()};$("stagePlus").onclick=()=>{$("offsetPlus").click();updateStageOffset()};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!$("karaokeStage").classList.contains('hidden')){const yp=$("youtubePlayer");if(youtubeHome&&yp){youtubeHome.parent.insertBefore(yp,youtubeHome.next);youtubeHome=null}$("karaokeStage").classList.add('hidden');$("karaokeStage").setAttribute('aria-hidden','true')}});

boot();
