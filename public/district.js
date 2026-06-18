const D={district:null,position:{lat:43.238949,lng:76.889709}};
const $d=s=>document.querySelector(s);

function escD(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function pct(value,target){return Math.max(0,Math.min(100,target?value/target*100:0))}
function timeLeft(endsAt){
  const ms=Math.max(0,Number(endsAt||0)-Date.now()),days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000);
  if(days>0)return `${days} д. ${hours} ч.`;if(hours>0)return `${hours} ч.`;return 'завершается';
}
function ago(at){
  const min=Math.max(0,Math.round((Date.now()-Number(at||0))/60000));
  if(min<1)return 'только что';if(min<60)return `${min} мин. назад`;const h=Math.round(min/60);if(h<24)return `${h} ч. назад`;return `${Math.round(h/24)} дн. назад`;
}
function stabilityTone(v){return v>=70?'good':v>=40?'warn':'danger'}

function ensureOrb(){
  const view=$d('.view[data-view="map"]');if(!view||$d('.district-orb'))return;
  const old=$d('#worldCard');if(old)old.style.display='none';
  const orb=document.createElement('aside');orb.className='district-orb';orb.innerHTML='<button type="button" aria-label="Открыть сведения о районе"><span class="district-kicker"><i></i> Живой район</span><h3>Определяем территорию…</h3><div class="district-summary"><strong>Стабильность —</strong><span>Угроза загружается</span></div><div class="district-mini-progress"><span style="width:0%"></span></div></button>';
  view.append(orb);orb.querySelector('button').onclick=openDistrict;
}
function renderOrb(){
  ensureOrb();const orb=$d('.district-orb'),d=D.district;if(!orb||!d)return;
  orb.querySelector('h3').textContent=d.name;
  orb.querySelector('.district-summary').innerHTML=`<strong>Стабильность ${d.stability}%</strong><span>· ${escD(d.threat.title)}</span>`;
  orb.querySelector('.district-mini-progress span').style.width=`${pct(d.threat.progress,d.threat.target)}%`;
  orb.classList.toggle('district-danger',d.stability<40);
}
function openDistrict(){
  const d=D.district;if(!d)return;
  const history=(d.history||[]).map(x=>`<article><i></i><div><p>${escD(x.text)}</p><time>${ago(x.at)}</time></div></article>`).join('')||'<div class="empty">История района ещё не началась.</div>';
  const html=`<div class="district-sheet">
    <div class="district-hero"><span class="eyebrow">Территория общего мира</span><h2>${escD(d.name)}</h2><p>Каждая встреча меняет состояние этого места. Проводники вместе определяют, станет район безопаснее или глубже уйдёт в Навь.</p></div>
    <div class="district-metrics">
      <div class="district-metric ${stabilityTone(d.stability)}"><span>Стабильность</span><b>${d.stability}%</b></div>
      <div class="district-metric ${stabilityTone(100-d.naviInfluence)}"><span>Влияние Нави</span><b>${d.naviInfluence}%</b></div>
      <div class="district-metric ${d.fear>55?'danger':d.fear>25?'warn':'good'}"><span>Страх</span><b>${d.fear}%</b></div>
    </div>
    <div class="threat-card">
      <div class="threat-head"><div class="threat-icon">${escD(d.threat.icon||'⌁')}</div><div><h3>${escD(d.threat.title)}</h3><p>${escD(d.threat.description)}</p></div><span class="threat-time">${timeLeft(d.threat.endsAt)}</span></div>
      <div class="threat-progress"><span style="width:${pct(d.threat.progress,d.threat.target)}%"></span></div>
      <div class="threat-footer"><span>${d.threat.progress} / ${d.threat.target} общего вклада</span><span>${d.threat.participants||0} участников</span></div>
    </div>
    <div class="section-title"><h2>Бонусы территории</h2><span class="muted">действуют рядом</span></div>
    <div class="district-bonuses"><div class="district-bonus"><i>☘</i><div><b>Травы +${d.bonuses?.herbs||0}%</b><span>Больше природных материалов</span></div></div><div class="district-bonus"><i>◇</i><div><b>Артефакты +${d.bonuses?.artifacts||0}%</b><span>Шанс редких находок</span></div></div></div>
    <div class="section-title"><h2>Последние события</h2><span class="muted">пишут игроки</span></div><div class="district-history">${history}</div>
  </div>`;
  const sheet=$d('#sheetContent'),panel=$d('#sheet'),backdrop=$d('#sheetBackdrop');
  if(!sheet||!panel||!backdrop)return;sheet.innerHTML=html;panel.classList.remove('hidden');backdrop.classList.remove('hidden');
}
function contributionEffect(amount,resolved){
  const flash=document.createElement('div');flash.className='district-flash';document.body.append(flash);setTimeout(()=>flash.remove(),850);
  const note=document.createElement('div');note.className='district-contribution';note.innerHTML=`Вклад в район<b>+${amount}</b>${resolved?'<span>Угроза устранена!</span>':''}`;document.body.append(note);setTimeout(()=>note.remove(),1850);
  try{navigator.vibrate?.([30,35,70])}catch{}
}

const districtFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  const res=await districtFetch(...args);
  try{
    const url=String(args[0]?.url||args[0]||''),copy=res.clone();
    if(url.includes('/api/world')){const data=await copy.json();if(data.district){D.district=data.district;renderOrb()}}
    else if(url.includes('/api/district')){const data=await copy.json();if(data.district){D.district=data.district;renderOrb()}}
    else if(url.includes('/api/encounters/resolve')){const data=await copy.json();if(data.district){D.district=data.district;renderOrb();setTimeout(()=>contributionEffect(data.districtContribution||0,Boolean(data.district?.threat?.resolved)),220)}}
  }catch{}
  return res;
};

function refreshDistrict(){
  const headers={'content-type':'application/json'};
  const playerId=localStorage.getItem('gran_player_id');if(playerId)headers['x-player-id']=playerId;
  fetch(`/api/district?lat=${D.position.lat}&lng=${D.position.lng}`,{headers}).catch(()=>{});
}
function watchPosition(){
  if(!navigator.geolocation){refreshDistrict();return}
  navigator.geolocation.getCurrentPosition(pos=>{D.position={lat:pos.coords.latitude,lng:pos.coords.longitude};refreshDistrict()},()=>refreshDistrict(),{enableHighAccuracy:true,timeout:6500,maximumAge:5000});
  navigator.geolocation.watchPosition(pos=>{D.position={lat:pos.coords.latitude,lng:pos.coords.longitude}},()=>{}, {enableHighAccuracy:true,timeout:10000,maximumAge:5000});
}
function setupDistrictStream(){
  try{const es=new EventSource('/api/stream');es.addEventListener('district:update',event=>{const payload=JSON.parse(event.data||'{}');if(payload.district?.id===D.district?.id){D.district=payload.district;renderOrb()}})}catch{}
}
window.addEventListener('load',()=>{ensureOrb();watchPosition();setupDistrictStream();setInterval(refreshDistrict,60000)});
