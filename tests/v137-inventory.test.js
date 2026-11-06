'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const core=new Function(src('js/game/config.js')+'\n'+src('js/game/items.js')+
 '\n'+src('js/game/mobile-test-crafting.js')+
 '\nreturn {BLOCK,ITEM,GAME_MODE,Inventory,Crafting,getToolDef,getArmorDef,getItemName};')();
const {BLOCK,ITEM,GAME_MODE,Inventory,Crafting,getArmorDef}=core;
let passed=0;const test=(label,fn)=>{fn();passed++;console.log('PASS',label)};
Inventory.init(GAME_MODE.SURVIVAL);
const item=(id,count)=>({id,count});
test('27 backpack + 9 hotbar slots and equipment remain available',()=>{
 assert.equal(Inventory.SIZE,36);assert.equal(Inventory.HOTBAR_SIZE,9);
 assert.equal(Inventory.getSlots().length,36);
 assert.deepEqual(Object.keys(Inventory.getEquipment()).sort(),
  ['mainhand','offhand','head','chest','legs','feet'].sort());
});
test('shift quick move transfers full stacks backpack to hotbar',()=>{
 Inventory.putIntoSlot(9,item(BLOCK.COBBLE,40));
 assert.equal(Inventory.quickMove(9),true);
 assert.equal(Inventory.getSlots()[9],null);
 assert.equal(Inventory.getSlots()[0].count,40);
});
test('shift quick move merges stacks without losing remainder',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.putIntoSlot(0,item(BLOCK.PLANK,55));
 Inventory.putIntoSlot(9,item(BLOCK.PLANK,30));
 assert.equal(Inventory.quickMove(9),true);
 assert.equal(Inventory.getSlots()[0].count,64);
 assert.equal(Inventory.getSlots()[1].count,21);
 assert.equal(Inventory.getSlots()[9],null);
});
test('hotbar number swaps preserve item counts',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.putIntoSlot(10,item(BLOCK.STONE,17));
 assert.equal(Inventory.swapSlots(10,2),true);
 assert.equal(Inventory.getSlots()[2].id,BLOCK.STONE);
 assert.equal(Inventory.getSlots()[2].count,17);
 assert.equal(Inventory.getSlots()[10],null);
});
test('cursor swaps distinct stacks without deleting them',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.putIntoSlot(12,item(BLOCK.DIRT,22));
 const cursor=item(BLOCK.SAND,13);
 const old=Inventory.swapWithSlot(12,cursor);
 assert.equal(old.id,BLOCK.DIRT);
 assert.equal(old.count,22);
 assert.equal(Inventory.getSlots()[12].id,BLOCK.SAND);
 assert.equal(Inventory.getSlots()[12].count,13);
});
test('right-click one-item placements respect maximum stack size',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 Inventory.putIntoSlot(13,item(BLOCK.PLANK,63));
 assert.equal(Inventory.putIntoSlot(13,item(BLOCK.PLANK,1)),null);
 assert.equal(Inventory.getSlots()[13].count,64);
 const remainder=Inventory.putIntoSlot(13,item(BLOCK.PLANK,1));
 assert.equal(remainder.count,1);
});
test('armor auto equips into the correct equipment slot',()=>{
 Inventory.init(GAME_MODE.SURVIVAL);
 const armorId=Object.keys(ITEM).map(x=>ITEM[x]).find(id=>{
  const d=getArmorDef(id);return d&&d.armorType==='head';
 });
 assert.ok(armorId);
 Inventory.setSlot(14,armorId);
 assert.equal(Inventory.quickMove(14),true);
 assert.equal(Inventory.getEquipment().head.id,armorId);
 assert.equal(Inventory.getSlots()[14],null);
});
test('offhand swap preserves original stack and rejects armor',()=>{
 const held=item(BLOCK.LOG,9);
 assert.equal(Inventory.swapEquipmentWithCursor('offhand',held),null);
 assert.equal(Inventory.getEquipment().offhand.count,9);
 assert.equal(Inventory.swapEquipmentWithCursor('offhand',item(BLOCK.DIRT,4)).id,BLOCK.LOG);
 assert.equal(Inventory.getEquipment().offhand.id,BLOCK.DIRT);
});
test('2x2 crafting recipe book includes planks but not complex armor',()=>{
 Crafting.resetGrid(2);
 const recipes=Crafting.getRecipes().filter(r=>Crafting.recipeFitsGrid(r));
 assert.ok(recipes.some(r=>r.id.includes('plank') || r.outputId===BLOCK.PLANK));
 assert.ok(recipes.some(r=>r.outputId===BLOCK.CRAFTING_TABLE));
 assert.ok(recipes.every(r=>Crafting.recipeFitsGrid(r)));
});
test('2x2 autofill and cursor result consume escrow materials only once',()=>{
 Crafting.resetGrid(2);
 const plankRecipe=Crafting.getRecipes().find(r=>r.outputId===BLOCK.PLANK && Crafting.recipeFitsGrid(r));
 assert.ok(plankRecipe);
 Inventory.add(plankRecipe.ingredients[0].id,2);
 const before=Inventory.countItem(plankRecipe.ingredients[0].id);
 assert.equal(Crafting.autofill(plankRecipe.id),true);
 assert.equal(Inventory.countItem(plankRecipe.ingredients[0].id),before-plankRecipe.ingredients[0].count);
 assert.equal(Crafting.canTakeGridResult(),true);
 const made=Crafting.takeGridResult();
 assert.equal(made.id,BLOCK.PLANK);assert.ok(made.count>0);
 assert.equal(Crafting.getVisibleCells().every(cell=>!cell.id),true);
 assert.equal(Crafting.takeGridResult(),null);
});
test('survival cursor and equipment survive serialization',()=>{
 const inv=Inventory.serialize(),equip=Inventory.serializeEquipment();
 assert.equal(inv.length,36);
 assert.equal(equip.offhand.id,BLOCK.DIRT);
 assert.ok(equip.head.durability>0);
});
test('touch HUD has only jump, inventory and pause buttons',()=>{
 const main=src('js/game/mobile-test-main.js');
 const segment=main.slice(main.indexOf("touchControls.innerHTML ="),
  main.indexOf("document.body.appendChild(touchControls)"));
 assert.ok(segment.includes('id="touch-pad"'));
 assert.deepEqual([...segment.matchAll(/data-act="([^"]+)"/g)].map(x=>x[1]),
  ['jump','inventory','pause']);
 assert.ok(!segment.includes('data-act="sneak"'));
 assert.ok(main.includes('finishWorldTouch('));
 assert.ok(main.includes('holdTimer=setTimeout('));
});
test('PC and mobile HTML include pixel inventory and compact touch style',()=>{
 for(const page of ['play.html','mobile-test.html']){
  const html=src(page);
  for(const needed of ['v137-inventory.css','v137-touch.css',
   'id="character-preview"','id="inventory-grid"','id="inventory-hotbar-grid"',
   'id="inventory-craft-grid"','id="inventory-recipe-toggle"']){
   assert.ok(html.includes(needed),page+' missing '+needed);
  }
 }
});
console.log('All '+passed+' inventory/touch tests passed.');
