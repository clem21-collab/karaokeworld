(()=>{
  const frame=document.getElementById('kwApp');
  let reloadClicks=0;
  let pollTimer=0;

  const numberFrom=text=>{
    const m=String(text||'').match(/(\d+)/);
    return m?Number(m[1]):0;
  };

  function ensureUi(d){
    if(!d||!d.head||!d.body)return;
    if(!d.getElementById('kw60LibrarySyncStyle')){
      const s=d.createElement('style');
      s.id='kw60LibrarySyncStyle';
      s.textContent=`
body.birthday60 .kw60-library-sync{
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  margin:10px 0 14px;padding:12px 14px;border-radius:12px;
  border:1px solid rgba(232,182,76,.22);
  background:linear-gradient(90deg,rgba(104,72,24,.20),rgba(13,17,15,.92));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
}
body.birthday60 .kw60-library-sync-text{min-width:0}
body.birthday60 .kw60-library-sync-text strong{display:block;color:#f1ca70;font-size:13px;margin-bottom:2px}
body.birthday60 .kw60-library-sync-text span{display:block;color:#bcb6a6;font-size:12px;line-height:1.35}
body.birthday60 .kw60-library-sync[data-state="ok"]{border-color:rgba(102,190,127,.30);background:linear-gradient(90deg,rgba(27,83,45,.18),rgba(13,17,15,.92))}
body.birthday60 .kw60-library-sync[data-state="loading"]{border-color:rgba(232,182,76,.32)}
body.birthday60 .kw60-library-sync button{flex:0 0 auto;white-space:nowrap;padding:9px 12px!important;font-size:12px!important}
@media(max-width:900px){body.birthday60 .kw60-library-sync{align-items:flex-start;flex-direction:column}}
      `;
      d.head.appendChild(s);
    }

    const section=d.getElementById('librarySection');
    if(!section)return;
    let box=d.getElementById('kw60LibrarySync');
    if(!box){
      box=d.createElement('div');
      box.id='kw60LibrarySync';
      box.className='kw60-library-sync';
      box.dataset.state='loading';
      box.innerHTML='<div class="kw60-library-sync-text"><strong id="kw60LibrarySyncTitle">☁ Bibliothèque de la soirée</strong><span id="kw60LibrarySyncInfo">Chargement automatique de ta bibliothèque UltraStar…</span></div><button id="kw60LocalLibraryBtn" type="button">📁 Charger mon dossier UltraStar</button>';
      const tools=section.querySelector('.library-tools');
      if(tools)section.insertBefore(box,tools);else section.appendChild(box);
      d.getElementById('kw60LocalLibraryBtn')?.addEventListener('click',()=>{
        (d.getElementById('ultraStarChoose')||d.getElementById('importUltraStar'))?.click();
      });
    }
  }

  function readCounts(d){
    const total=numberFrom(d.getElementById('resultCount')?.textContent);
    const cloudText=d.getElementById('cloudUltraStarBadge')?.textContent||'';
    const localText=d.getElementById('ultraStarBadge')?.textContent||'';
    const cloud=/sur Drive/i.test(cloudText)?numberFrom(cloudText):0;
    const local=/prête|prêtes/i.test(localText)?numberFrom(localText):0;
    return {total,cloud,local,cloudText,localText};
  }

  function refresh(d,loading=false){
    ensureUi(d);
    const box=d.getElementById('kw60LibrarySync');
    const title=d.getElementById('kw60LibrarySyncTitle');
    const info=d.getElementById('kw60LibrarySyncInfo');
    const btn=d.getElementById('kw60LocalLibraryBtn');
    if(!box||!title||!info)return;

    const {total,cloud,local}=readCounts(d);
    if(cloud>0){
      box.dataset.state='ok';
      title.textContent=`☁ Bibliothèque Google Drive chargée · ${cloud} chanson${cloud>1?'s':''}`;
      info.textContent=`${total||cloud} titre${(total||cloud)>1?'s':''} actuellement visibles dans le catalogue de la soirée.`;
      if(btn)btn.style.display='none';
      return;
    }
    if(local>0){
      box.dataset.state='ok';
      title.textContent=`🎤 Dossier UltraStar chargé · ${local} chanson${local>1?'s':''}`;
      info.textContent=`${total||local} titre${(total||local)>1?'s':''} actuellement visibles dans le catalogue de la soirée.`;
      if(btn)btn.style.display='none';
      return;
    }
    if(loading){
      box.dataset.state='loading';
      title.textContent='☁ Chargement de la bibliothèque Google Drive…';
      info.textContent=`${total?total+' titres provisoirement affichés · ':''}KaraokeWorld récupère automatiquement ta collection UltraStar.`;
      if(btn)btn.style.display='none';
      return;
    }

    box.dataset.state='partial';
    title.textContent=`⚠ Bibliothèque complète non chargée${total?' · '+total+' titres actuellement':''}`;
    info.textContent='La version 60 ans va retenter Google Drive automatiquement. Si besoin, tu peux aussi sélectionner ton dossier UltraStar sur ce PC.';
    if(btn)btn.style.display='inline-flex';
  }

  function tryAutoReload(d){
    ensureUi(d);
    const counts=readCounts(d);
    if(counts.cloud>0||counts.local>0){refresh(d,false);return true}

    const reload=d.getElementById('cloudUltraStarReload');
    if(reload&&!reload.disabled&&reloadClicks<2){
      reloadClicks++;
      refresh(d,true);
      reload.click();
      setTimeout(()=>refresh(d,false),4500);
      return false;
    }
    refresh(d,reloadClicks>0);
    return false;
  }

  function start(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.body)return;
      ensureUi(d);
      refresh(d,true);

      if(!d.__kw60LibraryObserver){
        const mo=new MutationObserver(()=>refresh(d,false));
        ['resultCount','cloudUltraStarBadge','ultraStarBadge','cloudUltraStarStatus'].forEach(id=>{
          const el=d.getElementById(id);if(el)mo.observe(el,{childList:true,subtree:true,characterData:true,attributes:true});
        });
        d.__kw60LibraryObserver=mo;
      }

      let tries=0;
      clearInterval(pollTimer);
      pollTimer=setInterval(()=>{
        tries++;
        const done=tryAutoReload(d);
        if(done||tries>=24){clearInterval(pollTimer);setTimeout(()=>refresh(d,false),500)}
      },1250);
    }catch(e){console.error('Bibliothèque 60 ans',e)}
  }

  frame.addEventListener('load',()=>{
    setTimeout(start,600);
    setTimeout(start,2200);
  });
})();
