'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const game=require('./helpers/item-game');
const gameAssets=require('./helpers/game-assets');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const core=new Function(read('js/game/config.js')+';return {GAME_MODE,SURVIVAL};')();

function hudRuntime(textureFile,uiFile){
  const nodes=new Map();
  function element(){
    const classes=new Set();
    return {children:[],attrs:{},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},
      set innerHTML(_){this.children=[];},appendChild(child){this.children.push(child);},
      setAttribute(key,value){this.attrs[key]=value;}};
  }
  const document={
    addEventListener(){},
    getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},
    createElement(kind){
      if(kind!=='canvas')return element();
      const canvas={width:0,height:0,pixels:{}};
      const context={fillStyle:'',fillRect(x,y){canvas.pixels[x+','+y]=this.fillStyle;}};
      canvas.getContext=()=>context;
      canvas.toDataURL=()=>JSON.stringify(canvas);
      return canvas;
    }
  };
  const Textures=new Function('document',read('js/game/'+textureFile)+'\nreturn Textures;')(document);
  const UI=new Function('document','Textures','GAME_MODE','SURVIVAL',
    read('js/game/'+uiFile)+';return UI;')(document,Textures,core.GAME_MODE,core.SURVIVAL);
  return {UI,icons:Textures.hudIcons(),nodes};
}

for(const [textureFile,uiFile] of [['textures.js','ui.js'],['mobile-test-textures.js','mobile-test-ui.js']]){
  test(uiFile+': ten hearts and drumsticks show full, half and empty values and restore after creative',()=>{
    const {UI,icons,nodes}=hudRuntime(textureFile,uiFile);
    UI.updateSurvival('survival',17,15,10);
    const hearts=nodes.get('hearts'),foods=nodes.get('foods');
    assert.equal(hearts.children.length,10);assert.equal(foods.children.length,10);
    assert.equal(hearts.children[8].src,icons.heartHalf);
    assert.equal(hearts.children[9].src,icons.heartEmpty);
    assert.equal(foods.children[6].src,icons.food);
    assert.equal(foods.children[7].src,icons.foodHalf);
    assert.equal(foods.children[8].src,icons.foodEmpty);
    assert.notEqual(icons.foodHalf,icons.food);
    assert.equal(foods.attrs['aria-valuenow'],'15');
    const unchanged=foods.children[0];
    UI.updateSurvival('survival',17,15,10);
    assert.equal(foods.children[0],unchanged,'unchanged HUD is cached');
    UI.updateSurvival('survival',16.5,0,10);
    assert.equal(hearts.children[8].src,icons.heartHalf,'fractional damage rounds up to half a heart');
    assert.equal(hearts.children[9].src,icons.heartEmpty);
    assert.ok(foods.children.every(img=>img.src===icons.foodEmpty));
    UI.updateSurvival('creative',20,20,10);
    assert.equal(nodes.get('survival-hud').classList.contains('hidden'),true);
    UI.updateSurvival('survival',20,20,10);
    assert.equal(nodes.get('survival-hud').classList.contains('hidden'),false);
    assert.ok(hearts.children.every(img=>img.src===icons.heart));
    assert.ok(foods.children.every(img=>img.src===icons.food));
  });

  test(textureFile+': outlined 9px stat sprites retain the empty half and transparent corners',()=>{
    const {icons}=hudRuntime(textureFile,uiFile);
    for(const [full,half,empty,side] of [['heart','heartHalf','heartEmpty','left'],['food','foodHalf','foodEmpty','right']]){
      const a=JSON.parse(icons[full]),b=JSON.parse(icons[half]),c=JSON.parse(icons[empty]);
      assert.equal(a.width,9);assert.equal(a.height,9);
      assert.equal(a.pixels['0,0'],undefined);
      assert.ok(new Set(Object.values(a.pixels)).size>=4,'visible outline, fill, highlight and shadow');
      for(const [key,color] of Object.entries(a.pixels)){
        const x=Number(key.split(',')[0]);
        assert.equal(b.pixels[key],(side==='left'?x<=4:x>=4)?color:c.pixels[key],key);
      }
    }
  });
}

test('standing on cactus tops and walking into the inset sides causes survival damage',()=>{
  const g=game(),P=g.Player;
  g.World.setBlock(8,1,8,g.BLOCK.CACTUS);
  P.reset(8.5,3,8.5);
  for(let i=0;i<90;i++)P.update(.016,{});
  assert.ok(Math.abs(P.pos.y-1.9375)<.02,'lands on the inset cactus collision box');
  assert.ok(P.hp<20,'top contact damages the player');
  P.reset(7.5,1,8.5,-Math.PI/2,0);
  P.hp=20;
  for(let i=0;i<45;i++)P.update(.016,{KeyW:true});
  assert.ok(P.hp<20,'side contact damages the player');
  assert.ok(P.pos.x<7.77,'movement stops at the inset side');
  P.reset(7.6,1,8.5);
  P.hp=20;
  P.update(.016,{});
  assert.equal(P.hp,20,'empty margin outside the cactus does not hurt');
  P.setMode(g.GAME_MODE.CREATIVE);P.reset(8.5,1.9375,8.5);
  P.hp=20;
  for(let i=0;i<90;i++)P.update(.016,{});
  assert.equal(P.hp,20,'creative contact is harmless');
});

test('PC, mobile and offline cache use the same game asset revisions and valid local files',()=>{
  const desktop=gameAssets('play.html'),mobile=gameAssets('mobile-test.html');
  assert.ok(desktop.length>20);
  assert.deepEqual(mobile,desktop);
  const worker=read('service-worker.js');
  for(const asset of desktop){
    assert.equal(desktop.filter(url=>url.split('?')[0]===asset.split('?')[0]).length,1,asset);
    assert.ok(fs.existsSync(path.join(__dirname,'..',asset.split('?')[0])),asset);
    assert.ok(worker.includes('"./'+asset+'"'),'offline cache includes '+asset);
  }
  for(const page of ['play.html','mobile-test.html']){
    const css=read(page).match(/href="(css\/classic\.css\?[^"\s]+)"/)[1];
    assert.ok(worker.includes('"./'+css+'"'));
  }
});
