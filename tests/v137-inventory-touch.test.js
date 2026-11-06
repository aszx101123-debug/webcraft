'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const data=new Function(src('js/game/config.js')+'\n'+src('js/game/items.js')+
 '\n'+src('js/game/mobile-test-crafting.js')+
 '\nreturn {BLOCK,ITEM,GAME_MODE,Inventory,Crafting};')();
const {BLOCK,ITEM,GAME_MODE,Inventory,Crafting}=data;
let passed=0;const check=(label,fn)=>{fn();passed++;console.log('PASS',label);};
check('standard player backpack is 27 slots plus nine hotbar slots',()=>{
 assert.equal(Inventory.SIZE,36);assert.equal(Inventory.HOTBAR_SIZE,9);
 Inventory.init(GAME_MODE.SURVIVAL);
 assert.equal(Inventory.getSlots().length,36);
});
check('left click picks a stack and can place it elsewhere',()=>{
 Inventory.getSlots()[10]={id:BLOCK.PLANK,count:14};
 const held=Inventory.swapWithSlot(10,null);
 assert.equal(held.count,14);assert.equal(Inventory.getSlots()[10],null);
 assert.equal(Inventory.swapWithSlot(2,held),null);
 assert.equal(Inventory.getSlots()[2].count,14);
});
check('cursor exchange with a different item never deletes inventory materials',()=>{
 Inventory.getSlots()[12]={id:BLOCK.COBBLE,count:20};
 const swapped=Inventory.swapWithSlot(12,{id:BLOCK.PLANK,count:3});
 assert.deepEqual(swapped,{id:BLOCK.COBBLE,count:20});
 assert.equal(Inventory.getSlots()[12].id,BLOCK.PLANK);
 assert.equal(Inventory.getSlots()[12].count,3);
});
check('stack split and one-at-a-time placement are bounded',()=>{
 Inventory.getSlots()[4]={id:BLOCK.LOG,count:11};
 const split=Inventory.takeFromSlot(4,Math.ceil(11/2));
 assert.equal(split.count,6);assert.equal(Inventory.getSlots()[4].count,5);
 assert.equal(Inventory.putIntoSlot(5,{id:split.id,count:1}),null);
 assert.equal(Inventory.getSlots()[5].count,1);
});
check('number hotkey swaps selected bag item with chosen hotbar slot',()=>{
 Inventory.getSlots()[7]={id:BLOCK.DIRT,count:9};
 Inventory.getSlots()[24]={id:BLOCK.STONE,count:13};
 assert.equal(Inventory.swapSlots(24,7),true);
 assert.equal(Inventory.getSlots()[7].id,BLOCK.STONE);
 assert.equal(Inventory.getSlots()[24].id,BLOCK.DIRT);
 assert.equal(Inventory.swapSlots(24,24),false);
});
check('shift-click moves backpack stack into hotbar',()=>{
 Inventory.getSlots()[25]={id:BLOCK.COBBLE,count:34};
 assert.equal(Inventory.quickMove(25),true);
 assert.equal(Inventory.getSlots()[25],null);
 assert.ok(Inventory.getHotbarSlots().some(s=>s?.id===BLOCK.COBBLE));
});
check('shift-click moves hotbar stack back to backpack',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.getSlots()[2]={id:BLOCK.DIRT,count:30};
 assert.equal(Inventory.quickMove(2),true);
 assert.equal(Inventory.getSlots()[2],null);
 assert.ok(Inventory.getSlots().slice(9).some(s=>s?.id===BLOCK.DIRT));
});
check('when all destination slots are filled, quick transfer keeps every item',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 for(let i=0;i<9;i++)Inventory.getSlots()[i]={id:BLOCK.STONE,count:64};
 Inventory.getSlots()[10]={id:BLOCK.LOG,count:27};
 assert.equal(Inventory.quickMove(10),false);
 assert.deepEqual(Inventory.getSlots()[10],{id:BLOCK.LOG,count:27});
});
check('shift clicking headgear auto equips without losing durability',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.getSlots()[15]={id:ITEM.IRON_HELMET,count:1,durability:109};
 assert.equal(Inventory.quickMove(15),true);
 assert.equal(Inventory.getSlots()[15],null);
 assert.equal(Inventory.getEquipment().head.id,ITEM.IRON_HELMET);
 assert.equal(Inventory.getEquipment().head.durability,109);
});
check('head slot rejects non-helmets and exchanges compatible gear safely',()=>{
 const hand={id:BLOCK.DIRT,count:5};
 assert.deepEqual(Inventory.swapEquipmentWithCursor('head',hand),hand);
 assert.equal(Inventory.getEquipment().head.id,ITEM.IRON_HELMET);
 const old=Inventory.swapEquipmentWithCursor('head',{id:ITEM.DIAMOND_HELMET,count:1,durability:33});
 assert.equal(old.durability,109);
 assert.equal(Inventory.getEquipment().head.id,ITEM.DIAMOND_HELMET);
});
check('2x2 crafting table recipe fills exactly four intended cells',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.add(BLOCK.PLANK,4);
 Crafting.resetGrid(2);
 assert.equal(Crafting.autofill('crafting-table'),true);
 assert.equal(Crafting.getMatch().id,'crafting-table');
 assert.equal(Crafting.getVisibleCells().filter(c=>c.id).length,4);
 const result=Crafting.takeGridResult();
 assert.equal(result.id,BLOCK.CRAFTING_TABLE);
 assert.equal(result.count,1);
 assert.equal(Crafting.getVisibleCells().filter(c=>c.id).length,0);
});
check('recipe book filters out recipes larger than personal 2x2',()=>{
 Crafting.resetGrid(2);
 const personal=Crafting.getRecipes().filter(r=>Crafting.recipeFitsGrid(r));
 assert.ok(personal.some(r=>r.id==='sticks'));
 assert.ok(personal.some(r=>r.id==='crafting-table'));
 assert.ok(!personal.some(r=>r.id==='furnace'));
});
check('shaped stick recipe works in two-column personal crafting grid',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);Inventory.add(BLOCK.PLANK,2);
 Crafting.resetGrid(2);
 assert.equal(Crafting.autofill('sticks'),true);
 assert.equal(Crafting.getMatch().id,'sticks');
 const result=Crafting.takeGridResult();
 assert.equal(result.id,ITEM.STICK);
 assert.equal(result.count,4);
});
check('player gear and inventory survive serialization with original item numbers',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.getSlots()[3]={id:BLOCK.DIRT,count:63};
 Inventory.swapEquipmentWithCursor('head',{id:ITEM.IRON_HELMET,count:1,durability:120});
 const saved=Inventory.serialize(),equip=Inventory.serializeEquipment();
 Inventory.init(GAME_MODE.SURVIVAL,saved,equip);
 assert.equal(Inventory.getSlots()[3].count,63);
 assert.equal(Inventory.getEquipment().head.durability,120);
});
check('desktop and mobile retain compact touch controls with functioning sneak',()=>{
 const main=src('js/game/mobile-test-main.js');
 const hud=main.match(/touchControls\.innerHTML\s*=([\s\S]*?);\s*document\.body\.append/);
 assert.ok(hud);
 for(const action of ['jump','sneak','inventory','pause']) assert.ok(hud[1].includes('data-act="'+action+'"'));
 for(const removed of ['mine','place','run','journal','camera','blocks','fly','drop'])
   assert.ok(!hud[1].includes('data-act="'+removed+'"'));
 assert.ok(main.includes('holdTimer=setTimeout('));
 assert.ok(main.includes('Interac'.replace('Interac','Interact.setTouchAim(')));
 assert.ok(!main.includes('WorldJournal.show();WorldMilestones.render()'));
 for(const page of ['play.html','mobile-test.html']){
   const html=src(page);
   assert.ok(html.includes('id="mobile-pause-actions"'));
   assert.ok(html.includes('css/v137-touch.css?v=v137'));
   assert.ok(html.includes('css/v137-inventory.css?v=v137'));
   assert.ok(html.includes('id="character-preview"'));
   assert.ok(html.includes('id="inventory-craft-grid"'));
   assert.ok(html.includes('id="inventory-grid"'));
   assert.ok(html.includes('id="inventory-hotbar-grid"'));
 }
});
check('creative E inventory includes searchable item tab without extra HUD keys',()=>{
 const html=src('play.html');
 const ui=src('js/game/mobile-test-ui.js');
 const main=src('js/game/mobile-test-main.js');
 assert.ok(html.includes('id="inventory-creative-toggle"'));
 assert.ok(html.includes('id="inventory-creative-search"'));
 assert.ok(html.includes('id="inventory-creative-grid"'));
 assert.ok(ui.includes('function renderCreativeCatalog()'));
 assert.ok(ui.includes("openCreative.addEventListener('click'"));
 assert.ok(main.includes("e.target?.closest?.('input,textarea,select')"));
});
console.log('All '+passed+' inventory and touch-control checks passed.');
