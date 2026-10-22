const $=id=>document.getElementById(id);
const DB_NAME="karaokeworld_db", DB_VERSION=1, STORE="tracks";
let db=null, tracks=[], queueIds=[], playlists=[], currentPlaylistId="default", favorites=[], currentId=null, activeGenre="Tous", lrc=[], micStream=null, audioCtx=null, analyser=null, micSource=null, micGain=null, micDelay=null, micWet=null, micMonitorGain=null, selectedSinkId="", raf=0, installPrompt=null, youtubeMode="karaoke", ytPlayer=null, ytTimer=0, lyricOffset=0, youtubeQuery="", currentYoutubeId="", currentYoutubeTitle="", currentYoutubeChannel="", stageLastIdx=-999, stageInfoTimer=0, countdownRunning=false;
let cloudUser=null, cloudApi=null, cloudSaveTimer=0, cloudApplying=false;

const APP_VERSION="0.23.7";
let waitingWorker=null, updateReloading=false;
function showUpdate(worker){waitingWorker=worker;const t=$("updateToast");if(t)t.classList.remove("hidden")}
async function setupAppUpdates(){
  try{
    const reg=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;if(!worker)return;
      worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)showUpdate(worker)});
    });
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(updateReloading)return;updateReloading=true;location.reload()});
    setInterval(()=>reg.update().catch(()=>{}),30*60*1000);
    window.addEventListener("focus",()=>reg.update().catch(()=>{}));
  }catch(e){console.warn("Mise à jour KaraokeWorld indisponible",e)}
}
document.addEventListener("click",e=>{
  if(e.target?.id==="updateNow"&&waitingWorker){e.target.disabled=true;e.target.textContent="Mise à jour…";waitingWorker.postMessage({type:"SKIP_WAITING"})}
  if(e.target?.id==="updateLater")$("updateToast")?.classList.add("hidden");
});
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
function syncQueue(){const p=currentPlaylist();queueIds=p?p.trackIds:[];localStorage.setItem("kw_playlists",JSON.stringify(playlists));localStorage.setItem("kw_current_playlist",currentPlaylistId);localStorage.setItem("kw_queue",JSON.stringify(queueIds));scheduleCloudSave()}
function visible(){const q=$("query").value.toLowerCase().trim();let arr=tracks.filter(t=>(activeGenre==="Tous"||t.genre===activeGenre)&&(!$("favoritesOnly").checked||favorites.includes(t.id))&&(!q||(t.title+" "+t.artist+" "+t.genre).toLowerCase().includes(q)));const sort=$("sort").value;if(sort==="artist")arr.sort((a,b)=>a.artist.localeCompare(b.artist,"fr"));else if(sort==="recent")arr.sort((a,b)=>(b.created||0)-(a.created||0));else arr.sort((a,b)=>a.title.localeCompare(b.title,"fr"));return arr}
function drawHomeShelves(){const favBox=$("homeFavorites"),popBox=$("homePopular");if(!favBox||!popBox)return;const card=t=>`<article class="home-card" onclick="homePick('${t.id}')"><div class="home-emoji">${t.emoji||"🎵"}</div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></article>`;const fav=tracks.filter(t=>favorites.includes(t.id)).slice(0,4);favBox.innerHTML=fav.length?fav.map(card).join(""):'<div class="home-card empty-card">☆ Ajoutez des favoris depuis votre bibliothèque.</div>';popBox.innerHTML=tracks.slice(0,4).map(card).join("")}
function homePick(id){const t=tracks.find(x=>x.id===id);if(!t)return;if(t.kind==="demo"){searchYouTubeFor(t.title+" "+t.artist);return}playTrack(id)}
function drawTracks(){const arr=visible();$("resultCount").textContent=`${arr.length} titre${arr.length!==1?"s":""}`;$("tracks").innerHTML=arr.length?arr.map(t=>`<article class="track"><div class="track-top"><div class="cover" style="flex:1">${t.emoji||"🎵"}</div><button class="favorite ${favorites.includes(t.id)?"on":""}" title="${favorites.includes(t.id)?"Retirer des favoris":"Ajouter aux favoris"}" aria-label="Favori" onclick="toggleFavorite('${t.id}')">${favorites.includes(t.id)?"★":"☆"}</button></div><h3 title="${esc(t.title)}">${esc(t.title)}</h3><p>${esc(t.artist)} · ${esc(t.genre||"Sans genre")}</p><div class="actions"><button onclick="playTrack('${t.id}')">▶ Lire</button><button class="secondary" onclick="addQueue('${t.id}')">＋ Playlist</button></div></article>`).join(""):'<div class="empty-state">Aucun titre trouvé.<br>Modifiez votre recherche ou importez vos fichiers audio/vidéo.</div>';drawHomeShelves()}
function drawPlaylists(){const select=$("playlistSelect");if(!select)return;select.innerHTML=playlists.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${p.trackIds.length})</option>`).join("");select.value=currentPlaylistId;const p=currentPlaylist();queueIds=p?p.trackIds:[];drawQueue()}
function drawQueue(){$("queue").innerHTML=queueIds.length?queueIds.map((id,i)=>{const t=tracks.find(x=>x.id===id);return t?`<div class="queue-item"><span class="queue-number">${i+1}.</span><div class="mini">${t.emoji||"🎵"}</div><div class="info"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><button title="Lire" onclick="playTrack('${t.id}')">▶</button><button class="secondary" title="Retirer" onclick="removeQueue(${i})">×</button></div>`:""}).join(""):'<p class="empty">Cette playlist est vide. Ajoutez des morceaux depuis la bibliothèque.</p>';const p=currentPlaylist();$("clear").disabled=!p||!p.trackIds.length;$("renamePlaylist").disabled=!p;$("deletePlaylist").disabled=playlists.length<=1}
function saveQueue(){syncQueue();drawPlaylists()}
function addQueue(id){const p=currentPlaylist();if(!p)return;if(!p.trackIds.includes(id)){p.trackIds.push(id);syncQueue();drawPlaylists()}else{$("backupStatus").textContent="Ce titre est déjà dans cette playlist."}}
function removeQueue(i){queueIds.splice(i,1);syncQueue();drawPlaylists()}
function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem("kw_favorites",JSON.stringify(favorites));drawTracks();scheduleCloudSave()}
function createPlaylist(){const name=prompt("Nom de la nouvelle playlist :","Ma playlist");if(!name||!name.trim())return;const p={id:"pl_"+crypto.randomUUID(),name:name.trim().slice(0,60),trackIds:[]};playlists.push(p);currentPlaylistId=p.id;syncQueue();drawPlaylists();$("backupStatus").textContent="Playlist créée."}
function renamePlaylist(){const p=currentPlaylist();if(!p)return;const name=prompt("Nouveau nom de la playlist :",p.name);if(!name||!name.trim())return;p.name=name.trim().slice(0,60);syncQueue();drawPlaylists()}
function deletePlaylist(){if(playlists.length<=1)return;const p=currentPlaylist();if(!p||!confirm(`Supprimer la playlist « ${p.name} » ? Les fichiers de la bibliothèque ne seront pas supprimés.`))return;playlists=playlists.filter(x=>x.id!==p.id);currentPlaylistId=playlists[0].id;syncQueue();drawPlaylists()}
function fmt(s){return Number.isFinite(s)?Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0"):"0:00"}
function renderLyrics(sec=0){let idx=-1;if(!lrc.length){$("lyrics").innerHTML=`<div class="artist">${currentId?esc(tracks.find(t=>t.id===currentId)?.title||""):"Sélectionnez un fichier audio ou vidéo."}</div><div class="highlight">${currentId?"Paroles non chargées":"La scène est à vous ✨"}</div><div class="artist">Chargez un fichier .LRC pour les paroles synchronisées.</div>`;renderStageLyrics(-1);return}lrc.forEach((x,i)=>{if(x.time<=sec)idx=i});$("lyrics").innerHTML=lrc.map((x,i)=>`<div class="${i===idx?'highlight':''}">${esc(x.text)}</div>`).join("");renderStageLyrics(idx,sec)}
function renderStageLyrics(idx,sec=0){
  const box=$("stageLyrics");if(!box)return;
  if(!lrc.length){box.innerHTML='<div class="stage-empty">Les paroles synchronisées apparaîtront ici 🎤</div>';stageLastIdx=-999;return}
  const nextIdx=idx+1<lrc.length?idx+1:-1;
  const nextTime=nextIdx>=0?lrc[nextIdx].time:(idx>=0?lrc[idx].time+6:6);
  const curTime=idx>=0?lrc[idx].time:0;
  const progress=idx>=0?Math.max(0,Math.min(100,((sec-curTime)/Math.max(.4,nextTime-curTime))*100)):0;
  if(stageLastIdx!==idx){
    let html='';
    lrc.forEach((x,i)=>{
      const prev=lrc[i-1], gap=prev?x.time-prev.time:0;
      if(i>0&&gap>=12)html+=`<div class="stage-line instrumental" data-gap-before="${i}">♪ Instrumental ♪</div>`;
      html+=`<div class="stage-line ${i===idx?'active':i===nextIdx?'next':Math.abs(i-idx)<=2?'near':''}" data-stage-line="${i}">${esc(x.text||'♪')}</div>`;
    });
    box.innerHTML=html;stageLastIdx=idx;
    let target=idx>=0?box.querySelector(`[data-stage-line="${idx}"]`):null;
    if(idx<0&&lrc[0]?.time>4){box.insertAdjacentHTML('afterbegin','<div class="stage-line instrumental active" id="stageIntro">♪ INTRO — préparez-vous ♪</div>');target=$("stageIntro")}
    if(target)target.scrollIntoView({behavior:'smooth',block:'center'});
  }
  const active=box.querySelector('.stage-line.active');if(active)active.style.setProperty('--sing-progress',progress.toFixed(1)+'%');
}

function playTrack(id){const t=tracks.find(x=>x.id===id);if(!t)return;currentId=id;lrc=t.lrc||[];$("state").textContent=t.kind==="demo"?"Démo sans audio":"Fichier local";$("audio").pause();$("video").pause();$("audio").classList.add("hidden");$("video").classList.add("hidden");if(t.kind==="demo"||t.kind==="missing"){renderLyrics(0);$("state").textContent=t.kind==="demo"?"Démo : importez l'audio":"Fichier à réimporter";return}const media=t.type==="video"?$("video") :$("audio");media.classList.remove("hidden");media.src=t.url;media.play().catch(()=>{});renderLyrics(0);$("player").scrollIntoView({behavior:"smooth",block:"nearest"})}
function step(dir){const list=queueIds.length?queueIds:visible().map(t=>t.id);if(!list.length)return;let i=list.indexOf(currentId);playTrack(list[(i+dir+list.length)%list.length])}
async function importFiles(files){for(const f of files){if(f.name.toLowerCase().endsWith(".lrc")||f.name.toLowerCase().endsWith(".txt")){if(currentId){const txt=await f.text(),parsed=[];for(const line of txt.split(/\r?\n/)){const m=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,2})?)\](.*)$/);if(m)parsed.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()})}const t=tracks.find(x=>x.id===currentId);if(t){t.lrc=parsed;await saveTrack(t);lrc=parsed;renderLyrics(0)}}continue}if(!f.type.startsWith("audio/")&&!f.type.startsWith("video/"))continue;const id="local_"+crypto.randomUUID();const t={id,title:f.name.replace(/\.[^.]+$/,""),artist:"Fichier local",genre:"Sans genre",emoji:f.type.startsWith("video/")?"🎬":"🎶",kind:"local",type:f.type.startsWith("video/")?"video":"audio",blob:f,created:Date.now(),lrc:[]};try{await saveTrack(t);tracks.unshift({...t,url:URL.createObjectURL(f)});const p=currentPlaylist();if(p)p.trackIds.push(id)}catch(e){alert("Stockage impossible : "+e.message)}}syncQueue();drawTracks();drawPlaylists();$("backupStatus").textContent="Importation terminée : fichiers ajoutés à la bibliothèque et à la playlist sélectionnée."}
async function boot(){try{db=await openDB();const stored=await getAll();tracks=[...demo,...stored.map(t=>({...t,url:t.blob?URL.createObjectURL(t.blob):""}))];}catch(e){tracks=[...demo];$("backupStatus").textContent="Stockage local indisponible : "+e.message}try{playlists=JSON.parse(localStorage.getItem("kw_playlists")||"null")||[];favorites=JSON.parse(localStorage.getItem("kw_favorites")||"[]");}catch(e){playlists=[];favorites=[]}if(!playlists.length){const old=JSON.parse(localStorage.getItem("kw_queue")||"[]");playlists=[{id:"default",name:"Ma playlist",trackIds:old.filter(id=>tracks.some(t=>t.id===id))}]}playlists=playlists.map(p=>({...p,trackIds:(p.trackIds||[]).filter(id=>tracks.some(t=>t.id===id))}));currentPlaylistId=localStorage.getItem("kw_current_playlist")||playlists[0].id;if(!playlists.some(p=>p.id===currentPlaylistId))currentPlaylistId=playlists[0].id;syncQueue();drawTracks();drawPlaylists();if("serviceWorker"in navigator&&location.protocol!=="file:")setupAppUpdates()}
$("import").onclick=()=>$ ("files").click();$("files").onchange=e=>{importFiles(e.target.files);e.target.value=""};$("query").oninput=drawTracks;$("sort").onchange=drawTracks;$("favoritesOnly").onchange=drawTracks;
document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{activeGenre=b.dataset.g;document.querySelectorAll("[data-g]").forEach(x=>x.classList.toggle("active",x===b));drawTracks()});
$("playlistSelect").onchange=()=>{currentPlaylistId=$("playlistSelect").value;syncQueue();drawPlaylists()};$("newPlaylist").onclick=createPlaylist;$("renamePlaylist").onclick=renamePlaylist;$("deletePlaylist").onclick=deletePlaylist;
$("start").onclick=()=>{const q=$("query").value.trim();if(q){searchYouTubeFor(q);return}$("query").focus();$("query").scrollIntoView({behavior:"smooth",block:"center"})};
if($("homeLibrary"))$("homeLibrary").onclick=()=>document.querySelector(".library-section")?.scrollIntoView({behavior:"smooth"});
if($("homePlaylists"))$("homePlaylists").onclick=()=>$("queue-panel")?.scrollIntoView({behavior:"smooth"});
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
async function ensureAudioContext(){if(!audioCtx||audioCtx.state==="closed")audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")await audioCtx.resume();if(selectedSinkId&&typeof audioCtx.setSinkId==="function")try{await audioCtx.setSinkId(selectedSinkId)}catch(e){}return audioCtx}
function updateAudioReady(){const mic=!!micStream;$('audioMicBadge').textContent=mic?'🎤 Micro : prêt':'🎤 Micro : non testé';$('audioReadyText').textContent=mic?'Micro prêt. Testez les enceintes puis lancez votre chanson.':'Activez le micro puis vérifiez le niveau et les enceintes.'}
function updateMicFx(){if(micGain)micGain.gain.value=Number($('micVolume').value)/100;if(micWet)micWet.gain.value=Number($('micEcho').value)/100*.65;if(micMonitorGain)micMonitorGain.gain.value=$('micMonitor').checked?1:0;$('micVolumeValue').textContent=$('micVolume').value+' %';$('micEchoValue').textContent=$('micEcho').value+' %'}
async function startMic(deviceId){if(micStream)$('micOff').click();micStream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId}}:true});await ensureAudioContext();micSource=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();analyser.fftSize=256;micGain=audioCtx.createGain();micDelay=audioCtx.createDelay(.8);micDelay.delayTime.value=.16;micWet=audioCtx.createGain();micMonitorGain=audioCtx.createGain();micSource.connect(analyser);micSource.connect(micGain);micGain.connect(micMonitorGain);micGain.connect(micDelay);micDelay.connect(micWet);micWet.connect(micMonitorGain);micMonitorGain.connect(audioCtx.destination);updateMicFx();const data=new Uint8Array(analyser.frequencyBinCount);const tick=()=>{if(!analyser)return;analyser.getByteTimeDomainData(data);let sum=0;for(const v of data)sum+=((v-128)/128)**2;const level=Math.min(100,Math.round(Math.sqrt(sum/data.length)*260));$('meter').style.width=level+'%';if($('stageMicLevel'))$('stageMicLevel').style.width=level+'%';raf=requestAnimationFrame(tick)};tick();const devs=await navigator.mediaDevices.enumerateDevices();$('device').innerHTML='<option value="">Micro par défaut</option>'+devs.filter(d=>d.kind==='audioinput').map(d=>`<option value="${esc(d.deviceId)}">${esc(d.label||'Microphone')}</option>`).join('');$('device').value=deviceId||'';$('micState').textContent='Actif';if($('stageMicText'))$('stageMicText').textContent='Micro actif';if($('stageMicDot'))$('stageMicDot').parentElement.classList.add('on');$('micOn').disabled=true;$('micOff').disabled=false;updateAudioReady()}
$('micOn').onclick=async()=>{try{await startMic($('device').value)}catch(e){alert('Le micro nécessite une autorisation et une page HTTPS. '+e.message)}};
$('micOff').onclick=()=>{if(raf)cancelAnimationFrame(raf);micStream?.getTracks().forEach(t=>t.stop());micStream=null;analyser=null;micSource=null;micGain=null;micDelay=null;micWet=null;micMonitorGain=null;$('meter').style.width='0';$('micState').textContent='Désactivé';if($('stageMicText'))$('stageMicText').textContent='Micro désactivé';if($('stageMicDot'))$('stageMicDot').parentElement.classList.remove('on');if($('stageMicLevel'))$('stageMicLevel').style.width='0';$('micOn').disabled=false;$('micOff').disabled=true;updateAudioReady()};
$('device').onchange=async()=>{if(!micStream)return;const id=$('device').value;$('micOff').click();try{await startMic(id)}catch(e){alert(e.message)}};
$('micVolume').oninput=updateMicFx;$('micEcho').oninput=updateMicFx;$('micMonitor').onchange=updateMicFx;updateMicFx();
$('testSpeaker').onclick=async()=>{try{const ctx=await ensureAudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=660;gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.55);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.6);$('audioSpeakerBadge').textContent='🔊 Enceintes : testées';$('speakerHelp').textContent='Si vous avez entendu le son, la sortie audio fonctionne.'}catch(e){alert('Test audio impossible : '+e.message)}};
$('chooseSpeaker').onclick=async()=>{try{if(!navigator.mediaDevices?.selectAudioOutput){$('speakerHelp').textContent='Chrome ne permet pas la sélection directe ici. Utilisez les réglages audio de ChromeOS.';return}const d=await navigator.mediaDevices.selectAudioOutput();selectedSinkId=d.deviceId||'';$('speakerName').textContent='Sortie audio : '+(d.label||'haut-parleur sélectionné');if(audioCtx&&typeof audioCtx.setSinkId==='function')await audioCtx.setSinkId(selectedSinkId);$('speakerHelp').textContent='Sortie sélectionnée. Utilisez « Tester les enceintes » pour vérifier.'}catch(e){if(e.name!=='NotAllowedError')$('speakerHelp').textContent='Impossible de changer la sortie : '+e.message}};
$("export").onclick=async()=>{const data=tracks.filter(t=>t.kind!=="demo").map(t=>({id:t.id,title:t.title,artist:t.artist,genre:t.genre,emoji:t.emoji,type:t.type,lrc:t.lrc||[]}));const blob=new Blob([JSON.stringify({app:"KaraokeWorld",version:3,playlists,favorites,tracks:data},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="karaokeworld-backup.json";a.click();URL.revokeObjectURL(a.href);$("backupStatus").textContent="Sauvegarde JSON exportée. Les fichiers audio/vidéo eux-mêmes ne sont pas inclus."};
$("importBackup").onclick=()=>$("backupFile").click();$("backupFile").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.tracks))throw Error("Fichier de sauvegarde invalide");for(const t of d.tracks){if(!t.id||!t.title)continue;if(tracks.some(x=>x.id===t.id))continue;tracks.push({...t,kind:"missing",url:"",blob:null})}if(Array.isArray(d.playlists)&&d.playlists.length)playlists=d.playlists.map(p=>({...p,trackIds:(p.trackIds||[])}));if(Array.isArray(d.favorites))favorites=d.favorites;currentPlaylistId=playlists[0]?.id||"default";syncQueue();localStorage.setItem("kw_favorites",JSON.stringify(favorites));drawTracks();drawPlaylists();$("backupStatus").textContent="Métadonnées importées. Réimportez les fichiers audio correspondants pour les lire."}catch(err){alert("Import impossible : "+err.message)}e.target.value=""};
$("forget").onclick=async()=>{if(confirm("Effacer les fichiers et métadonnées stockés par KaraokeWorld sur cet appareil ?")){await deleteAll();tracks=[...demo];playlists=[{id:"default",name:"Ma playlist",trackIds:[]}];currentPlaylistId="default";favorites=[];localStorage.removeItem("kw_favorites");syncQueue();drawTracks();drawPlaylists();$("backupStatus").textContent="Bibliothèque locale effacée."}};
function showPage(p){
  const show=(id,on)=>{const el=$(id);if(el)el.classList.toggle("hidden",!on)};
  document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
  show("homeHero",p==="home"); show("page-home",p==="home"||p==="library");
  show("favoritesSection",p==="home"); show("ideasSection",p==="home"); show("librarySection",p==="home"||p==="library");
  show("online",p==="home"); show("lyrics-search",p==="home");
  show("settings",p==="settings");
  const two=$("player")?.parentElement;if(two)two.classList.toggle("hidden",!(p==="home"||p==="playlist"||p==="mic"));
  show("player",p==="home"); show("queue-panel",p==="playlist"); show("mic-panel",p==="mic");
  if(p==="library")setTimeout(()=>$("query")?.focus(),0);
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("install").classList.remove("hidden")});$("install").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").classList.add("hidden")}};

function youtubeVideoId(value){try{const u=new URL(value.trim());if(u.hostname==="youtu.be")return u.pathname.split("/").filter(Boolean)[0]||"";if(u.hostname.endsWith("youtube.com")||u.hostname.endsWith("youtube-nocookie.com")){if(u.pathname==="/watch")return u.searchParams.get("v")||"";const m=u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);return m?m[1]:""}}catch(e){}return ""}
function parseLrc(text){const parsed=[];for(const line of (text||"").split(/\r?\n/)){const m=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);if(m)parsed.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()})}return parsed}
function ensureYouTubeApi(){return new Promise((resolve,reject)=>{if(window.YT&&YT.Player)return resolve();const old=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{if(typeof old==="function")old();resolve()};if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const sc=document.createElement("script");sc.src="https://www.youtube.com/iframe_api";sc.onerror=()=>reject(new Error("Impossible de charger le lecteur YouTube."));document.head.appendChild(sc)}})}
function startYoutubeSync(){clearInterval(ytTimer);ytTimer=setInterval(()=>{try{if(!ytPlayer||typeof ytPlayer.getCurrentTime!=="function")return;const sec=ytPlayer.getCurrentTime()||0,dur=ytPlayer.getDuration()||0;$('elapsed').textContent=fmt(sec);$('duration').textContent=fmt(dur);if(dur)$('seek').value=sec/dur*100;if($('stageElapsed'))$('stageElapsed').textContent=fmt(sec);if($('stageDuration'))$('stageDuration').textContent=fmt(dur);if(dur&&$('stageSeek'))$('stageSeek').value=sec/dur*100;renderLyrics(Math.max(0,mapVideoToLyricTime(sec)))}catch(e){}},200)}
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
  const q=(query||"").trim(), guessed=guessTitleArtist(q,videoTitle,channelTitle);
  const title=guessed.title||cleanYoutubeTitle(videoTitle)||q;
  let artist=guessed.artist||"";
  const channelArtist=cleanYoutubeTitle(channelTitle).replace(/\b(vevo|topic|official|officiel|music)\b/ig," ").replace(/\s+/g," ").trim();
  if(!artist&&channelArtist)artist=channelArtist;
  $('lyricsQuery').value=title;$('lyricsArtist').value=artist;
  $('lyricsResults').innerHTML='<p class="empty">Recherche de la version exacte des paroles synchronisées…</p>';
  $('state').textContent="Paroles · recherche de la bonne version…";
  try{
    const headers={"Lrclib-Client":"KaraokeWorld v0.21.0"},urls=[];
    if(title&&artist)urls.push("https://lrclib.net/api/search?track_name="+encodeURIComponent(title)+"&artist_name="+encodeURIComponent(artist));
    urls.push("https://lrclib.net/api/search?q="+encodeURIComponent([artist,title].filter(Boolean).join(" ")));
    if(title)urls.push("https://lrclib.net/api/search?track_name="+encodeURIComponent(title));
    let all=[];
    for(const url of urls){
      const res=await fetch(url,{headers});
      if(res.status===429)throw new Error("Trop de recherches LRCLIB. Réessaie dans quelques instants.");
      if(!res.ok)continue;
      const a=await res.json();if(Array.isArray(a))all.push(...a);
    }
    const seen=new Set(),items=all.filter(x=>{
      const k=x.id??[x.trackName,x.artistName,x.albumName,x.duration].join("|");
      if(seen.has(k))return false;seen.add(k);return !!x.syncedLyrics;
    });
    const norm=v=>normMatch(v),tokens=v=>new Set(norm(v).split(/\s+/).filter(w=>w.length>1));
    const sim=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let c=0;A.forEach(x=>B.has(x)&&c++);return c/Math.max(A.size,B.size)};
    const nt=norm(title),na=norm(artist),nv=norm(cleanYoutubeTitle(videoTitle)),nq=norm(q);
    const versionWords=v=>new Set((norm(v).match(/\b(live|remaster|remastered|acoustic|acoustique|instrumental|karaoke|radio|edit|version|mix|extended|concert)\b/g)||[]));
    const wantedVersions=versionWords(videoTitle+" "+q);
    const score=x=>{
      const tt=norm(x.trackName),aa=norm(x.artistName),meta=norm([x.trackName,x.albumName].join(" "));
      let s=0,ts=sim(tt,nt),as=sim(aa,na);
      if(tt===nt)s+=70;else if(nt&&(tt.includes(nt)||nt.includes(tt)))s+=45;else s+=Math.round(ts*30);
      if(na){
        if(aa===na)s+=70;
        else if(aa.includes(na)||na.includes(aa))s+=48;
        else if(as>=.65)s+=25;
        else s-=90; // mauvais artiste = quasi éliminé
      }
      if(nv&&tt&&nv.includes(tt))s+=15;if(nv&&aa&&nv.includes(aa))s+=18;
      if(nq&&aa&&nq.includes(aa))s+=12;
      const candVersions=versionWords(meta);
      wantedVersions.forEach(w=>{s+=candVersions.has(w)?12:-10});
      candVersions.forEach(w=>{if(!wantedVersions.has(w))s-=7});
      const d=Number(x.duration||0);
      if(videoDuration>0&&d>0){
        const diff=Math.abs(videoDuration-d);
        if(diff<=2)s+=38;else if(diff<=5)s+=30;else if(diff<=10)s+=18;else if(diff<=18)s+=6;
        else if(diff<=30)s-=12;else s-=35;
      }
      return s;
    };
    items.sort((a,b)=>score(b)-score(a));
    const top=items.slice(0,3),best=top[0]?score(top[0]):-999,runner=top[1]?score(top[1]):-999;
    // Une sélection automatique exige une identité artiste/titre solide et une marge claire.
    const first=top[0],artistOK=!na||(first&&sim(first.artistName,artist)>=.65)||(first&&norm(first.artistName)===na);
    const titleOK=first&&sim(first.trackName,title)>=.65;
    const durationOK=!videoDuration||!Number(first?.duration)||(Math.abs(videoDuration-Number(first.duration))<=18);
    const good=first&&artistOK&&titleOK&&durationOK&&best>=(artist?105:80)&&(best-runner>=12||best>=145);
    if(good){useAutoLyrics(first,true);return}
    lrc=[];renderLyrics(0);$('state').textContent="Paroles · plusieurs versions possibles";
    if(!top.length){$('lyricsResults').innerHTML='<p class="empty">Aucune parole synchronisée suffisamment proche trouvée.</p>';return}
    $('lyricsResults').innerHTML='<p class="empty">KaraokeWorld préfère te proposer les meilleures versions plutôt que charger de mauvaises paroles :</p>'+
      top.map((x,i)=>`<article class="lyric-result"><h3>${esc(x.trackName||"Titre inconnu")}</h3><p>${esc(x.artistName||"Artiste inconnu")}${x.albumName?" · "+esc(x.albumName):""}${x.duration?" · "+fmt(Number(x.duration)):""}</p><button data-auto-choice="${i}">Utiliser cette version</button></article>`).join("");
    top.forEach((x,i)=>{const b=document.querySelector(`[data-auto-choice="${i}"]`);if(b)b.onclick=()=>useAutoLyrics(x)});
  }catch(e){
    $('state').textContent="Vidéo YouTube · paroles non chargées";
    $('lyricsResults').innerHTML=`<p class="empty">Recherche automatique impossible : ${esc(e.message)}</p>`;
  }
}

const VIDEO_QUALITY_KEY="kw_video_quality_v1";
function getVideoQualityMode(){return localStorage.getItem(VIDEO_QUALITY_KEY)||"auto"}
function applyVideoQuality(){
  if(!ytPlayer||!ytPlayer.setPlaybackQuality)return;
  const mode=getVideoQualityMode();
  try{
    if(mode==="data")ytPlayer.setPlaybackQuality("small");
    else if(mode==="high")ytPlayer.setPlaybackQuality("hd720");
    else ytPlayer.setPlaybackQuality("default");
  }catch(e){}
}
function cycleVideoQuality(){
  const modes=["auto","data","high"],cur=getVideoQualityMode();
  const next=modes[(modes.indexOf(cur)+1)%modes.length];
  localStorage.setItem(VIDEO_QUALITY_KEY,next);applyVideoQuality();updateVideoQualityButton();
}
function updateVideoQualityButton(){
  const b=document.getElementById("videoQualityMode");if(!b)return;
  const m=getVideoQualityMode();
  b.textContent=m==="data"?"📶 Économie 240p/360p":m==="high"?"📺 Haute qualité":"📶 Qualité automatique";
}

const VIDEO_SYNC_KEY="kw_video_sync_v2";
function videoSyncMap(){try{return JSON.parse(localStorage.getItem(VIDEO_SYNC_KEY)||"{}")||{}}catch(e){return {}}}
function syncKey(){return currentYoutubeId?currentYoutubeId:""}
function currentSyncProfile(){const k=syncKey();if(!k)return null;return videoSyncMap()[k]||null}
function saveSyncProfile(p){const k=syncKey();if(!k)return;const m=videoSyncMap();m[k]={...(m[k]||{}),...p,updatedAt:Date.now()};localStorage.setItem(VIDEO_SYNC_KEY,JSON.stringify(m));updateVideoSyncStatus()}
function setOffset(v,label="Sync vidéo"){lyricOffset=Math.max(-20,Math.min(20,Math.round(Number(v||0)*10)/10));if($('offsetValue'))$('offsetValue').textContent=(lyricOffset>0?'+':'')+lyricOffset.toFixed(1)+' s';updateStageOffset();if(label&&$('state'))$('state').textContent=label}
function saveVideoOffset(){if(!syncKey())return;saveSyncProfile({globalOffset:lyricOffset,title:currentYoutubeTitle||""})}
function loadVideoSync(){const p=currentSyncProfile();setOffset(Number(p?.globalOffset||0),'');updateVideoSyncStatus();return p}
function mapVideoToLyricTime(videoTime){
  const p=currentSyncProfile(), a=(p?.anchors||[]).filter(x=>Number.isFinite(x.videoTime)&&Number.isFinite(x.lyricTime)).sort((x,y)=>x.videoTime-y.videoTime);
  if(!a.length)return videoTime+lyricOffset;
  if(a.length===1)return videoTime+(a[0].lyricTime-a[0].videoTime);
  let left=a[0],right=a[1];
  if(videoTime<=a[0].videoTime){left=a[0];right=a[1]}
  else if(videoTime>=a[a.length-1].videoTime){left=a[a.length-2];right=a[a.length-1]}
  else for(let i=0;i<a.length-1;i++)if(videoTime>=a[i].videoTime&&videoTime<=a[i+1].videoTime){left=a[i];right=a[i+1];break}
  const span=right.videoTime-left.videoTime;if(Math.abs(span)<.05)return videoTime+(left.lyricTime-left.videoTime);
  const ratio=(videoTime-left.videoTime)/span;
  return left.lyricTime+(right.lyricTime-left.lyricTime)*ratio;
}
function updateVideoSyncStatus(){const el=$('videoSyncStatus');if(!el)return;const p=currentSyncProfile(),n=p?.anchors?.length||0;el.textContent=!currentYoutubeId?'Aucune vidéo chargée':n?`Sync vidéo ✓ · ${n} repère${n>1?'s':''}`:(p?'Sync vidéo ✓ · décalage mémorisé':'Sync vidéo · aucun repère')}
function addCurrentLineAnchor(){
  if(!currentYoutubeId||!ytPlayer||!lrc.length){$('onlineStatus').textContent='Charge une vidéo et des paroles avant de créer un repère.';return}
  let vt=0;try{vt=Number(ytPlayer.getCurrentTime()||0)}catch(e){return}
  const mapped=mapVideoToLyricTime(vt);let idx=0;for(let i=0;i<lrc.length;i++){if(lrc[i].time<=mapped)idx=i;else break}
  const p=currentSyncProfile()||{globalOffset:lyricOffset,anchors:[]};let anchors=[...(p.anchors||[])];
  anchors=anchors.filter(a=>Math.abs(a.lyricTime-lrc[idx].time)>.05);anchors.push({lyricTime:lrc[idx].time,videoTime:Math.round(vt*100)/100});anchors.sort((a,b)=>a.videoTime-b.videoTime);
  saveSyncProfile({globalOffset:lyricOffset,anchors,title:currentYoutubeTitle||""});$('state').textContent='YouTube + paroles · Sync vidéo ✓';$('onlineStatus').textContent=`Repère enregistré : « ${lrc[idx].text||'♪'} » à ${fmt(vt)}.`
}
function resetVideoSync(){const k=syncKey();if(!k)return;const m=videoSyncMap();delete m[k];localStorage.setItem(VIDEO_SYNC_KEY,JSON.stringify(m));setOffset(0,'Sync vidéo réinitialisée');updateVideoSyncStatus()}
function applyAutoSync(){const p=loadVideoSync();if(p){$('state').textContent='YouTube + paroles · Sync vidéo ✓';return 'mémorisée'}setOffset(0,'YouTube + paroles · à synchroniser');return 'nouvelle'}

function useAutoLyrics(hit,automatic=false){
  const parsed=parseLrc(hit.syncedLyrics);if(!parsed.length)return;
  lrc=parsed;$('lyricsQuery').value=hit.trackName||$('lyricsQuery').value;$('lyricsArtist').value=hit.artistName||$('lyricsArtist').value;
  const syncMode=applyAutoSync();
  $('state').textContent=syncMode==='mémorisée'?"YouTube + paroles · Sync vidéo ✓":"YouTube + paroles · à synchroniser";
  $('lyricsResults').innerHTML=`<article class="lyric-result"><h3>${esc(hit.trackName||"")}</h3><p>${esc(hit.artistName||"")} · ✓ ${automatic?"trouvé et chargé automatiquement":"paroles chargées"}</p></article>`;
  renderLyrics(0);$('player').scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function youtubeEmbed(id,title="Vidéo YouTube",query="",channelTitle=""){
  currentYoutubeId=id;currentYoutubeTitle=title;currentYoutubeChannel=channelTitle;loadVideoSync();const watch=`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;youtubeQuery=(query||$('onlineQuery').value||title).trim();currentId=null;$('audio').pause();$('video').pause();$('audio').classList.add('hidden');$('video').classList.add('hidden');lrc=[];renderLyrics(0);
  $('youtubePlayer').innerHTML=`<div class="youtube-frame"><div id="ytApiPlayer"></div></div><div class="youtube-fallback"><span>Lecture YouTube synchronisée avec les paroles.</span><a class="button-link" href="${watch}" target="_blank" rel="noopener noreferrer">▶ Ouvrir sur YouTube</a></div>`;$('youtubePlayer').classList.remove('hidden');
  try{await ensureYouTubeApi();if(ytPlayer&&typeof ytPlayer.destroy==="function")try{ytPlayer.destroy()}catch(e){}ytPlayer=new YT.Player('ytApiPlayer',{videoId:id,playerVars:{rel:0,playsinline:1,origin:(location.protocol==='http:'||location.protocol==='https:')?location.origin:undefined},events:{onReady:()=>{startYoutubeSync();prepareLyricsForYouTube(youtubeQuery,title,channelTitle);setTimeout(()=>{let d=0;try{d=ytPlayer.getDuration()||0}catch(e){}autoLyricsForYouTube(youtubeQuery,title,channelTitle,d)},250)},onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING)startYoutubeSync();if(e.data===YT.PlayerState.ENDED&&!$('karaokeStage').classList.contains('hidden')){$('stageSongTitle').textContent='Bravo ! 🎉';$('stageSongArtist').textContent='Chanson terminée';$('stageSongInfo').classList.remove('fade')}}}});}catch(e){$('onlineStatus').textContent=e.message}
  $('state').textContent='YouTube prêt';$('player').scrollIntoView({behavior:"smooth",block:"nearest"});
}
const YT_KEY_STORAGE="karaokeworld_youtube_api_key_v1";
function setYoutubeMode(mode){youtubeMode=mode==="original"?"original":"karaoke";$('modeKaraoke').classList.toggle('active',youtubeMode==='karaoke');$('modeKaraoke').classList.toggle('secondary',youtubeMode!=='karaoke');$('modeOriginal').classList.toggle('active',youtubeMode==='original');$('modeOriginal').classList.toggle('secondary',youtubeMode!=='original');$('youtubeModeHelp').textContent=youtubeMode==='karaoke'?"Mode Karaoké : recherche en priorité des versions karaoké/instrumentales sans voix principale.":"Mode Original : recherche la chanson avec la voix du chanteur. Certaines vidéos officielles peuvent interdire la lecture intégrée."}
$('modeKaraoke').onclick=()=>setYoutubeMode('karaoke');$('modeOriginal').onclick=()=>setYoutubeMode('original');setYoutubeMode('karaoke');
$('youtubeApiKey').value=localStorage.getItem(YT_KEY_STORAGE)||"";$('saveYoutubeKey').onclick=()=>{const k=$('youtubeApiKey').value.trim();if(!k){$('youtubeKeyStatus').textContent="Colle d’abord ta clé YouTube Data API.";return}localStorage.setItem(YT_KEY_STORAGE,k);$('youtubeKeyStatus').textContent="✓ Clé enregistrée uniquement dans ce navigateur."};$('forgetYoutubeKey').onclick=()=>{localStorage.removeItem(YT_KEY_STORAGE);$('youtubeApiKey').value="";$('youtubeKeyStatus').textContent="Clé YouTube oubliée sur cet appareil."};
async function searchYouTubeCompatible(query){const q=query.trim();if(!q){$('onlineStatus').textContent="Saisis un titre ou un artiste.";return}const key=$('youtubeApiKey').value.trim()||localStorage.getItem(YT_KEY_STORAGE)||"";if(!key){$('onlineStatus').textContent="Ajoute d’abord une clé YouTube Data API v3.";return}$('youtubeResults').innerHTML='<p class="empty">Recherche YouTube en cours…</p>';try{const searchText=youtubeMode==='karaoke'?q+' karaoké instrumental':q+' officiel audio';const params=new URLSearchParams({part:'snippet',type:'video',maxResults:'12',q:searchText,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'fr',regionCode:'FR',safeSearch:'moderate',key});const r=await fetch('https://www.googleapis.com/youtube/v3/search?'+params);const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||('Erreur YouTube '+r.status));const items=(data.items||[]).filter(x=>x.id?.videoId);if(!items.length){$('youtubeResults').innerHTML='<p class="empty">Aucune vidéo intégrable trouvée.</p>';return}$('youtubeResults').innerHTML=items.map(x=>{const id=x.id.videoId,sn=x.snippet||{},thumb=sn.thumbnails?.medium?.url||sn.thumbnails?.default?.url||'';return `<article class="youtube-result"><img src="${esc(thumb)}" alt="" loading="lazy"><div class="youtube-result-info"><h3>${esc(sn.title||'Vidéo YouTube')}</h3><p>${esc(sn.channelTitle||'')}</p><button class="play-youtube-result" data-id="${esc(id)}" data-title="${esc(sn.title||'')}" data-channel="${esc(sn.channelTitle||'')}">▶ Lire + préparer les paroles</button><a class="yt-open" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">Voir sur YouTube</a></div></article>`}).join('');document.querySelectorAll('.play-youtube-result').forEach(b=>b.onclick=()=>youtubeEmbed(b.dataset.id,b.dataset.title,q,b.dataset.channel||''));$('onlineStatus').textContent=items.length+' vidéo(s) compatible(s) trouvée(s). Choisis-en une : KaraokeWorld identifiera automatiquement le morceau et chargera les meilleures paroles LRCLIB.'}catch(e){$('youtubeResults').innerHTML='<p class="empty">Impossible d’effectuer la recherche YouTube.</p>';$('onlineStatus').textContent='Erreur YouTube : '+e.message}}
function searchYouTubeFor(query){$('onlineQuery').value=query.trim();searchYouTubeCompatible(query);$('online').scrollIntoView({behavior:'smooth',block:'start'})}
$('searchEverywhere').onclick=()=>searchYouTubeFor($('query').value);$('query').addEventListener('keydown',e=>{if(e.key==='Enter')searchYouTubeFor($('query').value)});$('youtubeSearch').onclick=()=>searchYouTubeCompatible($('onlineQuery').value);$('onlineQuery').addEventListener('keydown',e=>{if(e.key==='Enter')$('youtubeSearch').click()});
$('loadYoutube').onclick=()=>{const raw=$('youtubeUrl').value.trim(),id=youtubeVideoId(raw);if(!id){$('onlineStatus').textContent='Lien YouTube non reconnu.';return}youtubeEmbed(id,'Vidéo YouTube',$('onlineQuery').value);$('onlineStatus').textContent='Lien chargé. Vérifie ensuite le titre et l’artiste avant de rechercher les paroles.'};$('youtubeUrl').addEventListener('keydown',e=>{if(e.key==='Enter')$('loadYoutube').click()});
$('offsetMinus').onclick=()=>{setOffset(lyricOffset-.5,'');saveVideoOffset()};$('offsetPlus').onclick=()=>{setOffset(lyricOffset+.5,'');saveVideoOffset()};$('offsetReset').onclick=()=>resetVideoSync();if($('syncCurrentLine'))$('syncCurrentLine').onclick=addCurrentLineAnchor;
async function searchOnlineLyrics(){
  const title=$("lyricsQuery").value.trim(), artist=$("lyricsArtist")?.value.trim()||"", out=$("lyricsResults");
  if(!title){out.innerHTML='<p class="empty">Saisis au moins le titre de la chanson.</p>';return}
  out.innerHTML='<p class="empty">Recherche en cours…</p>';
  try{
    const headers={"Lrclib-Client":"KaraokeWorld v0.21.0"};
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
function updateStageOffset(){if($("stageOffset"))$("stageOffset").textContent='Synchro '+(lyricOffset>0?'+':'')+lyricOffset.toFixed(1)+' s'}
function stageSongMeta(){let title=currentYoutubeTitle||'',artist=currentYoutubeChannel||'';if(currentId){const t=tracks.find(x=>x.id===currentId);if(t){title=t.title;artist=t.artist}}$("stageSongTitle").textContent=cleanYoutubeTitle(title)||'KaraokeWorld';$("stageSongArtist").textContent=cleanYoutubeTitle(artist)||'Prêt à chanter 🎤';clearTimeout(stageInfoTimer);$("stageSongInfo").classList.remove('fade');stageInfoTimer=setTimeout(()=>$("stageSongInfo")?.classList.add('fade'),5500)}
async function enterKaraokeStage(){const stage=$("karaokeStage"),yp=$("youtubePlayer");if(!stage)return;if(yp&&!yp.classList.contains('hidden')){youtubeHome={parent:yp.parentNode,next:yp.nextSibling};$("stageVideoSlot").appendChild(yp)}if(currentYoutubeId)$("stageBg").style.backgroundImage=`url(https://i.ytimg.com/vi/${currentYoutubeId}/hqdefault.jpg)`;else $("stageBg").style.backgroundImage='';stage.classList.remove('hidden');stage.setAttribute('aria-hidden','false');stageLastIdx=-999;renderStageLyrics(-1,0);updateStageOffset();stageSongMeta();try{if(stage.requestFullscreen)await stage.requestFullscreen()}catch(e){}}
function exitKaraokeStage(){const stage=$("karaokeStage"),yp=$("youtubePlayer");if(youtubeHome&&yp){youtubeHome.parent.insertBefore(yp,youtubeHome.next);youtubeHome=null}stage.classList.add('hidden');stage.setAttribute('aria-hidden','true');if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
async function stageCountdownPlay(){if(countdownRunning)return;if(!$("stageCountdownEnabled").checked){$("play").click();return}countdownRunning=true;const c=$("stageCountdown");c.classList.remove('hidden');for(const v of ['3','2','1','🎤']){c.textContent=v;await new Promise(r=>setTimeout(r,v==='🎤'?450:700))}c.classList.add('hidden');countdownRunning=false;$("play").click()}
function seekRelative(delta){try{if(ytPlayer&&typeof ytPlayer.getCurrentTime==='function'){ytPlayer.seekTo(Math.max(0,(ytPlayer.getCurrentTime()||0)+delta),true);return}}catch(e){}const m=$("video").classList.contains("hidden")?$("audio"):$("video");if(m.duration)m.currentTime=Math.max(0,Math.min(m.duration,m.currentTime+delta))}
$("fullscreenKaraoke").onclick=enterKaraokeStage;$("exitFullscreen").onclick=exitKaraokeStage;
$("stagePlay").onclick=stageCountdownPlay;$("stagePause").onclick=()=>$("pause").click();$("stageStop").onclick=()=>$("stop").click();
$("stageMinus").onclick=()=>{$("offsetMinus").click();updateStageOffset()};$("stagePlus").onclick=()=>{$("offsetPlus").click();updateStageOffset()};$("stageReset").onclick=()=>{$("offsetReset").click();updateStageOffset()};
$("stageSeek").oninput=()=>{const pct=Number($("stageSeek").value)/100;try{if(ytPlayer&&ytPlayer.getDuration()){ytPlayer.seekTo(ytPlayer.getDuration()*pct,true);return}}catch(e){}const m=$("video").classList.contains("hidden")?$("audio"):$("video");if(m.duration)m.currentTime=m.duration*pct};
document.querySelectorAll('.stage-layout').forEach(b=>b.onclick=()=>{const st=$("karaokeStage");st.classList.remove('layout-80','layout-100');if(b.dataset.layout==='80')st.classList.add('layout-80');if(b.dataset.layout==='100')st.classList.add('layout-100');document.querySelectorAll('.stage-layout').forEach(x=>x.classList.toggle('active',x===b))});
document.addEventListener('keydown',e=>{const open=!$("karaokeStage").classList.contains('hidden');if(!open)return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.code==='Space'){e.preventDefault();let playing=false;try{playing=ytPlayer&&ytPlayer.getPlayerState&&ytPlayer.getPlayerState()===1}catch(_){}if(!ytPlayer){const m=$("video").classList.contains('hidden')?$("audio"):$("video");playing=!m.paused}playing?$("pause").click():stageCountdownPlay()}else if(e.key==='ArrowLeft'){e.preventDefault();seekRelative(-5)}else if(e.key==='ArrowRight'){e.preventDefault();seekRelative(5)}else if(e.key.toLowerCase()==='f'){e.preventDefault();if(!document.fullscreenElement)$("karaokeStage").requestFullscreen?.();else document.exitFullscreen?.()}else if(e.key==='Escape'){exitKaraokeStage()}});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!$("karaokeStage").classList.contains('hidden')){const yp=$("youtubePlayer");if(youtubeHome&&yp){youtubeHome.parent.insertBefore(yp,youtubeHome.next);youtubeHome=null}$("karaokeStage").classList.add('hidden');$("karaokeStage").setAttribute('aria-hidden','true')}});


// === KaraokeWorld UltraStar engine v0.23.0 ===
let ultraStarGroups=[], ultraStarRaf=0, ultraStarCurrentId=null;
function usNorm(s){return String(s||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function usDecode(buf){for(const enc of ["utf-8","windows-1252","iso-8859-1"]){try{return new TextDecoder(enc,{fatal:enc==="utf-8"}).decode(buf)}catch(e){}}return new TextDecoder().decode(buf)}
function parseUltraStar(txt){
  const meta={}, raw=[]; let cur=[];
  const rx=/^([:*F])\s+(-?\d+)\s+(\d+)\s+(-?\d+)\s?(.*)$/;
  for(let line of txt.split(/\r?\n/)){
    line=line.trimEnd();
    if(line.startsWith("#")&&line.includes(":")){const i=line.indexOf(":");meta[line.slice(1,i).toUpperCase()]=line.slice(i+1).trim();continue}
    if(line.startsWith("-")){if(cur.length){raw.push(cur);cur=[]}continue}
    if(line==="E"){if(cur.length)raw.push(cur);break}
    const m=line.match(rx);if(m)cur.push({start:+m[2],dur:+m[3],pitch:+m[4],text:m[5]});
  }
  const bpm=parseFloat(String(meta.BPM||"").replace(",",".")), gap=parseFloat(String(meta.GAP||"").replace(",","."));
  if(!bpm||!Number.isFinite(gap)||!raw.length)throw Error("TXT UltraStar invalide");
  const beatMs=60000/(bpm*4);
  const groups=raw.map(a=>{const syllables=a.map(n=>({...n,start_s:gap/1000+n.start*beatMs/1000,end_s:gap/1000+(n.start+n.dur)*beatMs/1000}));return{syllables,start_s:syllables[0].start_s,end_s:Math.max(...syllables.map(x=>x.end_s))}});
  const lines=groups.map(g=>({time:g.start_s,text:g.syllables.map(x=>x.text).join("").trim()}));
  return {meta,bpm,gap,groups,lines};
}
async function importUltraStarFolder(fileList){
  const files=[...fileList], txts=files.filter(f=>/\.txt$/i.test(f.name));let added=0,missing=0,bad=0;
  $("ultraStarStatus").textContent=`Analyse de ${txts.length} fichiers UltraStar…`;
  for(const tf of txts){
    try{
      const us=parseUltraStar(usDecode(await tf.arrayBuffer()));
      const dir=tf.webkitRelativePath.split("/").slice(0,-1).join("/");
      const wanted=(us.meta.MP3||"").split(/[\\/]/).pop();
      const audio=files.find(f=>f.webkitRelativePath===dir+"/"+wanted)||
                  files.find(f=>f.webkitRelativePath.startsWith(dir+"/")&&/\.(mp3|ogg|m4a|wav)$/i.test(f.name));
      if(!audio){missing++;continue}
      const id="ultrastar_"+usNorm((us.meta.ARTIST||"")+"_"+(us.meta.TITLE||tf.name))+"_"+added;
      const coverName=(us.meta.COVER||"").split(/[\\/]/).pop();
      const cover=coverName?files.find(f=>f.webkitRelativePath===dir+"/"+coverName):null;
      const t={id,title:us.meta.TITLE||tf.name.replace(/\.txt$/i,""),artist:us.meta.ARTIST||"Artiste inconnu",genre:us.meta.GENRE||"Sans genre",emoji:"🎤",kind:"ultrastar",type:"audio",blob:audio,url:URL.createObjectURL(audio),created:Date.now(),lrc:us.lines,ultraStar:{bpm:us.bpm,gap:us.gap,groups:us.groups},coverUrl:cover?URL.createObjectURL(cover):""};
      // session import: exact File objects remain local and are not uploaded
      tracks=tracks.filter(x=>!(x.kind==="ultrastar"&&usNorm(x.artist+"|"+x.title)===usNorm(t.artist+"|"+t.title)));
      tracks.unshift(t);added++;
    }catch(e){bad++}
  }
  drawTracks();drawPlaylists();
  $("ultraStarBadge").textContent=`${added} prête${added!==1?"s":""}`;
  $("ultraStarStatus").textContent=`✅ ${added} chansons exactes ajoutées à KaraokeWorld${missing?` · ${missing} sans audio correspondant`:""}${bad?` · ${bad} TXT non compatibles`:""}.`;
}
const originalPlayTrack=playTrack;
playTrack=function(id){
  const t=tracks.find(x=>x.id===id);
  if(!t||t.kind!=="ultrastar"){ultraStarCurrentId=null;cancelAnimationFrame(ultraStarRaf);return originalPlayTrack(id)}
  currentId=id;lrc=t.lrc||[];ultraStarGroups=t.ultraStar?.groups||[];ultraStarCurrentId=id;
  $("state").textContent=`UltraStar exact · GAP ${(t.ultraStar.gap/1000).toFixed(3)} s`;
  $("audio").pause();$("video").pause();$("video").classList.add("hidden");$("audio").classList.remove("hidden");
  $("audio").src=t.url;$("audio").play().catch(()=>{});stageLastIdx=-999;renderUltraStarStage(0);$("player").scrollIntoView({behavior:"smooth",block:"nearest"});
  cancelAnimationFrame(ultraStarRaf);ultraStarTick();
}
function ultraStarEsc(s){return esc(s||"")}
function ultraStarLineHTML(group,sec,role){
  if(!group)return "";
  const syl=group.syllables||[];
  const words=syl.map(x=>{
    const done=sec>=x.end_s, active=sec>=x.start_s&&sec<x.end_s;
    const pct=active?Math.max(0,Math.min(100,(sec-x.start_s)/Math.max(.04,x.end_s-x.start_s)*100)):(done?100:0);
    const txt=ultraStarEsc(x.text).replace(/ /g,"&nbsp;");
    return `<span class="us-syl ${done?"done":""} ${active?"singing":""}" style="--us-progress:${pct.toFixed(1)}%">${txt}</span>`;
  }).join("");
  return `<div class="us-line ${role||""}">${words||"♪"}</div>`;
}
function renderUltraStarStage(sec){
  const box=$("stageLyrics"), normal=$("lyrics");
  if(!box||!ultraStarGroups.length)return;

  let activeIdx=-1, nextIdx=-1;
  for(let i=0;i<ultraStarGroups.length;i++){
    const g=ultraStarGroups[i];
    const following=ultraStarGroups[i+1];
    const visualEnd=following ? Math.max(g.end_s, following.start_s-0.02) : g.end_s+0.12;
    if(sec>=g.start_s && sec<=visualEnd){activeIdx=i;break}
    if(sec<g.start_s){nextIdx=i;break}
  }
  if(activeIdx>=0)nextIdx=activeIdx+1<ultraStarGroups.length?activeIdx+1:-1;

  const current=activeIdx>=0?ultraStarGroups[activeIdx]:null;
  const next=nextIdx>=0?ultraStarGroups[nextIdx]:null;

  if(current){
    box.innerHTML=`<div class="us-stage">${ultraStarLineHTML(current,sec,"current")}${ultraStarLineHTML(next,sec,"next")}</div>`;
    if(normal)normal.innerHTML=`<div class="us-compact">${ultraStarLineHTML(current,sec,"current")}${ultraStarLineHTML(next,sec,"next")}</div>`;
    return;
  }

  if(next){
    const wait=Math.max(0,next.start_s-sec);
    const isIntro=nextIdx===0;
    box.innerHTML=`<div class="us-stage ${isIntro?"intro":"instrumental"}">
      ${isIntro?'<div class="us-hint">Préparez-vous…</div>':'<div class="us-instrumental">♪ Instrumental ♪</div>'}
      ${(isIntro||wait<=5)?`<div class="us-count">${Math.max(1,Math.ceil(wait))}</div>`:""}
      ${ultraStarLineHTML(next,sec,"next")}
    </div>`;
    if(normal)normal.innerHTML=`<div class="us-compact">${ultraStarLineHTML(next,sec,"next")}</div>`;
    return;
  }

  // Fin de chanson : conserver la dernière phrase au lieu d'afficher Instrumental indéfiniment.
  const last=ultraStarGroups[ultraStarGroups.length-1];
  box.innerHTML=`<div class="us-stage">${ultraStarLineHTML(last,sec,"current")}</div>`;
  if(normal)normal.innerHTML=`<div class="us-compact">${ultraStarLineHTML(last,sec,"current")}</div>`;
}
function ultraStarTick(){
  if(!ultraStarCurrentId)return;
  const a=$("audio"),sec=a.currentTime||0;
  renderUltraStarStage(sec);
  const dur=Number.isFinite(a.duration)?a.duration:0;
  const pct=dur>0?(sec/dur)*100:0;
  const seek=$("seek"); if(seek&&dur>0)seek.value=pct;
  if($("elapsed"))$("elapsed").textContent=fmt(sec);
  if($("duration"))$("duration").textContent=fmt(dur);
  if($("stageSeek")&&dur>0)$("stageSeek").value=pct;
  if($("stageElapsed"))$("stageElapsed").textContent=fmt(sec);
  if($("stageDuration"))$("stageDuration").textContent=fmt(dur);
  ultraStarRaf=requestAnimationFrame(ultraStarTick);
}
function openUltraStarCatalog(){
  const term=($("query")?.value||"").trim(),p=new URLSearchParams();
  if(term)p.set("busqueda",term);p.set("idioma","fr");
  window.open("https://ultrastar-es.org/fr/canciones?"+p.toString(),"_blank","noopener");
}
document.addEventListener("DOMContentLoaded",()=>{
  const choose=()=>$("ultraStarFolder").click();
  $("importUltraStar")?.addEventListener("click",choose);$("ultraStarChoose")?.addEventListener("click",choose);
  $("ultraStarFolder")?.addEventListener("change",e=>importUltraStarFolder(e.target.files));
  $("ultraStarCatalog")?.addEventListener("click",openUltraStarCatalog);
});

boot();


// --- v0.19.4 : compte Google + synchronisation Firestore ---
const FIREBASE_CONFIG={
  apiKey:"AIzaSyAVxeozSOPKTzK4KPvSR3l6w6_i2P1J3Uw",
  authDomain:"karaokeworld-d503f.firebaseapp.com",
  projectId:"karaokeworld-d503f",
  storageBucket:"karaokeworld-d503f.firebasestorage.app",
  messagingSenderId:"678274820219",
  appId:"1:678274820219:web:9f6e3a972995325fe69ade",
  measurementId:"G-YPC26NZFJS"
};
function cloudPayload(){return {favorites:[...new Set(favorites)],playlists:playlists.map(p=>({id:p.id,name:p.name,trackIds:[...(p.trackIds||[])]})),currentPlaylistId,youtubeMode,lyricOffset,updatedAt:Date.now(),schema:1}}
function scheduleCloudSave(){if(!cloudUser||!cloudApi||cloudApplying)return;clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(()=>saveCloud(false),700)}
async function saveCloud(show=true){if(!cloudUser||!cloudApi)return;try{if(show)$('cloudStatus').textContent='Synchronisation en cours…';await cloudApi.setDoc(cloudApi.doc(cloudApi.fs,'users',cloudUser.uid),cloudPayload(),{merge:true});$('cloudStatus').textContent='✓ Synchronisé avec le cloud à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}catch(e){$('cloudStatus').textContent='Synchronisation impossible : '+e.message}}
function mergePlaylists(local,remote){const map=new Map();for(const p of [...(remote||[]),...(local||[])]){if(!p?.id)continue;const prev=map.get(p.id);map.set(p.id,{id:p.id,name:p.name||prev?.name||'Playlist',trackIds:[...new Set([...(prev?.trackIds||[]),...(p.trackIds||[])])]})}return [...map.values()]}
async function loadCloudAndMerge(){if(!cloudUser||!cloudApi)return;try{$('cloudStatus').textContent='Récupération de tes données…';const ref=cloudApi.doc(cloudApi.fs,'users',cloudUser.uid), snap=await cloudApi.getDoc(ref);cloudApplying=true;if(snap.exists()){const r=snap.data()||{};favorites=[...new Set([...(r.favorites||[]),...favorites])];playlists=mergePlaylists(playlists,r.playlists);if(r.youtubeMode==='karaoke'||r.youtubeMode==='original')youtubeMode=r.youtubeMode;if(Number.isFinite(r.lyricOffset))lyricOffset=r.lyricOffset;const wanted=r.currentPlaylistId;if(wanted&&playlists.some(p=>p.id===wanted))currentPlaylistId=wanted;localStorage.setItem('kw_favorites',JSON.stringify(favorites));localStorage.setItem('kw_playlists',JSON.stringify(playlists));localStorage.setItem('kw_current_playlist',currentPlaylistId);localStorage.setItem('kw_queue',JSON.stringify(currentPlaylist()?.trackIds||[]));drawTracks();drawPlaylists();$('cloudStatus').textContent='✓ Données de cet appareil fusionnées avec ton compte.'}else{$('cloudStatus').textContent='Premier appareil : création de ta sauvegarde cloud…'}cloudApplying=false;await saveCloud(false)}catch(e){cloudApplying=false;$('cloudStatus').textContent='Synchronisation impossible : '+e.message}}
function updateCloudUI(user){cloudUser=user||null;$('cloudSignedOut')?.classList.toggle('hidden',!!user);$('cloudSignedIn')?.classList.toggle('hidden',!user);if(user){$('cloudUserName').textContent=user.displayName||'Compte Google';$('cloudUserEmail').textContent=user.email||''}else $('cloudStatus').textContent='Synchronisation désactivée tant que tu n’es pas connecté.'}
async function initCloud(){try{const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged},{getFirestore,doc,getDoc,setDoc}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')]);const app=initializeApp(FIREBASE_CONFIG),auth=getAuth(app),fs=getFirestore(app);cloudApi={auth,fs,GoogleAuthProvider,signInWithPopup,signOut,doc,getDoc,setDoc};$('googleSignIn').onclick=async()=>{try{$('cloudStatus').textContent='Connexion Google…';await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){$('cloudStatus').textContent='Connexion impossible : '+e.message}};$('googleSignOut').onclick=()=>signOut(auth);$('syncNow').onclick=()=>saveCloud(true);onAuthStateChanged(auth,async user=>{updateCloudUI(user);if(user)await loadCloudAndMerge()})}catch(e){$('cloudStatus').textContent='Service cloud indisponible : '+e.message}}
if(location.protocol!=='file:')initCloud();

// v0.21.0 quality selector
window.addEventListener("DOMContentLoaded",()=>{const b=document.getElementById("videoQualityMode");if(b){updateVideoQualityButton();b.addEventListener("click",cycleVideoQuality)}});
