import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'gran-test-'));
const port = 18000 + Math.floor(Math.random() * 1000);
const serverFile = path.join(root, 'server.mjs');

let serverOutput = '';
const child = spawn(process.execPath, [serverFile], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    DEMO_MODE: '1',
    WORLD_SEED: 'smoke-world',
    DATA_DIR: temp
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

child.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
child.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const base = `http://127.0.0.1:${port}`;
const headers = id => ({
  'content-type': 'application/json',
  'x-player-id': id,
  'x-player-name': id
});

async function request(id, url, body) {
  const response = await fetch(base + url, {
    method: body ? 'POST' : 'GET',
    headers: headers(id),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error}`);
  return data;
}

async function waitForServer() {
  let lastError;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) {
      throw new Error(`Сервер завершился до запуска (код ${child.exitCode}).\n${serverOutput}`);
    }
    try {
      const response = await fetch(base + '/health');
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Сервер не запустился за 8 секунд.\n${serverOutput}\n${lastError || ''}`);
}

try {
  await waitForServer();

  const a = await request('alpha', '/api/bootstrap');
  assert.equal(a.player.signs, 80);
  assert.equal(a.catalog.creatures.length, 12);

  const worldA = await request('alpha', '/api/world?lat=43.238949&lng=76.889709&radius=1200');
  const worldB = await request('beta', '/api/world?lat=43.238949&lng=76.889709&radius=1200');
  assert.ok(worldA.objects.length > 10);
  assert.deepEqual(worldA.objects.map(x => x.id), worldB.objects.map(x => x.id));
  assert.ok(worldA.district?.id);
  assert.equal(worldA.district.id, worldB.district.id);
  const initialDistrictProgress = worldA.district.threat.progress;

  const obj = worldA.objects[0];
  const started = await request('alpha', '/api/encounters/start', {
    eventId: obj.id,
    lat: obj.lat,
    lng: obj.lng
  });
  const resolved = await request('alpha', '/api/encounters/resolve', {
    challengeId: started.challengeId,
    score: 1,
    choice: 'study'
  });
  assert.equal(resolved.success, true);
  assert.ok(resolved.districtContribution > 0);
  assert.ok(resolved.district.threat.progress > initialDistrictProgress);

  const district = await request('alpha', `/api/district?lat=${obj.lat}&lng=${obj.lng}`);
  assert.equal(district.district.id, resolved.district.id);
  assert.ok(district.district.history.length > 1);

  const crafted = await request('alpha', '/api/craft', { recipeId: 'craft_chalk' });
  assert.ok(crafted.player.inventory.chalk >= 2);

  const lot = await request('alpha', '/api/market/list', { itemId: 'ash', qty: 1, price: 10 });
  const bought = await request('beta', '/api/market/buy', { listingId: lot.listing.id });
  assert.equal(bought.buyer.signs, 70);
  assert.ok(bought.buyer.inventory.ash >= 7);

  const circle = await request('alpha', '/api/circle/create', { name: 'Тестовый Круг' });
  assert.ok(circle.circle.code);
  const joined = await request('beta', '/api/circle/join', { code: circle.circle.code });
  assert.equal(joined.circle.members.length, 2);

  console.log('✓ bootstrap/catalog');
  console.log('✓ deterministic shared world');
  console.log('✓ living district progression');
  console.log('✓ encounter/rewards');
  console.log('✓ crafting');
  console.log('✓ marketplace commission and transfer');
  console.log('✓ multiplayer circle');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    setTimeout(resolve, 1500);
  });
  await rm(temp, { recursive: true, force: true });
}