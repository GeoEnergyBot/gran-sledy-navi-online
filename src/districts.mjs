import crypto from 'node:crypto';

const CELL=0.018;
const WEEK=7*24*60*60*1000;
const threats=[
  {id:'vanishing_paths',title:'Исчезающие тропы',description:'В районе появляются дороги, которых не было вчера. Они уводят людей в Навь.',icon:'⌁',accent:'forest'},
  {id:'whispers_in_wells',title:'Шёпот из колодцев',description:'Старые водные источники зовут прохожих чужими голосами.',icon:'◌',accent:'water'},
  {id:'restless_homes',title:'Домовые покидают дома',description:'Хранители жилищ встревожены и оставляют привычные места.',icon:'⌂',accent:'ember'},
  {id:'moon_rusalka',title:'Лунный зов русалок',description:'После заката водные духи выходят к людям и меняют тропы у воды.',icon:'☾',accent:'moon'}
];
const nameA=['Старый','Тихий','Северный','Лунный','Зелёный','Каменный','Пепельный','Речной'];
const nameB=['парк','квартал','берег','двор','перекрёсток','сад','предел','тракт'];

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=input=>crypto.createHash('sha256').update(String(input)).digest('hex');
const seeded=(key,offset=0)=>parseInt(hash(key).slice(offset,offset+8),16)/0xffffffff;
const weekKey=()=>Math.floor(Date.now()/WEEK);
const districtId=(lat,lng)=>`district_${Math.floor(lat/CELL)}_${Math.floor(lng/CELL)}`;

function createDistrict(lat,lng){
  const id=districtId(lat,lng),w=weekKey(),key=`${id}|${w}`;
  const threat=threats[Math.floor(seeded(key,0)*threats.length)%threats.length];
  const stability=Math.round(48+seeded(key,8)*28);
  const target=1200+Math.round(seeded(key,16)*900);
  const centerLat=(Math.floor(lat/CELL)+0.5)*CELL;
  const centerLng=(Math.floor(lng/CELL)+0.5)*CELL;
  return {
    id,
    name:`${nameA[Math.floor(seeded(id,0)*nameA.length)%nameA.length]} ${nameB[Math.floor(seeded(id,8)*nameB.length)%nameB.length]}`,
    center:{lat:centerLat,lng:centerLng},
    stability,
    knowledge:0,
    fear:0,
    naviInfluence:Math.round(100-stability),
    threat:{...threat,progress:0,target,participants:{},resolved:false,startedAt:w*WEEK,endsAt:(w+1)*WEEK},
    guardianCircleId:null,
    bonuses:{herbs:Math.round(seeded(id,16)*12),artifacts:Math.round(seeded(id,24)*8)},
    history:[{at:Date.now(),type:'awakening',text:`Угроза «${threat.title}» проявилась в районе.`}],
    updatedAt:Date.now()
  };
}

function rollWeek(district){
  const current=weekKey();
  const currentDistrictWeek=Math.floor((district.threat?.startedAt||0)/WEEK);
  if(currentDistrictWeek===current)return district;
  const seed=`${district.id}|${current}`;
  const threat=threats[Math.floor(seeded(seed,0)*threats.length)%threats.length];
  district.threat={...threat,progress:0,target:1200+Math.round(seeded(seed,8)*900),participants:{},resolved:false,startedAt:current*WEEK,endsAt:(current+1)*WEEK};
  district.history=[{at:Date.now(),type:'new_threat',text:`Новая угроза недели: «${threat.title}».`},...(district.history||[])].slice(0,12);
  district.updatedAt=Date.now();
  return district;
}

export function getDistrict(state,lat,lng){
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('Некорректные координаты района');
  state.districts ||= {};
  const id=districtId(lat,lng);
  const district=state.districts[id] ||= createDistrict(lat,lng);
  return rollWeek(district);
}

export function publicDistrict(district){
  return {
    id:district.id,name:district.name,center:district.center,
    stability:district.stability,knowledge:district.knowledge,fear:district.fear,naviInfluence:district.naviInfluence,
    guardianCircleId:district.guardianCircleId,bonuses:district.bonuses,
    threat:{...district.threat,participants:Object.keys(district.threat.participants||{}).length,playerContribution:undefined},
    history:(district.history||[]).slice(0,8),updatedAt:district.updatedAt
  };
}

export function contributeToDistrict(state,player,{lat,lng,choice='study',eventType='trace',amount=1}){
  const district=getDistrict(state,lat,lng);
  const base=eventType==='rift'?Math.max(45,Math.round(amount||0)):eventType==='artifact'?28:eventType==='creature'?20:eventType==='resource'?12:15;
  let threat=base,stability=0,knowledge=0,fear=0;
  if(choice==='calm'){stability=Math.ceil(base*.28);threat=Math.ceil(base*.55)}
  else if(choice==='study'){knowledge=Math.ceil(base*.42);threat=Math.ceil(base*.7)}
  else if(choice==='banish'){fear=Math.ceil(base*.24);threat=Math.ceil(base*1.15)}
  district.stability=clamp(district.stability+stability-Math.ceil(fear*.25),0,100);
  district.knowledge=clamp(district.knowledge+knowledge,0,10000);
  district.fear=clamp(district.fear+fear-Math.ceil(stability*.2),0,100);
  district.naviInfluence=clamp(100-district.stability+Math.ceil(district.fear*.2),0,100);
  district.threat.progress=clamp(district.threat.progress+threat,0,district.threat.target);
  district.threat.participants[player.id]=(district.threat.participants[player.id]||0)+threat;
  const wasResolved=district.threat.resolved;
  district.threat.resolved=district.threat.progress>=district.threat.target;
  district.updatedAt=Date.now();
  const verb=choice==='calm'?'успокоил сущность':choice==='banish'?'изгнал угрозу':'раскрыл тайну';
  district.history.unshift({at:Date.now(),type:'contribution',playerId:player.id,text:`${player.name} ${verb} и внёс ${threat} ед. в защиту района.`});
  if(district.threat.resolved&&!wasResolved){
    district.stability=clamp(district.stability+8,0,100);
    district.history.unshift({at:Date.now(),type:'victory',text:`Угроза «${district.threat.title}» устранена общими усилиями.`});
  }
  district.history=district.history.slice(0,12);
  return {district:publicDistrict(district),contribution:threat,resolvedNow:district.threat.resolved&&!wasResolved};
}
