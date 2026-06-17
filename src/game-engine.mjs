import crypto from 'node:crypto';
import { creatures, items, recipes, professions, rarities, getCreature, getItem, getRecipe } from './catalog.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const GRID = 0.0027;
const commission = Math.max(0, Math.min(25, Number(process.env.MARKET_COMMISSION_PERCENT || 7))) / 100;
const worldSeed = process.env.WORLD_SEED || 'gran-dev-world';
const demoMode = String(process.env.DEMO_MODE || '1') === '1';

const hashHex = input => crypto.createHash('sha256').update(`${worldSeed}|${input}`).digest('hex');
const rand = (input, offset=0) => parseInt(hashHex(input).slice(offset, offset+8), 16) / 0xffffffff;
const choose = (arr, key, offset=0) => arr[Math.floor(rand(key, offset) * arr.length) % arr.length];
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowIso = ()=>new Date().toISOString();
const uid = prefix => `${prefix}_${crypto.randomUUID()}`;

function haversine(lat1, lon1, lat2, lon2){
  const R=6371000, p1=lat1*Math.PI/180, p2=lat2*Math.PI/180;
  const dp=(lat2-lat1)*Math.PI/180, dl=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function levelFromXp(xp){ return Math.max(1, Math.floor(Math.sqrt(Math.max(0,xp)/80))+1); }
function todayKey(){ return new Date().toISOString().slice(0,10); }

function questSet(){
  return [
    {id:'daily_explore', title:'Голоса района', description:'Исследуйте 3 следа или существа', target:3, event:'encounter', reward:{signs:12, xp:60}},
    {id:'daily_craft', title:'Руки мастера', description:'Создайте 1 магический предмет', target:1, event:'craft', reward:{signs:8, xp:40}},
    {id:'daily_rift', title:'Общее дело', description:'Внесите 100 единиц вклада в разлом', target:100, event:'rift', reward:{signs:18, xp:80}}
  ];
}

export function ensurePlayer(state, identity){
  let p = state.players[identity.id];
  if (!p) {
    p = state.players[identity.id] = {
      id:identity.id, name:identity.name, username:identity.username || '', verified:identity.verified,
      createdAt:nowIso(), lastSeenAt:nowIso(), level:1, xp:0, essence:40, signs:80, reputation:0,
      inventory:{ash:6, thread:4, salt:4, bark:3, chalk:1}, uniqueArtifacts:[], codex:{},
      equipment:{amulet1:null, amulet2:null, amulet3:null}, professions:{runewriter:1, herbalist:1, warder:1, artifactsmith:1}, professionXp:{runewriter:0, herbalist:0, warder:0, artifactsmith:0},
      shelter:{scanner:1, workshop:1, storage:1, decor:'old_observatory'}, completed:{}, quests:{date:'', entries:{}},
      circleId:null, stats:{encounters:0, crafts:0, trades:0, riftContribution:0, distanceM:0},
      lastPosition:null, cosmetics:{frame:'default', scanner:'copper'}, flags:{tutorial:false}
    };
    state.economy.totalSignsIssued += p.signs;
  }
  p.name = identity.name || p.name;
  p.lastSeenAt = nowIso();
  refreshQuests(p);
  return p;
}

function refreshQuests(p){
  const day=todayKey();
  if (p.quests?.date===day) return;
  p.quests={date:day, entries:Object.fromEntries(questSet().map(q=>[q.id,{...q,progress:0,claimed:false}]))};
}

function progressQuest(p, event, amount=1){
  refreshQuests(p);
  for (const q of Object.values(p.quests.entries)) if(q.event===event && !q.claimed) q.progress=clamp(q.progress+amount,0,q.target);
}

function publicPlayer(p){
  return {
    id:p.id, name:p.name, verified:p.verified, level:p.level, xp:p.xp, essence:p.essence, signs:p.signs, reputation:p.reputation,
    inventory:p.inventory, uniqueArtifacts:p.uniqueArtifacts, codex:p.codex, equipment:p.equipment, professions:p.professions, professionXp:p.professionXp||{},
    shelter:p.shelter, circleId:p.circleId, stats:p.stats, quests:p.quests, cosmetics:p.cosmetics, flags:p.flags,
    xpNext:(p.level**2)*80
  };
}

function eventEpoch(){ return Math.floor(Date.now()/(30*60_000)); }
function cellId(x,y){ return `${x}:${y}`; }

function rarityFor(key){
  const r=rand(key, 8);
  if(r<0.56)return 'common'; if(r<0.79)return 'uncommon'; if(r<0.93)return 'rare'; if(r<0.985)return 'epic'; return 'legendary';
}
function objectTypeFor(key){
  const r=rand(key,16);
  if(r<0.35)return 'trace'; if(r<0.72)return 'creature'; if(r<0.84)return 'resource'; if(r<0.95)return 'artifact'; return 'rift';
}
function biomeFor(key){
  const hour=new Date().getHours();
  if(hour>=21 || hour<6) return rand(key,24)<0.55?'night':choose(['city','park','water'],key,28);
  return choose(['city','city','park','water'],key,28);
}

function compatibleCreatures(biome){
  const list=creatures.filter(c=>c.biome===biome || (biome==='city' && c.biome==='night'));
  return list.length?list:creatures;
}

function makeWorldObject(x,y,slot,epoch){
  const key=`${epoch}|${x}|${y}|${slot}`;
  const type=objectTypeFor(key);
  let rarity=rarityFor(key);
  if(type==='rift' && ['common','uncommon'].includes(rarity)) rarity='rare';
  const biome=biomeFor(key);
  const creature=choose(compatibleCreatures(biome),key,32);
  const lat=(x+0.5)*GRID + (rand(key,40)-0.5)*GRID*0.62;
  const lng=(y+0.5)*GRID + (rand(key,48)-0.5)*GRID*0.62;
  const startsAt=epoch*30*60_000;
  const duration=type==='rift'?90*60_000:60*60_000;
  const id=`world_${hashHex(key).slice(0,20)}`;
  const titles={
    trace:`След: ${creature.name}`,
    creature:creature.name,
    resource:choose(['Колодец памяти','Заросший знак','Тихое место силы','Остывшая печать'],key,56),
    artifact:choose(['Закопанная реликвия','Забытый тайник','Осколок чужой истории','Запечатанный ларец'],key,56),
    rift:`Разлом: ${creature.title}`
  };
  const target=type==='rift' ? Math.round(700 * rarities[rarity].weight) : 1;
  return {id,type,rarity,biome,creatureId:creature.id,title:titles[type],lat,lng,startsAt,expiresAt:startsAt+duration,target};
}

export function worldNearby(state, player, lat, lng, radius=1600){
  radius=clamp(Number(radius)||1200,300,4000);
  const epoch=eventEpoch();
  const cx=Math.floor(lat/GRID), cy=Math.floor(lng/GRID);
  const rings=Math.ceil(radius/(GRID*111000))+1;
  const out=[];
  for(let dx=-rings;dx<=rings;dx++) for(let dy=-rings;dy<=rings;dy++){
    for(let slot=0;slot<2;slot++){
      const obj=makeWorldObject(cx+dx,cy+dy,slot,epoch);
      if(haversine(lat,lng,obj.lat,obj.lng)>radius) continue;
      const shared=state.worldProgress[obj.id] || {value:0,participants:{},closed:false};
      const completed=Boolean(player.completed[obj.id]);
      if(shared.closed && obj.type==='rift') continue;
      out.push({...obj, shared:{value:shared.value,target:obj.target,participants:Object.keys(shared.participants||{}).length,closed:shared.closed}, completed});
    }
  }
  return out.sort((a,b)=>haversine(lat,lng,a.lat,a.lng)-haversine(lat,lng,b.lat,b.lng)).slice(0,48);
}

function findWorldObject(eventId, lat, lng){
  const epoch=eventEpoch();
  const cx=Math.floor(lat/GRID), cy=Math.floor(lng/GRID);
  for(const e of [epoch-1,epoch,epoch+1]) for(let dx=-12;dx<=12;dx++) for(let dy=-12;dy<=12;dy++) for(let slot=0;slot<2;slot++){
    const obj=makeWorldObject(cx+dx,cy+dy,slot,e);
    if(obj.id===eventId) return obj;
  }
  return null;
}

function locationProof(p, lat, lng){
  const now=Date.now();
  const prev=p.lastPosition;
  let suspicious=false, distance=0, speed=0;
  if(prev){
    distance=haversine(prev.lat,prev.lng,lat,lng);
    const seconds=Math.max(1,(now-prev.at)/1000); speed=distance/seconds;
    suspicious = distance>2500 && seconds<180 || speed>45;
    if(!suspicious && speed<12) p.stats.distanceM += distance;
  }
  p.lastPosition={lat,lng,at:now};
  return {suspicious,distance,speed};
}

export function heartbeat(state,p,lat,lng){
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) throw httpError(400,'Некорректные координаты');
  locationProof(p,lat,lng);
  state.presence[p.id]={playerId:p.id,name:p.name,level:p.level,lat,lng,updatedAt:Date.now(),circleId:p.circleId};
  const nearby=Object.values(state.presence).filter(x=>x.playerId!==p.id && Date.now()-x.updatedAt<120000 && haversine(lat,lng,x.lat,x.lng)<1500);
  return {count:nearby.length, players:nearby.slice(0,12).map(x=>({name:x.name,level:x.level,distance:Math.round(haversine(lat,lng,x.lat,x.lng)/50)*50,circleId:x.circleId}))};
}

export function startEncounter(state,p,{eventId,lat,lng}){
  lat=Number(lat);lng=Number(lng);
  const proof=locationProof(p,lat,lng);
  const obj=findWorldObject(eventId,lat,lng);
  if(!obj) throw httpError(404,'Событие исчезло или находится слишком далеко');
  const distance=haversine(lat,lng,obj.lat,obj.lng);
  if(!demoMode && distance>140) throw httpError(403,`Подойдите ближе: ${Math.round(distance)} м`);
  if(proof.suspicious && !demoMode) throw httpError(403,'Не удалось подтвердить перемещение');
  if(p.completed[eventId] && obj.type!=='rift') throw httpError(409,'Вы уже исследовали это событие');
  const challengeId=uid('enc');
  const creature=getCreature(obj.creatureId);
  const type=obj.type==='resource'?'signal':obj.type==='artifact'?'ritual':creature.encounter;
  const difficulty=rarities[obj.rarity].weight;
  const challenge={id:challengeId,playerId:p.id,eventId,obj,createdAt:Date.now(),expiresAt:Date.now()+120000,type,difficulty,nonce:hashHex(challengeId).slice(0,12)};
  state.encounters[challengeId]=challenge;
  return {challengeId,type,difficulty,nonce:challenge.nonce,event:obj,creature};
}

function addItem(p,itemId,qty){ p.inventory[itemId]=(p.inventory[itemId]||0)+qty; }
function removeItem(p,itemId,qty){
  if((p.inventory[itemId]||0)<qty) throw httpError(409,`Недостаточно: ${getItem(itemId)?.name||itemId}`);
  p.inventory[itemId]-=qty; if(p.inventory[itemId]<=0) delete p.inventory[itemId];
}
function awardXp(p,xp){ p.xp+=Math.max(0,Math.round(xp)); p.level=levelFromXp(p.xp); }

function generateArtifact(obj,p){
  const creature=getCreature(obj.creatureId);
  const adjectives=['Забытый','Тихий','Сломанный','Серебряный','Пепельный','Поющий','Безымянный','Лунный'];
  const nouns=['ключ','перстень','компас','колокольчик','медальон','осколок','гребень','обруч'];
  const seed=`${obj.id}|${p.id}|${Date.now()}`;
  return {
    id:uid('artifact'), name:`${choose(adjectives,seed,0)} ${choose(nouns,seed,8)}`, rarity:obj.rarity,
    origin:`Найден возле события «${obj.title}»`, foundAt:nowIso(), firstOwner:p.name, owners:[p.id],
    creatureId:creature.id, power:Math.round(10*rarities[obj.rarity].weight), curse:rand(seed,16)<0.22?'Шёпот после полуночи':null,
    tradable:true, certified:false
  };
}

export function resolveEncounter(state,p,{challengeId,score,choice='study'}){
  const enc=state.encounters[challengeId];
  if(!enc || enc.playerId!==p.id) throw httpError(404,'Испытание не найдено');
  if(Date.now()>enc.expiresAt) {delete state.encounters[challengeId]; throw httpError(410,'Время испытания истекло');}
  score=clamp(Number(score)||0,0,1);
  const required=clamp(0.42 + (enc.difficulty-1)*0.08,0.42,0.78);
  if(score<required) { delete state.encounters[challengeId]; return {success:false,required,retryAfter:8}; }
  const obj=enc.obj, creature=getCreature(obj.creatureId), mult=rarities[obj.rarity].reward;
  const choiceBonus=choice===creature.preferred?1.25:1;
  const reward={eventId:obj.id,xp:Math.round(22*mult*choiceBonus),essence:Math.round(6*mult),signs:0,items:{},artifact:null};
  if(obj.type==='resource'){
    const item=choose(['ash','thread','salt','bark','water'],obj.id,0); reward.items[item]=Math.max(1,Math.round(2*mult));
  } else {
    for(const [item,base] of Object.entries(creature.drops)) if(rand(`${enc.id}|${item}`,8)<0.86) reward.items[item]=Math.max(1,Math.round(base*mult*0.72));
  }
  if(obj.type==='artifact'){
    reward.artifact=generateArtifact(obj,p); p.uniqueArtifacts.push(reward.artifact);
    reward.signs=Math.round(2*mult);
  }
  if(obj.type==='rift'){
    const amount=Math.round((70+score*80)*mult);
    const wp=state.worldProgress[obj.id] ||= {value:0,participants:{},closed:false};
    wp.value=clamp(wp.value+amount,0,obj.target); wp.participants[p.id]=(wp.participants[p.id]||0)+amount;
    wp.closed=wp.value>=obj.target;
    p.stats.riftContribution += amount; progressQuest(p,'rift',amount);
    if(p.circleId && state.circles[p.circleId]){ const circle=state.circles[p.circleId]; circle.mission.progress=clamp(circle.mission.progress+amount,0,circle.mission.target); circle.reputation+=Math.round(amount/20); }
    reward.contribution=amount; reward.shared={value:wp.value,target:obj.target,closed:wp.closed};
    if(wp.closed){ reward.signs+=Math.round(6*mult); reward.xp+=Math.round(40*mult); }
  } else p.completed[obj.id]=Date.now();
  for(const [item,qty] of Object.entries(reward.items)) addItem(p,item,qty);
  p.essence+=reward.essence; p.signs+=reward.signs; state.economy.totalSignsIssued+=reward.signs;
  awardXp(p,reward.xp); p.stats.encounters++; p.reputation+=choice==='calm'?2:choice==='study'?1:0;
  const c=p.codex[creature.id] ||= {seen:0,calmed:0,banished:0,studied:0,knowledge:0};
  c.seen++; c[choice==='calm'?'calmed':choice==='banish'?'banished':'studied']++; c.knowledge=clamp(c.knowledge+(choice==='study'?18:9),0,100);
  progressQuest(p,'encounter',1);
  state.audit.push({at:Date.now(),type:'encounter',playerId:p.id,eventId:obj.id,score,choice,reward});
  delete state.encounters[challengeId];
  return {success:true,reward,player:publicPlayer(p),codex:c};
}

export function craft(state,p,recipeId){
  const recipe=getRecipe(recipeId); if(!recipe) throw httpError(404,'Рецепт не найден');
  if((p.professions[recipe.profession]||0)<recipe.level) throw httpError(403,'Недостаточный уровень профессии');
  for(const [id,qty] of Object.entries(recipe.inputs)) if((p.inventory[id]||0)<qty) throw httpError(409,`Не хватает: ${getItem(id)?.name||id}`);
  for(const [id,qty] of Object.entries(recipe.inputs)) removeItem(p,id,qty);
  addItem(p,recipe.output.itemId,recipe.output.qty); p.stats.crafts++; p.professionXp ||= {}; p.professionXp[recipe.profession]=(p.professionXp[recipe.profession]||0)+1; p.professions[recipe.profession]=Math.max(p.professions[recipe.profession]||1, Math.min(5,1+Math.floor(p.professionXp[recipe.profession]/5))); awardXp(p,22*recipe.level); progressQuest(p,'craft',1);
  state.audit.push({at:Date.now(),type:'craft',playerId:p.id,recipeId});
  return {player:publicPlayer(p), output:recipe.output};
}

export function equip(state,p,{slot,itemId}){
  if(!['amulet1','amulet2','amulet3'].includes(slot)) throw httpError(400,'Неверный слот');
  if(itemId!==null){ const item=getItem(itemId); if(!item || item.type!=='amulet') throw httpError(400,'Это не амулет'); if((p.inventory[itemId]||0)<1) throw httpError(409,'Амулета нет в инвентаре'); }
  p.equipment[slot]=itemId; return publicPlayer(p);
}

export function claimQuest(state,p,questId){
  refreshQuests(p); const q=p.quests.entries[questId];
  if(!q) throw httpError(404,'Задание не найдено'); if(q.claimed) throw httpError(409,'Награда уже получена'); if(q.progress<q.target) throw httpError(409,'Задание ещё не выполнено');
  q.claimed=true; p.signs+=q.reward.signs; state.economy.totalSignsIssued+=q.reward.signs; awardXp(p,q.reward.xp);
  return {player:publicPlayer(p),reward:q.reward};
}

export function upgradeShelter(state,p,key){
  if(!['scanner','workshop','storage'].includes(key)) throw httpError(400,'Неизвестное улучшение');
  const level=p.shelter[key]||1, costSigns=12*level, costAsh=3*level;
  if(p.signs<costSigns || (p.inventory.ash||0)<costAsh) throw httpError(409,'Недостаточно Знаков или Пепла Нави');
  p.signs-=costSigns; removeItem(p,'ash',costAsh); p.shelter[key]=level+1; return {player:publicPlayer(p),cost:{signs:costSigns,ash:costAsh}};
}

function tradableQty(p,itemId){
  const item=getItem(itemId); if(!item?.tradable) return 0;
  let qty=p.inventory[itemId]||0; for(const x of Object.values(p.equipment)) if(x===itemId) qty--; return Math.max(0,qty);
}

export function marketListings(state,filters={}){
  return Object.values(state.market.listings).filter(x=>x.status==='active' && (!filters.itemId||x.itemId===filters.itemId)).sort((a,b)=>a.price-b.price||b.createdAt-a.createdAt).slice(0,200);
}

export function createListing(state,p,{itemId,artifactId,qty=1,price}){
  price=Math.floor(Number(price)); qty=Math.floor(Number(qty)); if(price<1||price>1_000_000||qty<1||qty>999) throw httpError(400,'Некорректная цена или количество');
  let listing;
  if(artifactId){
    const idx=p.uniqueArtifacts.findIndex(a=>a.id===artifactId); if(idx<0) throw httpError(404,'Артефакт не найден');
    const artifact=p.uniqueArtifacts.splice(idx,1)[0]; listing={id:uid('lot'),sellerId:p.id,sellerName:p.name,kind:'artifact',artifact,qty:1,price,status:'active',createdAt:Date.now()};
  } else {
    if(tradableQty(p,itemId)<qty) throw httpError(409,'Недостаточно свободных предметов');
    removeItem(p,itemId,qty); listing={id:uid('lot'),sellerId:p.id,sellerName:p.name,kind:'item',itemId,qty,price,status:'active',createdAt:Date.now()};
  }
  state.market.listings[listing.id]=listing; state.audit.push({at:Date.now(),type:'market_list',playerId:p.id,listingId:listing.id}); return listing;
}

export function cancelListing(state,p,listingId){
  const l=state.market.listings[listingId]; if(!l||l.status!=='active') throw httpError(404,'Лот не найден'); if(l.sellerId!==p.id) throw httpError(403,'Это не ваш лот');
  if(l.kind==='artifact') p.uniqueArtifacts.push(l.artifact); else addItem(p,l.itemId,l.qty); l.status='cancelled'; l.cancelledAt=Date.now(); return publicPlayer(p);
}

export function buyListing(state,buyer,listingId){
  const l=state.market.listings[listingId]; if(!l||l.status!=='active') throw httpError(404,'Лот уже недоступен'); if(l.sellerId===buyer.id) throw httpError(409,'Нельзя купить собственный лот');
  if(buyer.signs<l.price) throw httpError(409,'Недостаточно Знаков Грани'); const seller=state.players[l.sellerId]; if(!seller) throw httpError(409,'Продавец недоступен');
  const fee=Math.max(1,Math.floor(l.price*commission)), sellerNet=l.price-fee, treasury=Math.min(fee,Math.max(1,Math.floor(fee*0.72))), worldFund=fee-treasury;
  buyer.signs-=l.price; seller.signs+=sellerNet; state.economy.treasury+=treasury; state.economy.worldFund+=worldFund;
  if(l.kind==='artifact'){ l.artifact.owners.push(buyer.id); buyer.uniqueArtifacts.push(l.artifact); } else addItem(buyer,l.itemId,l.qty);
  l.status='sold'; l.buyerId=buyer.id; l.soldAt=Date.now(); l.fee=fee; state.market.sales.push({...l}); buyer.stats.trades++; seller.stats.trades++;
  state.audit.push({at:Date.now(),type:'market_buy',playerId:buyer.id,listingId:l.id,price:l.price,fee});
  return {buyer:publicPlayer(buyer),listing:l,fee};
}

export function createCircle(state,p,{name}){
  name=String(name||'').trim().slice(0,32); if(name.length<3) throw httpError(400,'Название должно быть длиннее'); if(p.circleId) throw httpError(409,'Вы уже состоите в Круге');
  const id=uid('circle'), code=hashHex(id).slice(0,6).toUpperCase();
  state.circles[id]={id,name,code,leaderId:p.id,createdAt:Date.now(),members:[p.id],level:1,reputation:0,mission:{title:'Закрывайте разломы вместе',progress:0,target:1000},treasury:0}; p.circleId=id;
  return state.circles[id];
}
export function joinCircle(state,p,{code}){
  if(p.circleId) throw httpError(409,'Вы уже состоите в Круге'); const c=Object.values(state.circles).find(x=>x.code===String(code||'').toUpperCase()); if(!c) throw httpError(404,'Круг не найден'); if(c.members.length>=50) throw httpError(409,'Круг заполнен'); c.members.push(p.id);p.circleId=c.id;return c;
}
export function getCircle(state,p){ const c=p.circleId?state.circles[p.circleId]:null; if(!c)return null; return {...c,members:c.members.map(id=>{const x=state.players[id];return x?{id:x.id,name:x.name,level:x.level}:null}).filter(Boolean)}; }

export function bootstrap(state,p){
  return {player:publicPlayer(p),catalog:{creatures,items,recipes,professions,rarities},market:marketListings(state),circle:getCircle(state,p),server:{time:Date.now(),demoMode,cryptoEnabled:String(process.env.ENABLE_CRYPTO||'0')==='1',commissionPercent:commission*100}};
}

export function cryptoStatus(){
  const enabled=String(process.env.ENABLE_CRYPTO||'0')==='1';
  return {enabled,network:'TON',mode:enabled?'adapter-required':'offchain',message:enabled?'Подключите лицензированный TON-адаптер и адреса контрактов.':'Внутренняя валюта работает офчейн. Вывод в блокчейн отключён.'};
}

export function httpError(status,message){ const e=new Error(message);e.status=status;return e; }
