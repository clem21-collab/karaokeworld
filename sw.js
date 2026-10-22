const CACHE="karaokeworld-v0.26.2-multi-preconvert";
const FILES=["./","./index.html","./style.css","./v0255-hotfix.css","./video-compat-v0260.css","./app.js","./v0255-hotfix.js","./video-compat-v0260.js","./video-preconvert-v0261.js","./video-compat-worker-v0260.js","./manifest.webmanifest"];
const BYPASS=new Set(["sitemap.xml","robots.txt"]);
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!=="karaokeworld-converted-video-v1").map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url), name=u.pathname.split("/").pop();
  if(BYPASS.has(name)||/^google[a-z0-9_-]+\.html$/i.test(name)){e.respondWith(fetch(e.request,{cache:"no-store"}));return}
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return resp}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match("./index.html"))));
});
