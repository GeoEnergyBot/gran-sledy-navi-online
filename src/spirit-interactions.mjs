import crypto from 'node:crypto';
import './spirit-content.mjs';
import { startEncounter, resolveEncounter, httpError } from './game-engine.mjs';
import { creatures, rarities } from './catalog.mjs';

const RUNES=[
  {id:'hearth',symbol:'ᛟ',name:'Руна очага',color:'ember'},
  {id:'boundary',symbol:'ᛉ',name:'Руна границы',color:'blue'},
  {id:'silence',symbol:'ᛏ',name:'Руна тишины',color:'silver'},
  {id:'path',symbol:'ᚱ',name:'Руна пути',color:'green'},
  {id:'memory',symbol:'ᚾ',name:'Руна памяти',color:'violet'},
  {id:'ward',symbol:'ᛇ',name:'Руна защиты',color:'gold'},
  {id:'water',symbol:'ᛚ',name:'Руна воды',color:'cyan'},
  {id:'sun',symbol:'ᛋ',name:'Руна солнца',color:'amber'},
  {id:'dream',symbol:'ᛗ',name:'Руна сна',color:'indigo'},
  {id:'truth',symbol:'ᚨ',name:'Руна истины',color:'white'}
];
const TOOLS=[
  {id:'lens',icon:'◉',name:'Линза ауры'},
  {id:'memory_thread',icon:'∞',name:'Нить памяти'},
  {id:'mirror',icon:'◇',name:'Зеркальный осколок'},
  {id:'listener',icon:'⌁',name:'Слуховой амулет'},
  {id:'compass',icon:'✥',name:'Рунический компас'}
];
const GLYPH_BY_RUNE=Object.fromEntries(RUNES.map(r=>[r.id,`glyph_${r.id}`]));
const demoMode=String(process.env.DEMO_MODE||'1')==='1';
const hash=input=>crypto.createHash('sha256').update(String(input)).digest('hex');
const rarityTier={common:1,uncommon:2,rare:3,epic:4,legendary:5};
const sequences={
  domovoy:['hearth','boundary','silence'], kikimora:['silence','memory','boundary','truth'],
  ovinnik:['hearth','ward','sun','boundary','silence'], leshy:['path','boundary','memory','ward','truth'],
  polevik:['path','sun','silence','ward'], poludnitsa:['sun','ward','truth','boundary','memory','silence'],
  rusalka:['water','memory','dream','truth','boundary'], vodyanoy:['water','boundary','ward','memory','truth','silence'],
  bannik:['hearth','water','boundary','silence'], nochnitsa:['dream','silence','ward','memory','truth'],
  likho:['truth','ward','boundary','memory','dream','silence','path'], mara:['dream','memory','truth','silence','ward','boundary']
};
const studyPatterns={
  domovoy:[['aura','lens'],['memory','memory_thread'],['reflection','mirror']],
  kikimora:[['whisper','listener'],['shadow','mirror'],['trail','compass']],
  ovinnik:[['heat','lens'],['ash','compass'],['memory','memory_thread']],
  leshy:[['trail','compass'],['bark','lens'],['voice','listener']],
  polevik:[['wind','listener'],['trail','compass'],['aura','lens']],
  poludnitsa:[['heat','lens'],['shadow','mirror'],['voice','listener'],['trail','compass']],
  rusalka:[['voice','listener'],['reflection','mirror'],['memory','memory_thread']],
  vodyanoy:[['current','compass'],['reflection','mirror'],['voice','listener'],['aura','lens']],
  bannik:[['steam','lens'],['voice','listener'],['trail','compass']],
  nochnitsa:[['shadow','mirror'],['whisper','listener'],['memory','memory_thread']],
  likho:[['deception','mirror'],['voice','listener'],['trail','compass'],['memory','memory_thread']],
  mara:[['dream','memory_thread'],['shadow','mirror'],['whisper','listener'],['aura','lens']]
};
const signalNames={aura:'Аура',memory:'Отпечаток памяти',reflection:'Истинное отражение',whisper:'Шёпот',shadow:'Тень',trail:'След',heat:'Жар',ash:'Пепельный след',voice:'Голос',bark:'Кора',wind:'Ветер',current:'Течение',steam:'Пар',deception:'Ложный облик',dream:'Сонный след'};
const dialogueThemes={
  peaceful:{opening:'«С миром ли пришёл, Проводник?»',kind:'Проявить уважение',neutral:'Предложить честный обмен',hostile:'Потребовать подчинения'},
  tricky:{opening:'«Назови цену своему любопытству…»',kind:'Ответить загадкой',neutral:'Предложить сделку',hostile:'Попытаться перехитрить силой'},
  hostile:{opening:'Существо скалится и сжимает пространство вокруг себя.',kind:'Показать, что вы не враг',neutral:'Говорить спокойно и твёрдо',hostile:'Угрожать изгнанием'},
  proud:{opening:'«Кто дал тебе право тревожить хозяина этих мест?»',kind:'Признать его власть',neutral:'Назвать общую цель',hostile:'Оспорить его силу'},
  restless:{opening:'Существо не задерживается на месте и не слушает длинных речей.',kind:'Подстроиться под его ритм',neutral:'Предложить короткую сделку',hostile:'Попытаться остановить силой'},
  melancholic:{opening:'«Люди приходят, обещают и забывают…»',kind:'Выслушать и признать боль',neutral:'Предложить память в обмен',hostile:'Обвинить в слабости'},
  irritable:{opening:'Существо раздражённо предупреждает не нарушать его границы.',kind:'Извиниться и отступить на шаг',neutral:'Предложить полезный дар',hostile:'Ответить раздражением'},
  mysterious:{opening:'Голос звучит сразу из нескольких сторон.',kind:'Говорить правду',neutral:'Задать осторожный вопрос',hostile:'Попытаться разоблачить угрозой'}
};
const offeringByBiome={city:['milk','bread','honey'],park:['bread','honey','bark'],water:['water','honey','mirror'],night:['feather','mirror','salt']};
const offeringNames={milk:'молоко',bread:'хлеб',honey:'мёд',bark:'кору',water:'воду из разлома',mirror:'осколок зеркала',feather:'перо ночницы',salt:'защитную соль'};

function uid(prefix){return `${prefix}_${crypto.randomUUID()}`}
function haversine(a,b){const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2))}
function runeInfo(ids){return ids.map(id=>RUNES.find(r=>r.id===id)).filter(Boolean)}
function addItem(p,id,qty=1){p.inventory[id]=(p.inventory[id]||0)+qty}
function profileFor(p,creatureId){
  p.spiritKnowledge ||= {};
  p.spiritKnowledge[creatureId] ||= {knowledge:0,runes:[],trust:0,studies:0,calms:0,banishes:0,failures:0};
  p.flags ||= {};
  if(!p.flags.spiritStarter){p.inventory.milk=(p.inventory.milk||0)+1;p.inventory.bread=(p.inventory.bread||0)+1;p.flags.spiritStarter=true}
  return p.spiritKnowledge[creatureId];
}
function buildDialogue(creature){
  const theme=dialogueThemes[creature.temperament]||dialogueThemes.mysterious,offers=offeringByBiome[creature.biome]||offeringByBiome.city;
  return [
    {id:'approach',kind:'phrase',line:theme.opening,options:[{id:'respect',text:theme.kind,score:2},{id:'negotiate',text:theme.neutral,score:1},{id:'provoke',text:theme.hostile,score:-2}]},
    {id:'offering',kind:'gift',line:`${creature.name} наблюдает за тем, что вы готовы предложить.`,options:[{id:`offer_${offers[0]}`,text:`Предложить ${offeringNames[offers[0]]||offers[0]}`,score:2,item:offers[0]},{id:`offer_${offers[1]}`,text:`Предложить ${offeringNames[offers[1]]||offers[1]}`,score:1,item:offers[1]},{id:'offer_none',text:'Отказаться от дара',score:-1}]},
    {id:'promise',kind:'gesture',line:'Существо требует закрепить намерение словом или поступком.',options:[{id:'honor',text:'Дать честное обещание',score:2},{id:'bargain',text:'Предложить взаимное условие',score:1},{id:'deceive',text:'Попытаться обмануть',score:-2}]}
  ];
}
function definitionFor(creature){
  const tier=rarityTier[creature.rarity]||1,sequence=sequences[creature.id]||['boundary','ward','silence'];
  const study=studyPatterns[creature.id]||[['aura','lens'],['memory','memory_thread'],['reflection','mirror']];
  return {creatureId:creature.id,tier,sequence,slots:sequence.length,maxErrors:Math.max(1,4-Math.floor(tier/2)),study:{targetMs:9000+tier*3000,maxFocusBreaks:Math.max(1,5-tier),motion:1+tier*.2,points:study.map(([id,toolId],index)=>({id,label:signalNames[id]||id,toolId,index}))},calm:{dialogue:buildDialogue(creature),successScore:3+tier*.25},ar:{requiredDistance:30,cameraPreferred:true,fallbackAllowed:true}};
}
export const spiritDefinitions=Object.fromEntries(creatures.map(c=>[c.id,definitionFor(c)]));

export function createRandomTestSpirit(state,p,{lat,lng}){
  if(!demoMode)throw httpError(403,'Тестовые существа доступны только в демонстрационном режиме');
  lat=Number(lat);lng=Number(lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))throw httpError(400,'Некорректные координаты');
  state.testSpawns ||= {};
  for(const [id,obj] of Object.entries(state.testSpawns))if(obj.playerId===p.id)delete state.testSpawns[id];
  const creature=creatures[crypto.randomInt(0,creatures.length)];
  const obj={id:uid('test_spirit'),playerId:p.id,type:'creature',rarity:creature.rarity,biome:creature.biome,creatureId:creature.id,title:`${creature.name} — тест встречи`,lat,lng,startsAt:Date.now(),expiresAt:Date.now()+90_000,target:1,shared:{value:0,target:1,participants:0,closed:false},completed:false,testSpirit:true};
  state.testSpawns[obj.id]=obj;return obj;
}
function startTestEncounter(state,p,body){
  const obj=state.testSpawns?.[body.eventId];
  if(!obj||obj.playerId!==p.id||Date.now()>obj.expiresAt)throw httpError(404,'Тестовое существо исчезло');
  const creature=creatures.find(c=>c.id===obj.creatureId),challengeId=uid('enc'),difficulty=rarities[obj.rarity]?.weight||1;
  const challenge={id:challengeId,playerId:p.id,eventId:obj.id,obj,createdAt:Date.now(),expiresAt:Date.now()+7*60_000,type:creature.encounter,difficulty,nonce:hash(challengeId).slice(0,12)};
  state.encounters[challengeId]=challenge;return {challengeId,type:challenge.type,difficulty,nonce:challenge.nonce,event:obj,creature};
}

export function startSpiritEncounter(state,p,body){
  const base=String(body.eventId||'').startsWith('test_spirit_')?startTestEncounter(state,p,body):startEncounter(state,p,body);
  if(!['trace','creature'].includes(base.event.type)){delete state.encounters[base.challengeId];throw httpError(409,'AR-встреча доступна только для следов и существ')}
  const creature=base.creature,definition=spiritDefinitions[creature.id];if(!definition)throw httpError(409,'Для этого существа ещё не создана AR-механика');
  const distance=haversine({lat:Number(body.lat),lng:Number(body.lng)},{lat:base.event.lat,lng:base.event.lng});
  if(!demoMode&&distance>definition.ar.requiredDistance){delete state.encounters[base.challengeId];throw httpError(403,`Подойдите ближе: ${Math.round(distance)} м`)}
  const enc=state.encounters[base.challengeId];enc.spiritPrototype=true;enc.spiritCreatureId=creature.id;enc.expiresAt=Date.now()+7*60_000;
  const profile=profileFor(p,creature.id),known=new Set(profile.runes);
  return {...base,spiritDefinition:{tier:definition.tier,slots:definition.slots},ar:{...definition.ar,currentDistance:Math.round(distance)},interaction:{modes:['calm','study','banish'],knownRunes:runeInfo(profile.runes),runePool:RUNES,tools:TOOLS,banish:{slots:definition.slots,sequence:definition.sequence.map(id=>known.has(id)?id:null),maxErrors:definition.maxErrors},study:definition.study,calm:{dialogue:definition.calm.dialogue,successScore:definition.calm.successScore,offerings:offeringByBiome[creature.biome]||offeringByBiome.city}},spiritProgress:profile};
}

export function resolveSpiritEncounter(state,p,{challengeId,mode,payload={}}){
  const enc=state.encounters[challengeId];if(!enc||enc.playerId!==p.id||!enc.spiritPrototype)throw httpError(404,'AR-встреча не найдена');
  const creatureId=enc.spiritCreatureId||enc.obj.creatureId,definition=spiritDefinitions[creatureId];if(!definition)throw httpError(409,'Неподдерживаемое существо');
  const profile=profileFor(p,creatureId);let success=false,score=.8,choice='study',detail={};
  if(mode==='study'){
    const focusMs=Math.max(0,Number(payload.focusMs)||0),breaks=Math.max(0,Number(payload.focusBreaks)||0),observations=Math.max(0,Number(payload.observations)||0),findings=Array.isArray(payload.findings)?payload.findings:[];
    const correctFindings=definition.study.points.filter(point=>findings.some(x=>x.pointId===point.id&&x.toolId===point.toolId)).length,requiredFindings=Math.max(1,Math.ceil(definition.study.points.length*.66));
    success=focusMs>=definition.study.targetMs*.72&&breaks<=definition.study.maxFocusBreaks&&correctFindings>=requiredFindings;
    score=Math.min(1,.5+focusMs/(definition.study.targetMs*3)+correctFindings*.09+observations*.02-breaks*.04);
    detail={focusMs,breaks,observations,correctFindings,requiredFindings,targetMs:definition.study.targetMs};
    if(success){profile.studies++;profile.knowledge=Math.min(100,profile.knowledge+Math.max(8,22-definition.tier*2)+correctFindings*2);const unseen=definition.sequence.filter(id=>!profile.runes.includes(id));if(unseen.length){const unlocked=unseen[0];profile.runes.push(unlocked);detail.unlockedRune=RUNES.find(r=>r.id===unlocked)}const roll=parseInt(hash(`${challengeId}|glyph`).slice(0,8),16)/0xffffffff;if(roll<Math.max(.18,.5-definition.tier*.05)){const runeId=definition.sequence[parseInt(hash(challengeId).slice(8,10),16)%definition.sequence.length],glyphId=GLYPH_BY_RUNE[runeId];addItem(p,glyphId,1);detail.glyph={itemId:glyphId,rune:RUNES.find(r=>r.id===runeId)}}}
  }else if(mode==='calm'){
    choice='calm';const answers=Array.isArray(payload.answers)?payload.answers:[];let total=0,itemUsed=null;
    for(const round of definition.calm.dialogue){const selected=round.options.find(o=>answers.includes(o.id));if(selected){total+=selected.score;if(selected.item)itemUsed=selected.item}}
    if(itemUsed&&(!p.inventory[itemUsed]||p.inventory[itemUsed]<1))throw httpError(409,'Выбранного дара нет в инвентаре');
    success=total>=definition.calm.successScore;score=Math.min(1,Math.max(.4,.58+total*.055-definition.tier*.02));
    if(success){if(itemUsed){p.inventory[itemUsed]--;if(p.inventory[itemUsed]<=0)delete p.inventory[itemUsed]}profile.calms++;profile.trust=Math.min(100,profile.trust+8+Math.max(0,total)-definition.tier);profile.knowledge=Math.min(100,profile.knowledge+4)}
    detail={dialogueScore:total,itemUsed:success?itemUsed:null,required:definition.calm.successScore};
  }else if(mode==='banish'){
    choice='banish';const sequence=Array.isArray(payload.sequence)?payload.sequence:[],errors=Math.max(0,Number(payload.errors)||0),correct=definition.sequence.every((id,index)=>sequence[index]===id);
    success=correct&&errors<=definition.maxErrors;score=correct?Math.max(.62,1-errors*.07-definition.tier*.015):.08;
    if(success){profile.banishes++;profile.knowledge=Math.min(100,profile.knowledge+3);const roll=parseInt(hash(`${challengeId}|banish`).slice(0,8),16)/0xffffffff;if(roll<.22){const runeId=definition.sequence[0],glyphId=GLYPH_BY_RUNE[runeId];addItem(p,glyphId,1);detail.glyph={itemId:glyphId,rune:RUNES.find(r=>r.id===runeId)}}}
    detail={...detail,correct,errors,expectedSlots:definition.slots,maxErrors:definition.maxErrors};
  }else throw httpError(400,'Неизвестный способ взаимодействия');
  if(!success){profile.failures++;delete state.encounters[challengeId];return {success:false,mode,detail,spiritProgress:profile,retryAfter:15}}
  const result=resolveEncounter(state,p,{challengeId,score:Math.max(.82,score),choice});if(enc.obj.testSpirit&&state.testSpawns)delete state.testSpawns[enc.obj.id];result.mode=mode;result.detail=detail;result.spiritProgress=profile;result.spiritDefinition={tier:definition.tier,slots:definition.slots};return result;
}

export function spiritProfile(p){p.spiritKnowledge ||= {};return p.spiritKnowledge}
export const spiritRunes=RUNES;