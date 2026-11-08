'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const game=require('./helpers/item-game');
const root=path.join(__dirname,'..');
const farmTarget={x:3,y:1,z:3,face:[0,1,0]};
function plant(g,seed=g.ITEM.WHEAT_SEEDS){
  g.World.setBlock(3,1,3,g.BLOCK.GRASS);g.hold(g.ITEM.WOODEN_HOE);
  assert.equal(g.ItemActions.use({...farmTarget,id:g.BLOCK.GRASS}).success,true);
  g.hold(seed);assert.equal(g.ItemActions.use({...farmTarget,id:g.BLOCK.FARMLAND}).success,true);
  return {x:3,y:2,z:3,id:g.ITEMS[seed].plant,face:[0,1,0]};
}

test('82 new entries preserve original IDs, fit Uint8 blocks and expose valid item definitions',()=>{
  const g=game();
  assert.equal(g.BLOCK.WOOD_DOOR_TOP,45);assert.equal(g.ITEM.DIAMOND_SWORD,244);
  assert.equal(g.BLOCKS.length,75);assert.equal(Object.keys(g.ITEMS).length,114);
  for(let id=1;id<g.BLOCKS.length;id++)assert.ok(g.BLOCKS[id]?.tiles);
  assert.equal(Object.keys(g.ITEMS).filter(id=>Number(id)>=300).length,53);
  assert.equal(g.WOOL_TYPES.length,16);assert.equal(g.STORAGE_TYPES.length,8);
});

test('every recipe can be autofilled and crafted with exact ingredients, including all new outputs',()=>{
  const g=game(),C=g.Crafting,I=g.Inventory;
  for(const recipe of C.getRecipes()){
    I.init(g.GAME_MODE.SURVIVAL);C.resetGrid(3);
    for(const input of recipe.ingredients)assert.equal(I.add(input.id,input.count),input.count,recipe.id);
    assert.equal(C.autofill(recipe.id),true,recipe.id);
    assert.equal(C.getMatch()?.outputId,recipe.outputId,recipe.id);
    assert.equal(C.craftGrid(),true,recipe.id);
    assert.equal(I.countItem(recipe.outputId),recipe.count,recipe.id);
    assert.equal(C.getGrid().filter(Boolean).length,0);
    assert.equal(I.serialize().filter(Boolean).reduce((n,s)=>n+s.count,0),recipe.count,recipe.id+' must not mint ingredients');
  }
});

test('all eight resource blocks round-trip without loss or duplication',()=>{
  const g=game();
  for(const type of g.STORAGE_TYPES){
    g.Inventory.init(g.GAME_MODE.SURVIVAL);g.Crafting.resetGrid(3);g.Inventory.add(type.item,9);
    assert.equal(g.Crafting.autofill('pack-'+type.key),true);assert.equal(g.Crafting.craftGrid(),true);
    assert.equal(g.Inventory.countItem(type.item),0);
    g.Crafting.resetGrid(2);assert.equal(g.Crafting.autofill('unpack-'+type.key),true);assert.equal(g.Crafting.craftGrid(),true);
    assert.equal(g.Inventory.countItem(type.item),9);assert.equal(g.Inventory.countItem(type.block),0);
  }
});

test('filled containers stack to one, empty buckets to sixteen, and overflow is returned',()=>{
  const g=game(),I=g.Inventory;
  assert.equal(I.add(g.ITEM.WATER_BUCKET,3),3);
  assert.deepEqual(I.getSlots().filter(Boolean).map(s=>s.count),[1,1,1]);
  assert.deepEqual(I.putIntoSlot(10,{id:g.ITEM.BUCKET,count:20}),{id:g.ITEM.BUCKET,count:4});
  assert.equal(I.getSlots()[10].count,16);
  assert.deepEqual(I.putIntoSlot(11,{id:g.ITEM.WATER_BUCKET,count:2}),{id:g.ITEM.WATER_BUCKET,count:1});
  assert.equal(I.getSlots()[11].count,1);
});

test('a full inventory cannot destroy water or milk when filling stacked buckets',()=>{
  const g=game();g.hold(g.ITEM.BUCKET,16);
  for(let i=1;i<36;i++)g.Inventory.putIntoSlot(i,{id:g.BLOCK.DIRT,count:64});
  g.World.setBlock(1,1,-1,g.BLOCK.WATER);g.ray({x:1,y:1,z:-1,id:g.BLOCK.WATER});
  assert.equal(g.ItemActions.use(null).success,false);
  assert.equal(g.World.getBlock(1,1,-1),g.BLOCK.WATER);assert.equal(g.Inventory.selectedSlot().count,16);
  g.Inventory.takeFromSlot(1);
  assert.equal(g.ItemActions.use(null).success,true);
  assert.equal(g.World.getBlock(1,1,-1),g.BLOCK.AIR);
  assert.equal(g.Inventory.selectedSlot().count,15);assert.equal(g.Inventory.countItem(g.ITEM.WATER_BUCKET),1);
});

test('water bucket places a real source and returns its container, including offhand use',()=>{
  const g=game();g.hold(g.ITEM.IRON_PICKAXE,1,24);
  g.Inventory.putEquipment('offhand',{id:g.ITEM.WATER_BUCKET,count:1});
  const target={x:4,y:1,z:4,id:g.BLOCK.STONE,face:[1,0,0]};g.World.setBlock(4,1,4,g.BLOCK.STONE);
  assert.equal(g.ItemActions.use(target,'offhand').success,true);
  assert.equal(g.World.getBlock(5,1,4),g.BLOCK.WATER);
  assert.equal(g.Inventory.getEquipment().offhand.id,g.ITEM.BUCKET);assert.equal(g.Inventory.selectedSlot().durability,24);
});

test('hoeing, planting, irrigating and harvesting produces wheat and renewable seeds',()=>{
  const g=game(),crop=plant(g);
  assert.equal(g.World.getBlock(3,1,3),g.BLOCK.FARMLAND);
  assert.equal(g.World.getBlock(3,2,3),g.BLOCK.WHEAT_CROP);
  assert.equal(g.Inventory.selectedSlot(),null);
  g.World.setBlock(5,1,3,g.BLOCK.WATER);g.tickFarm(180);
  assert.equal(g.Farming.mature(crop),true);assert.equal(g.Farming.stageAt(3,2,3),3);
  assert.equal(g.ItemActions.use(crop,'empty').success,true);
  assert.equal(g.World.getBlock(3,2,3),g.BLOCK.AIR);
  assert.equal(g.spawns.filter(d=>d.id===g.ITEM.WHEAT).reduce((n,d)=>n+d.count,0),1);
  assert.equal(g.spawns.filter(d=>d.id===g.ITEM.WHEAT_SEEDS).reduce((n,d)=>n+d.count,0),2);
  assert.equal(g.Farming.serialize().crops.length,0);
});

test('dry soil is slower; paused, unlit and unloaded crops do not advance',()=>{
  const g=game();plant(g);g.tickFarm(90);
  assert.ok(g.Farming.progressAt(3,2,3)>0&&g.Farming.progressAt(3,2,3)<30);
  const before=g.Farming.progressAt(3,2,3);
  g.Farming.update(0);g.tickFarm(5,.75);assert.equal(g.Farming.progressAt(3,2,3),before);
  g.loaded(false);g.tickFarm(5);assert.equal(g.Farming.progressAt(3,2,3),before);
  g.loaded(true);g.World.setBlock(4,2,3,g.BLOCK.LANTERN);g.tickFarm(6,.75);
  assert.ok(g.Farming.progressAt(3,2,3)>before);
});

test('bone meal advances growth, rejects mature plants and only consumes successful uses',()=>{
  const g=game(),crop=plant(g);g.hold(g.ITEM.BONE_MEAL,4);
  for(let i=0;i<3;i++)assert.equal(g.ItemActions.use(crop).success,true);
  assert.equal(g.Farming.mature(crop),true);assert.equal(g.Inventory.selectedSlot().count,1);
  assert.equal(g.ItemActions.use(crop).success,false);assert.equal(g.Inventory.selectedSlot().count,1);
});

test('carrot and potato harvests multiply roots; breaking farmland uproots exactly once',()=>{
  for(const seed of [302,303]){
    const g=game(),crop=plant(g,seed);g.hold(g.ITEM.BONE_MEAL,3);
    for(let i=0;i<3;i++)g.ItemActions.use(crop);
    g.World.setBlock(3,1,3,g.BLOCK.DIRT);
    assert.equal(g.World.getBlock(3,2,3),g.BLOCK.AIR);
    assert.equal(g.spawns.filter(d=>d.id===seed).reduce((n,d)=>n+d.count,0),3);
    assert.equal(g.Farming.serialize().crops.length,0);
  }
});

test('farm state and new inventory stacks survive world save/export/import',()=>{
  const g=game();plant(g,g.ITEM.CARROT);g.tickFarm(30);g.hold(g.ITEM.BOW,1,18);
  const farming=g.Farming.serialize(),meta=g.SaveSystem.create('농장',123);
  assert.equal(g.SaveSystem.save(meta.id,{version:8,seed:123,inventory:g.Inventory.serialize(),farming}),true);
  const exported=g.SaveSystem.exportWorld(meta.id),copy=g.SaveSystem.importWorld(exported);
  assert.ok(copy);assert.deepEqual(g.SaveSystem.load(copy.id).farming,farming);
  g.Inventory.init(g.GAME_MODE.SURVIVAL,g.SaveSystem.load(copy.id).inventory);
  assert.equal(g.Inventory.selectedSlot().durability,18);
  const bad=structuredClone(exported);bad.world.farming.crops[0][1].progress=Infinity;
  assert.equal(g.SaveSystem.importWorld(bad),null);
  g.Farming.init(farming);assert.equal(g.Farming.progressAt(3,2,3),Math.floor(10/150*100));
});

test('flowers and seeds are gathered once, disappear, then regrow on simulation time',()=>{
  const g=game();let x=0;
  while(g.Noise.hash2(x,3,123+473)>=.025)x++;
  g.World.setBlock(x,1,3,g.BLOCK.GRASS);const t={x,y:1,z:3,id:g.BLOCK.GRASS};g.hold(g.ITEM.SHEARS);
  assert.equal(g.ItemActions.use(t).success,true);
  assert.equal(g.Inventory.countItem(g.ITEM.WHEAT_SEEDS),1);
  assert.equal(g.Inventory.countItem(g.ITEM.POPPY)+g.Inventory.countItem(g.ITEM.DAISY),1);
  assert.equal(g.Farming.isForaged(x,1,3),true);
  assert.equal(g.ItemActions.use(t).success,false);
  assert.equal(g.Inventory.selectedSlot().durability,237);
  g.tickFarm(90);assert.equal(g.Farming.isForaged(x,1,3),false);
});

test('sheep shearing and cow milking require an unobstructed target and respect cooldowns',()=>{
  const g=game();g.Mobs.spawn('sheep',.5,1,-2);g.hold(g.ITEM.SHEARS);
  assert.equal(g.ItemActions.use(null).success,true);assert.equal(g.Inventory.countItem(g.BLOCK.WOOL_WHITE),3);
  assert.equal(g.ItemActions.use(null).success,false);
  const milk=game();milk.Mobs.spawn('cow',.5,1,-2);milk.hold(milk.ITEM.BUCKET);
  assert.equal(milk.ItemActions.use(null).success,true);assert.equal(milk.Inventory.selectedId(),milk.ITEM.MILK_BUCKET);
  milk.Player.hp=16;milk.Player.food=16;
  assert.equal(milk.ItemActions.use(null).success,true);
  assert.equal(milk.Inventory.selectedId(),milk.ITEM.BUCKET);assert.equal(milk.Player.hp,18);assert.equal(milk.Player.food,20);
});

test('bow consumes ammunition and durability only after spawning a real damaging projectile',()=>{
  const g=game();g.hold(g.ITEM.BOW);
  assert.equal(g.ItemActions.use(null).success,false);assert.equal(g.Inventory.selectedSlot().durability,384);
  g.Inventory.add(g.ITEM.ARROW,2);const mob=g.Mobs.spawn('zombie',.5,1,-4);
  assert.equal(g.ItemActions.use(null).success,true);assert.equal(g.Inventory.countItem(g.ITEM.ARROW),1);
  assert.equal(g.Inventory.selectedSlot().durability,383);
  assert.equal(g.ItemActions.use(null).success,false);assert.equal(g.Inventory.countItem(g.ITEM.ARROW),1);
  for(let i=0;i<20;i++)g.Mobs.update(.02,true);
  assert.equal(mob.hp,14);assert.equal(g.Player.hp,20);
});

test('fast arrows cannot tunnel through a single-block wall or damage a mob behind it',()=>{
  const g=game(),mob=g.Mobs.spawn('zombie',.5,1,-4);
  g.World.setBlock(0,2,-1,g.BLOCK.STONE);g.World.setBlock(0,1,-1,g.BLOCK.STONE);
  assert.equal(g.Mobs.firePlayerArrow(new g.THREE.Vector3(.5,2,.5),new g.THREE.Vector3(0,0,-1)),true);
  g.Mobs.update(.1,true);
  assert.equal(g.Mobs.counts().arrows,0);assert.equal(mob.hp,20);
  assert.equal(g.spawns.filter(d=>d.id===g.ITEM.ARROW).length,1);
});

test('shield blocks front attacks, wears down and never prevents fall damage or rear attacks',()=>{
  const g=game();g.hold(g.ITEM.SHIELD);g.ItemActions.use(null);
  assert.equal(g.Player.damage(3,'공격',{x:.5,y:1,z:-2}),false);
  assert.equal(g.Player.hp,20);assert.equal(g.Inventory.selectedSlot().durability,330);
  assert.equal(g.Player.damage(3,'공격',{x:.5,y:1,z:3}),true);assert.equal(g.Player.hp,17);
  g.Player.damage(2,'추락',null);assert.equal(g.Player.hp,15);
  g.tickItems(2);g.Player.damage(3,'공격',{x:.5,y:1,z:-2});assert.equal(g.Player.hp,12);
});

test('fishing has a visible cast, bite window, retrieval reward and cancellation without leaks',()=>{
  const g=game();g.hold(g.ITEM.FISHING_ROD);
  g.World.setBlock(1,1,-2,g.BLOCK.WATER);g.ray({x:1,y:1,z:-2,id:g.BLOCK.WATER});
  const count=g.scene.children.length;
  assert.equal(g.ItemActions.use(null).success,true);assert.equal(g.scene.children.length,count+2);
  g.tickItems(7);assert.ok(g.messages.some(t=>t.includes('입질!')));
  assert.equal(g.ItemActions.use(null).success,true);assert.equal(g.Inventory.countItem(g.ITEM.RAW_FISH),1);
  assert.equal(g.Inventory.selectedSlot().durability,63);assert.equal(g.scene.children.length,count);
  g.ItemActions.use(null);g.hold(g.ITEM.STICK);g.tickItems(1);
  assert.equal(g.ItemActions.isFishing(),false);assert.equal(g.scene.children.length,count);
});

test('cooking produces better food and charcoal/coal blocks burn for their actual durations',()=>{
  const g=game(),p={x:8,y:1,z:8};g.World.setBlock(8,1,8,g.BLOCK.FURNACE);
  for(const [input,output] of [[g.ITEM.PORK,g.ITEM.COOKED_PORK],[g.ITEM.RAW_FISH,g.ITEM.COOKED_FISH],[g.ITEM.POTATO,g.ITEM.BAKED_POTATO],[g.BLOCK.LOG,g.ITEM.CHARCOAL],[g.BLOCK.CACTUS,g.ITEM.DYE_GREEN]]){
    g.FurnaceSystem.init(null);g.FurnaceSystem.interact(p,'input',{id:input,count:1});g.FurnaceSystem.interact(p,'fuel',{id:g.BLOCK.COAL_BLOCK,count:1});
    for(let i=0;i<10;i++)g.FurnaceSystem.update(1);
    const state=g.FurnaceSystem.getState(p);assert.equal(state.output.id,output);assert.equal(state.burnRemaining,790);
    g.FurnaceSystem.init(g.FurnaceSystem.serialize());assert.equal(g.FurnaceSystem.getState(p).burnRemaining,790);
  }
  assert.ok(g.ITEMS[g.ITEM.COOKED_PORK].food>g.ITEMS[g.ITEM.PORK].food);
});

test('all dye colors can recolor placed wool and only successful recolors consume one dye',()=>{
  const g=game(),target={x:5,y:1,z:5,id:g.BLOCK.WOOL_WHITE};
  for(const color of g.WOOL_TYPES){
    g.World.setBlock(5,1,5,g.BLOCK.WOOL_WHITE);g.hold(color.dye,2);
    const result=g.ItemActions.use(target);
    assert.equal(result.success,color.key!=='WHITE');
    assert.equal(g.World.getBlock(5,1,5),color.block);
    assert.equal(g.Inventory.selectedSlot().count,color.key==='WHITE'?2:1);
  }
});

test('compass, clock and healing food provide usable results without consuming healthy players items',()=>{
  const g=game();g.Player.setSpawn(40,1,.5);g.hold(g.ITEM.COMPASS);
  assert.equal(g.ItemActions.use(null).success,true);assert.ok(g.messages.at(-1).includes('동쪽'));
  g.hold(g.ITEM.CLOCK);g.ItemActions.use(null);assert.ok(g.messages.at(-1).includes('12:00'));
  g.hold(g.ITEM.GOLDEN_APPLE,2);assert.equal(g.ItemActions.use(null).success,false);
  g.Player.hp=10;assert.equal(g.ItemActions.use(null).success,true);
  assert.equal(g.Player.hp,18);assert.equal(g.Inventory.selectedSlot().count,1);
});

test('dropped tools keep their exact durability when collected again',()=>{
  const g=game({realDrops:true});
  g.Drops.spawn(g.ITEM.BOW,1,.5,1.9,.5,17);
  for(let i=0;i<200&&g.Drops.count();i++)g.Drops.update(.02,g.Player.pos,true);
  assert.equal(g.Drops.count(),0);
  assert.equal(g.Inventory.getSlots().find(s=>s?.id===g.ITEM.BOW)?.durability,17);
});

test('the production right-click handler tills, plants, harvests and eats using the actual modules',()=>{
  const g=game(),text=fs.readFileSync(path.join(root,'js/game/mobile-test-main.js'),'utf8');
  const start=text.indexOf("  document.addEventListener('mousedown'");
  const end=text.indexOf("  document.addEventListener('mouseup'",start);
  let listener;
  const dependencies={
    document:{addEventListener:(name,fn)=>{if(name==='mousedown')listener=fn;}},
    state:{locked:true,paused:false,mode:g.GAME_MODE.SURVIVAL},
    Player:g.Player,Inventory:g.Inventory,ItemActions:g.ItemActions,Interact:g.Interact,Mobs:g.Mobs,
    UI:g.UI,BLOCK:g.BLOCK,ITEMS:g.ITEMS,THREE:g.THREE,camera:g.camera,GAME_MODE:g.GAME_MODE,
    isFoodId:g.isFoodId,isBlockId:g.isBlockId,isTouch:false,touchActive:false,
    PlayerModel:{swing(){}},blip(){},disableTouchInput(){},resumeInput(){},BlockFurniture:{}
  };
  new Function(...Object.keys(dependencies),'let miningHeld=false,miningSwingElapsed=0,creativeBreakTimer=0;\n'+text.slice(start,end))(...Object.values(dependencies));
  const click=()=>listener({button:2,target:{closest:()=>false}});
  g.World.setBlock(3,1,3,g.BLOCK.GRASS);g.hold(g.ITEM.WOODEN_HOE);
  g.ray({...farmTarget,id:g.BLOCK.GRASS});click();
  assert.equal(g.World.getBlock(3,1,3),g.BLOCK.FARMLAND);
  assert.equal(g.Inventory.selectedSlot().durability,59);
  assert.equal(g.Inventory.pickBlock(g.ITEM.WHEAT_SEEDS),true);
  g.ray({...farmTarget,id:g.BLOCK.FARMLAND});click();
  assert.equal(g.World.getBlock(3,2,3),g.BLOCK.WHEAT_CROP);
  assert.equal(g.Inventory.countItem(g.ITEM.WHEAT_SEEDS),0);
  g.World.setBlock(5,1,3,g.BLOCK.WATER);g.tickFarm(180);
  g.ray({x:3,y:2,z:3,id:g.BLOCK.WHEAT_CROP});click();
  assert.equal(g.World.getBlock(3,2,3),g.BLOCK.AIR);assert.ok(g.spawns.some(d=>d.id===g.ITEM.WHEAT));
  g.hold(g.ITEM.COOKED_PORK);g.Player.food=10;g.ray(null);click();
  assert.equal(g.Player.food,18);assert.equal(g.Inventory.selectedSlot(),null);
});

test('creative utility use needs no ammo or durability, fills buckets and keeps placed water available',()=>{
  const g=game();g.Inventory.init(g.GAME_MODE.CREATIVE);g.Player.setMode(g.GAME_MODE.CREATIVE);g.Mobs.setMode(g.GAME_MODE.CREATIVE);
  g.Inventory.setSlot(0,g.ITEM.BOW);assert.equal(g.ItemActions.use(null).success,true);
  assert.equal(g.Inventory.selectedSlot().durability,384);assert.equal(g.Inventory.countItem(g.ITEM.ARROW),0);
  g.Inventory.setSlot(0,g.ITEM.BUCKET);g.World.setBlock(1,1,-1,g.BLOCK.WATER);g.ray({x:1,y:1,z:-1,id:g.BLOCK.WATER});
  assert.equal(g.ItemActions.use(null).success,true);assert.equal(g.Inventory.selectedId(),g.ITEM.WATER_BUCKET);
  g.ItemActions.use({x:3,y:1,z:4,id:g.BLOCK.STONE,face:[1,0,0]});
  assert.equal(g.World.getBlock(4,1,4),g.BLOCK.WATER);assert.equal(g.Inventory.selectedId(),g.ITEM.WATER_BUCKET);
});

test('a broken or cancelled cast cannot leak fishing meshes and bite timers freeze with zero delta',()=>{
  const g=game();g.hold(g.ITEM.FISHING_ROD,1,1);g.World.setBlock(1,1,-2,g.BLOCK.WATER);g.ray({x:1,y:1,z:-2,id:g.BLOCK.WATER});
  const count=g.scene.children.length;g.ItemActions.use(null);
  for(let i=0;i<50;i++)g.ItemActions.update(0);
  assert.equal(g.messages.filter(t=>t.includes('입질!')).length,0);
  g.tickItems(7);g.ItemActions.use(null);
  assert.equal(g.Inventory.selectedSlot(),null);assert.equal(g.scene.children.length,count);
  assert.equal(g.Inventory.countItem(g.ITEM.RAW_FISH),1);
});
