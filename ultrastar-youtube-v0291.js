/* KaraokeWorld v0.29.1 — TXT UltraStar + vidéo YouTube (audio privé, sans MP3) */
(()=>{
  try { if(window.parent!==window && /\/60ans(?:\/|$)/.test(window.parent.location.pathname)) return; } catch(e) {}
  if(window.KaraokeWorldUltraStarYouTube?.installed) return;
  const $=id=>document.getElementById(id);
  const VERSION='0.29.1';
  const clean=s=>String(s||'').trim();
  const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function hash(s){let h=2166136261;for(const ch of String(s)){h=Math.imul(h^ch.charCodeAt(0),16777619)}return (h>>>0).toString(16)}
  function getYoutubeId(value){
    const raw=clean(value);
    const embedded=raw.match(/(?:^|[,;\s])a=([A-Za-z0-9_-]{11})(?=$|[,;\s])/);
    if(embedded)return embedded[1];
    if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
    try {
      const u=new URL(raw);
      if(u.hostname==='youtu.be') {const id=u.pathname.split('/').filter(Boolean)[0]||'';return /^[A-Za-z0-9_-]{11}$/.test(id)?id:''}
      if(/^(?:www\.|m\.)?youtube(?:-nocookie)?\.com$/.test(u.hostname)){
        const id=u.pathname==='/watch'?(u.searchParams.get('v')||''):(u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)||[])[1]||'';
        return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
      }
    } catch(e) {}
    return '';
  }
  function say(message,bad=false){
    const el=$('kwYtUsStatus');if(!el)return;
    el.textContent=message;el.style.color=bad?'#f4a8a8':'';
  }
  function panel(){
    const host=$('ultrastarPanel');if(!host||$('kwYtUsPanel'))return;
    const section=document.createElement('section');
    section.id='kwYtUsPanel';
    section.className='kw-ytus-panel';
    section.innerHTML=`
      <div class="kw-ytus-head"><strong>🎬 TXT UltraStar + YouTube</strong><span>Sans MP3 à importer</span></div>
      <p>Tu as seulement un TXT provenant d'USDB ou d'UltraStar ? KaraokeWorld peut utiliser la vidéo YouTube indiquée dans <code>#VIDEO</code> et conserver les notes, le BPM et le GAP du TXT.</p>
      <div class="kw-ytus-controls">
        <button type="button" id="kwYtUsChoose">＋ Importer un TXT seul</button>
        <input type="file" id="kwYtUsFile" accept=".txt,text/plain" hidden>
        <input id="kwYtUsUrl" type="url" placeholder="Lien YouTube (facultatif si #VIDEO contient a=…)" aria-label="Lien YouTube facultatif">
      </div>
      <p id="kwYtUsStatus" role="status" aria-live="polite">La chanson reste dans ta bibliothèque locale ; seul le lecteur officiel YouTube diffuse la vidéo.</p>
      <p class="kw-ytus-note">La vidéo doit autoriser l'intégration. Les paroles restent synchronisées selon la version vidéo et peuvent nécessiter un petit décalage.</p>`;
    host.appendChild(section);
    const style=document.createElement('style');
    style.textContent=`
      .kw-ytus-panel{margin-top:16px;padding:16px;border:1px solid #96654488;border-radius:15px;background:linear-gradient(125deg,rgba(38,31,37,.8),rgba(23,30,45,.82));box-shadow:0 8px 26px rgba(0,0,0,.13)}
      .kw-ytus-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;color:#f6d5aa;font-size:1rem}
      .kw-ytus-head span{font-size:.75rem;color:#dab78f;border:1px solid #98634177;border-radius:30px;padding:3px 9px}
      .kw-ytus-panel p{color:#d9d4cb;font-size:.86rem;margin:10px 0}
      .kw-ytus-panel code{color:#f0bf7e}
      .kw-ytus-controls{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
      .kw-ytus-controls input{min-width:210px;max-width:100%;flex:1;background:#111b2b;color:#f7efe4;border:1px solid #a7715580;border-radius:10px;padding:11px}
      .kw-ytus-note{opacity:.75}
      @media(max-width:600px){.kw-ytus-controls>*{width:100%}}
    `;
    document.head.appendChild(style);
    $('kwYtUsChoose').addEventListener('click',()=>$('kwYtUsFile').click());
    $('kwYtUsFile').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try {
        if(!/\.txt$/i.test(file.name))throw Error('Choisis un fichier .txt UltraStar.');
        say('Analyse du TXT et de sa référence vidéo…');
        const parsed=parseUltraStar(usDecode(await file.arrayBuffer()));
        const title=clean(parsed.meta.TITLE)||file.name.replace(/\.txt$/i,'');
        const artist=clean(parsed.meta.ARTIST)||'Artiste inconnu';
        const id=getYoutubeId(clean($('kwYtUsUrl').value))||getYoutubeId(parsed.meta.VIDEO);
        if(!id)throw Error('Aucun identifiant vidéo YouTube trouvé dans #VIDEO. Colle le lien YouTube dans le champ puis réimporte le TXT.');
        const trackId='ultrastar_youtube_'+id+'_'+hash(norm(artist)+'|'+norm(title));
        const track={
          id:trackId,title,artist,genre:clean(parsed.meta.GENRE)||'Sans genre',
          emoji:'🎬',kind:'ultrastar-youtube',type:'youtube',created:Date.now(),
          youtubeId:id,lrc:parsed.lines,
          ultraStar:{bpm:parsed.bpm,gap:parsed.gap,groups:parsed.groups,meta:parsed.meta,videoGap:0}
        };
        await saveTrack(track);
        const old=tracks.findIndex(x=>x.id===trackId);
        if(old>=0)tracks.splice(old,1);
        tracks.unshift(track);
        drawTracks();drawPlaylists();
        $('onlineQuery').value=artist+' '+title;
        say('✅ '+artist+' — '+title+' ajouté à ta bibliothèque. Vidéo YouTube reconnue : '+id+'. Ouverture du lecteur…');
        setTimeout(()=>window.playTrack(trackId),40);
      } catch(err) {
        say('❌ Import impossible : '+(err?.message||String(err)),true);
      } finally {e.target.value=''}
    });
  }
  function hookPlayTrack(){
    const previous=window.playTrack;
    if(typeof previous!=='function'||previous._kwYtUs) return;
    const wrapper=function(id){
      const t=Array.isArray(tracks)?tracks.find(x=>x.id===id):null;
      if(t?.kind==='ultrastar-youtube'){
        if(!t.youtubeId||!t.ultraStar?.groups?.length){
          say('❌ Cette fiche TXT manque de vidéo ou de notes. Réimporte le TXT.',true);return;
        }
        window.KaraokeWorldUltraStarYouTube.active=true;
        if(typeof showPage==='function')showPage('home');
        const q=t.artist+' - '+t.title;
        $('onlineQuery').value=q;
        if(typeof youtubeEmbed==='function')youtubeEmbed(t.youtubeId,q,q,t.artist,{ultraStar:t.ultraStar,lrc:t.lrc,trackId:t.id});
        return;
      }
      if(window.KaraokeWorldUltraStarYouTube.active){
        window.KaraokeWorldUltraStarYouTube.active=false;
        try {ytPlayer?.pauseVideo?.()}catch(e){}
        try {clearInterval(ytTimer)}catch(e){}
      }
      return previous.apply(this,arguments);
    };
    wrapper._kwYtUs=true;
    if(previous._kwVoiceFixV0277)wrapper._kwVoiceFixV0277=true;
    window.playTrack=wrapper;
  }
  function init(){panel();hookPlayTrack()}
  window.KaraokeWorldUltraStarYouTube={installed:true,version:VERSION,active:false,readYoutubeId:getYoutubeId};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  [600,1800,4000].forEach(ms=>setTimeout(hookPlayTrack,ms));
})();
