'use strict';

// WebCraft character rig: each sleeve and hand share one shoulder/arm pivot.
// The first-person camera rig is separate from the third-person world model.
const PlayerModel = (() => {
  let worldModel = null;
  let firstPerson = null;
  let viewRight = null;
  let viewLeft = null;
  let limbs = null;
  let walkPhase = 0;
  let walkWeight = 0;
  let attackTime = 1;

  const ATTACK_DURATION = .34;

  // Original cosmetic palettes change the avatar only, not game statistics.
  const palettes = WebCraftSkins.palettes;
  const defaults = WebCraftSkins.defaults;
  let appearance = {...defaults};
  let bodyMaterials = null, hairBits = null, detailBits = null;
  let heldMain = null, heldOff = null, heldMainId = 0, heldOffId = 0;
  let worldRight = null, worldLeft = null;

  function normalizeAppearance(next) { return WebCraftSkins.normalize(next); }
  function getAppearance() { return { ...appearance }; }
  function getPalettes() { return palettes; }
  function colorCss(field) {
    return '#' + palettes[field][appearance[field]].value.toString(16).padStart(6, '0');
  }
  function setAppearance(next) {
    appearance = normalizeAppearance(next);
    if (bodyMaterials) {
      for (const field of ['skin','hair','shirt','pants','boots'])
        bodyMaterials[field].color.setHex(palettes[field][appearance[field]].value);
      bodyMaterials.cuff.color.setHex(palettes.shirt[appearance.shirt].value);
      bodyMaterials.cuff.color.multiplyScalar(.75);
    }
    if (hairBits) {
      hairBits.fringe.visible = appearance.hairStyle === 'fringe';
      hairBits.longL.visible = appearance.hairStyle === 'long';
      hairBits.longR.visible = appearance.hairStyle === 'long';
      hairBits.parted.visible = appearance.hairStyle === 'parted';
    }
    if (detailBits) {
      const {stripe,badge,hoodie,glasses,scarf,headband,eyes,armStripes} = detailBits;
      stripe.forEach(node=>node.visible = appearance.shirtStyle==='stripe');
      badge.visible = appearance.shirtStyle==='badge';
      hoodie.forEach(node=>node.visible = appearance.shirtStyle==='hoodie');
      glasses.forEach(node=>node.visible = appearance.accessory==='glasses');
      scarf.forEach(node=>node.visible = appearance.accessory==='scarf');
      headband.visible = appearance.accessory==='headband';
      armStripes.forEach(node=>node.visible = appearance.shirtStyle==='stripe');
      eyes.color.setHex({dark:0x20252b,brown:0x68442d,blue:0x2876b9}[appearance.eyes]);
    }
    return getAppearance();
  }


  function material(color) {
    return color && typeof color === 'object' ? color : new THREE.MeshLambertMaterial({ color });
  }

  function cube(w, h, d, color, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z);
    return mesh;
  }

  function joint(x, y, z) {
    const node = new THREE.Group();
    node.position.set(x, y, z);
    return node;
  }

  function viewArm(sign, shirt, cuff, skin) {
    // The arm enters the screen from its lower corner, reaching in toward
    // the crosshair. The hand is a child of the same pivot as the sleeve.
    const arm = joint(sign * .66, -.84, -1.03);
    arm.add(cube(.27, .48, .30, shirt, 0, .25, 0));
    arm.add(cube(.273, .07, .307, cuff, 0, .51, 0));
    arm.add(cube(.27, .27, .30, skin, 0, .66, 0));
    arm.rotation.z = sign * .34;
    arm.rotation.y = -sign * .10;
    return arm;
  }

  function worldArm(sign, shirt, cuff, skin) {
    // Shoulder at the top of the torso; sleeves and hands turn together.
    const arm = joint(sign * .51, 1.60, 0);
    arm.add(cube(.245, .31, .29, shirt, 0, -.165, 0));
    arm.add(cube(.248, .045, .294, cuff, 0, -.34, 0));
    arm.add(cube(.245, .42, .29, skin, 0, -.575, 0));
    arm.rotation.z = sign * -.055;
    return arm;
  }

  function worldLeg(sign, pants, boots) {
    // Pivot around the hip, not the center of the shin.
    const leg = joint(sign * .20, .84, 0);
    leg.add(cube(.29, .67, .31, pants, 0, -.34, 0));
    leg.add(cube(.30, .18, .35, boots, 0, -.74, .025));
    return leg;
  }

  function init(scene, camera) {
    const skin = material(0xd5a57f);
    const hair = material(0x4b3428);
    const shirt = material(0x2f8c90);
    const cuff = material(0x226a70);
    const pants = material(0x33435f);
    const boots = material(0x24262c);
    bodyMaterials = { skin, hair, shirt, cuff, pants, boots };

    worldModel = new THREE.Group();
    worldModel.add(cube(.74, .82, .42, shirt, 0, 1.23, 0));
    worldModel.add(cube(.68, .08, .46, cuff, 0, 1.66, 0));

    const head = joint(0, 2.03, 0);
    head.add(cube(.62, .62, .62, skin));
    head.add(cube(.66, .18, .66, hair, 0, .33, 0));
    const fringe = cube(.66, .22, .12, hair, 0, .15, .31);
    head.add(fringe);
    const longL = cube(.14, .52, .60, hair, -.39, -.24, 0);
    const longR = cube(.14, .52, .60, hair, .39, -.24, 0);
    head.add(longL, longR);
    const parted = cube(.24,.22,.14,hair,-.20,.16,.32);
    head.add(parted);
    hairBits = { fringe, longL, longR, parted };
    const eyes = material(0x20252b);
    head.add(cube(.075, .075, .03, eyes, .15, .02, .315));
    head.add(cube(.075, .075, .03, eyes, -.15, .02, .315));
    head.add(cube(.019, .019, .012, 0xe7eae1, .135, .035, .335));
    head.add(cube(.019, .019, .012, 0xe7eae1, -.165, .035, .335));
    head.add(cube(.11, .06, .035, 0x8f4a43, 0, -.14, .315));
    worldModel.add(head);

    // Pixel geometry layers: shirt patterns, baggy hoodie, scarf and eyewear.
    // Cosmetic-only mesh accents are kept separate from the base colored materials.
    const stripe = [
      cube(.72,.065,.014,0xc9d7bf,0,1.39,.221),
      cube(.72,.04,.014,0x415568,0,1.17,.221)
    ];
    worldModel.add(...stripe);
    const badge = cube(.17,.19,.02,0xe0bd67,.21,1.38,.231);
    const badgeCenter = cube(.095,.10,.026,0x294c65,.21,1.38,.249);
    badge.add(badgeCenter);worldModel.add(badge);
    const hoodie = [
      cube(.35,.19,.018,cuff,0,1.11,.237),
      cube(.033,.23,.03,0xe0e1d4,-.09,1.42,.247),
      cube(.033,.23,.03,0xe0e1d4,.09,1.42,.247),
      cube(.62,.12,.10,cuff,0,1.71,-.10)
    ];
    worldModel.add(...hoodie);
    const glasses = [
      cube(.22,.035,.035,0xc6d7e2,-.17,.075,.354),
      cube(.22,.035,.035,0xc6d7e2,.17,.075,.354),
      cube(.04,.17,.03,0xc6d7e2,-.29,.01,.356),
      cube(.04,.17,.03,0xc6d7e2,-.05,.01,.356),
      cube(.04,.17,.03,0xc6d7e2,.05,.01,.356),
      cube(.04,.17,.03,0xc6d7e2,.29,.01,.356)
    ];
    // Glasses and headband follow the head when it rotates.
    head.add(...glasses);
    const scarf = [
      cube(.70,.13,.46,0xd7a05a,0,1.72,.01),
      cube(.13,.37,.07,0xb66b45,.27,1.48,.29)
    ]; worldModel.add(...scarf);
    const headband = cube(.67,.075,.67,0xcfab54,0,.21,0);
    head.add(headband);
    const armStripes = [];

    const armL = worldArm(-1, shirt, cuff, skin);
    const armR = worldArm(1, shirt, cuff, skin);
    const legL = worldLeg(-1, pants, boots);
    const legR = worldLeg(1, pants, boots);
    worldModel.add(armL, armR, legL, legR);
    const armStripeL = cube(.25,.062,.30,0xbfcfbd,0,-.25,0);
    const armStripeR = cube(.25,.062,.30,0xbfcfbd,0,-.25,0);
    armL.add(armStripeL);armR.add(armStripeR);
    armStripes.push(armStripeL,armStripeR);
    // Stitched trousers and laces make the skin read as pixel clothing from a distance.
    legL.add(cube(.17,.12,.013,0x45536c,0,-.21,.164));
    legR.add(cube(.17,.12,.013,0x45536c,0,-.21,.164));
    legL.add(cube(.10,.025,.012,0xc9d2d1,0,-.72,.203));
    legR.add(cube(.10,.025,.012,0xc9d2d1,0,-.72,.203));
    detailBits = {stripe,badge,hoodie,glasses,scarf,headband,eyes,armStripes};
    worldLeft = armL;
    worldRight = armR;
    limbs = { armL, armR, legL, legR, head };

    worldModel.scale.setScalar(.78);
    worldModel.visible = false;
    scene.add(worldModel);

    firstPerson = new THREE.Group();
    viewRight = viewArm(1, shirt, cuff, skin);
    viewLeft = viewArm(-1, shirt, cuff, skin);
    firstPerson.add(viewRight, viewLeft);
    firstPerson.visible = false;
    camera.add(firstPerson);
    heldMainId = heldOffId = -1;
    setAppearance(appearance);
    updateHeldItems();
  }

  // A held block is a real cube with the existing terrain atlas on all faces.
  // Tools, swords and other items use their original pixel-art inventory sprite.
  function heldMesh(id, firstPersonView) {
    if (!Number.isInteger(id) || id <= 0) return null;
    if (id < 100 && BLOCKS[id]) {
      const size = firstPersonView ? .37 : .25;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const uv = geometry.attributes.uv;
      const faces = ['side','side','top','bottom','side','side'];
      for (let face = 0; face < 6; face++) {
        const area = Textures.tileFor(id, faces[face]);
        for (let vertex = 0; vertex < 4; vertex++) {
          const index = face * 4 + vertex;
          const u = uv.getX(index), v = uv.getY(index);
          uv.setXY(index, area.u0 + u * (area.u1 - area.u0), area.v0 + v * (area.v1 - area.v0));
        }
      }
      uv.needsUpdate = true;
      const item = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        map: Textures.getTexture(), transparent: !!BLOCKS[id].cutout,
        alphaTest: .12, depthWrite: !firstPersonView, depthTest: !firstPersonView
      }));
      item.rotation.set(.30, .58, -.30);
      item.userData.heldSharedTexture = true;
      return item;
    }
    if (!getItemDef(id)) return null;
    const iconTexture = new THREE.TextureLoader().load(Textures.blockIcon(id));
    iconTexture.magFilter = THREE.NearestFilter;
    iconTexture.minFilter = THREE.NearestFilter;
    const item = new THREE.Mesh(
      new THREE.PlaneGeometry(firstPersonView ? .52 : .34, firstPersonView ? .52 : .34),
      new THREE.MeshBasicMaterial({
        map: iconTexture, transparent: true, alphaTest: .10,
        side: THREE.DoubleSide, depthWrite: !firstPersonView, depthTest: !firstPersonView
      })
    );
    item.rotation.set(-.18, -.13, -.42);
    item.userData.heldSharedTexture = false;
    return item;
  }

  function discardHeld(record, parents) {
    if (!record) return;
    for (const [key, parent] of Object.entries(parents)) {
      const object = record[key];
      if (!object) continue;
      parent.remove(object);
      object.geometry?.dispose();
      if (!object.userData.heldSharedTexture) object.material?.map?.dispose();
      object.material?.dispose();
    }
  }

  function equippedItemId(key) {
    const stack = Inventory.getEquipment()?.[key];
    return stack && Number.isInteger(stack.id) ? stack.id : 0;
  }
  function updateHeldItems() {
    const selectedId = typeof Inventory.selectedId === 'function' ? Inventory.selectedId() : 0;
    if (selectedId !== heldMainId) {
      discardHeld(heldMain, { view: viewRight, world: worldRight });
      heldMain = { view: heldMesh(selectedId, true), world: heldMesh(selectedId, false) };
      if (heldMain.view) {
        heldMain.view.position.set(.03, .91, -.12);
        viewRight.add(heldMain.view);
      }
      if (heldMain.world) {
        heldMain.world.position.set(.035, -.91, .14);
        worldRight.add(heldMain.world);
      }
      heldMainId = selectedId;
    }
    const offhandId = equippedItemId('offhand');
    if (offhandId !== heldOffId) {
      discardHeld(heldOff, { view: viewLeft, world: worldLeft });
      heldOff = { view: heldMesh(offhandId, true), world: heldMesh(offhandId, false) };
      if (heldOff.view) {
        heldOff.view.position.set(-.03, .91, -.12);
        viewLeft.add(heldOff.view);
      }
      if (heldOff.world) {
        heldOff.world.position.set(-.035, -.91, .14);
        worldLeft.add(heldOff.world);
      }
      heldOffId = offhandId;
    }
  }

  // Character preview uses a lightweight 2D canvas to avoid a second WebGL
  // context on low-memory mobile devices.
  function drawPreview(canvas, rear = false) {
    return WebCraftSkins.draw(canvas,appearance,rear,Inventory.getEquipment());
  }

  function swing() {
    // Replay a full, smooth arc for each new click.
    attackTime = 0;
  }

  function update(player, dt, thirdPerson) {
    if (!worldModel || !firstPerson) return;
    const delta = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .05));
    const visible = !player.dead;
    firstPerson.visible = visible && !thirdPerson;
    worldModel.visible = visible && !!thirdPerson;

    const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z);
    const walking = visible && player.onGround && horizontalSpeed > .22;
    const targetWeight = walking ? Math.min(1, horizontalSpeed / Math.max(.1, CONFIG.SPEED)) : 0;
    walkWeight += (targetWeight - walkWeight) * Math.min(1, delta * 9);
    if (walking) walkPhase += Math.min(horizontalSpeed, 8.5) * delta * 2.35;
    const step = Math.sin(walkPhase) * walkWeight;
    const bounce = (1 - Math.cos(walkPhase * 2)) * .011 * walkWeight;

    attackTime = Math.min(ATTACK_DURATION, attackTime + delta);
    const progress = attackTime / ATTACK_DURATION;
    const attack = attackTime < ATTACK_DURATION
      ? Math.pow(Math.sin(Math.PI * progress), 2)
      : 0;

    updateHeldItems();
    const hasOffhand = !!Inventory.getEquipment().offhand;
    viewLeft.visible = hasOffhand;
    viewRight.position.set(.66, -.84 + bounce - attack * .045, -1.03 - attack * .105);
    viewRight.rotation.set(.10 + step * .045 - attack * .38, -.10,
      .34 + step * .028 + attack * .36);

    if (hasOffhand) {
      viewLeft.position.set(-.66, -.84 + bounce, -1.03);
      viewLeft.rotation.set(.10 - step * .045, .10, -.34 - step * .028);
    }

    if (!thirdPerson || !visible) return;
    worldModel.position.set(player.pos.x, player.pos.y, player.pos.z);
    worldModel.rotation.y = player.yaw + Math.PI;

    // Opposite arm/leg swings are driven by hip and shoulder pivots.
    limbs.armR.rotation.x = step * .52 - attack * 1.05;
    limbs.armL.rotation.x = -step * .52;
    limbs.legR.rotation.x = -step * .55;
    limbs.legL.rotation.x = step * .55;
    limbs.armR.rotation.z = -.055 - attack * .12;
    limbs.armL.rotation.z = .055;
    limbs.head.rotation.x = Math.max(-.24, Math.min(.24, player.pitch * .20));
  }

  return { init, update, swing, getAppearance, setAppearance, getPalettes, drawPreview };
})();
