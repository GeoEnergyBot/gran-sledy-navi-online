(()=>{
  if(window.GranCore)return;
  const tg=window.Telegram?.WebApp;
  const tgUser=tg?.initDataUnsafe?.user;
  let guestId=localStorage.getItem('gran_player_id');
  if(!guestId){guestId=crypto.randomUUID();localStorage.setItem('gran_player_id',guestId)}
  const identity={
    id:String(tgUser?.id||guestId),
    name:tgUser?.first_name||localStorage.getItem('gran_name')||'Проводник',
    initData:tg?.initData||''
  };
  const listeners=new Map();
  const state={world:[],district:null,player:null,position:{lat:43.238949,lng:76.889709},selectedEventId:null,routeEventId:null,realtime:'idle'};
  const nativeFetch=window.fetch.bind(window);

  function on(type,fn){
    if(!listeners.has(type))listeners.set(type,new Set());
    listeners.get(type).add(fn);
    return()=>listeners.get(type)?.delete(fn);
  }
  function emit(type,payload){
    for(const fn of listeners.get(type)||[]){try{fn(payload)}catch(error){console.error(`[GranCore:${type}]`,error)}}
    window.dispatchEvent(new CustomEvent(`gran:${type}`,{detail:payload}));
  }
  function authHeaders(extra={}){
    const headers={'content-type':'application/json','x-player-id':identity.id,'x-player-name':identity.name,...extra};
    if(identity.initData)headers['x-telegram-init-data']=identity.initData;
    return headers;
  }
  function classify(path){
    try{return new URL(path,location.origin).pathname}catch{return String(path)}
  }
  async function coreFetch(input,options={}){
    const path=classify(typeof input==='string'?input:input.url);
    const requestOptions={...options,headers:authHeaders(options.headers||{})};
    const response=await nativeFetch(input,requestOptions);
    if(path.startsWith('/api/')&&path!=='/api/stream'){
      try{
        const data=await response.clone().json();
        emit('api:response',{path,status:response.status,ok:response.ok,data});
        if(path==='/api/bootstrap'&&data.player){state.player=data.player;emit('player:updated',data.player)}
        if(path==='/api/world'){
          state.world=Array.isArray(data.objects)?data.objects:[];
          if(data.district)state.district=data.district;
          emit('world:loaded',data);
          if(data.district)emit('district:updated',data.district);
        }
        if(path==='/api/district'&&data.district){state.district=data.district;emit('district:updated',data.district)}
        if(path==='/api/encounters/resolve'&&data.district){state.district=data.district;emit('district:contribution',{district:data.district,amount:data.districtContribution||0})}
      }catch{}
    }
    return response;
  }
  window.fetch=coreFetch;

  async function api(path,options={}){
    const response=await coreFetch(path,options);
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Ошибка ${response.status}`);
    return data;
  }
  function post(path,body){return api(path,{method:'POST',body:JSON.stringify(body)})}
  function setPosition(position){
    if(!Number.isFinite(position?.lat)||!Number.isFinite(position?.lng))return;
    state.position={lat:Number(position.lat),lng:Number(position.lng)};
    emit('position:updated',state.position);
  }
  function selectEvent(eventId){state.selectedEventId=eventId||null;emit('event:selected',state.selectedEventId)}

  let streamAbort=null,retryTimer=null,retryMs=1500;
  async function connectRealtime(){
    if(streamAbort)return;
    streamAbort=new AbortController();state.realtime='connecting';emit('realtime:status',state.realtime);
    try{
      const response=await nativeFetch('/api/stream',{headers:authHeaders({'accept':'text/event-stream'}),signal:streamAbort.signal});
      if(!response.ok)throw new Error(`Realtime ${response.status}`);
      state.realtime='connected';retryMs=1500;emit('realtime:status',state.realtime);
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){
        const {done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        const frames=buffer.split('\n\n');buffer=frames.pop()||'';
        for(const frame of frames){
          let event='message',data='';
          for(const line of frame.split('\n')){
            if(line.startsWith('event:'))event=line.slice(6).trim();
            else if(line.startsWith('data:'))data+=line.slice(5).trim();
          }
          if(!data)continue;
          try{
            const payload=JSON.parse(data);
            emit(`realtime:${event}`,payload);
            if(event==='district:update'&&payload.district){state.district=payload.district;emit('district:updated',payload.district)}
          }catch{}
        }
      }
      throw new Error('Realtime stream closed');
    }catch(error){
      if(streamAbort?.signal.aborted)return;
      state.realtime='disconnected';emit('realtime:status',state.realtime);
      streamAbort=null;
      clearTimeout(retryTimer);retryTimer=setTimeout(connectRealtime,retryMs);retryMs=Math.min(15000,Math.round(retryMs*1.7));
    }
  }
  function disconnectRealtime(){clearTimeout(retryTimer);streamAbort?.abort();streamAbort=null;state.realtime='idle';emit('realtime:status',state.realtime)}

  window.GranCore={identity,state,on,emit,api,post,setPosition,selectEvent,connectRealtime,disconnectRealtime,authHeaders};
  window.addEventListener('load',()=>connectRealtime(),{once:true});
})();
