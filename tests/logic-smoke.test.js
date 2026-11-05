'use strict';

// Self-contained regression tests; run: node tests/logic-smoke.test.js
// No npm install, real browser, or network connection is required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('PASS', name);
}

const compiledModules = [
  'config', 'items', 'mobile-test-crafting', 'mobile-test-ui',
  'mobile-test-main', 'save', 'noise', 'terrain', 'fluids', 'world',
  'player', 'mobs', 'interaction', 'mobile-test-textures', 'mobile-test-player-model'
];
check('all game JavaScript files parse', () => {
  for (const name of compiledModules) {
    assert.doesNotThrow(() => new Function(src('js/game/' + name + '.js')));
  }
});

const memory = new Map();
const localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};
const game = new Function('localStorage', [
  'config', 'items', 'mobile-test-crafting', 'save', 'noise', 'terrain'
].map(name => src('js/game/' + name + '.js')).join('\n') +
  '\nreturn { BLOCK, ITEM, Inventory, Crafting, SaveSystem, Terrain, GAME_MODE };'
)(localStorage);
const { BLOCK, ITEM, Inventory, Crafting, SaveSystem, Terrain, GAME_MODE } = game;

check('ingredient removal is atomic', () => {
  Inventory.init(GAME_MODE.SURVIVAL);
  Inventory.add(BLOCK.PLANK, 2);
  assert.equal(Inventory.removeItem(BLOCK.PLANK, 3), false);
  assert.equal(Inventory.countItem(BLOCK.PLANK), 2);
});

check('sticks require a vertical 2x2 pattern', () => {
  Crafting.resetGrid(2);
  Crafting.setCell(0, BLOCK.PLANK);
  Crafting.setCell(1, BLOCK.PLANK);
  assert.notEqual(Crafting.getMatch()?.id, 'sticks');
  Crafting.resetGrid(2);
  assert.equal(Crafting.autofill('sticks'), true);
  assert.equal(Crafting.getMatch()?.id, 'sticks');
  assert.equal(Crafting.craftGrid(), true);
  assert.equal(Inventory.countItem(ITEM.STICK), 4);
});

check('torches require coal over a stick', () => {
  Inventory.add(ITEM.COAL, 1);
  Crafting.resetGrid(2);
  assert.equal(Crafting.autofill('torches'), true);
  assert.equal(Crafting.getMatch()?.id, 'torches');
  assert.equal(Crafting.craftGrid(), true);
  assert.equal(Inventory.countItem(BLOCK.TORCH), 4);
});

check('furnace is craftable from eight cobblestone', () => {
  Inventory.add(BLOCK.COBBLE, 8);
  Crafting.resetGrid(3);
  assert.equal(Crafting.autofill('furnace'), true);
  assert.equal(Crafting.craftGrid(), true);
  assert.equal(Inventory.countItem(BLOCK.FURNACE), 1);
});

check('five sword tiers have matching 3x3 recipes', () => {
  for (const [name, material, output] of [
    ['wood', BLOCK.PLANK, ITEM.WOODEN_SWORD],
    ['stone', BLOCK.COBBLE, ITEM.STONE_SWORD],
    ['iron', ITEM.IRON_INGOT, ITEM.IRON_SWORD],
    ['gold', ITEM.GOLD_INGOT, ITEM.GOLD_SWORD],
    ['diamond', ITEM.DIAMOND, ITEM.DIAMOND_SWORD]
  ]) {
    Crafting.resetGrid(3);
    Inventory.add(material, 2);
    Inventory.add(ITEM.STICK, 1);
    assert.equal(Crafting.autofill(name + '-sword'), true);
    assert.equal(Crafting.getMatch()?.id, name + '-sword');
    assert.equal(Crafting.craftGrid(), true);
    assert.ok(Inventory.countItem(output) >= 1);
  }
});

check('tool durability survives mode change and save/reload', () => {
  const tool = Inventory.getSlots().find(s => s && s.id === ITEM.WOODEN_SWORD);
  assert.ok(tool);
  tool.durability = 11;
  Inventory.setMode(GAME_MODE.CREATIVE);
  Inventory.setMode(GAME_MODE.SURVIVAL);
  const serialized = Inventory.serialize();
  Inventory.init(GAME_MODE.SURVIVAL, serialized);
  assert.equal(Inventory.getSlots().find(s => s && s.id === ITEM.WOODEN_SWORD).durability, 11);
});

check('world exports import without overwriting original', () => {
  const meta = SaveSystem.create('Regression world', 12345);
  assert.ok(meta);
  const snapshot = {
    version: 6, seed: 12345,
    player: { x: 3, y: 30, z: 7 },
    inventory: Inventory.serialize(),
    appearance: {skin:2,hair:3,shirt:4,pants:1,boots:1,hairStyle:'long'},
    crafting: { size: 2, grid: [BLOCK.LOG, null, null, null, null, null, null, null, null] },
    inventoryCursor: { id: BLOCK.COBBLE, count: 1 },
    edits: [['0,0', [[65, BLOCK.DIRT]]]]
  };
  assert.equal(SaveSystem.save(meta.id, snapshot), true);
  const exported = SaveSystem.exportWorld(meta.id);
  const copy = SaveSystem.importWorld(exported);
  assert.ok(copy && copy.id !== meta.id);
  assert.ok(SaveSystem.get(meta.id));
  assert.equal(SaveSystem.load(copy.id).crafting.grid[0], BLOCK.LOG);
  assert.equal(SaveSystem.load(copy.id).appearance.hairStyle, 'long');
  assert.equal(SaveSystem.load(copy.id).appearance.shirt, 4);
  const damaged = JSON.parse(JSON.stringify(exported));
  damaged.world.edits = [['0,0', [[99999, BLOCK.DIRT]]]];
  assert.equal(SaveSystem.importWorld(damaged), null);
});

check('terrain generation is deterministic and preserves surface', () => {
  const g = Terrain.makeGen(123);
  const a = g.genChunk(0, 0);
  const b = g.genChunk(0, 0);
  assert.equal(a.length, 16384);
  assert.deepEqual(Array.from(a), Array.from(b));
  const h = g.heightAt(8, 8);
  assert.equal(a[(8 << 10) | (8 << 6) | h], BLOCK.GRASS);
});

check('flowing water does not rebuild unchanged and clears after source removal', () => {
  const blocks = new Map(), levels = new Map(), sources = new Set();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  let changes = 0;
  const World = {
    getChunk() { return {}; },
    getBlock(x, y, z) { return y === 0 ? BLOCK.STONE : (blocks.get(key(x, y, z)) || BLOCK.AIR); },
    setBlock(x, y, z, id) {
      const k = key(x, y, z);
      if ((blocks.get(k) || BLOCK.AIR) === id) return false;
      if (id === BLOCK.AIR) blocks.delete(k);
      else blocks.set(k, id);
      changes++;
      return true;
    },
    getFluidLevel(x, y, z) { return levels.get(key(x, y, z)) || 0; },
    setFluidLevel(x, y, z, level) { levels.set(key(x, y, z), level); },
    getWaterSources() { return Array.from(sources); }
  };
  const Fluids = new Function('CONFIG', 'BLOCK', 'World', src('js/game/fluids.js') +
    '\nreturn Fluids;')({ HEIGHT: 64 }, BLOCK, World);
  World.setBlock(0, 4, 0, BLOCK.WATER);
  sources.add('0,4,0');
  Fluids.init();
  Fluids.update(0, 3, 0, .35);
  assert.ok([...blocks.values()].some(id => id === BLOCK.WATER_FLOW));
  const before = changes;
  Fluids.update(0, 3, 0, .35);
  assert.equal(changes, before);
  World.setBlock(0, 4, 0, BLOCK.AIR);
  sources.clear();
  Fluids.update(0, 3, 0, .35);
  assert.equal([...blocks.values()].filter(id => id === BLOCK.WATER_FLOW).length, 0);
});

check('PC/mobile pages include v1.3.0 avatar editor, held items and world backup controls', () => {
  for (const page of ['play.html', 'mobile-test.html']) {
    const html = src(page);
    assert.ok(html.includes('mobile-test-main.js?v=v130'));
    assert.ok(html.includes('v129-polish.css?v=v129'));
    assert.ok(html.includes('btn-export-world'));
    assert.ok(html.includes('btn-import-world'));
    assert.ok(html.includes('id="character-preview"'));
    assert.ok(html.includes('id="character-options"'));
    assert.ok(html.includes('css/v130-character.css?v=v130'));
  }
  assert.ok(src('index.html').includes('v1.3.0'));
});

console.log('All ' + passed + ' WebCraft regression checks passed.');
