(()=>{
  const frame=document.getElementById('kwApp');
  const cleanupUrl=new URL('./cleanup.css?v=2',location.href).href;

  const forceCss=`
html body.birthday60::before,
html body.birthday60::after,
html body.birthday60 main::after,
html body.birthday60 header .brand::before,
html body.birthday60 footer::after{content:none!important;display:none!important;animation:none!important;filter:none!important}

html body.birthday60 .karaoke-stage{
  background:radial-gradient(circle at 42% 45%,rgba(191,128,29,.12),transparent 34%),linear-gradient(135deg,#080806 0%,#0d0b08 52%,#050606 100%)!important;
}
html body.birthday60 .karaoke-stage::after{
  content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:-1!important;
  background:linear-gradient(90deg,rgba(7,7,6,.58),rgba(10,8,5,.76))!important;pointer-events:none!important;
}
html body.birthday60 .stage-lyrics-wrap{
  background:radial-gradient(ellipse at 50% 45%,rgba(196,132,30,.15) 0%,rgba(40,27,11,.14) 34%,#0a0907 72%,#050606 100%)!important;
}
html body.birthday60 .stage-lyrics-wrap::before,
html body.birthday60 .stage-bg::after{content:none!important;display:none!important;animation:none!important;filter:none!important}
html body.birthday60 .stage-video{background:linear-gradient(180deg,#090b0a,#0e0d09)!important;border-left:1px solid #725622!important}
html body.birthday60 .stage-line{color:#9d9587!important;text-shadow:none!important}
html body.birthday60 .stage-line.near,
html body.birthday60 .stage-line.next{color:#d8c9a7!important}
html body.birthday60 .stage-line.active{
  background:linear-gradient(90deg,#f0b93f var(--sing-progress,0%),#fff1c8 var(--sing-progress,0%))!important;
  -webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;text-shadow:none!important;
  filter:drop-shadow(0 0 12px rgba(224,169,55,.48))!important;
}
html body.birthday60 .stage-line.instrumental{color:#cba75d!important}
html body.birthday60 .stage-song-info span,
html body.birthday60 .stage-hint,
html body.birthday60 .stage-mic{color:#bcae90!important}
html body.birthday60 .stage-countdown{color:#f0bd48!important;text-shadow:0 0 45px rgba(240,189,72,.55)!important;background:rgba(8,7,5,.52)!important}
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
      style.textContent=forceCss;
      d.head.appendChild(style);
    }else{
      style.textContent=forceCss;
      d.head.appendChild(style);
    }
  }

  function forceStage(d){
    injectCleanup(d);
    const stage=d.querySelector('.karaoke-stage');
    if(!stage)return;
    stage.style.setProperty('background','radial-gradient(circle at 42% 45%,rgba(191,128,29,.12),transparent 34%),linear-gradient(135deg,#080806 0%,#0d0b08 52%,#050606 100%)','important');

    const wrap=d.querySelector('.stage-lyrics-wrap');
    if(wrap)wrap.style.setProperty('background','radial-gradient(ellipse at 50% 45%,rgba(196,132,30,.15) 0%,rgba(40,27,11,.14) 34%,#0a0907 72%,#050606 100%)','important');

    const video=d.querySelector('.stage-video');
    if(video){
      video.style.setProperty('background','linear-gradient(180deg,#090b0a,#0e0d09)','important');
      video.style.setProperty('border-left','1px solid #725622','important');
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
