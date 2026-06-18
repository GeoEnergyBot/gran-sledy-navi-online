const CACHE='gran-shell-v18';
const SHELL=[
  '/',
  '/styles.css?v=6',
  '/stable-core.js?v=2',
  '/app.js?v=6',
  '/onboarding.css?v=2',
  '/onboarding.js?v=2',
  '/map-enhancements.css?v=6',
  '/map-enhancements.js?v=6',
  '/journey.css?v=3',
  '/journey.js?v=3',
  '/district.css?v=3',
  '/district.js?v=3',
  '/ui-v2.css?v=3',
  '/ui-v2.js?v=3',
  '/ar-encounter.css?v=4',
  '/ar-encounter-adaptive.css?v=1',
  '/ar-encounter.js?v=4'
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