/* KaraokeWorld — Track Identity Engine v0.5 · multi-sources + tolérance durée de clip */
const KWTrackIdentity=(()=>{
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(official|officiel|video|clip|audio|lyrics?|paroles|hd|4k)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
 const VERSION_WORDS=['live','remaster','remastered','acoustic','acoustique','instrumental','karaoke','radio edit','edit','extended','remix','mix','version','concert'];
 const ARTIST_NOISE=new Set(['feat','ft','featuring','with','and','et','x']);
 const words=v=>normalize(v).split(' ').filter(Boolean);
 const artistWords=v=>words(v).filter(x=>!ARTIST_NOISE.has(x));
 const versionTags=t=>{const n=normalize(t);return VERSION_WORDS.filter(x=>n.includes(normalize(x)))};
 const dice=(A,B)=>{A=new Set(A);B=new Set(B);if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>B.has(x)&&n++);return 2*n/(A.size+B.size)};
 const similarity=(a,b)=>dice(words(a),words(b));
 const artistSimilarity=(a,b)=>dice(artistWords(a),artistWords(b));
 function identifyCandidate(q,c){
   const ts=similarity(q.title,c.title),as=q.artist?artistSimilarity(q.artist,c.artist):0.5;
   const w=versionTags(`${q.title||''} ${q.version||''}`),g=versionTags(`${c.title||''} ${c.version||''}`),vm=[...new Set([...w,...g])].some(x=>w.includes(x)!==g.includes(x));
   let ds=null,gap=null,clipDurationMismatch=false,clipOffsetEstimate=0;
   if(Number.isFinite(q.duration)&&Number.isFinite(c.duration)){
     gap=Math.abs(q.duration-c.duration);
     if(gap<=12)ds=Math.max(0,1-gap/12);
     else if(gap<=90&&ts>=0.78&&as>=0.5){clipDurationMismatch=true;clipOffsetEstimate=Math.max(0,q.duration-c.duration);ds=null}
     else ds=0;
   }
   let score=ts*50+as*35;if(ds!==null)score+=ds*15;if(vm)score-=25;if(q.isrc&&c.isrc)score+=q.isrc===c.isrc?100:-100;
   const confidence=score>=90?'exact':score>=68?'probable':'weak';
   return{...c,match:{score:Math.round(score),confidence,titleScore:ts,artistScore:as,durationScore:ds,durationGap:gap,clipDurationMismatch,clipOffsetEstimate,versionMismatch:vm,exactIsrc:Boolean(q.isrc&&c.isrc&&q.isrc===c.isrc)}}
 }
 const rank=(q,c=[])=>c.map(x=>identifyCandidate(q,x)).sort((a,b)=>b.match.score-a.match.score);
 const recordingKey=t=>t.isrc?`isrc:${String(t.isrc).toUpperCase()}`:['meta',normalize(t.artist),normalize(t.title),Math.round(t.duration||0)].join(':');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const statusFromResponse=r=>r?.status===429||r?.status===503||r?.status===504?'temporarily-unavailable':'error';
 function lrcTime(sec){sec=Math.max(0,Number(sec)||0);const m=Math.floor(sec/60),s=sec-m*60;return `[${String(m).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}]`}
 function timedToLrc(timed=[]){return timed.filter(x=>Number.isFinite(Number(x?.start))&&String(x?.text||'').trim()).map(x=>lrcTime(Number(x.start))+String(x.text).trim()).join('\n')}
 function dedupeCandidates(rows=[]){const seen=new Set();return rows.filter(x=>{const lyric=String(x.syncedLyrics||'').replace(/\s+/g,' ').slice(0,180),k=[normalize(x.title),normalize(x.artist),Math.round(Number(x.duration)||0),lyric].join('|');if(seen.has(k))return false;seen.add(k);return true})}
 function hasReliableSynced(rows=[]){return rows.some(x=>x.syncedLyrics&&x.match?.confidence!=='weak')}
 function splitArtists(value){return String(value||'').split(/\s+(?:feat\.?|ft\.?|featuring|with|x)\s+|\s*[&,/]\s*/i).map(x=>x.trim()).filter(Boolean)}

 async function lrclibFetch(url,headers){
   let last=null;
   for(let attempt=0;attempt<2;attempt++){
     try{const res=await fetch(url,{headers});if(res.ok)return res;last=new Error(`LRCLIB ${res.status}`);last.status=res.status;if(res.status===503||res.status===429){await sleep(600*(attempt+1));continue}return null}
     catch(e){last=e;await sleep(500*(attempt+1))}
   }
   if(last)throw last;return null;
 }
 async function searchLrclib(track){
   const headers={'Lrclib-Client':'KaraokeWorld/track-identity-v0.5'},urls=[];
   if(track.title&&track.artist)urls.push(`https://lrclib.net/api/search?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist)}`);
   if(track.title&&track.artist)urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(track.title+' '+track.artist)}`);
   if(track.title)urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(track.title)}`);
   let all=[],unavailable=false;
   for(const url of urls){try{const res=await lrclibFetch(url,headers);if(!res)continue;const rows=await res.json();if(Array.isArray(rows))all.push(...rows)}catch(e){if(e.status===503||e.status===429){unavailable=true;break}}}
   const seen=new Set();all=all.filter(x=>{const k=x.id??[x.trackName,x.artistName,x.albumName,x.duration].join('|');if(seen.has(k))return false;seen.add(k);return true});
   const ranked=rank(track,all.map(x=>({provider:'lrclib',providerId:x.id,title:x.trackName,artist:x.artistName,album:x.albumName,duration:Number(x.duration),syncedLyrics:x.syncedLyrics,plainLyrics:x.plainLyrics,hasWordSync:Boolean(x.hasWordSync)})));
   ranked.sourceStatus=unavailable?'temporarily-unavailable':ranked.length?'ok':'no-match';return ranked;
 }

 async function searchSyncLrc(track){
   try{
     let items=[];const artists=splitArtists(track.artist);
     if(track.title&&artists.length){
       const p=new URLSearchParams({track:track.title,type:'synced'});artists.forEach(a=>p.append('artist',a));
       const exact=await fetch('https://api.synclrc.dev/lyrics?'+p.toString(),{headers:{Accept:'application/json'}});
       if(exact.ok){const x=await exact.json();items.push({id:x.id,track:x.track,artist:x.artist,album:x.album,duration:x.duration,lyrics:{synced:x.synced||x.lyrics||null,karaoke:x.karaoke||null,plain:x.plain||null}})}
     }
     if(!items.length){
       const q=[track.title,track.artist].filter(Boolean).join(' ').trim();if(!q)return Object.assign([],{sourceStatus:'no-match'});
       const res=await fetch(`https://api.synclrc.dev/search?q=${encodeURIComponent(q)}&limit=15`,{headers:{Accept:'application/json'}});
       if(!res.ok){const rows=[];rows.sourceStatus=statusFromResponse(res);return rows}
       const data=await res.json();items=Array.isArray(data?.results)?data.results:[];
     }
     const mapped=items.map(x=>({provider:'synclrc',providerId:x.id,title:x.track,artist:x.artist,album:x.album,duration:Number(x.duration),syncedLyrics:x.lyrics?.synced||x.synced||null,karaokeLyrics:x.lyrics?.karaoke||x.karaoke||null,plainLyrics:x.lyrics?.plain||x.plain||null,hasWordSync:Boolean(x.lyrics?.karaoke||x.karaoke)}));
     const ranked=rank(track,mapped);ranked.sourceStatus=ranked.length?'ok':'no-match';return ranked;
   }catch(e){const rows=[];rows.sourceStatus='temporarily-unavailable';return rows}
 }

 async function searchLiriqo(track){
   try{
     const p=new URLSearchParams();
     if(track.title&&track.artist){p.set('title',track.title);p.set('artist',track.artist)}else p.set('Q',[track.title,track.artist].filter(Boolean).join(' '));
     const res=await fetch('https://api.liriqo-alfarrizi.my.id/v1/lyrics?'+p.toString(),{headers:{Accept:'application/json'}});
     if(!res.ok){const rows=[];rows.sourceStatus=statusFromResponse(res);return rows}
     const data=await res.json(),meta=data?.metadata||{},items=Array.isArray(data?.tracks)?data.tracks:[];
     const mapped=items.filter(x=>Array.isArray(x?.timed)&&x.timed.length).map((x,i)=>({provider:'liriqo',providerDetail:x.provider||'multi-provider',providerId:`${data?.videoId||'track'}:${x.provider||i}`,title:meta.title||track.title,artist:meta.artist||track.artist,album:meta.album||'',duration:Number(meta.duration||track.duration),isrc:meta.isrc||null,syncLevel:x.syncLevel||'line',syncedLyrics:timedToLrc(x.timed),plainLyrics:x.plain||null,hasWordSync:x.syncLevel==='word'||x.syncLevel==='syllable'}));
     const ranked=rank(track,mapped);ranked.sourceStatus=ranked.length?'ok':'no-match';return ranked;
   }catch(e){const rows=[];rows.sourceStatus='temporarily-unavailable';return rows}
 }

 async function searchFallback(track){
   const [sync,liri]=await Promise.all([searchSyncLrc(track),searchLiriqo(track)]),sources=[{provider:'synclrc',status:sync.sourceStatus||'ok',results:sync},{provider:'liriqo',status:liri.sourceStatus||'ok',results:liri}],results=rank(track,dedupeCandidates([...sync,...liri]));
   return{provider:'fallback',status:results.length?'ok':'no-match',results,sources};
 }
 async function searchLyricsMultiSource(track){
   const sources=[];let lr=[];
   try{lr=await searchLrclib(track);sources.push({provider:'lrclib',status:lr.sourceStatus||'ok',results:lr})}catch(e){sources.push({provider:'lrclib',status:'temporarily-unavailable',results:[]})}
   if(hasReliableSynced(lr))return{results:lr,sources,usedProvider:'lrclib'};
   const [sync,liri]=await Promise.all([searchSyncLrc(track),searchLiriqo(track)]);
   sources.push({provider:'synclrc',status:sync.sourceStatus||'ok',results:sync},{provider:'liriqo',status:liri.sourceStatus||'ok',results:liri});
   const results=rank(track,dedupeCandidates([...lr,...sync,...liri]));
   const best=results.find(x=>x.syncedLyrics&&x.match?.confidence!=='weak');
   return{results,sources,usedProvider:best?.provider||null};
 }
 function rankAppleMusic(t,s=[]){return rank(t,s.map(x=>({provider:'apple-music',providerId:x.id,title:x.attributes?.name,artist:x.attributes?.artistName,album:x.attributes?.albumName,duration:Number(x.attributes?.durationInMillis||0)/1000,isrc:x.attributes?.isrc||null,raw:x})))}
 function chooseLyrics(t,r=[]){const a=rank(t,r),b=a[0]||null;return !b||b.match.confidence==='weak'?{status:'no-reliable-match',best:null,candidates:a}:{status:b.match.confidence,best:b,candidates:a}}
 return{normalize,versionTags,identifyCandidate,rank,recordingKey,searchLrclib,searchSyncLrc,searchLiriqo,searchFallback,searchLyricsMultiSource,rankAppleMusic,chooseLyrics};
})();
window.KWTrackIdentity=KWTrackIdentity;
