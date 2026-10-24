(()=>{
  const frame=document.getElementById('kwApp');
  const cleanupUrl=new URL('./cleanup.css?v=4',location.href).href;

  const stageBackground=`
    radial-gradient(circle at 50% 14%,rgba(163,72,184,.24) 0%,transparent 24%),
    radial-gradient(circle at 52% 58%,rgba(214,132,33,.22) 0%,transparent 30%),
    radial-gradient(circle at 50% 82%,rgba(98,45,20,.18) 0%,transparent 28%),
    linear-gradient(135deg,#090808 0%,#1a0f08 42%,#120c08 68%,#060606 100%)
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
  content:""!important;
  display:block!important;
  position:absolute!important;
  inset:0!important;
  z-index:-2!important;
  pointer-events:none!important;
  background:
    linear-gradient(90deg,rgba(10,8,6,.18),rgba(10,8,6,.06) 20%,rgba(10,8,6,.06) 80%,rgba(10,8,6,.18)),
    repeating-linear-gradient(115deg,rgba(255,255,255,.018) 0 2px,transparent 2px 44px)!important;
  opacity:.55!important;
}
html body.birthday60 .karaoke-stage::after{
  content:""!important;
  display:block!important;
  position:absolute!important;
  inset:0!important;
  z-index:-1!important;
  pointer-events:none!important;
  background:
    radial-gradient(circle at 50% 52%,rgba(255,184,61,.08) 0%,transparent 34%),
    radial-gradient(circle at 50% 18%,rgba(184,88,214,.10) 0%,transparent 22%)!important;
}
html body.birthday60 .stage-lyrics-wrap{
  background:transparent!important;
}
html body.birthday60 .stage-lyrics-wrap::before,
html body.birthday60 .stage-bg::after{content:none!important;display:none!important;animation:none!important;filter:none!important}
html body.birthday60 .stage-video{
  background:linear-gradient(180deg,#071012 0%,#081315 100%)!important;
  border-left:1px solid #8a6a2b!important;
  box-shadow:inset 1px 0 0 rgba(255,255,255,.04)!important;
}
html body.birthday60 .stage-video .youtube-frame{
  border:1px solid #4a3a1e!important;
  box-shadow:0 14px 34px rgba(0,0,0,.42)!important;
}
html body.birthday60 .stage-line{color:#9e9587!important;text-shadow:none!important}
html body.birthday60 .stage-line.near,
html body.birthday60 .stage-line.next{color:#d8c9a7!important}
html body.birthday60 .stage-line.active{
  background:linear-gradient(90deg,#f0b93f var(--sing-progress,0%),#fff1c8 var(--sing-progress,0%))!important;
  -webkit-background-clip:text!important;
  background-clip:text!important;
  color:transparent!important;
  text-shadow:none!important;
  filter:drop-shadow(0 0 12px rgba(224,169,55,.45))!important;
}
html body.birthday60 .stage-line.instrumental{color:#cba75d!important}
html body.birthday60 .stage-song-info span,
html body.birthday60 .stage-hint,
html body.birthday60 .stage-mic{color:#bcae90!important}
html body.birthday60 .stage-countdown{
  color:#f0bd48!important;
  text-shadow:0 0 45px rgba(240,189,72,.55)!important;
  background:rgba(8,7,5,.52)!important;
}
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
      link.href=cleanupUrl;
      d.head.appendChild(link);
    }else{
      link.href=cleanupUrl;
      d.head.appendChild(link);
    }

    let style=d.getElementById('kw60StageForceCss');
    if(!style){
      style=d.createElement('style');
      style.id='kw60StageForceCss';
      d.head.appendChild(style);
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
    if(wrap)wrap.style.setProperty('background','transparent','important');

    const video=d.querySelector('.stage-video');
    if(video){
      video.style.setProperty('background','linear-gradient(180deg,#071012 0%,#081315 100%)','important');
      video.style.setProperty('border-left','1px solid #8a6a2b','important');
      video.style.setProperty('box-shadow','inset 1px 0 0 rgba(255,255,255,.04)','important');
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
