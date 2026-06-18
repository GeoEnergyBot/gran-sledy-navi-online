(()=>{
  const UI={map:null,world:[],position:{lat:43.238949,lng:76.889709},routeLine:null,routeTarget:null};
  const $=s=>document.querySelector(s);
  const typeBySymbol={'⌁':'trace','◉':'creature','✦':'resource','◇':'artifact','⬡':'rift'};

  if(window.L?.map){
    const originalMap=window.L.map;
    window.L.map=function(...args){
      const map=originalMap.apply(this,args);UI.map=map;window.__granMap=map;
      map.on('zoomend',updateMarkerDensity);
      return map;
    };
  }

  const baseFetch=window.fetch.bind(window);
  window.fetch=async(...args)=>{
    const response=await baseFetch(...args);
    try{
      const url=String(args[0]?.url||args[0]||'');
      if(url.includes('/api/world')){
        const data=await response.clone().json();UI.world=Array.isArray(data.objects)?data.objects:[];
        setTimeout(()=>{classifyMarkers();updateMarkerDensity()},0);
      }
    }catch{}
    return response;
  };

  function distanceM(a,b){
    const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;
    return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2));
  }
  function formatDistance(n){return n<1000?`${Math.round(n)} м`:`${(n/1000).toFixed(1)} км`}
  function walkTime(n){return Math.max(1,Math.round(n/75))}
  function currentObject(){
    const title=$('#sheetContent .event-hero h2')?.textContent?.trim()||$('#sheetContent h2')?.textContent?.trim();
    return UI.world.find(x=>x.title===title)||null;
  }
  function classifyMarkers(){
    document.querySelectorAll('.world-marker').forEach(marker=>{
      const symbol=marker.querySelector('span')?.textContent?.trim();
      const type=typeBySymbol[symbol]||'trace';
      marker.dataset.markerType=type;
      const host=marker.closest('.leaflet-marker-icon');
      if(host&&!host.dataset.uiBound){
        host.dataset.uiBound='1';
        host.addEventListener('click',()=>setTimeout(()=>focusSelectedMarker(host),0));
      }
    });
  }
  function focusSelectedMarker(host){
    document.querySelectorAll('.world-marker').forEach(x=>{x.classList.remove('ui-active');x.classList.add('ui-dim')});
    const marker=host.querySelector('.world-marker');
    if(marker){marker.classList.remove('ui-dim');marker.classList.add('ui-active')}
  }
  function clearFocus(){document.querySelectorAll('.world-marker').forEach(x=>x.classList.remove('ui-active','ui-dim'))}
  function updateMarkerDensity(){
    classifyMarkers();
    const zoom=UI.map?.getZoom?.()||16;
    const limit=zoom>=18?28:zoom>=17?20:14;
    const hosts=[...document.querySelectorAll('.leaflet-marker-icon')].filter(x=>x.querySelector('.world-marker'));
    hosts.forEach((host,index)=>host.classList.toggle('ui-hidden-marker',index>=limit));
  }
  function createMapMenu(){
    const view=$('.view[data-view="map"]');if(!view||$('.ui-map-menu'))return;
    const btn=document.createElement('button');btn.className='ui-map-menu';btn.type='button';btn.setAttribute('aria-label','Фильтры карты');btn.textContent='☷';
    btn.onclick=()=>{const legend=$('.map-legend');if(!legend)return;legend.classList.toggle('ui-open');btn.classList.toggle('active',legend.classList.contains('ui-open'))};
    view.append(btn);
  }
  function removeOldRoute(){
    if(UI.routeLine){try{UI.routeLine.remove()}catch{}UI.routeLine=null}
    UI.routeTarget=null;$('.ui-route-card')?.remove();clearFocus();
  }
  function buildInternalRoute(obj){
    if(!obj||!UI.map||!window.L)return;
    removeOldRoute();UI.routeTarget=obj;
    const from=[UI.position.lat,UI.position.lng],to=[obj.lat,obj.lng];
    UI.routeLine=L.polyline([from,to],{color:'#77e0a2',weight:5,opacity:.92,dashArray:'10 10',className:'ui-route-line'}).addTo(UI.map);
    const bounds=L.latLngBounds([from,to]);UI.map.fitBounds(bounds.pad(.28),{animate:true,maxZoom:17});
    const markerHosts=[...document.querySelectorAll('.leaflet-marker-icon')];
    let nearest=null,best=Infinity;
    markerHosts.forEach(host=>{const p=host._leaflet_pos;if(!p)return;const rect=host.getBoundingClientRect();const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;const container=$('#map')?.getBoundingClientRect();if(!container)return;const point=UI.map.latLngToContainerPoint([obj.lat,obj.lng]);const dx=cx-container.left-point.x,dy=cy-container.top-point.y,dist=dx*dx+dy*dy;if(dist<best){best=dist;nearest=host}});
    if(nearest)focusSelectedMarker(nearest);
    const view=$('.view[data-view="map"]');const card=document.createElement('div');card.className='ui-route-card';
    const d=distanceM(UI.position,obj);
    card.innerHTML=`<div class="route-icon">⌖</div><div><b>${obj.title||'Выбранная цель'}</b><small>${formatDistance(d)} · около ${walkTime(d)} мин пешком · маршрут внутри игры</small></div><button type="button">Скрыть</button>`;
    card.querySelector('button').onclick=removeOldRoute;view.append(card);$('#sheetClose')?.click();
    try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')}catch{navigator.vibrate?.(20)}
  }
  function interceptRoutes(){
    document.addEventListener('click',event=>{
      const route=event.target.closest('.route-btn');
      if(route){event.preventDefault();event.stopImmediatePropagation();buildInternalRoute(currentObject());return}
      if(event.target.closest('#sheetClose,#sheetBackdrop'))clearFocus();
    },true);
  }
  function watchPosition(){
    if(!navigator.geolocation)return;
    navigator.geolocation.watchPosition(pos=>{
      UI.position={lat:pos.coords.latitude,lng:pos.coords.longitude};
      if(UI.routeTarget&&UI.routeLine)UI.routeLine.setLatLngs([[UI.position.lat,UI.position.lng],[UI.routeTarget.lat,UI.routeTarget.lng]]);
    },()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:10000});
  }
  function observeMap(){
    const map=$('#map');if(!map)return;
    new MutationObserver(()=>requestAnimationFrame(()=>{classifyMarkers();updateMarkerDensity()})).observe(map,{childList:true,subtree:true});
  }
  function simplifyTransientUi(){
    $('.first-session-hint')?.remove();
    const journey=$('.journey-card');if(journey)journey.classList.add('hidden');
  }
  window.addEventListener('load',()=>{
    createMapMenu();interceptRoutes();watchPosition();observeMap();simplifyTransientUi();
    setTimeout(()=>{classifyMarkers();updateMarkerDensity()},1000);
  });
})();
