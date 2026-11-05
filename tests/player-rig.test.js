'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js/game/mobile-test-player-model.js'), 'utf8');
class Vector {
  constructor(){ this.set(0,0,0); }
  set(x,y,z){ Object.assign(this,{x,y,z}); return this; }
}
class Euler extends Vector {}
class Group {
  constructor(){
    this.children=[];this.position=new Vector();this.rotation=new Euler();
    this.scale={setScalar(v){this.value=v}};this.visible=true;
  }
  add(...items){this.children.push(...items);}
}
class Mesh extends Group {
  constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class BoxGeometry {
  constructor(w,h,d){Object.assign(this,{w,h,d});}
}
class Material {
  constructor(options){this.color=options.color;}
}
const THREE={Group,Mesh,BoxGeometry,MeshLambertMaterial:Material};
let offhand=null;
const Inventory={getEquipment:()=>({offhand})};
const PlayerModel=new Function('THREE','Inventory','CONFIG',code+'\nreturn PlayerModel;')(
  THREE,Inventory,{SPEED:4.4}
);
let checks=0;
function check(label,condition){
  assert.ok(condition,label);console.log('PASS',label);checks++;
}
const scene=new Group(),camera=new Group();
PlayerModel.init(scene,camera);
const view=camera.children[0], right=view.children[0], left=view.children[1];
const world=scene.children[0];
const p={dead:false,vel:{x:0,z:0},onGround:true,pos:{x:0,y:25,z:0},yaw:0,pitch:0};
check('sleeve, cuff and hand share a first-person arm pivot',right.children.length===3 && left.children.length===3);
const sleeve=right.children[0], cuff=right.children[1], hand=right.children[2];
check('first-person sleeve/cuff/hand connect without gaps',
  sleeve.position.y+sleeve.geometry.h/2 >= cuff.position.y-cuff.geometry.h/2 &&
  cuff.position.y+cuff.geometry.h/2 >= hand.position.y-hand.geometry.h/2);
PlayerModel.update(p,.016,false);
check('only main hand appears by default',view.visible && !left.visible && !world.visible);
const idleAngle=right.rotation.z;
p.vel.x=4.4;
for(let i=0;i<10;i++)PlayerModel.update(p,.016,false);
check('walk motion rotates the joined arm',Math.abs(right.rotation.z-idleAngle)>.001);
PlayerModel.swing();
for(let i=0;i<10;i++)PlayerModel.update(p,.016,false);
check('attack moves the entire arm naturally',right.rotation.z-idleAngle>.15);
for(let i=0;i<30;i++)PlayerModel.update(p,.016,false);
check('arm returns smoothly after attack',Math.abs(right.rotation.z-idleAngle)<.065);
offhand={id:1};
PlayerModel.update(p,.016,false);
check('second hand only appears with an offhand item',left.visible);
PlayerModel.update(p,.016,true);
check('third-person uses shoulder and hip pivot models',world.visible && !view.visible && world.children.slice(-4).every(l=>l.children.length>=2));
p.vel.x=0;
for(let i=0;i<35;i++)PlayerModel.update(p,.016,true);
check('third-person arm smoothly settles after walking',Math.abs(world.children[world.children.length-4].rotation.x)<.10);
console.log('All '+checks+' character-rig tests passed.');
