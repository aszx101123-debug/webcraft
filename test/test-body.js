'use strict';

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  \u2713 ' + msg);
  else { fails++; console.error('  \u2717 FAIL: ' + msg); }
}

console.log('[Noise]');
ok(Noise.noise2(3.7, 2.1, 42) === Noise.noise2(3.7, 2.1, 42), 'noise2 결정론적');
let inRange = true;
for (let i = 0; i < 5000; i++) {
  const v = Noise.fbm2(i * .37, i * .61, 7, 4);
  if (v < 0 || v > 1) { inRange = false; break; }
}
ok(inRange, 'fbm2 범위 [0,1]');
const n3 = Noise.noise3(1.2, 3.4, 5.6, 11);
ok(n3 >= 0 && n3 <= 1, 'noise3 범위 [0,1]');
const r = Noise.mulberry32(7);
ok(r() === Noise.mulberry32(7)(), 'mulberry32 결정론적');

console.log('[Terrain]');
const gen = Terrain.makeGen(12345);
const h1 = gen.heightAt(100, -200);
ok(h1 >= 4 && h1 <= 56, 'heightAt 범위 내 (' + h1 + ')');

const data = gen.genChunk(0, 0);
ok(data.length === 16 * 16 * 64, '청크 크기 16384');
ok(data[Terrain.idx(5, 0, 5)] === BLOCK.BEDROCK, 'y=0 기반암');
ok(data[Terrain.idx(5, 63, 5)] === BLOCK.AIR, '최상단 공기');

const data2 = gen.genChunk(0, 0);
let same = true;
for (let i = 0; i < data.length; i++) if (data[i] !== data2[i]) { same = false; break; }
ok(same, 'genChunk 결정론적');

const data3 = gen.genChunk(1, 0);
let diff = false;
for (let i = 0; i < data.length; i++) if (data[i] !== data3[i]) { diff = true; break; }
ok(diff, '좌표별 청크 상이');

let valid = true, seaOk = true;
for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
  const d = gen.genChunk(cx, cz);
  for (let i = 0; i < d.length; i++) if (d[i] > BLOCK.EMERALD_ORE) valid = false;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++)
    for (let y = CONFIG.SEA + 1; y < 64; y++)
      if (d[Terrain.idx(x, y, z)] === BLOCK.WATER) seaOk = false;
}
ok(valid, '모든 블록 ID 유효');
ok(seaOk, '해수면 위 물 없음');

let treeOk = true, logCount = 0;
for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
  const d = gen.genChunk(cx, cz);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 1; y < 63; y++) {
    if (d[Terrain.idx(x, y, z)] === BLOCK.LOG) {
      logCount++;
      const below = d[Terrain.idx(x, y - 1, z)];
      if (below !== BLOCK.GRASS && below !== BLOCK.LOG) treeOk = false;
    }
  }
}
ok(treeOk, '통나무는 잔디 또는 통나무 위에 위치');

let anyWater = false, allTrees = true, totalLogs = 0, anyLowland = false, anyHighland = false;
for (const s of [12345, 1, 999, 42, 777]) {
  const gg = Terrain.makeGen(s);
  let logs = 0, water = 0;
  for (let cx = -8; cx <= 8; cx += 2) for (let cz = -8; cz <= 8; cz += 2) {
    const d = gg.genChunk(cx, cz);
    for (let i = 0; i < d.length; i++) {
      if (d[i] === BLOCK.LOG) logs++;
      else if (d[i] === BLOCK.WATER) water++;
    }
    for (let x = 0; x < 16; x += 8) for (let z = 0; z < 16; z += 8) {
      const hh = gg.heightAt(cx * 16 + x, cz * 16 + z);
      if (hh < 20) anyLowland = true;
      if (hh > 40) anyHighland = true;
    }
  }
  if (logs === 0) allTrees = false;
  if (water > 0) anyWater = true;
  totalLogs += logs;
}
ok(allTrees, '모든 시드에서 나무 생성');
ok(totalLogs > 100, '나무 충분히 생성 (통나무 ' + totalLogs + '개)');
ok(anyWater, '바다/호수 존재');
ok(anyLowland && anyHighland, '저지대+고지대 지형 다양성');

let caveAir = 0;
for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) {
  const d = gen.genChunk(cx, cz);
  for (let i = 0; i < d.length; i++)
    if (d[i] === BLOCK.AIR && (i & 63) > 2 && (i & 63) < 20) caveAir++;
}
ok(caveAir > 0, '동굴 존재 (지하 공기 ' + caveAir + ')');
let oreCounts = new Map();
for (let cx = -6; cx <= 6; cx += 2) for (let cz = -6; cz <= 6; cz += 2) {
  const d = gen.genChunk(cx, cz);
  for (const id of [BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.COPPER_ORE, BLOCK.GOLD_ORE, BLOCK.REDSTONE_ORE, BLOCK.LAPIS_ORE, BLOCK.DIAMOND_ORE, BLOCK.EMERALD_ORE]) {
    const n = d.reduce((s, v) => s + (v === id ? 1 : 0), 0);
    oreCounts.set(id, (oreCounts.get(id) || 0) + n);
  }
}
ok([...oreCounts.values()].some(n => n > 0), '광석 생성 확인');


let spawnFound = false;
for (let i = 0; i < 400; i++) {
  if (gen.heightAt(8 + i * 11, 8 + i * 7) > CONFIG.SEA + 1) { spawnFound = true; break; }
}
ok(spawnFound, '원점 근처 스폰 가능 지점 존재');

const genB = Terrain.makeGen(999);
let seedDiff = false;
for (let x = 0; x < 100 && !seedDiff; x++)
  if (gen.heightAt(x, x) !== genB.heightAt(x, x)) seedDiff = true;
ok(seedDiff, '시드별 지형 상이');

console.log('[Items]');
const woodPick = { toolType: 'pickaxe', tier: 1 };
const stonePick = { toolType: 'pickaxe', tier: 2 };
const ironPick = { toolType: 'pickaxe', tier: 3 };
ok(getBlockDrop(BLOCK.GRASS) === BLOCK.DIRT, '잔디 → 흙 드롭');
ok(getBlockDrop(BLOCK.STONE, null, woodPick) === BLOCK.COBBLE, '돌 → 조약돌 드롭 (나무 곡괭이)');
ok(getBlockDrop(BLOCK.IRON_ORE, null, woodPick) === 0, '철 광석 → 낮은 채굴 등급은 드롭 없음');
ok(getBlockDrop(BLOCK.IRON_ORE, null, stonePick) === ITEM.IRON_INGOT, '철 광석 → 철 주괴');
ok(getBlockDrop(BLOCK.GOLD_ORE, null, stonePick) === 0, '금 광석 → 돌 곡괭이는 드롭 불가');
ok(getBlockDrop(BLOCK.GOLD_ORE, null, ironPick) === ITEM.GOLD_INGOT, '금 광석 → 철 이상 곡괭이로 드롭');
ok(getBlockDrop(BLOCK.LOG) === BLOCK.LOG, '통나무 → 통나무 드롭');
ok(getBlockDrop(BLOCK.WATER) === 0 && getBlockDrop(BLOCK.BEDROCK) === 0, '물/기반암 드롭 없음');
ok(getBlockDrop(BLOCK.LEAVES, () => 0.01) === ITEM.APPLE, '잎 → 낮은 확률 사과');
ok(getBlockDrop(BLOCK.LEAVES, () => 0.5) === 0, '잎 → 대부분 드롭 없음');
ok(isFoodId(ITEM.PORK) && !isFoodId(BLOCK.STONE) && !isFoodId(999), '음식 ID 판별');
ok(isBlockId(BLOCK.STONE) && !isBlockId(ITEM.PORK), '블록 ID 판별');
ok(getItemName(ITEM.BEEF) === '소고기', '아이템 이름');
ok(isToolId(ITEM.WOODEN_PICKAXE) && getToolDef(ITEM.DIAMOND_PICKAXE).tier === 5, '도구 등급 정의');

console.log('[Inventory]');
Inventory.init(GAME_MODE.SURVIVAL, null);
ok(Inventory.getSlots().every(s => s === null), '서바이벌 빈 슬롯 시작');
ok(Inventory.add(ITEM.PORK, 3) === 3, '아이템 3개 추가');
ok(Inventory.add(ITEM.PORK, 100) === 100, '상한 초과분은 빈 슬롯으로 분산');
ok(Inventory.getSlots()[0].count === 64, '첫 슬롯 64');
ok(Inventory.getSlots()[1] && Inventory.getSlots()[1].count === 39, '넘친 39개는 다음 슬롯');
ok(Inventory.add(ITEM.APPLE, 100) === 100, '빈 슬롯으로 분산 수납');
let totalAdded = Inventory.getSlots().reduce((s, x) => s + (x && x.id === ITEM.APPLE ? x.count : 0), 0);
ok(totalAdded === 100, `사과 100개 모두 수납 (${totalAdded})`);
Inventory.setSelected(0);
ok(Inventory.consumeSelected() === true, '소비 성공');
ok(Inventory.getSlots()[0].count === 63, '소비 후 63개');
for (let i = 0; i < 63; i++) Inventory.consumeSelected();
ok(Inventory.getSlots()[0] === null, '다 쓰면 슬롯 비움');
const ser = Inventory.serialize();
ok(ser.includes(null), '직렬화에 null 포함');
Inventory.init(GAME_MODE.CREATIVE, [{ id: BLOCK.STONE, count: -1 }]);
ok(Inventory.isCreative() && Inventory.getSlots()[0].count === Infinity, '크리에이티브 무한 스택 복원');
ok(Inventory.consumeSelected() === true && Inventory.getSlots()[0].count === Infinity, '크리에이티브 소비해도 무한');
Inventory.setMode(GAME_MODE.SURVIVAL);
ok(Inventory.getSlots()[0].count === Inventory.MAX_STACK, '모드 전환 시 64개로 변환');
Inventory.init(GAME_MODE.SURVIVAL, [{ id: ITEM.STONE_PICKAXE, count: 1, durability: 2 }]);
ok(Inventory.selectedToolDurability() === 2, '도구 내구도 저장');
ok(Inventory.damageSelectedTool(1) === false && Inventory.selectedToolDurability() === 1, '도구 내구도 감소');
ok(Inventory.damageSelectedTool(1) === true && Inventory.selectedSlot() === null, '도구 파손 후 슬롯 비움');

console.log('[Crafting data]');
ok(Array.isArray(DEFAULT_HOTBAR) && DEFAULT_HOTBAR.includes(BLOCK.CRAFTING_TABLE), '제작대가 기본 블록 목록에 포함');
ok(PLACEABLE_IDS.includes(BLOCK.DIAMOND_ORE) && PLACEABLE_IDS.includes(BLOCK.EMERALD_ORE), '광석이 배치 가능한 블록 목록에 포함');

console.log('[Mobs]');
let mobsOk = true;
for (const [type, def] of Object.entries(MOB_DEFS)) {
  if (!def.name || def.hp <= 0 || def.speed <= 0) mobsOk = false;
  if (def.hostile && !def.dmg) mobsOk = false;
  (def.drops || []).forEach(d => { if (!ITEMS[d.id] || d.min > d.max) mobsOk = false; });
}
ok(mobsOk, '모든 몹 정의 유효');
ok(Object.values(MOB_DEFS).filter(d => d.hostile).length === 3, '적대 몹 3종');
ok(Object.values(MOB_DEFS).filter(d => !d.hostile).length === 4, '동물 몹 4종');
ok(Object.values(ITEMS).filter(i => typeof i.food === 'number').every(i => i.food > 0 && i.tiles.all), '모든 음식 정의 유효');
ok(Object.values(ITEMS).filter(i => i.toolType).length === 20, '5단계 × 4종 도구 정의');

console.log(fails ? '\n' + fails + '개 실패' : '\n모든 테스트 통과');
if (fails) process.exit(1);
