(()=>{
const frame=document.getElementById('kwApp'),loader=document.getElementById('loading');
const themeUrl=new URL('./theme.css',location.href).href;
const q=(d,s)=>d.querySelector(s),qa=(d,s)=>[...d.querySelectorAll(s)];
function clickPage(d,page){q(d,`[data-page="${page}"]`)?.click()}
function search(d,text){const i=q(d,'#query');if(!i)return;i.value=text;i.dispatchEvent(new Event('input',{bubbles:true}));q(d,'#searchEverywhere')?.click()}
function el(d,tag,cls,html=''){const x=d.createElement(tag);if(cls)x.className=cls;if(html)x.innerHTML=html;return x}
function injectHead(d){if(!q(d,'#kw60ThemeCss')){const l=d.createElement('link');l.id='kw60ThemeCss';l.rel='stylesheet';l.href=themeUrl;d.head.appendChild(l)}}
function buildTop(d){const header=q(d,'header');if(!header||q(d,'.kw60-topnav'))return;
 const brand=q(d,'.brand');if(brand)brand.innerHTML='🎙 Karaoke<span>World</span>';
 const nav=el(d,'div','kw60-topnav');
 const items=[['home','⌂ Accueil'],['library','▦ Catalogue'],['playlist','☷ Playlists'],['library','♡ Favoris'],['library','♬ Préparation IA'],['settings','▲ Google Drive'],['settings','⚙ Paramètres']];
 items.forEach(([p,t],idx)=>{const b=el(d,'button',idx===0?'active':'',t);b.type='button';b.dataset.kwPage=p;if(idx===3)b.dataset.favs='1';b.onclick=()=>{clickPage(d,p);if(b.dataset.favs){setTimeout(()=>{const c=q(d,'#favoritesOnly');if(c&&!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))}},100)}};nav.appendChild(b)});
 header.insertBefore(nav,q(d,'.top-actions'));
 const sr=el(d,'label','kw60-top-search','<span>⌕</span><input placeholder="Rechercher une chanson, un artiste...">');sr.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter')search(d,e.target.value)});header.insertBefore(sr,q(d,'.top-actions'));
 const sun=el(d,'button','kw60-sun','☼');sun.type='button';header.insertBefore(sun,q(d,'.top-actions'));
 const top=q(d,'.top-actions');if(top&&!q(d,'.kw60-normal')){const b=el(d,'button','kw60-normal','↩ Version normale');b.type='button';b.onclick=()=>window.top.location.href='../';top.prepend(b)}
}
function buildSide(d){const side=q(d,'aside');if(!side||q(d,'.kw60-side-title'))return;
 const first=q(d,'.nav');const lab=el(d,'div','kw60-side-title','THÈME 60 ANS');side.insertBefore(lab,first);
 const special=el(d,'button','kw60-side-link special','<span>♛</span> Spécial 60 ans');special.type='button';special.onclick=()=>clickPage(d,'home');
 const lastNav=qa(d,'.nav').at(-1);lastNav.insertAdjacentElement('afterend',special);
 const sep=el(d,'div','kw60-side-sep');special.insertAdjacentElement('afterend',sep);
 const sources=el(d,'div','kw60-side-title','MES SOURCES');sep.insertAdjacentElement('afterend',sources);
 [['⌕','Recherche en ligne','home'],['▣','Mes fichiers locaux','library'],['▲','Google Drive','settings']].forEach(([ico,t,p])=>{const b=el(d,'button','kw60-side-link',`<span>${ico}</span> ${t}`);b.type='button';b.onclick=()=>clickPage(d,p);sources.insertAdjacentElement('afterend',b);sources.parentNode.insertBefore(b,sources.nextSibling)});
 const decor=el(d,'div','kw60-side-decor','<span class="kw60-note a">♪</span><span class="kw60-note b">♫</span><span class="kw60-note c">♪</span><div class="kw60-plaque"><strong>60 ans</strong><span>JOYEUX<br>ANNIVERSAIRE</span></div>');side.appendChild(decor)
}
function buildHero(d){const h=q(d,'#homeHero');if(!h||q(d,'.kw60-hero-copy'))return;
 const road=el(d,'div','kw60-road');h.prepend(road);
 const balloons=el(d,'div','kw60-balloons','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');h.prepend(balloons);
 ['p1','p2','p3'].forEach(c=>h.prepend(el(d,'div','kw60-polaroid '+c)));
 const copy=el(d,'div','kw60-hero-copy','<span class="sp">Spécial</span><span class="age">60 ans</span><p>Une soirée en musique ♥<br>pour des souvenirs inoubliables !</p>');h.prepend(copy);
 h.prepend(el(d,'div','kw60-hero-quote','Des kilomètres parcourus,<br>des souvenirs partagés,<br>et encore tant de belles chansons<br>à écrire… ♥'));
 const chips=el(d,'div','kw60-chips');[['♛ Spécial 60 ans',''],['♫ Variété française','variété française'],['▣ Années 80','années 80'],['🎷 Jazz','jazz'],['🎉 Ambiance fête','fête'],['💗 Chansons personnalisées','personnalisée'],['▦ Tous les genres','']].forEach(([t,s],i)=>{const b=el(d,'button','kw60-chip'+(i===0?' active':''),t);b.type='button';b.onclick=()=>s?search(d,s):clickPage(d,i===0?'home':'library');chips.appendChild(b)});
 q(d,'.home-search')?.insertAdjacentElement('afterend',chips)
}
function relabel(d){
 const set=(s,t)=>{const x=q(d,s);if(x)x.textContent=t};
 set('#favoritesSection h2','♥ Favoris de la soirée');set('#ideasSection h2','♛ Sélection spéciale 60 ans');set('#librarySection h2','♫ Catalogue de la soirée');
 set('#ultrastarPanel h2','🎤 Bibliothèque UltraStar · Soirée 60 ans');set('#online h2','🌐 Recherche karaoké en ligne');set('#lyrics-search h2','🎼 Paroles synchronisées');
 const ph=q(d,'#query');if(ph)ph.placeholder='Rechercher une chanson, un artiste, une ambiance...';
 const oq=q(d,'#onlineQuery');if(oq)oq.placeholder='Ex. Johnny Hallyday, Images, années 80...';
}
function pageBanner(d){if(q(d,'#kw60PageBanner'))return;const main=q(d,'main');if(!main)return;const b=el(d,'div','kw60-inline-banner');b.id='kw60PageBanner';b.hidden=true;main.prepend(b)}
function activePage(d){return q(d,'.nav.active')?.dataset.page||'home'}
function syncPage(d){const p=activePage(d);qa(d,'.kw60-topnav button').forEach(b=>b.classList.toggle('active',b.dataset.kwPage===p&&!(p==='library'&&b.dataset.favs)));
 const b=q(d,'#kw60PageBanner');if(!b)return;const map={library:['▦ Catalogue de la soirée','Toutes les chansons prêtes pour les 60 ans de Laurent.'],playlist:['☷ Playlist de la soirée','Prépare l’ordre des chansons avant de lancer la fête.'],mic:['🎙 Micro & scène','Réglages micro, enceintes et ambiance pour la soirée.'],settings:['⚙ Paramètres de la soirée','Comptes, Google Drive, YouTube et sauvegarde.']};if(!map[p]){b.hidden=true;return}b.hidden=false;b.innerHTML=`<div style="font-size:26px">${map[p][0].split(' ')[0]}</div><div><b>${map[p][0].slice(2)}</b><br><small>${map[p][1]}</small></div>`}
function observe(d){qa(d,'.nav').forEach(n=>n.addEventListener('click',()=>setTimeout(()=>syncPage(d),0)));const mo=new MutationObserver(()=>syncPage(d));qa(d,'.nav').forEach(n=>mo.observe(n,{attributes:true,attributeFilter:['class']}))}
function apply(){try{const d=frame.contentDocument;if(!d||!d.body)return;d.title='KaraokeWorld · Spécial 60 ans';d.body.classList.add('birthday60');injectHead(d);buildTop(d);buildSide(d);buildHero(d);relabel(d);pageBanner(d);observe(d);syncPage(d);if(loader)loader.style.display='none'}catch(e){console.error('KaraokeWorld 60 ans',e);if(loader)loader.innerHTML='Impossible de charger la version 60 ans.<small>Recharge la page.</small>'}}
frame.addEventListener('load',()=>{apply();setTimeout(apply,500);setTimeout(apply,1500)});
})();
