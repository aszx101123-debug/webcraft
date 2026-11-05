'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const storage=new Map();
const localStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value))
};
const skins=new Function('localStorage',read('js/skin-studio.js')+
  '\nreturn WebCraftSkins;')(localStorage);
let passed=0;
function check(label,fn){fn();passed++;console.log('PASS',label);}
check('legacy appearance is safely expanded with new style defaults',()=>{
  const a=skins.normalize({skin:2,shirt:3,hairStyle:'long'});
  assert.equal(a.skin,2);assert.equal(a.shirt,3);
  assert.equal(a.hairStyle,'long');assert.equal(a.accessory,'none');
  assert.equal(a.shirtStyle,'solid');assert.equal(a.eyes,'dark');
});
check('invalid style inputs never reach the avatar model',()=>{
  const a=skins.normalize({skin:200,accessory:'danger',shirtStyle:'unknown',eyes:'no'});
  assert.equal(a.skin,skins.defaults.skin);
  assert.equal(a.accessory,'none');
  assert.equal(a.shirtStyle,'solid');
  assert.equal(a.eyes,'dark');
});
check('six presets contain valid non-default styles',()=>{
  assert.equal(skins.presets.length,6);
  assert.ok(skins.presets.some(p=>p.appearance.shirtStyle!=='solid'));
  for(const p of skins.presets)assert.deepEqual(skins.normalize(p.appearance),p.appearance);
});
check('homepage storage roundtrips colors and accessory data',()=>{
  const result=skins.save({...skins.defaults,hair:5,shirtStyle:'hoodie',accessory:'glasses'});
  assert.ok(result.updatedAt>0);
  const restored=skins.load();
  assert.equal(restored.appearance.hair,5);
  assert.equal(restored.appearance.accessory,'glasses');
  assert.equal(restored.appearance.shirtStyle,'hoodie');
});
let pixels=0;
const ctx={clearRect(){},fillRect(){pixels++;},scale(){},save(){},restore(){},
  set fillStyle(v){}};
check('skin preview renders both faces in pixel art',()=>{
  const canvas={width:240,height:336,getContext:()=>ctx};
  assert.equal(skins.draw(canvas,skins.presets[0].appearance),true);
  const first=pixels;
  assert.ok(first>35);
  assert.equal(skins.draw(canvas,skins.presets[4].appearance,true),true);
  assert.ok(pixels>first);
});
class Element {
  constructor(id){
    this.id=id;this.children=[];this.events={};this.className='';
    this.style={setProperty(){}};this.attributes={};this.classList={toggle:()=>{}};
    this.textContent='';
  }
  replaceChildren(...elements){this.children=elements;}
  appendChild(child){this.children.push(child);}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(key,cb){this.events[key]=cb;}
  click(){this.events.click?.();}
  getContext(){return ctx;}
}
const elements=new Map();
const document={
  getElementById:id=>{
    if(!elements.has(id))elements.set(id,new Element(id));
    return elements.get(id);
  },
  createElement:tag=>new Element(tag)
};
const window={WebCraftSkins:skins};
check('homepage creator builds six presets and nine choices',()=>{
  new Function('document','window',read('js/skin-studio-page.js'))(document,window);
  assert.equal(document.getElementById('skin-studio-presets').children.length,6);
  assert.equal(document.getElementById('skin-studio-options').children.length,9);
});
check('preset selection is saved for gameplay',()=>{
  document.getElementById('skin-studio-presets').children[1].click();
  const current=skins.load();
  assert.equal(current.appearance.shirt,3);
  assert.equal(current.appearance.shirtStyle,'badge');
});
check('individual color selection and reset button work',()=>{
  const options=document.getElementById('skin-studio-options');
  const shirtChoices=options.children[4].children[1].children;
  shirtChoices[2].click();
  assert.equal(skins.load().appearance.shirt,2);
  document.getElementById('skin-studio-reset').click();
  assert.equal(skins.load().appearance.shirt,skins.defaults.shirt);
});
check('front and back preview button switches label',()=>{
  const turn=document.getElementById('skin-studio-turn');
  turn.click();
  assert.equal(turn.textContent,'앞에서 보기');
  turn.click();
  assert.equal(turn.textContent,'뒤에서 보기');
});
console.log('All '+passed+' skin studio checks passed.');
