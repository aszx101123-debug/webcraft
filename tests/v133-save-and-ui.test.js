'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const conf=new Function(read('js/game/config.js')+
 '\nreturn {CONFIG,BLOCK,BLOCKS,getItemDef,getToolDef,getArmorDef};')();
const memory=new Map();
const localStorage={
 getItem:k=>memory.get(k)??null,
 setItem:(k,v)=>memory.set(k,String(v)),
 removeItem:k=>memory.delete(k)
};
const SaveSystem=new Function('localStorage','CONFIG','BLOCKS','getItemDef','getToolDef','getArmorDef',
 read('js/game/save.js')+'\nreturn SaveSystem;')(
 localStorage,conf.CONFIG,conf.BLOCKS,conf.getItemDef,conf.getToolDef,conf.getArmorDef);
let passed=0;
function check(label,fn){fn();passed++;console.log('PASS',label);}
const chest=[{id:conf.BLOCK.COBBLE,count:32},...Array(17).fill(null)];
const snapshot={
 version:6,seed:123456,player:{x:2,y:5,z:3},
 edits:[['0,0',[[65,conf.BLOCK.CHEST],[66,conf.BLOCK.WOOD_DOOR],[67,conf.BLOCK.WOOD_DOOR_TOP]]]],
 blockObjects:[['1,1,1',{facing:'north',chest}],['2,1,2',{facing:'west',open:true}]]
};
check('furniture data survives save and reload',()=>{
 const meta=SaveSystem.create('Furniture backup',123456);assert.ok(meta);
 assert.equal(SaveSystem.save(meta.id,snapshot),true);
 const reloaded=SaveSystem.load(meta.id);
 assert.equal(reloaded.blockObjects[0][1].chest[0].count,32);
 assert.equal(reloaded.blockObjects[1][1].open,true);
 const exported=SaveSystem.exportWorld(meta.id);
 assert.ok(exported);snapshot._exported=exported;
});
check('portable backups retain chest contents in separate imported world',()=>{
 const imported=SaveSystem.importWorld(snapshot._exported);
 assert.ok(imported);
 assert.equal(SaveSystem.load(imported.id).blockObjects[0][1].chest[0].id,conf.BLOCK.COBBLE);
 assert.equal(SaveSystem.load(imported.id).blockObjects[1][1].facing,'west');
});
check('invalid imported furniture position and oversized stacks are rejected',()=>{
 const invalid=JSON.parse(JSON.stringify(snapshot._exported));
 invalid.world.blockObjects=[['not-a-voxel',{chest}]];
 assert.equal(SaveSystem.importWorld(invalid),null);
 const over=JSON.parse(JSON.stringify(snapshot._exported));
 over.world.blockObjects[0][1].chest[0].count=100000;
 assert.equal(SaveSystem.importWorld(over),null);
});
class Node{
 constructor(){this.attrs={};this.events={};this.classes=new Set();this.links=[];
 this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),
 contains:name=>this.classes.has(name)};}
 setAttribute(name,value){this.attrs[name]=String(value)}
 getAttribute(name){return this.attrs[name]}
 addEventListener(name,fn){this.events[name]=fn}
 querySelectorAll(){return this.links}
 contains(target){return this===target}
 click(){this.events.click?.({})}
}
const button=new Node(), menu=new Node(), link=new Node();
menu.links=[link];button.attrs['aria-expanded']='false';
const docEvents={},winEvents={};
const document={
 querySelector:sel=>sel==='.nav-toggle'?button:null,
 getElementById:id=>id==='site-menu'?menu:null,
 addEventListener:(type,fn)=>docEvents[type]=fn
};
const window={innerWidth:370,addEventListener:(type,fn)=>winEvents[type]=fn};
new Function('document','window',read('js/v133-home.js'))(document,window);
check('mobile homepage menu opens, closes and updates accessibility labels',()=>{
 button.click();
 assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.equal(menu.classList.contains('nav-open'),true);
 link.click();
 assert.equal(menu.classList.contains('nav-open'),false);
 button.click();
 docEvents.keydown({key:'Escape'});
 assert.equal(button.getAttribute('aria-expanded'),'false');
});
check('modern homepage needs no background WebGL and retains core resources',()=>{
 const html=read('index.html');
 assert.ok(!html.includes('js/hero.js'));
 assert.ok(html.includes('class="hero-showcase"'));
 assert.ok(html.includes('id="skin-studio"'));
 assert.ok(html.includes('id="guestbook"'));
 assert.ok(html.includes('css/v133-home.css?v=v133'));
});
console.log('All '+passed+' save/homepage checks passed.');
