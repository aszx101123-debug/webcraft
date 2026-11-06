'use strict';

// WebCraft achievements: gentle, non-combat game milestones.
// Saved only inside the current world, with no account/network tracking.
const WorldMilestones = (() => {
  const GOALS=Object.freeze([
    {id:'wood',icon:'▦',title:'나무와 첫 만남',desc:'원목을 처음 채굴하기',max:1,stat:'wood'},
    {id:'stone',icon:'◆',title:'돌 수집가',desc:'돌 블록 12개 채굴하기',max:12,stat:'stone'},
    {id:'craft',icon:'✦',title:'첫 번째 제작',desc:'아이템을 처음 제작하기',max:1,stat:'craft'},
    {id:'workbench',icon:'▣',title:'작업실 준비',desc:'제작대 1개 설치하기',max:1,stat:'workbench'},
    {id:'storage',icon:'▤',title:'정리의 시작',desc:'보관 상자 1개 설치하기',max:1,stat:'storage'},
    {id:'lights',icon:'☀',title:'빛이 있는 곳',desc:'횃불 3개 설치하기',max:3,stat:'lights'},
    {id:'builder',icon:'▥',title:'건축가',desc:'블록 64개 설치하기',max:64,stat:'placed'},
    {id:'ore',icon:'◈',title:'광물 탐사',desc:'광석 블록 5개 채굴하기',max:5,stat:'ore'},
    {id:'trail',icon:'⌁',title:'첫 번째 발자취',desc:'100블록 이동하기',max:100,stat:'distance'},
    {id:'explore',icon:'◎',title:'넓은 세계',desc:'서로 다른 바이옴 3종 발견하기',max:3,stat:'biomes'},
    {id:'journey',icon:'✷',title:'대륙 탐험가',desc:'서로 다른 바이옴 6종 발견하기',max:6,stat:'biomes'}
  ]);
  const COUNTERS=['wood','stone','craft','workbench','storage','lights','placed','ore'];
  const clamp=(v,max=10000000)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
  let counters={},completed=new Set(),listeners=new Set();
  let travelled=0,foundBiomes=0;
  function freshCounters(){return Object.fromEntries(COUNTERS.map(k=>[k,0]));}
  function init(saved){
    counters=freshCounters();completed=new Set();travelled=0;foundBiomes=0;
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
      for(const k of COUNTERS)counters[k]=clamp(saved.counts?.[k]);
      travelled=clamp(saved.travelled,100000000);
      foundBiomes=clamp(saved.biomes,8);
      if(Array.isArray(saved.completed))for(const id of saved.completed)
        if(GOALS.some(goal=>goal.id===id))completed.add(id);
    }
    // Repair inconsistent imported counters without revoking earned milestones.
    evaluate(false);
    render();
  }
  function score(goal){
    if(goal.stat==='distance')return travelled;
    if(goal.stat==='biomes')return foundBiomes;
    return counters[goal.stat]||0;
  }
  function evaluate(emit=true){
    const unlocked=[];
    for(const goal of GOALS){
      if(completed.has(goal.id)||score(goal)<goal.max)continue;
      completed.add(goal.id);
      unlocked.push(goal);
      if(emit)for(const callback of listeners)callback({...goal});
    }
    return unlocked;
  }
  function record(kind,id,mode='survival'){
    if(mode!=='survival')return [];
    if(kind==='mine'){
      if([BLOCK.LOG,BLOCK.BIRCH_LOG,BLOCK.SPRUCE_LOG].includes(id))counters.wood++;
      if([BLOCK.STONE,BLOCK.COBBLE].includes(id))counters.stone++;
      if([BLOCK.IRON_ORE,BLOCK.GOLD_ORE,BLOCK.COPPER_ORE,
          BLOCK.COAL_ORE,BLOCK.DIAMOND_ORE,BLOCK.EMERALD_ORE,
          BLOCK.REDSTONE_ORE,BLOCK.LAPIS_ORE].includes(id))counters.ore++;
    }
    if(kind==='place'){
      counters.placed++;
      if(id===BLOCK.CRAFTING_TABLE)counters.workbench++;
      if(id===BLOCK.CHEST)counters.storage++;
      if(id===BLOCK.TORCH)counters.lights++;
    }
    if(kind==='craft')counters.craft++;
    const rewards=evaluate();
    if(rewards.length)render();
    return rewards;
  }
  function syncExploration(stats){
    if(!stats||typeof stats!=='object')return [];
    if(Number.isFinite(stats.distance))travelled=Math.max(travelled,clamp(stats.distance,100000000));
    if(Number.isFinite(stats.found))foundBiomes=Math.max(foundBiomes,clamp(stats.found,8));
    const rewards=evaluate();
    if(rewards.length)render();
    return rewards;
  }
  function getProgress(){
    return {done:completed.size,total:GOALS.length,
      goals:GOALS.map(g=>({...g,progress:Math.min(g.max,score(g)),completed:completed.has(g.id)})),
      counts:{...counters},travelled,biomes:foundBiomes};
  }
  function serialize(){
    return {version:1,counts:{...counters},travelled,biomes:foundBiomes,
      completed:[...completed]};
  }
  function onUnlock(callback){
    if(typeof callback!=='function')return ()=>{};
    listeners.add(callback);
    return ()=>listeners.delete(callback);
  }
  function render(){
    const list=document.getElementById('journal-milestones');
    if(!list)return;
    const summary=document.getElementById('milestone-summary');
    if(summary)summary.textContent='완료 '+completed.size+' / '+GOALS.length+'개 목표';
    list.replaceChildren();
    for(const goal of GOALS){
      const done=completed.has(goal.id);
      const item=document.createElement('div');
      item.className='milestone-card'+(done?' unlocked':'');
      const glyph=document.createElement('span');
      glyph.className='milestone-icon';
      glyph.textContent=goal.icon;
      const body=document.createElement('div');
      body.className='milestone-body';
      const title=document.createElement('strong');
      title.textContent=goal.title;
      const desc=document.createElement('small');
      desc.textContent=goal.desc;
      const bar=document.createElement('div');
      bar.className='milestone-progress';
      const fill=document.createElement('i');
      fill.style.width=Math.round(Math.min(1,score(goal)/goal.max)*100)+'%';
      bar.appendChild(fill);
      body.append(title,desc,bar);
      const value=document.createElement('span');
      value.className='milestone-counter';
      value.textContent=done?'✓':Math.min(goal.max,score(goal))+'/'+goal.max;
      item.append(glyph,body,value);
      list.appendChild(item);
    }
  }
  return {init,record,syncExploration,getProgress,serialize,onUnlock,render};
})();
