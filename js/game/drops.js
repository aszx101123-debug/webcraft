'use strict';

const Drops = (() => {
  let scene = null, group = null;
  let list = [];
  let onCollect = null;
  let network=null,nextNetworkId=1,nextPickupAt=0;

  function init(scene_, onCollect_) {
    scene = scene_;
    onCollect = onCollect_;
    group = new THREE.Group();
    scene.add(group);
  }

  function reset() {
    if (!group) return;
    while(list.length)remove(list.length-1);
  }

  function makeMesh(id) {
    const def = getItemDef(id);
    const tile = def.tiles.all || def.tiles.side || def.tiles.top;
    const t = Textures.tileUV(tile[0], tile[1]);
    const geo = new THREE.BoxGeometry(.3, .3, .3);
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const vi = f * 4;
      uv.setXY(vi, t.u0, t.v1);
      uv.setXY(vi + 1, t.u1, t.v1);
      uv.setXY(vi + 2, t.u0, t.v0);
      uv.setXY(vi + 3, t.u1, t.v0);
    }
    const mat = new THREE.MeshLambertMaterial({ map: Textures.getTexture(), alphaTest: .5 });
    return new THREE.Mesh(geo, mat);
  }

  function spawn(id, count, x, y, z, durability,origin) {
    if(network?.replica){if(!origin?.world)network.spawn?.({id,count,x,y,z,durability});return;}
    if (!group || !id) return;
    if(network&&list.length>=128)remove(0);
    const mesh = makeMesh(id);
    mesh.position.set(x, y, z);
    group.add(mesh);
    list.push({
      networkId:nextNetworkId++,
      id, count: count || 1, mesh, durability,
      vx: (Math.random() - .5) * 2.4,
      vy: 2.6 + Math.random() * 1.2,
      vz: (Math.random() - .5) * 2.4,
      age: 0, noPickup: .4
    });
  }

  function remove(i) {
    group.remove(list[i].mesh);
    list[i].mesh.geometry.dispose();
    list[i].mesh.material.dispose();
    list.splice(i, 1);
  }

  function update(dt, playerPos, canPickup) {
    if (!group) return;
    if(network?.replica){
      for(const d of list){
        d.mesh.position.lerp(d.target,Math.min(1,dt*14));d.mesh.rotation.y+=dt*2;
        if(canPickup&&!d.pending&&Date.now()>=nextPickupAt&&playerPos.distanceTo(d.target)<1.7&&Inventory.canAdd(d.id,1)){
          d.pending=true;nextPickupAt=Date.now()+200;
          Promise.resolve(network.pickup?.(d.networkId)).finally(()=>{d.pending=false;});
        }
      }
      return;
    }
    const solidAt = (x, y, z) => isSolidBlock(World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.age += dt;
      if (d.age > 300) { remove(i); continue; }
      d.noPickup -= dt;
      d.vy = Math.max(d.vy - 18 * dt, -20);
      let { x, y, z } = d.mesh.position;
      let nx = x + d.vx * dt, ny = y + d.vy * dt, nz = z + d.vz * dt;
      if (solidAt(nx, y - .15, z)) { nx = x; d.vx = 0; }
      if (solidAt(nx, y - .15, nz)) { nz = z; d.vz = 0; }
      let resting = false;
      if (d.vy <= 0 && solidAt(nx, ny - .15, nz)) {
        ny = Math.floor(ny - .15) + 1 + .15;
        d.vy = 0;
        d.vx *= .7;
        d.vz *= .7;
        resting = true;
      }
      if (resting && Math.abs(d.vx) < .05 && Math.abs(d.vz) < .05) {
        ny += Math.sin(d.age * 2.5) * .001;
        d.mesh.rotation.y += dt * 2.2;
      }
      d.mesh.position.set(nx, ny, nz);

      if (canPickup && d.noPickup <= 0) {
        const dx = playerPos.x - nx, dy = playerPos.y + .9 - ny, dz = playerPos.z - nz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 2.2 && dist > .01) {
          const pull = Math.min(1, 6 * dt / dist);
          d.mesh.position.set(nx + dx * pull, ny + dy * pull, nz + dz * pull);
        }
        if (dist < .75) {
          let added=0;
          const def=getItemDef(d.id);
          if((def.toolType||def.armorType)&&d.durability!==undefined){
            const empty=Inventory.getSlots().findIndex(s=>!s);
            if(empty>=0&&!Inventory.putIntoSlot(empty,{id:d.id,count:1,durability:d.durability}))added=1;
          }else added=Inventory.add(d.id,d.count);
          if (added > 0) {
            if (onCollect) onCollect(d.id, added);
            if (added >= d.count) { remove(i); continue; }
            d.count -= added;
          }
        }
      }
    }
  }

  function count() { return list.length; }

  function networkSnapshot(){
    const q=n=>Math.round(n*1000)/1000;
    return list.slice(0,128).map(d=>[d.networkId,d.id,d.count,q(d.mesh.position.x),q(d.mesh.position.y),q(d.mesh.position.z),d.durability||0]);
  }
  function applyNetwork(rows){
    if(!network?.replica||!Array.isArray(rows)||rows.length>128)return;
    const keep=new Set();
    for(const row of rows){
      if(!Array.isArray(row)||row.length!==7||!row.every(Number.isFinite)||!Number.isInteger(row[0])||!Number.isInteger(row[1])||
        !getItemDef(row[1])||!Number.isInteger(row[2])||row[2]<1||row[2]>64||row.slice(3,6).some(v=>Math.abs(v)>1000000))continue;
      let d=list.find(d=>d.networkId===row[0]);
      if(!d){const mesh=makeMesh(row[1]);mesh.position.set(row[3],row[4],row[5]);group.add(mesh);
        d={networkId:row[0],id:row[1],mesh,target:new THREE.Vector3(),pending:false};list.push(d);}
      if(d.id!==row[1])continue;
      d.count=row[2];d.durability=row[6]||undefined;d.target.set(row[3],row[4],row[5]);keep.add(d.networkId);
    }
    for(let i=list.length-1;i>=0;i--)if(!keep.has(list[i].networkId))remove(i);
  }
  function takeNetworkDrop(id,capacity,pos){
    const index=list.findIndex(d=>d.networkId===id);
    if(index<0||!Number.isInteger(capacity)||capacity<1||capacity>64)return null;
    const d=list[index];
    if(d.noPickup>0||d.mesh.position.distanceTo(pos)>2.6)return null;
    const stack={id:d.id,count:Math.min(capacity,d.count),...(d.durability?{durability:d.durability}:{})};
    d.count-=stack.count;if(d.count<=0)remove(index);return stack;
  }

  return { init, reset, spawn, update, count,networkSnapshot,applyNetwork,takeNetworkDrop,setNetwork:value=>{network=value;} };
})();
