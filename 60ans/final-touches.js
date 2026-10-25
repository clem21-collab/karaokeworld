(()=>{
  const frame=document.getElementById('kwApp');

  function inject(){
    try{
      const d=frame.contentDocument;if(!d?.head||!d?.body)return;
      if(!d.getElementById('kw60FinalTouches')){
        const s=d.createElement('style');s.id='kw60FinalTouches';s.textContent=`
/* KaraokeWorld 60 ans — finitions fluidité + soirée */
body.birthday60{scrollbar-gutter:stable;overscroll-behavior:none}
body.birthday60 main{isolation:isolate}
body.birthday60 .track,body.birthday60 .home-card,body.birthday60 .youtube-result,body.birthday60 .lyric-result,body.birthday60 .queue-item{content-visibility:auto;contain-intrinsic-size:300px;contain:layout paint style}
body.birthday60 .track .cover,body.birthday60 .home-card .home-emoji{position:relative!important;overflow:hidden!important;background-size:cover!important;background-position:center!important}
body.birthday60 .track:not([data-kw-cover]) .cover:before,body.birthday60 .home-card:not([data-kw-cover]) .home-emoji:before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(255,221,145,.08) 46%,rgba(255,221,145,.14) 50%,rgba(255,221,145,.08) 54%,transparent 70%);transform:translate3d(-115%,0,0);animation:kw60CoverLoading 2.2s ease-in-out infinite}
@keyframes kw60CoverLoading{to{transform:translate3d(115%,0,0)}}
body.birthday60 .track[data-kw-cover-generated="0"] .cover,body.birthday60 .home-card[data-kw-cover-generated="0"] .home-emoji{box-shadow:inset 0 0 0 1px rgba(255,220,139,.10),0 6px 16px rgba(0,0,0,.15)!important}
body.birthday60 .track,body.birthday60 .home-card{transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,box-shadow .16s ease!important}
body.birthday60 .track:hover,body.birthday60 .home-card:hover{transform:translate3d(0,-2px,0)!important;box-shadow:0 10px 26px rgba(0,0,0,.20)!important}
body.birthday60 .home-section .row-head h2,body.birthday60 .library-section .row-head h2,body.birthday60 .panel>.row-head h2{position:relative;padding-left:13px!important}
body.birthday60 .home-section .row-head h2:before,body.birthday60 .library-section .row-head h2:before,body.birthday60 .panel>.row-head h2:before{content:'';position:absolute;left:0;top:.18em;bottom:.18em;width:3px;border-radius:99px;background:linear-gradient(#f7d47a,#a66d20);box-shadow:0 0 12px rgba(231,176,65,.22)}
body.birthday60 .queue-item{display:flex!important;align-items:center!important;gap:10px!important;padding:9px 10px!important;border-radius:10px!important;transition:border-color .14s ease,background .14s ease,transform .14s ease!important}
body.birthday60 .queue-item:hover{transform:translate3d(2px,0,0)!important}
body.birthday60 .queue-item .mini{flex:0 0 52px!important;width:52px!important;height:52px!important;border-radius:8px!important;overflow:hidden!important;border:1px solid rgba(232,182,76,.16)!important;background-size:cover!important;background-position:center!important}
body.birthday60 .queue-item .info{min-width:0!important;flex:1!important}
body.birthday60 .queue-item .info b,body.birthday60 .queue-item .info span{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
body.birthday60 .queue-item .info b{color:#f3ead5!important}body.birthday60 .queue-item .info span{color:#a9a79e!important;margin-top:2px!important}
body.birthday60 .playlist-tools select,body.birthday60 .library-tools select{min-height:40px!important;border-radius:9px!important}
body.birthday60 .playlist-tools{padding:12px!important;background:linear-gradient(180deg,#111512,#0c100e)!important}
body.birthday60 .kw60-normal:hover{background:rgba(127,89,32,.18)!important;border-color:rgba(239,195,96,.52)!important;color:#f6d887!important}
body.birthday60 #import,body.birthday60 #importUltraStar{min-height:40px!important}
body.birthday60 #resultCount:empty{display:none!important}
body.birthday60 .kw60-library-sync-text span{max-width:780px!important}
body.birthday60 .status{border-radius:999px!important;padding-left:9px!important;padding-right:9px!important}
body.birthday60 .empty-state{padding:30px 18px!important;border:1px dashed rgba(232,182,76,.18)!important;border-radius:12px!important;background:rgba(14,17,15,.58)!important}
body.birthday60.birthday60-stage-active .track:not([data-kw-cover]) .cover:before,body.birthday60.birthday60-stage-active .home-card:not([data-kw-cover]) .home-emoji:before{animation-play-state:paused!important}
body.birthday60.birthday60-stage-active .kw60-balloons,body.birthday60.birthday60-stage-active .kw60-hero-seal{animation:none!important}
@media(max-width:900px){body.birthday60 .tracks{grid-template-columns:repeat(auto-fill,minmax(155px,1fr))!important}body.birthday60 .track{min-height:276px!important}body.birthday60 .track .cover{min-height:118px!important}body.birthday60 .library-tools{align-items:flex-start!important;flex-wrap:wrap!important}body.birthday60 .queue-item .mini{flex-basis:46px!important;width:46px!important;height:46px!important}}
@media(hover:none){body.birthday60 .track:hover,body.birthday60 .home-card:hover,body.birthday60 .queue-item:hover{transform:none!important}}
@media(prefers-reduced-motion:reduce){body.birthday60 *,body.birthday60 *:before,body.birthday60 *:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
        `;d.head.appendChild(s);
      }
      const normal=d.querySelector('.kw60-normal');if(normal)normal.title='Retourner à la version normale de KaraokeWorld';
      const imp=d.getElementById('import');if(imp)imp.title='Importer des fichiers audio ou vidéo';
      const us=d.getElementById('importUltraStar');if(us)us.title='Charger un dossier UltraStar';
      const count=d.getElementById('resultCount');if(count)count.setAttribute('aria-live','polite');
      const sync=d.getElementById('kw60LibrarySync');if(sync)sync.setAttribute('aria-live','polite');
      d.querySelectorAll('img').forEach(img=>{img.decoding='async';if(!img.closest('.karaoke-stage'))img.loading='lazy'});

      const stage=d.querySelector('.karaoke-stage');
      if(stage&&!stage.dataset.kw60PerfWatch){
        stage.dataset.kw60PerfWatch='1';
        const active=()=>d.body.classList.toggle('birthday60-stage-active',!stage.classList.contains('hidden'));
        new MutationObserver(active).observe(stage,{attributes:true,attributeFilter:['class']});active();
      }
    }catch(e){console.error('Dernières finitions 60 ans',e)}
  }
  frame.addEventListener('load',()=>{requestAnimationFrame(inject);setTimeout(inject,900);setTimeout(inject,2400)});
})();
