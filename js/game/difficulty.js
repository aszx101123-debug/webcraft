'use strict';
// Per-world difficulty. Keep these rules independent from the game mode;
// Creative still uses the chosen world difficulty when returning to Survival.
const Difficulty=(()=>{
  const ORDER=Object.freeze(['peaceful','easy','normal','hard']);
  const INFO=Object.freeze({
    peaceful:Object.freeze({name:'평화로움',description:'적대적 몹이 사라집니다. 체력과 배고픔이 천천히 회복됩니다.',mobDamage:0,starveFloor:20}),
    easy:Object.freeze({name:'쉬움',description:'적대적 몹의 공격력이 낮습니다. 굶주려도 체력의 절반은 남습니다.',mobDamage:.5,starveFloor:10}),
    normal:Object.freeze({name:'보통',description:'표준 몹 공격력과 배고픔 규칙을 사용합니다.',mobDamage:1,starveFloor:1}),
    hard:Object.freeze({name:'어려움',description:'적대적 몹의 공격력이 높고 굶주림도 위험합니다.',mobDamage:1.5,starveFloor:0})
  });
  let level='normal';
  const normalize=value=>Object.prototype.hasOwnProperty.call(INFO,value)?value:'normal';
  function set(value){level=normalize(value);return level;}
  function next(){return set(ORDER[(ORDER.indexOf(level)+1)%ORDER.length]);}
  const get=()=>level;
  const info=()=>INFO[level];
  const isPeaceful=()=>level==='peaceful';
  const mobDamage=amount=>isPeaceful()?0:Math.max(1,Math.ceil(Math.max(0,Number(amount)||0)*info().mobDamage));
  const starveFloor=()=>info().starveFloor;
  return {ORDER,INFO,normalize,set,next,get,info,isPeaceful,mobDamage,starveFloor};
})();