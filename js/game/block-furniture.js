'use strict';

// World-local metadata and storage for partial building blocks.
// Block IDs and terrain edit format remain append-only and backward-compatible.
const BlockFurniture = (() => {
  const state = new Map();
  const SLOT_COUNT = 18;
  const MAX_STACK = 64;
  let unsubscribe = null;
  let openKey = null;
  let onClose = null;

  const key = (x,y,z) => x + ',' + y + ',' + z;
  const parse = k => k.split(',').map(Number);
  const validCoord = (x,y,z) => Number.isInteger(x) && Number.isInteger(y) &&
    Number.isInteger(z) && Math.abs(x) < 10000000 && Math.abs(z) < 10000000 &&
    y >= 0 && y < CONFIG.HEIGHT;
  function rootCoords(x,y,z) {
    return World.getBlock(x,y,z) === BLOCK.WOOD_DOOR_TOP
      && World.getBlock(x,y-1,z)===BLOCK.WOOD_DOOR ? [x,y-1,z] : [x,y,z];
  }
  function stateAt(x,y,z) {
    const p = rootCoords(x,y,z);
    return state.get(key(...p)) || null;
  }
  function touch(x,y,z) {
    World.invalidateAt(x,y,z);
  }
  function defaultState(id,facing='north',half='bottom') {
    if(id===BLOCK.WOOD_DOOR)return {facing,open:false};
    if(id===BLOCK.WOOD_STAIRS)return {facing};
    if(id===BLOCK.STONE_SLAB)return {half};
    if(id===BLOCK.CHEST)return {facing,chest:Array(SLOT_COUNT).fill(null)};
    return null;
  }
  function validStack(input) {
    if(!input || !isBlockId(input.id) && !ITEMS[input.id])return null;
    const def = getItemDef(input.id);
    const gear=!!(def?.toolType||def?.armorType);
    const count=Number.isInteger(input.count) && input.count>0 &&
      input.count <= (gear?1:MAX_STACK) ? input.count : 0;
    if(!count)return null;
    const out={id:input.id,count};
    if(gear)out.durability=Number.isInteger(input.durability)
      ? Math.max(1,Math.min(def.maxDurability||1,input.durability)) : (def.maxDurability||1);
    return out;
  }
  function init(saved) {
    if(unsubscribe)unsubscribe();
    state.clear();openKey=null;
    if(Array.isArray(saved)) for(const entry of saved.slice(0,5000)){
      if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string')continue;
      const [x,y,z]=parse(entry[0]), raw=entry[1];
      if(!validCoord(x,y,z)||!raw||typeof raw!=='object'||Array.isArray(raw))continue;
      if(!['north','south','east','west'].includes(raw.facing||'north'))continue;
      const id=World.getBlock(x,y,z);
      // Old chunks might not have loaded yet; validate when opened / placed.
      if(raw.chest){
        if(!Array.isArray(raw.chest)||raw.chest.length!==SLOT_COUNT)continue;
        state.set(entry[0],{facing:raw.facing||'north',chest:raw.chest.map(validStack)});
      }else if(raw.half==='top'||raw.half==='bottom'){
        state.set(entry[0],{half:raw.half});
      }else if(typeof raw.open==='boolean'){
        state.set(entry[0],{facing:raw.facing||'north',open:raw.open});
      }else if(raw.facing){
        state.set(entry[0],{facing:raw.facing});
      }
    }
    unsubscribe=World.onBlockChanged((x,y,z,id,previous)=>{
      if(previous===id)return;
      if(previous===BLOCK.CHEST&&id!==BLOCK.CHEST){
        state.delete(key(x,y,z));if(openKey===key(x,y,z))closeChest(false);
      }
      if(previous===BLOCK.STONE_SLAB||previous===BLOCK.WOOD_STAIRS)
        state.delete(key(x,y,z));
      if(previous===BLOCK.WOOD_DOOR&&id!==BLOCK.WOOD_DOOR){
        state.delete(key(x,y,z));
        if(World.getBlock(x,y+1,z)===BLOCK.WOOD_DOOR_TOP)
          World.setBlock(x,y+1,z,BLOCK.AIR);
      }
      if(previous===BLOCK.WOOD_DOOR_TOP&&id!==BLOCK.WOOD_DOOR_TOP){
        state.delete(key(x,y-1,z));
        if(World.getBlock(x,y-1,z)===BLOCK.WOOD_DOOR)
          World.setBlock(x,y-1,z,BLOCK.AIR);
      }
    });
  }

  function place(x,y,z,id,facing='north',half='bottom') {
    if(!validCoord(x,y,z)||!isPlaceable(id)||
       World.getBlock(x,y,z)!==BLOCK.AIR)return false;
    if(id===BLOCK.WOOD_DOOR){
      if(y>=CONFIG.HEIGHT-1||World.getBlock(x,y+1,z)!==BLOCK.AIR)return false;
      if(!World.setBlock(x,y,z,id))return false;
      if(!World.setBlock(x,y+1,z,BLOCK.WOOD_DOOR_TOP)){
        World.setBlock(x,y,z,BLOCK.AIR);
        return false;
      }
      state.set(key(x,y,z),defaultState(id,facing,half));
      touch(x,y,z);touch(x,y+1,z);
      return true;
    }
    if(!World.setBlock(x,y,z,id))return false;
    const meta=defaultState(id,facing,half);
    if(meta)state.set(key(x,y,z),meta);
    if(meta)touch(x,y,z);
    return true;
  }

  function toggleDoor(x,y,z) {
    const [bx,by,bz]=rootCoords(x,y,z);
    if(World.getBlock(bx,by,bz)!==BLOCK.WOOD_DOOR)return false;
    const k=key(bx,by,bz),meta=state.get(k)||defaultState(BLOCK.WOOD_DOOR);
    meta.open=!meta.open;
    state.set(k,meta);
    touch(bx,by,bz);touch(bx,by+1,bz);
    return meta.open;
  }

  function serialize() {
    const result=[];
    for(const [k,meta] of state){
      const v={...meta};
      if(v.chest)v.chest=v.chest.map(item=>item?{...item}:null);
      result.push([k,v]);
    }
    return result;
  }
  function chestAt(x,y,z) {
    if(World.getBlock(x,y,z)!==BLOCK.CHEST)return null;
    const k=key(x,y,z);
    let meta=state.get(k);
    if(!meta||!Array.isArray(meta.chest)){
      meta=defaultState(BLOCK.CHEST);state.set(k,meta);
    }
    return meta;
  }
  function setOnClose(fn){onClose=fn;}
  function closeChest(notify=true) {
    const wasOpen=!!openKey;
    openKey=null;
    document.getElementById('overlay-chest')?.classList.add('hidden');
    if(wasOpen&&notify&&onClose)onClose();
    return wasOpen;
  }
  function isChestOpen(){return !!openKey;}

  function canChestHold(chest,item) {
    if(!item)return false;
    const def=getItemDef(item.id);
    if(!def)return false;
    const gear=!!(def.toolType||def.armorType);
    let capacity=0;
    for(const s of chest){
      if(!s)capacity+=gear?1:MAX_STACK;
      else if(!gear&&s.id===item.id)capacity+=Math.max(0,MAX_STACK-s.count);
    }
    return capacity>=item.count;
  }
  function deposit(index) {
    if(!openKey)return false;
    const coords=parse(openKey),meta=chestAt(...coords);
    const stack=Inventory.getSlots()[index];
    if(!meta||!stack)return false;
    const moving={...stack,count:Math.min(Number.isFinite(stack.count)?stack.count:1,MAX_STACK)};
    if(!canChestHold(meta.chest,moving)){UI.showToast('상자에 빈 공간이 없습니다');return false;}
    const removed=Inventory.takeFromSlot(index,moving.count);
    if(!removed)return false;
    let count=removed.count;
    const gear=!!(getItemDef(removed.id).toolType||getItemDef(removed.id).armorType);
    if(!gear)for(let i=0;i<SLOT_COUNT&&count;i++){
      const s=meta.chest[i];
      if(s?.id!==removed.id)continue;
      const moved=Math.min(MAX_STACK-s.count,count);
      s.count+=moved;count-=moved;
    }
    for(let i=0;i<SLOT_COUNT&&count;i++){
      if(meta.chest[i])continue;
      const moved=Math.min(gear?1:MAX_STACK,count);
      meta.chest[i]={...removed,count:moved};
      count-=moved;
    }
    renderChest();UI.renderHotbar();
    return true;
  }
  function withdraw(index) {
    if(!openKey)return false;
    const meta=chestAt(...parse(openKey));
    const stack=meta?.chest[index];
    if(!stack)return false;
    const def=getItemDef(stack.id),gear=!!(def.toolType||def.armorType);
    if(!Inventory.canAdd(stack.id,stack.count)){
      UI.showToast('인벤토리에 빈 공간이 없습니다');return false;
    }
    if(gear) {
      const empty=Inventory.getSlots().findIndex(s=>!s);
      if(empty<0)return false;
      Inventory.putIntoSlot(empty,{...stack});
    } else if(Inventory.add(stack.id,stack.count)!==stack.count)return false;
    meta.chest[index]=null;
    renderChest();UI.renderHotbar();
    return true;
  }

  function renderChest() {
    if(!openKey)return;
    const meta=chestAt(...parse(openKey));
    if(!meta){closeChest();return;}
    const grid=document.getElementById('chest-storage-grid');
    const inventoryGrid=document.getElementById('chest-player-grid');
    if(!grid||!inventoryGrid)return;
    grid.replaceChildren();inventoryGrid.replaceChildren();
    const addSlot=(parent,stack,fn,title)=>{
      const button=document.createElement('button');
      button.type='button';button.className='storage-slot';
      button.title=title;
      if(stack){
        const img=document.createElement('img');img.src=Textures.blockIcon(stack.id);img.alt='';
        button.appendChild(img);
        const count=document.createElement('span');count.className='storage-count';
        count.textContent=stack.count>1?String(stack.count):'';
        button.appendChild(count);
        button.setAttribute('aria-label',title+' '+getItemName(stack.id)+' '+stack.count+'개');
      }else button.setAttribute('aria-label',title+' 빈 칸');
      button.addEventListener('click',fn);parent.appendChild(button);
    };
    meta.chest.forEach((item,i)=>addSlot(grid,item,()=>withdraw(i),'상자 '+(i+1)+'번 칸'));
    Inventory.getSlots().forEach((item,i)=>addSlot(inventoryGrid,item,()=>deposit(i),'가방 '+(i+1)+'번 칸'));
  }
  function openChest(x,y,z){
    const meta=chestAt(x,y,z);
    if(!meta)return false;
    openKey=key(x,y,z);
    renderChest();
    document.getElementById('overlay-chest')?.classList.remove('hidden');
    return true;
  }
  function releaseContents(x,y,z){
    const meta=chestAt(x,y,z);
    if(!meta)return;
    for(const item of meta.chest){
      if(item && typeof Drops!=='undefined'){
        Drops.spawn(item.id,item.count,x+.5,y+.5,z+.5);
      }
    }
    meta.chest=Array(SLOT_COUNT).fill(null);
  }
  return {init,place,stateAt,getState:stateAt,toggleDoor,serialize,openChest,closeChest,
    isChestOpen,setOnClose,deposit,withdraw,releaseContents,renderChest};
})();
