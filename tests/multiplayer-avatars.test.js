'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const THREE=require('../pogl-game/vendor/three.min.js'),Core=require('../js/game/multiplayer-core');
const source=fs.readFileSync(require.resolve('../js/game/remote-players.js'),'utf8');
const RemotePlayers=new Function('THREE','MultiplayerCore',source+';return RemotePlayers;')(THREE,Core);
test('remote avatars stay bounded, interpolate valid poses and release their scene resources',()=>{
  const scene=new THREE.Scene(),avatars=RemotePlayers.create(scene,'self00001');
  avatars.members(['self00001','guest0001','guest0002','guest0003','guest0004'].map(id=>({id,name:id})));
  assert.equal(avatars.count(),3);const mesh=scene.children[0].children[0];assert.equal(mesh.visible,false);
  avatars.pose('guest0001',{x:10,y:30,z:2,yaw:0,pitch:0,speed:1});assert.equal(mesh.visible,true);assert.equal(mesh.position.x,10);
  avatars.pose('guest0001',{x:12,y:30,z:2,yaw:1,pitch:.3,speed:1});avatars.update(.016);
  assert.ok(mesh.position.x>10&&mesh.position.x<12);assert.ok(mesh.rotation.y>0&&mesh.rotation.y<1);
  const x=mesh.position.x;avatars.pose('guest0001',{x:NaN,y:30,z:2,yaw:0,pitch:0});assert.equal(mesh.position.x,x);
  avatars.pose('guest0001',{x:12,y:30,z:2,yaw:1,pitch:0,dead:true});assert.equal(mesh.visible,false);
  let disposed=0;mesh.children[0].geometry.addEventListener('dispose',()=>disposed++);
  avatars.members([]);assert.equal(avatars.count(),0);assert.equal(disposed,1);
  avatars.dispose();assert.equal(scene.children.length,0);
});
