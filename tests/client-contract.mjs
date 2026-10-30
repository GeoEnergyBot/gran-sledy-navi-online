import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files={};
const server=await readFile(path.join(root,'server.mjs'),'utf8');
for(const name of ['public/index.html','public/stable-core.js','public/app.js','public/sw.js','public/ui-v2.css','public/ui-v2.js','public/onboarding.js','public/map-enhancements.js','public/journey.css','public/journey.js','public/district.js','public/ar-encounter.js','public/pulse-random-spirit.js']){
  files[name]=await readFile(path.join(root,name),'utf8');
}
const index=files['public/index.html'];
assert.ok(index.indexOf('/stable-core.js')<index.indexOf('/ui-v2.js'),'stable-core must load before UI');
assert.ok(index.indexOf('/stable-core.js')<index.indexOf('/app.js'),'stable-core must load before app');
assert.match(index,/ar-encounter\.css/);
assert.match(index,/ar-encounter\.js/);
assert.match(index,/pulse-random-spirit\.js/);
assert.match(index,/app\.js\?v=8/,'gameplay client changes must advance the cache-busting version');
assert.match(index,/journey\.js\?v=5/);
assert.match(index,/journey\.css\?v=4/);
assert.match(files['public/sw.js'],/gran-shell-v23/,'service worker cache must change when the shell is updated');
assert.match(files['public/sw.js'],/app\.js\?v=8/,'service worker must precache the current client version');
assert.match(files['public/sw.js'],/journey\.js\?v=5/);
assert.match(files['public/sw.js'],/onboarding\.js\?v=4/);
assert.doesNotMatch(files['public/ui-v2.css'],/\.journey-card\{display:none!important\}/,'the first expedition card must remain visible');
assert.doesNotMatch(files['public/onboarding.js'],/showOnboarding|coachPulse|firstSessionHint/,'duplicate tutorial overlays must stay removed');
assert.doesNotMatch(files['public/app.js'],/showTutorial/,'legacy welcome modal must stay removed');
assert.match(files['public/journey.js'],/GPS можно включить отдельно/);
assert.match(files['public/journey.js'],/journey:open-event/);
assert.match(files['public/journey.js'],/journey:refresh-world/);
assert.match(files['public/journey.css'],/journey-progress\{display:grid;grid-template-columns:repeat\(4,1fr\)/,'journey progress must fit all four steps');
assert.doesNotMatch(index,/demo-domovoy/);

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
assert.match(server,/referrer-policy':'strict-origin-when-cross-origin'/,'static pages must send an origin referrer to OpenStreetMap tiles');
assert.doesNotMatch(server,/referrer-policy':'same-origin'/,'same-origin suppresses the cross-origin Referer required by OpenStreetMap');
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/start/);
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/resolve/);
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/rune-check/);
assert.match(files['public/ar-encounter.js'],/\/api\/spirit\/study-check/);
assert.match(files['public/ar-encounter.js'],/data-drop-kind/);
assert.match(files['public/ar-encounter.js'],/finish\('study'/);
assert.match(files['public/ar-encounter.js'],/finish\('calm'/);
assert.match(files['public/ar-encounter.js'],/finish\('banish'/);
assert.doesNotMatch(files['public/ar-encounter.js'],/creatureId!=='domovoy'/);
assert.match(files['public/map-enhancements.js'],/isCreature\?30:140/);
assert.match(files['public/pulse-random-spirit.js'],/\/api\/test\/spirit-spawn/);

console.log('✓ stable-core loads first');
console.log('✓ single fetch owner');
console.log('✓ no unauthenticated EventSource');
console.log('✓ event selection uses eventId');
console.log('✓ authenticated streaming client');
console.log('✓ drag-and-drop rune and research actions are wired');
console.log('✓ every Navi pulse requests one random test creature');
