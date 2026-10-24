(()=>{
  const frame=document.getElementById('kwApp');
  const cssUrl=new URL('./polish.css?v=1',location.href).href;

  function inject(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.head)return;
      let link=d.getElementById('kw60PolishCss');
      if(!link){
        link=d.createElement('link');
        link.id='kw60PolishCss';
        link.rel='stylesheet';
        link.href=cssUrl;
        d.head.appendChild(link);
      }else{
        link.href=cssUrl;
        d.head.appendChild(link);
      }
    }catch(e){console.error('Finitions 60 ans',e)}
  }

  frame.addEventListener('load',()=>{
    setTimeout(inject,80);
    setTimeout(inject,650);
    setTimeout(inject,1600);
  });
})();
