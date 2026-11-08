'use strict';

const CONFIG = {
  VERSION: '1.6.0',
  MOB_HEALTH_BARS: false,
  CHUNK: 16,
  HEIGHT: 64,
  SEA: 23,
  RENDER_DIST: 3,
  GRAVITY: 24,
  JUMP: 8.4,
  SPEED: 4.4,
  SPRINT: 7.4,
  FLY: 10,
  REACH: 6,
  DAY_LENGTH: 600,
  AUTOSAVE_SEC: 20,
  SAVE_KEY: 'webcraft_save_v1',
  WORLD_INDEX_KEY: 'webcraft_worlds_v2',
  WORLD_DATA_PREFIX: 'webcraft_world_'
};

const GAME_MODE = Object.freeze({ CREATIVE: 'creative', SURVIVAL: 'survival' });

const BLOCK = Object.freeze({
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7,
  PLANK: 8, GLASS: 9, BRICK: 10, GLOWSTONE: 11, WATER: 12, BEDROCK: 13,
  CRAFTING_TABLE: 14, COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, COPPER_ORE: 18,
  REDSTONE_ORE: 19, LAPIS_ORE: 20, DIAMOND_ORE: 21, EMERALD_ORE: 22, WATER_FLOW: 23, SNOW: 24, FURNACE: 25, TORCH: 26,
  GRAVEL: 27, CLAY: 28, SANDSTONE: 29, STONE_BRICKS: 30, POLISHED_STONE: 31,
  MOSSY_COBBLE: 32, BIRCH_LOG: 33, BIRCH_LEAVES: 34, BIRCH_PLANKS: 35,
  SPRUCE_LOG: 36, SPRUCE_LEAVES: 37, SPRUCE_PLANKS: 38, CACTUS: 39, BOOKSHELF: 40,
  STONE_SLAB: 41, WOOD_STAIRS: 42, WOOD_DOOR: 43, CHEST: 44, WOOD_DOOR_TOP: 45
});

const BLOCKS = [
  null,
  { name: '잔디 블록',  tiles: { top: [0, 0], side: [1, 0], bottom: [2, 0] }, miningTime: .45, tool: 'shovel' },
  { name: '흙',        tiles: { all: [2, 0] }, miningTime: .38, tool: 'shovel' },
  { name: '돌',        tiles: { all: [3, 0] }, miningTime: 1.05, tool: 'pickaxe', minTier: 1 },
  { name: '조약돌',    tiles: { all: [4, 0] }, miningTime: 1.15, tool: 'pickaxe', minTier: 1 },
  { name: '모래',      tiles: { all: [5, 0] }, miningTime: .32, tool: 'shovel' },
  { name: '통나무',    tiles: { top: [7, 0], side: [6, 0], bottom: [7, 0] }, miningTime: .78, tool: 'cutter' },
  { name: '잎',        tiles: { all: [0, 1] }, cutout: true, miningTime: .16, tool: 'hoe' },
  { name: '판자',      tiles: { all: [1, 1] }, miningTime: .62, tool: 'cutter' },
  { name: '유리',      tiles: { all: [2, 1] }, cutout: true, miningTime: .24 },
  { name: '벽돌',      tiles: { all: [3, 1] }, miningTime: .98, tool: 'pickaxe' },
  { name: '발광석',    tiles: { all: [4, 1] }, miningTime: .72, tool: 'pickaxe' },
  { name: '물',        tiles: { all: [5, 1] }, liquid: true, miningTime: .2 },
  { name: '기반암',    tiles: { all: [6, 1] }, unbreakable: true, miningTime: Infinity },
  { name: '제작대',    tiles: { top: [6, 6], side: [7, 6], bottom: [6, 7] }, miningTime: .8, tool: 'cutter' },
  { name: '석탄 광석',  tiles: { all: [0, 3] }, miningTime: 1.25, tool: 'pickaxe', minTier: 1, oreDrop: true },
  { name: '철 광석',    tiles: { all: [1, 3] }, miningTime: 1.65, tool: 'pickaxe', minTier: 2, oreDrop: true },
  { name: '금 광석',    tiles: { all: [2, 3] }, miningTime: 1.9, tool: 'pickaxe', minTier: 3, oreDrop: true },
  { name: '구리 광석',  tiles: { all: [3, 3] }, miningTime: 1.45, tool: 'pickaxe', minTier: 2, oreDrop: true },
  { name: '레드스톤 광석', tiles: { all: [4, 3] }, miningTime: 1.8, tool: 'pickaxe', minTier: 3, oreDrop: true },
  { name: '청금석 광석', tiles: { all: [5, 3] }, miningTime: 1.75, tool: 'pickaxe', minTier: 3, oreDrop: true },
  { name: '다이아몬드 광석', tiles: { all: [6, 3] }, miningTime: 2.4, tool: 'pickaxe', minTier: 3, oreDrop: true },
  { name: '에메랄드 광석', tiles: { all: [7, 3] }, miningTime: 2.2, tool: 'pickaxe', minTier: 3, oreDrop: true },
  { name: '흐르는 물', tiles: { all: [5, 1] }, liquid: true, flow: true, miningTime: .2 },
  { name: '눈', tiles: { all: [7, 1] }, miningTime: .18, tool: 'shovel' },
  { name: '화로', tiles: { top: [8, 1], bottom: [8, 1], side: [9, 0] }, miningTime: 1.6, tool: 'pickaxe', minTier: 1 },
  { name: '횃불', tiles: { top: [8, 2], bottom: [8, 2], side: [9, 1] }, miningTime: .12, nonSolid: true },
  // v1.3.2: append-only block IDs preserve old save files.
  { name: '자갈', tiles: { all: [10,0] }, miningTime: .55, tool: 'shovel', gravity: true, category: '자연' },
  { name: '점토', tiles: { all: [11,0] }, miningTime: .55, tool: 'shovel', category: '자연' },
  { name: '사암', tiles: { top: [10,1], side: [11,1], bottom: [10,1] }, miningTime: .8, tool: 'pickaxe', minTier: 1, category: '석재' },
  { name: '석재 벽돌', tiles: { all: [10,2] }, miningTime: 1.3, tool: 'pickaxe', minTier: 1, category: '석재' },
  { name: '매끄러운 돌', tiles: { all: [11,2] }, miningTime: 1.15, tool: 'pickaxe', minTier: 1, category: '석재' },
  { name: '이끼 낀 조약돌', tiles: { all: [10,3] }, miningTime: 1.15, tool: 'pickaxe', minTier: 1, category: '석재' },
  { name: '자작나무 원목', tiles: { top: [10,4], side: [11,3], bottom: [10,4] }, miningTime: .78, tool: 'cutter', category: '목재' },
  { name: '자작나무 잎', tiles: { all: [11,4] }, cutout: true, miningTime: .16, tool: 'hoe', category: '자연' },
  { name: '자작나무 판자', tiles: { all: [10,5] }, miningTime: .62, tool: 'cutter', category: '목재' },
  { name: '가문비나무 원목', tiles: { top: [10,6], side: [11,5], bottom: [10,6] }, miningTime: .8, tool: 'cutter', category: '목재' },
  { name: '가문비나무 잎', tiles: { all: [11,6] }, cutout: true, miningTime: .16, tool: 'hoe', category: '자연' },
  { name: '가문비나무 판자', tiles: { all: [10,7] }, miningTime: .62, tool: 'cutter', category: '목재' },
  { name: '선인장', tiles: { top: [10,8], bottom: [10,8], side: [11,7] }, miningTime: .38, category: '자연' },
  { name: '책장', tiles: { top: [10,5], bottom: [10,5], side: [11,8] }, miningTime: .7, tool: 'cutter', category: '장식' },
  // Append-only ID policy: slab/stair/door/chest never renumber existing worlds.
  { name: '돌 반 블록', tiles: { all: [0,10] }, miningTime: .68, tool: 'pickaxe', minTier: 1, category: '석재', shape: 'slab' },
  { name: '나무 계단', tiles: { top: [1,1], side: [1,1], bottom: [1,1] }, miningTime: .58, tool: 'cutter', category: '목재', shape: 'stair' },
  { name: '나무 문', tiles: { top: [3,10], side: [2,10], bottom: [3,10] }, miningTime: .55, tool: 'cutter', category: '목재', shape: 'door' },
  { name: '상자', tiles: { top: [5,10], side: [4,10], bottom: [5,10] }, miningTime: .7, tool: 'cutter', category: '장식', shape: 'chest' },
  { name: '나무 문 윗부분', tiles: { top: [3,10], side: [2,10], bottom: [3,10] },
    miningTime: .55, tool: 'cutter', category: '목재', shape: 'doorTop', hidden: true }
];

const ITEM = Object.freeze({
  PORK:100,BEEF:101,CHICKEN:102,MUTTON:103,ROTTEN:104,APPLE:105,LEATHER:115,
  COAL: 106, IRON_INGOT: 107, GOLD_INGOT: 108, COPPER_INGOT: 109,
  REDSTONE: 110, LAPIS: 111, DIAMOND: 112, EMERALD: 113, STICK: 114,
  WOODEN_PICKAXE: 200, STONE_PICKAXE: 201, IRON_PICKAXE: 202, GOLD_PICKAXE: 203, DIAMOND_PICKAXE: 204,
  WOODEN_CUTTER: 205, STONE_CUTTER: 206, IRON_CUTTER: 207, GOLD_CUTTER: 208, DIAMOND_CUTTER: 209,
  WOODEN_SHOVEL: 210, STONE_SHOVEL: 211, IRON_SHOVEL: 212, GOLD_SHOVEL: 213, DIAMOND_SHOVEL: 214,
  WOODEN_HOE:215,STONE_HOE:216,IRON_HOE:217,GOLD_HOE:218,DIAMOND_HOE:219,LEATHER_HELMET:220,LEATHER_CHESTPLATE:221,LEATHER_LEGGINGS:222,LEATHER_BOOTS:223,STONE_HELMET:224,STONE_CHESTPLATE:225,STONE_LEGGINGS:226,STONE_BOOTS:227,IRON_HELMET:228,IRON_CHESTPLATE:229,IRON_LEGGINGS:230,IRON_BOOTS:231,GOLD_HELMET:232,GOLD_CHESTPLATE:233,GOLD_LEGGINGS:234,GOLD_BOOTS:235,DIAMOND_HELMET:236,DIAMOND_CHESTPLATE:237,DIAMOND_LEGGINGS:238,DIAMOND_BOOTS:239,
  WOODEN_SWORD:240, STONE_SWORD:241, IRON_SWORD:242, GOLD_SWORD:243, DIAMOND_SWORD:244
});

const ITEMS = {
  [ITEM.PORK]:     { name: '돼지고기',  food: 6, tiles: { all: [0, 2] } },
  [ITEM.BEEF]:     { name: '소고기',    food: 8, tiles: { all: [1, 2] } },
  [ITEM.CHICKEN]:  { name: '닭고기',    food: 5, tiles: { all: [2, 2] } },
  [ITEM.MUTTON]:   { name: '양고기',    food: 6, tiles: { all: [3, 2] } },
  [ITEM.ROTTEN]:   { name: '썩은 고기', food: 3, tiles: { all: [4, 2] } },
  [ITEM.APPLE]:{name:'사과',food:4,tiles:{all:[5,2]}},[ITEM.LEATHER]:{name:'가죽',tiles:{all:[6,2]}},
  [ITEM.COAL]:     { name: '석탄',      tiles: { all: [0, 4] } },
  [ITEM.IRON_INGOT]: { name: '철 주괴', tiles: { all: [1, 4] } },
  [ITEM.GOLD_INGOT]: { name: '금 주괴', tiles: { all: [2, 4] } },
  [ITEM.COPPER_INGOT]: { name: '구리 주괴', tiles: { all: [3, 4] } },
  [ITEM.REDSTONE]: { name: '레드스톤', tiles: { all: [4, 4] } },
  [ITEM.LAPIS]: { name: '청금석', tiles: { all: [5, 4] } },
  [ITEM.DIAMOND]: { name: '다이아몬드', tiles: { all: [6, 4] } },
  [ITEM.EMERALD]: { name: '에메랄드', tiles: { all: [7, 4] } },
  [ITEM.STICK]: { name: '막대기', tiles: { all: [0, 5] } },
  [ITEM.WOODEN_PICKAXE]: toolItem(ITEM.WOODEN_PICKAXE, '나무 곡괭이', 'pickaxe', 1, 2, 60, [1, 5]),
  [ITEM.STONE_PICKAXE]: toolItem(ITEM.STONE_PICKAXE, '돌 곡괭이', 'pickaxe', 2, 4, 132, [2, 5]),
  [ITEM.IRON_PICKAXE]: toolItem(ITEM.IRON_PICKAXE, '철 곡괭이', 'pickaxe', 3, 6, 250, [3, 5]),
  [ITEM.GOLD_PICKAXE]: toolItem(ITEM.GOLD_PICKAXE, '금 곡괭이', 'pickaxe', 4, 10, 33, [4, 5]),
  [ITEM.DIAMOND_PICKAXE]: toolItem(ITEM.DIAMOND_PICKAXE, '다이아몬드 곡괭이', 'pickaxe', 5, 8, 1562, [5, 5]),
  [ITEM.WOODEN_CUTTER]: toolItem(ITEM.WOODEN_CUTTER, '나무 벌목기', 'cutter', 1, 2, 60, [6, 5]),
  [ITEM.STONE_CUTTER]: toolItem(ITEM.STONE_CUTTER, '돌 벌목기', 'cutter', 2, 4, 132, [7, 5]),
  [ITEM.IRON_CUTTER]: toolItem(ITEM.IRON_CUTTER, '철 벌목기', 'cutter', 3, 6, 250, [0, 6]),
  [ITEM.GOLD_CUTTER]: toolItem(ITEM.GOLD_CUTTER, '금 벌목기', 'cutter', 4, 10, 33, [1, 6]),
  [ITEM.DIAMOND_CUTTER]: toolItem(ITEM.DIAMOND_CUTTER, '다이아몬드 벌목기', 'cutter', 5, 8, 1562, [2, 6]),
  [ITEM.WOODEN_SHOVEL]: toolItem(ITEM.WOODEN_SHOVEL, '나무 삽', 'shovel', 1, 2, 60, [3, 6]),
  [ITEM.STONE_SHOVEL]: toolItem(ITEM.STONE_SHOVEL, '돌 삽', 'shovel', 2, 4, 132, [4, 6]),
  [ITEM.IRON_SHOVEL]: toolItem(ITEM.IRON_SHOVEL, '철 삽', 'shovel', 3, 6, 250, [5, 6]),
  [ITEM.GOLD_SHOVEL]: toolItem(ITEM.GOLD_SHOVEL, '금 삽', 'shovel', 4, 10, 33, [6, 5]),
  [ITEM.DIAMOND_SHOVEL]: toolItem(ITEM.DIAMOND_SHOVEL, '다이아몬드 삽', 'shovel', 5, 8, 1562, [7, 5]),
  [ITEM.WOODEN_HOE]: toolItem(ITEM.WOODEN_HOE, '나무 괭이', 'hoe', 1, 2, 60, [0, 6]),
  [ITEM.STONE_HOE]: toolItem(ITEM.STONE_HOE, '돌 괭이', 'hoe', 2, 4, 132, [1, 6]),
  [ITEM.IRON_HOE]: toolItem(ITEM.IRON_HOE, '철 괭이', 'hoe', 3, 6, 250, [2, 6]),
  [ITEM.GOLD_HOE]: toolItem(ITEM.GOLD_HOE, '금 괭이', 'hoe', 4, 10, 33, [3, 6]),
  [ITEM.DIAMOND_HOE]:toolItem(ITEM.DIAMOND_HOE,'다이아몬드 괭이','hoe',5,8,1562,[4,6]),[ITEM.LEATHER_HELMET]:armorItem(ITEM.LEATHER_HELMET,'가죽 투구','head',1,55,[0,8]),[ITEM.LEATHER_CHESTPLATE]:armorItem(ITEM.LEATHER_CHESTPLATE,'가죽 흉갑','chest',3,80,[1,8]),[ITEM.LEATHER_LEGGINGS]:armorItem(ITEM.LEATHER_LEGGINGS,'가죽 레깅스','legs',2,75,[2,8]),[ITEM.LEATHER_BOOTS]:armorItem(ITEM.LEATHER_BOOTS,'가죽 부츠','feet',1,65,[3,8]),[ITEM.STONE_HELMET]:armorItem(ITEM.STONE_HELMET,'돌 투구','head',1,100,[4,8]),[ITEM.STONE_CHESTPLATE]:armorItem(ITEM.STONE_CHESTPLATE,'돌 흉갑','chest',4,130,[5,8]),[ITEM.STONE_LEGGINGS]:armorItem(ITEM.STONE_LEGGINGS,'돌 레깅스','legs',3,120,[6,8]),[ITEM.STONE_BOOTS]:armorItem(ITEM.STONE_BOOTS,'돌 부츠','feet',1,110,[7,8]),[ITEM.IRON_HELMET]:armorItem(ITEM.IRON_HELMET,'철 투구','head',2,165,[8,8]),[ITEM.IRON_CHESTPLATE]:armorItem(ITEM.IRON_CHESTPLATE,'철 흉갑','chest',6,240,[9,8]),[ITEM.IRON_LEGGINGS]:armorItem(ITEM.IRON_LEGGINGS,'철 레깅스','legs',5,225,[0,9]),[ITEM.IRON_BOOTS]:armorItem(ITEM.IRON_BOOTS,'철 부츠','feet',2,195,[1,9]),[ITEM.GOLD_HELMET]:armorItem(ITEM.GOLD_HELMET,'금 투구','head',2,77,[2,9]),[ITEM.GOLD_CHESTPLATE]:armorItem(ITEM.GOLD_CHESTPLATE,'금 흉갑','chest',5,112,[3,9]),[ITEM.GOLD_LEGGINGS]:armorItem(ITEM.GOLD_LEGGINGS,'금 레깅스','legs',3,105,[4,9]),[ITEM.GOLD_BOOTS]:armorItem(ITEM.GOLD_BOOTS,'금 부츠','feet',1,91,[5,9]),[ITEM.DIAMOND_HELMET]:armorItem(ITEM.DIAMOND_HELMET,'다이아몬드 투구','head',3,363,[6,9]),[ITEM.DIAMOND_CHESTPLATE]:armorItem(ITEM.DIAMOND_CHESTPLATE,'다이아몬드 흉갑','chest',8,528,[7,9]),[ITEM.DIAMOND_LEGGINGS]:armorItem(ITEM.DIAMOND_LEGGINGS,'다이아몬드 레깅스','legs',6,495,[8,9]),[ITEM.DIAMOND_BOOTS]:armorItem(ITEM.DIAMOND_BOOTS,'다이아몬드 부츠','feet',3,429,[9,9])
  , [ITEM.WOODEN_SWORD]: swordItem('나무 검', 5, 60, [0, 7]),
  [ITEM.STONE_SWORD]: swordItem('돌 검', 6, 132, [1, 7]),
  [ITEM.IRON_SWORD]: swordItem('철 검', 7, 250, [2, 7]),
  [ITEM.GOLD_SWORD]: swordItem('금 검', 5, 33, [3, 7]),
  [ITEM.DIAMOND_SWORD]: swordItem('다이아몬드 검', 8, 1562, [4, 7])
};

function swordItem(name, attackDamage, maxDurability, tile) {
  return { name, toolType: 'sword', tier: 1, speed: 1, attackDamage, maxDurability, tiles: { all: tile } };
}

const DEFAULT_HOTBAR = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.LOG,
  BLOCK.PLANK, BLOCK.LEAVES, BLOCK.GLASS, BLOCK.CRAFTING_TABLE
];

const PLACEABLE_IDS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.SAND, BLOCK.LOG,
  BLOCK.LEAVES, BLOCK.PLANK, BLOCK.GLASS, BLOCK.BRICK, BLOCK.GLOWSTONE,
  BLOCK.CRAFTING_TABLE, BLOCK.FURNACE, BLOCK.TORCH, BLOCK.WATER,
  BLOCK.GRAVEL, BLOCK.CLAY, BLOCK.SANDSTONE, BLOCK.STONE_BRICKS, BLOCK.POLISHED_STONE,
  BLOCK.MOSSY_COBBLE, BLOCK.BIRCH_LOG, BLOCK.BIRCH_LEAVES, BLOCK.BIRCH_PLANKS,
  BLOCK.SPRUCE_LOG, BLOCK.SPRUCE_LEAVES, BLOCK.SPRUCE_PLANKS, BLOCK.CACTUS, BLOCK.BOOKSHELF,
  BLOCK.STONE_SLAB, BLOCK.WOOD_STAIRS, BLOCK.WOOD_DOOR, BLOCK.CHEST, BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.GOLD_ORE,
  BLOCK.COPPER_ORE, BLOCK.REDSTONE_ORE, BLOCK.LAPIS_ORE, BLOCK.DIAMOND_ORE, BLOCK.EMERALD_ORE, BLOCK.SNOW
];

const BLOCK_DROPS = {
  [BLOCK.GRASS]: BLOCK.DIRT,
  [BLOCK.STONE]: BLOCK.COBBLE,
  [BLOCK.GLASS]: 0,
  [BLOCK.WOOD_DOOR_TOP]: 0,
  [BLOCK.COAL_ORE]: ITEM.COAL,
  // Metallic ores are smelted in the furnace rather than dropping finished ingots.
  [BLOCK.IRON_ORE]: BLOCK.IRON_ORE,
  [BLOCK.GOLD_ORE]: BLOCK.GOLD_ORE,
  [BLOCK.COPPER_ORE]: BLOCK.COPPER_ORE,
  [BLOCK.REDSTONE_ORE]: ITEM.REDSTONE,
  [BLOCK.LAPIS_ORE]: ITEM.LAPIS,
  [BLOCK.DIAMOND_ORE]: ITEM.DIAMOND,
  [BLOCK.EMERALD_ORE]: ITEM.EMERALD
};

function getBlockDrop(id, rnd, tool) {
  if (id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.WATER_FLOW || id === BLOCK.BEDROCK) return 0;
  const def = BLOCKS[id];
  if (!def) return 0;
  // Hoes let survival players collect leaf blocks for mossy-stone crafting.
  if ([BLOCK.LEAVES,BLOCK.BIRCH_LEAVES,BLOCK.SPRUCE_LEAVES].includes(id) && tool?.toolType==='hoe') return id;
  if (id === BLOCK.LEAVES || id === BLOCK.BIRCH_LEAVES) return rnd && rnd() < 0.04 ? ITEM.APPLE : 0;
  if (id === BLOCK.SPRUCE_LEAVES) return rnd && rnd() < 0.08 ? ITEM.STICK : 0;
  if (id === BLOCK.GLASS) return 0;
  if (def.minTier !== undefined) {
    if (!tool || tool.toolType !== def.tool || tool.tier < def.minTier) return 0;
  }
  return Object.prototype.hasOwnProperty.call(BLOCK_DROPS,id) ? BLOCK_DROPS[id] : id;
}

function isToolId(id){return ((id>=200&&id<220)||(id>=240&&id<=244))&&!!ITEMS[id]&&!!ITEMS[id].toolType;} function isArmorId(id){return id>=220&&id<=239&&!!ITEMS[id]&&!!ITEMS[id].armorType;}
function getToolDef(id){return isToolId(id)?ITEMS[id]:null;} function getArmorDef(id){return isArmorId(id)?ITEMS[id]:null;}
function isFoodId(id) { return id >= 100 && !!ITEMS[id] && typeof ITEMS[id].food === 'number'; }

function armorItem(id,n,t,d,m,tile){return{name:n,armorType:t,defense:d,maxDurability:m,tiles:{all:tile}};}
function toolItem(id, name, type, tier, speed, maxDurability, tile) {
  return { name, toolType: type, tier, speed, maxDurability, tiles: { all: tile } };
}

const SURVIVAL = {
  MAX_HP: 20, MAX_FOOD: 20, MAX_AIR: 10,
  EXHAUST_PER_FOOD: 4, BASE_EXHAUST: 0.09, SPRINT_MULT: 4.5,
  JUMP_COST: 0.25, MINE_COST: 0.06, ATTACK_COST: 0.12, REGEN_COST: 3,
  REGEN_MIN_FOOD: 18, REGEN_SEC: 3, STARVE_SEC: 4, STARVE_MIN_HP: 1,
  FALL_SAFE: 3, FIST_DMG: 1
};

const MOB_CAPS = { hostile: 12, passive: 10 };

const MOB_DEFS = {
  pig:      { name: '돼지',    hostile: false, hp: 10, speed: 1.5, height: .9, width: .82,  drops: [{ id: ITEM.PORK, min: 1, max: 2 }] },
  cow:{name:'소',hostile:false,hp:10,speed:1.4,height:1.28,width:.9,drops:[{id:ITEM.BEEF,min:1,max:3},{id:ITEM.LEATHER,min:0,max:2,chance:.75}]},
  sheep:    { name: '양',      hostile: false, hp: 8, speed: 1.4, height: 1.22, width: .82, drops: [{ id: ITEM.MUTTON, min: 1, max: 2 }] },
  chicken:  { name: '닭',      hostile: false, hp: 4,  speed: 1.3, height: .65, width: .45, drops: [{ id: ITEM.CHICKEN, min: 1, max: 1 }] },
  zombie:   { name: '좀비',    hostile: true,  hp: 20, speed: 2.35, height: 1.9,  width: .62, dmg: 3, aggro: 24, drops: [{ id: ITEM.ROTTEN, min: 1, max: 1, chance: .45 }] },
  skeleton: { name: '스켈레톤', hostile: true, hp: 20, speed: 2.15, height: 1.9, width: .56, dmg: 3, aggro: 26, ranged: true, drops: [] },
  spider:   { name: '거미',    hostile: true,  hp: 16, speed: 3.2, height: .75, width: 1.0,  dmg: 2.5, aggro: 18, drops: [] }
};

// Local voxel AABBs, used consistently by world meshing, player movement and placement.
// Each box is [minX,minY,minZ,maxX,maxY,maxZ] within its owning voxel.
function getBlockBoxes(id, state = null) {
  const s=state||{};
  if(id===BLOCK.STONE_SLAB)
    return [s.half==='top'?[0,.5,0,1,1,1]:[0,0,0,1,.5,1]];
  if(id===BLOCK.WOOD_STAIRS) {
    const base=[0,0,0,1,.5,1];
    const step={
      north:[0,.5,0,1,1,.5],
      south:[0,.5,.5,1,1,1],
      east:[.5,.5,0,1,1,1],
      west:[0,.5,0,.5,1,1]
    };
    return [base,step[s.facing]||step.north];
  }
  if(id===BLOCK.WOOD_DOOR||id===BLOCK.WOOD_DOOR_TOP) {
    if(s.open)return [];
    return (s.facing==='east'||s.facing==='west')
      ? [[.405,0,0,.595,1,1]]
      : [[0,0,.405,1,1,.595]];
  }
  if(id===BLOCK.CHEST)return [[.08,0,.08,.92,.85,.92]];
  return [[0,0,0,1,1,1]];
}

function getBlockVisualBoxes(id,state=null) {
  if((id===BLOCK.WOOD_DOOR||id===BLOCK.WOOD_DOOR_TOP)&&state?.open)
    return (state.facing==='east'||state.facing==='west')
      ? [[0,0,.405,1,1,.595]] : [[.405,0,0,.595,1,1]];
  return getBlockBoxes(id,state);
}

function isSolidBlock(id) {
  return id !== BLOCK.AIR && !!BLOCKS[id] && !BLOCKS[id].liquid && !BLOCKS[id].nonSolid;
}

function isPlaceable(id) {
  return isBlockId(id) && !BLOCKS[id].hidden && id !== BLOCK.BEDROCK && id !== BLOCK.WATER_FLOW;
}

function isFallingBlock(id) { return !!BLOCKS[id]?.gravity || id === BLOCK.SAND; }

function getBlockCategory(id) {
  const group = BLOCKS[id]?.category;
  if (group) return group;
  if ([BLOCK.LOG, BLOCK.PLANK, BLOCK.CRAFTING_TABLE].includes(id)) return '목재';
  if ([BLOCK.STONE, BLOCK.COBBLE, BLOCK.BRICK, BLOCK.FURNACE].includes(id)) return '석재';
  if ([BLOCK.COAL_ORE,BLOCK.IRON_ORE,BLOCK.GOLD_ORE,BLOCK.COPPER_ORE,BLOCK.REDSTONE_ORE,
       BLOCK.LAPIS_ORE,BLOCK.DIAMOND_ORE,BLOCK.EMERALD_ORE].includes(id)) return '광석';
  if ([BLOCK.GLASS,BLOCK.GLOWSTONE,BLOCK.TORCH,BLOCK.CHEST].includes(id)) return '장식';
  return '자연';
}

function isBlockId(id) {
  return id > 0 && id < 100 && !!BLOCKS[id];
}

function getItemDef(id) {
  return id >= 100 ? ITEMS[id] : BLOCKS[id];
}

function getItemName(id) {
  const d = getItemDef(id);
  return d ? d.name : '?';
}
