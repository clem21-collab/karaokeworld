(()=>{
  const frame=document.getElementById('kwApp');
  const cssUrl=new URL('./polish.css?v=2',location.href).href;

  function inject(){
    try{
      const d=frame.contentDocument;
      if(!d||!d.head||!d.body)return;

      let link=d.getElementById('kw60PolishCss');
      if(!link){
        link=d.createElement('link');
        link.id='kw60PolishCss';
        link.rel='stylesheet';
        d.head.appendChild(link);
      }
      link.href=cssUrl;
      d.head.appendChild(link);

      const header=d.querySelector('header');
      const brand=d.querySelector('header .brand');
      if(header&&brand&&!d.querySelector('.kw60-brand-badge')){
        const badge=d.createElement('span');
        badge.className='kw60-brand-badge';
        badge.textContent='ÉDITION 60 ANS';
        brand.insertAdjacentElement('afterend',badge);
      }

      const hero=d.querySelector('#homeHero');
      if(hero&&!d.querySelector('.kw60-hero-seal')){
        const seal=d.createElement('div');
        seal.className='kw60-hero-seal';
        seal.innerHTML='<div><strong>60</strong><span>ANS</span><small>LAURENT</small></div>';
        hero.appendChild(seal);
      }
    }catch(e){console.error('Finitions 60 ans',e)}
  }

  frame.addEventListener('load',()=>{
    setTimeout(inject,80);
    setTimeout(inject,650);
    setTimeout(inject,1600);
    setTimeout(inject,3200);
  });
})();
