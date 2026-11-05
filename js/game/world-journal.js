'use strict';

// Personal in-world exploration log. Stored with the current WebCraft world.
// Coordinates are game blocks, never device or real-world location.
const WorldJournal = (() => {
  const NAMES={
    plains:'평원',forest:'숲',jungle:'정글',swamp:'늪지대',
    taiga:'침엽수림',snowy:'설산',desert:'사막',highland:'고지대'
  };
  const keys=Object.keys(NAMES);
  const MAX_DISTANCE=10;
  let visited=[],distance=0,lastPosition=null,open=false,discovered=null,onClose=null,home=null;
  function init(saved) {
    visited=[];distance=0;lastPosition=null;open=false;discovered=null;home=null;
    if(saved && typeof saved==='object') {
      if(saved.home&&['x','y','z'].every(k=>Number.isFinite(saved.home[k])&&Math.abs(saved.home[k])<10000000))
        home={x:Math.floor(saved.home.x),y:Math.floor(saved.home.y),z:Math.floor(saved.home.z)};
      if(Number.isFinite(saved.distance))distance=Math.max(0,Math.min(100000000,saved.distance));
      if(Array.isArray(saved.visited))for(const v of saved.visited.slice(0,keys.length)){
        if(!v||!keys.includes(v.biome)||visited.some(x=>x.biome===v.biome))continue;
        const x=Number.isFinite(v.x)?Math.trunc(v.x):0;
        const z=Number.isFinite(v.z)?Math.trunc(v.z):0;
        visited.push({biome:v.biome,x,z});
      }
    }
    document.getElementById('overlay-journal')?.classList.add('hidden');
  }
  function update(dt,pos,biome) {
    if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.z))return false;
    if(lastPosition){
      const dx=pos.x-lastPosition.x,dz=pos.z-lastPosition.z;
      const moved=Math.hypot(dx,dz);
      if(moved>0&&moved<MAX_DISTANCE)distance+=moved;
    }
    lastPosition={x:pos.x,z:pos.z};
    if(keys.includes(biome)&&!visited.some(item=>item.biome===biome)){
      const entry={biome,x:Math.floor(pos.x),z:Math.floor(pos.z)};
      visited.push(entry);
      discovered=entry;
      if(open)render();
      return entry;
    }
    if(open)render();
    return false;
  }
  function serialize() {
    return {version:2,distance:Math.round(distance*10)/10,
      home:home?{...home}:null,visited:visited.map(v=>({...v}))};
  }
  function setHome(pos){
    if(!pos || !['x','y','z'].every(k=>Number.isFinite(pos[k])))return false;
    home={x:Math.floor(pos.x),y:Math.floor(pos.y),z:Math.floor(pos.z)};
    if(open)render();
    return true;
  }
  function homeDistance(pos){
    return home && pos ? Math.round(Math.hypot(pos.x-home.x,pos.z-home.z)) : null;
  }
  function getStats(){return {distance:Math.floor(distance),found:visited.length,
    total:keys.length,home:home?{...home}:null,
    homeDistance:homeDistance(lastPosition),visited:visited.map(v=>({...v}))};}
  function biomeName(id){return NAMES[id]||id||'알 수 없음';}
  function render(){
    const list=document.getElementById('journal-biomes');
    if(!list)return;
    const counts=document.getElementById('journal-summary');
    const entries=visited.map(v=>v.biome);
    if(counts)counts.textContent='발견 '+visited.length+' / '+keys.length+' 바이옴 · 이동 '+Math.round(distance)+' 블록';
    const homeInfo=document.getElementById('journal-home');
    if(homeInfo)homeInfo.textContent=home
      ? '집 위치 · X '+home.x+' / Y '+home.y+' / Z '+home.z+
        (lastPosition?' · 현재 '+homeDistance(lastPosition)+'블록 거리':'')
      : '아직 집으로 지정한 장소가 없습니다.';
    list.replaceChildren();
    for(const biome of keys){
      const found=entries.includes(biome);
      const box=document.createElement('div');
      box.className='journal-biome'+(found?' discovered':' undiscovered');
      const name=document.createElement('strong');
      name.textContent=found?'◆ '+NAMES[biome]:'◇ 미발견 지역';
      const caption=document.createElement('small');
      const entry=visited.find(v=>v.biome===biome);
      caption.textContent=found?'처음 발견: X '+entry.x+' · Z '+entry.z:'탐험을 계속하면 기록돼요';
      box.append(name,caption);list.appendChild(box);
    }
  }
  function show(){
    open=true;render();
    document.getElementById('overlay-journal')?.classList.remove('hidden');
    return true;
  }
  function close(notify=true) {
    if(!open)return false;
    open=false;
    document.getElementById('overlay-journal')?.classList.add('hidden');
    if(notify&&onClose)onClose();
    return true;
  }
  function isOpen(){return open;}
  function setOnClose(fn){onClose=typeof fn==='function'?fn:null;}
  return {init,update,serialize,getStats,biomeName,show,close,isOpen,setOnClose,setHome,homeDistance,render};
})();
