(()=>{
  const frame=document.getElementById('kwApp');
  const cleanupUrl=new URL('./cleanup.css',location.href).href;
  function inject(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.head)return;
      if(!d.getElementById('kw60CleanupCss')){
        const l=d.createElement('link');
        l.id='kw60CleanupCss';
        l.rel='stylesheet';
        l.href=cleanupUrl;
        d.head.appendChild(l);
      }else{
        d.head.appendChild(d.getElementById('kw60CleanupCss'));
      }
    }catch(e){console.error('Nettoyage thème 60 ans',e)}
  }
  frame.addEventListener('load',()=>{
    setTimeout(inject,50);
    setTimeout(inject,700);
    setTimeout(inject,1800);
  });
})();
