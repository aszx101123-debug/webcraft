'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const {CONFIG,BLOCK,MOB_DEFS,SURVIVAL,GAME_MODE}=new Function(src('js/game/config.js')+
  '\nreturn {CONFIG,BLOCK,MOB_DEFS,SURVIVAL,GAME_MODE};')();
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS',name)};
class V {
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  clone(){return new V(this.x,this.y,this.z)}
  copy(v){return this.set(v.x,v.y,v.z)}
  addScaledVector(v,s){return this.set(this.x+v.x*s,this.y+v.y*s,this.z+v.z*s)}
  sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z)}
  multiplyScalar(n){return this.set(this.x*n,this.y*n,this.z*n)}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  normalize(){const n=Math.sqrt(this.lengthSq())||1;return this.multiplyScalar(1/n)}
}
class Col{
  constructor(value){this.value=value}
  getHex(){return this.value}
  setHex(value){this.value=value}
}
class Obj {
  constructor(){
    this.children=[];this.position=new V();this.rotation={x:0,y:0,z:0};
    this.userData={};this.visible=true;
    this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;},
      setScalar(n){this.x=this.y=this.z=n}};
  }
  add(...children){this.children.push(...children)}
  remove(child){this.children=this.children.filter(o=>o!==child)}
  traverse(fn){fn(this);for(const child of this.children)child.traverse(fn)}
}
class Mesh extends Obj{
  constructor(geometry,material){super();this.geometry=geometry;this.material=material}
}
class Geometry{
  constructor(...args){this.parameters={width:args[0],height:args[1],depth:args[2]}}
  dispose(){}
}
class Material{
  constructor(opts){this.color=new Col(opts.color);this.map=opts.map;}
  dispose(){}
}
class CanvasTexture{
  constructor(canvas){this.canvas=canvas;}
}
let tiles=0;
const document={
 createElement(tag){
   assert.equal(tag,'canvas');
   return {width:0,height:0,getContext:()=>({set fillStyle(_){},fillRect(){tiles++}})};
 }
};
const THREE={Group:Obj,Mesh,MeshLambertMaterial:Material,CanvasTexture,
  BoxGeometry:Geometry,TorusGeometry:Geometry,Vector3:V,NearestFilter:1};
const drops=[],world={block:null};
const World={getBlock:()=>world.block??BLOCK.AIR,getChunk:()=>({})};
const Drops={spawn:(id,count)=>drops.push({id,count})};
const Player={pos:new V(0,0,0),onGround:true,inWater:false,vel:new V(),dead:false,
  damage:()=>{}};
const Inventory={selectedTool:()=>null,damageSelectedTool:()=>{},selectedSlot:()=>null};
const UI={renderHotbar:()=>{}};
const clock={now:0},performance={now:()=>clock.now};
const Mobs=new Function('THREE','document','CONFIG','BLOCK','MOB_DEFS','MOB_CAPS',
  'SURVIVAL','GAME_MODE','World','Drops','Player','Inventory','UI','getItemName',
  'getBlockBoxes','isSolidBlock','performance',
  src('js/game/mobs.js')+'\nreturn Mobs;')(
    THREE,document,CONFIG,BLOCK,MOB_DEFS,{hostile:12,passive:10},SURVIVAL,GAME_MODE,
    World,Drops,Player,Inventory,UI,()=>'',()=>[[0,0,0,1,1,1]],
    id=>id!==BLOCK.AIR&&id!==BLOCK.WATER,performance);
Mobs.init(new Obj());Mobs.setMode(GAME_MODE.CREATIVE);
test('survival-ready mobs use revised original-world health pools',()=>{
  assert.equal(SURVIVAL.FIST_DMG,1);
  assert.equal(MOB_DEFS.zombie.hp,20);
  assert.equal(MOB_DEFS.skeleton.hp,20);
  assert.equal(MOB_DEFS.spider.hp,16);
  assert.equal(MOB_DEFS.pig.hp,10);
  assert.equal(MOB_DEFS.cow.hp,10);
  assert.equal(MOB_DEFS.sheep.hp,8);
});
const species=['pig','cow','sheep','chicken','zombie','skeleton','spider'];
const samples={};
test('all 7 mob bodies have enhanced procedural pixel detail',()=>{
  for(let i=0;i<species.length;i++){
    const type=species[i];
    const m=Mobs.spawn(type,type==='zombie'?0:8+i*2,0,2);
    assert.ok(m?.mesh,'no mesh for '+type);
    assert.ok(m.parts.detailGroup.children.length>=5,'missing detail '+type);
    assert.ok(m.mesh.children.length>=10,'low model complexity '+type);
    samples[type]=m;
  }
  assert.ok(tiles>500,'no generated original pixel textures');
});
test('zombies and skeletons have articulated arms; spiders have eight legs',()=>{
  assert.equal(samples.zombie.parts.arms.length,2);
  assert.equal(samples.skeleton.parts.arms.length,2);
  assert.equal(samples.spider.parts.extraLegs.length,4);
  assert.equal(samples.spider.parts.legs.length,8);
});
test('classic view keeps mob health bars hidden after a valid hit',()=>{
  const z=samples.zombie;
  assert.ok(z.parts.healthBar.group);
  assert.equal(z.parts.healthBar.group.visible,false);
  const target=Mobs.tryAttack(new V(0,1.6,0),new V(0,0,1),3.6);
  assert.equal(target,z);
  assert.equal(z.hp,19);
  assert.equal(z.healthVisibleT,1.8);
  assert.equal(Mobs.getLastAttackResult()?.landed,true);
  assert.equal(Mobs.getAttackCharge(),0);
  Mobs.update(.016,true);
  assert.equal(z.parts.healthBar.group.visible,false);
});
test('repeated quick clicking is gated; later clicks land without instant elimination',()=>{
  const z=samples.zombie;
  clock.now=100;
  Mobs.tryAttack(new V(0,1.6,0),new V(0,0,1),3.6);
  assert.equal(z.hp,19);
  assert.equal(Mobs.getLastAttackResult()?.landed,false);
  clock.now=470;z.hurtGrace=0;
  Mobs.tryAttack(new V(0,1.6,0),new V(0,0,1),3.6);
  assert.equal(z.hp,18);
  clock.now=940;z.hurtGrace=0;
  Mobs.tryAttack(new V(0,1.6,0),new V(0,0,1),3.6);
  assert.equal(z.hp,17);
  assert.equal(z.dead,false);
  clock.now=1500;
  assert.equal(Mobs.getAttackCharge(),1);
});
test('blocked line of sight prevents hits through voxel walls',()=>{
  const before=samples.zombie.hp;
  world.block=BLOCK.STONE;clock.now=2000;samples.zombie.hurtGrace=0;
  assert.equal(Mobs.tryAttack(new V(0,1.6,0),new V(0,0,1),3.6),null);
  assert.equal(samples.zombie.hp,before);
  world.block=null;
});
test('daylight spiders no longer suffer undead sunlight damage',()=>{
  const spider=samples.spider;
  const before=spider.hp;
  Mobs.setEnv(false,1);
  Mobs.update(.04,true);
  assert.equal(spider.hp,before);
});
test('farther mob detail layers are culled without deleting entities',()=>{
  const far=samples.chicken;
  far.pos.x=36;
  Mobs.update(.04,true);
  assert.equal(far.parts.detailGroup.visible,false);
  assert.ok(Mobs.counts().total>=7);
});
test('animals genuinely pause instead of walking constantly',()=>{
  const pig=samples.pig;
  pig.wanderT=3;
  pig.wanderMoving=false;
  pig.fleeT=0;
  pig.dir.set(1,0,0);
  pig.moving=true;
  Mobs.update(.016,true);
  assert.equal(pig.moving,false);
});
test('animal eye blink closes briefly and reopens naturally',()=>{
  const pig=samples.pig;
  assert.ok(pig.parts.eyes.length>=2);
  pig.blinkT=-1;
  pig.blinkDuration=0;
  Mobs.update(.016,true);
  assert.ok(pig.parts.eyes.every(o=>o.visible===false));
  pig.blinkT=6;
  pig.blinkDuration=.005;
  Mobs.update(.016,true);
  assert.ok(pig.parts.eyes.every(o=>o.visible===true));
});
console.log('All '+checks+' mob model/health tests passed.');
