(()=>{
  const frame=document.getElementById('kwApp');
  const cleanupUrl=new URL('./cleanup.css?v=9',location.href).href;

  const forceCss=`
html body.birthday60::before,html body.birthday60::after,html body.birthday60 main::after,html body.birthday60 header .brand::before,html body.birthday60 footer::after{content:none!important;display:none!important;animation:none!important;filter:none!important}
html body.birthday60 .karaoke-stage{position:fixed!important;overflow:hidden!important;background:radial-gradient(circle at 48% 10%,rgba(151,78,176,.18) 0%,transparent 22%),radial-gradient(circle at 44% 46%,rgba(231,169,57,.18) 0%,transparent 31%),radial-gradient(circle at 40% 80%,rgba(114,57,22,.18) 0%,transparent 28%),linear-gradient(145deg,#080807 0%,#120d09 42%,#0d0b08 68%,#050606 100%)!important;contain:layout paint style!important}
html body.birthday60 .karaoke-stage::before{content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:-2!important;pointer-events:none!important;background:linear-gradient(90deg,rgba(4,5,5,.14),rgba(255,255,255,.01) 26%,rgba(255,255,255,.01) 72%,rgba(4,5,5,.22)),repeating-linear-gradient(116deg,rgba(255,255,255,.014) 0 2px,transparent 2px 48px)!important;opacity:.58!important}
html body.birthday60 .karaoke-stage::after{content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:-1!important;pointer-events:none!important;background:radial-gradient(ellipse at 40% 48%,rgba(255,198,78,.09) 0%,rgba(255,198,78,.035) 35%,transparent 67%),radial-gradient(circle at 42% 13%,rgba(184,91,206,.07) 0%,transparent 24%)!important}
html body.birthday60 .stage-lyrics-wrap{position:relative!important;overflow:hidden!important;isolation:isolate!important;background:radial-gradient(ellipse at 48% 42%,rgba(236,176,62,.20) 0%,rgba(128,79,26,.10) 24%,transparent 52%),radial-gradient(circle at 50% 4%,rgba(155,76,180,.13) 0%,transparent 28%),linear-gradient(180deg,rgba(13,11,9,.86) 0%,rgba(18,13,9,.76) 48%,rgba(7,8,7,.94) 100%)!important;box-shadow:inset -1px 0 0 rgba(229,183,81,.14),inset 0 1px 0 rgba(255,255,255,.025)!important;contain:layout paint!important}
html body.birthday60 .stage-lyrics-wrap::before{content:""!important;display:block!important;position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none!important;animation:none!important;filter:none!important;background:linear-gradient(105deg,transparent 10%,rgba(255,220,145,.035) 28%,transparent 43%),linear-gradient(255deg,transparent 15%,rgba(255,220,145,.025) 35%,transparent 48%),radial-gradient(ellipse at 50% 52%,rgba(255,207,100,.07),transparent 56%)!important}
html body.birthday60 .stage-lyrics-wrap::after{content:none!important;display:none!important;border:0!important;background:none!important;box-shadow:none!important}
html body.birthday60 .stage-lyrics-wrap>*{z-index:2!important}
html body.birthday60 .stage-bg::after{content:none!important;display:none!important;animation:none!important;filter:none!important}
html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-current,html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-prev,html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-next,html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-far{position:absolute!important;left:50%!important;right:auto!important;width:min(900px,82%)!important;max-width:82%!important;margin:0!important;text-align:center!important;transform:translate3d(-50%,-50%,0)!important;transition:top .18s cubic-bezier(.2,.8,.2,1),opacity .18s ease,font-size .18s ease!important;backface-visibility:hidden!important}
html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-current{top:50%!important;z-index:6!important;opacity:1!important;font-size:clamp(36px,3.7vw,62px)!important;line-height:1.12!important;will-change:background-position!important}
html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-prev{top:calc(50% - 155px)!important;z-index:5!important;opacity:.48!important;font-size:clamp(23px,2.25vw,38px)!important;line-height:1.18!important;color:#a99e8c!important;filter:none!important}
html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-next{top:calc(50% + 155px)!important;z-index:5!important;opacity:.68!important;font-size:clamp(24px,2.35vw,40px)!important;line-height:1.18!important;color:#c9bda4!important;filter:none!important}
html body.birthday60 .stage-lyrics-wrap .stage-line.kw60-far{top:50%!important;opacity:0!important;pointer-events:none!important;z-index:1!important;transition:none!important}
html body.birthday60 .stage-video{background:linear-gradient(180deg,#071012 0%,#081315 100%)!important;border-left:1px solid rgba(218,170,73,.38)!important;box-shadow:inset 1px 0 0 rgba(255,255,255,.04),-20px 0 55px rgba(0,0,0,.14)!important;contain:layout paint!important}
html body.birthday60 .stage-video .youtube-frame{border:1px solid #4a3a1e!important;box-shadow:0 14px 34px rgba(0,0,0,.42)!important}
html body.birthday60 .stage-line{color:#aaa08f!important;text-shadow:0 2px 12px rgba(0,0,0,.36)!important}
html body.birthday60 .stage-line.near,html body.birthday60 .stage-line.next{color:#ded0af!important}
html body.birthday60 .stage-line.active{background:linear-gradient(90deg,#efb63c var(--sing-progress,0%),#fff1c9 var(--sing-progress,0%))!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;text-shadow:none!important;filter:drop-shadow(0 0 10px rgba(226,170,54,.34))!important}
html body.birthday60 .stage-line.instrumental{color:#cba75d!important}
html body.birthday60 .stage-song-info span,html body.birthday60 .stage-hint,html body.birthday60 .stage-mic{color:#c2b697!important}
html body.birthday60 .stage-countdown{color:#f0bd48!important;text-shadow:0 0 35px rgba(240,189,72,.45)!important;background:rgba(8,7,5,.52)!important}
html body.birthday60 .stage-controls button,html body.birthday60 .stage-video button{box-shadow:none!important}
html body.birthday60 .stage-video input[type="range"],html body.birthday60 .karaoke-stage input[type="range"]{accent-color:#e9b749!important}
@media(prefers-reduced-motion:reduce){html body.birthday60 .stage-line{transition:none!important}}
`;

  function injectCleanup(d){
    if(!d?.head)return;
    let link=d.getElementById('kw60CleanupCss');
    if(!link){link=d.createElement('link');link.id='kw60CleanupCss';link.rel='stylesheet';d.head.appendChild(link)}
    if(link.href!==cleanupUrl)link.href=cleanupUrl;
    let style=d.getElementById('kw60StageForceCss');
    if(!style){style=d.createElement('style');style.id='kw60StageForceCss';style.textContent=forceCss;d.head.appendChild(style)}
  }

  let boundWrap=null,lyricsObserver=null,lastCurrent=null,raf=0,bodyObserver=null;
  function scheduleCenter(d,force=false){
    if(force)lastCurrent=null;
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;centerLyrics(d)});
  }
  function centerLyrics(d){
    const wrap=d.querySelector('.stage-lyrics-wrap');
    if(!wrap)return;
    const current=wrap.querySelector('.stage-line.active');
    if(!current||current===lastCurrent)return;
    lastCurrent=current;
    const lines=[...wrap.querySelectorAll('.stage-line')];
    if(!lines.length)return;
    const index=lines.indexOf(current);if(index<0)return;
    const prev=wrap.querySelector('.stage-line.near:not(.active)')||(index>0?lines[index-1]:null);
    const next=wrap.querySelector('.stage-line.next:not(.active)')||(index<lines.length-1?lines[index+1]:null);
    for(const line of lines){
      const wanted=line===current?'kw60-current':line===prev?'kw60-prev':line===next?'kw60-next':'kw60-far';
      if(line.dataset.kw60Pos===wanted)continue;
      line.classList.remove('kw60-current','kw60-prev','kw60-next','kw60-far');
      line.classList.add(wanted);line.dataset.kw60Pos=wanted;
    }
  }
  function bindLyrics(d){
    const wrap=d.querySelector('.stage-lyrics-wrap');
    if(!wrap||wrap===boundWrap)return;
    lyricsObserver?.disconnect();boundWrap=wrap;lastCurrent=null;
    lyricsObserver=new MutationObserver(muts=>{
      if(muts.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='class')))scheduleCenter(d);
    });
    lyricsObserver.observe(wrap,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    scheduleCenter(d,true);
  }
  function start(){
    try{
      const d=frame.contentDocument;if(!d?.body)return;
      injectCleanup(d);bindLyrics(d);
      bodyObserver?.disconnect();
      bodyObserver=new MutationObserver(muts=>{
        if(muts.some(m=>m.type==='childList'))requestAnimationFrame(()=>bindLyrics(d));
      });
      bodyObserver.observe(d.body,{childList:true,subtree:true});
    }catch(e){console.error('Nettoyage thème 60 ans',e)}
  }
  frame.addEventListener('load',()=>requestAnimationFrame(start));
})();
