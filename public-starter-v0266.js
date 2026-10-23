/* KaraokeWorld v0.26.6 — chansons originales intégrées pour les nouveaux visiteurs */
(()=>{
const VERSION='0.26.6';
const SR=22050;
const NOTE={C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196,A3:220,B3:246.94,C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25};
const songs=[
 {id:'kw_original_ce_soir',title:'Ce soir on chante',artist:'KaraokeWorld Original',genre:'Pop',emoji:'✨',bpm:108,
  lines:['Ce soir on chante, on oublie le temps','Les lumières brillent et le cœur est content','Un mot, une note, et tout recommence','KaraokeWorld nous invite à la danse','Monte le son, laisse parler ta voix','Même si tu doutes, chante avec moi','Ce soir la scène appartient à chacun','Et demain matin, on s’en souvient'],
  melody:['C4','E4','G4','E4','D4','F4','G4','F4','A3','C4','E4','C4','F3','A3','C4','A3']},
 {id:'kw_original_lumieres',title:'Sous les lumières',artist:'KaraokeWorld Original',genre:'Pop',emoji:'🌟',bpm:96,
  lines:['Sous les lumières, la nuit devient légère','On prend le micro comme on prend un peu d’air','Les voix se mélangent au rythme de la salle','Un refrain suffit pour oublier le banal','Chante encore, même un peu plus fort','Chaque note nous rapproche du décor','Quand la musique emporte nos histoires','On garde un morceau de lumière en mémoire'],
  melody:['A3','C4','E4','C4','F3','A3','C4','A3','C4','E4','G4','E4','G3','B3','D4','B3']}
];
const $id=id=>document.getElementById(id);
function wav(track){
  const beat=60/track.bpm,bar=beat*4,dur=track.lines.length*bar+1,n=Math.floor(dur*SR),data=new Float32Array(n);
  const chords=[[NOTE.C3,NOTE.E3,NOTE.G3],[NOTE.G3,NOTE.B3,NOTE.D4],[NOTE.A3,NOTE.C4,NOTE.E4],[NOTE.F3,NOTE.A3,NOTE.C4]];
  function addTone(freq,start,len,amp){const a=Math.floor(start*SR),b=Math.min(n,Math.floor((start+len)*SR));for(let i=a;i<b;i++){const t=(i-a)/SR,env=Math.min(1,t/.05)*Math.min(1,(len-t)/.12);data[i]+=Math.sin(2*Math.PI*freq*t)*amp*env+Math.sin(2*Math.PI*freq*2*t)*amp*.18*env}}
  for(let barIdx=0;barIdx<track.lines.length;barIdx++){
    const start=barIdx*bar,ch=chords[barIdx%chords.length];ch.forEach(f=>addTone(f,start,bar*.92,.055));
    for(let b=0;b<4;b++){addTone(65,start+b*beat,.11,.12);if(b===1||b===3)addTone(180,start+b*beat,.06,.035)}
    for(let b=0;b<4;b++){const f=NOTE[track.melody[(barIdx*2+Math.floor(b/2))%track.melody.length]]||NOTE.C4;addTone(f,start+b*beat,beat*.82,.085)}
  }
  let max=.001;for(const x of data)max=Math.max(max,Math.abs(x));const scale=Math.min(1,.86/max);const buf=new ArrayBuffer(44+n*2),v=new DataView(buf);const wr=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};wr(0,'RIFF');v.setUint32(4,36+n*2,true);wr(8,'WAVE');wr(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);wr(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-32767,Math.min(32767,data[i]*scale*32767)),true);return new Blob([buf],{type:'audio/wav'})
}
function makeTrack(s){const beat=60/s.bpm,bar=beat*4;return{id:s.id,title:s.title,artist:s.artist,genre:s.genre,emoji:s.emoji,kind:'public-starter',type:'audio',url:'',created:Date.now()-1000,lrc:s.lines.map((text,i)=>({time:i*bar,text})),starter:s}}
let oldPlay=null;
function hook(){if(oldPlay)return;try{oldPlay=playTrack}catch(e){return}playTrack=function(id){const t=tracks.find(x=>x.id===id);if(t?.kind==='public-starter'&&!t.url){const blob=wav(t.starter);t.blob=blob;t.url=URL.createObjectURL(blob)}return oldPlay(id)}}
function decorate(){const sec=$id('ideasSection');if(sec){const h=sec.querySelector('h2');if(h)h.textContent='🎤 Chanter tout de suite';const eyebrow=sec.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='SANS IMPORTER DE FICHIER';let p=sec.querySelector('.kw-starter-note');if(!p){p=document.createElement('p');p.className='muted kw-starter-note';p.textContent='Deux morceaux KaraokeWorld Originals sont jouables immédiatement. Les autres suggestions utilisent la recherche en ligne.';sec.querySelector('.row-head')?.after(p)}}}
async function install(){
  for(let i=0;i<80;i++){if(Array.isArray(tracks)&&tracks.some(t=>t.id==='demo0'))break;await new Promise(r=>setTimeout(r,100))}
  if(!Array.isArray(tracks))return;const existing=new Set(tracks.map(t=>t.id));const add=songs.map(makeTrack).filter(t=>!existing.has(t.id));tracks.unshift(...add);hook();decorate();drawTracks();drawPlaylists();const sm=document.querySelector('.brand small');if(sm)sm.textContent=' BETA · v0.26.6 · UltraStar 🎤';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,50),{once:true});else setTimeout(install,50);
window.KaraokeWorldPublicStarter={version:VERSION};
})();
