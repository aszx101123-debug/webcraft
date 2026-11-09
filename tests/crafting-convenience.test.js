'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const gameAssets=require('./helpers/game-assets');
const source=name=>fs.readFileSync(path.join(__dirname,'../js/game',name+'.js'),'utf8');
const core=()=>{
  const events=[];
  const g=new Function('WorldMilestones',['config','items','mobile-test-crafting'].map(source).join('\n')+
    '\nreturn {Inventory,Crafting,BLOCK,ITEM,GAME_MODE,getItemDef};')({record:(...args)=>events.push(args)});
  g.Inventory.init(g.GAME_MODE.SURVIVAL);g.Crafting.resetGrid(3);
  return {...g,events};
};
const snapshot=g=>JSON.stringify({bag:g.Inventory.serialize(),grid:g.Crafting.getGrid(),equipment:g.Inventory.serializeEquipment()});
function fillBag(g){for(let i=0;i<36;i++)g.Inventory.putIntoSlot(i,{id:g.BLOCK.DIRT,count:64});}

test('every recipe can be made directly with exact materials and full tool durability',()=>{
  const g=core();
  for(const recipe of g.Crafting.getRecipes()){
    g.Inventory.init(g.GAME_MODE.SURVIVAL);g.Crafting.resetGrid(3);
    for(const item of recipe.ingredients)g.Inventory.add(item.id,item.count);
    const made=g.Crafting.craftRecipe(recipe.id);
    assert.equal(made.success,true,recipe.id);
    assert.equal(g.Inventory.countItem(recipe.outputId),recipe.count,recipe.id);
    assert.equal(g.Inventory.getSlots().filter(Boolean).reduce((n,s)=>n+s.count,0),recipe.count,recipe.id);
    const def=g.getItemDef(recipe.outputId);
    if(def.toolType||def.armorType)assert.equal(g.Inventory.getSlots().find(s=>s?.id===recipe.outputId).durability,def.maxDurability);
    assert.ok(g.Crafting.getGrid().every(id=>!id));
  }
});

test('repeat and maximum crafting consume materials once and record only completed batches',()=>{
  const g=core();g.Crafting.resetGrid(2);g.Inventory.add(g.BLOCK.LOG,20);
  assert.equal(g.Crafting.craftRecipe('planks').count,4);
  assert.equal(g.Crafting.craftRecipe('planks').count,4);
  const state=g.Crafting.getRecipeState('planks');assert.equal(state.maxCount,72);
  const made=g.Crafting.craftRecipe('planks','all');
  assert.equal(made.batches,18);assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),80);
  assert.equal(g.Inventory.countItem(g.BLOCK.LOG),0);assert.equal(g.events.length,20);
  assert.equal(g.Crafting.craftRecipe('planks').success,false);assert.equal(g.events.length,20);
});

test('missing materials, invalid amounts and the personal station never consume existing items',()=>{
  const g=core();g.Inventory.add(g.BLOCK.PLANK,4);g.Crafting.resetGrid(2);
  g.Crafting.setCell(0,g.BLOCK.DIRT);const before=snapshot(g);
  for(const [recipe,count] of [['furnace',1],['crafting-table',2],['planks',1],['bad',1],['crafting-table',NaN],['crafting-table',0],['crafting-table',-1]]){
    assert.equal(g.Crafting.craftRecipe(recipe,count).success,false,recipe+' '+count);
    assert.equal(snapshot(g),before);
  }
  assert.equal(g.events.length,0);
});

test('full inventories are checked after ingredient consumption, and failed plans stay atomic',()=>{
  const g=core();fillBag(g);g.Inventory.getSlots()[0]={id:g.BLOCK.LOG,count:1};
  assert.equal(g.Inventory.canAdd(g.BLOCK.PLANK,4),false);
  assert.equal(g.Crafting.getRecipeState('planks').canCraft,true);
  assert.equal(g.Crafting.craftRecipe('planks').success,true);
  assert.deepEqual(g.Inventory.getSlots()[0],{id:g.BLOCK.PLANK,count:4});
  g.Inventory.getSlots()[0]={id:g.BLOCK.LOG,count:64};const before=snapshot(g);
  assert.equal(g.Crafting.getRecipeState('planks').maxCount,0);
  assert.equal(g.Crafting.craftRecipe('planks','all').success,false);assert.equal(snapshot(g),before);
});

test('batch crafting can free a slot even when one individual craft cannot fit',()=>{
  const g=core();fillBag(g);g.Inventory.getSlots()[0]={id:g.ITEM.COAL,count:63};
  const state=g.Crafting.getRecipeState('pack-coal');
  assert.equal(state.canCraft,false);assert.equal(state.maxBatches,7);
  assert.equal(g.Crafting.craftRecipe('pack-coal','all').success,true);
  assert.deepEqual(g.Inventory.getSlots()[0],{id:g.BLOCK.COAL_BLOCK,count:7});
});

test('grid escrow and held materials are counted, consumed safely and preserve unrelated gear',()=>{
  const g=core();g.Crafting.resetGrid(2);g.Crafting.setCell(0,g.BLOCK.LOG);g.Crafting.setCell(1,g.BLOCK.DIRT);
  g.Inventory.add(g.BLOCK.LOG,1);g.Inventory.putIntoSlot(8,{id:g.ITEM.IRON_PICKAXE,count:1,durability:17});g.Inventory.setSelected(8);
  g.Inventory.putEquipment('offhand',{id:g.ITEM.SHIELD,count:1,durability:39});
  const tool=g.Inventory.getSlots()[8],cursor={id:g.BLOCK.LOG,count:3};
  assert.equal(g.Crafting.getRecipeState('planks',cursor).maxBatches,5);
  const result=g.Crafting.craftRecipe('planks','all',cursor);
  assert.equal(result.count,20);assert.equal(result.cursor,null);assert.deepEqual(cursor,{id:g.BLOCK.LOG,count:3});
  assert.equal(g.Crafting.getGrid().filter(Boolean).length,1);assert.equal(g.Crafting.getGrid()[1],g.BLOCK.DIRT);
  assert.equal(g.Inventory.getSelected(),8);assert.equal(g.Inventory.getSlots()[8],tool);
  assert.equal(g.Inventory.getEquipment().offhand.durability,39);
});

test('a full bag can choose a source that frees space while preserving unused grid materials',()=>{
  const g=core();fillBag(g);g.Inventory.getSlots()[0]={id:g.BLOCK.LOG,count:1};g.Crafting.setCell(0,g.BLOCK.LOG);
  assert.equal(g.Crafting.craftRecipe('planks').success,true);
  assert.equal(g.Crafting.getGrid()[0],g.BLOCK.LOG);assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),4);
  assert.equal(g.Crafting.craftRecipe('planks').success,true);
  assert.equal(g.Crafting.getGrid()[0],null);assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),8);
});

test('maximum results obey real stack limits for gear, empty buckets and ordinary items',()=>{
  const g=core();g.Inventory.add(g.ITEM.IRON_INGOT,63);
  assert.equal(g.Crafting.craftRecipe('bucket','all').count,21);
  assert.deepEqual(g.Inventory.getSlots().filter(s=>s?.id===g.ITEM.BUCKET).map(s=>s.count),[16,5]);
  g.Inventory.add(g.BLOCK.PLANK,18);g.Inventory.add(g.ITEM.STICK,12);
  const recipe=g.Crafting.getRecipes().find(r=>r.outputId===g.ITEM.WOODEN_PICKAXE);
  assert.equal(g.Crafting.craftRecipe(recipe,'all').count,6);
  for(const s of g.Inventory.getSlots().filter(s=>s?.id===g.ITEM.WOODEN_PICKAXE)){
    assert.equal(s.count,1);assert.equal(s.durability,g.getItemDef(s.id).maxDurability);
  }
});

test('automatic arrangement replaces old escrow without duplication and refuses unsafe refunds',()=>{
  const g=core();g.Crafting.resetGrid(2);g.Crafting.setCell(0,g.BLOCK.DIRT);g.Inventory.add(g.BLOCK.PLANK,4);
  assert.equal(g.Crafting.arrangeRecipe('crafting-table').success,true);
  assert.equal(g.Inventory.countItem(g.BLOCK.DIRT),1);assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),0);
  assert.equal(g.Crafting.getMatch().id,'crafting-table');
  assert.equal(g.Crafting.arrangeRecipe('crafting-table').success,true);
  assert.equal(g.Crafting.getVisibleCells().filter(c=>c.id===g.BLOCK.PLANK).length,4);
  g.Crafting.resetGrid(2);fillBag(g);g.Crafting.setCell(0,g.BLOCK.LOG);g.Crafting.setCell(1,g.BLOCK.SAND);
  const before=snapshot(g);
  assert.equal(g.Crafting.arrangeRecipe('planks').success,false);assert.equal(snapshot(g),before);
});

test('creative infinite sources remain infinite and maximum crafting is bounded by inventory capacity',()=>{
  const g=core();g.Inventory.init(g.GAME_MODE.CREATIVE);g.Inventory.getSlots().fill(null);g.Inventory.setSlot(0,g.BLOCK.LOG);
  const state=g.Crafting.getRecipeState('planks');assert.ok(state.maxCount>0&&state.maxCount<=36*64);
  const made=g.Crafting.craftRecipe('planks','all');assert.equal(made.success,true);
  assert.equal(g.Inventory.getSlots()[0].count,Infinity);
  assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),made.count);
});

function uiGame(touch=false){
  const nodes=new Map();
  class Element {
    constructor(tag='div'){
      this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.style={};this.events={};this.classes=new Set();
      this.value='';this.disabled=false;this.scrollTop=0;
      this.classList={add:(...c)=>c.forEach(s=>this.classes.add(s)),remove:(...c)=>c.forEach(s=>this.classes.delete(s)),contains:c=>this.classes.has(c),
        toggle:(c,on)=>{on=on===undefined?!this.classes.has(c):on;if(on)this.classes.add(c);else this.classes.delete(c);return on;}};
    }
    set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}get className(){return [...this.classes].join(' ');}
    set textContent(v){this._text=String(v);this.children=[];}get textContent(){return (this._text||'')+this.children.map(c=>c.textContent).join('');}
    set innerHTML(v){this._html=v;this._text='';this.children=[];}get innerHTML(){return this._html||'';}
    append(...children){this.children.push(...children);}appendChild(child){this.append(child);return child;}
    replaceChildren(...children){this._text='';this.children=[...children];}
    setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
    addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
    focus(){document.activeElement=this;}
    contains(node){return this===node||this.children.some(c=>c.contains(node));}
    click(){if(this.disabled)return;this.focus();const e={shiftKey:false,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}};this.onclick?.(e);for(const fn of this.events.click||[])fn(e);}
    find(cls){for(const c of this.children){if(c.classes.has(cls))return c;const found=c.find(cls);if(found)return found;}return null;}
  }
  const ids=['hotbar','toast','inventory-cursor','inventory-grid','inventory-hotbar-grid','inventory-craft-grid','inventory-craft-output',
    'inventory-recipe-list','inventory-recipe-search','inventory-recipe-filter','inventory-recipe-detail','inventory-recipe-count',
    'inventory-recipe-toggle','inventory-recipe-panel','overlay-inventory','overlay-crafting','craft-grid','craft-output','craft-inventory',
    'recipe-grid','recipe-search','recipe-filter','recipe-detail','recipe-count','craft-manual','craft-clear'];
  for(const id of ids)nodes.set(id,new Element());
  for(const id of ['inventory-recipe-filter','recipe-filter'])nodes.get(id).setAttribute('aria-pressed','false');
  nodes.get('inventory-recipe-toggle').setAttribute('aria-expanded','true');
  const document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),querySelectorAll:()=>[],addEventListener(){},body:new Element('body')};
  if(touch)document.body.classList.add('touch-device');
  const g=new Function('document','Textures','innerWidth','innerHeight','setTimeout','clearTimeout',
    ['config','items','mobile-test-crafting','mobile-test-ui'].map(source).join('\n')+
    '\nreturn {UI,Inventory,Crafting,BLOCK,ITEM,GAME_MODE};')(document,{blockIcon:id=>'item-'+id},1024,768,()=>0,()=>{});
  g.Inventory.init(g.GAME_MODE.SURVIVAL);g.Crafting.resetGrid(2);
  return {...g,nodes,document,select(context,id){const list=nodes.get(context==='inventory'?'inventory-recipe-list':'recipe-grid');
    const choice=list.children.find(c=>c.dataset.recipeId===id);assert.ok(choice,id+' is visible');choice.click();},
    action(context,name){const detail=nodes.get(context==='inventory'?'inventory-recipe-detail':'recipe-detail');const button=detail.find(name);assert.ok(button,name);button.click();return button;}};
}

for(const touch of [false,true])test((touch?'mobile':'PC')+' recipe selection makes items without placing cells or holding the result',()=>{
  const g=uiGame(touch);g.Inventory.add(g.BLOCK.LOG,3);g.UI.openInventory();g.select('inventory','planks');
  assert.equal(g.Inventory.countItem(g.BLOCK.LOG),3);assert.ok(g.Crafting.getGrid().every(id=>!id));
  const list=g.nodes.get('inventory-recipe-list');list.scrollTop=87;
  g.action('inventory','quick-craft-one');g.action('inventory','quick-craft-one');
  assert.equal(g.document.activeElement,g.nodes.get('inventory-recipe-detail').find('quick-craft-one'));
  assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),8);assert.equal(g.UI.getInventoryCursor(),null);
  assert.equal(list.scrollTop,87);g.action('inventory','quick-craft-all');
  assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),12);assert.equal(g.Inventory.countItem(g.BLOCK.LOG),0);
  const detail=g.nodes.get('inventory-recipe-detail');
  assert.equal(detail.find('quick-craft-one').disabled,true);assert.ok(detail.textContent.includes('통나무'));
  assert.equal(list.children.find(c=>c.dataset.recipeId==='planks').getAttribute('aria-pressed'),'true');
});

test('personal search and craftable filter work, while missing recipes remain selectable',()=>{
  const g=uiGame();g.UI.openInventory();g.select('inventory','sticks');
  assert.equal(g.nodes.get('inventory-recipe-detail').find('quick-craft-one').disabled,true);
  assert.ok(g.nodes.get('inventory-recipe-detail').textContent.includes('2개 부족'));
  g.Inventory.add(g.BLOCK.PLANK,4);g.UI.renderInventory();
  const search=g.nodes.get('inventory-recipe-search');search.value='제작 대';search.oninput();
  assert.equal(g.nodes.get('inventory-recipe-list').children.length,1);
  g.nodes.get('inventory-recipe-filter').click();g.action('inventory','quick-craft-one');
  assert.equal(g.Inventory.countItem(g.BLOCK.CRAFTING_TABLE),1);
  assert.ok(g.nodes.get('inventory-recipe-list').textContent.includes('지금 만들 수 있는'));
  assert.equal(g.nodes.get('inventory-recipe-detail').find('quick-craft-one').disabled,true);
});

test('the recipe book uses ingredients held by the cursor without an extra placement click',()=>{
  const g=uiGame();g.UI.restoreInventoryCursor({id:g.BLOCK.LOG,count:2});g.UI.openInventory();g.select('inventory','planks');
  g.action('inventory','quick-craft-one');assert.deepEqual(g.UI.getInventoryCursor(),{id:g.BLOCK.LOG,count:1});
  g.action('inventory','quick-craft-all');assert.equal(g.UI.getInventoryCursor(),null);
  assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),8);
});

test('table quick crafting and optional automatic arrangement use the same real recipes',()=>{
  const g=uiGame(true);g.Inventory.add(g.ITEM.WHEAT,10);g.Inventory.add(g.BLOCK.PLANK,8);g.UI.openCrafting();
  g.select('table','bread');g.action('table','quick-craft-one');g.action('table','quick-craft-all');
  assert.equal(g.Inventory.countItem(g.ITEM.BREAD),3);assert.equal(g.Inventory.countItem(g.ITEM.WHEAT),1);
  g.select('table','storage-chest');g.action('table','recipe-arrange');
  assert.equal(g.nodes.get('craft-manual').open,true);assert.equal(g.Crafting.getMatch().id,'storage-chest');
  g.nodes.get('craft-output').click();
  assert.equal(g.Inventory.countItem(g.BLOCK.CHEST),1);assert.equal(g.Inventory.countItem(g.BLOCK.PLANK),0);
});

test('both game entries show the personal recipe book by default and ship the updated controls offline',()=>{
  const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const worker=read('service-worker.js');
  for(const page of ['play.html','mobile-test.html']){
    const html=read(page);
    for(const id of ['inventory-recipe-search','inventory-recipe-filter','inventory-recipe-detail','recipe-filter','recipe-detail','craft-manual','crafting-close'])
      assert.equal(html.split('id="'+id+'"').length-1,1,page+' '+id);
    assert.match(html,/id="inventory-recipe-toggle"[^>]*aria-expanded="true"/);
    assert.ok(html.includes('재료는 자동으로 사용되고 완성품은 가방에 들어갑니다.'));
    assert.match(html,/css\/classic\.css\?v=v\d+/);
  }
  for(const file of ['config','mobile-test-crafting','mobile-test-ui']){
    const url=gameAssets('play.html').find(url=>url.split('?')[0]==='js/game/'+file+'.js');
    assert.ok(url);
    assert.ok(worker.includes(url));assert.ok(read('mobile-test.html').includes(url));assert.ok(read('js/auth-play.js').includes(url));
  }
});
