/* KaraokeWorld 0.29.6 — voix UltraStar, communes aux deux éditions. */
(()=>{
 'use strict';
 if(window.KaraokeWorldDuets)return;
 const VERSION='0.29.6',palette=['#63d9ff','#ffae70','#dcafff','#a3e88e'];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=g=>(g.syllables||[]).map(n=>n.text||'').join('').trim().replace(/\s+/g,' ');
 const sameText=(a,b)=>text(a).replace(/~/g,'').trim().toLowerCase()===text(b).replace(/~/g,'').trim().toLowerCase();
 function parse(input){
  const sourceText=String(input).replace(/^\uFEFF/,'');
  if(!/^\s*P\s*[1-9]\s*$/m.test(sourceText))return null;
  const meta={},pending=new Map(),raw=[],voices=new Set();let selected=[1];
  const flush=id=>{const notes=pending.get(id);if(notes?.length){raw.push({id,notes});pending.set(id,[])}};
  for(let line of sourceText.split(/\r\n|\n|\r/)){
   line=line.replace(/\r$/,'');
   if(line.startsWith('#')&&line.includes(':')){const i=line.indexOf(':');meta[line.slice(1,i).trim().toUpperCase()]=line.slice(i+1).trim();continue}
   if(line.trim()==='E')break;
   const p=line.match(/^\s*P\s*([1-9])\s*$/);
   if(p){const id=Number(p[1]);const legacyBoth=id===3&&!/^2(?:\.|$)/.test(meta.VERSION||'')&&!meta.P3&&!meta.DUETSINGERP3;selected=legacyBoth?[1,2]:[id];continue}
   if(line.startsWith('-')){const m=line.match(/^-\s+(-?\d+)/);for(const id of selected){const a=pending.get(id);if(a?.length){if(m)a.lineBreakBeat=Number(m[1]);flush(id)}}continue}
   const n=line.match(/^([:*FRG])[ \t]+(-?\d+)[ \t]+(\d+)[ \t]+(-?\d+)(?:[ \t](.*))?$/);
   if(n)for(const id of selected){voices.add(id);if(!pending.has(id))pending.set(id,[]);pending.get(id).push({type:n[1],start:+n[2],dur:+n[3],pitch:+n[4],text:n[5]||''})}
  }
  for(const id of pending.keys())flush(id);
  if(voices.size<2)return null;
  const bpm=Number(String(meta.BPM||'').replace(',','.')),gap=Number(String(meta.GAP??'0').replace(',','.'));
  if(!Number.isFinite(bpm)||bpm<=0)throw Error('#BPM absent ou invalide');
  if(!Number.isFinite(gap))throw Error('#GAP absent ou invalide');
  if(/^yes$/i.test(meta.RELATIVE||''))throw Error('Temps UltraStar relatifs non pris en charge : exporte le TXT en temps absolus.');
  const names=Object.fromEntries([...voices].map(id=>[id,meta['P'+id]||meta['DUETSINGERP'+id]||'Chanteur '+id]));
  const parts=raw.map(({id,notes})=>{const syllables=notes.map(n=>({...n,start_s:(gap+n.start*15000/bpm)/1000,end_s:(gap+(n.start+n.dur)*15000/bpm)/1000}));const end_s=Math.max(...syllables.map(n=>n.end_s));return{duet:true,singers:[{id,name:names[id]}],syllables,start_s:Math.min(...syllables.map(n=>n.start_s)),end_s,lineBreak_s:Number.isFinite(notes.lineBreakBeat)?Math.max(end_s,(gap+notes.lineBreakBeat*15000/bpm)/1000):end_s}});
  parts.sort((a,b)=>a.start_s-b.start_s||a.singers[0].id-b.singers[0].id);
  const groups=[];
  for(const part of parts){
   const same=groups.find(g=>Math.abs(g.start_s-part.start_s)<.08&&Math.abs(g.end_s-part.end_s)<.08&&sameText(g,part)&&!g.singers.some(s=>s.id===part.singers[0].id));
   if(same){same.singers.push(...part.singers);same.parts.push(part);same.lineBreak_s=Math.max(same.lineBreak_s,part.lineBreak_s)}
   else groups.push({...part,parts:[part]});
  }
  return{meta,bpm,gap,groups,lines:groups.map(g=>({time:g.start_s,text:text(g)})),sourceText,parserVersion:4,duet:true,singerNames:names};
 }
 function prefer(songs){
  const selected=new Map();
  for(const s of songs){const key=s.songId||[s.dir,s.artist,s.title].join('|'),old=selected.get(key);if(!old||(!old.duet&&!old.parsed?.duet&&(s.duet||s.parsed?.duet)))selected.set(key,s)}
  return[...selected.values()];
 }
 function frame(groups,sec){
  const live=new Map();
  groups.forEach((g,index)=>{if(sec>=g.start_s&&sec<g.end_s+.2)for(const singer of g.singers||[])live.set(singer.id,index)});
  let current=[...new Set(live.values())].sort((a,b)=>groups[a].singers[0].id-groups[b].singers[0].id);
  let joined=null;
  if(current.length===2){const a=groups[current[0]],b=groups[current[1]];if(Math.abs(a.start_s-b.start_s)<.25&&sameText(a,b))joined={...a,singers:[...a.singers,...b.singers]}}
  const next=groups.findIndex(g=>g.start_s>sec);
  return{current,next,joined,key:current.join(',')+'|'+next+'|'+(joined?'both':'')};
 }
 function label(g){return g.singers.length>1?'Ensemble':g.singers[0].name}
 function color(g){return g.singers.length>1?'#efcd77':palette[(g.singers[0].id-1)%palette.length]}
 const css=`
.us-duet-view{width:100%;text-align:center}.us-duet-row{margin:12px 0;background:none;border:0}.us-singer-label{display:block;color:var(--kw-singer-color)!important;font:750 clamp(14px,2vw,22px)/1.3 system-ui!important;letter-spacing:.025em;margin-bottom:6px}
#stageLyrics .us-duet-view .us-line.current,#lyrics .us-duet-view .us-line.current{color:#f5eee5!important;font-size:clamp(28px,4.5vw,64px)!important}
#stageLyrics .us-duet-view.has-two .us-line.current,#lyrics .us-duet-view.has-two .us-line.current{font-size:clamp(23px,3.6vw,48px)!important}
#stageLyrics .us-duet-view .us-duet-row .us-syl.singing,#stageLyrics .us-duet-view .us-duet-row .us-syl.done,#lyrics .us-duet-view .us-duet-row .us-syl.singing,#lyrics .us-duet-view .us-duet-row .us-syl.done{color:var(--kw-singer-color)!important}
.us-duet-view .us-duet-next{opacity:.55;margin-top:20px}.us-duet-view .us-duet-next .us-line{font-size:clamp(18px,2.5vw,32px)!important}.us-duet-view .us-duet-next .us-singer-label{font-size:14px!important}.us-duet-view .us-instrumental{font-size:26px}.us-duet-view .us-count{font-size:24px}
@media(max-width:600px){.us-duet-row{margin:9px 0}.us-duet-view .us-duet-next{margin-top:12px}}
@media(prefers-reduced-motion:reduce){.us-duet-view *{animation:none!important;transition:none!important}}
`;
 let installed=false,lastKey='';
 function install(){
  if(installed)return;
  if(typeof renderUltraStarStage!=='function')return;
  installed=true;
  const style=document.createElement('style');style.id='kwUltraStarDuetStyle';style.textContent=css;document.head.appendChild(style);
  const previous=renderUltraStarStage;
  renderUltraStarStage=function(sec){
   if(!ultraStarGroups?.[0]?.duet){lastKey='';return previous.apply(this,arguments)}
   const stage=document.getElementById('stageLyrics'),normal=document.getElementById('lyrics');if(!stage||!normal)return;
   const f=frame(ultraStarGroups,sec),key=String(ultraStarCurrentId)+'|'+f.key;
   const row=(g,preview=false)=>'<div class="us-duet-row'+(preview?' us-duet-next':'')+'" style="--kw-singer-color:'+color(g)+'"><span class="us-singer-label"'+(g.singers.length>1?' title="'+escape(g.singers.map(s=>s.name).join(' et '))+'"':'')+'>'+escape(preview?'À suivre · '+label(g):label(g))+'</span>'+ultraStarLineHTML(g,sec,preview?'next':'current')+'</div>';
   if(key!==lastKey){
    const active=f.joined?[f.joined]:f.current.map(i=>ultraStarGroups[i]);let html='<div class="us-stage us-duet-view'+(active.length>1?' has-two':'')+'">';
    if(!active.length)html+='<div class="us-instrumental">'+(sec<ultraStarGroups[0].start_s?'Préparez-vous…':'♪ Instrumental')+'</div><div class="us-count"></div>';
    html+=active.map(g=>row(g)).join('');if(f.next>=0)html+=row(ultraStarGroups[f.next],true);html+='</div>';
    stage.innerHTML=html;normal.innerHTML=html;normal.classList.remove('ultrastar-hidden');lastKey=key;
   }
   if(!f.current.length&&f.next>=0)for(const box of [stage,normal]){const n=box.querySelector('.us-count');if(n)n.textContent=String(Math.max(1,Math.ceil(ultraStarGroups[f.next].start_s-sec)))}
   ultraStarPaint(sec);
  };
 }
 window.KaraokeWorldDuets={version:VERSION,parse,prefer,frame,label,color,install};
})();
