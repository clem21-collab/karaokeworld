/* KaraokeWorld v0.29.5 — décalage des paroles UltraStar locales */
(()=>{
  'use strict';
  // /60ans/ embeds the main app. Keep its existing behavior unchanged.
  try{if(/\/60ans(?:\/|$)/.test(location.pathname)||
    (window.parent!==window&&/\/60ans(?:\/|$)/.test(window.parent.location.pathname)))return}catch(e){return}
  if(window.KaraokeWorldLocalLyricSync?.installed)return;
  const originalRender=renderUltraStarStage,originalKey=syncKey;
  const originalSet=setOffset,originalSave=saveVideoOffset;
  let activeKey='';
  function localTrack(){
    if(!ultraStarCurrentId||isUltraStarYouTube()||currentYoutubeId)return null;
    return tracks.find(t=>t.id===ultraStarCurrentId)||null;
  }
  function fingerprint(value){let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
  function localKey(){
    const t=localTrack();if(!t)return '';
    const us=t.ultraStar||{},meta=us.meta||{};
    // IDs can change on folder import; text and media identify the song edition.
    const identity=[String(t.artist||'').normalize('NFC'),String(t.title||'').normalize('NFC'),
      meta.MP3||'',meta.VIDEO||'',us.sourceText||JSON.stringify(us.groups||[]),t.blob?.size||0].join('|');
    return 'ultrastar_local_'+fingerprint(identity);
  }
  function activate(){
    const key=localKey();
    if(key&&key!==activeKey){activeKey=key;originalSet(Number(videoSyncMap()[key]?.globalOffset||0),'')}
    if(!key)activeKey='';
    return key;
  }
  syncKey=function(){return localKey()||originalKey()};
  renderUltraStarStage=function(seconds){
    const local=activate();
    return originalRender(Number(seconds)+(local?lyricOffset:0));
  };
  setOffset=function(value,label){
    activate();originalSet(value,label);
    if(localTrack())renderUltraStarStage(Number($('audio')?.currentTime)||0);
  };
  saveVideoOffset=function(){
    const t=localTrack();
    if(t){saveSyncProfile({globalOffset:lyricOffset,title:t.title||'',mode:'ultrastar-local',anchors:[]});return}
    return originalSave();
  };
  window.KaraokeWorldLocalLyricSync={installed:true,version:'0.29.5'};
})();
