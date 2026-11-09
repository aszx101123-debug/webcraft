'use strict';

const gamePage = require('./helpers/game-page');
// Run with node tests/build-furniture.test.js (no third-party dependencies).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const core=new Function(src('js/game/config.js')+'\n'+src('js/game/items.js')+'\n'+src('js/game/mobile-test-crafting.js')+
'\nreturn {CONFIG,BLOCK,BLOCKS,ITEMS,ITEM,Inventory,Crafting,GAME_MODE,getItemDef,isBlockId,isPlaceable,isSolidBlock,getBlockBoxes,getBlockVisualBoxes,getItemName};')();
const {CONFIG,BLOCK,BLOCKS,ITEMS,ITEM,Inventory,Crafting,GAME_MODE,getItemDef,isBlockId,isPlaceable,isSolidBlock,getBlockBoxes,getBlockVisualBoxes,getItemName}=core;
let count=0;
const check=(label,fn)=>{fn();count++;console.log('PASS',label);};
check('original 40 block IDs unchanged with 4 visible building blocks',()=>{
 assert.equal(BLOCK.BOOKSHELF,40);assert.equal(BLOCK.STONE_SLAB,41);
 assert.equal(BLOCK.WOOD_STAIRS,42);assert.equal(BLOCK.WOOD_DOOR,43);
 assert.equal(BLOCK.CHEST,44);assert.equal(BLOCK.WOOD_DOOR_TOP,45);
 assert.equal(isPlaceable(BLOCK.WOOD_DOOR_TOP),false);
});
check('half slabs, rotating stairs and open doors have distinct AABBs',()=>{
 assert.equal(getBlockBoxes(BLOCK.STONE_SLAB,{half:'bottom'})[0][4],.5);
 assert.equal(getBlockBoxes(BLOCK.STONE_SLAB,{half:'top'})[0][1],.5);
 assert.equal(getBlockBoxes(BLOCK.WOOD_STAIRS,{facing:'north'})[1][5],.5);
 assert.equal(getBlockBoxes(BLOCK.WOOD_STAIRS,{facing:'south'})[1][2],.5);
 assert.equal(getBlockBoxes(BLOCK.WOOD_DOOR,{open:true}).length,0);
 assert.equal(getBlockVisualBoxes(BLOCK.WOOD_DOOR,{open:true}).length,1);
 assert.ok(getBlockBoxes(BLOCK.CHEST)[0][4]<1);
});
Inventory.init(GAME_MODE.SURVIVAL);
function craft(name,material,countNeeded,output,produced){
 Crafting.resetGrid(3);Inventory.add(material,countNeeded);
 assert.equal(Crafting.autofill(name),true,'cannot autofill '+name);
 assert.equal(Crafting.getMatch()?.id,name);
 assert.equal(Crafting.craftGrid(),true);
 assert.ok(Inventory.countItem(output)>=produced);
}
check('slab, stairs, doors and chests are craftable in 3x3 grid',()=>{
 craft('stone-slab',BLOCK.COBBLE,3,BLOCK.STONE_SLAB,6);
 craft('wood-stairs',BLOCK.PLANK,6,BLOCK.WOOD_STAIRS,4);
 craft('wood-door',BLOCK.PLANK,6,BLOCK.WOOD_DOOR,3);
 craft('storage-chest',BLOCK.PLANK,8,BLOCK.CHEST,1);
});
class Vec{constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}copy(o){return this.set(o.x,o.y,o.z)}}
class Group{constructor(){this.children=[]}add(...items){this.children.push(...items)}remove(item){this.children=this.children.filter(x=>x!==item)}}
class Geo{constructor(){this.attributes={}}setAttribute(k,v){this.attributes[k]=v}setIndex(x){this.index=x}dispose(){}}
class Mat{constructor(o){this.opts=o}}
class Mesh{constructor(geom,mat){this.geometry=geom;this.material=mat}}
class Light{constructor(){this.visible=false;this.position=new Vec()}}
const THREE={Vector3:Vec,Group,MeshLambertMaterial:Mat,MeshBasicMaterial:Mat,
PointLight:Light,Mesh,BufferGeometry:Geo,Float32BufferAttribute:class{constructor(arr,size){this.array=arr;this.itemSize=size}},
DoubleSide:2};
const Terrain={idx:(x,y,z)=>(x<<10)|(z<<6)|y,makeGen:()=>({
 heightAt:()=>1,genChunk:()=>{const a=new Uint8Array(16*16*64);
 for(let x=0;x<16;x++)for(let z=0;z<16;z++)a[Terrain.idx(x,0,z)]=BLOCK.BEDROCK;
 return a;}
})};
const Textures={getTexture:()=>({}),tileFor:()=>({u0:0,u1:1,v0:0,v1:1}),
 blockIcon:id=>'data:'+id};
class El{constructor(){this.children=[];this.classList={add(){},remove(){}};
 this.events={};this.style={};}replaceChildren(){this.children=[]}
 appendChild(el){this.children.push(el)}setAttribute(){}
 addEventListener(key,fn){this.events[key]=fn}
 click(){this.events.click?.()}}
const nodes=new Map();const document={getElementById:id=>{
 if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)},createElement:()=>new El()};
const Player={pos:new Vec(2,2,2)};
const drops=[];
const Drops={spawn:(id,count)=>drops.push({id,count})};
const UI={renderHotbar(){},showToast(){}};
const runtime=new Function('THREE','CONFIG','BLOCK','BLOCKS','Terrain','Textures','Player',
 'Inventory','UI','Drops','ITEMS','getItemDef','isBlockId','isPlaceable','isSolidBlock','getBlockBoxes','getBlockVisualBoxes','getItemName','document',
 src('js/game/voxel-lighting.js')+'\n'+src('js/game/world.js')+'\n'+src('js/game/block-furniture.js')+'\nreturn {World,BlockFurniture}')(THREE,CONFIG,BLOCK,BLOCKS,Terrain,Textures,Player,
 Inventory,UI,Drops,ITEMS,getItemDef,isBlockId,isPlaceable,isSolidBlock,getBlockBoxes,getBlockVisualBoxes,getItemName,document);
const {World,BlockFurniture}=runtime;const scene=new Group();
World.init(scene,173,null);World.update(2,2,0,1,1);BlockFurniture.init(null);
check('door installs as two linked blocks and can be toggled',()=>{
 assert.equal(BlockFurniture.place(2,1,2,BLOCK.WOOD_DOOR,'east'),true);
 assert.equal(World.getBlock(2,1,2),BLOCK.WOOD_DOOR);
 assert.equal(World.getBlock(2,2,2),BLOCK.WOOD_DOOR_TOP);
 assert.equal(BlockFurniture.toggleDoor(2,2,2),true);
 assert.equal(BlockFurniture.stateAt(2,2,2).open,true);
 assert.equal(getBlockBoxes(BLOCK.WOOD_DOOR,BlockFurniture.stateAt(2,1,2)).length,0);
 assert.equal(BlockFurniture.toggleDoor(2,1,2),false);
 assert.equal(World.getBlock(2,2,2),BLOCK.WOOD_DOOR_TOP);
});
check('shape meshes build with rotated stairs and half slab',()=>{
 assert.equal(BlockFurniture.place(4,1,4,BLOCK.WOOD_STAIRS,'west'),true);
 assert.equal(BlockFurniture.place(6,1,6,BLOCK.STONE_SLAB,'north','top'),true);
 World.update(2,2,0,1,2);
 const mesh=World.getChunk(0,0).mesh;
 assert.ok(mesh?.geometry?.attributes?.position?.array?.length>0);
 assert.equal(BlockFurniture.stateAt(6,1,6).half,'top');
 assert.equal(BlockFurniture.stateAt(4,1,4).facing,'west');
});
check('chest accepts item deposits and returns same stack',()=>{
 assert.equal(BlockFurniture.place(8,1,8,BLOCK.CHEST,'north'),true);
 assert.equal(BlockFurniture.openChest(8,1,8),true);
 const slot=Inventory.getSlots().findIndex(item=>item?.id===BLOCK.WOOD_STAIRS);
 const before=Inventory.countItem(BLOCK.WOOD_STAIRS);
 assert.ok(before>0);
 assert.equal(BlockFurniture.deposit(slot),true);
 assert.equal(Inventory.countItem(BLOCK.WOOD_STAIRS),0);
 const chest=BlockFurniture.stateAt(8,1,8).chest;
 const idx=chest.findIndex(s=>s?.id===BLOCK.WOOD_STAIRS);
 assert.ok(idx>=0);
 assert.equal(BlockFurniture.withdraw(idx),true);
 assert.equal(Inventory.countItem(BLOCK.WOOD_STAIRS),before);
 BlockFurniture.closeChest(false);
});
check('chest data remains intact across save, unload and new load',()=>{
 BlockFurniture.openChest(8,1,8);
 const slot=Inventory.getSlots().findIndex(item=>item?.id===BLOCK.WOOD_STAIRS);
 assert.equal(BlockFurniture.deposit(slot),true);
 BlockFurniture.closeChest(false);
 const edits=World.getEdits(),saved=BlockFurniture.serialize();
 assert.ok(saved.some(([name,item])=>name==='8,1,8'&&item.chest?.some(s=>s?.id===BLOCK.WOOD_STAIRS)));
 World.init(scene,173,edits);BlockFurniture.init(saved);
 World.update(2,2,0,1,2);
 assert.equal(World.getBlock(8,1,8),BLOCK.CHEST);
 assert.ok(BlockFurniture.stateAt(8,1,8).chest.some(x=>x?.id===BLOCK.WOOD_STAIRS));
});
check('breaking door top removes bottom and persistent state',()=>{
 assert.equal(World.getBlock(2,2,2),BLOCK.WOOD_DOOR_TOP);
 World.setBlock(2,2,2,BLOCK.AIR);
 assert.equal(World.getBlock(2,1,2),BLOCK.AIR);
 assert.equal(BlockFurniture.stateAt(2,1,2),null);
});
check('breaking a chest releases contents and removes metadata',()=>{
 const original= drops.length;
 BlockFurniture.releaseContents(8,1,8);
 assert.ok(drops.length>original);
 World.setBlock(8,1,8,BLOCK.AIR);
 assert.equal(BlockFurniture.stateAt(8,1,8),null);
});
check('old world without furniture metadata boots safely',()=>{
 BlockFurniture.init(undefined);
 assert.equal(BlockFurniture.serialize().length,0);
});
check('desktop and mobile pages load new storage UI scripts',()=>{
 for(const name of ['play.html','mobile-test.html']){
  const html=gamePage(name);
  assert.ok(html.includes('id="overlay-chest"'));
  assert.match(html,/block-furniture\.js\?v=v\d+/);
  assert.ok(html.includes('v133-build.css?v=v133'));
 }
});
check('remote edits survive unloading and reloading a previously unstreamed chunk',()=>{
 const x=3200,z=3200,y=12;
 assert.equal(World.applyRemoteBlock(x,y,z,BLOCK.DIRT),true);
 assert.equal(World.getBlock(x,y,z),BLOCK.DIRT);
 assert.ok(World.getEdits().some(([k])=>k==='200,200'));
 World.update(2,2,0,1,1);assert.equal(World.getChunk(200,200),undefined);
 World.ensureChunkAt(x,z);assert.equal(World.getBlock(x,y,z),BLOCK.DIRT);
 assert.equal(World.applyRemoteBlock(x,0,z,BLOCK.AIR),false);
 assert.equal(World.applyRemoteBlock(x,y,z,99999),false);
});
check('modern homepage and responsive script are connected',()=>{
 const html=src('index.html');
 assert.ok(html.includes('hero-showcase'));
 assert.ok(html.includes('class="nav-toggle"'));
 assert.ok(html.includes('css/v133-home.css?v=v133'));
 assert.ok(html.includes('js/v133-home.js?v=v133'));
});
console.log('All '+count+' building/furniture checks passed.');
