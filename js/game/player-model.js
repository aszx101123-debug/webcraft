'use strict';

const PlayerModel = (() => {
  let group = null;
  let scene = null;

  function mat(color) {
    return new THREE.MeshLambertMaterial({ color });
  }

  function box(w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    return mesh;
  }

  function init(scene_) {
    scene = scene_;
    group = new THREE.Group();

    // 오리지널 블록형 모험가: 정사각형 머리 + 짧은 헤어 + 청록 상의 + 짙은 바지.
    const skin = 0xd5a57f;
    const hair = 0x4b3428;
    const shirt = 0x2f8c90;
    const shirtDark = 0x226a70;
    const pants = 0x33435f;
    const boots = 0x24262c;

    const body = box(.74, .82, .42, shirt, 0, 1.23, 0);
    group.add(body);
    group.add(box(.68, .08, .46, shirtDark, 0, 1.66, 0));

    const head = box(.62, .62, .62, skin, 0, 2.03, 0);
    group.add(head);
    group.add(box(.66, .18, .66, hair, 0, 2.36, 0));
    group.add(box(.66, .22, .12, hair, 0, 2.18, -.31));

    // 눈은 모델의 앞쪽(+Z)에 배치한다.
    group.add(box(.075, .075, .03, 0x20252b, .15, 2.05, .315));
    group.add(box(.075, .075, .03, 0x20252b, -.15, 2.05, .315));
    group.add(box(.11, .06, .035, 0x8f4a43, 0, 1.89, .315));

    const armL = box(.22, .78, .25, skin, -.49, 1.24, 0);
    const armR = box(.22, .78, .25, skin, .49, 1.24, 0);
    armL.userData.limb = 'armL';
    armR.userData.limb = 'armR';
    group.add(armL, armR);

    const legL = box(.28, .82, .28, pants, -.2, .42, 0);
    const legR = box(.28, .82, .28, pants, .2, .42, 0);
    legL.userData.limb = 'legL';
    legR.userData.limb = 'legR';
    group.add(legL, legR);

    const bootL = box(.3, .18, .36, boots, -.2, .05, .05);
    const bootR = box(.3, .18, .36, boots, .2, .05, .05);
    group.add(bootL, bootR);

    group.userData.parts = { armL, armR, legL, legR };
    group.scale.setScalar(.78);
    group.visible = false;
    scene.add(group);
  }

  function update(player, dt, thirdPerson) {
    if (!group) return;
    const parts = group.userData.parts;
    group.visible = !!thirdPerson && !player.dead;
    if (!group.visible) return;

    group.position.set(player.pos.x, player.pos.y, player.pos.z);
    group.rotation.y = player.yaw;

    const speed = Math.hypot(player.vel.x, player.vel.z);
    const moving = player.onGround && speed > .25;
    const phase = performance.now() * .012 * Math.min(1.5, speed / Math.max(.1, CONFIG.SPEED));

    if (moving) {
      const swing = Math.sin(phase) * .65;
      parts.armL.rotation.x = -swing;
      parts.armR.rotation.x = swing;
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
    } else {
      parts.armL.rotation.x *= .82;
      parts.armR.rotation.x *= .82;
      parts.legL.rotation.x *= .82;
      parts.legR.rotation.x *= .82;
    }
  }

  return { init, update };
})();