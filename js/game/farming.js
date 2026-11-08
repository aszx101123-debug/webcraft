'use strict';

const Farming = (() => {
  const crops=new Map(),foraged=new Map();
  const MAX_CROPS=1024,MAX_FORAGE=2048;
  let unsubscribe=null,elapsed=0;
  const key=(x,y,z)=>x+','+y+','+z;
  const valid=p=>p.length===3&&p.every(Number.isInteger)&&Math.abs(p[0])<1000000&&Math.abs(p[2])<1000000&&p[1]>0&&p[1]<CONFIG.HEIGHT-1;
  const stage=state=>state?Math.min(3,Math.floor(state.progress/CROP_TYPES[state.id].seconds*3)):0;

  function init(saved) {
    unsubscribe?.();crops.clear();foraged.clear();elapsed=0;
    if(saved?.version===1){
      for(const entry of (Array.isArray(saved.crops)?saved.crops:[]).slice(0,MAX_CROPS)){
        if(!Array.isArray(entry)||typeof entry[0]!=='string'||!valid(entry[0].split(',').map(Number)))continue;
        const state=entry[1],def=Number.isInteger(state?.id)&&CROP_TYPES[state.id];
        if(def&&Number.isFinite(state.progress))crops.set(entry[0],{id:state.id,progress:Math.max(0,Math.min(def.seconds,state.progress))});
      }
      for(const entry of (Array.isArray(saved.foraged)?saved.foraged:[]).slice(0,MAX_FORAGE)){
        if(Array.isArray(entry)&&typeof entry[0]==='string'&&valid(entry[0].split(',').map(Number))&&Number.isFinite(entry[1])&&entry[1]>0)
          foraged.set(entry[0],Math.min(90,entry[1]));
      }
    }
    unsubscribe=World.onBlockChanged((x,y,z,id,old)=>{
      const k=key(x,y,z);
      if(CROP_TYPES[old]&&old!==id){
        const state=crops.get(k)||{id:old,progress:0};crops.delete(k);
        if(!Inventory.isCreative())for(const stack of yields(state))Drops.spawn(stack.id,stack.count,x+.5,y+.3,z+.5);
      }
      if(CROP_TYPES[id]&&!crops.has(k))crops.set(k,{id,progress:0});
      if(foraged.has(k)&&id!==BLOCK.GRASS)foraged.delete(k);
      // Removing or replacing the farmland also uproots its crop exactly once.
      if(old===BLOCK.FARMLAND&&id!==BLOCK.FARMLAND&&CROP_TYPES[World.getBlock(x,y+1,z)])World.setBlock(x,y+1,z,BLOCK.AIR);
    });
  }

  function yields(state) {
    const def=CROP_TYPES[state.id];
    if(state.progress<def.seconds)return [{id:def.seed,count:1}];
    return state.id===BLOCK.WHEAT_CROP?[{id:ITEM.WHEAT,count:1},{id:ITEM.WHEAT_SEEDS,count:2}]:[{id:def.produce,count:3}];
  }
  function plant(target,seed) {
    const id=getItemDef(seed)?.plant;
    if(!id||!target||crops.size>=MAX_CROPS||target.y>=CONFIG.HEIGHT-2||
      World.getBlock(target.x,target.y,target.z)!==BLOCK.FARMLAND||
      World.getBlock(target.x,target.y+1,target.z)!==BLOCK.AIR)return false;
    return World.setBlock(target.x,target.y+1,target.z,id);
  }
  function mature(target) {
    const state=target&&crops.get(key(target.x,target.y,target.z));
    return !!state&&state.progress>=CROP_TYPES[state.id].seconds;
  }
  function harvest(target) {
    return mature(target)&&World.setBlock(target.x,target.y,target.z,BLOCK.AIR);
  }
  function fertilize(target) {
    const state=target&&crops.get(key(target.x,target.y,target.z));
    if(!state||mature(target))return false;
    state.progress=Math.min(CROP_TYPES[state.id].seconds,state.progress+CROP_TYPES[state.id].seconds*.45);
    World.invalidateAt(target.x,target.y,target.z);return true;
  }
  function wet(x,y,z) {
    for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){
      for(const dy of [0,-1]){
        const id=World.getBlock(x+dx,y+dy,z+dz);
        if(id===BLOCK.WATER||id===BLOCK.WATER_FLOW)return true;
      }
    }
    return false;
  }
  function hasLight(x,y,z,day) {
    if(day){
      let open=true;
      for(let sy=y+1;sy<CONFIG.HEIGHT;sy++){
        const id=World.getBlock(x,sy,z);
        if(isSolidBlock(id)&&!BLOCKS[id].cutout){open=false;break;}
      }
      if(open)return true;
    }
    for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)for(let dy=-1;dy<=2;dy++){
      const id=World.getBlock(x+dx,y+dy,z+dz);
      if(id===BLOCK.TORCH||id===BLOCK.GLOWSTONE||BLOCKS[id]?.emission)return true;
    }
    return false;
  }
  function update(dt,time=.25) {
    if(!Number.isFinite(dt)||dt<=0)return;
    elapsed+=Math.min(1,dt);if(elapsed<1)return;
    const step=Math.floor(elapsed);elapsed-=step;
    for(const [k,state] of crops){
      const [x,y,z]=k.split(',').map(Number);
      if(!World.getChunk(x>>4,z>>4))continue;
      if(World.getBlock(x,y,z)!==state.id){crops.delete(k);continue;}
      if(World.getBlock(x,y-1,z)!==BLOCK.FARMLAND){World.setBlock(x,y,z,BLOCK.AIR);continue;}
      if(state.progress>=CROP_TYPES[state.id].seconds||!hasLight(x,y,z,Math.sin(time*Math.PI*2)>.05))continue;
      const before=stage(state);
      state.progress=Math.min(CROP_TYPES[state.id].seconds,state.progress+step*(wet(x,y-1,z)?1:1/3));
      if(stage(state)!==before)World.invalidateAt(x,y,z);
    }
    for(const [k,remaining] of foraged){
      if(remaining>step)foraged.set(k,remaining-step);
      else{foraged.delete(k);World.invalidateAt(...k.split(',').map(Number));}
    }
  }
  function forage(target) {
    if(!target||target.id!==BLOCK.GRASS||foraged.has(key(target.x,target.y,target.z)))return null;
    const {x,y,z}=target,seed=World.getSeed();
    const roll=Noise.hash2(x,z,seed+473),drops=[{id:ITEM.WHEAT_SEEDS,count:1}];
    if(roll<.025&&World.biomeAt(x,z)==='plains')drops.push({id:Noise.hash2(x,z,seed+474)<.5?ITEM.POPPY:ITEM.DAISY,count:1});
    const root=Noise.hash2(x,z,seed+490);
    if(root<.06)drops.push({id:root<.03?ITEM.CARROT:ITEM.POTATO,count:1});
    if(foraged.size>=MAX_FORAGE)foraged.delete(foraged.keys().next().value);
    foraged.set(key(x,y,z),90);World.invalidateAt(x,y,z);
    return drops;
  }
  function serialize() {
    return {version:1,crops:[...crops].map(([k,s])=>[k,{id:s.id,progress:Math.round(s.progress*100)/100}]),foraged:[...foraged]};
  }
  return {init,plant,harvest,fertilize,mature,update,serialize,
    stageAt:(x,y,z)=>stage(crops.get(key(x,y,z))),
    progressAt:(x,y,z)=>{const s=crops.get(key(x,y,z));return s?Math.floor(s.progress/CROP_TYPES[s.id].seconds*100):0;},
    isForaged:(x,y,z)=>foraged.has(key(x,y,z)),forage};
})();
