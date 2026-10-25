(()=>{
  const frame=document.getElementById('kwApp');
  let observer=null,raf=0;

  function sync(d){
    const page=d.querySelector('.nav.active')?.dataset.page||'home';
    d.body.classList.toggle('kw60-home-active',page==='home');
  }

  function start(){
    try{
      const d=frame.contentDocument;
      if(!d?.body||!d?.head)return;

      if(!d.getElementById('kw60HomeCleanupStyle')){
        const s=d.createElement('style');
        s.id='kw60HomeCleanupStyle';
        s.textContent=`
          body.birthday60.kw60-home-active #librarySection{display:none!important}
          body.birthday60.kw60-home-active #page-home{padding-bottom:12px!important}
        `;
        d.head.appendChild(s);
      }

      const schedule=()=>{
        if(raf)return;
        raf=requestAnimationFrame(()=>{raf=0;sync(d)});
      };

      observer?.disconnect();
      observer=new MutationObserver(schedule);
      d.querySelectorAll('.nav').forEach(n=>observer.observe(n,{attributes:true,attributeFilter:['class']}));
      d.addEventListener('click',e=>{
        if(e.target.closest('.nav,.kw60-topnav,.kw60-side-link'))schedule();
      },{passive:true});
      sync(d);
    }catch(e){console.error('Accueil 60 ans',e)}
  }

  frame.addEventListener('load',()=>requestAnimationFrame(start));
})();
