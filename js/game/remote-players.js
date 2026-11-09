'use strict';

const RemotePlayers = (()=>{
  function create(scene,selfId,limit=3){
    const peers=new Map(),group=new THREE.Group();scene.add(group);
    const part=(w,h,d,color,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));mesh.position.set(x,y,z);return mesh;};
    function make(member){
      const mesh=new THREE.Group(),body=part(.5,.62,.27,0x438cc5,0,1.04,0),head=part(.44,.44,.43,0xcb9d79,0,1.57,0);
      const legs=[part(.21,.62,.23,0x37445d,-.13,.4,0),part(.21,.62,.23,0x37445d,.13,.4,0)];
      const arms=[part(.18,.62,.22,0x438cc5,-.35,1.03,0),part(.18,.62,.22,0x438cc5,.35,1.03,0)];
      mesh.add(body,head,...legs,...arms);
      head.add(part(.07,.055,.015,0x20272b,-.095,.03,-.222),part(.07,.055,.015,0x20272b,.095,.03,-.222));
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=48;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#151515b0';ctx.fillRect(0,0,256,48);ctx.font='bold 25px monospace';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(member.name,128,33);
        const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;
        const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));
        label.position.y=2.05;label.scale.set(1.7,.32,1);mesh.add(label);
      }
      mesh.visible=false;group.add(mesh);
      return {member,mesh,body,head,legs,arms,target:new THREE.Vector3(),yaw:0,pitch:0,speed:0,phase:0,colors:''};
    }
    function remove(id){const p=peers.get(id);if(!p)return;group.remove(p.mesh);p.mesh.traverse(object=>{object.geometry?.dispose();if(object.material){object.material.map?.dispose();object.material.dispose();}});peers.delete(id);}
    function members(roster){
      for(const id of [...peers.keys()])if(!roster.some(p=>p.id===id))remove(id);
      for(const member of roster)if(member.id!==selfId&&!peers.has(member.id)&&peers.size<Math.min(24,limit))peers.set(member.id,make(member));
      for(const id of [...peers.keys()])if(!roster.some(p=>p.id===id))remove(id);
    }
    function pose(id,value){
      const peer=peers.get(id);if(!peer||!MultiplayerCore.validPose(value))return;
      const first=!peer.mesh.visible;peer.mesh.visible=!value.dead;
      peer.target.set(value.x,value.y,value.z);peer.yaw=value.yaw;peer.pitch=value.pitch;peer.speed=Math.max(0,Math.min(12,value.speed||0));
      if(first)peer.mesh.position.copy(peer.target);
      const appearance=typeof WebCraftSkins!=='undefined'?WebCraftSkins.normalize(value.appearance):null;
      if(appearance&&JSON.stringify(appearance)!==peer.colors){
        peer.colors=JSON.stringify(appearance);
        const color=field=>WebCraftSkins.palettes[field][appearance[field]].value;
        peer.head.material.color.setHex(color('skin'));peer.body.material.color.setHex(color('shirt'));
        peer.arms.forEach(m=>m.material.color.setHex(color('shirt')));peer.legs.forEach(m=>m.material.color.setHex(color('pants')));
      }
    }
    function update(dt){
      for(const peer of peers.values()){
        peer.mesh.position.lerp(peer.target,Math.min(1,dt*14));
        let difference=(peer.yaw-peer.mesh.rotation.y)%(Math.PI*2);if(difference>Math.PI)difference-=Math.PI*2;if(difference< -Math.PI)difference+=Math.PI*2;
        peer.mesh.rotation.y+=difference*Math.min(1,dt*12);peer.head.rotation.x=Math.max(-.7,Math.min(.7,peer.pitch));
        peer.phase+=dt*peer.speed*2.4;const swing=Math.sin(peer.phase)*Math.min(1,peer.speed/3)*.5;
        peer.legs.forEach((leg,i)=>leg.rotation.x=swing*(i?-1:1));peer.arms.forEach((arm,i)=>arm.rotation.x=swing*(i?1:-1));
      }
    }
    function dispose(){for(const id of [...peers.keys()])remove(id);scene.remove(group);}
    return {members,pose,update,dispose,count:()=>peers.size};
  }
  return {create};
})();
