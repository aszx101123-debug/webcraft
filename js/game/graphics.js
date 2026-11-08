'use strict';

// Original vanilla-style atmosphere. No postprocessing or shadow-map passes.
const Graphics = (() => {
  const clamp = v => Math.max(0, Math.min(1, v));
  const color = hex => new THREE.Color(hex).convertSRGBToLinear();

  function configureRenderer(renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
  }

  function celestialTexture(moon) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = moon ? '#b8c6dc' : '#ffe8a3';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = moon ? '#e0e6ef' : '#fff7d1';
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = moon ? '#eff2f7' : '#fffde9';
    ctx.fillRect(3, 3, 10, 10);
    if (moon) {
      ctx.fillStyle = '#a4b1c6';
      ctx.fillRect(3, 4, 4, 3);
      ctx.fillRect(9, 9, 4, 4);
      ctx.fillRect(2, 11, 2, 2);
      ctx.fillStyle = '#c2cede';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(10, 9, 2, 3);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  function makeClouds(seed) {
    const rng = Noise.mulberry32((seed ^ 0x434c4f55) >>> 0);
    const cells = new Set();
    const width = 32, cellSize = 8, period = width * cellSize;
    // A repeating tile of connected, irregular silhouettes, meshed in one draw.
    const pattern = ['001100', '011110', '111111', '011110', '000110'];
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(rng() * width), z = Math.floor(rng() * width);
      for (let dz = 0; dz < pattern.length; dz++) for (let dx = 0; dx < pattern[dz].length; dx++) {
        if (pattern[dz][dx] === '1') cells.add(((x + dx) % width) + ',' + ((z + dz) % width));
      }
    }
    const faces = [
      { n: [0, 1, 0], shade: 1, c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
      { n: [0,-1, 0], shade: .66, c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
      { n: [1, 0, 0], shade: .82, c: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
      { n: [-1,0, 0], shade: .82, c: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
      { n: [0, 0, 1], shade: .9, c: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
      { n: [0, 0,-1], shade: .9, c: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] }
    ];
    const positions = [], colors = [];
    for (let tz = -1; tz <= 1; tz++) for (let tx = -1; tx <= 1; tx++) {
      for (const key of cells) {
        const [x, z] = key.split(',').map(Number);
        for (const f of faces) {
          if (!f.n[1] && cells.has(((x + f.n[0] + width) % width) + ',' + ((z + f.n[2] + width) % width))) continue;
          for (const i of [0, 1, 2, 0, 2, 3]) {
            const c = f.c[i];
            positions.push((tx * width + x + c[0] - width / 2) * cellSize, c[1] * 4, (tz * width + z + c[2] - width / 2) * cellSize);
            colors.push(f.shade, f.shade, f.shade);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: { tint: { value: color(0xffffff) } },
      vertexShader: `
        attribute vec3 color;
        varying vec3 shade;
        varying vec3 world;
        void main() {
          shade = color;
          vec4 p = modelMatrix * vec4(position, 1.0);
          world = p.xyz;
          gl_Position = projectionMatrix * viewMatrix * p;
        }`,
      fragmentShader: `
        uniform vec3 tint;
        varying vec3 shade;
        varying vec3 world;
        void main() {
          float fade = 1.0 - smoothstep(140.0, 240.0, length(world.xz - cameraPosition.xz));
          gl_FragColor = vec4(tint * shade, fade * 0.96);
          #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -70;
    return { mesh, period };
  }

  function create(scene, renderer, hemi, sun, seed) {
    configureRenderer(renderer);
    const palette = {
      dayTop: color(0x78a7ff), dayHorizon: color(0xc5ddf8),
      nightTop: color(0x070e23), nightHorizon: color(0x18243b),
      dusk: color(0xf2ac82), rain: color(0x8496a8),
      cloudDay: color(0xffffff), cloudNight: color(0x455575),
      water: color(0x24579b)
    };
    const top = new THREE.Color(), horizon = new THREE.Color();
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: { zenith: { value: top }, horizon: { value: horizon } },
      vertexShader: `
        varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        varying vec3 direction;
        void main() {
          float height = normalize(direction).y;
          gl_FragColor = vec4(mix(horizon, zenith, smoothstep(0.0, 0.72, height)), 1.0);
          #include <encodings_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false
    });
    const sky = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMaterial);
    dome.renderOrder = -100;
    sky.add(dome);

    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: celestialTexture(false), fog: false, depthWrite: false }));
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: celestialTexture(true), fog: false, depthWrite: false }));
    sunSprite.scale.set(26, 26, 1);
    moon.scale.set(22, 22, 1);
    sunSprite.renderOrder = moon.renderOrder = -80;
    sky.add(sunSprite, moon);

    const rng = Noise.mulberry32((seed ^ 0x53544152) >>> 0);
    const starPositions = [];
    for (let i = 0; i < 450; i++) {
      const y = .08 + rng() * .92, a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(a) * r * 225, y * 225, Math.sin(a) * r * 225);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
      color: 0xdce7ff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0,
      fog: false, depthWrite: false
    }));
    stars.renderOrder = -90;
    sky.add(stars);
    scene.add(sky);
    const clouds = makeClouds(seed);
    scene.add(clouds.mesh);
    let previousTime = null, drift = 0;

    function update(time, position, weather, renderDist, underwater) {
      const angle = time * Math.PI * 2, elevation = Math.sin(angle);
      const daylight = clamp((elevation + .15) / .75);
      const dusk = Math.max(0, 1 - Math.abs(elevation) / .25) * .65;
      const overcast = weather === 'clear' ? 0 : .7;
      top.copy(palette.nightTop).lerp(palette.dayTop, daylight).lerp(palette.rain, overcast * daylight);
      horizon.copy(palette.nightHorizon).lerp(palette.dayHorizon, daylight).lerp(palette.dusk, dusk);
      horizon.lerp(palette.rain, overcast * daylight);
      sky.position.copy(position);
      sky.visible = !underwater;
      scene.background = horizon;
      if (scene.fog) {
        const far = renderDist * 16 + 10;
        scene.fog.color.copy(underwater ? palette.water : horizon);
        scene.fog.near = underwater ? .5 : far * (overcast ? .35 : .6);
        scene.fog.far = underwater ? 15 : far;
      }
      const x = Math.cos(angle) * 170, y = elevation * 170, z = -Math.cos(angle) * 55;
      sunSprite.position.set(x, y, z);
      moon.position.set(-x, -y, -z);
      sunSprite.visible = elevation > -.12 && !overcast;
      moon.visible = elevation < .12 && !overcast;
      stars.material.opacity = Math.pow(1 - daylight, 2) * (1 - overcast);
      stars.rotation.y = angle * .15;
      const direction = elevation < 0 ? -1 : 1;
      sun.position.set(x * direction, Math.max(12, Math.abs(y)), z * direction);
      sun.color.setHex(elevation < 0 ? 0x9bb7eb : (dusk > .25 ? 0xffbd84 : 0xfff8e8));
      sun.intensity = (.1 + daylight * .62) * (1 - overcast * .65);
      hemi.intensity = .16 + daylight * .62;
      hemi.color.setHex(elevation < 0 ? 0x718bb5 : 0xc7ddff);
      clouds.mesh.visible = !underwater;
      clouds.mesh.material.uniforms.tint.value.copy(palette.cloudNight).lerp(palette.cloudDay, daylight * (1 - overcast * .4));
      if (previousTime !== null)
        drift = (drift + ((time - previousTime + 1) % 1) * CONFIG.DAY_LENGTH * .65) % clouds.period;
      previousTime = time;
      clouds.mesh.position.set(
        Math.round((position.x + drift) / clouds.period) * clouds.period - drift,
        100,
        Math.round(position.z / clouds.period) * clouds.period
      );
      return daylight;
    }
    return { update };
  }

  return { configureRenderer, create };
})();
