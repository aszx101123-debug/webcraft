'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const THREE=require('../pogl-game/vendor/three.min.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const core=new Function(read('js/game/config.js')+';return {CONFIG,BLOCK,SURVIVAL,GAME_MODE,isSolidBlock,getBlockBoxes};')();
const {CONFIG,BLOCK,SURVIVAL,GAME_MODE,isSolidBlock,getBlockBoxes}=core;

function fixture(){
  const blocks=new Map(),levels=new Map(),key=(x,y,z)=>[x,y,z].join(',');
  const World={getChunk:()=>({}),getBlock:(x,y,z)=>blocks.get(key(x,y,z))||(y===0?BLOCK.BEDROCK:BLOCK.AIR),
    getFluidLevel:(x,y,z)=>levels.get(key(x,y,z))||0};
  const Player=new Function('THREE','CONFIG','BLOCK','SURVIVAL','GAME_MODE','World','BlockFurniture','Inventory','isSolidBlock','getBlockBoxes',
    read('js/game/player.js')+';return Player;')(THREE,CONFIG,BLOCK,SURVIVAL,GAME_MODE,World,{stateAt:()=>null},{},isSolidBlock,getBlockBoxes);
  Player.setMode(GAME_MODE.SURVIVAL);
  return {Player,block(x,y,z,id,level){blocks.set(key(x,y,z),id);if(level!==undefined)levels.set(key(x,y,z),level);},
    column(id=BLOCK.WATER){for(let y=1;y<=7;y++)this.block(0,y,0,id,8);},
    atHead(y){Player.reset(.5,y-1.62,.5);Player.update(0,{});}};
}

for(const id of [BLOCK.WATER,BLOCK.WATER_FLOW]){
  test('stacked water '+id+' has no dry gaps that hide underwater effects or refill air',()=>{
    const g=fixture();g.column(id);
    for(let head=2.1;head<7.8;head+=.025){
      g.atHead(head);
      assert.equal(g.Player.headSubmerged,true,'head height '+head.toFixed(3));
    }
    g.atHead(4.92);
    for(let i=0;i<3;i++)g.Player.survivalTick(1,false);
    assert.equal(g.Player.air,SURVIVAL.MAX_AIR-3,'air drains continuously inside a water column');
    g.Player.pos.x=2.5;g.Player.update(0,{});g.Player.survivalTick(.016,false);
    assert.equal(g.Player.headSubmerged,false);assert.equal(g.Player.inWater,false);
    assert.equal(g.Player.air,SURVIVAL.MAX_AIR,'breathing resumes after leaving the water');
  });
}

test('exposed water surfaces and shallow flowing water do not submerge a dry head',()=>{
  const g=fixture();g.column();
  g.atHead(7.86);assert.equal(g.Player.headSubmerged,true);
  g.atHead(7.90);assert.equal(g.Player.headSubmerged,false);
  const shallow=fixture();shallow.block(0,1,0,BLOCK.WATER_FLOW,1);
  shallow.Player.reset(.5,1.3,.5);shallow.Player.update(0,{});
  assert.equal(shallow.Player.inWater,false);assert.equal(shallow.Player.headSubmerged,false);
});

test('a flow without level metadata uses its rendered shallow height',()=>{
  const g=fixture();g.block(0,1,0,BLOCK.WATER_FLOW);
  g.Player.reset(.5,1.3,.5);g.Player.update(0,{});
  assert.equal(g.Player.inWater,false,'unknown flow must not become a full source for physics');
});

test('creative mode still reports underwater effects while leaving its air reserve unchanged',()=>{
  const g=fixture();g.column();g.Player.setMode(GAME_MODE.CREATIVE);g.atHead(4.92);
  assert.equal(g.Player.headSubmerged,true);
  g.Player.survivalTick(2,false);assert.equal(g.Player.air,SURVIVAL.MAX_AIR);
});
