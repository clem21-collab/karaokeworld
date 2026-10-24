(()=>{
  const frame=document.getElementById('kwApp');
  const loader=document.getElementById('loading');
  const themeUrl=new URL('./theme.css',location.href).href;

  function setText(root,selector,text){const el=root.querySelector(selector);if(el)el.textContent=text}

  function apply(){
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.body)return;
      doc.title='KaraokeWorld · Laurent 60 ans';
      doc.body.classList.add('birthday60');

      if(!doc.getElementById('kw60ThemeCss')){
        const link=doc.createElement('link');
        link.id='kw60ThemeCss';
        link.rel='stylesheet';
        link.href=themeUrl;
        doc.head.appendChild(link);
      }

      if(!doc.getElementById('kw60CenterFix')){
        const style=doc.createElement('style');
        style.id='kw60CenterFix';
        style.textContent=`
          body.birthday60 .home-hero{
            text-align:center !important;
          }
          body.birthday60 .home-hero h1{
            max-width:900px !important;
            margin-left:auto !important;
            margin-right:auto !important;
            text-align:center !important;
          }
          body.birthday60 .home-hero > p{
            max-width:900px !important;
            margin-left:auto !important;
            margin-right:auto !important;
            text-align:center !important;
          }
          body.birthday60 .home-hero > .eyebrow,
          body.birthday60 .home-hero > .home-search,
          body.birthday60 .home-hero > .hero-actions{
            margin-left:auto !important;
            margin-right:auto !important;
            text-align:center !important;
          }
          body.birthday60 .home-hero > .home-search{
            width:min(100%,920px) !important;
          }
          body.birthday60 .home-hero > .hero-actions{
            justify-content:center !important;
          }
          body.birthday60 .kw60-special-banner{
            width:min(100%,1100px) !important;
            margin-left:auto !important;
            margin-right:auto !important;
          }
        `;
        doc.head.appendChild(style);
      }

      const brand=doc.querySelector('.brand');
      if(brand){
        brand.innerHTML='🎤 Karaoke<span>World</span><small> · SPÉCIAL LAURENT 60 ANS ✨</small>';
      }

      const top=doc.querySelector('.top-actions');
      if(top&&!doc.getElementById('kw60Back')){
        const back=doc.createElement('button');
        back.id='kw60Back';
        back.className='secondary kw60-back';
        back.type='button';
        back.textContent='↩ Version normale';
        back.onclick=()=>{window.top.location.href='../'};
        top.prepend(back);
      }

      const hero=doc.getElementById('homeHero');
      if(hero){
        if(!doc.getElementById('kw60Banner')){
          const banner=doc.createElement('div');
          banner.id='kw60Banner';
          banner.className='kw60-special-banner';
          banner.innerHTML='<div class="kw60-number">60</div><div class="kw60-copy"><b>LAURENT · SOIRÉE ANNIVERSAIRE</b><span>Des kilomètres, des souvenirs, une famille… et ce soir, des chansons.</span></div><div class="kw60-road">🛣️ · 🚛</div>';
          hero.prepend(banner);
        }
        setText(hero,'.eyebrow','KARAOKEWORLD · ÉDITION SPÉCIALE 60 ANS');
        const h1=hero.querySelector('h1');
        if(h1)h1.innerHTML='Ce soir, la scène est à toi.<br><span>Joyeux anniversaire Laurent.</span>';
        const p=hero.querySelector('p');
        if(p)p.textContent='Une soirée pensée pour célébrer 60 ans de souvenirs, de route, de famille et de musique. Choisissez une chanson et faites vivre la fête.';
      }

      setText(doc,'#favoritesSection .eyebrow','LES INCONTOURNABLES DE LA SOIRÉE');
      setText(doc,'#favoritesSection h2','⭐ Les favoris de Laurent');
      setText(doc,'#ideasSection .eyebrow','POUR FAIRE MONTER L’AMBIANCE');
      setText(doc,'#ideasSection h2','🎉 Playlist de la soirée');
      setText(doc,'#librarySection .eyebrow','TOUTES LES CHANSONS');
      setText(doc,'#librarySection h2','🎵 Le jukebox des 60 ans');

      const ultraTitle=doc.querySelector('#ultrastarPanel h2');
      if(ultraTitle)ultraTitle.textContent='🎤 Bibliothèque karaoké de la soirée';

      if(loader)loader.style.display='none';
    }catch(err){
      console.error('Thème 60 ans :',err);
      if(loader)loader.textContent='Impossible de charger l’édition 60 ans.';
    }
  }

  frame.addEventListener('load',()=>{
    apply();
    setTimeout(apply,600);
    setTimeout(apply,1800);
  });
})();
