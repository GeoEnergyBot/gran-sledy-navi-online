const CACHE='gran-shell-v9';
const SHELL=[
  '/',
  '/styles.css',
  '/app.js',
  '/onboarding.css?v=1',
  '/onboarding.js?v=1',
  '/map-enhancements.css?v=1',
  '/map-enhancements.js?v=1',
  '/journey.css?v=1',
  '/journey.js?v=1',
  '/district.css?v=1',
  '/district.js?v=1'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request)));
});