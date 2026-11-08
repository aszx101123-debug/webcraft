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

test('each biome has three exclusive survival drops with exact 60/30/10 intervals',()=>{
  const g=runtime(),seen=new Set();
  assert.equal(Object.values(g.BIOMES).reduce((n,b)=>n+b.chance,0),100);
  for(const [key,biome] of Object.entries(g.BIOMES)){
    assert.ok(g.isBlockId(biome.resource));assert.ok(g.isPlaceable(biome.resource));
    assert.equal(g.BLOCKS[biome.resource].biomeResource,key);
    const counts=new Map();
    for(let n=0;n<1000;n++){
      const id=g.getBlockDrop(biome.resource,()=> (n+.5)/1000,null);
      counts.set(id,(counts.get(id)||0)+1);
    }
    assert.deepEqual([...counts.values()],[600,300,100]);
    for(const [index,drop] of biome.loot.entries()){
      assert.equal(seen.has(drop.id),false);seen.add(drop.id);
      assert.equal(g.ITEMS[drop.id].biome,key);
      assert.equal(counts.get(drop.id),drop.chance*10);
      assert.equal(g.getBlockDrop(biome.resource,()=>[0,.6,.9][index]),drop.id);
    }
    assert.equal(g.getBlockDrop(biome.resource,()=>1),biome.loot[2].id);
  }
  assert.equal(seen.size,48);
});

test('all 48 collectible materials produce useful results through personal crafting without leftover inputs',()=>{
  const g=runtime(),I=g.Inventory,C=g.Crafting;
  assert.equal(g.BIOME_ITEMS.length,48);
  for(const material of g.BIOME_ITEMS){
    I.init(g.GAME_MODE.SURVIVAL);C.resetGrid(2);
    assert.equal(I.add(material.id,material.required),material.required);
    assert.equal(C.autofill('biome-'+material.id),true,material.id);
    assert.equal(C.getMatch()?.outputId,material.output);
    assert.equal(C.craftGrid(),true);
    assert.equal(I.countItem(material.id),0);
    assert.equal(I.countItem(material.output),material.count);
    assert.equal(I.serialize().filter(Boolean).reduce((n,s)=>n+s.count,0),material.count);
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
