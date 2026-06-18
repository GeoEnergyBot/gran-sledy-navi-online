import crypto from 'node:crypto';
import { startEncounter, resolveEncounter, httpError } from './game-engine.mjs';

const RUNES=[
  {id:'hearth',symbol:'ᛟ',name:'Руна очага',color:'ember'},
  {id:'boundary',symbol:'ᛉ',name:'Руна границы',color:'blue'},
  {id:'silence',symbol:'ᛏ',name:'Руна тишины',color:'silver'},
  {id:'path',symbol:'ᚱ',name:'Руна пути',color:'green'},
  {id:'memory',symbol:'ᚾ',name:'Руна памяти',color:'violet'},
  {id:'ward',symbol:'ᛇ',name:'Руна защиты',color:'gold'}
];
const DOMOVOY_SEQUENCE=['hearth','boundary','silence'];
const TREATS={milk:2,bread:2,honey:3};
const DIALOGUE=[
  {id:'approach',line:'«Чужой ходит, дверями хлопает, а хозяина не спрашивает…»',options:[
    {id:'praise_home',text:'Похвалить его дом',score:2},
    {id:'command',text:'Приказать показаться',score:-2},
    {id:'apologize',text:'Извиниться за вторжение',score:1}
  ]},
  {id:'offering',line:'Домовой принюхивается и внимательно смотрит на руки.',options:[
    {id:'offer_milk',text:'Предложить молоко',score:2,treat:'milk'},
    {id:'offer_bread',text:'Предложить хлеб',score:1,treat:'bread'},
    {id:'threaten',text:'Пригрозить защитной солью',score:-2}
  ]},
  {id:'promise',line:'«Не шуми после полуночи — тогда покажу, что спрятано».',options:[
    {id:'agree',text:'Согласиться и поблагодарить',score:2},
    {id:'bargain',text:'Предложить честную сделку',score:1},
    {id:'deceive',text:'Пообещать, не собираясь выполнять',score:-2}
  ]}
];
const hash=input=>crypto.createHash('sha256').update(String(input)).digest('hex');
const demoMode=String(process.env.DEMO_MODE||'1')==='1';
function haversine(a,b){const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2))}

function ensureProfile(p){
  p.spiritKnowledge ||= {};
  p.spiritKnowledge.domovoy ||= {knowledge:0,runes:[],trust:0,studies:0,calms:0,banishes:0};
  p.flags ||= {};
  if(!p.flags.spiritStarter){
    p.inventory.milk=(p.inventory.milk||0)+1;
    p.inventory.bread=(p.inventory.bread||0)+1;
    p.flags.spiritStarter=true;
  }
  return p.spiritKnowledge.domovoy;
}
function addItem(p,id,qty=1){p.inventory[id]=(p.inventory[id]||0)+qty}
function runeInfo(ids){return ids.map(id=>RUNES.find(r=>r.id===id)).filter(Boolean)}

export function startSpiritEncounter(state,p,body){
  const base=startEncounter(state,p,body);
  if(base.creature.id!=='domovoy')throw httpError(409,'AR-прототип пока доступен только для Домового');
  const distance=haversine({lat:Number(body.lat),lng:Number(body.lng)},{lat:base.event.lat,lng:base.event.lng});
  if(!demoMode&&distance>30){delete state.encounters[base.challengeId];throw httpError(403,`Подойдите ближе: ${Math.round(distance)} м`)}
  const enc=state.encounters[base.challengeId];
  enc.spiritPrototype=true;enc.expiresAt=Date.now()+5*60_000;
  const profile=ensureProfile(p);
  return {
    ...base,
    ar:{requiredDistance:30,currentDistance:Math.round(distance),cameraPreferred:true,fallbackAllowed:true},
    interaction:{
      modes:['calm','study','banish'],
      knownRunes:runeInfo(profile.runes),
      runePool:RUNES,
      banish:{slots:3,sequence:profile.runes.length>=3?DOMOVOY_SEQUENCE:[null,null,null],maxErrors:3},
      study:{targetMs:12_000,maxFocusBreaks:3},
      calm:{dialogue:DIALOGUE,treats:Object.entries(TREATS).map(([id,value])=>({id,value,owned:p.inventory[id]||0}))}
    },
    spiritProgress:profile
  };
}

export function resolveSpiritEncounter(state,p,{challengeId,mode,payload={}}){
  const enc=state.encounters[challengeId];
  if(!enc||enc.playerId!==p.id||!enc.spiritPrototype)throw httpError(404,'AR-встреча не найдена');
  if(enc.obj.creatureId!=='domovoy')throw httpError(409,'Неподдерживаемое существо');
  const profile=ensureProfile(p);
  let success=false,score=0.9,choice='study',detail={};

  if(mode==='study'){
    const focusMs=Math.max(0,Number(payload.focusMs)||0),breaks=Math.max(0,Number(payload.focusBreaks)||0),observations=Math.max(0,Number(payload.observations)||0);
    success=focusMs>=10_000&&breaks<=3;
    score=Math.min(1,.65+focusMs/40_000+observations*.04-breaks*.05);
    detail={focusMs,breaks,observations};
    if(success){
      profile.studies++;profile.knowledge=Math.min(100,profile.knowledge+Math.min(28,18+observations*3));
      const unseen=DOMOVOY_SEQUENCE.filter(id=>!profile.runes.includes(id));
      if(unseen.length){const unlocked=unseen[0];profile.runes.push(unlocked);detail.unlockedRune=RUNES.find(r=>r.id===unlocked)}
      const roll=parseInt(hash(`${challengeId}|glyph`).slice(0,8),16)/0xffffffff;
      if(roll<.45){const runeId=DOMOVOY_SEQUENCE[parseInt(hash(challengeId).slice(8,10),16)%DOMOVOY_SEQUENCE.length];const glyphId=`glyph_${runeId}`;addItem(p,glyphId,1);detail.glyph={itemId:glyphId,rune:RUNES.find(r=>r.id===runeId)}}
    }
  }else if(mode==='calm'){
    choice='calm';const answers=Array.isArray(payload.answers)?payload.answers:[];
    let total=0,treat=null;
    for(const round of DIALOGUE){const selectedId=answers.find(x=>round.options.some(o=>o.id===x));const answer=round.options.find(o=>o.id===selectedId);if(answer){total+=answer.score;if(answer.treat)treat=answer.treat}}
    if(treat&&(!p.inventory[treat]||p.inventory[treat]<1))throw httpError(409,'Угощения нет в инвентаре');
    success=total>=3;score=Math.min(1,Math.max(.45,.65+total*.06));
    if(success){if(treat){p.inventory[treat]--;if(p.inventory[treat]<=0)delete p.inventory[treat]}profile.calms++;profile.trust=Math.min(100,profile.trust+12+Math.max(0,total));profile.knowledge=Math.min(100,profile.knowledge+6)}
    detail={dialogueScore:total,treatUsed:success?treat:null};
  }else if(mode==='banish'){
    choice='banish';const sequence=Array.isArray(payload.sequence)?payload.sequence:[],errors=Math.max(0,Number(payload.errors)||0);
    const correct=DOMOVOY_SEQUENCE.every((id,index)=>sequence[index]===id);
    success=correct&&errors<=3;score=correct?Math.max(.7,1-errors*.08):.1;
    if(success){profile.banishes++;profile.knowledge=Math.min(100,profile.knowledge+4);const roll=parseInt(hash(`${challengeId}|banish`).slice(0,8),16)/0xffffffff;if(roll<.3){addItem(p,'glyph_boundary',1);detail.glyph={itemId:'glyph_boundary',rune:RUNES.find(r=>r.id==='boundary')}}}
    detail={...detail,correct,errors,expectedSlots:3};
  }else throw httpError(400,'Неизвестный способ взаимодействия');

  if(!success){delete state.encounters[challengeId];return {success:false,mode,detail,spiritProgress:profile,retryAfter:10}}
  const result=resolveEncounter(state,p,{challengeId,score:Math.max(.82,score),choice});
  result.mode=mode;result.detail=detail;result.spiritProgress=profile;
  return result;
}

export function spiritProfile(p){return ensureProfile(p)}
export const spiritRunes=RUNES;