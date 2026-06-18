import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from './src/store.mjs';
import { resolveIdentity } from './src/telegram.mjs';
import { getDistrict, publicDistrict, contributeToDistrict } from './src/districts.mjs';
import { startSpiritEncounter, resolveSpiritEncounter, spiritProfile } from './src/spirit-interactions.mjs';
import {
  ensurePlayer, bootstrap, worldNearby, heartbeat, startEncounter, resolveEncounter,
  craft, equip, claimQuest, upgradeShelter, marketListings, createListing, cancelListing,
  buyListing, createCircle, joinCircle, getCircle, cryptoStatus, httpError
} from './src/game-engine.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.join(ROOT,'public');
const VERSION='0.6.0';
const env={PORT:Number(process.env.PORT||8080),HOST:process.env.HOST||'0.0.0.0',DEMO_MODE:String(process.env.DEMO_MODE||'1')==='1',BOT_TOKEN:process.env.BOT_TOKEN||''};
const clients=new Set(),rate=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg'};
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(body)});res.end(body)}
function broadcast(type,data){const payload=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const client of [...clients]){if(client.destroyed||client.writableEnded){clients.delete(client);continue}try{client.write(payload)}catch{clients.delete(client)}}}
function readJson(req,limit=200000){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(httpError(413,'Слишком большой запрос'));req.destroy()}else chunks.push(c)});req.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{})}catch{reject(httpError(400,'Некорректный JSON'))}});req.on('error',reject)})}
function allow(req,identity){const key=`${identity?.id||req.socket.remoteAddress}:${Math.floor(Date.now()/10000)}`,n=(rate.get(key)||0)+1;rate.set(key,n);if(rate.size>5000)for(const k of [...rate.keys()].slice(0,2500))rate.delete(k);return n<80}
function auth(req){const identity=resolveIdentity(req,env);if(!identity)throw httpError(401,'Требуется авторизация Telegram');if(!allow(req,identity))throw httpError(429,'Слишком много запросов');return identity}
function parseCoords(a,b){const lat=Number(a),lng=Number(b);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)throw httpError(400,'Некорректные координаты');return {lat,lng}}
function pathSafe(urlPath){const decoded=decodeURIComponent(urlPath.split('?')[0]),rel=decoded==='/'?'index.html':decoded.replace(/^\/+/,''),full=path.normalize(path.join(PUBLIC,rel));return full.startsWith(PUBLIC)?full:null}
function serveStatic(req,res){const full=pathSafe(req.url);if(!full)return json(res,403,{error:'Forbidden'});fs.stat(full,(err,stat)=>{if(err||!stat.isFile())return json(res,404,{error:'Not found'});const ext=path.extname(full).toLowerCase(),headers={'content-type':mime[ext]||'application/octet-stream','x-content-type-options':'nosniff','referrer-policy':'same-origin'};headers['cache-control']=/\.(png|gif|jpg|jpeg|svg|mp3)$/.test(ext)?'public, max-age=86400':'no-cache';res.writeHead(200,headers);fs.createReadStream(full).pipe(res)})}

async function api(req,res,url){
  const identity=auth(req),method=req.method||'GET';
  if(method==='GET'&&url.pathname==='/api/stream'){
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
    res.write(`event: connected\ndata: {"time":${Date.now()},"version":"${VERSION}"}\n\n`);clients.add(res);
    const ping=setInterval(()=>{if(res.destroyed||res.writableEnded){clearInterval(ping);clients.delete(res);return}try{res.write(`event: ping\ndata: {"time":${Date.now()}}\n\n`)}catch{clearInterval(ping);clients.delete(res)}},25000);
    req.on('close',()=>{clearInterval(ping);clients.delete(res)});return;
  }
  const result=await store.transaction(async state=>{
    store.prune();const p=ensurePlayer(state,identity);
    if(method==='GET'&&url.pathname==='/api/bootstrap'){const out=bootstrap(state,p);out.spiritProgress=spiritProfile(p);return out}
    if(method==='GET'&&url.pathname==='/api/world'){
      const {lat,lng}=parseCoords(url.searchParams.get('lat'),url.searchParams.get('lng'));
      return {objects:worldNearby(state,p,lat,lng,Number(url.searchParams.get('radius')||1600)),district:publicDistrict(getDistrict(state,lat,lng))};
    }
    if(method==='GET'&&url.pathname==='/api/district'){const {lat,lng}=parseCoords(url.searchParams.get('lat'),url.searchParams.get('lng'));return {district:publicDistrict(getDistrict(state,lat,lng))}}
    if(method==='POST'&&url.pathname==='/api/heartbeat'){const body=await readJson(req),{lat,lng}=parseCoords(body.lat,body.lng);return heartbeat(state,p,lat,lng)}
    if(method==='POST'&&url.pathname==='/api/spirit/start'){const body=await readJson(req);parseCoords(body.lat,body.lng);return startSpiritEncounter(state,p,body)}
    if(method==='POST'&&url.pathname==='/api/spirit/resolve'){
      const body=await readJson(req),challenge=state.encounters[body.challengeId],out=resolveSpiritEncounter(state,p,body);
      if(out.success&&challenge?.obj){const districtResult=contributeToDistrict(state,p,{lat:challenge.obj.lat,lng:challenge.obj.lng,choice:body.mode==='calm'?'calm':body.mode==='banish'?'banish':'study',eventType:challenge.obj.type,amount:out.reward?.contribution||1});out.district=districtResult.district;out.districtContribution=districtResult.contribution;broadcast('district:update',{districtId:districtResult.district.id,district:districtResult.district,resolvedNow:districtResult.resolvedNow})}
      return out;
    }
    if(method==='POST'&&url.pathname==='/api/encounters/start'){const body=await readJson(req);parseCoords(body.lat,body.lng);return startEncounter(state,p,body)}
    if(method==='POST'&&url.pathname==='/api/encounters/resolve'){const body=await readJson(req),challenge=state.encounters[body.challengeId],out=resolveEncounter(state,p,body);if(out.success&&challenge?.obj){const districtResult=contributeToDistrict(state,p,{lat:challenge.obj.lat,lng:challenge.obj.lng,choice:body.choice,eventType:challenge.obj.type,amount:out.reward?.contribution||1});out.district=districtResult.district;out.districtContribution=districtResult.contribution;broadcast('district:update',{districtId:districtResult.district.id,district:districtResult.district,resolvedNow:districtResult.resolvedNow})}if(out.reward?.shared)broadcast('rift:update',{eventId:out.reward.eventId,...out.reward.shared});return out}
    if(method==='POST'&&url.pathname==='/api/craft'){const body=await readJson(req);return craft(state,p,body.recipeId)}
    if(method==='POST'&&url.pathname==='/api/equip'){const body=await readJson(req);return {player:equip(state,p,body)}}
    if(method==='POST'&&url.pathname==='/api/quests/claim'){const body=await readJson(req);return claimQuest(state,p,body.questId)}
    if(method==='POST'&&url.pathname==='/api/shelter/upgrade'){const body=await readJson(req);return upgradeShelter(state,p,body.key)}
    if(method==='GET'&&url.pathname==='/api/market')return {listings:marketListings(state,{itemId:url.searchParams.get('itemId')||undefined})};
    if(method==='POST'&&url.pathname==='/api/market/list'){const body=await readJson(req),listing=createListing(state,p,body);broadcast('market:update',{action:'listed',listing});return {listing,player:bootstrap(state,p).player}}
    if(method==='POST'&&url.pathname==='/api/market/cancel'){const body=await readJson(req),player=cancelListing(state,p,body.listingId);broadcast('market:update',{action:'cancelled',listingId:body.listingId});return {player}}
    if(method==='POST'&&url.pathname==='/api/market/buy'){const body=await readJson(req),out=buyListing(state,p,body.listingId);broadcast('market:update',{action:'sold',listingId:body.listingId});return out}
    if(method==='GET'&&url.pathname==='/api/circle')return {circle:getCircle(state,p)};
    if(method==='POST'&&url.pathname==='/api/circle/create'){const body=await readJson(req),circle=createCircle(state,p,body);broadcast('circle:update',{circleId:circle.id});return {circle,player:bootstrap(state,p).player}}
    if(method==='POST'&&url.pathname==='/api/circle/join'){const body=await readJson(req),circle=joinCircle(state,p,body);broadcast('circle:update',{circleId:circle.id});return {circle:getCircle(state,p),player:bootstrap(state,p).player}}
    if(method==='GET'&&url.pathname==='/api/crypto/status')return cryptoStatus();
    throw httpError(404,'Маршрут не найден');
  });
  json(res,200,result);
}

const server=http.createServer(async(req,res)=>{
  try{
    res.setHeader('x-frame-options','SAMEORIGIN');res.setHeader('permissions-policy','geolocation=(self), camera=(self), accelerometer=(self), gyroscope=(self)');res.setHeader('x-app-version',VERSION);
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/health')return json(res,200,{ok:true,service:'gran-sledy-navi',version:VERSION,time:Date.now(),demoMode:env.DEMO_MODE,realtimeClients:clients.size});
    if(url.pathname.startsWith('/api/'))await api(req,res,url);else serveStatic(req,res);
  }catch(error){console.error(error);json(res,error.status||500,{error:error.message||'Внутренняя ошибка'})}
});
server.listen(env.PORT,env.HOST,()=>console.log(`Грань: Следы Нави ${VERSION} — http://${env.HOST}:${env.PORT} (demo=${env.DEMO_MODE})`));