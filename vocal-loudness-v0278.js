/* KaraokeWorld v0.27.8 — compensation automatique de volume en Voix OFF */
(()=>{
  if(window.KaraokeWorldVocalLoudness?.installed)return;
  const VERSION='0.27.8';
  const STORAGE_KEY='kw_voice_loudness_v1';
  const MAX_GAIN_DB=4.0;
  const FALLBACK_DB=1.5;
  const $=id=>document.getElementById(id);

  let ctx=null,sourceNode=null,gainNode=null,limiter=null,audioEl=null;
  let patchedApi=null;
  let cache=loadCache();

  function loadCache(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch(e){return {}}}
  function saveCache(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(cache))}catch(e){}}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function dbToGain(db){return Math.pow(10,Number(db||0)/20)}
  function round1(n){return Math.round(Number(n||0)*10)/10}
  function manifestOf(t){return t?.cloudBackupManifest||t?.cloudManifest||null}
  function identityOf(t){const m=manifestOf(t)||{};return m.audioFileId||t?.cloudBackupDocId||t?.cloudDocId||`${t?.artist||''}|${t?.title||''}|${t?.id||''}`}
  function currentTrack(){try{return Array.isArray(tracks)?tracks.find(t=>t.id===currentId)||null:null}catch(e){return null}}
  function voiceIsOff(){return /Voix\s*:\s*OFF/i.test($('kwVoiceToggle')?.textContent||'')||/^🎶\s*Voix OFF/i.test($('kwVocalStatus')?.textContent||'')}

  async function ensureGraph(){
    const a=$('audio');if(!a)throw new Error('Lecteur audio introuvable.');
    if(audioEl===a&&ctx&&gainNode){if(ctx.state==='suspended')await ctx.resume().catch(()=>{});return}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio indisponible dans ce navigateur.');
    ctx=new AC();audioEl=a;
    sourceNode=ctx.createMediaElementSource(a);
    gainNode=ctx.createGain();gainNode.gain.value=1;
    limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-2.0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
    sourceNode.connect(gainNode);gainNode.connect(limiter);limiter.connect(ctx.destination);
    if(ctx.state==='suspended')await ctx.resume().catch(()=>{});
  }

  function setGainDb(db){
    if(!gainNode||!ctx)return;
    const target=dbToGain(clamp(db,0,MAX_GAIN_DB));
    try{gainNode.gain.cancelScheduledValues(ctx.currentTime);gainNode.gain.setTargetAtTime(target,ctx.currentTime,.035)}catch(e){gainNode.gain.value=target}
  }

  async function blobFromTrack(t){
    if(t?.blob instanceof Blob)return t.blob;
    if(t?.url){const r=await fetch(t.url);if(r.ok)return r.blob()}
    throw new Error('Audio original introuvable pour mesurer le volume.');
  }
  async function blobFromPlayer(){
    const a=$('audio');if(!a?.src)throw new Error('Instrumental introuvable dans le lecteur.');
    const r=await fetch(a.src);if(!r.ok)throw new Error('Impossible de lire l’instrumental pour mesurer le volume.');
    return r.blob();
  }
  async function decode(blob){
    await ensureGraph();
    const ab=await blob.arrayBuffer();
    return ctx.decodeAudioData(ab.slice(0));
  }

  function activeLoudnessDb(buffer){
    const channels=buffer.numberOfChannels||1,length=buffer.length||0;if(!length)return -60;
    const block=Math.max(2048,Math.round(buffer.sampleRate*.06));
    const stride=block*3;
    const sampleStep=Math.max(1,Math.floor(block/512));
    const values=[];
    for(let start=0;start<length;start+=stride){
      const end=Math.min(length,start+block);let sum=0,n=0;
      for(let i=start;i<end;i+=sampleStep){
        let mono=0;for(let ch=0;ch<channels;ch++)mono+=buffer.getChannelData(ch)[i]||0;mono/=channels;
        sum+=mono*mono;n++;
      }
      if(!n)continue;const rms=Math.sqrt(sum/n);if(rms<=0)continue;
      const db=20*Math.log10(rms);if(db>-50)values.push(db);
    }
    if(!values.length)return -50;
    values.sort((a,b)=>a-b);
    const lo=Math.floor(values.length*.40),hi=Math.max(lo+1,Math.floor(values.length*.90));
    let sum=0,n=0;for(let i=lo;i<hi;i++){sum+=values[i];n++}
    return n?sum/n:values[Math.floor(values.length*.65)];
  }

  async function calculateGain(t,instrumentalBlob){
    const key=identityOf(t);const old=cache[key];
    if(old&&Number.isFinite(old.db))return clamp(old.db,0,MAX_GAIN_DB);
    const originalBlob=await blobFromTrack(t);
    const [original,instrumental]=await Promise.all([decode(originalBlob),decode(instrumentalBlob)]);
    const originalDb=activeLoudnessDb(original),instrumentalDb=activeLoudnessDb(instrumental);
    const db=round1(clamp(originalDb-instrumentalDb,0,MAX_GAIN_DB));
    cache[key]={db,originalDb:round1(originalDb),instrumentalDb:round1(instrumentalDb),updatedAt:Date.now()};saveCache();
    return db;
  }

  function updatePanel(db){
    let line=$('kwVocalLoudnessInfo');
    const host=$('kwVocalPanel');if(!host)return;
    if(!line){line=document.createElement('div');line.id='kwVocalLoudnessInfo';line.className='muted';line.style.cssText='font-size:11px;margin-top:6px';host.appendChild(line)}
    if(Number.isFinite(db))line.textContent=`🔊 Compensation Voix OFF automatique : +${round1(db).toFixed(1)} dB · limiteur anti-saturation actif.`;
    else line.textContent='🔊 Compensation Voix OFF automatique active · niveau calculé séparément pour chaque chanson.';
  }

  async function afterToggle(){
    const t=currentTrack();
    if(!voiceIsOff()){setGainDb(0);updatePanel(null);return}
    if(!t)return;
    setGainDb(1.0);
    const status=$('kwVocalStatus');if(status)status.textContent=`⚖️ Voix OFF · équilibrage automatique du volume…`;
    let db=FALLBACK_DB;
    try{const stem=await blobFromPlayer();db=await calculateGain(t,stem)}catch(e){console.warn('KaraokeWorld mesure volume Voix OFF',e)}
    setGainDb(db);updatePanel(db);
    if(status)status.textContent=`🎶 Voix OFF · volume compensé automatiquement +${round1(db).toFixed(1)} dB`;
    const state=$('state');if(state)state.textContent=status?.textContent||`Voix OFF +${round1(db).toFixed(1)} dB`;
  }

  function patchApi(){
    const api=window.KaraokeWorldVocalSeparation;if(!api?.toggle)return false;
    if(api===patchedApi&&api.toggle?._kwLoudnessV0278)return true;
    if(api.toggle._kwLoudnessV0278){patchedApi=api;return true}
    const original=api.toggle.bind(api);
    const wrapped=async function(){
      try{await ensureGraph();setGainDb(0)}catch(e){console.warn('KaraokeWorld audio graph',e)}
      const out=await original(...arguments);
      await afterToggle();
      return out;
    };
    wrapped._kwLoudnessV0278=true;wrapped._kwOriginal=original;api.toggle=wrapped;patchedApi=api;return true;
  }

  function start(){
    updatePanel(null);patchApi();
    [250,600,1200,2500,5000].forEach(ms=>setTimeout(()=>{patchApi();updatePanel(null)},ms));
    setInterval(patchApi,1200);
    document.addEventListener('play',e=>{if(e.target?.id==='audio'&&ctx?.state==='suspended')ctx.resume().catch(()=>{})},true);
  }

  window.KaraokeWorldVocalLoudness={version:VERSION,installed:true,patchApi,setGainDb,recalculate:()=>{const t=currentTrack();if(t){delete cache[identityOf(t)];saveCache()}},getSaved:t=>cache[identityOf(t)]||null};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
