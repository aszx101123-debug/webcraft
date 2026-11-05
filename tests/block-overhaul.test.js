'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name);}
const {CONFIG,BLOCK,BLOCKS,ITEM,PLACEABLE_IDS,isFallingBlock,isPlaceable,getBlockCategory,getBlockDrop,Inventory,Crafting,GAME_MODE}=new Function(
  [src('js/game/config.js'),src('js/game/items.js'),src('js/game/mobile-test-crafting.js')].join('\n')+
  '\nreturn {CONFIG,BLOCK,BLOCKS,ITEM,PLACEABLE_IDS,isFallingBlock,isPlaceable,getBlockCategory,getBlockDrop,Inventory,Crafting,GAME_MODE}'
)();
check('all original block IDs are preserved and 14 new IDs appended',()=>{
  assert.equal(BLOCK.TORCH,26);assert.equal(BLOCK.WATER_FLOW,23);
  assert.equal(BLOCK.GRAVEL,27);assert.equal(BLOCK.BOOKSHELF,40);
  assert.equal(BLOCKS.length,41);
  for(let id=1;id<=40;id++)assert.ok(BLOCKS[id]?.tiles,'Missing block '+id);
});
check('every new block is accessible from creative selection',()=>{
  for(let id=27;id<=40;id++)assert.ok(PLACEABLE_IDS.includes(id),id);
  assert.equal(isPlaceable(BLOCK.WATER_FLOW),false);
  assert.equal(isPlaceable(BLOCK.BEDROCK),false);
});
check('block categories and fallable types are valid',()=>{
  assert.equal(getBlockCategory(BLOCK.STONE_BRICKS),'석재');
  assert.equal(getBlockCategory(BLOCK.BIRCH_LOG),'목재');
  assert.equal(getBlockCategory(BLOCK.DIAMOND_ORE),'광석');
  assert.equal(isFallingBlock(BLOCK.GRAVEL),true);
  assert.equal(isFallingBlock(BLOCK.SAND),true);
  assert.equal(isFallingBlock(BLOCK.STONE),false);
});
check('glass breaks without drops, leaves have controlled drops',()=>{
  assert.equal(getBlockDrop(BLOCK.GLASS,()=>0,null),0);
  assert.equal(getBlockDrop(BLOCK.BIRCH_LEAVES,()=>0,null),ITEM.APPLE);
  assert.equal(getBlockDrop(BLOCK.SPRUCE_LEAVES,()=>0,null),ITEM.STICK);
  assert.equal(getBlockDrop(BLOCK.GRAVEL,()=>0,null),BLOCK.GRAVEL);
  assert.equal(getBlockDrop(BLOCK.SPRUCE_LEAVES,()=>1,{toolType:'hoe',tier:1}),BLOCK.SPRUCE_LEAVES);
  assert.equal(getBlockDrop(BLOCK.BIRCH_LEAVES,()=>1,{toolType:'hoe',tier:1}),BLOCK.BIRCH_LEAVES);
});
Inventory.init(GAME_MODE.SURVIVAL);
function craft(id,materials,expected,qty){
  Crafting.setGridSize(3);Crafting.resetGrid(3);
  for(const [material,count] of materials)Inventory.add(material,count);
  assert.equal(Crafting.autofill(id),true,'Recipe '+id);
  assert.equal(Crafting.getMatch()?.id,id);
  assert.equal(Crafting.craftGrid(),true);
  assert.ok(Inventory.countItem(expected)>=qty,'Craft output for '+id);
}
check('new wood, sandstone, stone brick and moss recipes craft',()=>{
  craft('birch-planks',[[BLOCK.BIRCH_LOG,1]],BLOCK.BIRCH_PLANKS,4);
  craft('spruce-planks',[[BLOCK.SPRUCE_LOG,1]],BLOCK.SPRUCE_PLANKS,4);
  craft('sandstone',[[BLOCK.SAND,4]],BLOCK.SANDSTONE,1);
  craft('polished-stone',[[BLOCK.COBBLE,4]],BLOCK.POLISHED_STONE,4);
  craft('stone-bricks',[[BLOCK.STONE,4]],BLOCK.STONE_BRICKS,4);
  craft('mossy-cobble-oak',[[BLOCK.COBBLE,1],[BLOCK.LEAVES,1]],BLOCK.MOSSY_COBBLE,1);
});
check('furnace bookshelf recipe retains exact 3x3 pattern',()=>{
  craft('bookshelf',[[BLOCK.PLANK,6],[ITEM.LEATHER,3]],BLOCK.BOOKSHELF,1);
});
const board=new Map(), listeners=new Set();
const pkey=(x,y,z)=>x+','+y+','+z;
const World={
  getChunk:()=>({}),
  getBlock:(x,y,z)=>y===0?BLOCK.BEDROCK:(board.get(pkey(x,y,z))||BLOCK.AIR),
  setBlock(x,y,z,id){
    if(y<=0||y>=CONFIG.HEIGHT)return false;
    const key=pkey(x,y,z),old=board.get(key)||BLOCK.AIR;
    if(old===id)return false;
    if(id===BLOCK.AIR)board.delete(key);else board.set(key,id);
    for(const fn of listeners)fn(x,y,z,id,old);
    return true;
  },
  onBlockChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
};
const BlockPhysics=new Function('CONFIG','BLOCK','World','isFallingBlock',
  src('js/game/block-physics.js')+'\nreturn BlockPhysics;')(CONFIG,BLOCK,World,isFallingBlock);
check('sand and gravel fall after support blocks are mined',()=>{
  World.setBlock(0,1,0,BLOCK.STONE);
  World.setBlock(0,2,0,BLOCK.STONE);
  World.setBlock(0,3,0,BLOCK.SAND);
  BlockPhysics.init();
  assert.ok(World.setBlock(0,2,0,BLOCK.AIR));
  BlockPhysics.update(.09);
  assert.equal(World.getBlock(0,3,0),BLOCK.AIR);
  assert.equal(World.getBlock(0,2,0),BLOCK.SAND);
  World.setBlock(1,1,0,BLOCK.STONE);
  World.setBlock(1,2,0,BLOCK.GRAVEL);
  BlockPhysics.update(.09);
  assert.equal(World.getBlock(1,2,0),BLOCK.GRAVEL);
  World.setBlock(1,1,0,BLOCK.AIR);
  BlockPhysics.update(.09);
  assert.equal(World.getBlock(1,1,0),BLOCK.GRAVEL);
});
check('falling block queue remains bounded and settles on solid ground',()=>{
  for(let i=0;i<1000;i++)BlockPhysics.schedule(i,40,0);
  assert.ok(BlockPhysics.pendingCount()<=768);
  for(let i=0;i<30;i++)BlockPhysics.update(.09);
  assert.equal(BlockPhysics.pendingCount(),0);
});
const cells=new Set();
class CanvasTexture{constructor(canvas){this.image=canvas;}}
const THREE={CanvasTexture,NearestFilter:1};
const document={
  createElement(kind){
    assert.equal(kind,'canvas');
    const canvas={width:0,height:0};
    canvas.getContext=()=>({
      fillStyle:'',imageSmoothingEnabled:false,
      fillRect(x,y,w,h){if(w===1&&h===1)cells.add(Math.floor(x/16)+','+Math.floor(y/16));},
      drawImage(){},save(){},restore(){},setTransform(){},clearRect(){}
    });
    canvas.toDataURL=()=>('data:image/png;base64,TEST');
    return canvas;
  }
};
const Noise={mulberry32:seed=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}}};
const Textures=new Function('document','THREE','Noise','BLOCKS','ITEMS',
  src('js/game/mobile-test-textures.js')+'\nreturn Textures;')(
  document,THREE,Noise,BLOCKS,Object.fromEntries(Object.entries(ITEM).map(([k,id])=>[id,{tiles:{all:[0,5]}}]))
);
check('upgraded 12x12 atlas paints every new block tile',()=>{
  Textures.init();
  assert.equal(Textures.getAtlas().width,192);
  for(const [col,row] of [[10,0],[11,0],[10,1],[11,1],[10,2],[11,2],[10,3],[11,3],[10,4],[11,4],[10,5],[11,5],[10,6],[11,6],[10,7],[11,7],[10,8],[11,8]])
    assert.ok(cells.has(col+','+row),'Missing pixel art tile '+col+','+row);
  for(let id=27;id<=40;id++) {
    const uv=Textures.tileFor(id,'side');
    assert.ok(uv.u0>=0&&uv.u1<=1&&uv.v0>=0&&uv.v1<=1);
    assert.ok(uv.u1>uv.u0&&uv.v1>uv.v0);
    assert.ok(Textures.blockIcon(id).startsWith('data:image/'));
  }
});
console.log('All '+checks+' block-overhaul checks passed.');
