/* KaraokeWorld v0.29.0 — Catalogue public sans MP3 ni clé API côté visiteur */
(()=>{
  try{
    if(window.top!==window && /\/60ans(?:\/|$)/.test(window.top.location.pathname))return;
  }catch(e){}
  if(window.KaraokeWorldPublicCatalog?.installed)return;

  const VERSION='0.29.0';
  const BACKEND=window.KaraokeWorldDriveOAuthDefault?.backend||'https://karaokeworld-drive-oauth.onrender.com';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const starter=[
    ['Dernière danse','Indila','Variété française','🌙'],
    ['Alors on danse','Stromae','Pop','🎧'],
    ['Un autre monde','Téléphone','Rock','⚡'],
    ["L'Aventurier",'Indochine','Rock','🧭'],
    ["J'irai où tu iras",'Céline Dion','Variété française','🌟'],
    ['Quand la musique est bonne','Jean-Jacques Goldman','Variété française','🎸'],
    ['Allumer le feu','Johnny Hallyday','Rock','🔥'],
    ['Les démons de minuit','Images','Années 80','🌃'],
    ['Voyage voyage','Desireless','Années 80','✈️'],
    ["Ella, elle l'a",'France Gall','Variété française','✨'],
    ['Désenchantée','Mylène Farmer','Variété française','🖤'],
    ['Stolen Car','Mylène Farmer feat. Sting','Pop','🚘'],
    ['Bohemian Rhapsody','Queen','Rock','👑'],
    ['Dancing Queen','ABBA','Pop','💃'],
    ['Someone Like You','Adele','Pop','💜'],
    ['Shape of You','Ed Sheeran','Pop','🎸'],
    ['Believer','Imagine Dragons','Rock','⚡'],
    ['Blinding Lights','The Weeknd','Pop','🌆']
  ];

  function currentMode(){return $('modeOriginal')?.classList.contains('active')?'original':'karaoke'}
  function setMode(mode){(mode==='original'?$('modeOriginal'):$('modeKaraoke'))?.click()}
  function status(text){const el=$('onlineStatus');if(el)el.textContent=text}
  function scrollOnline(){ $('online')?.scrollIntoView({behavior:'smooth',block:'start'}) }

  async function backendSearch(query,mode){
    const url=new URL(BACKEND+'/youtube/search');
    url.searchParams.set('q',query);
    url.searchParams.set('mode',mode);
    const r=await fetch(url.toString(),{headers:{Accept:'application/json'}});
    let data={};try{data=await r.json()}catch(e){}
    if(!r.ok)throw Object.assign(new Error(data?.detail||('Serveur '+r.status)),{status:r.status});
    return Array.isArray(data.items)?data.items:[];
  }

  async function publicSearch(query,modeOverride){
    const q=String(query||'').trim();
    if(!q){status('Saisis un titre ou un artiste.');return}
    const mode=modeOverride||currentMode();
    setMode(mode);
    if($('onlineQuery'))$('onlineQuery').value=q;
    const out=$('youtubeResults');
    if(out)out.innerHTML='<p class="empty">Recherche dans le catalogue public…</p>';
    status('Recherche publique YouTube en cours…');
    try{
      const items=await backendSearch(q,mode);
      if(!items.length){if(out)out.innerHTML='<p class="empty">Aucune vidéo intégrable trouvée pour cette recherche.</p>';status('Aucun résultat compatible. Essaie le titre + artiste.');return}
      if(out)out.innerHTML=items.map(x=>`<article class="youtube-result"><img src="${esc(x.thumbnail||'')}" alt="" loading="lazy"><div class="youtube-result-info"><h3>${esc(x.title||'Vidéo YouTube')}</h3><p>${esc(x.channel||'')}</p><button class="kw-public-play" data-id="${esc(x.id)}" data-title="${esc(x.title||'')}" data-channel="${esc(x.channel||'')}">▶ ${mode==='karaoke'?'Chanter':'Écouter'} + paroles</button><a class="yt-open" href="https://www.youtube.com/watch?v=${encodeURIComponent(x.id)}" target="_blank" rel="noopener noreferrer">Voir sur YouTube</a></div></article>`).join('');
      out?.querySelectorAll('.kw-public-play').forEach(b=>b.addEventListener('click',()=>{
        if(typeof youtubeEmbed==='function')youtubeEmbed(b.dataset.id,b.dataset.title,q,b.dataset.channel||'');
      }));
      status(`${items.length} vidéo(s) publique(s) compatible(s) trouvée(s) · aucune clé demandée.`);
    }catch(e){
      const personal=String($('youtubeApiKey')?.value||localStorage.getItem('karaokeworld_youtube_api_key_v1')||'').trim();
      if(personal&&typeof window.__kwLegacyYoutubeSearch==='function'){
        status('Serveur public indisponible · utilisation de ta clé personnelle de secours…');
        return window.__kwLegacyYoutubeSearch(q);
      }
      if(out)out.innerHTML='<p class="empty">Le catalogue public est momentanément indisponible. Tu peux toujours coller directement un lien YouTube.</p>';
      status(e.status===503?'Catalogue public en attente de l’activation de la clé serveur.':'Catalogue public indisponible : '+e.message);
    }
  }

  function installOverrides(){
    if(!window.__kwLegacyYoutubeSearch && typeof window.searchYouTubeCompatible==='function')window.__kwLegacyYoutubeSearch=window.searchYouTubeCompatible;
    window.searchYouTubeCompatible=q=>publicSearch(q);
    window.searchYouTubeFor=q=>{const v=String(q||'').trim();if($('onlineQuery'))$('onlineQuery').value=v;publicSearch(v);scrollOnline()};
    const sb=$('youtubeSearch');if(sb)sb.onclick=()=>publicSearch($('onlineQuery')?.value||'');
    const oq=$('onlineQuery');if(oq)oq.onkeydown=e=>{if(e.key==='Enter')publicSearch(oq.value)};
    const se=$('searchEverywhere');if(se)se.onclick=()=>window.searchYouTubeFor($('query')?.value||'');
  }

  function injectStyle(){
    if($('kwPublicCatalogStyle'))return;
    const s=document.createElement('style');s.id='kwPublicCatalogStyle';s.textContent=`
#kwPublicCatalog{margin:0 0 20px;padding:18px;background:linear-gradient(145deg,rgba(21,33,52,.96),rgba(10,18,31,.98));border:1px solid rgba(92,170,255,.22);border-radius:16px;box-shadow:0 14px 38px rgba(0,0,0,.16)}
#kwPublicCatalog .kw-public-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px}#kwPublicCatalog .kw-public-head h2{margin:3px 0 4px}#kwPublicCatalog .kw-public-badge{padding:6px 10px;border-radius:999px;background:rgba(46,182,125,.12);border:1px solid rgba(64,211,151,.25);color:#86efbd;font-size:12px;font-weight:800;white-space:nowrap}
#kwPublicCatalog .kw-public-search{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;margin-bottom:15px}#kwPublicCatalog .kw-public-search input{min-width:0}#kwPublicCatalog .kw-public-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:10px}.kw-public-card{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;padding:11px;border:1px solid rgba(135,171,210,.16);border-radius:12px;background:rgba(7,14,24,.62)}.kw-public-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,#243752,#111c2d);font-size:25px}.kw-public-meta{min-width:0}.kw-public-meta b,.kw-public-meta span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kw-public-meta span{font-size:12px;opacity:.7;margin-top:2px}.kw-public-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:7px}.kw-public-actions button{padding:8px 7px!important;font-size:12px!important}.kw-public-actions .secondary{background:#151f2f!important}
@media(max-width:720px){#kwPublicCatalog .kw-public-head{display:block}.kw-public-badge{display:inline-block;margin-top:6px}#kwPublicCatalog .kw-public-search{grid-template-columns:1fr 1fr}#kwPublicCatalog .kw-public-search input{grid-column:1/-1}.kw-public-grid{grid-template-columns:1fr!important}}
`;
    document.head.appendChild(s);
  }

  function injectCatalog(){
    if($('kwPublicCatalog'))return;
    const page=$('page-home');if(!page)return;
    const section=document.createElement('section');section.id='kwPublicCatalog';section.className='home-section';
    section.innerHTML=`<div class="kw-public-head"><div><div class="eyebrow">AUCUN MP3 À IMPORTER</div><h2>🌐 Catalogue public KaraokeWorld</h2><p class="muted">Cherche une chanson ou démarre avec une suggestion. La musique reste hébergée et lue par YouTube.</p></div><span id="kwPublicBadge" class="kw-public-badge">● accès public</span></div><div class="kw-public-search"><input id="kwPublicQuery" placeholder="Titre ou artiste…" aria-label="Rechercher dans le catalogue public"><button id="kwPublicOriginal" type="button">🎵 Version originale</button><button id="kwPublicKaraoke" class="secondary" type="button">🎤 Version karaoké</button></div><div class="kw-public-grid">${starter.map(([title,artist,genre,emoji])=>`<article class="kw-public-card"><div class="kw-public-icon">${emoji}</div><div class="kw-public-meta"><b title="${esc(title)}">${esc(title)}</b><span>${esc(artist)} · ${esc(genre)}</span></div><div class="kw-public-actions"><button data-public="original" data-q="${esc(title+' '+artist)}">🎵 Original</button><button class="secondary" data-public="karaoke" data-q="${esc(title+' '+artist)}">🎤 Karaoké</button></div></article>`).join('')}</div>`;
    const anchor=$('ideasSection')||page.firstElementChild;anchor?.insertAdjacentElement('afterend',section);
    $('kwPublicOriginal').onclick=()=>{const q=$('kwPublicQuery').value.trim();if(q){scrollOnline();publicSearch(q,'original')}};
    $('kwPublicKaraoke').onclick=()=>{const q=$('kwPublicQuery').value.trim();if(q){scrollOnline();publicSearch(q,'karaoke')}};
    $('kwPublicQuery').onkeydown=e=>{if(e.key==='Enter')$('kwPublicOriginal').click()};
    section.querySelectorAll('[data-public]').forEach(b=>b.onclick=()=>{scrollOnline();publicSearch(b.dataset.q,b.dataset.public)});
  }

  function relabel(){
    const online=$('online');
    const h=online?.querySelector('h2');if(h)h.textContent='🌐 Catalogue YouTube public';
    const ps=online?.querySelectorAll(':scope > p.muted');if(ps?.[0])ps[0].textContent='Recherche des vidéos YouTube intégrables sans demander de clé API aux visiteurs.';
    if(ps?.[1])ps[1].textContent='La clé publique est protégée côté serveur KaraokeWorld. Une clé personnelle reste disponible uniquement comme solution de secours avancée.';
    const keyStatus=$('youtubeKeyStatus');if(keyStatus)keyStatus.textContent='Option avancée : clé personnelle de secours uniquement. Le catalogue public fonctionne sans configuration côté visiteur.';
  }

  async function checkBackend(){
    const badge=$('kwPublicBadge');if(!badge)return;
    try{const r=await fetch(BACKEND+'/youtube/status',{headers:{Accept:'application/json'}});const d=await r.json();if(d.configured){badge.textContent='● accès public actif';badge.style.color='#86efbd'}else{badge.textContent='● activation serveur requise';badge.style.color='#ffd27d'}}catch(e){badge.textContent='● serveur au réveil…';badge.style.color='#ffd27d'}
  }

  function install(){injectStyle();injectCatalog();installOverrides();relabel();checkBackend();const v=$('kwCurrentVersion');if(v)v.textContent=' BETA · v0.29.0 · Catalogue public 🌐'}
  window.KaraokeWorldPublicCatalog={version:VERSION,installed:true,search:publicSearch};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
