'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const children={};const events={};
class El{
  constructor(){this.children=[];this.className='';this.textContent='';this.classes=new Set();
    this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),contains:c=>this.classes.has(c)};}
  replaceChildren(...arr){this.children=arr}
  append(...arr){this.children.push(...arr)}
  appendChild(child){this.children.push(child)}
}
const document={
  getElementById:id=>children[id]||(children[id]=new El()),
  createElement:()=>new El()
};
const Journal=new Function('document',source('js/game/world-journal.js')+
  '\nreturn WorldJournal;')(document);
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name);}
check('new world journal starts empty and exposes eight supported biomes',()=>{
  Journal.init(null);
  const stats=Journal.getStats();
  assert.equal(stats.found,0);assert.equal(stats.total,8);
  assert.equal(stats.distance,0);assert.equal(stats.home,null);
});
check('visiting new biomes records discovery only once',()=>{
  assert.ok(Journal.update(.016,{x:3,y:6,z:3},'plains'));
  assert.equal(Journal.update(.016,{x:4,y:6,z:3},'plains'),false);
  assert.ok(Journal.update(.016,{x:5,y:6,z:3},'forest'));
  assert.equal(Journal.getStats().found,2);
  assert.equal(Journal.getStats().distance,2);
});
check('teleport-like jumps and invalid positions do not inflate distance',()=>{
  Journal.update(.016,{x:10000,y:10,z:10000},'forest');
  assert.equal(Journal.getStats().distance,2);
  Journal.update(.016,{x:NaN,y:0,z:5},'taiga');
  assert.equal(Journal.getStats().found,2);
});
check('home position persists and distance uses in-game block coordinates',()=>{
  Journal.setHome({x:5,y:10,z:5});
  Journal.update(.016,{x:8,y:10,z:9},'taiga');
  assert.equal(Journal.getStats().homeDistance,5);
  assert.deepEqual(Journal.getStats().home,{x:5,y:10,z:5});
});
check('journal saves and restores home, discovered biomes and travel',()=>{
  const saved=Journal.serialize();
  Journal.init(saved);
  assert.equal(Journal.getStats().found,3);
  assert.equal(Journal.getStats().distance,2);
  assert.equal(Journal.getStats().home.x,5);
});
check('corrupted/duplicate biome history is sanitized',()=>{
  Journal.init({distance:-400,home:{x:Infinity,y:0,z:3},
    visited:[{biome:'forest',x:1,z:2},{biome:'forest',x:8,z:9},
      {biome:'hacker',x:0,z:0}]});
  assert.equal(Journal.getStats().found,1);
  assert.equal(Journal.getStats().home,null);
  assert.equal(Journal.getStats().distance,0);
});
check('journal panel populates eight readable tiles and supports close callback',()=>{
  let closed=0;
  Journal.setOnClose(()=>closed++);
  Journal.show();
  assert.equal(children['journal-biomes'].children.length,8);
  assert.equal(Journal.isOpen(),true);
  assert.equal(children['overlay-journal'].classList.contains('hidden'),false);
  Journal.close();
  assert.equal(closed,1);
  assert.equal(Journal.isOpen(),false);
  assert.equal(children['overlay-journal'].classList.contains('hidden'),true);
});
check('PC/mobile pages load journal and helpful controls',()=>{
  for(const page of ['play.html','mobile-test.html']){
    const html=source(page);
    assert.ok(html.includes('world-journal.js?v=v135'));
    assert.ok(html.includes('id="overlay-journal"'));
    assert.ok(html.includes('id="journal-set-home"'));
    assert.ok(html.includes('id="save-indicator"'));
  }
  const main=source('js/game/mobile-test-main.js');
  assert.ok(main.includes('WorldJournal.serialize()'));
  assert.ok(main.includes("e.code === 'KeyJ'"));
  assert.ok(main.includes("e.code === 'F3'"));
  assert.ok(main.includes("data-act=\"journal\""));
  const world=source('js/game/world.js');
  assert.ok(world.includes('biomeAt: (x, z)'));
});
console.log('All '+passed+' journal and quality-of-life checks passed.');
