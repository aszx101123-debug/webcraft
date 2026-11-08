'use strict';

const CONFIG = {
  VERSION: '1.8.0',
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
  STONE_SLAB: 41, WOOD_STAIRS: 42, WOOD_DOOR: 43, CHEST: 44, WOOD_DOOR_TOP: 45,
  FARMLAND:46, WHEAT_CROP:47, CARROT_CROP:48, POTATO_CROP:49,
  WOOL_WHITE:50, WOOL_ORANGE:51, WOOL_MAGENTA:52, WOOL_LIGHT_BLUE:53,
  WOOL_YELLOW:54, WOOL_LIME:55, WOOL_PINK:56, WOOL_GRAY:57,
  WOOL_LIGHT_GRAY:58, WOOL_CYAN:59, WOOL_PURPLE:60, WOOL_BLUE:61,
  WOOL_BROWN:62, WOOL_GREEN:63, WOOL_RED:64, WOOL_BLACK:65,
  COAL_BLOCK:66, IRON_BLOCK:67, GOLD_BLOCK:68, COPPER_BLOCK:69,
  DIAMOND_BLOCK:70, EMERALD_BLOCK:71, REDSTONE_BLOCK:72, LAPIS_BLOCK:73,
  LANTERN:74,
  PLAINS_RESOURCE:75, FOREST_RESOURCE:76, JUNGLE_RESOURCE:77, SWAMP_RESOURCE:78, TAIGA_RESOURCE:79, SNOWY_RESOURCE:80, DESERT_RESOURCE:81, HIGHLAND_RESOURCE:82, SAVANNA_RESOURCE:83, BADLANDS_RESOURCE:84, CHERRY_RESOURCE:85, BAMBOO_RESOURCE:86, MUSHROOM_RESOURCE:87, VOLCANIC_RESOURCE:88, GLACIER_RESOURCE:89, CRYSTAL_RESOURCE:90,
  RED_SAND:91, TERRACOTTA:92, MYCELIUM:93, BASALT:94, ICE:95, CHERRY_LEAVES:96, BAMBOO:97, CRYSTAL_BLOCK:98
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
  WOODEN_SWORD:240, STONE_SWORD:241, IRON_SWORD:242, GOLD_SWORD:243, DIAMOND_SWORD:244,
  WHEAT_SEEDS:300,WHEAT:301,CARROT:302,POTATO:303,BAKED_POTATO:304,BREAD:305,
  COOKED_PORK:306,COOKED_BEEF:307,COOKED_CHICKEN:308,COOKED_MUTTON:309,
  RAW_FISH:310,COOKED_FISH:311,COCOA:312,COOKIE:313,BONE:314,BONE_MEAL:315,
  STRING:316,FEATHER:317,FLINT:318,PAPER:319,BOOK:320,IRON_NUGGET:321,
  GOLD_NUGGET:322,CHARCOAL:323,POPPY:324,DAISY:325,BUCKET:326,WATER_BUCKET:327,
  MILK_BUCKET:328,BOW:329,ARROW:330,SHEARS:331,COMPASS:332,CLOCK:333,
  FISHING_ROD:334,SHIELD:335,GOLDEN_APPLE:336,
  DYE_WHITE:400,DYE_ORANGE:401,DYE_MAGENTA:402,DYE_LIGHT_BLUE:403,
  DYE_YELLOW:404,DYE_LIME:405,DYE_PINK:406,DYE_GRAY:407,
  DYE_LIGHT_GRAY:408,DYE_CYAN:409,DYE_PURPLE:410,DYE_BLUE:411,
  DYE_BROWN:412,DYE_GREEN:413,DYE_RED:414,DYE_BLACK:415,
  PRAIRIE_FIBER:500,WILDFLOWER_SEED:501,WIND_FEATHER:502,
  OAK_TWIG:503,FOREST_BERRY:504,LIVING_SAP:505,
  JUNGLE_VINE:506,CACAO_FRUIT:507,JUNGLE_AMBER:508,
  SWAMP_MOSS:509,BOG_MUSHROOM:510,ANCIENT_CLAY_BEAD:511,
  PINE_NEEDLE:512,SPRUCE_TWIG:513,RESIN_AMBER:514,
  SNOW_CRYSTAL:515,FROST_WOOD:516,FROST_HEART:517,
  SANDSTONE_CHIP:518,CACTUS_FRUIT:519,SUNSTONE:520,
  GRANITE_CHIP:521,MOUNTAIN_IRON:522,ECHO_CRYSTAL:523,
  ACACIA_TWIG:524,DRY_GRASS_SEED:525,AMBER_FANG:526,
  RED_CLAY:527,BADLANDS_COPPER:528,WASTELAND_FOSSIL:529,
  CHERRY_TWIG:530,CHERRY_PETAL:531,SPRING_ESSENCE:532,
  BAMBOO_STALK:533,BAMBOO_SHOOT:534,JADE_SHARD:535,
  MUSHROOM_STEM:536,GLOW_SPORE:537,MYCELIUM_CORE:538,
  BASALT_CHIP:539,OBSIDIAN_SHARD:540,MAGMA_CORE:541,
  GLACIER_SHARD:542,BLUE_ICE:543,AURORA_CRYSTAL:544,
  CRYSTAL_SHARD:545,AMETHYST:546,RESONANT_CORE:547
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

// New content uses append-only IDs so existing worlds keep their items and blocks.
const WOOL_TYPES = [
  ['WHITE','흰색',0xe8e8e3],['ORANGE','주황색',0xe58524],['MAGENTA','자홍색',0xb64cbb],
  ['LIGHT_BLUE','하늘색',0x65aaca],['YELLOW','노란색',0xe5c638],['LIME','연두색',0x77b532],
  ['PINK','분홍색',0xd67b94],['GRAY','회색',0x42464c],['LIGHT_GRAY','연회색',0x9c9d94],
  ['CYAN','청록색',0x208b93],['PURPLE','보라색',0x7939a9],['BLUE','파란색',0x343b9e],
  ['BROWN','갈색',0x72503a],['GREEN','초록색',0x536a24],['RED','빨간색',0xa62f2b],['BLACK','검은색',0x202126]
].map(([key,name,color],i)=>({key,name,color,block:BLOCK['WOOL_'+key],dye:ITEM['DYE_'+key],tile:[i,12]}));
const STORAGE_TYPES = [
  ['coal','석탄',ITEM.COAL,BLOCK.COAL_BLOCK,0x333337,1],
  ['iron','철',ITEM.IRON_INGOT,BLOCK.IRON_BLOCK,0xcbd1d3,2],
  ['gold','금',ITEM.GOLD_INGOT,BLOCK.GOLD_BLOCK,0xeac64b,3],
  ['copper','구리',ITEM.COPPER_INGOT,BLOCK.COPPER_BLOCK,0xb9754a,2],
  ['diamond','다이아몬드',ITEM.DIAMOND,BLOCK.DIAMOND_BLOCK,0x58cdd4,3],
  ['emerald','에메랄드',ITEM.EMERALD,BLOCK.EMERALD_BLOCK,0x3ab46a,3],
  ['redstone','레드스톤',ITEM.REDSTONE,BLOCK.REDSTONE_BLOCK,0xa82b26,2],
  ['lapis','청금석',ITEM.LAPIS,BLOCK.LAPIS_BLOCK,0x3155a2,2]
].map(([key,name,item,block,color,tier],i)=>({key,name,item,block,color,tier,tile:[12+i%4,Math.floor(i/4)]}));
const CROP_TYPES = {
  [BLOCK.WHEAT_CROP]:{key:'wheat',name:'밀',seed:ITEM.WHEAT_SEEDS,produce:ITEM.WHEAT,seconds:180,tiles:[12,3]},
  [BLOCK.CARROT_CROP]:{key:'carrot',name:'당근',seed:ITEM.CARROT,produce:ITEM.CARROT,seconds:150,tiles:[12,4]},
  [BLOCK.POTATO_CROP]:{key:'potato',name:'감자',seed:ITEM.POTATO,produce:ITEM.POTATO,seconds:160,tiles:[12,5]}
};
BLOCKS.push({name:'경작지',tiles:{top:[12,2],side:[13,2],bottom:[2,0]},shape:'farmland',hidden:true,miningTime:.4,tool:'shovel'});
for(const crop of Object.values(CROP_TYPES))BLOCKS.push({name:crop.name+' 작물',tiles:{all:crop.tiles},crop:true,nonSolid:true,cutout:true,hidden:true,miningTime:.05});
for(const wool of WOOL_TYPES)BLOCKS.push({name:wool.name+' 양털',color:wool.color,tiles:{all:wool.tile},miningTime:.6,tool:'shears',category:'장식'});
for(const material of STORAGE_TYPES)BLOCKS.push({name:material.name+' 블록',color:material.color,tiles:{all:material.tile},miningTime:1.8,tool:'pickaxe',minTier:material.tier,category:'광석'});
BLOCKS.push({name:'랜턴',tiles:{top:[12,6],bottom:[12,6],side:[13,6]},shape:'lantern',emission:15,miningTime:.45,tool:'pickaxe',category:'장식'});

const newItem = (id,name,category,extra={}) => {
  const n=id-300, tile=n<20?[12+n%4,7+Math.floor(n/4)]:[(n-20)%16,13+Math.floor((n-20)/16)];
  ITEMS[id]={name,category,tiles:{all:tile},...extra};
};
newItem(ITEM.WHEAT_SEEDS,'밀 씨앗','농사',{plant:BLOCK.WHEAT_CROP,useHint:'경작지에 우클릭하여 심기'});
newItem(ITEM.WHEAT,'밀','농사',{useHint:'빵과 쿠키의 제작 재료'});
newItem(ITEM.CARROT,'당근','농사',{plant:BLOCK.CARROT_CROP,food:3,useHint:'경작지에 심거나 우클릭하여 먹기'});
newItem(ITEM.POTATO,'감자','농사',{plant:BLOCK.POTATO_CROP,food:1,useHint:'경작지에 심거나 화로에 굽기'});
for(const [id,name,food] of [
  [ITEM.BAKED_POTATO,'구운 감자',5],[ITEM.BREAD,'빵',5],[ITEM.COOKED_PORK,'구운 돼지고기',8],
  [ITEM.COOKED_BEEF,'스테이크',8],[ITEM.COOKED_CHICKEN,'구운 닭고기',6],[ITEM.COOKED_MUTTON,'구운 양고기',6],
  [ITEM.RAW_FISH,'생선',2],[ITEM.COOKED_FISH,'구운 생선',6],[ITEM.COOKIE,'쿠키',2]
])newItem(id,name,'음식',{food});
for(const [id,name] of [
  [ITEM.COCOA,'코코아 콩'],[ITEM.BONE,'뼈'],[ITEM.STRING,'실'],[ITEM.FEATHER,'깃털'],
  [ITEM.FLINT,'부싯돌'],[ITEM.PAPER,'종이'],[ITEM.BOOK,'책'],[ITEM.IRON_NUGGET,'철 조각'],
  [ITEM.GOLD_NUGGET,'금 조각'],[ITEM.CHARCOAL,'목탄'],[ITEM.POPPY,'양귀비'],[ITEM.DAISY,'데이지']
])newItem(id,name,'재료');
newItem(ITEM.BONE_MEAL,'뼛가루','농사',{useHint:'작물에 우클릭하여 성장 촉진'});
newItem(ITEM.BUCKET,'양동이','도구',{maxStack:16,useHint:'물에 우클릭하여 담기 · 소에게 우클릭하여 우유 얻기'});
newItem(ITEM.WATER_BUCKET,'물 양동이','도구',{maxStack:1,useHint:'블록 면에 우클릭하여 물 붓기'});
newItem(ITEM.MILK_BUCKET,'우유 양동이','음식',{maxStack:1,food:4,heals:2,container:ITEM.BUCKET,useHint:'우클릭: 체력과 배고픔 회복 · 양동이 반환'});
for(const [id,name,toolType,maxDurability,useHint] of [
  [ITEM.BOW,'활','bow',384,'우클릭: 화살 발사 · 화살 필요'],
  [ITEM.SHEARS,'가위','shears',238,'양에게 우클릭: 양털 · 잔디에 우클릭: 채집'],
  [ITEM.FISHING_ROD,'낚싯대','fishing',64,'물에 우클릭: 던지기 · 입질 후 다시 우클릭'],
  [ITEM.SHIELD,'방패','shield',336,'우클릭: 잠시 정면 공격 방어 · 보조 손 사용 가능']
])newItem(id,name,'도구',{toolType,tier:toolType==='shears'?1:0,speed:toolType==='shears'?6:1,maxDurability,useHint});
newItem(ITEM.ARROW,'화살','재료',{useHint:'활로 발사하는 탄약'});
newItem(ITEM.COMPASS,'나침반','도구',{maxStack:1,useHint:'우클릭: 리스폰 지점의 방향과 거리'});
newItem(ITEM.CLOCK,'시계','도구',{maxStack:1,useHint:'우클릭: 현재 월드 시간'});
newItem(ITEM.GOLDEN_APPLE,'황금 사과','음식',{food:4,heals:8,useHint:'우클릭: 체력 8과 배고픔 4 회복'});
for(const wool of WOOL_TYPES)ITEMS[wool.dye]={name:wool.name+' 염료',category:'염료',tiles:{all:[wool.dye-400,15]},color:wool.color,useHint:'양털 염색과 색 혼합 제작'};
ITEMS[ITEM.PORK].food=3;ITEMS[ITEM.BEEF].food=3;ITEMS[ITEM.CHICKEN].food=2;ITEMS[ITEM.MUTTON].food=2;

// v1.8: region odds and collectible resources share one source of truth.
const BIOMES = Object.freeze({
  plains:Object.freeze({name:'평원',chance:18,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.25,tint:0x8ab75a,resource:BLOCK.PLAINS_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.PRAIRIE_FIBER,chance:60}),Object.freeze({id:ITEM.WILDFLOWER_SEED,chance:30}),Object.freeze({id:ITEM.WIND_FEATHER,chance:10})])}),
  forest:Object.freeze({name:'숲',chance:15,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.85,tint:0x579943,resource:BLOCK.FOREST_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.OAK_TWIG,chance:60}),Object.freeze({id:ITEM.FOREST_BERRY,chance:30}),Object.freeze({id:ITEM.LIVING_SAP,chance:10})])}),
  jungle:Object.freeze({name:'정글',chance:8,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:1,tint:0x438a3e,resource:BLOCK.JUNGLE_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.JUNGLE_VINE,chance:60}),Object.freeze({id:ITEM.CACAO_FRUIT,chance:30}),Object.freeze({id:ITEM.JUNGLE_AMBER,chance:10})])}),
  swamp:Object.freeze({name:'늪지대',chance:7,surface:BLOCK.CLAY,subsurface:BLOCK.DIRT,treeDensity:0.55,tint:0x66824a,resource:BLOCK.SWAMP_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.SWAMP_MOSS,chance:60}),Object.freeze({id:ITEM.BOG_MUSHROOM,chance:30}),Object.freeze({id:ITEM.ANCIENT_CLAY_BEAD,chance:10})])}),
  taiga:Object.freeze({name:'침엽수림',chance:6,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.8,tint:0x63876c,resource:BLOCK.TAIGA_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.PINE_NEEDLE,chance:60}),Object.freeze({id:ITEM.SPRUCE_TWIG,chance:30}),Object.freeze({id:ITEM.RESIN_AMBER,chance:10})])}),
  snowy:Object.freeze({name:'설산',chance:10,surface:BLOCK.SNOW,subsurface:BLOCK.DIRT,treeDensity:0.08,tint:0xc8dcdb,resource:BLOCK.SNOWY_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.SNOW_CRYSTAL,chance:60}),Object.freeze({id:ITEM.FROST_WOOD,chance:30}),Object.freeze({id:ITEM.FROST_HEART,chance:10})])}),
  desert:Object.freeze({name:'사막',chance:12,surface:BLOCK.SAND,subsurface:BLOCK.SANDSTONE,treeDensity:0,tint:0xdac27e,resource:BLOCK.DESERT_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.SANDSTONE_CHIP,chance:60}),Object.freeze({id:ITEM.CACTUS_FRUIT,chance:30}),Object.freeze({id:ITEM.SUNSTONE,chance:10})])}),
  highland:Object.freeze({name:'고지대',chance:5,surface:BLOCK.STONE,subsurface:BLOCK.STONE,treeDensity:0.12,tint:0x8d9d86,resource:BLOCK.HIGHLAND_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.GRANITE_CHIP,chance:60}),Object.freeze({id:ITEM.MOUNTAIN_IRON,chance:30}),Object.freeze({id:ITEM.ECHO_CRYSTAL,chance:10})])}),
  savanna:Object.freeze({name:'사바나',chance:4,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.2,tint:0xb6af54,resource:BLOCK.SAVANNA_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.ACACIA_TWIG,chance:60}),Object.freeze({id:ITEM.DRY_GRASS_SEED,chance:30}),Object.freeze({id:ITEM.AMBER_FANG,chance:10})])}),
  badlands:Object.freeze({name:'붉은 황무지',chance:4,surface:BLOCK.RED_SAND,subsurface:BLOCK.TERRACOTTA,treeDensity:0,tint:0xbd7447,resource:BLOCK.BADLANDS_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.RED_CLAY,chance:60}),Object.freeze({id:ITEM.BADLANDS_COPPER,chance:30}),Object.freeze({id:ITEM.WASTELAND_FOSSIL,chance:10})])}),
  cherry:Object.freeze({name:'벚꽃숲',chance:3,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.7,tint:0xa8bd6d,resource:BLOCK.CHERRY_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.CHERRY_TWIG,chance:60}),Object.freeze({id:ITEM.CHERRY_PETAL,chance:30}),Object.freeze({id:ITEM.SPRING_ESSENCE,chance:10})])}),
  bamboo:Object.freeze({name:'대나무숲',chance:3,surface:BLOCK.GRASS,subsurface:BLOCK.DIRT,treeDensity:0.4,tint:0x78a34d,resource:BLOCK.BAMBOO_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.BAMBOO_STALK,chance:60}),Object.freeze({id:ITEM.BAMBOO_SHOOT,chance:30}),Object.freeze({id:ITEM.JADE_SHARD,chance:10})])}),
  mushroom:Object.freeze({name:'버섯숲',chance:2,surface:BLOCK.MYCELIUM,subsurface:BLOCK.DIRT,treeDensity:0,tint:0xa1889a,resource:BLOCK.MUSHROOM_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.MUSHROOM_STEM,chance:60}),Object.freeze({id:ITEM.GLOW_SPORE,chance:30}),Object.freeze({id:ITEM.MYCELIUM_CORE,chance:10})])}),
  volcanic:Object.freeze({name:'화산',chance:1.5,surface:BLOCK.BASALT,subsurface:BLOCK.BASALT,treeDensity:0,tint:0x62565a,resource:BLOCK.VOLCANIC_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.BASALT_CHIP,chance:60}),Object.freeze({id:ITEM.OBSIDIAN_SHARD,chance:30}),Object.freeze({id:ITEM.MAGMA_CORE,chance:10})])}),
  glacier:Object.freeze({name:'빙하',chance:1,surface:BLOCK.ICE,subsurface:BLOCK.ICE,treeDensity:0,tint:0x91c5d7,resource:BLOCK.GLACIER_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.GLACIER_SHARD,chance:60}),Object.freeze({id:ITEM.BLUE_ICE,chance:30}),Object.freeze({id:ITEM.AURORA_CRYSTAL,chance:10})])}),
  crystal:Object.freeze({name:'수정 지대',chance:0.5,surface:BLOCK.CRYSTAL_BLOCK,subsurface:BLOCK.STONE,treeDensity:0,tint:0xb493db,resource:BLOCK.CRYSTAL_RESOURCE,loot:Object.freeze([Object.freeze({id:ITEM.CRYSTAL_SHARD,chance:60}),Object.freeze({id:ITEM.AMETHYST,chance:30}),Object.freeze({id:ITEM.RESONANT_CORE,chance:10})])}),
});
const BIOME_ITEMS = [];
BLOCKS.push({name:'평원 자원석',tiles:{all:[0,16]},color:0x8ab75a,biomeResource:'plains',miningTime:.7,category:'자연'});
BLOCKS.push({name:'숲 자원석',tiles:{all:[1,16]},color:0x579943,biomeResource:'forest',miningTime:.7,category:'자연'});
BLOCKS.push({name:'정글 자원석',tiles:{all:[2,16]},color:0x438a3e,biomeResource:'jungle',miningTime:.7,category:'자연'});
BLOCKS.push({name:'늪지대 자원석',tiles:{all:[3,16]},color:0x66824a,biomeResource:'swamp',miningTime:.7,category:'자연'});
BLOCKS.push({name:'침엽수림 자원석',tiles:{all:[4,16]},color:0x63876c,biomeResource:'taiga',miningTime:.7,category:'자연'});
BLOCKS.push({name:'설산 자원석',tiles:{all:[5,16]},color:0xc8dcdb,biomeResource:'snowy',miningTime:.7,category:'자연'});
BLOCKS.push({name:'사막 자원석',tiles:{all:[6,16]},color:0xdac27e,biomeResource:'desert',miningTime:.7,category:'자연'});
BLOCKS.push({name:'고지대 자원석',tiles:{all:[7,16]},color:0x8d9d86,biomeResource:'highland',miningTime:.7,category:'자연'});
BLOCKS.push({name:'사바나 자원석',tiles:{all:[8,16]},color:0xb6af54,biomeResource:'savanna',miningTime:.7,category:'자연'});
BLOCKS.push({name:'붉은 황무지 자원석',tiles:{all:[9,16]},color:0xbd7447,biomeResource:'badlands',miningTime:.7,category:'자연'});
BLOCKS.push({name:'벚꽃숲 자원석',tiles:{all:[10,16]},color:0xa8bd6d,biomeResource:'cherry',miningTime:.7,category:'자연'});
BLOCKS.push({name:'대나무숲 자원석',tiles:{all:[11,16]},color:0x78a34d,biomeResource:'bamboo',miningTime:.7,category:'자연'});
BLOCKS.push({name:'버섯숲 자원석',tiles:{all:[12,16]},color:0xa1889a,biomeResource:'mushroom',miningTime:.7,category:'자연'});
BLOCKS.push({name:'화산 자원석',tiles:{all:[13,16]},color:0x62565a,biomeResource:'volcanic',miningTime:.7,category:'자연'});
BLOCKS.push({name:'빙하 자원석',tiles:{all:[14,16]},color:0x91c5d7,biomeResource:'glacier',miningTime:.7,category:'자연'});
BLOCKS.push({name:'수정 지대 자원석',tiles:{all:[15,16]},color:0xb493db,biomeResource:'crystal',miningTime:.7,category:'자연'});
BLOCKS.push({name:'붉은 모래',tiles:{all:[0,17]},color:0xbc683c,miningTime:.6,category:'자연',tool:'shovel',gravity:true});
BLOCKS.push({name:'테라코타',tiles:{all:[1,17]},color:0xa85842,miningTime:.6,category:'자연',tool:'pickaxe'});
BLOCKS.push({name:'균사토',tiles:{all:[2,17]},color:0x9b7a91,miningTime:.6,category:'자연',tool:'shovel'});
BLOCKS.push({name:'현무암',tiles:{all:[3,17]},color:0x49444c,miningTime:.6,category:'자연',tool:'pickaxe'});
BLOCKS.push({name:'빙하 얼음',tiles:{all:[4,17]},color:0x8bc9e0,miningTime:.6,category:'자연',tool:'shovel'});
BLOCKS.push({name:'벚나무 잎',tiles:{all:[5,17]},color:0xefb4cb,miningTime:.6,category:'자연',cutout:true,tool:'hoe'});
BLOCKS.push({name:'대나무',tiles:{all:[6,17]},color:0x79a345,miningTime:.6,category:'자연',tool:'cutter'});
BLOCKS.push({name:'수정 블록',tiles:{all:[7,17]},color:0xb194df,miningTime:.6,category:'자연',tool:'pickaxe',emission:7});
ITEMS[ITEM.PRAIRIE_FIBER]={name:'풀섬유',category:'바이옴',biome:'plains',color:0x8ab75a,variant:0,tiles:{all:[0,18]},useHint:'평원 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.PRAIRIE_FIBER,output:ITEM.STRING,count:1,required:2});
ITEMS[ITEM.WILDFLOWER_SEED]={name:'들꽃씨앗',category:'바이옴',biome:'plains',color:0x8ab75a,variant:1,tiles:{all:[1,18]},useHint:'평원 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.WILDFLOWER_SEED,output:ITEM.WHEAT_SEEDS,count:2,required:1});
ITEMS[ITEM.WIND_FEATHER]={name:'바람깃털',category:'바이옴',biome:'plains',color:0x8ab75a,variant:2,tiles:{all:[2,18]},useHint:'평원 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.WIND_FEATHER,output:ITEM.FEATHER,count:2,required:1});
ITEMS[ITEM.OAK_TWIG]={name:'참나무 가지',category:'바이옴',biome:'forest',color:0x579943,variant:0,tiles:{all:[3,18]},useHint:'숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.OAK_TWIG,output:BLOCK.PLANK,count:4,required:1});
ITEMS[ITEM.FOREST_BERRY]={name:'숲딸기',category:'바이옴',biome:'forest',color:0x579943,variant:1,tiles:{all:[4,18]},useHint:'숲 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:3};
BIOME_ITEMS.push({id:ITEM.FOREST_BERRY,output:ITEM.DYE_RED,count:1,required:1});
ITEMS[ITEM.LIVING_SAP]={name:'생명의 수액',category:'바이옴',biome:'forest',color:0x579943,variant:2,tiles:{all:[5,18]},useHint:'숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.LIVING_SAP,output:BLOCK.GLOWSTONE,count:1,required:2});
ITEMS[ITEM.JUNGLE_VINE]={name:'덩굴',category:'바이옴',biome:'jungle',color:0x438a3e,variant:0,tiles:{all:[6,18]},useHint:'정글 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.JUNGLE_VINE,output:ITEM.STRING,count:2,required:2});
ITEMS[ITEM.CACAO_FRUIT]={name:'카카오 열매',category:'바이옴',biome:'jungle',color:0x438a3e,variant:1,tiles:{all:[7,18]},useHint:'정글 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:2};
BIOME_ITEMS.push({id:ITEM.CACAO_FRUIT,output:ITEM.COCOA,count:2,required:1});
ITEMS[ITEM.JUNGLE_AMBER]={name:'밀림 호박석',category:'바이옴',biome:'jungle',color:0x438a3e,variant:2,tiles:{all:[8,18]},useHint:'정글 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.JUNGLE_AMBER,output:ITEM.GOLD_NUGGET,count:3,required:1});
ITEMS[ITEM.SWAMP_MOSS]={name:'늪이끼',category:'바이옴',biome:'swamp',color:0x66824a,variant:0,tiles:{all:[9,18]},useHint:'늪지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SWAMP_MOSS,output:BLOCK.MOSSY_COBBLE,count:1,required:2});
ITEMS[ITEM.BOG_MUSHROOM]={name:'늪버섯',category:'바이옴',biome:'swamp',color:0x66824a,variant:1,tiles:{all:[10,18]},useHint:'늪지대 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:2};
BIOME_ITEMS.push({id:ITEM.BOG_MUSHROOM,output:ITEM.DYE_BROWN,count:2,required:1});
ITEMS[ITEM.ANCIENT_CLAY_BEAD]={name:'고대 진흙구슬',category:'바이옴',biome:'swamp',color:0x66824a,variant:2,tiles:{all:[11,18]},useHint:'늪지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.ANCIENT_CLAY_BEAD,output:BLOCK.CLAY,count:4,required:1});
ITEMS[ITEM.PINE_NEEDLE]={name:'솔잎',category:'바이옴',biome:'taiga',color:0x63876c,variant:0,tiles:{all:[12,18]},useHint:'침엽수림 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.PINE_NEEDLE,output:ITEM.DYE_GREEN,count:2,required:2});
ITEMS[ITEM.SPRUCE_TWIG]={name:'가문비 가지',category:'바이옴',biome:'taiga',color:0x63876c,variant:1,tiles:{all:[13,18]},useHint:'침엽수림 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SPRUCE_TWIG,output:BLOCK.SPRUCE_PLANKS,count:4,required:1});
ITEMS[ITEM.RESIN_AMBER]={name:'송진 호박',category:'바이옴',biome:'taiga',color:0x63876c,variant:2,tiles:{all:[14,18]},useHint:'침엽수림 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.RESIN_AMBER,output:BLOCK.TORCH,count:4,required:1});
ITEMS[ITEM.SNOW_CRYSTAL]={name:'눈결정',category:'바이옴',biome:'snowy',color:0xc8dcdb,variant:0,tiles:{all:[15,18]},useHint:'설산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SNOW_CRYSTAL,output:BLOCK.SNOW,count:2,required:2});
ITEMS[ITEM.FROST_WOOD]={name:'서리목',category:'바이옴',biome:'snowy',color:0xc8dcdb,variant:1,tiles:{all:[0,19]},useHint:'설산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.FROST_WOOD,output:ITEM.STICK,count:4,required:1});
ITEMS[ITEM.FROST_HEART]={name:'서리심장',category:'바이옴',biome:'snowy',color:0xc8dcdb,variant:2,tiles:{all:[1,19]},useHint:'설산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.FROST_HEART,output:BLOCK.GLASS,count:4,required:1});
ITEMS[ITEM.SANDSTONE_CHIP]={name:'사암조각',category:'바이옴',biome:'desert',color:0xdac27e,variant:0,tiles:{all:[2,19]},useHint:'사막 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SANDSTONE_CHIP,output:BLOCK.SANDSTONE,count:1,required:2});
ITEMS[ITEM.CACTUS_FRUIT]={name:'선인장 과육',category:'바이옴',biome:'desert',color:0xdac27e,variant:1,tiles:{all:[3,19]},useHint:'사막 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:4};
BIOME_ITEMS.push({id:ITEM.CACTUS_FRUIT,output:ITEM.DYE_GREEN,count:1,required:1});
ITEMS[ITEM.SUNSTONE]={name:'태양석',category:'바이옴',biome:'desert',color:0xdac27e,variant:2,tiles:{all:[4,19]},useHint:'사막 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SUNSTONE,output:BLOCK.GLOWSTONE,count:1,required:2});
ITEMS[ITEM.GRANITE_CHIP]={name:'화강암 조각',category:'바이옴',biome:'highland',color:0x8d9d86,variant:0,tiles:{all:[5,19]},useHint:'고지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.GRANITE_CHIP,output:BLOCK.POLISHED_STONE,count:2,required:2});
ITEMS[ITEM.MOUNTAIN_IRON]={name:'산철 조각',category:'바이옴',biome:'highland',color:0x8d9d86,variant:1,tiles:{all:[6,19]},useHint:'고지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.MOUNTAIN_IRON,output:ITEM.IRON_NUGGET,count:3,required:1});
ITEMS[ITEM.ECHO_CRYSTAL]={name:'산울림 수정',category:'바이옴',biome:'highland',color:0x8d9d86,variant:2,tiles:{all:[7,19]},useHint:'고지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.ECHO_CRYSTAL,output:ITEM.LAPIS,count:2,required:2});
ITEMS[ITEM.ACACIA_TWIG]={name:'아카시아 가지',category:'바이옴',biome:'savanna',color:0xb6af54,variant:0,tiles:{all:[8,19]},useHint:'사바나 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.ACACIA_TWIG,output:BLOCK.PLANK,count:4,required:1});
ITEMS[ITEM.DRY_GRASS_SEED]={name:'건초씨앗',category:'바이옴',biome:'savanna',color:0xb6af54,variant:1,tiles:{all:[9,19]},useHint:'사바나 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.DRY_GRASS_SEED,output:ITEM.WHEAT_SEEDS,count:3,required:1});
ITEMS[ITEM.AMBER_FANG]={name:'호박빛 송곳니',category:'바이옴',biome:'savanna',color:0xb6af54,variant:2,tiles:{all:[10,19]},useHint:'사바나 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.AMBER_FANG,output:ITEM.BONE_MEAL,count:3,required:1});
ITEMS[ITEM.RED_CLAY]={name:'붉은점토',category:'바이옴',biome:'badlands',color:0xbd7447,variant:0,tiles:{all:[11,19]},useHint:'붉은 황무지 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.RED_CLAY,output:BLOCK.TERRACOTTA,count:2,required:2});
ITEMS[ITEM.BADLANDS_COPPER]={name:'황야 구리조각',category:'바이옴',biome:'badlands',color:0xbd7447,variant:1,tiles:{all:[12,19]},useHint:'붉은 황무지 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.BADLANDS_COPPER,output:ITEM.COPPER_INGOT,count:1,required:3});
ITEMS[ITEM.WASTELAND_FOSSIL]={name:'황야화석',category:'바이옴',biome:'badlands',color:0xbd7447,variant:2,tiles:{all:[13,19]},useHint:'붉은 황무지 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.WASTELAND_FOSSIL,output:ITEM.BONE_MEAL,count:4,required:1});
ITEMS[ITEM.CHERRY_TWIG]={name:'벚나무 가지',category:'바이옴',biome:'cherry',color:0xa8bd6d,variant:0,tiles:{all:[14,19]},useHint:'벚꽃숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.CHERRY_TWIG,output:BLOCK.PLANK,count:4,required:1});
ITEMS[ITEM.CHERRY_PETAL]={name:'벚꽃잎',category:'바이옴',biome:'cherry',color:0xa8bd6d,variant:1,tiles:{all:[15,19]},useHint:'벚꽃숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.CHERRY_PETAL,output:ITEM.DYE_PINK,count:2,required:1});
ITEMS[ITEM.SPRING_ESSENCE]={name:'봄의 정수',category:'바이옴',biome:'cherry',color:0xa8bd6d,variant:2,tiles:{all:[0,20]},useHint:'벚꽃숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.SPRING_ESSENCE,output:ITEM.GOLDEN_APPLE,count:1,required:3});
ITEMS[ITEM.BAMBOO_STALK]={name:'대나무줄기',category:'바이옴',biome:'bamboo',color:0x78a34d,variant:0,tiles:{all:[1,20]},useHint:'대나무숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.BAMBOO_STALK,output:BLOCK.BAMBOO,count:2,required:1});
ITEMS[ITEM.BAMBOO_SHOOT]={name:'죽순',category:'바이옴',biome:'bamboo',color:0x78a34d,variant:1,tiles:{all:[2,20]},useHint:'대나무숲 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:5};
BIOME_ITEMS.push({id:ITEM.BAMBOO_SHOOT,output:ITEM.WHEAT_SEEDS,count:2,required:1});
ITEMS[ITEM.JADE_SHARD]={name:'비취조각',category:'바이옴',biome:'bamboo',color:0x78a34d,variant:2,tiles:{all:[3,20]},useHint:'대나무숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.JADE_SHARD,output:ITEM.EMERALD,count:1,required:4});
ITEMS[ITEM.MUSHROOM_STEM]={name:'버섯줄기',category:'바이옴',biome:'mushroom',color:0xa1889a,variant:0,tiles:{all:[4,20]},useHint:'버섯숲 자원석 채굴 · 제작법에서 활용' + " · 우클릭: 먹기",food:3};
BIOME_ITEMS.push({id:ITEM.MUSHROOM_STEM,output:ITEM.DYE_BROWN,count:1,required:1});
ITEMS[ITEM.GLOW_SPORE]={name:'발광포자',category:'바이옴',biome:'mushroom',color:0xa1889a,variant:1,tiles:{all:[5,20]},useHint:'버섯숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.GLOW_SPORE,output:BLOCK.TORCH,count:4,required:1});
ITEMS[ITEM.MYCELIUM_CORE]={name:'균사핵',category:'바이옴',biome:'mushroom',color:0xa1889a,variant:2,tiles:{all:[6,20]},useHint:'버섯숲 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.MYCELIUM_CORE,output:ITEM.BONE_MEAL,count:4,required:1});
ITEMS[ITEM.BASALT_CHIP]={name:'현무암 조각',category:'바이옴',biome:'volcanic',color:0x62565a,variant:0,tiles:{all:[7,20]},useHint:'화산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.BASALT_CHIP,output:BLOCK.BASALT,count:2,required:2});
ITEMS[ITEM.OBSIDIAN_SHARD]={name:'흑요석 조각',category:'바이옴',biome:'volcanic',color:0x62565a,variant:1,tiles:{all:[8,20]},useHint:'화산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.OBSIDIAN_SHARD,output:BLOCK.STONE_BRICKS,count:4,required:2});
ITEMS[ITEM.MAGMA_CORE]={name:'용암핵',category:'바이옴',biome:'volcanic',color:0x62565a,variant:2,tiles:{all:[9,20]},useHint:'화산 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.MAGMA_CORE,output:BLOCK.GLOWSTONE,count:2,required:1});
ITEMS[ITEM.GLACIER_SHARD]={name:'빙하조각',category:'바이옴',biome:'glacier',color:0x91c5d7,variant:0,tiles:{all:[10,20]},useHint:'빙하 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.GLACIER_SHARD,output:BLOCK.ICE,count:2,required:2});
ITEMS[ITEM.BLUE_ICE]={name:'푸른얼음',category:'바이옴',biome:'glacier',color:0x91c5d7,variant:1,tiles:{all:[11,20]},useHint:'빙하 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.BLUE_ICE,output:BLOCK.GLASS,count:4,required:1});
ITEMS[ITEM.AURORA_CRYSTAL]={name:'오로라결정',category:'바이옴',biome:'glacier',color:0x91c5d7,variant:2,tiles:{all:[12,20]},useHint:'빙하 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.AURORA_CRYSTAL,output:ITEM.DYE_CYAN,count:4,required:1});
ITEMS[ITEM.CRYSTAL_SHARD]={name:'수정조각',category:'바이옴',biome:'crystal',color:0xb493db,variant:0,tiles:{all:[13,20]},useHint:'수정 지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.CRYSTAL_SHARD,output:BLOCK.CRYSTAL_BLOCK,count:1,required:3});
ITEMS[ITEM.AMETHYST]={name:'자수정',category:'바이옴',biome:'crystal',color:0xb493db,variant:1,tiles:{all:[14,20]},useHint:'수정 지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.AMETHYST,output:ITEM.DYE_PURPLE,count:3,required:1});
ITEMS[ITEM.RESONANT_CORE]={name:'공명수정핵',category:'바이옴',biome:'crystal',color:0xb493db,variant:2,tiles:{all:[15,20]},useHint:'수정 지대 자원석 채굴 · 제작법에서 활용'};
BIOME_ITEMS.push({id:ITEM.RESONANT_CORE,output:ITEM.DIAMOND,count:1,required:4});

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

PLACEABLE_IDS.push(...WOOL_TYPES.map(x=>x.block),...STORAGE_TYPES.map(x=>x.block),BLOCK.LANTERN,
  ...Object.values(BIOMES).map(b=>b.resource),BLOCK.RED_SAND,BLOCK.TERRACOTTA,BLOCK.MYCELIUM,BLOCK.BASALT,BLOCK.ICE,BLOCK.CHERRY_LEAVES,BLOCK.BAMBOO,BLOCK.CRYSTAL_BLOCK);

const BLOCK_DROPS = {
  [BLOCK.FARMLAND]:BLOCK.DIRT,[BLOCK.WHEAT_CROP]:0,[BLOCK.CARROT_CROP]:0,[BLOCK.POTATO_CROP]:0,
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
  if (def.biomeResource) {
    const loot=BIOMES[def.biomeResource].loot;
    const roll=Math.max(0,Math.min(.999999,Number(rnd ? rnd() : Math.random())||0))*100;
    let edge=0;
    for(const drop of loot){edge+=drop.chance;if(roll<edge)return drop.id;}
    return loot[loot.length-1].id;
  }
  // Hoes let survival players collect leaf blocks for mossy-stone crafting.
  if ([BLOCK.LEAVES,BLOCK.BIRCH_LEAVES,BLOCK.SPRUCE_LEAVES].includes(id) && tool?.toolType==='hoe') return id;
  if (id === BLOCK.LEAVES || id === BLOCK.BIRCH_LEAVES) {
    const roll=rnd?rnd():1;
    return roll<.04?ITEM.APPLE:roll<.065?ITEM.COCOA:0;
  }
  if(id===BLOCK.GRAVEL&&rnd&&rnd()<.1)return ITEM.FLINT;
  if (id === BLOCK.SPRUCE_LEAVES) return rnd && rnd() < 0.08 ? ITEM.STICK : 0;
  if (id === BLOCK.GLASS) return 0;
  if (def.minTier !== undefined) {
    if (!tool || tool.toolType !== def.tool || tool.tier < def.minTier) return 0;
  }
  return Object.prototype.hasOwnProperty.call(BLOCK_DROPS,id) ? BLOCK_DROPS[id] : id;
}

function isToolId(id){return !!ITEMS[id]?.toolType;} function isArmorId(id){return !!ITEMS[id]?.armorType;}
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
  sheep:    { name: '양',      hostile: false, hp: 8, speed: 1.4, height: 1.22, width: .82, drops: [{ id: ITEM.MUTTON, min: 1, max: 2 }, {id:BLOCK.WOOL_WHITE,min:1,max:1}] },
  chicken:  { name: '닭',      hostile: false, hp: 4,  speed: 1.3, height: .65, width: .45, drops: [{ id: ITEM.CHICKEN, min: 1, max: 1 }, {id:ITEM.FEATHER,min:1,max:2}] },
  zombie:   { name: '좀비',    hostile: true,  hp: 20, speed: 2.35, height: 1.9,  width: .62, dmg: 3, aggro: 24, drops: [{ id: ITEM.ROTTEN, min: 1, max: 1, chance: .45 }, {id:ITEM.CARROT,min:1,max:1,chance:.12}, {id:ITEM.POTATO,min:1,max:1,chance:.12}] },
  skeleton: { name: '스켈레톤', hostile: true, hp: 20, speed: 2.15, height: 1.9, width: .56, dmg: 3, aggro: 26, ranged: true, drops: [{id:ITEM.BONE,min:1,max:2}, {id:ITEM.ARROW,min:1,max:3}] },
  spider:   { name: '거미',    hostile: true,  hp: 16, speed: 3.2, height: .75, width: 1.0,  dmg: 2.5, aggro: 18, drops: [{id:ITEM.STRING,min:1,max:2}] }
};

// Local voxel AABBs, used consistently by world meshing, player movement and placement.
// Each box is [minX,minY,minZ,maxX,maxY,maxZ] within its owning voxel.
function getBlockBoxes(id, state = null) {
  const s=state||{};
  if(id===BLOCK.FARMLAND)return [[0,0,0,1,.9375,1]];
  if(id===BLOCK.LANTERN)return [[.25,.08,.25,.75,.7,.75],[.2,.04,.2,.8,.12,.8],[.2,.7,.2,.8,.8,.8],[.43,.8,.43,.57,.98,.57]];
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

function getMaxStack(id) {
  const def=getItemDef(id);
  return def?.toolType||def?.armorType?1:(def?.maxStack||64);
}
