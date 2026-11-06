'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nodes={};
class El{
  constructor(){this.children=[];this.classList={add(){},remove(){}};this.events={};
    this.value='';this.className='';this.textContent='';}
  replaceChildren(){this.children=[]}
  append(...a){this.children.push(...a)}
  appendChild(x){this.children.push(x)}
  addEventListener(k,fn){this.events[k]=fn}
  setAttribute(){}
}
const document={getElementById:id=>nodes[id]||(nodes[id]=new El()),createElement:()=>new El()};
const WorldJournal=new Function('document',src('js/game/world-journal.js')+'\nreturn WorldJournal;')(document);
let passed=0;
const check=(label,fn)=>{fn();passed++;console.log('PASS',label)};
let edits=0;
WorldJournal.setOnChange(()=>edits++);
WorldJournal.init();
WorldJournal.update(.016,{x:20.5,y:8,z:20.5},'forest');
check('new worlds start without saved bookmarks',()=>{
  assert.equal(WorldJournal.getStats().bookmarks.length,0);
  assert.equal(WorldJournal.serialize().version,3);
});
check('named and unnamed bookmarks capture game voxel coordinates',()=>{
  const a=WorldJournal.addBookmark({x:20.5,y:8.1,z:21.4},'나의 집');
  const b=WorldJournal.addBookmark({x:25.9,y:14.7,z:31.1},'');
  assert.equal(a.name,'나의 집');assert.equal(a.x,20);assert.equal(a.z,21);
  assert.equal(b.name,'거점 2');
  assert.equal(edits,2);
});
check('duplicate positions and invalid coordinates are rejected',()=>{
  assert.equal(WorldJournal.addBookmark({x:20.5,y:8.1,z:21.4},'중복'),false);
  assert.equal(WorldJournal.addBookmark({x:Infinity,y:1,z:3},'오류'),false);
  assert.equal(WorldJournal.addBookmark(null,'오류'),false);
  assert.equal(edits,2);
});
check('a maximum of five bookmarks prevents unbounded growth',()=>{
  for(let x=0;x<3;x++)assert.ok(WorldJournal.addBookmark({x:35+x,y:8,z:40},'거점'));
  assert.equal(WorldJournal.getStats().bookmarks.length,5);
  assert.equal(WorldJournal.addBookmark({x:70,y:8,z:70},'초과'),false);
});
check('names are truncated and rendered as plain text rather than HTML',()=>{
  assert.equal(WorldJournal.getStats().bookmarks[0].name,'나의 집');
  assert.ok(WorldJournal.getStats().bookmarks.every(x=>x.name.length<=18));
  WorldJournal.show();
  assert.equal(nodes['journal-bookmarks'].children.length,5);
  assert.equal(nodes['journal-bookmark-count'].textContent,'5/5');
  assert.equal(nodes['journal-bookmarks'].children[0].children[0].children[0].textContent,'⌖ 나의 집');
});
check('list removal updates state, view and save callback',()=>{
  assert.equal(WorldJournal.removeBookmark(1),true);
  assert.equal(WorldJournal.getStats().bookmarks.length,4);
  assert.equal(nodes['journal-bookmarks'].children.length,4);
  assert.equal(edits,6);
});
check('world serialization restores bookmarks without duplicates',()=>{
  const snapshot=WorldJournal.serialize();
  WorldJournal.init(snapshot);
  assert.equal(WorldJournal.getStats().bookmarks.length,4);
  assert.equal(WorldJournal.getStats().bookmarks[0].name,'나의 집');
  const duplicate=[...snapshot.bookmarks,snapshot.bookmarks[0]];
  WorldJournal.init({...snapshot,bookmarks:duplicate});
  assert.equal(WorldJournal.getStats().bookmarks.length,4);
});
check('previous version world journals without bookmarks still load',()=>{
  WorldJournal.init({version:2,home:{x:3,y:4,z:5},distance:150,
    visited:[{biome:'forest',x:3,z:5}]});
  assert.equal(WorldJournal.getStats().bookmarks.length,0);
  assert.equal(WorldJournal.getStats().home.x,3);
  assert.equal(WorldJournal.getStats().found,1);
});
check('new UI controls and save callback exist on both platforms',()=>{
  const main=src('js/game/mobile-test-main.js');
  assert.ok(main.includes('WorldJournal.addBookmark('));
  assert.ok(main.includes('WorldJournal.setOnChange(()=>doSave(true))'));
  for(const page of ['play.html','mobile-test.html']){
    const html=src(page);
    assert.ok(html.includes('id="journal-bookmark-name"'));
    assert.ok(html.includes('id="journal-bookmarks"'));
  }
});
console.log('All '+passed+' bookmark checks passed.');
