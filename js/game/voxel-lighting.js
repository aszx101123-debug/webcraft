'use strict';

// Minecraft-style sky/block light. The bounded flood fill runs at mesh-build time,
// so daylight changes do not rebuild chunks or require shadow-map render passes.
const VoxelLighting = (() => {
  const PAD = 15;
  function create() {
    const H = CONFIG.HEIGHT, W = CONFIG.CHUNK + PAD * 2, stride = W * H;
    const count = W * W * H;
    const sky = new Uint8Array(count), block = new Uint8Array(count);
    const opacity = new Uint8Array(count), queued = new Uint8Array(count);
    const queue = new Int32Array(count);
    let read = 0, write = 0, pending = 0;
    const index = (x, y, z) => (x + PAD) * stride + (z + PAD) * H + y;
    const loss = BLOCKS.map((def, id) => !id ? 1 : def.liquid || def.cutout ? 2 : def.nonSolid || def.shape ? 1 : 15);
    const emission = BLOCKS.map((def, id) => def?.emission || (id === BLOCK.GLOWSTONE ? 15 : id === BLOCK.TORCH ? 14 : 0));

    function enqueue(i) {
      if (queued[i]) return;
      queued[i] = 1;
      queue[write] = i;
      write = (write + 1) % count;
      pending++;
    }

    function spread(from, to) {
      const attenuation = opacity[to];
      if (attenuation === 15) return;
      const nextSky = sky[from] - attenuation, nextBlock = block[from] - attenuation;
      if (nextSky <= sky[to] && nextBlock <= block[to]) return;
      if (nextSky > sky[to]) sky[to] = nextSky;
      if (nextBlock > block[to]) block[to] = nextBlock;
      enqueue(to);
    }

    function build(ox, oz, columnAt) {
      sky.fill(0); block.fill(0); opacity.fill(15); queued.fill(0);
      read = write = pending = 0;
      for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) {
        const column = columnAt(ox + x - PAD, oz + z - PAD);
        if (!column) continue; // Unloaded terrain cannot leak light into a cave.
        let sunlight = 15;
        const start = x * stride + z * H;
        for (let y = H - 1; y >= 0; y--) {
          const i = start + y, id = column.data[column.offset + y];
          const attenuation = loss[id];
          opacity[i] = attenuation;
          if (attenuation === 15) sunlight = 0;
          else if (attenuation > 1) sunlight = Math.max(0, sunlight - attenuation);
          sky[i] = sunlight;
          block[i] = emission[id];
          if (sunlight > 1 || block[i] > 1) enqueue(i);
        }
      }
      while (pending) {
        const i = queue[read];
        read = (read + 1) % count;
        pending--; queued[i] = 0;
        const y = i % H, column = (i - y) / H;
        const z = column % W, x = (column - z) / W;
        if (x > 0) spread(i, i - stride);
        if (x + 1 < W) spread(i, i + stride);
        if (z > 0) spread(i, i - H);
        if (z + 1 < W) spread(i, i + H);
        if (y > 0) spread(i, i - 1);
        if (y + 1 < H) spread(i, i + 1);
      }
    }

    function sample(x, y, z) {
      if (y >= H) return [15, 0];
      if (y < 0) return [0, 0];
      const i = index(x, y, z);
      return [sky[i], block[i]];
    }

    function faceLight(out, x, y, z, normal, offsets) {
      const baseY = y + normal[1];
      if (baseY >= H) { out.push(15, 0); return; }
      if (baseY < 0) { out.push(0, 0); return; }
      const base = index(x + normal[0], baseY, z + normal[2]);
      let s = sky[base], b = block[base];
      for (let j = 0; j < 3; j++) {
        const d = offsets[j], sy = y + d[1];
        if (sy >= H) { s += 15; continue; }
        if (sy < 0) continue;
        const i = index(x + d[0], sy, z + d[2]);
        // Occlusion is already handled by AO; avoid shading a solid neighbor twice.
        s += opacity[i] === 15 ? sky[base] : sky[i];
        b += opacity[i] === 15 ? block[base] : block[i];
      }
      out.push(s / 4, b / 4);
    }
    return { build, faceLight, sample };
  }

  function material(options, daylight) {
    const result = new THREE.MeshBasicMaterial(options);
    result.onBeforeCompile = shader => {
      shader.uniforms.voxelDaylight = daylight;
      shader.vertexShader = 'attribute vec2 voxelLight;\nvarying vec2 vVoxelLight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvVoxelLight = voxelLight;');
      shader.fragmentShader = 'uniform float voxelDaylight;\nvarying vec2 vVoxelLight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float skyBrightness = pow(0.8, 15.0 - vVoxelLight.x) * voxelDaylight;
        float blockBrightness = pow(0.8, 15.0 - vVoxelLight.y);
        vec3 lightColor = max(vec3(skyBrightness), vec3(1.0, 0.82, 0.60) * blockBrightness);
        diffuseColor.rgb *= max(vec3(0.025), lightColor);
      `);
    };
    result.customProgramCacheKey = () => 'webcraft-voxel-light-v1';
    return result;
  }
  return { create, material };
})();
