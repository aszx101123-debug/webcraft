'use strict';

(() => {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch (e) {
    canvas.style.display = 'none';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  const DAY = new THREE.Color(0x8ecfef);
  scene.background = DAY;
  scene.fog = new THREE.Fog(0x8ecfef, 50, 105);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 400);

  Textures.init();
  World.init(scene, 1, null);

  let cx = 8, cz = 8;
  search:
  for (let r = 0; r < 50; r++) {
    for (let a = 0; a < 10; a++) {
      const x = Math.round(Math.cos(a / 10 * Math.PI * 2) * r * 10) + 8;
      const z = Math.round(Math.sin(a / 10 * Math.PI * 2) * r * 10) + 8;
      const h = World.heightAt(x, z);
      if (h >= 24 && h <= 32) {
        const near = [[16, 0], [11, 11], [0, 16], [-11, 11], [-16, 0], [-11, -11], [0, -16], [11, -11]];
        for (const [dx, dz] of near) {
          if (World.heightAt(x + dx, z + dz) < 21) { cx = x; cz = z; break search; }
        }
      }
    }
  }
  const center = new THREE.Vector3(cx + .5, World.heightAt(cx, cz), cz + .5);

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x54492e, .85));
  const sun = new THREE.DirectionalLight(0xfff3d0, .7);
  sun.position.set(60, 100, 35);
  scene.add(sun);

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const R = 2;
  let angle = .8;
  const clock = new THREE.Clock();

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), .05);
    World.update(cx + .5, cz + .5, R, 2, 2);
    angle += dt * .07;
    const rad = 34;
    camera.position.set(
      center.x + Math.cos(angle) * rad,
      center.y + 15 + Math.sin(angle * .5) * 3,
      center.z + Math.sin(angle) * rad
    );
    camera.lookAt(center.x, center.y + 3, center.z);
    renderer.render(scene, camera);
  }
  loop();
})();
