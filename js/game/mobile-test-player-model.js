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
  const palettes = {
    skin: [
      { label: '밝은 베이지', value: 0xe9bd92 }, { label: '복숭아', value: 0xd5a57f },
      { label: '구릿빛', value: 0xb77955 }, { label: '짙은 갈색', value: 0x80513c }
    ],
    hair: [
      { label: '검정', value: 0x26242a }, { label: '갈색', value: 0x4b3428 },
      { label: '밤색', value: 0x7b4b30 }, { label: '금발', value: 0xbda16d },
      { label: '은색', value: 0xc9c9cc }
    ],
    shirt: [
      { label: '청록', value: 0x2f8c90 }, { label: '파랑', value: 0x426ab4 },
      { label: '빨강', value: 0xb35053 }, { label: '초록', value: 0x518e53 },
      { label: '보라', value: 0x8456a2 }, { label: '주황', value: 0xc78b3c }
    ],
    pants: [
      { label: '남색', value: 0x33435f }, { label: '회색', value: 0x6b7888 },
      { label: '갈색', value: 0x70503b }, { label: '검정', value: 0x272c38 }
    ],
    boots: [
      { label: '검정', value: 0x24262c }, { label: '갈색', value: 0x5b4335 },
      { label: '회색', value: 0x666b70 }
    ],
    hairStyle: [
      { label: '짧은 머리', value: 'short' },
      { label: '앞머리', value: 'fringe' },
      { label: '긴 머리', value: 'long' }
    ]
  };
  const defaults = { skin: 1, hair: 1, shirt: 0, pants: 0, boots: 0, hairStyle: 'short' };
  let appearance = { ...defaults };
  let bodyMaterials = null, hairBits = null;
  let heldMain = null, heldOff = null, heldMainId = 0, heldOffId = 0;
  let worldRight = null, worldLeft = null;

  function normalizeAppearance(next) {
    const normalized = { ...defaults };
    if (!next || typeof next !== 'object' || Array.isArray(next)) return normalized;
    for (const field of ['skin', 'hair', 'shirt', 'pants', 'boots']) {
      if (Number.isInteger(next[field]) && next[field] >= 0 && next[field] < palettes[field].length)
        normalized[field] = next[field];
    }
    if (palettes.hairStyle.some(item => item.value === next.hairStyle))
      normalized.hairStyle = next.hairStyle;
    return normalized;
  }
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
      hairBits.fringe.visible = appearance.hairStyle !== 'short';
      hairBits.longL.visible = appearance.hairStyle === 'long';
      hairBits.longR.visible = appearance.hairStyle === 'long';
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
    hairBits = { fringe, longL, longR };
    head.add(cube(.075, .075, .03, 0x20252b, .15, .02, .315));
    head.add(cube(.075, .075, .03, 0x20252b, -.15, .02, .315));
    head.add(cube(.11, .06, .035, 0x8f4a43, 0, -.14, .315));
    worldModel.add(head);

    const armL = worldArm(-1, shirt, cuff, skin);
    const armR = worldArm(1, shirt, cuff, skin);
    const legL = worldLeg(-1, pants, boots);
    const legR = worldLeg(1, pants, boots);
    worldModel.add(armL, armR, legL, legR);
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
        map: Textures.getTexture(), transparent: true,
        alphaTest: .12, depthWrite: false, depthTest: false
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
        side: THREE.DoubleSide, depthWrite: false, depthTest: false
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
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const rect = (x, y, width, height, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    };
    ctx.fillStyle = '#0c1620';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 14) for (let x = 0; x < w; x += 14) {
      if ((x + y) % 28 === 0) rect(x, y, 14, 14, '#111f2a');
    }
    const skin = colorCss('skin'), hair = colorCss('hair'),
      shirt = colorCss('shirt'), pants = colorCss('pants'), boots = colorCss('boots');
    const mainX = Math.round(w / 2);
    const feetY = h - 12, legY = feetY - 66, chestY = legY - 67;
    // Boots and separate legs.
    rect(mainX - 25, legY, 23, 52, pants);
    rect(mainX + 2, legY, 23, 52, pants);
    rect(mainX - 28, feetY - 18, 26, 18, boots);
    rect(mainX + 2, feetY - 18, 26, 18, boots);
    // Torso, arms and cuffs.
    rect(mainX - 28, chestY, 56, 67, shirt);
    rect(mainX - 46, chestY + 2, 16, 31, shirt);
    rect(mainX + 30, chestY + 2, 16, 31, shirt);
    rect(mainX - 46, chestY + 33, 16, 9, shirt);
    rect(mainX + 30, chestY + 33, 16, 9, shirt);
    rect(mainX - 46, chestY + 42, 16, 30, skin);
    rect(mainX + 30, chestY + 42, 16, 30, skin);
    rect(mainX - 25, chestY + 7, 5, 52, 'rgba(0,0,0,.15)');
    // Head and hairstyle.
    const headY = chestY - 59;
    rect(mainX - 26, headY, 52, 53, skin);
    rect(mainX - 27, headY - 8, 54, 14, hair);
    if (appearance.hairStyle !== 'short') rect(mainX - 27, headY + 4, 54, 13, hair);
    if (appearance.hairStyle === 'long') {
      rect(mainX - 34, headY + 8, 8, 49, hair);
      rect(mainX + 26, headY + 8, 8, 49, hair);
    }
    if (!rear) {
      if (appearance.hairStyle === 'fringe') rect(mainX - 5, headY + 4, 12, 17, hair);
      rect(mainX - 16, headY + 25, 7, 7, '#20252b');
      rect(mainX + 9, headY + 25, 7, 7, '#20252b');
      rect(mainX - 3, headY + 39, 8, 3, '#8f4a43');
      rect(mainX - 16, chestY + 18, 32, 7, 'rgba(255,255,255,.18)');
    }
    const gear = Inventory.getEquipment();
    const armorColor = stack => {
      if (!stack || stack.id < 220 || stack.id > 239) return null;
      const tier = Math.floor((stack.id - 220) / 4);
      return ['#9a704b','#92979c','#c9d4d9','#e5b54c','#6bdbe8'][tier] || null;
    };
    if (armorColor(gear.chest)) rect(mainX - 27, chestY + 2, 54, 38, armorColor(gear.chest));
    if (armorColor(gear.legs)) {
      rect(mainX - 25, legY, 23, 30, armorColor(gear.legs));
      rect(mainX + 2, legY, 23, 30, armorColor(gear.legs));
    }
    if (armorColor(gear.feet)) {
      rect(mainX - 28, feetY - 20, 26, 20, armorColor(gear.feet));
      rect(mainX + 2, feetY - 20, 26, 20, armorColor(gear.feet));
    }
    if (armorColor(gear.head)) rect(mainX - 27, headY - 5, 54, 21, armorColor(gear.head));
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
