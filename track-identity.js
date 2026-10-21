/* KaraokeWorld — Track Identity Engine v0.2 */
const KWTrackIdentity=(()=>{
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(official|officiel|video|clip|audio|lyrics?|paroles|hd|4k)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
 const VERSION_WORDS=['live','remaster','remastered','acoustic','acoustique','instrumental','karaoke','radio edit','edit','extended','remix','mix','version','concert'];
 const versionTags=t=>{const n=normalize(t);return VERSION_WORDS.filter(x=>n.includes(normalize(x)))};
 const similarity=(a,b)=>{const A=new Set(normalize(a).split(' ').filter(Boolean)),B=new Set(normalize(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>B.has(x)&&n++);return 2*n/(A.size+B.size)};
 function identifyCandidate(q,c){const ts=similarity(q.title,c.title),as=q.artist?similarity(q.artist,c.artist):0.5,w=versionTags(`${q.title||''} ${q.version||''}`),g=versionTags(`${c.title||''} ${c.version||''}`),vm=[...new Set([...w,...g])].some(x=>w.includes(x)!==g.includes(x));let ds=null;if(Number.isFinite(q.duration)&&Number.isFinite(c.duration)){const gap=Math.abs(q.duration-c.duration);ds=Math.max(0,1-gap/12)}let score=ts*50+as*35;if(ds!==null)score+=ds*15;if(vm)score-=25;if(q.isrc&&c.isrc)score+=q.isrc===c.isrc?100:-100;return{...c,match:{score:Math.round(score),confidence:score>=90?'exact':score>=70?'probable':'weak',titleScore:ts,artistScore:as,durationScore:ds,versionMismatch:vm,exactIsrc:Boolean(q.isrc&&c.isrc&&q.isrc===c.isrc)}}}
 const rank=(q,c=[])=>c.map(x=>identifyCandidate(q,x)).sort((a,b)=>b.match.score-a.match.score);
 const recordingKey=t=>t.isrc?`isrc:${String(t.isrc).toUpperCase()}`:['meta',normalize(t.artist),normalize(t.title),Math.round(t.duration||0)].join(':');
 async function searchLrclib(track){
   const headers={'Lrclib-Client':'KaraokeWorld/track-identity-v0.2'};
   const urls=[];
   if(track.title&&track.artist)urls.push(`https://lrclib.net/api/search?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist)}`);
   if(track.title&&track.artist)urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(track.title+' '+track.artist)}`);
   if(track.title)urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(track.title)}`);
   let all=[],lastError=null;
   for(const url of urls){try{const res=await fetch(url,{headers});if(!res.ok){lastError=new Error(`LRCLIB ${res.status}`);continue}const rows=await res.json();if(Array.isArray(rows))all.push(...rows)}catch(e){lastError=e}}
   const seen=new Set();all=all.filter(x=>{const k=x.id??[x.trackName,x.artistName,x.albumName,x.duration].join('|');if(seen.has(k))return false;seen.add(k);return true});
   if(!all.length&&lastError)throw lastError;
   return rank(track,all.map(x=>({provider:'lrclib',providerId:x.id,title:x.trackName,artist:x.artistName,album:x.albumName,duration:Number(x.duration),syncedLyrics:x.syncedLyrics,plainLyrics:x.plainLyrics,hasWordSync:Boolean(x.hasWordSync)})));
 }
 function rankAppleMusic(t,s=[]){return rank(t,s.map(x=>({provider:'apple-music',providerId:x.id,title:x.attributes?.name,artist:x.attributes?.artistName,album:x.attributes?.albumName,duration:Number(x.attributes?.durationInMillis||0)/1000,isrc:x.attributes?.isrc||null,raw:x})))}
 function chooseLyrics(t,r=[]){const a=rank(t,r),b=a[0]||null;return !b||b.match.confidence==='weak'?{status:'no-reliable-match',best:null,candidates:a}:{status:b.match.confidence,best:b,candidates:a}}
 return{normalize,versionTags,identifyCandidate,rank,recordingKey,searchLrclib,rankAppleMusic,chooseLyrics};
})();
window.KWTrackIdentity=KWTrackIdentity;
