'use strict';
const Inventory=(()=>{
const HOTBAR_SIZE=9,SIZE=36,MAX_STACK=64;
let slots=new Array(SIZE).fill(null),sel=0,mode=GAME_MODE.CREATIVE;
function normalize(s){if(!s||!s.id||!getItemDef(s.id))return null;const td=getToolDef(s.id);let count=s.count;if(td)count=1;else if(count===-1||count===Infinity)count=Infinity;else count=Math.max(1,Math.floor(Number(count)||1));let durability=td?Math.max(0,Math.min(td.durability,Number(s.durability??td.durability))):null;return{id:s.id,count,durability};}
function init(m,saved){mode=m;sel=0;slots=new Array(SIZE).fill(null);if(Array.isArray(saved)&&saved.length)saved.slice(0,SIZE).forEach((s,i)=>slots[i]=normalize(s));else if(mode===GAME_MODE.CREATIVE)DEFAULT_HOTBAR.forEach((id,i)=>slots[i]={id,count:Infinity});}
function setMode(m){mode=m;slots=slots.map(s=>{if(!s)return null;const td=getToolDef(s.id);return{id:s.id,count:m===GAME_MODE.CREATIVE?Infinity:(td?1:(s.count===Infinity?MAX_STACK:s.count)),durability:td?(s.durability??td.durability):null};});}
function getSlots(){return slots;}function getSlot(i){return slots[i]||null;}function getSelected(){return sel;}
function setSelected(i){sel=((i%HOTBAR_SIZE)+HOTBAR_SIZE)%HOTBAR_SIZE;}function selectedSlot(){return slots[sel];}function selectedId(){const s=slots[sel];return s?s.id:0;}function isCreative(){return mode===GAME_MODE.CREATIVE;}
function takeFromSlot(i,count=1){if(i<0||i>=SIZE||!slots[i]||count<=0)return null;const s=slots[i];if(s.count===Infinity)return{id:s.id,count,durability:s.durability};const n=Math.min(count,s.count);const out={id:s.id,count:n,durability:s.durability};s.count-=n;if(s.count<=0)slots[i]=null;return out;}
function addToSlot(i,id,count=1,durability=null){if(i<0||i>=SIZE||!id||count<=0)return 0;const td=getToolDef(id);const s=slots[i];if(s&&s.id!==id)return 0;if(td){if(s)return 0;slots[i]={id,count:1,durability:durability??td.durability};return 1;}if(s&&s.count!==Infinity){const n=Math.min(MAX_STACK-s.count,count);s.count+=n;return n;}if(!s){slots[i]={id,count:Math.min(MAX_STACK,count),durability:null};return slots[i].count;}return count;}
function setSlot(i,id,count,durability){if(i<0||i>=SIZE)return false;if(!id){slots[i]=null;return true;}const td=getToolDef(id);slots[i]={id,count:count===Infinity?Infinity:Math.max(1,Math.min(MAX_STACK,count||MAX_STACK)),durability:td?Math.max(0,Math.min(td.durability,Number(durability??td.durability))):null};return true;}
function swapSlots(a,b){if(a<0||b<0||a>=SIZE||b>=SIZE||a===b)return false;const t=slots[a];slots[a]=slots[b];slots[b]=t;return true;}
function countItem(id){return slots.reduce((n,s)=>n+(s&&s.id===id?(s.count===Infinity?999999:s.count):0),0);}
function capacityFor(id){if(!id||!getItemDef(id))return 0;if(getToolDef(id))return slots.reduce((n,s)=>n+(!s?1:0),0);return slots.reduce((n,s)=>n+(!s?MAX_STACK:(s.id===id&&s.count!==Infinity?MAX_STACK-s.count:0)),0);}
function canAdd(id,count){return !!id&&count>0&&(mode===GAME_MODE.CREATIVE||capacityFor(id)>=count);}
function add(id,count){
if(!id||!count||count<=0)return 0;
const td=getToolDef(id);
if(td){
  let added=0;
  for(let n=0;n<count;n++){
    const i=slots.findIndex(s=>!s);
    if(i<0)break;
    slots[i]={id,count:1,durability:td.durability};
    added++;
  }
  return added;
}
if(mode===GAME_MODE.CREATIVE){if(slots.some(s=>s&&s.id===id&&s.count===Infinity))return count;const i=slots.findIndex(s=>!s);if(i>=0){slots[i]={id,count:Infinity,durability:null};return count;}return 0;}
let left=count;
for(let i=0;i<SIZE&&left>0;i++){const s=slots[i];if(s&&s.id===id&&s.count<MAX_STACK){const t=Math.min(MAX_STACK-s.count,left);s.count+=t;left-=t;}}
for(let i=0;i<SIZE&&left>0;i++){if(!slots[i]){const t=Math.min(MAX_STACK,left);slots[i]={id,count:t,durability:null};left-=t;}}
return count-left;}
function remove(id,count){if(mode===GAME_MODE.CREATIVE)return true;let left=count;for(let i=0;i<SIZE&&left>0;i++){const s=slots[i];if(!s||s.id!==id)continue;const t=Math.min(s.count,left);s.count-=t;left-=t;if(s.count<=0)slots[i]=null;}return left<=0;}
function removeIngredients(need){if(mode===GAME_MODE.CREATIVE)return true;for(const[id,n]of Object.entries(need))if(countItem(+id)<n)return false;for(const[id,n]of Object.entries(need))remove(+id,n);return true;}
function consumeSelected(){if(mode===GAME_MODE.CREATIVE)return true;const s=slots[sel];if(!s)return false;if(--s.count<=0)slots[sel]=null;return true;}
function damageSelectedTool(amount=1){if(mode===GAME_MODE.CREATIVE)return {broken:false,durability:Infinity};const s=slots[sel],td=s&&getToolDef(s.id);if(!s||!td)return {broken:false,durability:null};s.durability=Math.max(0,(s.durability??td.durability)-amount);const broken=s.durability<=0;if(broken)slots[sel]=null;return {broken,durability:broken?0:s.durability};}
function serialize(){return slots.map(s=>s?{id:s.id,count:s.count===Infinity?-1:s.count,durability:s.durability}:null);}
return{HOTBAR_SIZE,SIZE,MAX_STACK,init,setMode,getSlots,takeFromSlot,addToSlot,getSlot,getSelected,setSelected,selectedSlot,selectedId,isCreative,setSlot,swapSlots,countItem,capacityFor,canAdd,add,remove,removeIngredients,consumeSelected,damageSelectedTool,serialize};})();