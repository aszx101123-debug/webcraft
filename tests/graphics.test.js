'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const THREE = require('../pogl-game/vendor/three.min.js');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const core = new Function(source('js/game/config.js') + '\nreturn {CONFIG,BLOCK,BLOCKS,ITEMS,getBlockVisualBoxes,isSolidBlock};')();
const { CONFIG, BLOCK, BLOCKS, ITEMS, getBlockVisualBoxes, isSolidBlock } = core;
const Noise = new Function(source('js/game/noise.js') + '\nreturn Noise;')();
const gamePage = require('./helpers/game-page');

function canvasDocument() {
  return {
    createElement(kind) {
      assert.equal(kind, 'canvas');
      const pixels = new Map();
      const canvas = { width: 0, height: 0, pixels };
      const ctx = {
        fillStyle: '',
        fillRect(x, y, w, h) {
          for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++)
            pixels.set((x + dx) + ',' + (y + dy), this.fillStyle);
        },
        clearRect(x, y, w, h) {
          for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++)
            pixels.delete((x + dx) + ',' + (y + dy));
        }
      };
      canvas.getContext = () => ctx;
      return canvas;
    }
  };
}

function world(biome = 'plains', radius = 0) {
  const Terrain = {
    idx: (x, y, z) => (x << 10) | (z << 6) | y,
    makeGen: () => ({ genChunk: () => new Uint8Array(16 * 16 * 64), heightAt: () => 0, biomeAt: () => biome })
  };
  const textures = { getTexture: () => null, tileFor: () => ({u0:0,u1:1,v0:0,v1:1}) };
  const instance = new Function('THREE', 'CONFIG', 'BLOCK', 'BLOCKS', 'Terrain', 'Textures', 'Player',
    'BlockFurniture', 'getBlockVisualBoxes', 'isSolidBlock', source('js/game/world.js') + '\nreturn World;')(
    THREE, CONFIG, BLOCK, BLOCKS, Terrain, textures, {pos:{y:10}}, {stateAt:()=>({})}, getBlockVisualBoxes, isSolidBlock);
  instance.init(new THREE.Scene(), 1, null);
  instance.update(8, 8, radius, (radius * 2 + 1) ** 2, 99);
  return instance;
}

function topFace(world, x, y, z) {
  const geometry = world.getChunk(x >> 4, z >> 4).mesh.geometry;
  const positions = geometry.attributes.position.array, normals = geometry.attributes.normal.array;
  const colors = geometry.attributes.color.array;
  for (let offset = 0; offset < positions.length; offset += 12) {
    if (normals[offset + 1] !== 1) continue;
    const center = [0, 0, 0];
    for (let i = 0; i < 4; i++) for (let axis = 0; axis < 3; axis++) center[axis] += positions[offset + i * 3 + axis] / 4;
    if (center[0] === x + .5 && center[1] === y + 1 && center[2] === z + .5) {
      const base = offset / 3;
      return {
        red: Array.from({length:4}, (_,i) => colors[offset + i * 3]),
        rgb: Array.from(colors.slice(offset, offset + 3)), base,
        indices: Array.from(geometry.index.array.slice(base / 4 * 6, base / 4 * 6 + 6))
      };
    }
  }
  assert.fail('Expected a visible top face');
}
const close = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} should equal ${b}`);

test('baked AO darkens obstructed corners, preserving an exposed corner', () => {
  const w = world();
  w.setBlock(8,10,8,BLOCK.STONE);
  w.update(8,8,0,0,99);
  assert.deepEqual(topFace(w,8,10,8).red, [1,1,1,1]);
  w.setBlock(7,11,8,BLOCK.STONE);
  w.update(8,8,0,0,99);
  close(topFace(w,8,10,8).red[0], .85);
  w.setBlock(8,11,9,BLOCK.STONE);
  w.update(8,8,0,0,99);
  close(topFace(w,8,10,8).red[0], .55);
  close(topFace(w,8,10,8).red[2], 1);
});

test('glass, leaves, water, torches and partial blocks do not cast full voxel AO', () => {
  for (const id of [BLOCK.GLASS, BLOCK.LEAVES, BLOCK.WATER, BLOCK.TORCH, BLOCK.STONE_SLAB]) {
    const w = world();
    w.setBlock(8,10,8,BLOCK.STONE);
    w.setBlock(7,11,8,id);
    w.setBlock(8,11,9,id);
    w.update(8,8,0,0,99);
    assert.deepEqual(topFace(w,8,10,8).red, [1,1,1,1], 'occluder ' + id);
  }
});

test('AO selects the alternate triangle diagonal to avoid a bright crease', () => {
  const w = world();
  w.setBlock(8,10,8,BLOCK.STONE);
  w.setBlock(9,11,9,BLOCK.STONE);
  w.update(8,8,0,0,99);
  const face = topFace(w,8,10,8), v = face.base;
  assert.deepEqual(face.indices, [v,v+1,v+3,v+1,v+2,v+3]);
});

test('mining a diagonal chunk corner rebuilds the shaded face in its neighbor', () => {
  const w = world('plains', 1);
  w.setBlock(15,10,15,BLOCK.STONE);
  w.setBlock(16,11,16,BLOCK.STONE);
  w.update(8,8,1,0,99);
  close(topFace(w,15,10,15).red[1], .85);
  w.setBlock(16,11,16,BLOCK.AIR);
  assert.equal(w.dirtyCount(), 4);
  w.update(8,8,1,0,99);
  assert.deepEqual(topFace(w,15,10,15).red, [1,1,1,1]);
});

test('biome tint changes grass color without tinting stone or the saved blocks', () => {
  const w = world('swamp');
  w.setBlock(8,10,8,BLOCK.GRASS);
  w.setBlock(10,10,8,BLOCK.STONE);
  w.update(8,8,0,0,99);
  const grass = topFace(w,8,10,8).rgb;
  close(grass[0], .8); close(grass[1], .87); close(grass[2], .68);
  assert.deepEqual(topFace(w,10,10,8).rgb, [1,1,1]);
  assert.equal(w.getBlock(8,10,8), BLOCK.GRASS);
});

test('glowstone uses the unlit emissive batch and registers a nearby light', () => {
  const w = world();
  w.setBlock(8,10,8,BLOCK.GLOWSTONE);
  w.update(8,8,0,0,99);
  const chunk = w.getChunk(0,0);
  assert.equal(chunk.mesh, null);
  assert.ok(chunk.torchMesh.material.isMeshBasicMaterial);
  assert.ok(Array.from(chunk.torchMesh.geometry.attributes.color.array).every(v => v === 1));
  assert.equal(chunk.torches.length, 1);
});

test('16px sRGB atlas preserves real leaf holes and both meat and bone pixels', () => {
  const Textures = new Function('document','THREE','Noise','BLOCKS','ITEMS', source('js/game/mobile-test-textures.js') + '\nreturn Textures;')(
    canvasDocument(), THREE, Noise, BLOCKS, ITEMS);
  Textures.init();
  assert.equal(Textures.getTexture().encoding, THREE.sRGBEncoding);
  assert.equal(Textures.getTexture().magFilter, THREE.NearestFilter);
  const pixels = Textures.getAtlas().pixels;
  const leaves = Array.from({length:256}, (_,i) => pixels.get((i%16) + ',' + (16 + (i>>4))));
  assert.ok(leaves.filter(Boolean).length > 150);
  assert.ok(leaves.filter(v => !v).length > 10, 'transparent pixels must erase older atlas art');
  assert.ok(pixels.has('54,40'), 'mutton body is retained');
  assert.ok(pixels.has('60,40'), 'bone overlay is retained');
});

test('atmosphere follows day, night, weather and submersion with a single cloud mesh', () => {
  const Graphics = new Function('THREE','document','Noise','CONFIG', source('js/game/graphics.js') + '\nreturn Graphics;')(
    THREE, canvasDocument(), Noise, CONFIG);
  const scene = new THREE.Scene(), renderer = {};
  scene.fog = new THREE.Fog(0, 30, 60);
  const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
  const atmosphere = Graphics.create(scene, renderer, hemi, sun, 100);
  const position = new THREE.Vector3(8,30,8);
  assert.equal(renderer.outputEncoding, THREE.sRGBEncoding);
  assert.equal(renderer.toneMapping, THREE.NoToneMapping);
  const sky = scene.children.find(v => v.isGroup);
  const clouds = scene.children.find(v => v.isMesh);
  assert.ok(clouds.material.isShaderMaterial);
  assert.equal(clouds.geometry.groups.length, 0, 'all clouds share one draw');
  assert.ok(Array.from(clouds.geometry.attributes.position.array).every(Number.isFinite));
  const stars = sky.children.find(v => v.isPoints);
  close(atmosphere.update(.25, position, 'clear', 3, false), 1);
  const dayIntensity = sun.intensity;
  assert.equal(stars.material.opacity, 0);
  assert.ok(sky.position.equals(position));
  close(atmosphere.update(.75, position, 'clear', 3, false), 0);
  assert.ok(stars.material.opacity > .9);
  assert.ok(sun.intensity < dayIntensity);
  atmosphere.update(.25, position, 'rain', 3, false);
  assert.ok(sun.intensity < dayIntensity);
  assert.ok(sky.children.filter(v => v.isSprite).every(v => !v.visible));
  atmosphere.update(.25, position, 'clear', 3, true);
  assert.equal(sky.visible, false);
  assert.equal(clouds.visible, false);
  assert.equal(scene.fog.far, 15);
  atmosphere.update(.25, position, 'clear', 5, false);
  assert.equal(scene.fog.far, 90);
  assert.equal(sky.visible, true);
});

test('cloud movement freezes with world time and remains continuous at midnight', () => {
  const Graphics = new Function('THREE','document','Noise','CONFIG', source('js/game/graphics.js') + '\nreturn Graphics;')(
    THREE, canvasDocument(), Noise, CONFIG);
  const scene = new THREE.Scene();
  const atmosphere = Graphics.create(scene, {}, new THREE.HemisphereLight(), new THREE.DirectionalLight(), 1);
  const clouds = scene.children.find(v => v.isMesh), pos = new THREE.Vector3();
  atmosphere.update(.99999, pos, 'clear', 3, false);
  const before = clouds.position.x;
  atmosphere.update(.99999, pos, 'clear', 3, false);
  assert.equal(clouds.position.x, before);
  atmosphere.update(.00001, pos, 'clear', 3, false);
  assert.ok(Math.abs(clouds.position.x - before) < .02);
});

test('PC auth loader, mobile entry and offline cache load graphics before the game', () => {
  const worker = source('service-worker.js');
  for (const page of ['play.html','mobile-test.html']) {
    const html = gamePage(page);
    for (const file of ['config','mobile-test-textures','graphics','world','mobile-test-main']) {
      const url = 'js/game/' + file + '.js?v=v150';
      assert.ok(html.includes(url), page + ': ' + url);
      assert.ok(worker.includes(url), 'offline: ' + url);
      assert.ok(fs.existsSync(path.join(__dirname, '..', url.split('?')[0])));
    }
    assert.ok(html.indexOf('js/game/noise.js') < html.indexOf('js/game/graphics.js'));
    assert.ok(html.indexOf('js/game/graphics.js') < html.indexOf('js/game/mobile-test-main.js'));
  }
  assert.ok(source('play.html').includes('js/auth-play.js?v=v150'));
});
