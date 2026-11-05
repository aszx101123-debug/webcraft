'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const c=new Function(read('js/game/config.js')+
  '\nreturn {CONFIG,BLOCK,SURVIVAL,GAME_MODE,isSolidBlock,getBlockBoxes};')();
class Vec{
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(other){return this.set(other.x,other.y,other.z)}
}
const blocks=new Map(),states=new Map(),key=(x,y,z)=>x+','+y+','+z;
const World={
  getChunk:()=>({}),getBlock:(x,y,z)=>y===0?c.BLOCK.BEDROCK:(blocks.get(key(x,y,z))||c.BLOCK.AIR),
  getFluidLevel:()=>0
};
const BlockFurniture={stateAt:(x,y,z)=>states.get(key(x,y,z))||null};
const Player=new Function(
  'THREE','CONFIG','BLOCK','SURVIVAL','GAME_MODE','isSolidBlock',
  'getBlockBoxes','World','BlockFurniture','Inventory',
  read('js/game/player.js')+'\nreturn Player;'
)({Vector3:Vec},c.CONFIG,c.BLOCK,c.SURVIVAL,c.GAME_MODE,c.isSolidBlock,c.getBlockBoxes,
  World,BlockFurniture,{});
let passed=0;
function check(label,fn){fn();passed++;console.log('PASS',label);}
function tick(n,keys={}){for(let i=0;i<n;i++)Player.update(.016,keys)}
check('landing on a bottom slab uses height 0.5 rather than a full cube',()=>{
  blocks.set(key(2,1,2),c.BLOCK.STONE_SLAB);
  states.set(key(2,1,2),{half:'bottom'});
  Player.reset(2.5,4,2.5);
  tick(180);
  assert.ok(Math.abs(Player.pos.y-1.5)<.02,'y='+Player.pos.y);
});
check('placing a top slab makes a raised half-block floor',()=>{
  blocks.set(key(4,1,2),c.BLOCK.STONE_SLAB);
  states.set(key(4,1,2),{half:'top'});
  Player.reset(4.5,4,2.5);
  tick(180);
  assert.ok(Math.abs(Player.pos.y-2)<.02,'y='+Player.pos.y);
});
check('walking onto a stair automatically steps up one half level',()=>{
  blocks.set(key(3,1,2),c.BLOCK.WOOD_STAIRS);
  states.set(key(3,1,2),{facing:'south'});
  Player.reset(2.2,1,2.12,-Math.PI/2,0);
  tick(20,{KeyW:true});
  assert.ok(Player.pos.x>3,'x='+Player.pos.x);
  assert.ok(Player.pos.y>1.46,'y='+Player.pos.y);
});
check('opened doors are passable and do not count as solid floors',()=>{
  blocks.set(key(6,1,2),c.BLOCK.WOOD_DOOR);
  states.set(key(6,1,2),{facing:'north',open:true});
  Player.reset(6.5,4,2.5);
  tick(180);
  assert.ok(Math.abs(Player.pos.y-1)<.02,'y='+Player.pos.y);
});
console.log('All '+passed+' building collision checks passed.');
