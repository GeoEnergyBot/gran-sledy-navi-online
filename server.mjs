import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from './src/store.mjs';
import { resolveIdentity } from './src/telegram.mjs';
import {
  ensurePlayer, bootstrap, worldNearby, heartbeat, startEncounter, resolveEncounter,
  craft, equip, claimQuest, upgradeShelter, marketListings, createListing, cancelListing,
  buyListing, createCircle, joinCircle, getCircle, cryptoStatus, httpError
} from './src/game-engine.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const env = {
  PORT:Number(process.env.PORT||8080), HOST:process.env.HOST||'0.0.0.0',
  DEMO_MODE:String(process.env.DEMO_MODE||'1')==='1', BOT_TOKEN:process.env.BOT_TOKEN||''
};
const clients = new Set();
const rate = new Map();

const mime = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg'
};

function json(res,status,data){
  const body=JSON.stringify(data);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(body)}); res.end(body);
}
function broadcast(type,data){
  const payload=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for(const c of [...clients]) { try{c.write(payload);}catch{clients.delete(c);} }
}
function readJson(req,limit=200_000){
  return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(httpError(413,'Слишком большой запрос'));req.destroy();}else chunks.push(c);});req.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{});}catch{reject(httpError(400,'Некорректный JSON'));}});req.on('error',reject);});
}
function allow(req,identity){
  const key=`${identity?.id||req.socket.remoteAddress}:${Math.floor(Date.now()/10000)}`;
  const n=(rate.get(key)||0)+1;rate.set(key,n);
  if(rate.size>5000)for(const k of [...rate.keys()].slice(0,2500))rate.delete(k);
  return n<80;
}
function auth(req){
  const identity=resolveIdentity(req,env); if(!identity) throw httpError(401,'Требуется авторизация Telegram'); if(!allow(req,identity))throw httpError(429,'Слишком много запросов'); return identity;
}
function pathSafe(urlPath){
  const decoded=decodeURIComponent(urlPath.split('?')[0]); const rel=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
  const full=path.normalize(path.join(PUBLIC,rel)); return full.startsWith(PUBLIC)?full:null;
}
function serveStatic(req,res){
  const full=pathSafe(req.url); if(!full)return json(res,403,{error:'Forbidden'});
  fs.stat(full,(err,stat)=>{
    if(err||!stat.isFile())return json(res,404,{error:'Not found'});
    const ext=path.extname(full).toLowerCase();
    const headers={'content-type':mime[ext]||'application/octet-stream','x-content-type-options':'nosniff','referrer-policy':'same-origin'};
    if(/\.(png|gif|jpg|jpeg|svg|mp3)$/.test(ext))headers['cache-control']='public, max-age=86400'; else headers['cache-control']='no-cache';
    res.writeHead(200,headers);fs.createReadStream(full).pipe(res);
  });
}

async function api(req,res,url){
  const identity=auth(req);
  const method=req.method||'GET';
  if(method==='GET'&&url.pathname==='/api/stream'){
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
    res.write(`event: connected\ndata: {"time":${Date.now()}}\n\n`); clients.add(res); const ping=setInterval(()=>{try{res.write(': ping\n\n');}catch{}},25000);
    req.on('close',()=>{clearInterval(ping);clients.delete(res);});return;
  }
  const result=await store.transaction(async state=>{
    store.prune(); const p=ensurePlayer(state,identity);
    if(method==='GET'&&url.pathname==='/api/bootstrap')return bootstrap(state,p);
    if(method==='GET'&&url.pathname==='/api/world')return {objects:worldNearby(state,p,Number(url.searchParams.get('lat')),Number(url.searchParams.get('lng')),Number(url.searchParams.get('radius')||1600))};
    if(method==='POST'&&url.pathname==='/api/heartbeat'){const body=await readJson(req);return heartbeat(state,p,body.lat,body.lng);}
    if(method==='POST'&&url.pathname==='/api/encounters/start'){const body=await readJson(req);return startEncounter(state,p,body);}
    if(method==='POST'&&url.pathname==='/api/encounters/resolve'){const body=await readJson(req);const out=resolveEncounter(state,p,body);if(out.reward?.shared)broadcast('rift:update',{eventId:out.reward.eventId,...out.reward.shared});return out;}
    if(method==='POST'&&url.pathname==='/api/craft'){const body=await readJson(req);return craft(state,p,body.recipeId);}
    if(method==='POST'&&url.pathname==='/api/equip'){const body=await readJson(req);return {player:equip(state,p,body)};}
    if(method==='POST'&&url.pathname==='/api/quests/claim'){const body=await readJson(req);return claimQuest(state,p,body.questId);}
    if(method==='POST'&&url.pathname==='/api/shelter/upgrade'){const body=await readJson(req);return upgradeShelter(state,p,body.key);}
    if(method==='GET'&&url.pathname==='/api/market')return {listings:marketListings(state,{itemId:url.searchParams.get('itemId')||undefined})};
    if(method==='POST'&&url.pathname==='/api/market/list'){const body=await readJson(req);const listing=createListing(state,p,body);broadcast('market:update',{action:'listed',listing});return {listing,player:bootstrap(state,p).player};}
    if(method==='POST'&&url.pathname==='/api/market/cancel'){const body=await readJson(req);const player=cancelListing(state,p,body.listingId);broadcast('market:update',{action:'cancelled',listingId:body.listingId});return {player};}
    if(method==='POST'&&url.pathname==='/api/market/buy'){const body=await readJson(req);const out=buyListing(state,p,body.listingId);broadcast('market:update',{action:'sold',listingId:body.listingId});return out;}
    if(method==='GET'&&url.pathname==='/api/circle')return {circle:getCircle(state,p)};
    if(method==='POST'&&url.pathname==='/api/circle/create'){const body=await readJson(req);const circle=createCircle(state,p,body);broadcast('circle:update',{circleId:circle.id});return {circle,player:bootstrap(state,p).player};}
    if(method==='POST'&&url.pathname==='/api/circle/join'){const body=await readJson(req);const circle=joinCircle(state,p,body);broadcast('circle:update',{circleId:circle.id});return {circle:getCircle(state,p),player:bootstrap(state,p).player};}
    if(method==='GET'&&url.pathname==='/api/crypto/status')return cryptoStatus();
    throw httpError(404,'Маршрут не найден');
  });
  json(res,200,result);
}

const server=http.createServer(async(req,res)=>{
  try{
    res.setHeader('x-frame-options','SAMEORIGIN');
    res.setHeader('permissions-policy','geolocation=(self), camera=(self), accelerometer=(self), gyroscope=(self)');
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/health'){
      return json(res,200,{ok:true,service:'gran-sledy-navi',time:Date.now(),demoMode:env.DEMO_MODE});
    }
    if(url.pathname.startsWith('/api/'))await api(req,res,url);else serveStatic(req,res);
  }catch(error){console.error(error);json(res,error.status||500,{error:error.message||'Внутренняя ошибка'});}
});
server.listen(env.PORT,env.HOST,()=>console.log(`Грань: Следы Нави — http://${env.HOST}:${env.PORT} (demo=${env.DEMO_MODE})`));
