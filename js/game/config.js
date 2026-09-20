'use strict';

const CONFIG={CHUNK:16,HEIGHT:64,SEA:23,RENDER_DIST:3,GRAVITY:24,JUMP:8.4,SPEED:4.4,SPRINT:7.4,FLY:10,REACH:6,DAY_LENGTH:600,AUTOSAVE_SEC:20,SAVE_KEY:'webcraft_save_v1'};
const GAME_MODE=Object.freeze({CREATIVE:'creative',SURVIVAL:'survival'});
const BLOCK=Object.freeze({AIR:0,GRASS:1,DIRT:2,STONE:3,COBBLE:4,SAND:5,LOG:6,LEAVES:7,PLANK:8,GLASS:9,BRICK:10,GLOWSTONE:11,WATER:12,BEDROCK:13,CRAFTING_TABLE:14,FURNACE:15,TORCH:16,COAL_ORE:17,IRON_ORE:18,GOLD_ORE:19,DIAMOND_ORE:20,BED:21});
const BLOCKS=[null,
{name:'잔디 블록',tiles:{top:[0,0],side:[1,0],bottom:[2,0]}},
{name:'흙',tiles:{all:[2,0]}},{name:'돌',tiles:{all:[3,0]}},{name:'조약돌',tiles:{all:[4,0]}},{name:'모래',tiles:{all:[5,0]}},
{name:'통나무',tiles:{top:[7,0],side:[6,0],bottom:[7,0]}},{name:'잎',tiles:{all:[0,1]},cutout:true},{name:'판자',tiles:{all:[1,1]}},
{name:'유리',tiles:{all:[2,1]},cutout:true},{name:'벽돌',tiles:{all:[3,1]}},{name:'발광석',tiles:{all:[4,1]}},{name:'물',tiles:{all:[5,1]},liquid:true},
{name:'기반암',tiles:{all:[6,1]},unbreakable:true},{name:'제작대',tiles:{top:[1,1],side:[1,0],bottom:[2,0]}},{name:'화로',tiles:{top:[3,0],side:[4,0],bottom:[3,0]}},
{name:'횃불',tiles:{all:[4,3]},special:'torch'},
{name:'석탄 광석',tiles:{all:[0,3]}},
{name:'철 광석',tiles:{all:[1,3]}},
{name:'금 광석',tiles:{all:[2,3]}},
{name:'다이아몬드 광석',tiles:{all:[3,3]}},
{name:'침대',tiles:{all:[5,3]},special:'bed'}];
const ITEM=Object.freeze({PORK:100,BEEF:101,CHICKEN:102,MUTTON:103,ROTTEN:104,APPLE:105,STICK:106,WOOD_PICKAXE:107,STONE_PICKAXE:108,WOOD_AXE:109,STONE_AXE:110,WOOD_SHOVEL:111,STONE_SHOVEL:112,COAL:113,RAW_IRON:114,RAW_GOLD:115,DIAMOND:116,IRON_PICKAXE:117,DIAMOND_PICKAXE:118,DIAMOND_AXE:119,DIAMOND_SHOVEL:120,DIAMOND_SWORD:121,WOOL:122});
const ITEMS={
[ITEM.PORK]:{name:'돼지고기',food:6,tiles:{all:[0,2]}},[ITEM.BEEF]:{name:'소고기',food:8,tiles:{all:[1,2]}},[ITEM.CHICKEN]:{name:'닭고기',food:5,tiles:{all:[2,2]}},
[ITEM.MUTTON]:{name:'양고기',food:6,tiles:{all:[3,2]}},[ITEM.ROTTEN]:{name:'썩은 고기',food:3,tiles:{all:[4,2]}},[ITEM.APPLE]:{name:'사과',food:4,tiles:{all:[5,2]}},
[ITEM.STICK]:{name:'막대기',tiles:{all:[6,2]}},
[ITEM.WOOD_PICKAXE]:{name:'나무 곡괭이',tool:'pickaxe',tier:1},
[ITEM.STONE_PICKAXE]:{name:'돌 곡괭이',tool:'pickaxe',tier:2},
[ITEM.WOOD_AXE]:{name:'나무 도끼',tool:'axe',tier:1},
[ITEM.STONE_AXE]:{name:'돌 도끼',tool:'axe',tier:2},
[ITEM.WOOD_SHOVEL]:{name:'나무 삽',tool:'shovel',tier:1},
[ITEM.STONE_SHOVEL]:{name:'돌 삽',tool:'shovel',tier:2},
[ITEM.IRON_PICKAXE]:{name:'철 곡괭이',tool:'pickaxe',tier:3},
[ITEM.DIAMOND_PICKAXE]:{name:'다이아몬드 곡괭이',tool:'pickaxe',tier:4},
[ITEM.DIAMOND_AXE]:{name:'다이아몬드 도끼',tool:'axe',tier:4},
[ITEM.DIAMOND_SHOVEL]:{name:'다이아몬드 삽',tool:'shovel',tier:4},
[ITEM.DIAMOND_SWORD]:{name:'다이아몬드 검',tool:'sword',tier:4,damage:9},
[ITEM.COAL]:{name:'석탄',tiles:{all:[0,3]}},
[ITEM.RAW_IRON]:{name:'철 원석',tiles:{all:[1,3]}},
[ITEM.RAW_GOLD]:{name:'금 원석',tiles:{all:[2,3]}},
[ITEM.DIAMOND]:{name:'다이아몬드',tiles:{all:[3,3]}},
[ITEM.WOOL]:{name:'양털',tiles:{all:[5,3]}}};
const DEFAULT_HOTBAR=[BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.COBBLE,BLOCK.LOG,BLOCK.PLANK,BLOCK.LEAVES,BLOCK.GLASS,BLOCK.GLOWSTONE];
const TOOL_DEFS={
[ITEM.WOOD_PICKAXE]:{type:'pickaxe',tier:1,durability:60,speed:2.0},
[ITEM.STONE_PICKAXE]:{type:'pickaxe',tier:2,durability:132,speed:3.6},
[ITEM.WOOD_AXE]:{type:'axe',tier:1,durability:60,speed:2.6},
[ITEM.STONE_AXE]:{type:'axe',tier:2,durability:132,speed:4.2},
[ITEM.WOOD_SHOVEL]:{type:'shovel',tier:1,durability:60,speed:2.6},
[ITEM.STONE_SHOVEL]:{type:'shovel',tier:2,durability:132,speed:4.2},
[ITEM.IRON_PICKAXE]:{type:'pickaxe',tier:3,durability:250,speed:6.0},
[ITEM.DIAMOND_PICKAXE]:{type:'pickaxe',tier:4,durability:1561,speed:8.5},
[ITEM.DIAMOND_AXE]:{type:'axe',tier:4,durability:1561,speed:7.0},
[ITEM.DIAMOND_SHOVEL]:{type:'shovel',tier:4,durability:1561,speed:7.0},
[ITEM.DIAMOND_SWORD]:{type:'sword',tier:4,durability:1561,speed:1,damage:9}
};
const BLOCK_HARDNESS={
[BLOCK.GRASS]:.6,[BLOCK.DIRT]:.6,[BLOCK.STONE]:1.5,[BLOCK.COBBLE]:2,[BLOCK.SAND]:.5,
[BLOCK.LOG]:1.2,[BLOCK.LEAVES]:.2,[BLOCK.PLANK]:1,[BLOCK.GLASS]:.35,[BLOCK.BRICK]:1.8,
[BLOCK.TORCH]:.15,[BLOCK.COAL_ORE]:1.8,[BLOCK.IRON_ORE]:2.2,[BLOCK.GOLD_ORE]:2.2,[BLOCK.DIAMOND_ORE]:3.0,[BLOCK.BED]:.25,
[BLOCK.GLOWSTONE]:.9,[BLOCK.WATER]:.2,[BLOCK.CRAFTING_TABLE]:1.8,[BLOCK.FURNACE]:2.2,[BLOCK.BEDROCK]:Infinity
};
function getToolDef(id){return TOOL_DEFS[id]||null;}
function getWeaponDamage(id){
  const t=getToolDef(id);
  return t&&t.type==='sword' ? (t.damage||SURVIVAL.FIST_DMG) : SURVIVAL.FIST_DMG;
}
function getRequiredMiningTier(blockId){
  if(blockId===BLOCK.DIAMOND_ORE||blockId===BLOCK.GOLD_ORE)return 3;
  if(blockId===BLOCK.IRON_ORE)return 2;
  if(blockId===BLOCK.COAL_ORE)return 1;
  return 0;
}
function getBlockHardness(id){return BLOCK_HARDNESS[id]??1;}
function getMiningToolMultiplier(blockId,toolId){
  const requiredTier=getRequiredMiningTier(blockId);
  const t=getToolDef(toolId);
  if(!t)return {speed:1,valid:false,requiredTier};
  const pickaxeBlocks=[BLOCK.STONE,BLOCK.COBBLE,BLOCK.BRICK,BLOCK.FURNACE,BLOCK.GLOWSTONE,BLOCK.GLASS,BLOCK.COAL_ORE,BLOCK.IRON_ORE,BLOCK.GOLD_ORE,BLOCK.DIAMOND_ORE];
  const preferred=t.type==='pickaxe'
    ? pickaxeBlocks.includes(blockId)
    : t.type==='axe'
      ? [BLOCK.LOG,BLOCK.PLANK].includes(blockId)
      : [BLOCK.GRASS,BLOCK.DIRT,BLOCK.SAND].includes(blockId);
  const miningToolType = t.type !== 'sword';
  const valid=miningToolType&&preferred&&t.tier>=requiredTier;
  return {speed:valid?t.speed:Math.max(1,t.speed*.28),valid,requiredTier};
}
const PLACEABLE_IDS=[BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.COBBLE,BLOCK.SAND,BLOCK.LOG,BLOCK.LEAVES,BLOCK.PLANK,BLOCK.GLASS,BLOCK.BRICK,BLOCK.GLOWSTONE,BLOCK.WATER,BLOCK.CRAFTING_TABLE,BLOCK.FURNACE,BLOCK.TORCH,BLOCK.BED,BLOCK.COAL_ORE,BLOCK.IRON_ORE,BLOCK.GOLD_ORE,BLOCK.DIAMOND_ORE];
const BLOCK_DROPS={
[BLOCK.GRASS]:BLOCK.DIRT,[BLOCK.STONE]:BLOCK.COBBLE,
[BLOCK.COAL_ORE]:ITEM.COAL,[BLOCK.IRON_ORE]:ITEM.RAW_IRON,[BLOCK.GOLD_ORE]:ITEM.RAW_GOLD,[BLOCK.DIAMOND_ORE]:ITEM.DIAMOND,
[BLOCK.TORCH]:BLOCK.TORCH,[BLOCK.BED]:BLOCK.BED
};
function getBlockDrop(id,rnd){if(id===BLOCK.AIR||id===BLOCK.WATER||id===BLOCK.BEDROCK)return 0;if(id===BLOCK.LEAVES)return rnd&&rnd()<.04?ITEM.APPLE:0;return BLOCK_DROPS[id]||id;}
const SURVIVAL={MAX_HP:20,MAX_FOOD:20,MAX_AIR:10,EXHAUST_PER_FOOD:4,BASE_EXHAUST:.09,SPRINT_MULT:4.5,JUMP_COST:.25,MINE_COST:.06,ATTACK_COST:.12,REGEN_COST:3,REGEN_MIN_FOOD:18,REGEN_SEC:3,STARVE_SEC:4,STARVE_MIN_HP:1,FALL_SAFE:3,FIST_DMG:4};
const MOB_CAPS={hostile:12,passive:10};
const MOB_DEFS={
pig:{name:'돼지',hostile:false,hp:10,speed:1.5,height:.85,width:.8,drops:[{id:ITEM.PORK,min:1,max:2}]},
cow:{name:'소',hostile:false,hp:10,speed:1.4,height:1.25,width:.85,drops:[{id:ITEM.BEEF,min:1,max:3}]},
sheep:{name:'양',hostile:false,hp:8,speed:1.4,height:1.2,width:.8,drops:[{id:ITEM.MUTTON,min:1,max:2},{id:ITEM.WOOL,min:1,max:2}]},
chicken:{name:'닭',hostile:false,hp:4,speed:1.3,height:.65,width:.45,drops:[{id:ITEM.CHICKEN,min:1,max:1}]},
zombie:{name:'좀비',hostile:true,hp:12,speed:2.3,height:1.9,width:.6,dmg:3,aggro:24,drops:[{id:ITEM.ROTTEN,min:1,max:1,chance:.45}]},
skeleton:{name:'스켈레톤',hostile:true,hp:12,speed:2.1,height:1.9,width:.55,dmg:3,aggro:26,ranged:true,drops:[]},
spider:{name:'거미',hostile:true,hp:10,speed:3.2,height:.75,width:1,dmg:2,aggro:18,drops:[]},
creeper:{name:'크리퍼',hostile:true,hp:14,speed:2.6,height:1.8,width:.58,dmg:6,aggro:22,drops:[]}};
function isSolidBlock(id){return id!==BLOCK.AIR&&id!==BLOCK.TORCH&&!BLOCKS[id].liquid;}
function isTargetableBlock(id){return id!==BLOCK.AIR&&id!==BLOCK.WATER&&!!BLOCKS[id];}
function isPlaceable(id){return id!==BLOCK.AIR&&id!==BLOCK.BEDROCK;}
function isBlockId(id){return id>0&&id<100&&!!BLOCKS[id];}
function isFoodId(id){return id>=100&&!!ITEMS[id]&&!!ITEMS[id].food;}
function getItemDef(id){return id>=100?ITEMS[id]:BLOCKS[id];}
function getItemName(id){const d=getItemDef(id);return d?d.name:'?';}
const LEVEL_XP_BASE=25;
function xpForLevel(level){return LEVEL_XP_BASE + Math.max(0,level-1)*10;}

