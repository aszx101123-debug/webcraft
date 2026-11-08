'use strict';

const gamePage = require('./helpers/game-page');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {BLOCK}=new Function(src('js/game/config.js')+'\nreturn {BLOCK};')();
const nodes={};
class El{
  constructor(){this.children=[];this.style={};this.textContent='';this.className='';}
  replaceChildren(){this.children=[]}
  append(...children){this.children.push(...children)}
  appendChild(child){this.children.push(child)}
}
const document={createElement:()=>new El(),getElementById:id=>nodes[id]||(nodes[id]=new El())};
const WorldMilestones=new Function('document','BLOCK',src('js/game/world-milestones.js')+'\nreturn WorldMilestones;')(document,BLOCK);
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS',name)};
WorldMilestones.init();
let unlocked=[];
WorldMilestones.onUnlock(goal=>unlocked.push(goal.id));
check('fresh worlds start with 11 incomplete milestones',()=>{
  const stats=WorldMilestones.getProgress();
  assert.equal(stats.total,11);assert.equal(stats.done,0);
  assert.ok(stats.goals.every(g=>!g.completed));
});
check('creative placement and crafting never give survival builder credit',()=>{
  WorldMilestones.record('place',BLOCK.CHEST,'creative');
  WorldMilestones.record('craft',BLOCK.CRAFTING_TABLE,'creative');
  assert.equal(WorldMilestones.getProgress().done,0);
});
check('first mined log unlocks only the wood milestone once',()=>{
  assert.equal(WorldMilestones.record('mine',BLOCK.LOG,'survival').length,1);
  assert.equal(WorldMilestones.record('mine',BLOCK.BIRCH_LOG,'survival').length,0);
  assert.equal(unlocked.filter(x=>x==='wood').length,1);
});
check('placing crafting table, storage and light blocks unlocks distinct goals',()=>{
  WorldMilestones.record('place',BLOCK.CRAFTING_TABLE,'survival');
  WorldMilestones.record('place',BLOCK.CHEST,'survival');
  WorldMilestones.record('place',BLOCK.TORCH,'survival');
  WorldMilestones.record('place',BLOCK.TORCH,'survival');
  assert.equal(unlocked.includes('lights'),false);
  WorldMilestones.record('place',BLOCK.TORCH,'survival');
  assert.ok(unlocked.includes('workbench'));
  assert.ok(unlocked.includes('storage'));
  assert.ok(unlocked.includes('lights'));
});
check('survival crafting credits only completed crafts',()=>{
  WorldMilestones.record('craft',BLOCK.PLANK,'survival');
  assert.ok(unlocked.includes('craft'));
  assert.equal(WorldMilestones.getProgress().counts.craft,1);
});
check('stone and ore counters have separate achievement thresholds',()=>{
  for(let i=0;i<12;i++)WorldMilestones.record('mine',BLOCK.STONE,'survival');
  for(let i=0;i<5;i++)WorldMilestones.record('mine',BLOCK.COAL_ORE,'survival');
  assert.ok(unlocked.includes('stone'));
  assert.ok(unlocked.includes('ore'));
});
check('biome and distance progress sync with saved exploration journal',()=>{
  WorldMilestones.syncExploration({distance:100,found:3});
  assert.ok(unlocked.includes('trail'));
  assert.ok(unlocked.includes('explore'));
  assert.ok(!unlocked.includes('journey'));
  WorldMilestones.syncExploration({distance:80,found:2});
  assert.equal(WorldMilestones.getProgress().travelled,100);
  WorldMilestones.syncExploration({distance:500,found:6});
  assert.ok(unlocked.includes('journey'));
});
check('building 64 blocks counts only successful recorded survival placements',()=>{
  for(let i=0;i<59;i++)WorldMilestones.record('place',BLOCK.DIRT,'survival');
  assert.ok(unlocked.includes('builder'));
});
check('save/restore preserves achievements and counters',()=>{
  const snapshot=WorldMilestones.serialize();
  const count=WorldMilestones.getProgress().done;
  WorldMilestones.init(snapshot);
  assert.equal(WorldMilestones.getProgress().done,count);
  assert.equal(WorldMilestones.serialize().counts.placed,64);
});
check('corrupted or unexpected saved data is sanitized',()=>{
  WorldMilestones.init({counts:{wood:-100,placed:999999999},completed:['bogus','wood','wood'],biomes:900,travelled:-100});
  const p=WorldMilestones.getProgress();
  assert.equal(p.counts.wood,0);
  assert.equal(p.counts.placed,10000000);
  assert.equal(p.biomes,8);
  assert.equal(p.travelled,0);
  assert.equal(p.goals.find(x=>x.id==='wood').completed,true);
  assert.ok(!WorldMilestones.serialize().completed.includes('bogus'));
});
check('journal renders all goals without dynamic HTML injection',()=>{
  WorldMilestones.render();
  assert.equal(nodes['journal-milestones'].children.length,11);
  assert.ok(nodes['milestone-summary'].textContent.includes('11개'));
  assert.ok(nodes['journal-milestones'].children[0].children.length===3);
});
check('game scripts and both pages include the milestone lifecycle',()=>{
  const main=src('js/game/mobile-test-main.js');
  const crafting=src('js/game/mobile-test-crafting.js');
  const interactions=src('js/game/interaction.js');
  assert.ok(main.includes('milestones: WorldMilestones.serialize()'));
  assert.ok(main.includes('WorldMilestones.init(saved?.milestones)'));
  assert.ok(main.includes('WorldMilestones.syncExploration('));
  assert.ok(crafting.includes("WorldMilestones.record('craft'"));
  assert.ok(interactions.includes("WorldMilestones.record('mine'"));
  assert.ok(interactions.includes("WorldMilestones.record('place'"));
  for(const page of ['play.html','mobile-test.html']){
    const html=gamePage(page);
    assert.ok(html.includes('js/game/world-milestones.js?v=v136'));
    assert.ok(html.includes('id="journal-milestones"'));
    assert.ok(html.includes('id="milestone-unlock"'));
  }
});
console.log('All '+passed+' milestone regression checks passed.');
