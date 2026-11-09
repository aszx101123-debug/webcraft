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
const gameAssets = require('./helpers/game-assets');

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

function world(biome = 'plains', radius = 0, plants = false, farming = undefined) {
  const Terrain = {
    idx: (x, y, z) => (x << 10) | (z << 6) | y,
    makeGen: () => ({ genChunk: () => new Uint8Array(16 * 16 * 64), heightAt: () => 0, biomeAt: () => biome })
  };
  const textures = { getTexture: () => null, tileFor: () => ({u0:0,u1:1,v0:0,v1:1}),tileUV:(col,row)=>({u0:col/16,u1:(col+1)/16,v0:1-(row+1)/16,v1:1-row/16}) };
  if(plants)textures.decorTile=()=>({u0:0,u1:1,v0:0,v1:1});
  const instance = new Function('THREE', 'CONFIG', 'BLOCK', 'BLOCKS', 'Terrain', 'Textures', 'Player',
    'BlockFurniture', 'getBlockVisualBoxes', 'isSolidBlock', 'Noise', 'Farming', source('js/game/voxel-lighting.js') + '\n' + source('js/game/world.js') + '\nreturn World;')(
    THREE, CONFIG, BLOCK, BLOCKS, Terrain, textures, {pos:{y:10}}, {stateAt:()=>({})}, getBlockVisualBoxes, isSolidBlock, Noise, farming);
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

test('stacked cactus meshes keep their inset sides and only the exposed caps',()=>{
  const w=world();
  w.setBlock(8,10,8,BLOCK.CACTUS);w.setBlock(8,11,8,BLOCK.CACTUS);
  w.update(8,8,0,0,99);
  const geometry=w.getChunk(0,0).mesh.geometry;
  assert.equal(geometry.index.count,60,'ten exposed quads, no internal caps');
  const positions=Array.from(geometry.attributes.position.array);
  for(const axis of [0,2]){
    const coordinates=positions.filter((_,i)=>i%3===axis);
    assert.equal(Math.min(...coordinates),8.0625);
    assert.equal(Math.max(...coordinates),8.9375);
  }
  const heights=positions.filter((_,i)=>i%3===1);
  assert.equal(Math.min(...heights),10);assert.equal(Math.max(...heights),12);
});

test('covered water fills its cell while the exposed surface retains its fluid height',()=>{
  const w=world();
  w.setBlock(8,10,8,BLOCK.WATER_FLOW);w.setFluidLevel(8,10,8,1);
  w.setBlock(8,11,8,BLOCK.WATER);
  w.update(8,8,0,0,99);
  const geometry=w.getChunk(0,0).waterMesh.geometry;
  const positions=Array.from(geometry.attributes.position.array);
  const normals=geometry.attributes.normal.array;
  let coveredSide=false;
  for(let i=0;i<positions.length;i+=12){
    if(normals[i+1]!==0)continue;
    const heights=[0,1,2,3].map(j=>positions[i+j*3+1]);
    if(Math.min(...heights)===10){
      assert.equal(Math.max(...heights),11,'covered water has no gap beneath the next cell');
      coveredSide=true;
    }
  }
  assert.equal(coveredSide,true);
  close(Math.max(...positions.filter((_,i)=>i%3===1)),11.87);
});
const close = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} should equal ${b}`);

test('planted crops rebuild as growing crossed pixel planes above lowered farmland',()=>{
  let stage=0;
  const w=world('plains',0,true,{stageAt:()=>stage,isForaged:()=>false});
  w.setBlock(8,10,8,BLOCK.FARMLAND);w.setBlock(8,11,8,BLOCK.WHEAT_CROP);
  const mesh=()=>{
    w.update(8,8,0,0,99);
    const chunk=w.getChunk(0,0);
    return {plants:chunk.plantMesh.geometry,soil:chunk.mesh.geometry};
  };
  let {plants,soil}=mesh();
  assert.equal(plants.attributes.position.count,8);
  assert.equal(plants.index.count,12);
  const ys=Array.from(plants.attributes.position.array).filter((_,i)=>i%3===1);
  close(Math.min(...ys),10.9375);close(Math.max(...ys),11.1875);
  close(Math.max(...Array.from(soil.attributes.position.array).filter((_,i)=>i%3===1)),10.9375);
  stage=3;w.invalidateAt(8,11,8);({plants}=mesh());
  close(Math.max(...Array.from(plants.attributes.position.array).filter((_,i)=>i%3===1)),11.7275);
  close(Math.max(...plants.attributes.uv.array),1);
  assert.ok(Array.from(plants.attributes.voxelLight.array).every(Number.isFinite));
});

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

test('grass and flowers are deterministic visual geometry and never modify saved blocks',()=>{
  const w=world('plains',0,true);
  for(let x=0;x<16;x++)for(let z=0;z<16;z++)w.setBlock(x,0,z,BLOCK.GRASS,false);
  w.update(8,8,0,0,99);
  const ch=w.getChunk(0,0),original=Array.from(ch.plantMesh.geometry.attributes.position.array);
  assert.ok(original.length>0);
  assert.deepEqual(w.getEdits(),[],'decoration must not create gameplay blocks');
  w.invalidateAt(8,0,8);
  w.update(8,8,0,0,99);
  assert.deepEqual(Array.from(ch.plantMesh.geometry.attributes.position.array),original);
  const x=Math.floor((original[0]+original[3]+original[6]+original[9])/4);
  const z=Math.floor((original[2]+original[5]+original[8]+original[11])/4);
  w.setBlock(x,0,z,BLOCK.AIR);
  w.update(8,8,0,0,99);
  assert.equal(ch.plantMesh.geometry.attributes.position.array.length,original.length-24);
});

test('decorations do not float over edits or grow through a sealed roof',()=>{
  const w=world('plains',0,true);
  for(let x=0;x<16;x++)for(let z=0;z<16;z++){
    w.setBlock(x,0,z,BLOCK.GRASS,false);
    w.setBlock(x,2,z,BLOCK.STONE,false);
  }
  w.update(8,8,0,0,99);
  assert.ok(!w.getChunk(0,0).plantMesh);
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

test('PC guest loader, mobile entry and offline cache load graphics before the game', () => {
  const worker = source('service-worker.js');
  for (const page of ['play.html','mobile-test.html']) {
    const html = gamePage(page);
    for (const file of ['config','mobile-test-textures','graphics','voxel-lighting','world','mobile-test-main']) {
      const url = gameAssets(page).find(url=>url.split('?')[0]==='js/game/'+file+'.js');
      assert.ok(url, page + ': ' + file);
      assert.ok(html.includes(url), page + ': ' + url);
      assert.ok(worker.includes(url), 'offline: ' + url);
      assert.ok(fs.existsSync(path.join(__dirname, '..', url.split('?')[0])));
    }
    assert.ok(html.indexOf('js/game/noise.js') < html.indexOf('js/game/graphics.js'));
    assert.ok(html.indexOf('js/game/graphics.js') < html.indexOf('js/game/mobile-test-main.js'));
    assert.ok(html.indexOf('js/game/voxel-lighting.js') < html.indexOf('js/game/world.js'));
  }
  assert.match(source('play.html'),/js\/auth-play\.js\?v=v\d+/);
});
