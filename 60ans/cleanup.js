(()=>{
  const frame=document.getElementById('kwApp');
  const cleanupUrl=new URL('./cleanup.css?v=5',location.href).href;

  const stageBackground=`
    radial-gradient(circle at 48% 10%,rgba(151,78,176,.18) 0%,transparent 22%),
    radial-gradient(circle at 44% 46%,rgba(231,169,57,.18) 0%,transparent 31%),
    radial-gradient(circle at 40% 80%,rgba(114,57,22,.18) 0%,transparent 28%),
    linear-gradient(145deg,#080807 0%,#120d09 42%,#0d0b08 68%,#050606 100%)
  `;

  const lyricsBackground=`
    radial-gradient(ellipse at 48% 42%,rgba(236,176,62,.20) 0%,rgba(128,79,26,.10) 24%,transparent 52%),
    radial-gradient(circle at 50% 4%,rgba(155,76,180,.13) 0%,transparent 28%),
    linear-gradient(180deg,rgba(13,11,9,.86) 0%,rgba(18,13,9,.76) 48%,rgba(7,8,7,.94) 100%)
  `;

  const forceCss=`
html body.birthday60::before,
html body.birthday60::after,
html body.birthday60 main::after,
html body.birthday60 header .brand::before,
html body.birthday60 footer::after{content:none!important;display:none!important;animation:none!important;filter:none!important}

html body.birthday60 .karaoke-stage{
  position:fixed!important;
  overflow:hidden!important;
  background:${stageBackground}!important;
}
html body.birthday60 .karaoke-stage::before{
  content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:-2!important;pointer-events:none!important;
  background:linear-gradient(90deg,rgba(4,5,5,.14),rgba(255,255,255,.01) 26%,rgba(255,255,255,.01) 72%,rgba(4,5,5,.22)),repeating-linear-gradient(116deg,rgba(255,255,255,.014) 0 2px,transparent 2px 48px)!important;
  opacity:.58!important;
}
html body.birthday60 .karaoke-stage::after{
  content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:-1!important;pointer-events:none!important;
  background:radial-gradient(ellipse at 40% 48%,rgba(255,198,78,.09) 0%,rgba(255,198,78,.035) 35%,transparent 67%),radial-gradient(circle at 42% 13%,rgba(184,91,206,.07) 0%,transparent 24%)!important;
}
html body.birthday60 .stage-lyrics-wrap{
  position:relative!important;overflow:hidden!important;isolation:isolate!important;
  background:${lyricsBackground}!important;
  box-shadow:inset -1px 0 0 rgba(229,183,81,.14),inset 0 1px 0 rgba(255,255,255,.025)!important;
}
html body.birthday60 .stage-lyrics-wrap::before{
  content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none!important;animation:none!important;filter:none!important;
  background:linear-gradient(105deg,transparent 10%,rgba(255,220,145,.035) 28%,transparent 43%),linear-gradient(255deg,transparent 15%,rgba(255,220,145,.025) 35%,transparent 48%),radial-gradient(ellipse at 50% 52%,rgba(255,207,100,.07),transparent 56%)!important;
}
html body.birthday60 .stage-lyrics-wrap::after{
  content:none!important;
  display:none!important;
  border:0!important;
  background:none!important;
  box-shadow:none!important;
}
html body.birthday60 .stage-lyrics-wrap>*{position:relative!important;z-index:2!important}
html body.birthday60 .stage-bg::after{content:none!important;display:none!important;animation:none!important;filter:none!important}
html body.birthday60 .stage-video{
  background:linear-gradient(180deg,#071012 0%,#081315 100%)!important;
  border-left:1px solid rgba(218,170,73,.38)!important;
  box-shadow:inset 1px 0 0 rgba(255,255,255,.04),-20px 0 55px rgba(0,0,0,.14)!important;
}
html body.birthday60 .stage-video .youtube-frame{border:1px solid #4a3a1e!important;box-shadow:0 14px 34px rgba(0,0,0,.42)!important}
html body.birthday60 .stage-line{color:#aaa08f!important;text-shadow:0 2px 12px rgba(0,0,0,.36)!important}
html body.birthday60 .stage-line.near,
html body.birthday60 .stage-line.next{color:#ded0af!important}
html body.birthday60 .stage-line.active{
  background:linear-gradient(90deg,#efb63c var(--sing-progress,0%),#fff1c9 var(--sing-progress,0%))!important;
  -webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;text-shadow:none!important;
  filter:drop-shadow(0 0 13px rgba(226,170,54,.43))!important;
}
html body.birthday60 .stage-line.instrumental{color:#cba75d!important}
html body.birthday60 .stage-song-info span,
html body.birthday60 .stage-hint,
html body.birthday60 .stage-mic{color:#c2b697!important}
html body.birthday60 .stage-countdown{color:#f0bd48!important;text-shadow:0 0 45px rgba(240,189,72,.55)!important;background:rgba(8,7,5,.52)!important}
html body.birthday60 .stage-controls button,
html body.birthday60 .stage-video button{box-shadow:none!important}
html body.birthday60 .stage-video input[type="range"],
html body.birthday60 .karaoke-stage input[type="range"]{accent-color:#e9b749!important}
`;

  function injectCleanup(d){
    if(!d||!d.head)return;
    let link=d.getElementById('kw60CleanupCss');
    if(!link){
      link=d.createElement('link');
      link.id='kw60CleanupCss';
      link.rel='stylesheet';
      d.head.appendChild(link);
    }
    link.href=cleanupUrl;
    d.head.appendChild(link);

    let style=d.getElementById('kw60StageForceCss');
    if(!style){
      style=d.createElement('style');
      style.id='kw60StageForceCss';
    }
    style.textContent=forceCss;
    d.head.appendChild(style);
  }

  function forceStage(d){
    injectCleanup(d);
    const stage=d.querySelector('.karaoke-stage');
    if(!stage)return;

    stage.style.setProperty('background',stageBackground.replace(/\s+/g,' '),'important');
    stage.style.setProperty('position','fixed','important');
    stage.style.setProperty('overflow','hidden','important');

    const wrap=d.querySelector('.stage-lyrics-wrap');
    if(wrap){
      wrap.style.setProperty('background',lyricsBackground.replace(/\s+/g,' '),'important');
      wrap.style.setProperty('position','relative','important');
      wrap.style.setProperty('overflow','hidden','important');
      wrap.style.setProperty('isolation','isolate','important');
    }

    const video=d.querySelector('.stage-video');
    if(video){
      video.style.setProperty('background','linear-gradient(180deg,#071012 0%,#081315 100%)','important');
      video.style.setProperty('border-left','1px solid rgba(218,170,73,.38)','important');
      video.style.setProperty('box-shadow','inset 1px 0 0 rgba(255,255,255,.04),-20px 0 55px rgba(0,0,0,.14)','important');
    }
  }

  function start(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.documentElement)return;
      injectCleanup(d);
      forceStage(d);

      if(d.__kw60StageObserver)return;
      d.__kw60StageObserver=new MutationObserver(()=>forceStage(d));
      d.__kw60StageObserver.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});

      const timer=setInterval(()=>forceStage(d),500);
      frame.addEventListener('load',()=>clearInterval(timer),{once:true});
    }catch(e){console.error('Nettoyage thème 60 ans',e)}
  }

  frame.addEventListener('load',()=>{
    setTimeout(start,30);
    setTimeout(start,400);
    setTimeout(start,1200);
  });
})();
