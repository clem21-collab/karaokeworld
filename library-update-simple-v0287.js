/* KaraokeWorld v0.28.7 — mise à jour simplifiée de la bibliothèque UltraStar */
(()=>{
  if(window.KaraokeWorldSimpleLibraryUpdate?.installed)return;
  const VERSION='0.28.7';
  const TOKEN_KEY='kw_drive_access_token_v1';
  const TOKEN_EXP_KEY='kw_drive_access_exp_v1';
  const $=id=>document.getElementById(id);
  const token=()=>{try{const t=sessionStorage.getItem(TOKEN_KEY)||'',exp=Number(sessionStorage.getItem(TOKEN_EXP_KEY)||0);return t&&exp>Date.now()+30000?t:''}catch(e){return''}};
  const currentUser=()=>{try{return cloudUser||cloudApi?.auth?.currentUser||null}catch(e){return window.cloudApi?.auth?.currentUser||null}};
  const setStatus=(text,kind='')=>{const el=$('cloudUltraStarStatus');if(el){el.textContent=text;el.dataset.kind=kind}};
  let busy=false;

  function updateMainButton(){
    const b=$('kwLibraryUpdateMain');if(!b)return;
    b.disabled=busy;
    if(busy){b.textContent='🔄 Mise à jour en cours…';return}
    if(!currentUser()){b.textContent='👤 Connecter mon compte Google';return}
    if(!token()){b.textContent='🔐 Autoriser Google Drive';return}
    b.textContent='🔄 Mettre à jour ma bibliothèque';
  }

  function arrangeAdvanced(){
    const box=$('cloudUltraStarBox'),body=$('kwLibraryAdvancedBody');if(!box||!body)return false;
    const controls=[...box.querySelectorAll(':scope > .controls.wrap')];
    controls.forEach(c=>body.appendChild(c));
    const help=$('kwUltraStarSyncHelp');if(help&&help.parentElement!==body)body.appendChild(help);
    const resume=$('driveResumeBox');if(resume&&resume.parentElement===box)body.appendChild(resume);
    return true;
  }

  async function runUpdate(files){
    if(!files?.length)return;
    busy=true;updateMainButton();
    try{
      setStatus('🔎 Mise à jour de la bibliothèque · analyse du dossier…');

      const removeApi=window.KaraokeWorldUltraStarFolderSync;
      if(removeApi?.syncFolder){
        await removeApi.syncFolder(files);
        const afterRemove=String($('cloudUltraStarStatus')?.textContent||'');
        if(/annulée|annulé|vérification de sécurité/i.test(afterRemove)){
          setStatus('Mise à jour annulée. Aucun autre changement n’a été envoyé.');
          return;
        }
        if(/Synchronisation impossible|Aucune chanson UltraStar complète/i.test(afterRemove))return;
      }

      if(!token()){
        setStatus('🔐 Google Drive doit être réautorisé pour terminer la mise à jour. Clique de nouveau sur le bouton principal après autorisation.','error');
        return;
      }

      setStatus('🔎 Vérification des nouvelles chansons et des fichiers modifiés…');
      const cloudInput=$('cloudUltraStarInput');
      if(!cloudInput||typeof cloudInput.onchange!=='function')throw new Error('Le module Google Drive n’est pas encore prêt.');
      await cloudInput.onchange({target:{files}});
      try{await window.KaraokeWorldCloudUltraStar?.reload?.()}catch(e){}
      try{window.KaraokeWorldVocalSeparation?.countPrepared?.()}catch(e){}
    }catch(e){
      console.error('Mise à jour simplifiée KaraokeWorld',e);
      setStatus('Mise à jour impossible : '+(e?.message||e),'error');
    }finally{
      busy=false;updateMainButton();
      const input=$('kwLibraryUpdateInput');if(input)input.value='';
    }
  }

  function mainClick(){
    if(busy)return;
    if(!currentUser()){
      setStatus('Connecte-toi d’abord avec Google dans ⚙ Paramètres, puis reviens ici.','error');
      const settings=$('googleSignIn');if(settings)settings.focus();
      return;
    }
    if(!token()){
      setStatus('🔐 Autorisation Google Drive nécessaire. Une fois autorisé, clique de nouveau sur « Mettre à jour ma bibliothèque ».');
      const auth=$('cloudDriveAuthorize');
      if(auth&&!auth.disabled)auth.click();
      return;
    }
    $('kwLibraryUpdateInput')?.click();
  }

  function mount(){
    const box=$('cloudUltraStarBox');if(!box)return false;
    if($('kwLibraryUpdateMain')){arrangeAdvanced();updateMainButton();return true}

    const firstControls=box.querySelector(':scope > .controls.wrap');
    if(!firstControls)return false;

    const simple=document.createElement('div');simple.id='kwLibrarySimpleBox';
    simple.style.cssText='margin:10px 0 8px;padding:13px;border:1px solid rgba(139,92,246,.32);border-radius:12px;background:linear-gradient(135deg,rgba(56,189,248,.08),rgba(139,92,246,.08))';
    simple.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div style="min-width:220px;flex:1"><b style="display:block">Ma bibliothèque UltraStar</b><span class="muted" style="display:block;margin-top:3px;font-size:12px">Un seul bouton : ajoute les nouvelles chansons, met à jour celles qui ont changé et retire celles supprimées du dossier.</span></div><button id="kwLibraryUpdateMain" type="button">🔄 Mettre à jour ma bibliothèque</button></div><input id="kwLibraryUpdateInput" type="file" webkitdirectory multiple hidden>';
    box.insertBefore(simple,firstControls);

    const details=document.createElement('details');details.id='kwLibraryAdvanced';
    details.style.cssText='margin-top:8px;border-top:1px solid rgba(148,163,184,.16);padding-top:8px';
    details.innerHTML='<summary style="cursor:pointer;user-select:none;font-size:12px;font-weight:700;opacity:.78">⚙ Options avancées</summary><div id="kwLibraryAdvancedBody" style="margin-top:9px;display:grid;gap:8px"></div>';
    simple.insertAdjacentElement('afterend',details);

    $('kwLibraryUpdateMain').onclick=mainClick;
    $('kwLibraryUpdateInput').onchange=e=>runUpdate(e.target.files);
    arrangeAdvanced();updateMainButton();
    return true;
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{if(mount()||++tries>120)clearInterval(timer)},200);
    [700,1500,3000,5000,8000].forEach(ms=>setTimeout(()=>{mount();arrangeAdvanced();updateMainButton()},ms));
    window.addEventListener('kw-drive-token',()=>{setTimeout(()=>{arrangeAdvanced();updateMainButton()},100)});
    setInterval(()=>{arrangeAdvanced();updateMainButton()},2500);
  }

  window.KaraokeWorldSimpleLibraryUpdate={version:VERSION,installed:true,mount,runUpdate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
