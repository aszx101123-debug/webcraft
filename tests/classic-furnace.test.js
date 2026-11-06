'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
let chunkLoaded = true, blockId = 25;
const World = {getChunk:() => chunkLoaded ? {} : null, getBlock:() => blockId};
const {FurnaceSystem:F, Inventory, BLOCK:B, ITEM:I, GAME_MODE} = new Function('World',
  ['config','items','furnace-system'].map(name => read('js/game/' + name + '.js')).join('\n') +
  '\nreturn {FurnaceSystem,Inventory,BLOCK,ITEM,GAME_MODE};'
)(World);
const pos = {x:3,y:30,z:-4}, other = {x:4,y:30,z:-4};
let passed = 0;
function check(label, test) {
  F.init(null); Inventory.init(GAME_MODE.SURVIVAL); chunkLoaded = true; blockId = B.FURNACE;
  test(); passed++; console.log('PASS', label);
}
const put = (slot,id,count=1,p=pos) => F.interact(p,slot,{id,count});
const tick = seconds => { for (let n=0;n<Math.floor(seconds);n++) F.update(1); if (seconds%1) F.update(seconds%1); };

check('input and fuel slots reject unsuitable items and output rejects insertion', () => {
  assert.equal(put('input',B.DIRT,3).changed,false);
  assert.equal(put('fuel',I.IRON_INGOT,3).changed,false);
  assert.equal(put('output',I.IRON_INGOT,3).changed,false);
  assert.equal(put('input',B.IRON_ORE,3).cursor,null);
  assert.equal(put('fuel',I.COAL,2).cursor,null);
  assert.equal(F.getState(pos).input.count,3);
});
check('iron smelts after ten active seconds and consumes one coal for eighty seconds', () => {
  put('input',B.IRON_ORE,2); put('fuel',I.COAL);
  tick(9.9);
  assert.equal(F.getState(pos).output,null);
  tick(.1);
  const state=F.getState(pos);
  assert.deepEqual(state.output,{id:I.IRON_INGOT,count:1});
  assert.equal(state.input.count,1); assert.equal(state.fuel,null);
  assert.ok(Math.abs(state.burnRemaining-70)<1e-7);
});
check('one coal cooks eight items and retains the ninth unprocessed', () => {
  put('input',B.GOLD_ORE,9); put('fuel',I.COAL);
  tick(90);
  const state=F.getState(pos);
  assert.equal(state.output.count,8); assert.equal(state.input.count,1);
  assert.equal(state.burnRemaining,0); assert.equal(state.cookProgress,0);
});
check('short-burning sticks combine across fuel changes without resetting cooking', () => {
  put('input',B.COPPER_ORE); put('fuel',I.STICK,2);
  tick(5);
  assert.equal(F.getState(pos).cookProgress,5);
  assert.equal(F.getState(pos).output,null);
  tick(5);
  assert.deepEqual(F.getState(pos).output,{id:I.COPPER_INGOT,count:1});
  assert.equal(F.getState(pos).input,null); assert.equal(F.getState(pos).fuel,null);
});
check('separate furnace blocks keep independent inventories and cooking', () => {
  put('input',B.SAND,2); put('fuel',B.PLANK,1);
  put('input',B.COBBLE,2,other); put('fuel',I.COAL,1,other);
  tick(10);
  assert.equal(F.getState(pos).output.id,B.GLASS);
  assert.equal(F.getState(other).output.id,B.STONE);
  assert.equal(F.getState(pos).burnRemaining,5);
  assert.equal(F.getState(other).burnRemaining,70);
});
check('a full output stack prevents consuming fuel or input', () => {
  F.init({version:1,entries:[['3,30,-4',{input:{id:B.IRON_ORE,count:2},
    fuel:{id:I.COAL,count:1},output:{id:I.IRON_INGOT,count:64}}]]});
  tick(15);
  assert.equal(F.getState(pos).fuel.count,1);
  assert.equal(F.getState(pos).input.count,2);
  assert.equal(F.getState(pos).output.count,64);
});
check('a different existing output blocks recipes until the old product is removed', () => {
  put('input',B.SAND); put('fuel',I.COAL); tick(10);
  put('input',B.IRON_ORE); tick(10);
  assert.equal(F.getState(pos).input.count,1);
  assert.equal(F.getState(pos).output.id,B.GLASS);
  F.interact(pos,'output',null); tick(10);
  assert.equal(F.getState(pos).output.id,I.IRON_INGOT);
});
check('taking or replacing the input resets old recipe progress', () => {
  put('input',B.SAND); put('fuel',I.COAL); tick(4);
  assert.equal(F.getState(pos).cookProgress,4);
  const result=put('input',B.COBBLE,3);
  assert.deepEqual(result.cursor,{id:B.SAND,count:1});
  assert.equal(F.getState(pos).cookProgress,0);
  tick(6); assert.equal(F.getState(pos).output,null);
});
check('right click splits and deposits one item without changing total stack counts', () => {
  put('input',B.IRON_ORE,11);
  const split=F.interact(pos,'input',null,true);
  assert.equal(split.cursor.count,6); assert.equal(F.getState(pos).input.count,5);
  const returned=F.interact(pos,'input',split.cursor,true);
  assert.equal(returned.cursor.count,5); assert.equal(F.getState(pos).input.count,6);
  const excess=F.interact(pos,'input',{id:B.IRON_ORE,count:60});
  assert.equal(F.getState(pos).input.count,64);
  assert.equal(excess.cursor.count,2);
});
check('output merges into a matching cursor only up to the stack limit', () => {
  put('input',B.IRON_ORE,5); put('fuel',I.COAL); tick(50);
  const result=F.interact(pos,'output',{id:I.IRON_INGOT,count:62});
  assert.equal(result.cursor.count,64); assert.equal(F.getState(pos).output.count,3);
  const blocked=F.interact(pos,'output',{id:I.GOLD_INGOT,count:3});
  assert.equal(blocked.changed,false); assert.equal(F.getState(pos).output.count,3);
});
check('shift transfer moves exact inventory items into the matching furnace slot', () => {
  Inventory.getSlots()[10]={id:B.IRON_ORE,count:64};
  Inventory.getSlots()[11]={id:I.COAL,count:5};
  assert.equal(F.depositFromInventory(pos,10),true);
  assert.equal(Inventory.getSlots()[10],null);
  assert.equal(F.getState(pos).input.count,64);
  assert.equal(F.depositFromInventory(pos,11),true);
  assert.equal(Inventory.getSlots()[11],null);
  assert.equal(F.getState(pos).fuel.count,5);
  Inventory.getSlots()[12]={id:B.IRON_ORE,count:3};
  assert.equal(F.depositFromInventory(pos,12),false);
  assert.equal(Inventory.getSlots()[12].count,3);
});
check('full inventory never destroys furnace products or ingredients', () => {
  put('input',B.IRON_ORE); put('fuel',I.COAL); tick(10);
  Inventory.getSlots().fill(null).forEach((_,i)=>Inventory.getSlots()[i]={id:B.DIRT,count:64});
  assert.equal(F.withdrawToInventory(pos,'output'),false);
  assert.equal(F.getState(pos).output.count,1);
  Inventory.getSlots()[35]=null;
  assert.equal(F.withdrawToInventory(pos,'output'),true);
  assert.equal(F.getState(pos).output,null);
  assert.equal(Inventory.getSlots()[35].id,I.IRON_INGOT);
});
check('serialization preserves fuel, contents and partial progress without sharing objects', () => {
  put('input',B.IRON_ORE,3); put('fuel',I.COAL,2); tick(4.5);
  const saved=F.serialize(),before=F.getState(pos);
  F.init(saved);
  assert.deepEqual(F.getState(pos),before);
  saved.entries[0][1].input.count=60;
  assert.equal(F.getState(pos).input.count,3);
  const snapshot=F.getState(pos); snapshot.input.count=50;
  assert.equal(F.getState(pos).input.count,3);
  tick(5.5); assert.equal(F.getState(pos).output.count,1);
});
check('unloaded chunks and removed blocks do not tick, and large resumed deltas are bounded', () => {
  put('input',B.IRON_ORE,3); put('fuel',I.COAL);
  chunkLoaded=false; tick(20); assert.equal(F.getState(pos).cookProgress,0);
  chunkLoaded=true; blockId=B.AIR; tick(20); assert.equal(F.getState(pos).cookProgress,0);
  blockId=B.FURNACE; F.update(600); assert.equal(F.getState(pos).cookProgress,1);
  F.update(NaN); F.update(-1); assert.equal(F.getState(pos).cookProgress,1);
});
check('breaking a furnace returns every remaining stack once and clears its state', () => {
  put('input',B.IRON_ORE,3); put('fuel',I.COAL,2); tick(10);
  assert.deepEqual(F.remove(3,30,-4),[
    {id:B.IRON_ORE,count:2},{id:I.COAL,count:1},{id:I.IRON_INGOT,count:1}
  ]);
  assert.equal(F.getState(pos),null);
  assert.deepEqual(F.remove(pos),[]);
});
check('invalid saves and out-of-range positions cannot create unsafe furnace states', () => {
  F.init({version:1,entries:[
    ['3,30,-4',{input:{id:B.IRON_ORE,count:Infinity},fuel:{id:I.COAL,count:2},
      output:{id:99999,count:3},burnRemaining:Infinity,burnDuration:9999,cookProgress:-4}],
    ['3,30,-4',{input:{id:B.IRON_ORE,count:60}}],
    ['3,9999,-4',{}], ['__proto__',{}]
  ]});
  const state=F.getState(pos);
  assert.equal(state.input,null); assert.equal(state.output,null);
  assert.equal(state.fuel.count,2); assert.equal(state.burnRemaining,0);
  assert.equal(F.serialize().entries.length,1);
  assert.equal(F.getState({x:Infinity,y:1,z:0},true),null);
});

check('furnace UI preserves held items during full-inventory closes and forced death transitions', () => {
  const nodes = new Map();
  class Element {
    constructor(tag='div') {
      this.tagName=tag; this.children=[]; this.classes=new Set(); this.style={}; this.events={};
      this.textContent=''; this.attributes={}; this.dataset={};
      this.classList={
        add:(...names)=>names.forEach(name=>this.classes.add(name)),
        remove:(...names)=>names.forEach(name=>this.classes.delete(name)),
        contains:name=>this.classes.has(name),
        toggle:(name,on)=>{const value=on===undefined?!this.classes.has(name):on;
          if(value)this.classes.add(name);else this.classes.delete(name);return value;}
      };
    }
    set id(value){this._id=value;nodes.set(value,this);}
    get id(){return this._id;}
    set className(value){this.classes=new Set(value.split(/\s+/).filter(Boolean));}
    get className(){return [...this.classes].join(' ');}
    set innerHTML(value){this.html=value;this.children=[];}
    get innerHTML(){return this.html||'';}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    appendChild(child){this.append(child);return child;}
    replaceChildren(...children){this.children=[];this.append(...children);}
    addEventListener(name,callback){this.events[name]=callback;}
    setAttribute(name,value){this.attributes[name]=value;}
    querySelector(selector){
      for(const child of this.children){
        if(selector[0]==='.'?child.classes.has(selector.slice(1)):child.tagName===selector)return child;
        const found=child.querySelector(selector);if(found)return found;
      }
      return null;
    }
  }
  const document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),
    querySelectorAll:()=>[],addEventListener(){},body:new Element('body')};
  const create=(id,tag='div')=>{const node=new Element(tag);node.id=id;return node;};
  const overlay=create('overlay-furnace');overlay.className='overlay hidden';
  const panel=new Element();panel.className='panel';
  const heading=new Element('h2'),list=create('furnace-recipes'),fuel=create('furnace-fuel');
  const close=create('furnace-close','button');panel.append(heading,fuel,list,close);overlay.append(panel);
  for(const id of ['hotbar','toast','inventory-cursor','death-cause','picker-grid'])create(id);
  for(const id of ['overlay-start','overlay-pause','overlay-death','overlay-inventory','overlay-crafting'])
    create(id).className='overlay hidden';
  create('picker').className='hidden';
  const uiGame=new Function('document','World','Textures','innerWidth','innerHeight','setTimeout','clearTimeout',
    ['config','items','mobile-test-crafting','furnace-system','mobile-test-ui'].map(name=>read('js/game/'+name+'.js')).join('\n')+
    '\nreturn {UI,FurnaceSystem,Inventory,Crafting,GAME_MODE};'
  )(document,World,{blockIcon:()=> 'data:image/png;base64,test'},1024,768,()=>0,()=>{});
  uiGame.FurnaceSystem.init();uiGame.Inventory.init(uiGame.GAME_MODE.SURVIVAL);
  assert.equal(uiGame.UI.openFurnace({...pos,id:B.FURNACE}),true);
  assert.equal(uiGame.UI.isFurnaceOpen(),true);
  assert.equal(panel.querySelector('h2').textContent,'화로');
  assert.equal(nodes.get('furnace-close'),close);
  uiGame.FurnaceSystem.interact(pos,'input',{id:B.IRON_ORE,count:1});
  uiGame.FurnaceSystem.interact(pos,'fuel',{id:I.COAL,count:1});
  uiGame.FurnaceSystem.update(1);uiGame.UI.renderFurnace();
  assert.equal(nodes.get('furnace-progress-fill').style.width,'10%');
  assert.equal(list.children.find(child=>child.className==='classic-furnace-inventory').children.length,36);
  for(let i=0;i<36;i++)uiGame.Inventory.getSlots()[i]={id:B.DIRT,count:64};
  uiGame.UI.restoreInventoryCursor({id:B.STONE,count:1});
  assert.equal(uiGame.UI.closeFurnace(),false);
  assert.equal(uiGame.UI.isFurnaceOpen(),true);
  assert.equal(uiGame.UI.showOverlay(null),false);
  assert.equal(uiGame.UI.getInventoryCursor().count,1);
  uiGame.Inventory.getSlots()[35]=null;
  assert.equal(uiGame.UI.closeFurnace(),true);
  assert.equal(uiGame.UI.isFurnaceOpen(),false);
  assert.equal(uiGame.UI.getInventoryCursor(),null);
  assert.equal(uiGame.Inventory.getSlots()[35].id,B.STONE);

  // Full bags used to block UI.showDeath() while a cursor or crafting material
  // could not be returned, leaving the dead player trapped in a container.
  for(let i=0;i<36;i++)uiGame.Inventory.getSlots()[i]={id:B.DIRT,count:64};
  uiGame.Crafting.resetGrid(2);
  assert.equal(uiGame.UI.openInventory(),true);
  uiGame.Crafting.setCell(0,B.LOG);
  uiGame.UI.restoreInventoryCursor({id:B.STONE,count:1});
  uiGame.UI.updateInventoryCursor(120,80);
  const bagBefore=JSON.stringify(uiGame.Inventory.serialize());
  const gridBefore=JSON.stringify(uiGame.Crafting.getGrid());
  uiGame.UI.showDeath('좀비');
  assert.equal(nodes.get('overlay-death').classList.contains('hidden'),false);
  assert.equal(nodes.get('death-cause').textContent,'좀비…');
  assert.equal(uiGame.UI.isInventoryOpen(),false);
  assert.equal(nodes.get('overlay-inventory').classList.contains('hidden'),true);
  assert.equal(nodes.get('inventory-cursor').classList.contains('hidden'),true);
  assert.deepEqual(uiGame.UI.getInventoryCursor(),{id:B.STONE,count:1});
  assert.equal(JSON.stringify(uiGame.Inventory.serialize()),bagBefore);
  assert.equal(JSON.stringify(uiGame.Crafting.getGrid()),gridBefore);
  uiGame.UI.hideDeath();

  // Furnace and picker state must also close without losing block-local stacks
  // or the saved 3x3 crafting grid when death happens while using a container.
  uiGame.Crafting.resetGrid(3);uiGame.Crafting.setCell(8,B.PLANK);
  nodes.get('overlay-crafting').classList.remove('hidden');
  assert.equal(uiGame.UI.openFurnace({...pos,id:B.FURNACE}),true);
  uiGame.UI.openPicker(()=>{});
  const machineBefore=JSON.stringify(uiGame.FurnaceSystem.serialize());
  const tableBefore=JSON.stringify(uiGame.Crafting.getGrid());
  uiGame.UI.showDeath('스켈레톤');
  assert.equal(uiGame.UI.isFurnaceOpen(),false);
  assert.equal(uiGame.UI.isCraftingOpen(),false);
  assert.equal(uiGame.UI.isPickerOpen(),false);
  assert.equal(nodes.get('picker').classList.contains('hidden'),true);
  assert.equal(JSON.stringify(uiGame.FurnaceSystem.serialize()),machineBefore);
  assert.equal(JSON.stringify(uiGame.Crafting.getGrid()),tableBefore);
  assert.deepEqual(uiGame.UI.getInventoryCursor(),{id:B.STONE,count:1});
  assert.equal(JSON.stringify(uiGame.Inventory.serialize()),bagBefore);
  uiGame.UI.hideDeath();
  assert.equal(uiGame.UI.isInventoryOpen(),false);
  assert.equal(uiGame.UI.isFurnaceOpen(),false);
  assert.equal(uiGame.UI.isCraftingOpen(),false);
  assert.equal(uiGame.UI.isPickerOpen(),false);
});

console.log('All '+passed+' classic furnace checks passed.');
