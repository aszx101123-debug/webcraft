'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const source = file => fs.readFileSync(path.join(__dirname,'..','js','game',file),'utf8');
const game = new Function(source('config.js')+'\n'+source('noise.js')+'\n'+source('terrain.js')+
  '\nreturn {Terrain,BIOMES,BLOCK,BLOCKS,CONFIG};')();
const {Terrain,BIOMES,BLOCK,BLOCKS,CONFIG}=game;

function representatives(gen) {
  const found=new Map();
  // Region centers guarantee one sample per chosen cell; select land for harvesting checks.
  for(let gx=-50;gx<=50 && found.size<Object.keys(BIOMES).length;gx++)for(let gz=-50;gz<=50;gz++) {
    const region=gen.regionAt(gx*160+80,gz*160+80);
    if(found.has(region.biome))continue;
    const x=Math.floor(region.centerX),z=Math.floor(region.centerZ);
    if(gen.heightAt(x,z)>CONFIG.SEA+3)found.set(region.biome,{x,z});
  }
  assert.equal(found.size,16,'all 16 weighted regions have reachable land');
  return found;
}

test('seeded region selection reaches every biome with the published region probabilities',()=>{
  const gen=Terrain.makeGen(12345),counts={};
  let total=0;
  for(let gx=-100;gx<=100;gx++)for(let gz=-100;gz<=100;gz++) {
    const region=gen.regionAt(gx*160+80,gz*160+80);
    // The midpoint belongs to its lattice cell for the configured center jitter.
    assert.equal(region.x,gx);assert.equal(region.z,gz);
    counts[region.biome]=(counts[region.biome]||0)+1;total++;
  }
  assert.equal(Object.keys(counts).length,16);
  for(const [id,def] of Object.entries(BIOMES)) {
    const actual=counts[id]/total*100;
    assert.ok(Math.abs(actual-def.chance)<.55,id+': '+actual+'% versus '+def.chance+'%');
  }
});

test('each biome has its own surface and naturally exposed, mineable resource nodes',()=>{
  const gen=Terrain.makeGen(20261108);
  for(const [id,point] of representatives(gen)) {
    let resources=0,surfaces=0;
    const cx=Math.floor(point.x/16),cz=Math.floor(point.z/16);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      const bx=cx+dx,bz=cz+dz,data=gen.genChunk(bx,bz);
      for(let x=0;x<16;x++)for(let z=0;z<16;z++) {
        const wx=bx*16+x,wz=bz*16+z;
        if(gen.biomeAt(wx,wz)!==id)continue;
        const h=gen.heightAt(wx,wz);
        if(h<=CONFIG.SEA+1)continue;
        if(data[Terrain.idx(x,h,z)]===BIOMES[id].surface)surfaces++;
        if(data[Terrain.idx(x,h+1,z)]===BIOMES[id].resource) {
          resources++;
          assert.notEqual(data[Terrain.idx(x,h,z)],BLOCK.AIR);
          assert.equal(data[Terrain.idx(x,h+2,z)],BLOCK.AIR,'resource has an exposed upper face');
        }
      }
      for(const block of data)assert.ok(block===BLOCK.AIR || BLOCKS[block],'valid block ID '+block);
    }
    assert.ok(surfaces>0,id+' has the declared surface material');
    assert.ok(resources>0,id+' has accessible biome resources');
  }
});

test('new terrain stays deterministic across generation order, negative coordinates and region borders',()=>{
  const a=Terrain.makeGen(6751),b=Terrain.makeGen(6751),different=Terrain.makeGen(6752);
  const first=a.genChunk(-10,-1);
  a.genChunk(-9,-1);a.genChunk(0,0);
  b.genChunk(0,0);b.genChunk(-9,-1);
  assert.deepEqual(first,b.genChunk(-10,-1));
  assert.notDeepEqual(first,different.genChunk(-10,-1));
  let changedSeed=false;
  for(let x=-800;x<800;x+=7)for(const z of [-321,-160,-1,0,159,160,319]) {
    const h=a.heightAt(x,z);
    assert.ok(h>=4 && h<=56);
    assert.ok(Math.abs(h-a.heightAt(x+1,z))<=3,'smooth X border at '+x+','+z);
    assert.ok(Math.abs(h-a.heightAt(x,z+1))<=3,'smooth Z border at '+x+','+z);
    if(a.biomeAt(x,z)!==different.biomeAt(x,z))changedSeed=true;
  }
  assert.ok(changedSeed);
});

test('bamboo forests, cherry forests and glacial regions produce their visible terrain features',()=>{
  const gen=Terrain.makeGen(20261108),points=representatives(gen);
  const expected={bamboo:BLOCK.BAMBOO,cherry:BLOCK.CHERRY_LEAVES,glacier:BLOCK.ICE,badlands:BLOCK.TERRACOTTA};
  for(const [id,block] of Object.entries(expected)) {
    const point=points.get(id),cx=Math.floor(point.x/16),cz=Math.floor(point.z/16);
    let count=0;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
      for(const value of gen.genChunk(cx+dx,cz+dz))if(value===block)count++;
    assert.ok(count>0,id+' visible feature');
  }
});

test('version-one worlds delegate to the retained original terrain generator',()=>{
  const sentinel={oldWorld:true};
  const legacy={makeGen:seed=>({...sentinel,seed})};
  const terrain=new Function('LegacyTerrain',source('config.js')+'\n'+source('noise.js')+'\n'+source('terrain.js')+'\nreturn Terrain;')(legacy);
  assert.deepEqual(terrain.makeGen(83,1),{oldWorld:true,seed:83});
  assert.equal(terrain.makeGen(83).generatorVersion,2);
});
