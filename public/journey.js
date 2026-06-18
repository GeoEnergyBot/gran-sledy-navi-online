const J={player:null,world:[],scanned:false};
const $j=s=>document.querySelector(s);

function escJ(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function completedEncounters(){return Number(J.player?.stats?.encounters||0)}
function journeyStage(){
  if(completedEncounters()>0)return 3;
  if(J.scanned&&J.world.length)return 2;
  if(J.scanned)return 1;
  return 0;
}
function ensureJourney(){
  const view=$j('.view[data-view="map"]');if(!view||$j('.journey-card'))return;
  const card=document.createElement('section');card.className='journey-card';card.innerHTML='<div class="journey-head"><span>Первое дело</span><button type="button" aria-label="Скрыть">×</button></div><h3></h3><p></p><div class="journey-progress"></div><button class="journey-action" type="button"></button>';
  view.append(card);
  card.querySelector('.journey-head button').onclick=()=>{card.classList.add('hidden');localStorage.setItem('gran_first_journey_hidden','1')};
  card.querySelector('.journey-action').onclick=()=>performJourneyAction();
  renderJourney();
}
function renderJourney(){
  ensureJourney();const card=$j('.journey-card');if(!card||localStorage.getItem('gran_first_journey_hidden')==='1')return;
  const stage=journeyStage();
  if(stage===3){card.classList.add('hidden');localStorage.setItem('gran_first_journey_done','1');return}
  const content=[
    ['Первый шёпот','Активируйте Импульс Нави и проявите скрытые следы вокруг себя.','Активировать Импульс'],
    ['Грань раскрывается','Подождите, пока сканер покажет ближайшие события общего мира.','Обновить карту'],
    ['Выберите ближайший след','Нажмите ближайший объект на карте, подойдите к нему и завершите первую встречу.','Показать ближайший след']
  ][stage];
  card.classList.remove('hidden');card.querySelector('h3').textContent=content[0];card.querySelector('p').textContent=content[1];card.querySelector('.journey-action').textContent=content[2];
  card.querySelector('.journey-progress').innerHTML=[['ᚾ','Импульс',stage>0],['⌁','Найти',stage>1],['◉','Встреча',false]].map(([icon,label,done])=>`<div class="journey-step ${done?'done':''}"><b>${done?'✓':icon}</b>${label}</div>`).join('');
}
function performJourneyAction(){
  const stage=journeyStage();
  if(stage===0){$j('#navPulse')?.click();return}
  if(stage===1){$j('#locateBtn')?.click();setTimeout(renderJourney,700);return}
  const nearest=$j('.nearest-objective button');if(nearest)nearest.click();else $j('#navPulse')?.click();
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  const res=await originalFetch(...args);
  try{
    const url=String(args[0]?.url||args[0]||'');const copy=res.clone();
    if(url.includes('/api/bootstrap')){const d=await copy.json();J.player=d.player;setTimeout(renderJourney,0)}
    else if(url.includes('/api/world')){const d=await copy.json();J.world=d.objects||[];setTimeout(renderJourney,0)}
    else if(url.includes('/api/encounters/resolve')){const d=await copy.json();if(d.player)J.player=d.player;setTimeout(()=>{renderJourney();enhanceReward()},80)}
  }catch{}
  return res;
};

function enhanceReward(){
  const root=$j('#sheetContent');if(!root||root.dataset.rewardEnhanced==='1')return;
  const title=root.querySelector('h2');if(!title||!root.textContent.includes('Грань откликнулась'))return;
  const lines=[...root.querySelectorAll('.card p')].map(p=>p.textContent.trim()).filter(Boolean);
  const get=(prefix)=>lines.find(x=>x.startsWith(prefix))?.split(':').slice(1).join(':').trim()||'';
  const xp=get('Опыт'),essence=get('Эссенция'),signs=get('Знаки Грани'),rift=get('Вклад в разлом');
  const artifacts=lines.filter(x=>x.includes('артефакт'));
  const items=lines.filter(x=>!x.startsWith('Опыт')&&!x.startsWith('Эссенция')&&!x.startsWith('Знаки Грани')&&!x.startsWith('Вклад в разлом')&&!x.includes('артефакт'));
  root.dataset.rewardEnhanced='1';
  root.innerHTML=`<div class="reward-hero"><div class="reward-seal">ᚾ</div><div class="reward-title">Грань откликнулась</div><div class="reward-subtitle">Ваша первая история в этом месте стала частью общего мира.</div></div>
  <div class="reward-grid">${xp?`<div class="reward-tile"><span>Опыт</span><b>${escJ(xp)}</b></div>`:''}${essence?`<div class="reward-tile"><span>Эссенция</span><b>${escJ(essence)}</b></div>`:''}${signs?`<div class="reward-tile"><span>Знаки Грани</span><b>${escJ(signs)}</b></div>`:''}${rift?`<div class="reward-tile"><span>Вклад в разлом</span><b>${escJ(rift)}</b></div>`:''}</div>
  ${items.map(x=>`<div class="reward-item"><i>✦</i><div>${escJ(x)}<small>Материал добавлен в инвентарь</small></div></div>`).join('')}
  ${artifacts.map(x=>`<div class="reward-item"><i>◇</i><div>${escJ(x)}<small>Уникальный предмет сохранён в коллекции</small></div></div>`).join('')}
  <div class="reward-next">Следующий шаг: откройте Журнал, чтобы посмотреть новые сведения, или отправляйтесь в Убежище и создайте первый амулет.</div>
  <button class="primary" style="width:100%;margin-top:12px" id="rewardContinue">Продолжить путь</button>`;
  $j('#rewardContinue').onclick=()=>$j('#sheetClose')?.click();
}

function watchRewardSheet(){
  const root=$j('#sheetContent');if(!root)return;
  new MutationObserver(()=>setTimeout(enhanceReward,0)).observe(root,{childList:true,subtree:true});
}
function trackPulse(){const pulse=$j('#navPulse');if(!pulse)return;pulse.addEventListener('click',()=>{J.scanned=true;renderJourney();setTimeout(()=>{J.scanned=false;renderJourney()},65000)})}
window.addEventListener('load',()=>{ensureJourney();watchRewardSheet();trackPulse();setTimeout(renderJourney,1200)});
