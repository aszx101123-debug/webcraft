'use strict';

const CONFIG = {
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
  SAVE_KEY: 'webcraft_save_v1'
};

const GAME_MODE = Object.freeze({ CREATIVE: 'creative', SURVIVAL: 'survival' });

const BLOCK = Object.freeze({
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7,
  PLANK: 8, GLASS: 9, BRICK: 10, GLOWSTONE: 11, WATER: 12, BEDROCK: 13
});

const BLOCKS = [
  null,
  { name: '잔디 블록',  tiles: { top: [0, 0], side: [1, 0], bottom: [2, 0] }, miningTime: .45 },
  { name: '흙',        tiles: { all: [2, 0] }, miningTime: .38 },
  { name: '돌',        tiles: { all: [3, 0] }, miningTime: 1.05 },
  { name: '조약돌',    tiles: { all: [4, 0] }, miningTime: 1.15 },
  { name: '모래',      tiles: { all: [5, 0] }, miningTime: .32 },
  { name: '통나무',    tiles: { top: [7, 0], side: [6, 0], bottom: [7, 0] }, miningTime: .78 },
  { name: '잎',        tiles: { all: [0, 1] }, cutout: true, miningTime: .16 },
  { name: '판자',      tiles: { all: [1, 1] }, miningTime: .62 },
  { name: '유리',      tiles: { all: [2, 1] }, cutout: true, miningTime: .24 },
  { name: '벽돌',      tiles: { all: [3, 1] }, miningTime: .98 },
  { name: '발광석',    tiles: { all: [4, 1] }, miningTime: .72 },
  { name: '물',        tiles: { all: [5, 1] }, liquid: true, miningTime: .2 },
  { name: '기반암',    tiles: { all: [6, 1] }, unbreakable: true, miningTime: Infinity }
];

const ITEM = Object.freeze({ PORK: 100, BEEF: 101, CHICKEN: 102, MUTTON: 103, ROTTEN: 104, APPLE: 105 });

const ITEMS = {
  [ITEM.PORK]:     { name: '돼지고기',  food: 6, tiles: { all: [0, 2] } },
  [ITEM.BEEF]:     { name: '소고기',    food: 8, tiles: { all: [1, 2] } },
  [ITEM.CHICKEN]:  { name: '닭고기',    food: 5, tiles: { all: [2, 2] } },
  [ITEM.MUTTON]:   { name: '양고기',    food: 6, tiles: { all: [3, 2] } },
  [ITEM.ROTTEN]:   { name: '썩은 고기', food: 3, tiles: { all: [4, 2] } },
  [ITEM.APPLE]:    { name: '사과',      food: 4, tiles: { all: [5, 2] } }
};

const DEFAULT_HOTBAR = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.LOG,
  BLOCK.PLANK, BLOCK.LEAVES, BLOCK.GLASS, BLOCK.GLOWSTONE
];

const PLACEABLE_IDS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLE, BLOCK.SAND, BLOCK.LOG,
  BLOCK.LEAVES, BLOCK.PLANK, BLOCK.GLASS, BLOCK.BRICK, BLOCK.GLOWSTONE, BLOCK.WATER
];

const BLOCK_DROPS = {
  [BLOCK.GRASS]: BLOCK.DIRT,
  [BLOCK.STONE]: BLOCK.COBBLE
};

function getBlockDrop(id, rnd) {
  if (id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.BEDROCK) return 0;
  if (id === BLOCK.LEAVES) return rnd && rnd() < 0.04 ? ITEM.APPLE : 0;
  return BLOCK_DROPS[id] || id;
}

const SURVIVAL = {
  MAX_HP: 20, MAX_FOOD: 20, MAX_AIR: 10,
  EXHAUST_PER_FOOD: 4, BASE_EXHAUST: 0.09, SPRINT_MULT: 4.5,
  JUMP_COST: 0.25, MINE_COST: 0.06, ATTACK_COST: 0.12, REGEN_COST: 3,
  REGEN_MIN_FOOD: 18, REGEN_SEC: 3, STARVE_SEC: 4, STARVE_MIN_HP: 1,
  FALL_SAFE: 3, FIST_DMG: 4
};

const MOB_CAPS = { hostile: 12, passive: 10 };

const MOB_DEFS = {
  pig:      { name: '돼지',    hostile: false, hp: 12, speed: 1.5, height: .9, width: .82,  drops: [{ id: ITEM.PORK, min: 1, max: 2 }] },
  cow:      { name: '소',      hostile: false, hp: 12, speed: 1.4, height: 1.28, width: .9, drops: [{ id: ITEM.BEEF, min: 1, max: 3 }] },
  sheep:    { name: '양',      hostile: false, hp: 10, speed: 1.4, height: 1.22, width: .82, drops: [{ id: ITEM.MUTTON, min: 1, max: 2 }] },
  chicken:  { name: '닭',      hostile: false, hp: 4,  speed: 1.3, height: .65, width: .45, drops: [{ id: ITEM.CHICKEN, min: 1, max: 1 }] },
  zombie:   { name: '좀비',    hostile: true,  hp: 16, speed: 2.35, height: 1.9,  width: .62, dmg: 3, aggro: 24, drops: [{ id: ITEM.ROTTEN, min: 1, max: 1, chance: .45 }] },
  skeleton: { name: '스켈레톤', hostile: true, hp: 14, speed: 2.15, height: 1.9, width: .56, dmg: 3, aggro: 26, ranged: true, drops: [] },
  spider:   { name: '거미',    hostile: true,  hp: 12, speed: 3.2, height: .75, width: 1.0,  dmg: 2.5, aggro: 18, drops: [] }
};

function isSolidBlock(id) {
  return id !== BLOCK.AIR && !BLOCKS[id].liquid;
}

function isPlaceable(id) {
  return id !== BLOCK.AIR && id !== BLOCK.BEDROCK;
}

function isBlockId(id) {
  return id > 0 && id < 100 && !!BLOCKS[id];
}

function isFoodId(id) {
  return id >= 100 && !!ITEMS[id];
}

function getItemDef(id) {
  return id >= 100 ? ITEMS[id] : BLOCKS[id];
}

function getItemName(id) {
  const d = getItemDef(id);
  return d ? d.name : '?';
}
