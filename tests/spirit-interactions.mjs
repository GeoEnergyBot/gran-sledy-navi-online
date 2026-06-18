import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spiritDefinitions } from '../src/spirit-interactions.mjs';

assert.equal(Object.keys(spiritDefinitions).length,12);
for(const [id,definition] of Object.entries(spiritDefinitions)){
  assert.ok(definition.sequence.length>=3,`${id}: rune sequence`);
  assert.equal(definition.slots,definition.sequence.length,`${id}: slot count`);
  assert.ok(definition.study.targetMs>=12000,`${id}: study duration`);
  assert.equal(definition.calm.dialogue.length,3,`${id}: dialogue rounds`);
}
assert.ok(spiritDefinitions.likho.slots>spiritDefinitions.domovoy.slots);
assert.ok(spiritDefinitions.poludnitsa.study.targetMs>spiritDefinitions.domovoy.study.targetMs);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'gran-spirit-test-'));
const port=19850+Math.floor(Math.random()*100);
let output='';
const child=spawn(process.execPath,[path.join(root,'server.mjs')],{
  cwd:root,
  env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DEMO_MODE:'1',WORLD_SEED:'spirit-prototype-world',DATA_DIR:temp},
  stdio:['ignore','pipe','pipe'],windowsHide:true
});
child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
const base=`http://127.0.0.1:${port}`;
const headers=id=>({'content-type':'application/json','x-player-id':id,'x-player-name':id});
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/health');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error(`server timeout\n${output}`)}
async function api(id,url,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:headers(id),body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(`${r.status}: ${data.error}`);return data}
async function findCreature(id,creatureId){
  const baseLat=43.238949,baseLng=76.889709;
  for(let x=-5;x<=5;x++)for(let y=-5;y<=5;y++){
    const lat=baseLat+x*.008,lng=baseLng+y*.008;
    const world=await api(id,`/api/world?lat=${lat}&lng=${lng}&radius=2200`);
    const obj=world.objects.find(o=>o.creatureId===creatureId&&!o.completed);
    if(obj)return obj;
  }
  throw new Error(`${creatureId} not found in test world`);
}
async function start(id,obj){return api(id,'/api/spirit/start',{eventId:obj.id,lat:obj.lat,lng:obj.lng})}

try{
  await wait();
  const obj=await findCreature('researcher','domovoy');

  const studyStart=await start('researcher',obj);
  assert.equal(studyStart.creature.id,'domovoy');
  assert.equal(studyStart.ar.requiredDistance,30);
  assert.equal(studyStart.interaction.banish.slots,3);
  const study=await api('researcher','/api/spirit/resolve',{challengeId:studyStart.challengeId,mode:'study',payload:{focusMs:12000,focusBreaks:0,observations:2}});
  assert.equal(study.success,true);
  assert.equal(study.mode,'study');
  assert.ok(study.detail.unlockedRune?.id);
  assert.ok(study.spiritProgress.knowledge>=18);

  const calmStart=await start('diplomat',obj);
  assert.ok(calmStart.interaction.calm.offerings.includes('milk'));
  const calm=await api('diplomat','/api/spirit/resolve',{challengeId:calmStart.challengeId,mode:'calm',payload:{answers:['respect','offer_milk','honor']}});
  assert.equal(calm.success,true);
  assert.equal(calm.mode,'calm');
  assert.ok(calm.spiritProgress.trust>0);
  assert.equal(calm.detail.itemUsed,'milk');

  const banishStart=await start('warder',obj);
  const banish=await api('warder','/api/spirit/resolve',{challengeId:banishStart.challengeId,mode:'banish',payload:{sequence:['hearth','boundary','silence'],errors:0}});
  assert.equal(banish.success,true);
  assert.equal(banish.mode,'banish');
  assert.equal(banish.detail.correct,true);

  const bootstrap=await api('researcher','/api/bootstrap');
  assert.ok(bootstrap.spiritProgress.domovoy.runes.length>=1);
  assert.ok(bootstrap.catalog.items.some(x=>x.id==='glyph_hearth'));

  console.log('✓ all 12 creatures have distinct interaction definitions');
  console.log('✓ difficulty scales by creature tier');
  console.log('✓ study unlocks creature-specific rune knowledge');
  console.log('✓ dialogue consumes an offering and builds trust');
  console.log('✓ rune banishment resolves server-side');
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1200)});
  await rm(temp,{recursive:true,force:true});
}
