'use strict';

const Drops = (() => {
  let scene = null, group = null;
  let list = [];
  let onCollect = null;

  function init(scene_, onCollect_) {
    scene = scene_;
    onCollect = onCollect_;
    group = new THREE.Group();
    scene.add(group);
  }

  function reset() {
    if (!group) return;
    list.forEach(d => group.remove(d.mesh));
    list = [];
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

  function spawn(id, count, x, y, z) {
    if (!group || !id) return;
    const mesh = makeMesh(id);
    mesh.position.set(x, y, z);
    group.add(mesh);
    list.push({
      id, count: count || 1, mesh,
      vx: (Math.random() - .5) * 2.4,
      vy: 2.6 + Math.random() * 1.2,
      vz: (Math.random() - .5) * 2.4,
      age: 0, noPickup: .4
    });
  }

  function remove(i) {
    group.remove(list[i].mesh);
    list[i].mesh.geometry.dispose();
    list.splice(i, 1);
  }

  function update(dt, playerPos, canPickup) {
    if (!group) return;
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
          const added = Inventory.add(d.id, d.count);
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

  return { init, reset, spawn, update, count };
})();
