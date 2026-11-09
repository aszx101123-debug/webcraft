'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'js/game/'+name+'.js'),'utf8');
function runtime(){
  return new Function(['config','items','mobile-test-crafting'].map(source).join('\n')+
    '\nreturn {BIOMES,BIOME_ITEMS,BLOCK,BLOCKS,ITEM,ITEMS,Inventory,Crafting,GAME_MODE,getBlockDrop,isBlockId,isPlaceable,getItemDef};')();
}

test('retired biome collectibles retain their IDs and metadata without new drops or placement',()=>{
  const g=runtime(),seen=new Set();
  assert.equal(Object.values(g.BIOMES).reduce((n,b)=>n+b.chance,0),100);
  for(const [key,biome] of Object.entries(g.BIOMES)){
    assert.ok(g.isBlockId(biome.resource));assert.equal(g.isPlaceable(biome.resource),false);
    assert.equal(g.BLOCKS[biome.resource].hidden,true);
    assert.equal(g.BLOCKS[biome.resource].biomeResource,key);
    const counts=new Map();
    for(let n=0;n<1000;n++){
      const id=g.getBlockDrop(biome.resource,()=> (n+.5)/1000,null);
      counts.set(id,(counts.get(id)||0)+1);
    }
    assert.deepEqual([...counts.entries()],[[0,1000]]);
    for(const [index,drop] of biome.loot.entries()){
      assert.equal(seen.has(drop.id),false);seen.add(drop.id);
      assert.equal(g.ITEMS[drop.id].biome,key);
      assert.equal(g.ITEMS[drop.id].hidden,true);
      assert.equal(g.getBlockDrop(biome.resource,()=>[0,.6,.9][index]),0);
    }
    assert.equal(g.getBlockDrop(biome.resource,()=>1),0);
  }
  assert.equal(seen.size,48);
});

test('retired collectible recipes cannot consume saved items or create outputs',()=>{
  const g=runtime(),I=g.Inventory,C=g.Crafting;
  assert.equal(g.BIOME_ITEMS.length,48);
  for(const material of g.BIOME_ITEMS){
    I.init(g.GAME_MODE.SURVIVAL);C.resetGrid(2);
    assert.equal(I.add(material.id,material.required),material.required);
    const saved=JSON.stringify(I.serialize());
    assert.equal(C.autofill('biome-'+material.id),false,material.id);
    assert.equal(C.craftRecipe('biome-'+material.id).success,false);
    assert.equal(C.getMatch(),null);
    assert.equal(C.craftGrid(),false);
    assert.equal(JSON.stringify(I.serialize()),saved);
    assert.equal(I.countItem(material.output),0);
    assert.equal(C.getRecipes().some(recipe=>recipe.id==='biome-'+material.id),false);
  }
});

test('biome blocks and items survive JSON inventory save and load alongside older equipment',()=>{
  const g=runtime(),I=g.Inventory;
  for(const material of g.BIOME_ITEMS){
    I.init(g.GAME_MODE.SURVIVAL);
    I.add(material.id,17);I.add(g.ITEM.IRON_PICKAXE,1);I.add(g.BIOMES[g.ITEMS[material.id].biome].resource,5);
    const saved=JSON.parse(JSON.stringify(I.serialize()));
    I.init(g.GAME_MODE.SURVIVAL,saved);
    assert.deepEqual(I.serialize(),saved);
    assert.equal(I.countItem(material.id),17);
    assert.equal(I.countItem(g.ITEM.IRON_PICKAXE),1);
  }
  assert.equal(g.BLOCK.LANTERN,74);assert.equal(g.ITEM.DIAMOND_SWORD,244);
});
