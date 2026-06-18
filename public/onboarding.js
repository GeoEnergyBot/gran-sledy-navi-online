const ONBOARDING_KEY='gran_onboarding_v1';
const $o=s=>document.querySelector(s);

const slides=[
  {
    icon:'ᚾ',
    title:'Вы видите то, что скрыто',
    text:'Вы — Проводник. Телефон помогает замечать следы Нави, существ, артефакты и разломы, существующие в общем мире для всех игроков.',
    points:[['⌖','Карта показывает реальные места вокруг вас'],['◉','Существа и события одинаковы для игроков рядом'],['⬡','Большие разломы закрываются совместным вкладом']]
  },
  {
    icon:'⌁',
    title:'Сначала найдите след',
    text:'Нажмите «Импульс Нави». На короткое время карта проявит скрытые объекты. Выберите ближайший знак и подойдите к нему.',
    points:[['⌁','След — начало небольшого расследования'],['✦','Источник — материалы для ремесла'],['◇','Артефакт — редкая находка с собственной историей']]
  },
  {
    icon:'◉',
    title:'Каждая встреча — выбор',
    text:'После испытания решите, как завершить встречу. Это влияет на знания, отношения с существами и добычу.',
    points:[['☘','Успокоить — развивать доверие'],['☷','Исследовать — открывать сведения в Журнале'],['✕','Изгнать — получить больше материалов']]
  },
  {
    icon:'⌂',
    title:'Развивайте своего Проводника',
    text:'Материалы превращаются в амулеты. Найденные предметы можно использовать, улучшать или продавать другим игрокам на общем рынке.',
    points:[['⚒','Создавайте предметы в Убежище'],['☷','Заполняйте Журнал существ'],['◇','Торгуйте на Рынке Грани']]
  }
];

function addLegend(){
  const mapView=document.querySelector('.view[data-view="map"]');
  if(!mapView||document.querySelector('.map-legend'))return;
  const legend=document.createElement('div');
  legend.className='map-legend';
  legend.setAttribute('aria-label','Легенда карты');
  legend.innerHTML=[['trace','⌁','След'],['creature','◉','Существо'],['resource','✦','Источник'],['artifact','◇','Артефакт'],['rift','⬡','Разлом']]
    .map(([type,icon,label])=>`<button class="legend-item" data-type="${type}" type="button"><b>${icon}</b>${label}</button>`).join('');
  mapView.append(legend);
  legend.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const names={trace:'Следы ведут к существам и историям.',creature:'Существа можно успокоить, исследовать или изгнать.',resource:'Источники дают материалы для ремесла.',artifact:'Артефакты редки и могут иметь уникальные свойства.',rift:'Разлом — общее событие для нескольких игроков.'};
    notify(names[btn.dataset.type]);
  }));
}

function notify(message){
  const root=document.querySelector('#toasts');
  if(!root)return;
  const el=document.createElement('div');
  el.className='toast';
  el.textContent=message;
  root.append(el);
  setTimeout(()=>el.remove(),3200);
}

function closeLegacyTutorial(){
  const content=document.querySelector('#sheetContent');
  if(content?.textContent?.includes('Добро пожаловать в общий мир'))document.querySelector('#sheetClose')?.click();
}

function showOnboarding(){
  if(localStorage.getItem(ONBOARDING_KEY)==='done')return;
  let index=0;
  const overlay=document.createElement('section');
  overlay.className='onboarding';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Обучение Проводника');
  document.body.append(overlay);

  function finish(){
    localStorage.setItem(ONBOARDING_KEY,'done');
    overlay.remove();
    coachPulse();
  }
  function render(){
    const slide=slides[index];
    overlay.innerHTML=`<div class="onboarding-card">
      <div class="onboarding-progress">${slides.map((_,i)=>`<span class="${i<=index?'active':''}"></span>`).join('')}</div>
      <div class="onboarding-icon">${slide.icon}</div>
      <span class="eyebrow">Шаг ${index+1} из ${slides.length}</span>
      <h2>${slide.title}</h2>
      <p>${slide.text}</p>
      <div class="onboarding-points">${slide.points.map(([icon,text])=>`<div class="onboarding-point"><b>${icon}</b><span>${text}</span></div>`).join('')}</div>
      <div class="onboarding-actions"><button class="onboarding-skip" type="button">Пропустить</button><button class="onboarding-next" type="button">${index===slides.length-1?'Войти в Грань':'Далее'}</button></div>
    </div>`;
    overlay.querySelector('.onboarding-skip').onclick=finish;
    overlay.querySelector('.onboarding-next').onclick=()=>{if(index<slides.length-1){index++;render()}else finish()};
  }
  render();
}

function coachPulse(){
  const target=document.querySelector('#navPulse');
  if(!target||localStorage.getItem('gran_pulse_coached')==='done')return;
  const rect=target.getBoundingClientRect();
  const mark=document.createElement('div');
  mark.className='coachmark';
  Object.assign(mark.style,{left:`${rect.left-7}px`,top:`${rect.top-7}px`,width:`${rect.width+14}px`,height:`${rect.height+14}px`});
  const label=document.createElement('div');
  label.className='coach-label';
  label.textContent='Начните отсюда: нажмите «Импульс Нави», чтобы проявить скрытые следы.';
  const top=Math.max(90,rect.top-70);
  Object.assign(label.style,{left:`${Math.max(12,Math.min(window.innerWidth-272,rect.left+rect.width/2-130))}px`,top:`${top}px`});
  document.body.append(mark,label);
  const clear=()=>{mark.remove();label.remove();localStorage.setItem('gran_pulse_coached','done');target.removeEventListener('click',clear)};
  target.addEventListener('click',clear,{once:true});
  setTimeout(clear,12000);
}

async function setupGeoStatus(){
  const view=document.querySelector('.view[data-view="map"]');
  if(!view||document.querySelector('.geo-status'))return;
  const box=document.createElement('div');
  box.className='geo-status hidden';
  box.innerHTML='<div><strong>Геолокация выключена</strong><span>Сейчас показан демонстрационный район. Разрешите GPS для игры рядом с вами.</span></div><button type="button">Включить GPS</button>';
  view.append(box);
  box.querySelector('button').onclick=()=>document.querySelector('#locateBtn')?.click();
  if(!navigator.geolocation){box.classList.remove('hidden');return}
  try{
    if(navigator.permissions){
      const permission=await navigator.permissions.query({name:'geolocation'});
      const sync=()=>box.classList.toggle('hidden',permission.state==='granted');
      sync();permission.onchange=sync;
    }
  }catch{}
}

function firstSessionHint(){
  const pulse=document.querySelector('#navPulse');
  const view=document.querySelector('.view[data-view="map"]');
  if(!pulse||!view)return;
  pulse.addEventListener('click',()=>{
    if(document.querySelector('.first-session-hint'))return;
    const hint=document.createElement('div');
    hint.className='first-session-hint';
    hint.innerHTML='<strong>Следы проявлены.</strong> Нажмите ближайший знак на карте, чтобы узнать расстояние и начать встречу.';
    view.append(hint);
    setTimeout(()=>hint.remove(),6500);
  });
}

window.addEventListener('load',()=>{
  addLegend();
  setupGeoStatus();
  firstSessionHint();
  setTimeout(()=>{closeLegacyTutorial();showOnboarding()},900);
});
