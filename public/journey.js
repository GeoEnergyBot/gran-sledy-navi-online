(()=>{
  const core=window.GranCore;if(!core)return;
  const J={player:core.state.player,world:core.state.world||[],scanned:false,selectedEventId:core.state.selectedEventId};
  const $=s=>document.querySelector(s);
  function esc(s=''){return String(s).replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function completedEncounters(){return Number(J.player?.stats?.encounters||0)}
  function journeyStage(){
    if(completedEncounters()>0)return 5;
    if(!core.state.hasPosition)return 0;
    if(!J.scanned)return 1;
    if(!J.world.length)return 2;
    if(!J.selectedEventId)return 3;
    return 4;
  }
  function ensureJourney(){
    const view=$('.view[data-view="map"]');if(!view||$('.journey-card'))return;
    const card=document.createElement('section');card.className='journey-card';card.setAttribute('aria-live','polite');
    card.innerHTML='<div class="journey-head"><span>Первая экспедиция</span><button type="button" aria-label="Скрыть подсказку">×</button></div><h3></h3><p></p><div class="journey-progress"></div><button class="journey-action" type="button"></button>';
    view.append(card);
    card.querySelector('.journey-head button').onclick=()=>{card.classList.add('hidden');localStorage.setItem('gran_first_journey_hidden','1')};
    card.querySelector('.journey-action').onclick=performJourneyAction;
  }
  function renderJourney(){
    ensureJourney();const card=$('.journey-card');if(!card)return;
    if(localStorage.getItem('gran_first_journey_hidden')==='1'||journeyStage()===5){card.classList.add('hidden');if(journeyStage()===5)localStorage.setItem('gran_first_journey_done','1');return}
    const stage=journeyStage();
    const content=[
      ['Начните с карты','Разрешите геолокацию, чтобы увидеть места и события рядом с вами.','Включить GPS'],
      ['Проявите следы','Нажмите «Импульс Нави». Он покажет ближайшие события общего мира.','Активировать Импульс'],
      ['Ищем знаки Нави','События ещё загружаются. Обновите своё положение, если карта долго не меняется.','Обновить карту'],
      ['Выберите ближайшее событие','Нажмите знак на карте или покажите ближайшую цель. Передвигайтесь только по безопасному маршруту.','Показать ближайшее'],
      ['Завершите первую встречу','Откройте выбранное событие, подойдите на указанное расстояние и пройдите испытание.','Открыть событие']
    ][stage];
    card.classList.remove('hidden');card.querySelector('h3').textContent=content[0];card.querySelector('p').textContent=content[1];card.querySelector('.journey-action').textContent=content[2];
    card.querySelector('.journey-progress').innerHTML=[['⌖','GPS',stage>0],['ᚾ','Импульс',stage>1],['⌁','Найти',stage>3],['◉','Встреча',false]].map(([icon,label,done])=>`<div class="journey-step ${done?'done':''}"><b>${done?'✓':icon}</b>${label}</div>`).join('');
  }
  function nearestObject(){return J.world.filter(x=>!x.completed).sort((a,b)=>distance(core.state.position,a)-distance(core.state.position,b))[0]||null}
  function distance(a,b){if(!a||!b)return Infinity;const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2))}
  function performJourneyAction(){
    const stage=journeyStage();
    if(stage===0){$('#locateBtn')?.click();return}
    if(stage===2){core.emit('journey:refresh-world');return}
    if(stage===1){$('#navPulse')?.click();return}
    const obj=J.world.find(x=>x.id===J.selectedEventId)||nearestObject();
    if(!obj){$('#navPulse')?.click();return}
    core.selectEvent(obj.id);core.emit('route:request',obj);core.emit('journey:open-event',obj);
  }
  function enhanceReward(){
    const root=$('#sheetContent');if(!root||root.dataset.rewardEnhanced==='1'||!root.textContent.includes('Грань откликнулась'))return;
    const lines=[...root.querySelectorAll('.card p')].map(p=>p.textContent.trim()).filter(Boolean);
    const get=prefix=>lines.find(x=>x.startsWith(prefix))?.split(':').slice(1).join(':').trim()||'';
    const xp=get('Опыт'),essence=get('Эссенция'),signs=get('Знаки Грани'),rift=get('Вклад в разлом');
    const artifacts=lines.filter(x=>x.includes('артефакт'));
    const items=lines.filter(x=>!x.startsWith('Опыт')&&!x.startsWith('Эссенция')&&!x.startsWith('Знаки Грани')&&!x.startsWith('Вклад в разлом')&&!x.includes('артефакт'));
    root.dataset.rewardEnhanced='1';
    root.innerHTML=`<div class="reward-hero"><div class="reward-seal">ᚾ</div><div class="reward-title">Грань откликнулась</div><div class="reward-subtitle">Ваша история стала частью общего мира.</div></div><div class="reward-grid">${xp?`<div class="reward-tile"><span>Опыт</span><b>${esc(xp)}</b></div>`:''}${essence?`<div class="reward-tile"><span>Эссенция</span><b>${esc(essence)}</b></div>`:''}${signs?`<div class="reward-tile"><span>Знаки Грани</span><b>${esc(signs)}</b></div>`:''}${rift?`<div class="reward-tile"><span>Вклад в разлом</span><b>${esc(rift)}</b></div>`:''}</div>${items.map(x=>`<div class="reward-item"><i>✦</i><div>${esc(x)}<small>Добавлено в инвентарь</small></div></div>`).join('')}${artifacts.map(x=>`<div class="reward-item"><i>◇</i><div>${esc(x)}<small>Сохранено в коллекции</small></div></div>`).join('')}<div class="reward-next">Откройте Журнал или отправляйтесь в Убежище.</div><button class="primary" style="width:100%;margin-top:12px" id="rewardContinue">Продолжить путь</button>`;
    $('#rewardContinue').onclick=()=>$('#sheetClose')?.click();
  }
  core.on('player:updated',player=>{J.player=player;renderJourney()});
  core.on('world:loaded',data=>{J.world=data.objects||[];renderJourney()});
  core.on('position:updated',()=>renderJourney());
  core.on('event:selected',id=>{J.selectedEventId=id;renderJourney()});
  core.on('api:response',({path,data,ok})=>{if(path==='/api/encounters/resolve'&&ok){if(data.player)J.player=data.player;setTimeout(()=>{renderJourney();enhanceReward()},80)}});
  window.addEventListener('load',()=>{ensureJourney();$('#navPulse')?.addEventListener('click',()=>{J.scanned=true;renderJourney();setTimeout(()=>{J.scanned=false;renderJourney()},65000)});setTimeout(renderJourney,400)});
})();
