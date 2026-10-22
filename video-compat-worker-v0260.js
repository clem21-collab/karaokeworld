/* KaraokeWorld v0.26.0 — worker de conversion vidéo locale (FFmpeg.wasm core) */
const CORE_JS = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js';
const CORE_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm';
let corePromise = null;
let currentJob = '';

async function getCore(){
  if(corePromise) return corePromise;
  corePromise = (async()=>{
    importScripts(CORE_JS);
    if(typeof createFFmpegCore !== 'function') throw new Error('FFmpeg core indisponible');
    const cfg = btoa(JSON.stringify({wasmURL:CORE_WASM, workerURL:''}));
    const core = await createFFmpegCore({mainScriptUrlOrBlob:`${CORE_JS}#${cfg}`});
    core.setProgress(({progress,time})=>{
      self.postMessage({type:'progress',job:currentJob,progress:Number(progress)||0,time:Number(time)||0});
    });
    return core;
  })();
  return corePromise;
}

function safeName(name){
  const ext=(String(name||'video.bin').match(/\.[a-z0-9]{1,6}$/i)||['.bin'])[0].toLowerCase();
  return `input${ext}`;
}

self.onmessage = async ev => {
  const {type,job,name,buffer,mode} = ev.data || {};
  if(type !== 'convert' || !buffer) return;
  currentJob = job || '';
  let input='', output='output.mp4';
  try{
    const core = await getCore();
    input = safeName(name);
    try{ core.FS.unlink(input); }catch(e){}
    try{ core.FS.unlink(output); }catch(e){}
    core.FS.writeFile(input,new Uint8Array(buffer));

    let args;
    if(mode === 'remux'){
      args=['-i',input,'-map','0:v:0?','-map','0:a:0?','-c','copy','-movflags','+faststart',output];
    }else{
      args=[
        '-i',input,
        '-map','0:v:0','-map','0:a:0?',
        '-c:v','libx264','-preset','ultrafast','-crf','27','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k',
        '-movflags','+faststart',
        output
      ];
    }
    const code = core.exec(...args);
    if(code !== 0) throw new Error(`FFmpeg a retourné le code ${code}`);
    const out = core.FS.readFile(output);
    const copy = out.slice().buffer;
    try{ core.FS.unlink(input); }catch(e){}
    try{ core.FS.unlink(output); }catch(e){}
    self.postMessage({type:'done',job:currentJob,mode,buffer:copy},[copy]);
  }catch(err){
    try{
      const core = await corePromise;
      if(core){ try{core.FS.unlink(input)}catch(e){} try{core.FS.unlink(output)}catch(e){} }
    }catch(e){}
    self.postMessage({type:'error',job:currentJob,mode,message:String(err?.message||err)});
  }
};
