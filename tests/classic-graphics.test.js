'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const THREE = require('../pogl-game/vendor/three.min.js');
const png = require('./helpers/png');
const root = path.join(__dirname,'..');
const source = p => fs.readFileSync(path.join(root,p),'utf8');
const core = new Function(source('js/game/config.js')+'\nreturn {CONFIG,BLOCK,BLOCKS,ITEMS};')();
const {CONFIG,BLOCK,BLOCKS,ITEMS} = core;
const Noise = new Function(source('js/game/noise.js')+'\nreturn Noise;')();
const VoxelLighting = new Function('CONFIG','BLOCK','BLOCKS','THREE',source('js/game/voxel-lighting.js')+'\nreturn VoxelLighting;')(CONFIG,BLOCK,BLOCKS,THREE);
const pack = JSON.parse(source('img/classic/pack.json'));

function field(blockAt) {
  const map = VoxelLighting.create();
  map.build(0,0,(x,z)=>{
    const data=new Uint8Array(CONFIG.HEIGHT);
    for(let y=0;y<CONFIG.HEIGHT;y++)data[y]=blockAt(x,y,z);
    return {data,offset:0};
  });
  return map;
}

test('open sky remains level 15 and a sealed underground chamber has no sky light',()=>{
  const sky=field((x,y,z)=>y===0?BLOCK.STONE:BLOCK.AIR);
  assert.deepEqual(sky.sample(8,1,8),[15,0]);
  assert.deepEqual(sky.sample(8,63,8),[15,0]);
  const cave=field((x,y,z)=>y===0||y===10?BLOCK.STONE:BLOCK.AIR);
  assert.deepEqual(cave.sample(8,5,8),[0,0]);
});

test('leaf canopies filter daylight and light reaches a doorway from the side',()=>{
  const canopy=field((x,y,z)=>y===0?BLOCK.STONE:y===10?BLOCK.LEAVES:BLOCK.AIR);
  assert.equal(canopy.sample(8,1,8)[0],13);
  const room=field((x,y,z)=>{
    if(y===0)return BLOCK.STONE;
    if(x>=3&&x<=13&&z>=3&&z<=13){
      if(y===8)return BLOCK.STONE;
      if(y<8&&(x===3||x===13||z===3||z===13))return x===3&&z===8&&y<4?BLOCK.AIR:BLOCK.STONE;
    }
    return BLOCK.AIR;
  });
  assert.ok(room.sample(4,2,8)[0]>room.sample(10,2,8)[0]);
  assert.ok(room.sample(10,2,8)[0]>0,'doorway admits diffuse skylight');
});

test('torch light propagates across chunk borders and is stopped by an opaque wall',()=>{
  const lit=field((x,y,z)=>y===0||y===10?BLOCK.STONE:x===15&&y===3&&z===8?BLOCK.TORCH:BLOCK.AIR);
  assert.deepEqual(lit.sample(15,3,8),[0,14]);
  assert.deepEqual(lit.sample(16,3,8),[0,13]);
  const blocked=field((x,y,z)=>{
    if(y===0||y===10||x===10)return BLOCK.STONE;
    return x===8&&y===3&&z===8?BLOCK.GLOWSTONE:BLOCK.AIR;
  });
  assert.equal(blocked.sample(9,3,8)[1],14);
  assert.equal(blocked.sample(11,3,8)[1],0);
});

test('changing time updates shared light uniforms while preserving torch brightness',()=>{
  const daylight={value:1};
  const material=VoxelLighting.material({vertexColors:true},daylight);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
  material.onBeforeCompile(shader);
  assert.ok(material.isMeshBasicMaterial);
  assert.ok(shader.vertexShader.includes('vVoxelLight = voxelLight'));
  assert.ok(shader.fragmentShader.includes('blockBrightness'));
  assert.equal(shader.uniforms.voxelDaylight,daylight);
  daylight.value=.12;
  assert.equal(shader.uniforms.voxelDaylight.value,.12);
  assert.ok(shader.fragmentShader.includes('max(vec3(skyBrightness)'),'block light is independent of daylight');
});

test('classic pack ships complete attributed 16px art, transparent plants and opaque water frames',()=>{
  const atlas=png(path.join(root,'img/classic/atlas.png'));
  assert.equal(atlas.width,256);assert.equal(atlas.height,256);
  assert.equal(pack.tiles.length,52);
  for(const tile of pack.tiles){
    assert.ok(fs.existsSync(path.join(root,'img/classic/src',tile.source)));
    const [col,row]=tile.at;
    let solid=0,transparent=0;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const alpha=atlas.rgba[((row*16+y)*atlas.width+col*16+x)*4+3];
      if(alpha>0)solid++;else transparent++;
    }
    assert.ok(solid>0,tile.source);
    if(row===11)assert.ok(transparent>64,'plant silhouettes need alpha holes');
  }
  const water=png(path.join(root,'img/classic/water.png'));
  assert.equal(water.width,16);assert.equal(water.height,256);
  for(let i=3;i<water.rgba.length;i+=4)assert.equal(water.rgba[i],255);
  assert.ok(source('img/classic/README.txt').includes('XSSheep'));
  assert.ok(source('img/classic/LICENSE-CC-BY-SA-3.0.txt').includes('https://creativecommons.org/licenses/by-sa/3.0/'));
});

function packRuntime(failImages=false) {
  const images={};
  for(const name of ['atlas','water']){
    const decoded=png(path.join(root,'img/classic/'+name+'.png'));
    const pixels=new Map();
    for(let y=0;y<decoded.height;y++)for(let x=0;x<decoded.width;x++){
      const i=(y*decoded.width+x)*4,[r,g,b,a]=decoded.rgba.subarray(i,i+4);
      if(a)pixels.set(x+','+y,`rgba(${r},${g},${b},${a/255})`);
    }
    images[name]={width:decoded.width,height:decoded.height,pixels};
  }
  const document={createElement(){
    const canvas={width:0,height:0,pixels:new Map()};
    const ctx={fillStyle:'',fillRect(x,y,w,h){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)canvas.pixels.set((x+dx)+','+(y+dy),this.fillStyle);},
      clearRect(x,y,w,h){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)canvas.pixels.delete((x+dx)+','+(y+dy));},
      drawImage(image,...args){
        const [sx,sy,sw,sh,tx,ty,tw,th]=args.length===2?[0,0,image.width,image.height,...args,image.width,image.height]:args;
        for(let dy=0;dy<th;dy++)for(let dx=0;dx<tw;dx++){
          const pixel=image.pixels.get(Math.floor(sx+dx*sw/tw)+','+Math.floor(sy+dy*sh/th));
          if(pixel)canvas.pixels.set((tx+dx)+','+(ty+dy),pixel);
        }
      }};
    canvas.getContext=()=>ctx;return canvas;
  }};
  class Image {
    set src(url){
      Object.assign(this,images[url.includes('water')?'water':'atlas']);
      queueMicrotask(()=>failImages?this.onerror():this.onload());
    }
  }
  const fetch=async()=>({ok:true,json:async()=>pack});
  const Textures=new Function('document','THREE','Noise','BLOCKS','ITEMS','Image','fetch',source('js/game/mobile-test-textures.js')+'\nreturn Textures;')(
    document,THREE,Noise,BLOCKS,ITEMS,Image,fetch);
  Textures.init();
  return {Textures,images};
}

test('padded mipmapped atlas keeps sharp pixels and duplicates tile edges into gutters',async()=>{
  const {Textures}=packRuntime();
  assert.equal(await Textures.loadClassicPack(),true);
  const texture=Textures.getTexture(),uv=Textures.tileUV(0,0);
  assert.equal(texture.image.width,1024);
  assert.equal(texture.magFilter,THREE.NearestFilter);
  assert.equal(texture.minFilter,THREE.NearestMipmapLinearFilter);
  assert.equal(texture.generateMipmaps,true);
  assert.equal(uv.u0*1024,8.25);assert.equal(uv.u1*1024,23.75);
  const pixels=texture.image.pixels;
  assert.equal(pixels.get('0,8'),pixels.get('8,8'));
  assert.equal(pixels.get('31,8'),pixels.get('23,8'));
  assert.notEqual(pixels.get('32,8'),pixels.get('31,8'),'neighboring dirt stays in its own tile');
});

test('pixel water advances through real frames and remains frozen with zero simulation delta',async()=>{
  const {Textures,images}=packRuntime();
  await Textures.loadClassicPack();
  const version=Textures.getTexture().version;
  Textures.animate(0);
  assert.equal(Textures.getTexture().version,version);
  Textures.animate(.125);
  assert.equal(Textures.getTexture().version,version+1);
  assert.equal(Textures.getAtlas().pixels.get('80,16'),images.water.pixels.get('0,16'));
  assert.equal(Textures.getTexture().image.pixels.get('168,40'),images.water.pixels.get('0,16'));
});

test('every new item and block keeps nonempty art inside the enlarged atlas after pack loading',async()=>{
  const {Textures}=packRuntime();
  await Textures.loadClassicPack();
  const atlas=Textures.getAtlas().pixels,gpu=Textures.getTexture().image.pixels;
  const entries=[...BLOCKS.entries()].filter(([id])=>id>=46).concat(Object.entries(ITEMS).filter(([id])=>Number(id)>=300));
  for(const [id,def] of entries){
    for(const [col,row] of Object.values(def.tiles)){
      assert.ok(col>=0&&col<32&&row>=0&&row<32,def.name+' tile bounds');
      let visible=0;
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        const color=atlas.get((col*16+x)+','+(row*16+y));
        if(color){visible++;assert.equal(gpu.get((col*32+8+x)+','+(row*32+8+y)),color,def.name+' GPU copy');}
      }
      assert.ok(visible>8,def.name+' ('+id+') has visible art');
    }
  }
});

test('failed image loading preserves the generated atlas and valid legacy UVs',async()=>{
  const {Textures}=packRuntime(true);
  assert.equal(await Textures.loadClassicPack(),false);
  assert.equal(Textures.getTexture().image.width,512);
  assert.equal(Textures.getTexture().generateMipmaps,false);
  const uv=Textures.tileUV(11,11);
  assert.ok(uv.u0>=0&&uv.u1<=1&&uv.v0>=0&&uv.v1<=1);
  assert.doesNotThrow(()=>Textures.animate(.2));
});

test('three opaque cactus faces stay distinct after loading the classic texture pack',async()=>{
  const {Textures}=packRuntime();
  const tiles=BLOCKS[BLOCK.CACTUS].tiles;
  const snapshot=()=>Object.values(tiles).map(([col,row])=>
    Array.from({length:256},(_,i)=>Textures.getAtlas().pixels.get((col*16+i%16)+','+(row*16+(i>>4)))));
  const before=snapshot();
  for(const pixels of before)assert.equal(pixels.filter(Boolean).length,256);
  assert.notDeepEqual(before[0],before[1]);assert.notDeepEqual(before[0],before[2]);
  assert.equal(await Textures.loadClassicPack(),true);
  assert.deepEqual(snapshot(),before,'pack does not overwrite original cactus art');
  const gpu=Textures.getTexture().image.pixels;
  for(const [col,row] of Object.values(tiles))for(let y=0;y<16;y++)for(let x=0;x<16;x++)
    assert.equal(gpu.get((col*32+8+x)+','+(row*32+8+y)),Textures.getAtlas().pixels.get((col*16+x)+','+(row*16+y)));
});

test('texture startup promise is awaited by the guest game loader',()=>{
  assert.ok(source('js/game/mobile-test-main.js').includes('window.webcraftBoot = (async'));
  assert.ok(source('js/auth-play.js').indexOf('await window.webcraftBoot')<source('js/auth-play.js').indexOf('notice.remove()'));
});
