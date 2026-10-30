function addLegend(){
  const mapView=document.querySelector('.view[data-view="map"]');
  if(!mapView||document.querySelector('.map-legend'))return;
  const legend=document.createElement('div');
  legend.className='map-legend';legend.setAttribute('aria-label','Легенда карты');
  legend.innerHTML=[['trace','⌁','След'],['creature','◉','Существо'],['resource','✦','Источник'],['artifact','◇','Артефакт'],['rift','⬡','Разлом']]
    .map(([type,icon,label])=>`<button class="legend-item" data-type="${type}" type="button"><b>${icon}</b>${label}</button>`).join('');
  mapView.append(legend);
  legend.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const names={trace:'Следы ведут к существам и историям.',creature:'Существа можно успокоить, исследовать или изгнать.',resource:'Источники дают материалы для ремесла.',artifact:'Артефакты редки и могут иметь уникальные свойства.',rift:'Разлом — общее событие для нескольких игроков.'};
    notify(names[btn.dataset.type]);
  }));
}

function notify(message){
  const root=document.querySelector('#toasts');if(!root)return;
  const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;root.append(el);setTimeout(()=>el.remove(),3200);
}

async function setupGeoStatus(){
  const view=document.querySelector('.view[data-view="map"]');if(!view||document.querySelector('.geo-status'))return;
  const box=document.createElement('div');box.className='geo-status hidden';
  box.innerHTML='<div><strong>Виртуальный район активен</strong><span>Полевые события доступны с GPS; исследовать игровой мир можно и без него.</span></div><button type="button">Включить GPS</button>';
  view.append(box);box.querySelector('button').onclick=()=>document.querySelector('#locateBtn')?.click();
  if(!navigator.geolocation){box.classList.remove('hidden');return}
  try{if(navigator.permissions){const permission=await navigator.permissions.query({name:'geolocation'});const sync=()=>box.classList.toggle('hidden',permission.state==='granted');sync();permission.onchange=sync}}catch{}
}

window.addEventListener('load',()=>{addLegend();setupGeoStatus()});
