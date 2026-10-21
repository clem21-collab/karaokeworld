/* KaraokeWorld — reliable lyrics matching test UI */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = s => Number.isFinite(Number(s)) ? `${Math.floor(Number(s)/60)}:${String(Math.round(Number(s)%60)).padStart(2,'0')}` : '—';
  function badge(match){
    const c=match?.confidence;
    return c==='exact'?'🟢 Correspondance exacte':c==='probable'?'🟠 Correspondance probable':'🔴 Correspondance non fiable';
  }
  function inject(){
    const section=$('lyrics-search');
    if(!section || $('kwMatchTest')) return;
    const box=document.createElement('div');
    box.id='kwMatchTest';
    box.innerHTML=`<hr><div class="row-head"><h3>🧪 Nouveau moteur de correspondance</h3><span class="status">TEST</span></div>
      <p class="muted">Teste la correspondance titre + artiste + durée avant d'accepter des paroles synchronisées.</p>
      <div class="online-search"><input id="kwMatchTitle" placeholder="Titre exact…"><input id="kwMatchArtist" placeholder="Artiste…"><input id="kwMatchDuration" type="number" min="0" step="0.1" placeholder="Durée en secondes"><button id="kwMatchRun">Tester</button></div>
      <div id="kwMatchResults" class="online-results"><p class="empty">Exemple : Les Démons de minuit · Images · 223.8 s</p></div>`;
    section.appendChild(box);
    $('kwMatchRun').onclick=run;
  }
  async function run(){
    const out=$('kwMatchResults');
    if(!window.KWTrackIdentity){out.innerHTML='<p class="empty">Moteur Track Identity non chargé.</p>';return}
    const track={title:$('kwMatchTitle').value.trim(),artist:$('kwMatchArtist').value.trim(),duration:Number($('kwMatchDuration').value)||undefined};
    if(!track.title){out.innerHTML='<p class="empty">Entre au moins un titre.</p>';return}
    out.innerHTML='<p class="empty">Recherche et vérification en cours…</p>';
    try{
      const rows=await KWTrackIdentity.searchLrclib(track);
      if(!rows.length){out.innerHTML='<p class="empty">Aucun candidat trouvé.</p>';return}
      out.innerHTML=rows.slice(0,8).map((x,i)=>`<article class="lyric-result">
        <h3>${esc(x.title||'Titre inconnu')}</h3><p>${esc(x.artist||'Artiste inconnu')}${x.album?' · '+esc(x.album):''}</p>
        <p><b>${badge(x.match)}</b> · score ${esc(x.match?.score)} · durée ${fmt(x.duration)}</p>
        <p>${x.syncedLyrics?'✓ Paroles synchronisées disponibles':'Pas de paroles synchronisées'}</p>
        ${x.match?.confidence==='weak'?'<button disabled>Refusé automatiquement</button>':x.syncedLyrics?`<button data-kw-use="${i}">Candidat autorisé</button>`:''}
      </article>`).join('');
      rows.slice(0,8).forEach((x,i)=>{const b=out.querySelector(`[data-kw-use="${i}"]`);if(b)b.onclick=()=>{out.querySelectorAll('[data-kw-use]').forEach(z=>z.textContent='Candidat autorisé');b.textContent='✓ Correspondance retenue pour le test';};});
    }catch(e){out.innerHTML=`<p class="empty">Erreur : ${esc(e.message)}</p>`;}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject); else inject();
})();
