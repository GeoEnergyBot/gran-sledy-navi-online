const CACHE='gran-shell-v12';
const SHELL=[
  '/',
  '/styles.css',
  '/stable-core.js?v=1',
  '/app.js?v=5',
  '/onboarding.css?v=1',
  '/onboarding.js?v=1',
  '/map-enhancements.css?v=3',
  '/map-enhancements.js?v=3',
  '/journey.css?v=2',
  '/journey.js?v=2',
  '/district.css?v=2',
  '/district.js?v=2',
  '/ui-v2.css?v=2',
  '/ui-v2.js?v=2',
  '/ar-encounter.css?v=1',
  '/ar-encounter.js?v=1'
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