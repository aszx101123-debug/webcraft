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

  function material(color) {
    return new THREE.MeshLambertMaterial({ color });
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
    const skin = 0xd5a57f;
    const hair = 0x4b3428;
    const shirt = 0x2f8c90;
    const cuff = 0x226a70;
    const pants = 0x33435f;
    const boots = 0x24262c;

    worldModel = new THREE.Group();
    worldModel.add(cube(.74, .82, .42, shirt, 0, 1.23, 0));
    worldModel.add(cube(.68, .08, .46, cuff, 0, 1.66, 0));

    const head = joint(0, 2.03, 0);
    head.add(cube(.62, .62, .62, skin));
    head.add(cube(.66, .18, .66, hair, 0, .33, 0));
    head.add(cube(.66, .22, .12, hair, 0, .15, -.31));
    head.add(cube(.075, .075, .03, 0x20252b, .15, .02, .315));
    head.add(cube(.075, .075, .03, 0x20252b, -.15, .02, .315));
    head.add(cube(.11, .06, .035, 0x8f4a43, 0, -.14, .315));
    worldModel.add(head);

    const armL = worldArm(-1, shirt, cuff, skin);
    const armR = worldArm(1, shirt, cuff, skin);
    const legL = worldLeg(-1, pants, boots);
    const legR = worldLeg(1, pants, boots);
    worldModel.add(armL, armR, legL, legR);
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

  return { init, update, swing };
})();
