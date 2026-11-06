'use strict';

// Original WebCraft combat math. Damage is an abstract videogame health value;
// the recharge curve follows Minecraft Java's 20%-100% timing rule.
const Combat = (() => {
  const TYPES = Object.freeze({
    sword:   { damage: [4,5,6,4,7], speed: [1.6,1.6,1.6,1.6,1.6] },
    cutter:  { damage: [7,9,9,7,9], speed: [.8,.8,.9,1,1] },
    pickaxe: { damage: [2,3,4,2,5], speed: [1.2,1.2,1.2,1.2,1.2] },
    shovel:  { damage: [2.5,3.5,4.5,2.5,5.5], speed: [1,1,1,1,1] },
    hoe:     { damage: [1,1,1,1,1], speed: [1,2,3,1,4] }
  });
  const HAND = Object.freeze({damage:1, speed:4, type:'hand'});
  function getStats(id) {
    const def=getToolDef(id);
    const t=def && TYPES[def.toolType];
    if(!t)return HAND;
    const tier=Math.max(0,Math.min(4,(def.tier||1)-1));
    return {damage:t.damage[tier],speed:t.speed[tier],type:def.toolType};
  }
  function duration(id) { return 1000/getStats(id).speed; }
  function charge(id,elapsedMs) {
    if(elapsedMs===Infinity)return 1;
    if(!Number.isFinite(elapsedMs))return 0;
    return Math.min(1,Math.max(0,elapsedMs/duration(id)));
  }
  function damage(id,charged,critical=false) {
    const fraction=Math.max(0,Math.min(1,charged));
    const base=getStats(id).damage * (.2+.8*fraction*fraction);
    return critical ? base*1.5 : base;
  }
  function canCritical(player,charged){
    return charged>=.85 && !player.onGround && !player.inWater &&
      !player.flying && player.vel && player.vel.y < -.1;
  }
  function knockback(id,charged){
    const type=getStats(id).type;
    const factor=type==='sword'?1.05:type==='cutter'?1.12:.85;
    return (.38+.62*Math.max(0,Math.min(1,charged)))*factor;
  }
  function describe(id){
    const s=getStats(id);
    return '공격력 '+s.damage.toFixed(1).replace(/\.0$/,'')+
      ' · 공격 속도 '+s.speed.toFixed(1)+'/초';
  }
  return {getStats,duration,charge,damage,canCritical,knockback,describe};
})();
