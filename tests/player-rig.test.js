'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js/game/mobile-test-player-model.js'), 'utf8');
const shared = fs.readFileSync(path.join(__dirname, '..', 'js/skin-studio.js'), 'utf8');
const WebCraftSkins = new Function(shared + '\nreturn WebCraftSkins;')();
class Vector {
  constructor(){ this.set(0,0,0); }
  set(x,y,z){ Object.assign(this,{x,y,z}); return this; }
}
class Euler extends Vector {}
class Group {
  constructor(){
    this.children=[];this.position=new Vector();this.rotation=new Euler();this.userData={};
    this.scale={setScalar(v){this.value=v}};this.visible=true;
  }
  add(...items){this.children.push(...items);}
  remove(item){this.children=this.children.filter(x=>x!==item);}
}
class Mesh extends Group {
  constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class BoxGeometry {
  constructor(w,h,d){
    Object.assign(this,{w,h,d});
    this.attributes={uv:{getX:()=>0,getY:()=>1,setXY(){}}};
  }
  dispose(){}
}
class PlaneGeometry extends BoxGeometry {}
class Color {
  constructor(hex){this.hex=hex;}
  setHex(hex){this.hex=hex;return this;}
  multiplyScalar(value){this.hex=Math.floor(this.hex * value);return this;}
}
class Material {
  constructor(options){this.color=new Color(options.color||0);this.map=options.map;}
  dispose(){}
}
class TextureLoader {
  load(){return {dispose(){},magFilter:null,minFilter:null};}
}
const THREE={
  Group,Mesh,BoxGeometry,PlaneGeometry,MeshLambertMaterial:Material,
  MeshBasicMaterial:Material,TextureLoader,DoubleSide:2,NearestFilter:1
};
let offhand=null, selectedId=0;
const Inventory={
  getEquipment:()=>({offhand}),
  selectedId:()=>selectedId
};
const BLOCKS=[null,{name:'잔디',tiles:{all:[0,0]}}];
const Textures={
  tileFor:()=>({u0:0,u1:.1,v0:0,v1:.1}),
  getTexture:()=>({}),
  blockIcon:()=>('data:image/png;base64,AAA')
};
const getItemDef=id=>id>0?{name:'test'}:null;
const PlayerModel=new Function(
  'THREE','Inventory','CONFIG','BLOCKS','Textures','getItemDef','WebCraftSkins',code+'\nreturn PlayerModel;'
)(THREE,Inventory,{SPEED:4.4},BLOCKS,Textures,getItemDef,WebCraftSkins);
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
selectedId=1;
PlayerModel.update(p,.016,false);
check('selected block attaches a textured 3D cube to both hand rigs',
  right.children.some(item=>item.geometry instanceof BoxGeometry) &&
  world.children[world.children.length-3].children.some(item=>item.geometry instanceof BoxGeometry));
selectedId=240;
PlayerModel.update(p,.016,false);
check('switching to a tool replaces cube with pixel item sprite',
  right.children.slice(3).some(item=>item.geometry instanceof PlaneGeometry) &&
  !right.children.slice(3).some(item=>item.geometry.constructor===BoxGeometry));
selectedId=0;
offhand=null;
PlayerModel.update(p,.016,false);
check('empty hand removes equipped sprites',right.children.length===3);
const updated=PlayerModel.setAppearance({skin:2,hair:3,shirt:4,pants:1,boots:2,hairStyle:'long'});
check('customization colors and hairstyles update together',
  updated.skin===2 && updated.shirt===4 && updated.hairStyle==='long');
check('new accessories and clothing textures validate correctly',
  PlayerModel.setAppearance({...updated,shirtStyle:'hoodie',accessory:'glasses',eyes:'blue'}).accessory === 'glasses');
check('world model material changes when shirt color changes',
  world.children[0].material.color.hex===PlayerModel.getPalettes().shirt[4].value);
const invalid=PlayerModel.setAppearance({skin:100,shirt:-7,hairStyle:'unknown'});
check('invalid appearance choices revert to stable defaults',
  invalid.skin===1 && invalid.shirt===0 && invalid.hairStyle==='short');
let drawCount=0;
const ctx={clearRect(){},fillRect(){drawCount++},save(){},restore(){},scale(){},set fillStyle(value){}};
PlayerModel.drawPreview({width:164,height:224,getContext:()=>ctx});
check('E inventory avatar preview renders blocky character',drawCount>15);
console.log('All '+checks+' character-rig tests passed.');
