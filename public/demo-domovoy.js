(()=>{
  const core=window.GranCore;
  if(!core)return;
  let marker=null;
  let expiresTimer=null;
  const $=s=>document.querySelector(s);

  function toast(text){
    const root=$('#toasts');
    if(!root)return;
    const el=document.createElement('div');
    el.className='toast';
    el.textContent=text;
    root.append(el);
    setTimeout(()=>el.remove(),2600);
  }

  function removeMarker(){
    clearTimeout(expiresTimer);
    if(marker){try{marker.remove()}catch{} marker=null;}
  }

  function openDomovoy(obj){
    core.state.world=[obj,...core.state.world.filter(x=>x.id!==obj.id)];
    core.selectEvent(obj.id);
    const root=$('#sheetContent'),sheet=$('#sheet'),backdrop=$('#sheetBackdrop');
    if(!root||!sheet||!backdrop)return;
    root.dataset.eventId=obj.id;
    root.innerHTML=`
      <div class="event-hero">
        <img src="/assets/creatures/domovoy.png" alt="Домовой">
        <div>
          <span class="eyebrow">Тестовая AR-встреча</span>
          <h2>Домовой</h2>
          <div class="tags"><span class="tag">Под игроком</span><span class="tag">0 м</span><span class="tag">Обычный</span></div>
          <p class="muted">Тестовый Домовой появляется при каждом Импульсе Нави и доступен для проверки новой механики.</p>
        </div>
      </div>
      <div class="event-distance-box ready">
        <div><strong>Домовой проявился рядом</strong><span>Можно сразу открыть камеру</span></div>
      </div>
      <button id="startEncounter" class="primary" style="width:100%;margin-top:12px">Проявить в камере</button>`;
    sheet.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    core.emit('sheet:event-opened',obj);
  }

  async function spawn(){
    const pos=core.state.position;
    if(!Number.isFinite(pos?.lat)||!Number.isFinite(pos?.lng)){
      toast('Сначала разрешите геолокацию');
      return;
    }
    try{
      const data=await core.api(`/api/world?lat=${pos.lat}&lng=${pos.lng}&radius=1400`);
      let obj=(data.objects||[]).find(x=>x.demoSpirit||String(x.id).startsWith('demo_domovoy_'));
      if(!obj){
        toast('Тестовый Домовой ещё не загружен сервером');
        return;
      }
      obj={...obj,lat:pos.lat,lng:pos.lng,completed:false,title:'Домовой — тест AR'};
      core.state.world=[obj,...(data.objects||[]).filter(x=>x.id!==obj.id)];
      removeMarker();
      const map=window.__granMap;
      if(map&&window.L){
        const icon=L.divIcon({
          className:'',
          html:'<button class="demo-domovoy-marker" aria-label="Тестовый Домовой"><span>⌂</span><small>Домовой</small></button>',
          iconSize:[82,82],
          iconAnchor:[41,41]
        });
        marker=L.marker([pos.lat,pos.lng],{icon,zIndexOffset:3000,interactive:true}).addTo(map);
        marker.on('click',()=>openDomovoy(obj));
        map.panTo([pos.lat,pos.lng],{animate:true});
      }
      toast('Домовой проявился прямо под вами');
      expiresTimer=setTimeout(removeMarker,65000);
    }catch(error){
      toast(error.message||'Не удалось проявить Домового');
    }
  }

  window.addEventListener('load',()=>{
    $('#navPulse')?.addEventListener('click',()=>setTimeout(spawn,120));
  });
})();
