(()=>{
  const frame=document.getElementById('kwApp');

  function promote(root){
    if(!root)return;
    const slot=root.querySelector('.cover,.home-emoji,.mini');
    if(!slot)return;
    const bg=slot.style.backgroundImage||'';
    if(!bg||(!bg.includes('url(')&&!bg.includes('data:image')))return;

    slot.style.setProperty('background-image',bg,'important');
    slot.style.setProperty('background-size','cover','important');
    slot.style.setProperty('background-position','center','important');
    slot.style.setProperty('background-repeat','no-repeat','important');
    slot.style.setProperty('color','transparent','important');

    if(root.matches('.track,.home-card')){
      slot.style.setProperty('box-shadow','inset 0 -42px 55px rgba(0,0,0,.10)','important');
    }
  }

  function scan(d){
    d.querySelectorAll('.track,.home-card,.queue-item,.youtube-result').forEach(promote);
  }

  function install(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.body)return;
      scan(d);

      if(d.__kw60CoverFixObserver)return;
      const mo=new MutationObserver(muts=>{
        let needsScan=false;
        for(const m of muts){
          if(m.type==='childList'||m.type==='attributes'){needsScan=true;break}
        }
        if(needsScan){
          clearTimeout(mo.t);
          mo.t=setTimeout(()=>scan(d),80);
        }
      });
      mo.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-kw-cover','class']});
      d.__kw60CoverFixObserver=mo;

      const timer=setInterval(()=>scan(d),1200);
      d.__kw60CoverFixTimer=timer;
      setTimeout(()=>clearInterval(timer),45000);
    }catch(e){console.error('Jaquettes 60 ans',e)}
  }

  frame.addEventListener('load',()=>{
    setTimeout(install,500);
    setTimeout(install,1800);
    setTimeout(install,4500);
  });
})();
