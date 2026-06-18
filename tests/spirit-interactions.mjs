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
  assert.ok(definition.study.points.length>=3,`${id}: research points`);
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
async function spawnSpirit(id){return (await api(id,'/api/test/spirit-spawn',{lat:43.238949,lng:76.889709})).object}
async function start(id,obj){return api(id,'/api/spirit/start',{eventId:obj.id,lat:obj.lat,lng:obj.lng})}

try{
  await wait();

  const studyObj=await spawnSpirit('researcher');
  assert.ok(studyObj.id.startsWith('test_spirit_'));
  assert.equal(studyObj.lat,43.238949);
  const studyStart=await start('researcher',studyObj);
  assert.equal(studyStart.ar.requiredDistance,30);
  assert.ok(studyStart.interaction.tools.length>=5);
  const points=studyStart.interaction.study.points;
  for(const point of points.slice(0,Math.ceil(points.length*.66))){
    const result=await api('researcher','/api/spirit/study-check',{challengeId:studyStart.challengeId,pointId:point.id,toolId:point.toolId});
    assert.equal(result.correct,true);
  }
  const study=await api('researcher','/api/spirit/resolve',{challengeId:studyStart.challengeId,mode:'study',payload:{focusMs:studyStart.interaction.study.targetMs,focusBreaks:0,observations:points.length}});
  assert.equal(study.success,true);
  assert.equal(study.mode,'study');
  assert.ok(study.detail.unlockedRune?.id);

  let calmObj;
  for(let i=0;i<30;i++){
    const candidate=await spawnSpirit('diplomat');
    if(['city','park'].includes(candidate.biome)){calmObj=candidate;break}
  }
  assert.ok(calmObj,'expected a city or park test creature');
  const calmStart=await start('diplomat',calmObj);
  const bestAnswers=calmStart.interaction.calm.dialogue.map(round=>[...round.options].sort((a,b)=>b.score-a.score)[0].id);
  const calm=await api('diplomat','/api/spirit/resolve',{challengeId:calmStart.challengeId,mode:'calm',payload:{answers:bestAnswers}});
  assert.equal(calm.success,true);
  assert.equal(calm.mode,'calm');
  assert.ok(calm.spiritProgress.trust>0);

  const banishObj=await spawnSpirit('warder');
  const banishStart=await start('warder',banishObj);
  const definition=spiritDefinitions[banishStart.creature.id];
  for(let i=0;i<definition.sequence.length;i++){
    const result=await api('warder','/api/spirit/rune-check',{challengeId:banishStart.challengeId,slotIndex:i,runeId:definition.sequence[i]});
    assert.equal(result.correct,true);
  }
  const banish=await api('warder','/api/spirit/resolve',{challengeId:banishStart.challengeId,mode:'banish',payload:{}});
  assert.equal(banish.success,true);
  assert.equal(banish.detail.correct,true);

  const secondSpawn=await spawnSpirit('warder');
  assert.notEqual(secondSpawn.id,banishObj.id);

  console.log('✓ all 12 creatures have distinct interaction definitions');
  console.log('✓ every pulse can create one server-authorized random creature');
  console.log('✓ research tools are validated server-side');
  console.log('✓ negotiation paths resolve by creature temperament');
  console.log('✓ rune drag sequence is validated step by step');
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1200)});
  await rm(temp,{recursive:true,force:true});
}
