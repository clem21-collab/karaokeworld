/* KaraokeWorld v0.27.7 — correctif bouton Voix ON/OFF */
(()=>{
  if(window.KaraokeWorldVoiceButtonFix?.installed)return;
  const $=id=>document.getElementById(id);
  let lastTrackId='';
  let hookedPlay=null;
  let busy=false;

  function rememberFromGlobals(){
    try{if(typeof currentId!=='undefined'&&currentId)lastTrackId=String(currentId)}catch(e){}
    try{if(!lastTrackId&&typeof ultraStarCurrentId!=='undefined'&&ultraStarCurrentId)lastTrackId=String(ultraStarCurrentId)}catch(e){}
    return lastTrackId;
  }

  function ensureCurrentId(){
    rememberFromGlobals();
    if(!lastTrackId)return '';
    try{if(typeof currentId!=='undefined'&&currentId!==lastTrackId)currentId=lastTrackId}catch(e){}
    return lastTrackId;
  }

  function hookPlayTrack(){
    try{
      if(typeof playTrack!=='function')return false;
      if(playTrack===hookedPlay||playTrack._kwVoiceFixV0277)return true;
      const original=playTrack;
      const wrapped=function(id){
        if(id)lastTrackId=String(id);
        const out=original.apply(this,arguments);
        setTimeout(syncButtons,0);
        setTimeout(syncButtons,350);
        return out;
      };
      wrapped._kwVoiceFixV0277=true;
      wrapped._kwVoiceOriginal=original;
      playTrack=wrapped;
      try{window.playTrack=wrapped}catch(e){}
      hookedPlay=wrapped;
      return true;
    }catch(e){console.warn('KaraokeWorld vocal button: hook playTrack',e);return false}
  }

  function activeTrackExists(){
    const id=ensureCurrentId();
    if(!id)return false;
    try{return typeof tracks!=='undefined'&&Array.isArray(tracks)&&tracks.some(t=>t?.id===id&&t?.kind!=='demo')}catch(e){return true}
  }

  function syncButtons(){
    hookPlayTrack();rememberFromGlobals();
    const hasTrack=activeTrackExists();
    for(const id of ['kwVoiceToggle','kwVoiceToggleStage']){
      const b=$(id);if(!b)continue;
      if(!busy)b.disabled=!hasTrack;
      if(!hasTrack&&!busy)b.title='Lance d’abord une chanson UltraStar';
    }
  }

  function visibleFeedback(text){
    const st=$('state');if(st)st.textContent=text;
    const vs=$('kwVocalStatus');if(vs)vs.textContent=text;
  }

  async function runToggle(){
    if(busy)return;
    const id=ensureCurrentId();
    if(!id||!activeTrackExists()){
      visibleFeedback('🎤 Lance d’abord une chanson UltraStar, puis appuie sur Voix ON/OFF.');
      syncButtons();return;
    }
    const api=window.KaraokeWorldVocalSeparation;
    if(!api?.toggle){
      visibleFeedback('⚠️ Le moteur Voix ON/OFF n’est pas encore chargé. Recharge la page avec Ctrl + F5.');
      return;
    }
    busy=true;
    const buttons=[$('kwVoiceToggle'),$('kwVoiceToggleStage')].filter(Boolean);
    buttons.forEach(b=>{b.disabled=true;b.textContent='⏳ Retrait de la voix…'});
    visibleFeedback('⏳ Voix OFF : préparation en cours… Au premier essai, le modèle IA doit se charger.');
    try{
      await api.toggle();
      const msg=$('kwVocalStatus')?.textContent||'Voix ON/OFF prêt.';
      if($('state'))$('state').textContent=msg;
    }catch(e){
      console.error('KaraokeWorld Voix ON/OFF v0.27.7',e);
      visibleFeedback('Voix ON/OFF impossible : '+(e?.message||e));
    }finally{
      busy=false;
      setTimeout(syncButtons,0);
      setTimeout(syncButtons,500);
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('#kwVoiceToggle,#kwVoiceToggleStage');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    runToggle();
  },true);

  function markVersion(){
    const s=document.querySelector('.brand small');
    if(s)s.textContent=' BETA · v0.27.7 · Voix ON/OFF 🎤';
  }

  function start(){
    hookPlayTrack();rememberFromGlobals();syncButtons();markVersion();
    [150,400,800,1500,3000,5000].forEach(ms=>setTimeout(()=>{hookPlayTrack();syncButtons();markVersion()},ms));
    setInterval(()=>{hookPlayTrack();syncButtons();markVersion()},700);
  }

  window.KaraokeWorldVoiceButtonFix={version:'0.27.7',installed:true,runToggle,syncButtons,getLastTrackId:()=>lastTrackId};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
