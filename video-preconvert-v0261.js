/* KaraokeWorld v0.26.4 — préconversion UltraStar parallèle + temps restant estimé */
(()=>{
const CACHE='karaokeworld-converted-video-v1',WORKER='./video-compat-worker-v0260.js',RX=/\.(mp4|m4v|webm|ogv|ogg|mov|mpeg|mpg|flv|avi|mkv|wmv|vob|ts|m2ts|mts|3gp|3g2)$/i;
const jobs=new Map(),active=new Map();let token=0,total=0,done=0,currentRun=null,ticker=0;
const $=id=>document.getElementById(id),key=f=>[f?.name||'video',f?.size||0,f?.lastModified||0].join('|'),limit=n=>Math.max(1,Math.min(4,parseInt(n,10)||2));
const concurrency=()=>limit(localStorage.getItem('kw_video_concurrency')||2),setConcurrency=n=>localStorage.setItem('kw_video_concurrency',String(limit(n)));
function ck(f){let h=2166136261,s=key(f);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return new URL(`./__kw_video_cache__/v1-${(h>>>0).toString(16)}.mp4`,location.href).href}
async function cached(f){try{return !!(await(await caches.open(CACHE)).match(ck(f)))}catch(e){return false}}
async function cache(f,b){try{await(await caches.open(CACHE)).put(ck(f),new Response(b,{headers:{'Content-Type':'video/mp4'}}))}catch(e){}}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtTime(sec){sec=Math.max(0,Math.round(Number(sec)||0));if(sec<60)return `${sec} s`;const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;if(h)return `${h} h ${String(m).padStart(2,'0')} min`;return `${m} min ${String(s).padStart(2,'0')} s`}
function phase(label){if(/Conversion MP4/i.test(label))return'transcode';if(/Adaptation/i.test(label))return'remux';if(/Vérification|Démarrage/i.test(label))return'check';return'other'}
function box(){let b=$('ultraStarPreconvert');if(b)return b;const p=$('ultrastarPanel');if(!p)return null;b=document.createElement('div');b.id='ultraStarPreconvert';b.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#09182a;display:none';b.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>🎬 Préparation automatique des vidéos</b><span id="ultraStarPreconvertCount" class="status">0/0</span></div><div id="ultraStarPreconvertText" class="muted" style="margin-top:6px"></div><div id="ultraStarPreconvertEta" style="margin-top:7px;font-weight:800">⏱ Calcul du temps restant…</div><div style="height:8px;background:#172a40;border-radius:99px;overflow:hidden;margin-top:8px"><i id="ultraStarPreconvertBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#34d399,#56dfff)"></i></div><div id="ultraStarPreconvertPool" class="muted" style="font-size:11px;margin-top:7px"></div><div id="ultraStarPreconvertActive" style="display:grid;gap:5px;margin-top:8px"></div>';p.appendChild(b);return b}
function activeEta(x){
  if(!x||x.p<=1)return null;
  const ph=phase(x.label);if(ph!=='remux'&&ph!=='transcode')return null;
  const elapsed=(Date.now()-(x.phaseStartedAt||x.startedAt||Date.now()))/1000;
  if(elapsed<4||x.p<3)return null;
  const rate=x.p/elapsed;if(rate<=0)return null;
  return Math.max(0,(100-x.p)/rate);
}
function averageJobSeconds(){
  const r=currentRun;if(!r)return null;
  const vals=(r.durations||[]).filter(x=>Number.isFinite(x)&&x>0);
  if(vals.length>=2){
    const s=[...vals].sort((a,b)=>a-b),mid=Math.floor(s.length/2);
    return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
  }
  const projected=[];
  for(const x of active.values()){
    const eta=activeEta(x);
    if(eta!=null){
      const elapsed=(Date.now()-(x.startedAt||Date.now()))/1000;
      projected.push(elapsed+eta);
    }
  }
  if(projected.length)return projected.reduce((a,b)=>a+b,0)/projected.length;
  return null;
}
function overallEta(){
  if(!currentRun||done>=total)return 0;
  const n=concurrency(),activeVals=[...active.values()];
  const activeWork=activeVals.reduce((sum,x)=>sum+(activeEta(x)??0),0);
  const unknownActive=activeVals.filter(x=>activeEta(x)==null).length;
  const avg=averageJobSeconds();
  const queued=Math.max(0,currentRun.entries.length-currentRun.next);
  if(avg==null&&activeWork<=0)return null;
  const fallback=avg??Math.max(8,activeWork/Math.max(1,activeVals.length));
  const work=activeWork+unknownActive*fallback+queued*fallback;
  const slots=Math.max(1,Math.min(n,Math.max(1,activeVals.length+queued)));
  return Math.max(1,work/slots);
}
function paint(text=''){
  const b=box();if(b)b.style.display='block';
  const n=concurrency(),queued=currentRun?Math.max(0,currentRun.entries.length-currentRun.next):0,running=currentRun?.running||active.size;
  if($('ultraStarPreconvertCount'))$('ultraStarPreconvertCount').textContent=`${done}/${total}`;
  if(text&&$('ultraStarPreconvertText'))$('ultraStarPreconvertText').textContent=text;
  if($('ultraStarPreconvertBar'))$('ultraStarPreconvertBar').style.width=`${total?Math.round(done/total*100):100}%`;
  if($('ultraStarPreconvertPool'))$('ultraStarPreconvertPool').textContent=`${running} active${running>1?'s':''} / ${n} autorisée${n>1?'s':''}${queued?` · ${queued} en attente`:''}`;
  const eta=overallEta(),etaEl=$('ultraStarPreconvertEta');
  if(etaEl){
    if(done>=total&&total>0)etaEl.textContent='⏱ Terminé';
    else if(eta==null)etaEl.textContent='⏱ Calcul du temps restant…';
    else etaEl.textContent=`⏱ Temps restant estimé : ~${fmtTime(eta)}`;
  }
  if($('ultraStarPreconvertActive'))$('ultraStarPreconvertActive').innerHTML=[...active.values()].map(x=>{
    const e=activeEta(x),extra=e==null?'':' · ~'+fmtTime(e)+' restante'+(e>=2?'s':'');
    return `<div style="padding:6px 8px;border:1px solid #1c334d;border-radius:8px"><div style="display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</span><b>${x.p}%</b></div><div class="muted" style="font-size:11px">${esc(x.label)}${extra}</div></div>`
  }).join('')
}
function progress(f,label,p){
  const k=key(f),now=Date.now(),old=active.get(k),ph=phase(label);
  let startedAt=old?.startedAt||now,phaseStartedAt=old?.phaseStartedAt||now;
  if(!old||old.phase!==ph||(old.p!=null&&p<old.p-15))phaseStartedAt=now;
  active.set(k,{name:f.name,label,p:Math.max(0,Math.min(100,Math.round(p||0))),startedAt,phaseStartedAt,phase:ph,size:f.size||0});
  paint()
}
function applyConcurrency(){if(currentRun&&currentRun.token===token){paint(`Limite modifiée : ${concurrency()} conversion${concurrency()>1?'s':''} simultanée${concurrency()>1?'s':''}`);currentRun.pump()}}
function settings(){if($('videoConcurrency'))return;const s=$('settings');if(!s)return;const d=document.createElement('div');d.innerHTML='<hr><h3>🎬 Conversion vidéo UltraStar</h3><p class="muted">Nombre de vidéos incompatibles préparées en même temps. Le changement est appliqué immédiatement à la file en cours.</p><div class="controls wrap" style="justify-content:flex-start"><label for="videoConcurrency">Conversions simultanées</label><select id="videoConcurrency"><option value="1">1 · Économie</option><option value="2">2 · Recommandé</option><option value="3">3 · Rapide</option><option value="4">4 · Très rapide</option></select><span id="videoConcurrencyHint" class="status"></span></div>';s.appendChild(d);const sel=$('videoConcurrency'),hint=$('videoConcurrencyHint'),sync=()=>{sel.value=String(concurrency());hint.textContent=`${concurrency()} à la fois`};sel.onchange=()=>{setConcurrency(sel.value);sync();applyConcurrency()};sync()}
function playable(blob,ms=3500){return new Promise(r=>{const v=document.createElement('video'),u=URL.createObjectURL(blob);let x=0;const end=ok=>{if(x)return;x=1;clearTimeout(t);v.removeAttribute('src');try{v.load()}catch(e){}URL.revokeObjectURL(u);r(ok)},t=setTimeout(()=>end(v.readyState>=1),ms);v.preload='metadata';v.muted=true;v.onloadedmetadata=()=>end(true);v.oncanplay=()=>end(true);v.onerror=()=>end(false);v.src=u;v.load()})}
async function convert(f,mode,cb){const w=new Worker(WORKER),job='pre-'+Date.now()+'-'+Math.random(),buf=await f.arrayBuffer();return new Promise(r=>{let x=0;const end=v=>{if(x)return;x=1;try{w.terminate()}catch(e){}r(v)};w.onmessage=e=>{const d=e.data||{};if(d.job!==job)return;if(d.type==='progress')cb(Math.round(Math.max(0,Math.min(1,d.progress||0))*100));else if(d.type==='done')end(new Blob([d.buffer],{type:'video/mp4'}));else if(d.type==='error')end(null)};w.onerror=()=>end(null);w.postMessage({type:'convert',job,name:f.name,mode,buffer:buf},[buf])})}
async function videos(list){const fs=[...list],txt=fs.filter(f=>/\.txt$/i.test(f.name)),out=[];for(const tf of txt)try{const meta={},text=await tf.text();for(const l of text.split(/\r?\n/))if(l[0]==='#'&&l.includes(':')){const i=l.indexOf(':');meta[l.slice(1,i).toUpperCase()]=l.slice(i+1).trim()}const dir=(tf.webkitRelativePath||tf.name).split('/').slice(0,-1).join('/'),wanted=String(meta.VIDEO||'').replace(/\\/g,'/').split('/').pop(),same=f=>(f.webkitRelativePath||f.name).split('/').slice(0,-1).join('/')===dir,c=(wanted&&fs.find(f=>same(f)&&f.name.toLowerCase()===wanted.toLowerCase()))||fs.find(f=>same(f)&&RX.test(f.name));if(c)out.push(c)}catch(e){}const m=new Map;out.forEach(f=>m.set(key(f),f));return[...m.values()]}
async function one(f,t){
  if(t!==token)return{status:'cancel'};
  progress(f,'Vérification…',4);
  if(await cached(f)){progress(f,'Déjà en cache',100);return{status:'cached'}}
  if(await playable(f)){progress(f,'Compatible directement',100);return{status:'native'}}
  let b=await convert(f,'remux',p=>progress(f,'Adaptation rapide…',p));
  if(b&&await playable(b)){await cache(f,b);progress(f,'Adaptée ✓',100);return{status:'converted'}}
  if(t!==token)return{status:'cancel'};
  b=await convert(f,'transcode',p=>progress(f,'Conversion MP4 H.264/AAC…',p));
  if(b&&await playable(b)){await cache(f,b);progress(f,'Convertie ✓',100);return{status:'converted'}}
  progress(f,'Échec automatique',100);return{status:'failed'}
}
async function start(list){
  const t=++token,fs=await videos(list);if(t!==token)return;
  total=fs.length;done=0;active.clear();
  if(ticker){clearInterval(ticker);ticker=0}
  if(!total){currentRun=null;paint('Aucune vidéo UltraStar à préparer.');return}
  const stats={native:0,cached:0,converted:0,failed:0},entries=fs.map(f=>{let resolve;const promise=new Promise(r=>resolve=r);jobs.set(key(f),promise);return{f,resolve}});
  let finishResolve;const finished=new Promise(r=>finishResolve=r);
  const run={token:t,entries,next:0,running:0,finished:false,pump:null,durations:[],startedAt:Date.now()};currentRun=run;
  ticker=setInterval(()=>{if(currentRun===run&&!run.finished)paint()},1000);
  const finishIfDone=()=>{if(run.finished||t!==token)return;if(done>=total&&run.running===0){run.finished=true;if(ticker){clearInterval(ticker);ticker=0}currentRun=null;active.clear();paint(`Terminé · ${stats.native} compatible${stats.native>1?'s':''} · ${stats.converted} préparée${stats.converted>1?'s':''} · ${stats.cached} en cache${stats.failed?` · ${stats.failed} échec${stats.failed>1?'s':''}`:''}`);finishResolve()}};
  const launch=e=>{
    run.running++;const jobStart=Date.now();progress(e.f,'Démarrage…',1);
    (async()=>{
      let r;try{r=await one(e.f,t)}catch(err){console.error(err);r={status:'failed'}}
      const duration=(Date.now()-jobStart)/1000;if(Number.isFinite(duration)&&duration>0)run.durations.push(duration);
      if(stats[r?.status]!==undefined)stats[r.status]++;
      done++;e.resolve(r);jobs.delete(key(e.f));active.delete(key(e.f));run.running--;
      paint(`Préparation en cours · ${done}/${total} terminée${done>1?'s':''}`);run.pump();finishIfDone()
    })()
  };
  run.pump=()=>{if(t!==token||run.finished)return;const wanted=concurrency();while(run.running<wanted&&run.next<run.entries.length){launch(run.entries[run.next++])}paint()};
  paint(`Analyse de ${total} vidéo${total>1?'s':''} · jusqu’à ${concurrency()} en parallèle`);
  run.pump();finishIfDone();await finished
}
const old=window.setUltraStarStageVideo;if(typeof old==='function')window.setUltraStarStageVideo=function(track){const f=track?.compatVideoBlob||track?.videoBlob,p=f&&jobs.get(key(f));if(p){if($('state'))$('state').textContent='🎬 Vidéo en cours de préparation…';p.finally(()=>old(track));return}return old(track)};
settings();document.addEventListener('DOMContentLoaded',settings,{once:true});const f=$('ultraStarFolder');if(f)f.addEventListener('change',e=>start(e.target.files));const small=document.querySelector('.brand small');if(small)small.textContent=' BETA · v0.26.4 · UltraStar 🎤';
window.KaraokeWorldVideoPreconvert={version:'0.26.4',getConcurrency:concurrency,setConcurrency:n=>{setConcurrency(n);applyConcurrency()},waitForFile:f=>jobs.get(key(f))||Promise.resolve(),isPreparing:f=>jobs.has(key(f))};
})();
