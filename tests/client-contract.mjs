import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files={};
for(const name of ['public/index.html','public/stable-core.js','public/app.js','public/ui-v2.js','public/map-enhancements.js','public/journey.js','public/district.js','public/ar-encounter.js']){
  files[name]=await readFile(path.join(root,name),'utf8');
}
const index=files['public/index.html'];
assert.ok(index.indexOf('/stable-core.js')<index.indexOf('/ui-v2.js'),'stable-core must load before UI');
assert.ok(index.indexOf('/stable-core.js')<index.indexOf('/app.js'),'stable-core must load before app');
assert.match(index,/ar-encounter\.css/);
assert.match(index,/ar-encounter\.js/);

const fetchOwners=Object.entries(files).filter(([,text])=>/window\.fetch\s*=/.test(text)).map(([name])=>name);
assert.deepEqual(fetchOwners,['public/stable-core.js'],'only stable-core may wrap window.fetch');
for(const [name,text] of Object.entries(files)){
  if(name==='public/stable-core.js')continue;
  assert.equal(/new\s+EventSource\s*\(/.test(text),false,`${name} must not create unauthenticated EventSource`);
}
assert.match(files['public/app.js'],/data-event-id/);
assert.match(files['public/app.js'],/core\.selectEvent\(obj\.id\)/);
assert.match(files['public/ui-v2.js'],/core\.state\.selectedEventId/);
assert.match(files['public/stable-core.js'],/x-telegram-init-data/);
assert.match(files['public/stable-core.js'],/getReader\(\)/);
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/start/);
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/resolve/);
assert.match(files['public/ar-encounter.js'],/mode,'study'/);
assert.match(files['public/ar-encounter.js'],/mode,'calm'/);
assert.match(files['public/ar-encounter.js'],/mode,'banish'/);

console.log('✓ stable-core loads first');
console.log('✓ single fetch owner');
console.log('✓ no unauthenticated EventSource');
console.log('✓ event selection uses eventId');
console.log('✓ authenticated streaming client');
console.log('✓ AR encounter assets and three paths are wired');
