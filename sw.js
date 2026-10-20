const CACHE="karaokeworld-v08";
const FILES=["./","./index.html","./style.css","./app.js","./manifest.webmanifest"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(resp=>{if(new URL(e.request.url).origin===location.origin){const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone))}return resp}).catch(()=>caches.match("./index.html"))))});