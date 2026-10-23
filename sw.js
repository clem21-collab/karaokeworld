const CACHE="karaokeworld-v0.27.7-voice-button-fix";
const FILES=["./","./index.html","./style.css","./v0255-hotfix.css","./video-compat-v0260.css","./app.js","./recently-sung.js","./song-covers.js","./youtube-lrclib-smart-match.js","./v0255-hotfix.js","./video-compat-v0260.js","./video-preconvert-v0261.js","./video-compat-worker-v0260.js","./cloud-ultrastar-v0266.js","./public-starter-v0266.js","./hotfix-v0267.js","./video-once-v0272.js","./library-dedupe-v0275.js","./vocal-separation-v0276.js","./vocal-button-fix-v0277.js","./manifest.webmanifest"];
const BYPASS=new Set(["sitemap.xml","robots.txt"]);
const PRESERVE=new Set(["karaokeworld-converted-video-v1","karaokeworld-instrumental-v1","web-demix2-models"]);
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&!PRESERVE.has(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url),name=u.pathname.split("/").pop();
  if(BYPASS.has(name)||/^google[a-z0-9_-]+\.html$/i.test(name)){e.respondWith(fetch(e.request,{cache:"no-store"}));return}
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return resp}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match("./index.html"))));
});
