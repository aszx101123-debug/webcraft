'use strict';

// WebCraft virtual combat attributes: Java-style timing, with separate mining speeds.
// Each array follows the in-game tool tier order: wood, stone, iron, gold, diamond.
const Combat = (() => {
  const tierValue = {
    sword:   {damage:[4,5,6,4,7], speed:[1.6,1.6,1.6,1.6,1.6]},
    cutter:  {damage:[7,9,9,7,9], speed:[.8,.8,.9,1,1]},
    pickaxe: {damage:[2,3,4,2,5], speed:[1.2,1.2,1.2,1.2,1.2]},
    shovel:  {damage:[2.5,3.5,4.5,2.5,5.5], speed:[1,1,1,1,1]},
    hoe:     {damage:[1,1,1,1,1], speed:[1,2,3,3,4]}
  };
  const bareHand = Object.freeze({damage:1,speed:4,kind:'hand',name:'맨손'});
  function statsFor(id) {
    const item=getToolDef(id);
    if(!item || !tierValue[item.toolType])return bareHand;
    const t=Math.min(4,Math.max(0,(item.tier||1)-1));
    const info=tierValue[item.toolType];
    return {damage:info.damage[t],speed:info.speed[t],
      kind:item.toolType,name:item.name};
  }
  function rechargeDuration(id) {
    return 1000/statsFor(id).speed;
  }
  function charge(id, elapsedMilliseconds) {
    if(!Number.isFinite(elapsedMilliseconds))return 1;
    return Math.max(0,Math.min(1,Math.max(0,elapsedMilliseconds)/rechargeDuration(id)));
  }
  function damage(id, chargeValue,critical=false) {
    const full=statsFor(id).damage;
    const f=Math.max(0,Math.min(1,chargeValue));
    const scaled=full*(.2+.8*f*f);
    return Math.max(.2,critical?scaled*1.5:scaled);
  }
  function canCritical(player,chargeValue) {
    return chargeValue>=.9 &&
      !player.onGround && !player.inWater && !player.flying &&
      !!player.vel && player.vel.y<-.12;
  }
  function knockback(id,chargeValue,critical=false) {
    const stat=statsFor(id);
    const base=stat.kind==='cutter'?.93:stat.kind==='sword'?1.15:.82;
    return base*(.32+.68*Math.min(1,chargeValue))*(critical?1.14:1);
  }
  function tooltip(id) {
    const s=statsFor(id);
    if(s.kind==='hand')return '기본 공격력 1 · 공격 속도 4.0회/초';
    return '공격력 '+s.damage+' · 공격 속도 '+s.speed.toFixed(1)+'회/초';
  }
  return {statsFor,rechargeDuration,charge,damage,canCritical,knockback,tooltip};
})();
