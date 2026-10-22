/* KaraokeWorld v0.26.0 — compatibilité vidéo UltraStar
   Ordre : natif -> mpegts.js (FLV/TS) -> remux FFmpeg -> transcodage H.264/AAC.
   Les fichiers restent locaux dans le navigateur. */
(()=>{
  const MPEGTS_CDN='https://cdn.jsdelivr.net/npm/mpegts.js@1.8.2/dist/mpegts.min.js';
  const WORKER_URL='./video-compat-worker-v0260.js';
  const CACHE_NAME='karaokeworld-converted-video-v1';
  const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
  const compat={token:0,player:null,sourceUrl:'',playUrl:'',worker:null,jobSeq:0,ready:false};

  function $(id){return document.getElementById(id)}
  function extOf(name){return (String(name||'').toLowerCase().match(/\.([a-z0-9]+)$/)||[])[1]||''}
  function norm(s){return String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function videoElement(){return $('ultraStarStageVideo')}
  function setState(text){const s=$('state');if(s)s.textContent=text}

  function overlay(){
    const slot=$('stageVideoSlot');if(!slot)return null;
    let el=$('stageVideoCompat');
    if(!el){
      el=document.createElement('div');el.id='stageVideoCompat';el.className='stage-video-compat hidden';
      el.innerHTML='<b>🎬 Préparation vidéo</b><span id="stageVideoCompatText">Analyse…</span><div class="stage-video-compat-bar"><i id="stageVideoCompatBar"></i></div>';
      slot.appendChild(el);
    }
    return el;
  }
  function showProgress(text,pct=null){
    const el=overlay();if(el)el.classList.remove('hidden');
    const tx=$('stageVideoCompatText');if(tx)tx.textContent=text;
    const bar=$('stageVideoCompatBar');if(bar)bar.style.width=pct==null?'12%':`${Math.max(2,Math.min(100,pct))}%`;
    setState(text);
  }
  function hideProgress(){overlay()?.classList.add('hidden')}

  function revoke(url){if(url&&url.startsWith('blob:'))try{URL.revokeObjectURL(url)}catch(e){}}
  function stopWorker(){if(compat.worker){try{compat.worker.terminate()}catch(e){}compat.worker=null}}
  function cleanupMedia(){
    stopWorker();
    if(compat.player){try{compat.player.pause()}catch(e){}try{compat.player.unload()}catch(e){}try{compat.player.detachMediaElement()}catch(e){}try{compat.player.destroy()}catch(e){}compat.player=null}
    const v=videoElement();if(v){try{v.pause()}catch(e){}v.onerror=null;v.onloadedmetadata=null;v.removeAttribute('src');try{v.load()}catch(e){}v.classList.add('hidden')}
    revoke(compat.sourceUrl);revoke(compat.playUrl);compat.sourceUrl='';compat.playUrl='';compat.ready=false;hideProgress();
    try{if(typeof ultraStarVideoUrl!=='undefined')ultraStarVideoUrl=''}catch(e){}
  }

  function cacheKey(file){
    const base=[file?.name||'video',file?.size||0,file?.lastModified||0].join('|');
    let h=2166136261;
    for(let i=0;i<base.length;i++){h^=base.charCodeAt(i);h=Math.imul(h,16777619)}
    return new URL(`./__kw_video_cache__/v1-${(h>>>0).toString(16)}.mp4`,location.href).href;
  }
  async function getCached(file){
    if(!('caches' in window))return null;
    try{const r=await (await caches.open(CACHE_NAME)).match(cacheKey(file));return r?await r.blob():null}catch(e){return null}
  }
  async function putCached(file,blob){
    if(!('caches' in window))return;
    try{await (await caches.open(CACHE_NAME)).put(cacheKey(file),new Response(blob,{headers:{'Content-Type':'video/mp4'}}))}catch(e){}
  }

  function waitPlayable(v,timeout=4500){
    return new Promise(resolve=>{
      let done=false;
      const end=ok=>{if(done)return;done=true;clearTimeout(timer);v.removeEventListener('loadedmetadata',okFn);v.removeEventListener('canplay',okFn);v.removeEventListener('error',errFn);resolve(ok)};
      const okFn=()=>end(true),errFn=()=>end(false),timer=setTimeout(()=>end(v.readyState>=1),timeout);
      v.addEventListener('loadedmetadata',okFn,{once:true});v.addEventListener('canplay',okFn,{once:true});v.addEventListener('error',errFn,{once:true});
    });
  }

  async function applyBlob(blob,token,label='Vidéo prête'){
    if(token!==compat.token)return false;
    const v=videoElement();if(!v)return false;
    revoke(compat.playUrl);compat.playUrl=URL.createObjectURL(blob);
    v.src=compat.playUrl;v.classList.remove('hidden');v.load();
    const ok=await waitPlayable(v,5000);
    if(token!==compat.token)return false;
    if(ok){compat.ready=true;try{if(typeof ultraStarVideoUrl!=='undefined')ultraStarVideoUrl=compat.playUrl}catch(e){}hideProgress();setState(`UltraStar · ${label} ✓`);return true}
    v.pause();v.removeAttribute('src');v.load();revoke(compat.playUrl);compat.playUrl='';return false;
  }

  function loadMpegtsLib(){
    if(window.mpegts)return Promise.resolve(window.mpegts);
    if(window.__kwMpegtsPromise)return window.__kwMpegtsPromise;
    window.__kwMpegtsPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=MPEGTS_CDN;s.async=true;s.onload=()=>window.mpegts?resolve(window.mpegts):reject(new Error('mpegts.js non chargé'));s.onerror=()=>reject(new Error('Téléchargement mpegts.js impossible'));document.head.appendChild(s);
    });
    return window.__kwMpegtsPromise;
  }

  async function tryMpegts(file,token){
    const e=extOf(file.name);if(!['flv','ts','m2ts','mts'].includes(e))return false;
    showProgress(e==='flv'?'Compatibilité FLV…':'Compatibilité MPEG-TS…',18);
    try{
      const m=await loadMpegtsLib();if(token!==compat.token||!m?.isSupported?.())return false;
      const v=videoElement();if(!v)return false;
      compat.sourceUrl=URL.createObjectURL(file);
      const type=e==='flv'?'flv':(e==='m2ts'||e==='mts'?'m2ts':'mpegts');
      const p=m.createPlayer({type,isLive:false,url:compat.sourceUrl},{enableWorker:false,lazyLoad:true});
      compat.player=p;p.attachMediaElement(v);v.classList.remove('hidden');p.load();
      const ok=await new Promise(resolve=>{
        let done=false;const finish=x=>{if(done)return;done=true;clearTimeout(timer);resolve(x)};
        const timer=setTimeout(()=>finish(v.readyState>=1),6500);
        v.addEventListener('loadedmetadata',()=>finish(true),{once:true});
        try{p.on(m.Events.ERROR,()=>finish(false))}catch(e){}
      });
      if(token!==compat.token)return false;
      if(ok){compat.ready=true;try{if(typeof ultraStarVideoUrl!=='undefined')ultraStarVideoUrl=compat.sourceUrl}catch(e){}hideProgress();setState(`UltraStar · ${e.toUpperCase()} compatible ✓`);return true}
      try{p.destroy()}catch(e){}compat.player=null;revoke(compat.sourceUrl);compat.sourceUrl='';v.removeAttribute('src');v.load();
    }catch(e){console.warn('KaraokeWorld mpegts fallback',e)}
    return false;
  }

  function ensureWorker(){
    if(compat.worker)return compat.worker;
    compat.worker=new Worker(WORKER_URL);
    return compat.worker;
  }
  async function convert(file,mode,token){
    if(token!==compat.token)return null;
    const w=ensureWorker(),job=`kw-${Date.now()}-${++compat.jobSeq}`;
    showProgress(mode==='remux'?'Adaptation rapide de la vidéo…':'Conversion locale MP4…',mode==='remux'?25:5);
    const buf=await file.arrayBuffer();if(token!==compat.token)return null;
    return await new Promise(resolve=>{
      const onMessage=e=>{
        const d=e.data||{};if(d.job!==job)return;
        if(d.type==='progress'){
          const p=Math.round(Math.max(0,Math.min(1,d.progress||0))*100);
          showProgress(mode==='remux'?`Adaptation vidéo… ${p}%`:`Conversion vidéo… ${p}%`,p);
        }else if(d.type==='done'){
          w.removeEventListener('message',onMessage);resolve(new Blob([d.buffer],{type:'video/mp4'}));
        }else if(d.type==='error'){
          w.removeEventListener('message',onMessage);console.warn('KaraokeWorld FFmpeg',d.message);resolve(null);
        }
      };
      w.addEventListener('message',onMessage);
      w.postMessage({type:'convert',job,name:file.name,mode,buffer:buf},[buf]);
    });
  }

  async function prepare(track,token){
    const file=track?.compatVideoBlob||track?.videoBlob;
    if(!file){hideProgress();return}
    const v=videoElement();if(!v)return;
    v.classList.remove('hidden');

    const cached=await getCached(file);
    if(cached&&token===compat.token&&await applyBlob(cached,token,'Vidéo convertie en cache'))return;

    const e=extOf(file.name||track.videoName);
    if(e!=='flv' && !['ts','m2ts','mts'].includes(e)){
      showProgress('Test de lecture directe…',10);
      if(await applyBlob(file,token,'Vidéo directe'))return;
    }

    if(await tryMpegts(file,token))return;
    if(token!==compat.token)return;

    let out=await convert(file,'remux',token);
    if(out&&token===compat.token&&await applyBlob(out,token,'Vidéo adaptée')){await putCached(file,out);stopWorker();return}
    if(token!==compat.token)return;

    out=await convert(file,'transcode',token);
    if(out&&token===compat.token&&await applyBlob(out,token,'Vidéo convertie')){await putCached(file,out);stopWorker();return}

    stopWorker();hideProgress();
    if(token===compat.token){v.classList.add('hidden');setState(`Vidéo non convertible automatiquement (${track.videoName||file.name||'format inconnu'}) · audio + paroles disponibles`)}
  }

  function setVideo(track){
    compat.token++;const token=compat.token;cleanupMedia();
    if(!track?.videoBlob&&!track?.compatVideoBlob)return;
    prepare(track,token).catch(err=>{console.error(err);if(token===compat.token){hideProgress();setState('Erreur pendant la préparation de la vidéo · audio + paroles disponibles')}});
  }

  function syncVideo(sec){
    const v=videoElement();if(!v||!compat.ready)return;
    let off=0;try{off=(typeof ultraStarVideoOffset!=='undefined'?Number(ultraStarVideoOffset):0)||0}catch(e){}
    const target=Math.max(0,Number(sec||0)+off);
    const canSeek=(Number.isFinite(v.duration)&&v.duration>0)||(v.seekable&&v.seekable.length>0);
    if(canSeek&&Math.abs((v.currentTime||0)-target)>.42){
      try{v.currentTime=Number.isFinite(v.duration)?Math.min(v.duration,target):target}catch(e){}
    }
    const a=$('audio');
    if(a&&!a.paused){if(v.paused)v.play().catch(()=>{})}else if(!v.paused){try{v.pause()}catch(e){}}
  }

  async function enrichFolder(fileList){
    const files=[...fileList];const txts=files.filter(f=>/\.txt$/i.test(f.name));
    for(const tf of txts){
      try{
        const text=await tf.text(),meta={};
        for(const line of text.split(/\r?\n/))if(line.startsWith('#')&&line.includes(':')){const i=line.indexOf(':');meta[line.slice(1,i).toUpperCase()]=line.slice(i+1).trim()}
        const title=meta.TITLE||tf.name.replace(/\.txt$/i,''),artist=meta.ARTIST||'Artiste inconnu';
        const dir=(tf.webkitRelativePath||tf.name).split('/').slice(0,-1).join('/');
        const wanted=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop();
        const exact=wanted?files.find(f=>((f.webkitRelativePath||f.name).split('/').slice(0,-1).join('/')===dir)&&f.name.toLowerCase()===wanted.toLowerCase()):null;
        const candidate=exact||files.find(f=>((f.webkitRelativePath||f.name).split('/').slice(0,-1).join('/')===dir)&&VIDEO_RX.test(f.name));
        if(!candidate)continue;
        let track=null;
        for(let tries=0;tries<40&&!track;tries++){
          try{track=tracks.find(t=>t.kind==='ultrastar'&&norm(`${t.artist}|${t.title}`)===norm(`${artist}|${title}`))}catch(e){}
          if(!track)await new Promise(r=>setTimeout(r,100));
        }
        if(track){track.videoBlob=candidate;track.videoName=candidate.name;track.compatVideoBlob=candidate}
      }catch(e){console.warn('Association vidéo UltraStar',e)}
    }
  }

  window.setUltraStarStageVideo=setVideo;
  window.syncUltraStarVideo=syncVideo;
  try{window.ultraStarVideoSupported=f=>VIDEO_RX.test(String(f?.name||f||''))}catch(e){}

  const folder=$('ultraStarFolder');
  if(folder)folder.addEventListener('change',e=>enrichFolder(e.target.files));

  window.KaraokeWorldVideoCompat={version:'0.26.0',clearConvertedCache:async()=>{try{await caches.delete(CACHE_NAME);return true}catch(e){return false}}};
})();
