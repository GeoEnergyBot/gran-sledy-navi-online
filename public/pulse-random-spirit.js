(()=>{
  const core=window.GranCore;if(!core)return;
  const $=s=>document.querySelector(s);
  let marker=null,timer=null,current=null,busy=false;
  const rarityColor={common:'#8adbb0',uncommon:'#7dc8ff',rare:'#c693ff',epic:'#ff9f72',legendary:'#ffd76f'};
  function toast(text,error=false){const root=$('#toasts');if(!root)return;const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=text;root.append(el);setTimeout(()=>el.remove(),2800)}
  function clearSpawn(){clearTimeout(timer);if(marker){try{marker.remove()}catch{}marker=null}if(current)core.state.world=core.state.world.filter(x=>x.id!==current.id);current=null}
  function showCard(obj){
    core.selectEvent(obj.id);
    const root=$('#sheetContent'),sheet=$('#sheet'),backdrop=$('#sheetBackdrop');if(!root||!sheet||!backdrop)return;
    root.dataset.eventId=obj.id;
    root.innerHTML=`<div class="event-hero"><img src="/assets/creatures/${obj.creatureId}.${obj.creatureId==='nochnitsa'?'gif':'png'}" alt=""><div><span class="eyebrow">Случайная тестовая встреча</span><h2>${obj.title.replace(' — тест встречи','')}</h2><div class="tags"><span class="tag">0 м</span><span class="tag">${obj.rarity}</span><span class="tag">AR</span></div><p class="muted">Существо вызвано Импульсом Нави для проверки всех механик взаимодействия.</p></div></div><div class="event-distance-box ready"><div><strong>Существо прямо рядом</strong><span>Можно начать AR-встречу</span></div></div><button id="startEncounter" class="primary" style="width:100%;margin-top:12px">Проявить в камере</button>`;
    sheet.classList.remove('hidden');backdrop.classList.remove('hidden');core.emit('sheet:event-opened',obj);
  }
  async function spawn(){
    if(busy)return;busy=true;
    try{
      const pos=core.state.position;
      if(!Number.isFinite(pos?.lat)||!Number.isFinite(pos?.lng))throw new Error('Сначала разрешите геолокацию');
      const data=await core.post('/api/test/spirit-spawn',pos),obj=data.object;
      clearSpawn();current=obj;core.state.world=[obj,...core.state.world.filter(x=>x.id!==obj.id)];
      const map=window.__granMap;
      if(map&&window.L){
        const color=rarityColor[obj.rarity]||'#8adbb0';
        const icon=L.divIcon({className:'',html:`<button class="pulse-test-spirit" style="--spirit-color:${color}" aria-label="${obj.title}"><span>◉</span><small>${obj.title.replace(' — тест встречи','')}</small></button>`,iconSize:[94,94],iconAnchor:[47,47]});
        marker=L.marker([obj.lat,obj.lng],{icon,zIndexOffset:3500,interactive:true}).addTo(map);marker.on('click',()=>showCard(obj));map.panTo([obj.lat,obj.lng],{animate:true});
      }
      toast(`Проявился: ${obj.title.replace(' — тест встречи','')}`);
      timer=setTimeout(clearSpawn,90000);
    }catch(error){toast(error.message||'Не удалось вызвать существо',true)}finally{busy=false}
  }
  window.addEventListener('load',()=>$('#navPulse')?.addEventListener('click',()=>setTimeout(spawn,140)));
})();