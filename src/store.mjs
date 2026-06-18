import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve('data');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const CURRENT_VERSION = 6;

function emptyState(){
  return {
    version: CURRENT_VERSION,
    createdAt: new Date().toISOString(),
    players: {},
    worldProgress: {},
    encounters: {},
    testSpawns: {},
    market: { listings:{}, sales:[] },
    circles: {},
    districts: {},
    presence: {},
    economy: { treasury:0, worldFund:0, burned:0, totalSignsIssued:0 },
    audit: []
  };
}

function migrateState(input){
  const state = input && typeof input === 'object' ? input : emptyState();
  state.version = Number(state.version || 1);
  state.players ||= {};
  state.worldProgress ||= {};
  state.encounters ||= {};
  state.testSpawns ||= {};
  state.market ||= {listings:{},sales:[]};
  state.market.listings ||= {};
  state.market.sales ||= [];
  state.circles ||= {};
  state.presence ||= {};
  state.economy ||= {treasury:0,worldFund:0,burned:0,totalSignsIssued:0};
  state.audit ||= [];
  if(state.version < 5){
    state.districts ||= {};
    for(const player of Object.values(state.players)){
      player.flags ||= {tutorial:false};
      player.cosmetics ||= {frame:'default',scanner:'copper'};
      player.stats ||= {encounters:0,crafts:0,trades:0,riftContribution:0,distanceM:0};
    }
  }
  state.districts ||= {};
  state.version = CURRENT_VERSION;
  state.migratedAt = new Date().toISOString();
  return state;
}

export class JsonStore {
  constructor(){
    fs.mkdirSync(DATA_DIR, {recursive:true});
    if (!fs.existsSync(STATE_PATH)) fs.writeFileSync(STATE_PATH, JSON.stringify(emptyState(), null, 2));
    this.state = migrateState(this.#read());
    this.queue = Promise.resolve();
    this.dirty = false;
    fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  #read(){
    try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
    catch (error){
      const backup = `${STATE_PATH}.broken-${Date.now()}`;
      try { fs.copyFileSync(STATE_PATH, backup); } catch {}
      console.error('State file was invalid; starting a new state.', error);
      return emptyState();
    }
  }

  async transaction(fn){
    let result;
    let failure;
    this.queue = this.queue.then(async()=>{
      try {
        result = await fn(this.state);
        await this.save();
      } catch (error){ failure = error; }
    });
    await this.queue;
    if (failure) throw failure;
    return result;
  }

  async read(fn){
    await this.queue;
    return fn(this.state);
  }

  async save(){
    const temp = `${STATE_PATH}.tmp`;
    const json = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(temp, json);
    fs.renameSync(temp, STATE_PATH);
  }

  snapshot(){ return structuredClone(this.state); }

  prune(){
    const now = Date.now();
    for (const [id, presence] of Object.entries(this.state.presence)) {
      if (now - presence.updatedAt > 120_000) delete this.state.presence[id];
    }
    for (const [id, encounter] of Object.entries(this.state.encounters)) {
      if (now - encounter.createdAt > 15 * 60_000) delete this.state.encounters[id];
    }
    for (const [id, spawn] of Object.entries(this.state.testSpawns||{})) {
      if (now > Number(spawn.expiresAt||0)) delete this.state.testSpawns[id];
    }
    if (this.state.audit.length > 4000) this.state.audit = this.state.audit.slice(-2500);
    if (this.state.market.sales.length > 1000) this.state.market.sales = this.state.market.sales.slice(-700);
  }
}

export const store = new JsonStore();