'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function guide(){
  class Element{
    constructor(){this.children=[];this.textContent='';this.className='';this.hidden=true;this.focused=false;
      this.classList={add:name=>{if(name==='hidden')this.hidden=true;},remove:name=>{if(name==='hidden')this.hidden=false;}};}
    append(...children){this.children.push(...children);}
    appendChild(child){this.children.push(child);}
    replaceChildren(){this.children=[];}
    focus(){this.focused=true;}
    addEventListener(){}
    setAttribute(){}
  }
  const nodes=new Map(),listeners=[];
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},
    createElement:()=>new Element(),addEventListener:(event,callback)=>listeners.push({event,callback})};
  const api=new Function('document',source('js/game/config.js')+'\n'+source('js/game/world-journal.js')+
    '\nreturn {WorldJournal,BIOMES,getItemName};')(document);
  return {...api,nodes,listeners};
}

test('biome guide renders all sixteen chances and the actual resource-specific loot tables',()=>{
  const g=guide();g.WorldJournal.init();g.WorldJournal.showGuide();
  const rows=g.nodes.get('biome-guide-list').children;
  assert.equal(rows.length,16);
  assert.equal(g.nodes.get('overlay-biome-guide').hidden,false);
  assert.equal(g.nodes.get('biome-guide-close').focused,true);
  Object.entries(g.BIOMES).forEach(([id,def],index)=>{
    const row=rows[index];
    assert.equal(row.children[0].textContent,def.name);
    assert.ok(row.children[1].textContent.includes(def.chance+'%'));
    assert.equal(row.children[2].textContent,g.getItemName(def.resource)+' 채굴');
    assert.deepEqual(row.children[3].children.map(li=>li.textContent),
      def.loot.map(item=>g.getItemName(item.id)+' · '+item.chance+'%'));
  });
});

test('new biome discoveries survive journal serialization and are labelled in the guide',()=>{
  const g=guide();g.WorldJournal.init();
  for(const id of Object.keys(g.BIOMES))g.WorldJournal.update(.1,{x:25,y:30,z:-40},id);
  const saved=g.WorldJournal.serialize();g.WorldJournal.init(saved);
  assert.equal(g.WorldJournal.getStats().found,16);
  assert.equal(g.WorldJournal.getStats().total,16);
  g.WorldJournal.showGuide();
  assert.ok(g.nodes.get('biome-guide-list').children.every(row=>
    row.children[4].textContent==='발견한 지형 · X 25 / Z -40'));
});

test('guide closes through its own callback and keeps keyboard focus within the dialog',()=>{
  const g=guide();let guideCloses=0,journalCloses=0;
  g.WorldJournal.setOnClose(()=>journalCloses++);
  g.WorldJournal.setOnGuideClose(()=>guideCloses++);
  g.WorldJournal.init();g.WorldJournal.showGuide();
  assert.equal(g.WorldJournal.isOpen(),true);
  let prevented=0;
  for(const listener of g.listeners)listener.callback({code:'Tab',preventDefault(){prevented++;}});
  assert.equal(prevented,1);
  assert.equal(g.WorldJournal.close(),true);
  assert.equal(g.WorldJournal.isOpen(),false);
  assert.equal(g.nodes.get('overlay-biome-guide').hidden,true);
  assert.equal(guideCloses,1);assert.equal(journalCloses,0);
  assert.equal(g.WorldJournal.close(),false);
});

test('both game pages expose the guide from the pause menu with region probability and old-world guidance',()=>{
  for(const page of ['play.html','mobile-test.html']){
    const html=source(page);
    assert.ok(html.includes('id="btn-biome-guide"'));
    assert.ok(html.includes('aria-controls="overlay-biome-guide"'));
    assert.ok(html.includes('id="overlay-biome-guide" class="overlay hidden" role="dialog"'));
    assert.ok(html.includes('실제 면적 비율은 시드와 지역 크기에 따라'));
    assert.ok(html.includes('기존 월드는 이전 지형을 유지'));
    assert.ok(html.includes('css/biome-guide.css'));
  }
});

test('production pause-menu handlers return from the guide to a paused menu',()=>{
  const main=source('js/game/mobile-test-main.js');
  const start=main.indexOf("  document.getElementById('btn-biome-guide')?.addEventListener('click',()=>{");
  const end=main.indexOf('  WorldJournal.setOnChange',start);
  assert.ok(start>0&&end>start);
  const listeners={},overlays=[],focused=[];
  let onClose,opened=0,disabled=0;
  const state={paused:true};
  const document={getElementById:id=>({addEventListener:(event,callback)=>{listeners[id]=callback;},focus:()=>focused.push(id)})};
  const UI={showOverlay:value=>overlays.push(value)};
  const WorldJournal={showGuide:()=>opened++,setOnGuideClose:fn=>{onClose=fn;},close:()=>onClose()};
  new Function('state','document','UI','WorldJournal','disableTouchInput','performance',
    'let pauseBeganAt=0;\n'+main.slice(start,end))(state,document,UI,WorldJournal,()=>disabled++,{now:()=>1000});
  listeners['btn-biome-guide']();
  assert.equal(opened,1);assert.equal(disabled,1);assert.equal(state.paused,true);
  assert.deepEqual(overlays,[null]);
  listeners['biome-guide-close']();
  assert.equal(state.paused,true);
  assert.deepEqual(overlays,[null,'pause']);
  assert.deepEqual(focused,['btn-biome-guide']);
});
