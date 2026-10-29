import assert from 'node:assert/strict';

process.env.DEMO_MODE='0';
const {ensurePlayer,worldNearby,startEncounter}=await import('../src/game-engine.mjs');

const state={players:{},worldProgress:{},encounters:{},economy:{totalSignsIssued:0},presence:{},circles:{},audit:[]};
const player=ensurePlayer(state,{id:'distance-test',name:'Проверка',verified:true});
const world=worldNearby(state,player,43.238949,76.889709,4000);
const creature=world.find(x=>['trace','creature'].includes(x.type));
const other=world.find(x=>!['trace','creature'].includes(x.type));
assert.ok(creature,'world should contain a creature encounter');
assert.ok(other,'world should contain a non-creature encounter');

function offset(point,meters){return {lat:point.lat+meters/111320,lng:point.lng}}
function attempt(obj,distance){
  const position=offset(obj,distance);
  player.lastPosition={...position,accuracy:10,at:Date.now()};
  try{return startEncounter(state,player,{eventId:obj.id,...position})}
  catch(error){return error}
}

assert.equal(attempt(creature,100).status,403,'creature encounter must reject at 100 m');
assert.equal(attempt(creature,20).event.id,creature.id,'creature encounter must start within 30 m');
assert.equal(attempt(other,160).status,403,'other encounter must reject at 160 m');
assert.equal(attempt(other,100).event.id,other.id,'other encounter must start within 140 m');

console.log('✓ creature encounters use a 30 m interaction radius');
console.log('✓ other world events use a 140 m interaction radius');
