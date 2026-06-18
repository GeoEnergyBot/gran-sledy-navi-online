import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'gran-core-test-'));
const port=19500+Math.floor(Math.random()*300);
let output='';
const child=spawn(process.execPath,[path.join(root,'server.mjs')],{
  cwd:root,
  env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DEMO_MODE:'1',WORLD_SEED:'stable-core-world',DATA_DIR:temp},
  stdio:['ignore','pipe','pipe'],windowsHide:true
});
child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
const base=`http://127.0.0.1:${port}`;
const auth={'x-player-id':'stable-alpha','x-player-name':'Stable Alpha'};
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/health');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error(`server timeout\n${output}`)}
async function json(url,headers=auth){const r=await fetch(base+url,{headers});const data=await r.json();return {r,data}}

try{
  await wait();
  const anonymous=await fetch(base+'/api/district?lat=43.238949&lng=76.889709');
  assert.equal(anonymous.status,401);

  const world=await json('/api/world?lat=43.238949&lng=76.889709&radius=1200');
  assert.equal(world.r.status,200);
  assert.ok(world.data.district?.id);
  assert.ok(world.data.objects.length>5);
  assert.equal(new Set(world.data.objects.map(x=>x.id)).size,world.data.objects.length);

  const district=await json('/api/district?lat=43.238949&lng=76.889709');
  assert.equal(district.r.status,200);
  assert.equal(district.data.district.id,world.data.district.id);

  const controller=new AbortController();
  const stream=await fetch(base+'/api/stream',{headers:{...auth,accept:'text/event-stream'},signal:controller.signal});
  assert.equal(stream.status,200);
  const reader=stream.body.getReader();
  const first=await reader.read();
  const text=new TextDecoder().decode(first.value);
  assert.match(text,/event: connected/);
  controller.abort();

  const html=await fetch(base+'/').then(r=>r.text());
  assert.match(html,/stable-core\.js/);
  assert.match(html,/ui-v2\.js/);

  await new Promise(r=>setTimeout(r,100));
  const state=JSON.parse(await readFile(path.join(temp,'state.json'),'utf8'));
  assert.equal(state.version,5);
  assert.ok(state.districts&&typeof state.districts==='object');

  console.log('✓ anonymous API rejected');
  console.log('✓ authorized district and world');
  console.log('✓ authorized realtime stream');
  console.log('✓ stable client assets loaded');
  console.log('✓ state migrated to v5');
}finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1200)});
  await rm(temp,{recursive:true,force:true});
}
