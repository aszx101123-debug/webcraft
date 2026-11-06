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
const key=(x,y,z)=>x+','+y+','+z;
function fixture(){
  const blocks=new Map(),states=new Map();
  const World={
    getChunk:()=>({}),
    getBlock:(x,y,z)=>y===0?c.BLOCK.BEDROCK:(blocks.get(key(x,y,z))||c.BLOCK.AIR),
    getFluidLevel:()=>8
  };
  const Player=new Function('THREE','CONFIG','BLOCK','SURVIVAL','GAME_MODE',
    'isSolidBlock','getBlockBoxes','World','BlockFurniture','Inventory',
    read('js/game/player.js')+'\nreturn Player;')(
      {Vector3:Vec},c.CONFIG,c.BLOCK,c.SURVIVAL,c.GAME_MODE,c.isSolidBlock,
      c.getBlockBoxes,World,{stateAt:(x,y,z)=>states.get(key(x,y,z))||null},{});
  return {
    Player,
    block(x,y,z,id,state){blocks.set(key(x,y,z),id);if(state)states.set(key(x,y,z),state)},
    tick(n,keys={}){for(let i=0;i<n;i++)Player.update(.016,keys)},
    settle(x=.5,y=4,z=.5,yaw=0){Player.reset(x,y+.03,z,yaw,0);this.tick(20)}
  };
}
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}

check('Shift sneaks, Control sprints, and sneak wins when both are held',()=>{
  function travelled(keys){
    const f=fixture();f.settle(.5,1,.5);f.tick(60,keys);
    return {distance:.5-f.Player.pos.z,sneaking:f.Player.sneaking};
  }
  const walk=travelled({KeyW:true});
  const sneak=travelled({KeyW:true,ShiftLeft:true});
  const sprint=travelled({KeyW:true,ControlLeft:true});
  const both=travelled({KeyW:true,ControlRight:true,ShiftRight:true});
  assert.ok(sneak.distance<walk.distance*.4);
  assert.ok(sprint.distance>walk.distance*1.5);
  assert.equal(sneak.sneaking,true);
  assert.equal(sprint.sneaking,false);
  assert.ok(Math.abs(both.distance-sneak.distance)<.001);
});

check('sneaking stops at a raised block edge and releasing Shift permits falling',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);f.settle();
  f.tick(180,{KeyD:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x>1.2&&f.Player.pos.x<1.3,'x='+f.Player.pos.x);
  assert.ok(Math.abs(f.Player.pos.y-4)<.01);
  assert.equal(f.Player.onGround,true);
  f.tick(70,{KeyD:true});
  assert.ok(f.Player.pos.x>2);
  assert.ok(f.Player.pos.y<3);
  assert.equal(f.Player.sneaking,false);
});

check('diagonal sneaking slides along a ledge while keeping its ground support',()=>{
  const f=fixture();for(let z=-10;z<=10;z++)f.block(0,3,z,c.BLOCK.STONE);
  f.settle();f.tick(180,{KeyD:true,KeyW:true,ShiftRight:true});
  assert.ok(f.Player.pos.x>1.2&&f.Player.pos.x<1.3);
  assert.ok(f.Player.pos.z<-1.5,'z='+f.Player.pos.z);
  assert.ok(Math.abs(f.Player.pos.y-4)<.01);
});

check('diagonal sneaking cannot slip off a single-block corner',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);f.settle();
  f.tick(180,{KeyD:true,KeyS:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x>1.2&&f.Player.pos.x<1.3);
  assert.ok(f.Player.pos.z>1.2&&f.Player.pos.z<1.3);
  assert.ok(Math.abs(f.Player.pos.y-4)<.01);
});

check('bottom slabs provide support at their real half-block height',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE_SLAB,{half:'bottom'});
  f.settle(.5,3.5,.5);f.tick(120,{KeyD:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x>1.2&&f.Player.pos.x<1.3);
  assert.ok(Math.abs(f.Player.pos.y-3.5)<.01,'y='+f.Player.pos.y);
});

check('sneaking can descend safely onto a half-block lower slab',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);
  f.block(1,3,0,c.BLOCK.STONE_SLAB,{half:'bottom'});
  f.settle();f.tick(80,{KeyD:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x>1.5,'x='+f.Player.pos.x);
  assert.ok(Math.abs(f.Player.pos.y-3.5)<.02,'y='+f.Player.pos.y);
});

check('sneaking preserves automatic stair climbing and slab stepping',()=>{
  for(const [id,state] of [
    [c.BLOCK.STONE_SLAB,{half:'bottom'}],
    [c.BLOCK.WOOD_STAIRS,{facing:'east'}]
  ]){
    const f=fixture();f.block(1,1,0,id,state);f.settle(.5,1,.5);
    f.tick(50,{KeyD:true,ShiftLeft:true});
    assert.ok(f.Player.pos.x>1,'x='+f.Player.pos.x);
    assert.ok(f.Player.pos.y>1.46,'y='+f.Player.pos.y);
  }
});

check('an open door over a drop does not count as a safe floor',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);
  f.block(1,3,0,c.BLOCK.WOOD_DOOR,{facing:'north',open:true});
  f.settle();f.tick(120,{KeyD:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x<1.3);
  assert.ok(Math.abs(f.Player.pos.y-4)<.01);
});

check('sneak edge protection does not trap a jumping player in the air',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);f.settle(1.1);
  f.tick(25,{KeyD:true,ShiftLeft:true,Space:true});
  assert.ok(f.Player.pos.x>1.35,'x='+f.Player.pos.x);
  assert.ok(f.Player.pos.y>4);
});

check('water movement can leave the ledge while Shift is held',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);
  for(let x=-1;x<=5;x++)for(let y=4;y<=5;y++)f.block(x,y,0,c.BLOCK.WATER);
  f.settle();f.tick(180,{KeyD:true,ShiftLeft:true,Space:true});
  assert.ok(f.Player.pos.x>1.4,'x='+f.Player.pos.x);
});

check('creative flight bypasses ledge protection, Shift descends, and Control does not',()=>{
  const f=fixture();f.block(0,3,0,c.BLOCK.STONE);
  f.Player.reset(.5,8,.5,0,0,true);
  f.tick(30,{KeyD:true,ShiftLeft:true});
  assert.ok(f.Player.pos.x>2);
  assert.ok(f.Player.pos.y<7);
  assert.equal(f.Player.sneaking,false);
  f.Player.reset(.5,8,.5,0,0,true);
  f.tick(30,{KeyD:true,ControlLeft:true});
  assert.ok(Math.abs(f.Player.pos.y-8)<.001);
});

check('reset and respawn clear the sneak pose',()=>{
  const f=fixture();f.settle(.5,1,.5);f.tick(1,{ShiftLeft:true});
  assert.equal(f.Player.sneaking,true);
  f.Player.reset(.5,1,.5);assert.equal(f.Player.sneaking,false);
  f.tick(1,{ShiftLeft:true});f.Player.respawn();
  assert.equal(f.Player.sneaking,false);
});
console.log('All '+passed+' classic sneak checks passed.');
