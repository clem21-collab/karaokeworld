/* KaraokeWorld v0.26.1 — préparation automatique des vidéos UltraStar à l'import
   Les vidéos déjà lisibles sont ignorées. Les vidéos incompatibles sont préparées
   une par une avec le même cache que le moteur v0.26.0. */
(()=>{
  const CACHE_NAME='karaokeworld-converted-video-v1';
  const WORKER_URL='./video-compat-worker-v0260.js';
  const VIDEO_RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
  const jobs=new Map();
  let worker=null,jobSeq=0,runToken=0;

  function $(id){return document.getElementById(id)}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
  function fp(file){return [file?.name||'video',file?.size||0,file?.lastModified||0].join('|')}
  function cacheKey(file){
    const base=fp(file);let h=2166136261;
    for(let i=0;i<base.length;i++){h^=base.charCodeAt(i);h=Math.imul(h,16777619)}
    return new URL(`./__kw_video_cache__/v1-${(h>>>0).toString(16)}.mp4`,location.href).href;
  }
  async function cached(file){
    if(!('caches' in window))return false;
    try{return !!(await (await caches.open(CACHE_NAME)).match(cacheKey(file)))}catch(e){return false}
  }
  async function putCached(file,blob){
    if(!('caches' in window))return;
    await (await caches.open(CACHE_NAME)).put(cacheKey(file),new Response(blob,{headers:{'Content-Type':'video/mp4'}}));
  }

  function ensureBox(){
    let box=$('ultraStarPreconvert');
    if(box)return box;
    const panel=$('ultrastarPanel');if(!panel)return null;
    box=document.createElement('div');box.id='ultraStarPreconvert';
    box.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a;display:none';
    box.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>🎬 Préparation automatique des vidéos</b><span id="ultraStarPreconvertCount" class="status">0/0</span></div><div id="ultraStarPreconvertText" class="muted" style="margin-top:6px">En attente…</div><div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden;margin-top:8px"><i id="ultraStarPreconvertBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#34d399,#56dfff)"></i></div>';
    panel.appendChild(box);return box;
  }
  function show(text,current,total,pct){
    const box=ensureBox();if(box)box.style.display='block';
    const c=$('ultraStarPreconvertCount');if(c)c.textContent=`${current}/${total}`;
    const t=$('ultraStarPreconvertText');if(t)t.textContent=text;
    const b=$('ultraStarPreconvertBar');if(b)b.style.width=`${Math.max(0,Math.min(100,pct||0))}%`;
  }
  function done(text,total){
    show(text,total,total,100);
  }

  function testPlayable(blob,timeout=3500){
    return new Promise(resolve=>{
      const v=document.createElement('video');v.preload='metadata';v.muted=true;v.playsInline=true;
      const url=URL.createObjectURL(blob);let settled=false;
      const end=ok=>{if(settled)return;settled=true;clearTimeout(timer);try{v.pause()}catch(e){}v.removeAttribute('src');try{v.load()}catch(e){}URL.revokeObjectURL(url);resolve(ok)};
      const timer=setTimeout(()=>end(v.readyState>=1),timeout);
      v.onloadedmetadata=()=>end(true);v.oncanplay=()=>end(true);v.onerror=()=>end(false);v.src=url;v.load();
    });
  }

  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker(WORKER_URL);return worker;
  }
  async function convert(file,mode,onProgress){
    const w=ensureWorker(),job=`pre-${Date.now()}-${++jobSeq}`,buf=await file.arrayBuffer();
    return await new Promise(resolve=>{
      const onMessage=e=>{
        const d=e.data||{};if(d.job!==job)return;
        if(d.type==='progress')onProgress?.(Math.round(Math.max(0,Math.min(1,d.progress||0))*100));
        if(d.type==='done'){w.removeEventListener('message',onMessage);resolve(new Blob([d.buffer],{type:'video/mp4'}))}
        if(d.type==='error'){w.removeEventListener('message',onMessage);resolve(null)}
      };
      w.addEventListener('message',onMessage);
      w.postMessage({type:'convert',job,name:file.name,mode,buffer:buf},[buf]);
    });
  }

  async function referencedVideos(fileList){
    const files=[...fileList],txts=files.filter(f=>/\.txt$/i.test(f.name)),found=[];
    for(const tf of txts){
      try{
        const text=await tf.text(),meta={};
        for(const line of text.split(/\r?\n/)){
          if(line.startsWith('#')&&line.includes(':')){
            const i=line.indexOf(':');meta[line.slice(1,i).toUpperCase()]=line.slice(i+1).trim();
          }
        }
        const dir=(tf.webkitRelativePath||tf.name).split('/').slice(0,-1).join('/');
        const wanted=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop();
        const exact=wanted?files.find(f=>((f.webkitRelativePath||f.name).split('/').slice(0,-1).join('/')===dir)&&f.name.toLowerCase()===wanted.toLowerCase()):null;
        const candidate=exact||files.find(f=>((f.webkitRelativePath||f.name).split('/').slice(0,-1).join('/')===dir)&&VIDEO_RX.test(f.name));
        if(candidate)found.push(candidate);
      }catch(e){}
    }
    const unique=new Map();
    for(const f of found)unique.set(fp(f),f);
    return [...unique.values()];
  }

  async function prepareOne(file,index,total,token){
    if(token!==runToken)return {status:'cancel'};
    if(await cached(file)){show(`Déjà prête : ${file.name}`,index,total,100);return {status:'cached'}}
    show(`Vérification : ${file.name}`,index,total,5);
    if(await testPlayable(file)){show(`Compatible directement : ${file.name}`,index,total,100);return {status:'native'}}

    const promise=(async()=>{
      let out=await convert(file,'remux',p=>show(`Adaptation rapide : ${file.name} · ${p}%`,index,total,p));
      if(out&&await testPlayable(out)){await putCached(file,out);return {status:'remux'}}

      out=await convert(file,'transcode',p=>show(`Conversion MP4 : ${file.name} · ${p}%`,index,total,p));
      if(out&&await testPlayable(out)){await putCached(file,out);return {status:'transcoded'}}
      return {status:'failed'};
    })();
    jobs.set(fp(file),promise);
    try{return await promise}finally{jobs.delete(fp(file))}
  }

  async function start(fileList){
    const token=++runToken,files=await referencedVideos(fileList);
    if(token!==runToken)return;
    const total=files.length;
    if(!total){done('Aucune vidéo UltraStar à préparer.',0);return}
    let converted=0,native=0,cachedCount=0,failed=0;
    show(`Analyse de ${total} vidéo${total>1?'s':''}…`,0,total,0);
    for(let i=0;i<files.length;i++){
      if(token!==runToken)return;
      const r=await prepareOne(files[i],i+1,total,token);
      if(r?.status==='native')native++;
      else if(r?.status==='cached')cachedCount++;
      else if(r?.status==='remux'||r?.status==='transcoded')converted++;
      else if(r?.status==='failed')failed++;
      await sleep(50);
    }
    if(worker){try{worker.terminate()}catch(e){}worker=null}
    const parts=[`${native} déjà compatible${native>1?'s':''}`,`${converted} préparée${converted>1?'s':''}`,`${cachedCount} déjà en cache`];
    if(failed)parts.push(`${failed} échec${failed>1?'s':''}`);
    done(`Préparation terminée · ${parts.join(' · ')}`,total);
  }

  const oldSet=window.setUltraStarStageVideo;
  if(typeof oldSet==='function'){
    window.setUltraStarStageVideo=function(track){
      const file=track?.compatVideoBlob||track?.videoBlob;
      const pending=file?jobs.get(fp(file)):null;
      if(pending){
        const s=$('state');if(s)s.textContent='🎬 Vidéo en cours de préparation…';
        pending.finally(()=>oldSet(track));
        return;
      }
      return oldSet(track);
    };
  }

  const folder=$('ultraStarFolder');
  if(folder)folder.addEventListener('change',e=>start(e.target.files));

  window.KaraokeWorldVideoPreconvert={
    version:'0.26.1',
    waitForFile:file=>jobs.get(fp(file))||Promise.resolve(),
    isPreparing:file=>jobs.has(fp(file))
  };
})();
