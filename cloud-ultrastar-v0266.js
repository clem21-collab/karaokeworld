/* KaraokeWorld v0.26.6 — bibliothèque UltraStar privée dans Firebase Storage */
(()=>{
const VERSION='0.26.6';
const AUDIO_RX=/\.(mp3|ogg|m4a|wav|aac|flac|opus)$/i;
const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
const COVER_RX=/\.(jpg|jpeg|png|webp)$/i;
let sdk=null, storage=null, fs=null, auth=null, ready=false, loading=false;
const $id=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'titre';
function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shortHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function status(text,kind=''){const el=$id('cloudUltraStarStatus');if(el){el.textContent=text;el.dataset.kind=kind}}
function progress(pct,text){const bar=$id('cloudUltraStarBar');if(bar)bar.style.width=Math.max(0,Math.min(100,pct||0))+'%';if(text)status(text)}
function user(){try{return cloudUser||auth?.currentUser||null}catch(e){return auth?.currentUser||null}}
function ensureUI(){
  if($id('cloudUltraStarBox'))return;
  const panel=$id('ultrastarPanel');if(!panel)return;
  const box=document.createElement('div');box.id='cloudUltraStarBox';
  box.style.cssText='margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#08182a';
  box.innerHTML=`<div class="row-head"><div><div class="eyebrow">CLOUD PRIVÉ</div><h3 style="margin:2px 0">☁ Ma bibliothèque UltraStar en ligne</h3></div><span id="cloudUltraStarBadge" class="status">Hors ligne</span></div>
  <p class="muted">Envoie une fois ton dossier UltraStar dans ton compte Google. Ensuite tes chansons peuvent être rechargées depuis un autre PC sans conserver le dossier local.</p>
  <div class="controls wrap"><button id="cloudUltraStarUpload" type="button">☁ Envoyer un dossier dans le cloud</button><button id="cloudUltraStarReload" class="secondary" type="button">🔄 Charger ma bibliothèque cloud</button><input id="cloudUltraStarInput" type="file" webkitdirectory multiple hidden></div>
  <div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden;margin-top:9px"><i id="cloudUltraStarBar" style="display:block;width:0;height:100%;background:linear-gradient(90deg,#8b5cf6,#38bdf8);transition:width .2s ease"></i></div>
  <p id="cloudUltraStarStatus" class="muted" style="margin:7px 0 0">Connecte-toi avec Google dans ⚙ Paramètres pour utiliser le cloud.</p>
  <div id="cloudUltraStarList" style="display:grid;gap:6px;margin-top:8px"></div>`;
  panel.appendChild(box);
  const input=$id('cloudUltraStarInput');
  $id('cloudUltraStarUpload').onclick=()=>{if(!user()){status('Connecte-toi d’abord avec Google dans ⚙ Paramètres.');return}input.click()};
  $id('cloudUltraStarReload').onclick=()=>loadCatalog(true);
  input.onchange=e=>uploadFolder(e.target.files);
}
async function waitForCloud(){
  ensureUI();
  for(let i=0;i<80;i++){
    try{if(typeof cloudApi!=='undefined'&&cloudApi?.auth&&cloudApi?.fs){auth=cloudApi.auth;fs=cloudApi.fs;break}}catch(e){}
    await sleep(100);
  }
  if(!auth||!fs)throw new Error('Connexion Firebase non initialisée');
  if(!sdk){
    const [st,fire,au]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
    ]);
    sdk={...st,...fire,...au};
    storage=st.getStorage(auth.app);
    au.onAuthStateChanged(auth,u=>{
      const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=u?'Connecté':'Hors ligne';
      if(u)loadCatalog(false);else clearCloudTracks();
    });
  }
  ready=true;return true;
}
function relDir(f){const p=String(f.webkitRelativePath||f.name).replace(/\\/g,'/');return p.split('/').slice(0,-1).join('/')}
function findSame(files,dir,name,rx){
  const exact=name&&files.find(f=>relDir(f)===dir&&f.name.toLowerCase()===name.toLowerCase());
  return exact||files.find(f=>relDir(f)===dir&&rx.test(f.name));
}
async function buildSongs(fileList){
  const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(f.name)),songs=[];
  for(const tf of txts){
    try{
      const parsed=parseUltraStar(usDecode(await tf.arrayBuffer()));
      const dir=relDir(tf),meta=parsed.meta||{};
      const mp3=String(meta.MP3||'').replace(/\\/g,'/').split('/').pop();
      const vid=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop();
      const cov=String(meta.COVER||'').replace(/\\/g,'/').split('/').pop();
      const audio=findSame(files,dir,mp3,AUDIO_RX);if(!audio)continue;
      const video=findSame(files,dir,vid,VIDEO_RX);
      const cover=findSame(files,dir,cov,COVER_RX);
      const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu';
      const songId=safe(artist)+'--'+safe(title)+'--'+shortHash(dir+'|'+artist+'|'+title);
      songs.push({songId,title,artist,genre:meta.GENRE||'Sans genre',dir,tf,audio,video,cover,parsed});
    }catch(e){console.warn('UltraStar cloud: TXT ignoré',tf.name,e)}
  }
  return songs;
}
function uploadOne(refObj,file,onPct){
  return new Promise((resolve,reject)=>{
    const task=sdk.uploadBytesResumable(refObj,file,{contentType:file.type||'application/octet-stream'});
    task.on('state_changed',snap=>onPct?.(snap.bytesTransferred,snap.totalBytes),reject,()=>resolve(task.snapshot));
  });
}
async function uploadFolder(fileList){
  if(loading)return;loading=true;
  try{
    await waitForCloud();const u=user();if(!u)throw new Error('Connecte-toi avec Google avant l’envoi.');
    const songs=await buildSongs(fileList);if(!songs.length)throw new Error('Aucune chanson UltraStar complète trouvée dans ce dossier.');
    const allAssets=songs.flatMap(s=>[s.tf,s.audio,s.video,s.cover].filter(Boolean));
    const totalBytes=allAssets.reduce((n,f)=>n+(f.size||0),0)||1;let completed=0;
    progress(0,`Préparation de ${songs.length} chanson${songs.length>1?'s':''}…`);
    for(let i=0;i<songs.length;i++){
      const s=songs[i],base=`users/${u.uid}/ultrastar/${s.songId}`,paths={};
      const assets=[['txt',s.tf],['audio',s.audio],['video',s.video],['cover',s.cover]].filter(x=>x[1]);
      for(const [role,file] of assets){
        const path=`${base}/${role}-${file.name.replace(/[\\/]/g,'_')}`;paths[role+'Path']=path;
        const r=sdk.ref(storage,path);
        await uploadOne(r,file,(sent)=>{
          const pct=((completed+sent)/totalBytes)*100;
          progress(pct,`☁ ${i+1}/${songs.length} · ${s.artist} — ${s.title} · ${Math.round(pct)} %`);
        });
        completed+=file.size||0;
      }
      const vg=parseFloat(String(s.parsed.meta?.VIDEOGAP||'0').replace(',','.'));
      const manifest={schema:1,title:s.title,artist:s.artist,genre:s.genre,bpm:s.parsed.bpm,gap:s.parsed.gap,videoGap:Number.isFinite(vg)?vg:0,originalDir:s.dir,...paths,updatedAt:Date.now(),createdAt:Date.now()};
      await sdk.setDoc(sdk.doc(fs,'users',u.uid,'ultrastar',s.songId),manifest,{merge:true});
    }
    progress(100,`✅ ${songs.length} chanson${songs.length>1?'s':''} envoyée${songs.length>1?'s':''} dans ta bibliothèque cloud.`);
    await loadCatalog(true);
  }catch(e){console.error(e);status('Cloud UltraStar : '+(e?.message||e),'error')}
  finally{loading=false;const input=$id('cloudUltraStarInput');if(input)input.value=''}
}
function clearCloudTracks(){
  try{tracks=tracks.filter(t=>!t.cloudUltraStar);drawTracks();drawPlaylists()}catch(e){}
  const list=$id('cloudUltraStarList');if(list)list.innerHTML='';
}
async function loadCatalog(show=true){
  try{
    await waitForCloud();const u=user();if(!u){if(show)status('Connecte-toi avec Google pour charger ta bibliothèque cloud.');return}
    if(show)status('Chargement de ta bibliothèque cloud…');
    const snap=await sdk.getDocs(sdk.collection(fs,'users',u.uid,'ultrastar'));
    const cloud=[];snap.forEach(d=>{const m=d.data()||{};cloud.push({id:'cloudus_'+d.id,title:m.title||'Titre UltraStar',artist:m.artist||'Artiste inconnu',genre:m.genre||'Sans genre',emoji:'☁️',kind:'ultrastar-cloud',type:'audio',created:m.updatedAt||m.createdAt||0,lrc:[],cloudUltraStar:true,cloudDocId:d.id,cloudManifest:m})});
    tracks=tracks.filter(t=>!t.cloudUltraStar);tracks.unshift(...cloud);drawTracks();drawPlaylists();renderCloudList(cloud);
    const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=`${cloud.length} en ligne`;
    status(cloud.length?`☁ ${cloud.length} chanson${cloud.length>1?'s':''} disponible${cloud.length>1?'s':''} depuis le cloud.`:'Ta bibliothèque cloud est vide.');
  }catch(e){console.error(e);if(show)status('Impossible de charger le cloud : '+(e?.message||e),'error')}
}
function renderCloudList(items){
  const box=$id('cloudUltraStarList');if(!box)return;
  box.innerHTML=items.slice(0,12).map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid #1c334d;border-radius:9px"><span>☁️</span><div style="min-width:0;flex:1"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${html(t.title)}</b><span class="muted">${html(t.artist)}</span></div><button class="secondary" type="button" data-cloud-play="${html(t.id)}">▶</button></div>`).join('')+(items.length>12?`<div class="muted">+ ${items.length-12} autre${items.length-12>1?'s':''} dans la bibliothèque.</div>`:'');
  box.querySelectorAll('[data-cloud-play]').forEach(b=>b.onclick=()=>playTrack(b.dataset.cloudPlay));
}
async function hydrateCloudTrack(t){
  if(t.cloudHydrated)return t;
  await waitForCloud();const m=t.cloudManifest||{};
  if(!m.txtPath||!m.audioPath)throw new Error('Fichiers cloud incomplets pour ce titre.');
  status(`Téléchargement de ${t.artist} — ${t.title}…`);
  const txtBlob=await sdk.getBlob(sdk.ref(storage,m.txtPath));
  const parsed=parseUltraStar(usDecode(await txtBlob.arrayBuffer()));
  const audioUrl=await sdk.getDownloadURL(sdk.ref(storage,m.audioPath));
  let videoBlob=null,videoName='';
  if(m.videoPath){try{videoBlob=await sdk.getBlob(sdk.ref(storage,m.videoPath));videoName=m.videoPath.split('/').pop().replace(/^video-/,'')}catch(e){console.warn('Vidéo cloud non chargée',e)}}
  let coverUrl='';if(m.coverPath){try{coverUrl=await sdk.getDownloadURL(sdk.ref(storage,m.coverPath))}catch(e){}}
  t.kind='ultrastar';t.type='audio';t.url=audioUrl;t.lrc=parsed.lines;t.ultraStar={bpm:parsed.bpm,gap:parsed.gap,groups:parsed.groups,meta:parsed.meta,video:parsed.meta?.VIDEO||videoName,videoGap:Number(m.videoGap||0)};t.videoBlob=videoBlob;t.videoName=videoName;t.coverUrl=coverUrl;t.cloudHydrated=true;
  status(`✅ ${t.artist} — ${t.title} chargé depuis le cloud.`);return t;
}
let basePlay=null;
function installPlayHook(){
  if(basePlay)return;try{basePlay=playTrack}catch(e){return}
  playTrack=async function(id){
    const t=tracks.find(x=>x.id===id);
    if(t?.kind==='ultrastar-cloud'){
      try{const state=$id('state');if(state)state.textContent='☁ Chargement UltraStar cloud…';await hydrateCloudTrack(t);drawTracks();return basePlay(id)}catch(e){console.error(e);status('Lecture cloud impossible : '+(e?.message||e),'error');const state=$id('state');if(state)state.textContent='Erreur cloud';return}
    }
    return basePlay(id);
  };
}
async function init(){ensureUI();installPlayHook();try{await waitForCloud();const badge=$id('cloudUltraStarBadge');if(badge)badge.textContent=user()?'Connecté':'Hors ligne';if(user())loadCatalog(false)}catch(e){status('Bibliothèque cloud prête dès que Firebase est disponible.') }}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.KaraokeWorldCloudUltraStar={version:VERSION,reload:()=>loadCatalog(true)};
})();
