const ME={world:[],position:null,demoMode:true,scanned:false};
const typeIcon={trace:'⌁',creature:'◉',resource:'✦',artifact:'◇',rift:'⬡'};
const typeName={trace:'След',creature:'Существо',resource:'Источник',artifact:'Артефакт',rift:'Разлом'};

function distanceM(a,b){
  if(!a||!b)return Infinity;
  const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;
  return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2));
}
function fmt(n){return n<1000?`${Math.round(n)} м`:`${(n/1000).toFixed(1)} км`}
function walkTime(n){return Math.max(1,Math.round(n/75))}
function toast(text){const root=document.querySelector('#toasts');if(!root)return;const el=document.createElement('div');el.className='toast';el.textContent=text;root.append(el);setTimeout(()=>el.remove(),3200)}

const nativeFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  const res=await nativeFetch(...args);
  try{
    const url=String(args[0]?.url||args[0]||'');
    if(url.includes('/api/world')){
      const copy=res.clone();const data=await copy.json();ME.world=Array.isArray(data.objects)?data.objects:[];renderNearest();
    }else if(url.includes('/api/bootstrap')){
      const copy=res.clone();const data=await copy.json();ME.demoMode=Boolean(data.server?.demoMode);
    }
  }catch{}
  return res;
};

function watchPosition(){
  if(!navigator.geolocation)return;
  navigator.geolocation.watchPosition(pos=>{ME.position={lat:pos.coords.latitude,lng:pos.coords.longitude};renderNearest();refreshOpenEventDistance()},()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:10000});
}

function ensureNearest(){
  const view=document.querySelector('.view[data-view="map"]');
  if(!view||document.querySelector('.nearest-objective'))return;
  const box=document.createElement('div');box.className='nearest-objective hidden';
  box.innerHTML='<div class="objective-icon">⌁</div><div><b>Ближайший след</b><small>После Импульса здесь появится цель</small></div><button type="button">Показать</button>';
  view.append(box);
  box.querySelector('button').onclick=()=>{
    const obj=nearestObject();
    if(!obj)return toast('Сначала активируйте Импульс Нави');
    const marker=[...document.querySelectorAll('.leaflet-marker-icon')].find(x=>x.innerHTML.includes(typeIcon[obj.type]||'✦'));
    if(marker){marker.click();return}
    openRoute(obj);
  };
}
function nearestObject(){
  if(!ME.position||!ME.world.length)return null;
  return ME.world.filter(x=>!x.completed).sort((a,b)=>distanceM(ME.position,a)-distanceM(ME.position,b))[0]||null;
}
function renderNearest(){
  ensureNearest();
  const box=document.querySelector('.nearest-objective');if(!box)return;
  const obj=nearestObject();
  box.classList.toggle('hidden',!ME.scanned||!obj);
  if(!obj)return;
  const d=distanceM(ME.position,obj);
  box.querySelector('.objective-icon').textContent=typeIcon[obj.type]||'✦';
  box.querySelector('b').textContent=obj.title||typeName[obj.type]||'Событие';
  box.querySelector('small').textContent=`${typeName[obj.type]||'Событие'} · ${fmt(d)} · около ${walkTime(d)} мин пешком`;
}
function openRoute(obj){
  const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(obj.lat)},${encodeURIComponent(obj.lng)}&travelmode=walking`;
  try{
    if(window.Telegram?.WebApp?.openLink){window.Telegram.WebApp.openLink(url,{try_instant_view:false});return}
  }catch{}
  window.location.href=url;
}

function findOpenObject(){
  const root=document.querySelector('#sheetContent');
  const title=root?.querySelector('.event-hero h2')?.textContent?.trim()||root?.querySelector('h2')?.textContent?.trim();
  if(!title)return null;
  return ME.world.find(x=>x.title===title)||null;
}
function clearDistanceUi(root){
  root.querySelectorAll('.event-distance-box,.safety-note').forEach(el=>el.remove());
}
function decorateOpenEvent(){
  const root=document.querySelector('#sheetContent');if(!root)return;
  const obj=findOpenObject();
  clearDistanceUi(root);
  if(!obj||!ME.position){root.dataset.distanceDecorated='';return}
  const d=distanceM(ME.position,obj),ready=d<=140||ME.demoMode;
  const box=document.createElement('div');box.className=`event-distance-box ${ready?'ready':'far'}`;
  box.innerHTML=`<div><strong>${ready?'Можно начинать встречу':'Подойдите ближе к событию'}</strong><span>${fmt(d)} · около ${walkTime(d)} мин пешком${ME.demoMode?' · деморежим':''}</span></div><button type="button" class="route-btn">Маршрут</button>`;
  const firstButton=root.querySelector('#startEncounter,#startAR');
  if(firstButton)root.insertBefore(box,firstButton);else root.append(box);
  box.querySelector('.route-btn').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openRoute(obj)});
  const start=root.querySelector('#startEncounter');
  if(start){
    start.classList.add('encounter-gate');
    start.disabled=!ready;
    start.textContent=ready?(obj.type==='rift'?'Внести вклад в разлом':'Начать встречу'):`Подойдите ещё на ${Math.max(1,Math.round(d-140))} м`;
  }
  const note=document.createElement('div');note.className='safety-note';note.innerHTML='<b>!</b><span>Смотрите по сторонам. Не заходите на закрытые территории и не играйте во время управления транспортом.</span>';root.append(note);
  root.dataset.distanceDecorated=obj.id;
}
function refreshOpenEventDistance(){
  const root=document.querySelector('#sheetContent');
  if(!root||document.querySelector('#sheet')?.classList.contains('hidden'))return;
  if(findOpenObject())decorateOpenEvent();
}

function observeSheet(){
  const root=document.querySelector('#sheetContent');if(!root)return;
  let scheduled=false;
  new MutationObserver(mutations=>{
    const externalChange=mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1&&!node.classList?.contains('event-distance-box')&&!node.classList?.contains('safety-note')));
    if(!externalChange||scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;decorateOpenEvent()});
  }).observe(root,{childList:true});
}
function trackPulse(){
  const pulse=document.querySelector('#navPulse');if(!pulse)return;
  pulse.addEventListener('click',()=>{ME.scanned=true;renderNearest();setTimeout(()=>{ME.scanned=false;renderNearest()},65000)});
}

window.addEventListener('load',()=>{ensureNearest();watchPosition();observeSheet();trackPulse()});