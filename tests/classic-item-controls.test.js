'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const { Inventory, BLOCK, ITEM, GAME_MODE } = new Function(
  read('js/game/config.js') + '\n' + read('js/game/items.js') +
  '\nreturn {Inventory, BLOCK, ITEM, GAME_MODE};'
)();
let passed = 0;
function check(label, fn) { fn(); passed++; console.log('PASS', label); }
const snapshot = () => JSON.stringify({
  inventory: Inventory.serialize(), equipment: Inventory.serializeEquipment(), selected: Inventory.getSelected()
});
function fresh() { Inventory.init(GAME_MODE.SURVIVAL); }

check('survival pick-block cannot create an unowned block or mutate inventory', () => {
  fresh();
  Inventory.putIntoSlot(0, {id: BLOCK.LOG, count: 7});
  const before = snapshot();
  assert.equal(Inventory.pickBlock(BLOCK.STONE), false);
  assert.equal(snapshot(), before);
  for (const id of [0, -1, NaN, null, '1', 99999]) {
    assert.equal(Inventory.pickBlock(id), false);
    assert.equal(snapshot(), before);
  }
});
check('survival pick-block selects an existing hotbar stack without increasing its count', () => {
  fresh();
  Inventory.putIntoSlot(5, {id: BLOCK.STONE, count: 13});
  const before = Inventory.serialize();
  assert.equal(Inventory.pickBlock(BLOCK.STONE), true);
  assert.equal(Inventory.getSelected(), 5);
  assert.deepEqual(Inventory.serialize(), before);
});
check('survival backpack selection atomically swaps the selected stack into the backpack', () => {
  fresh();
  Inventory.putIntoSlot(3, {id: BLOCK.LOG, count: 17});
  Inventory.putIntoSlot(15, {id: BLOCK.STONE, count: 5});
  Inventory.setSelected(3);
  assert.equal(Inventory.pickBlock(BLOCK.STONE), true);
  assert.deepEqual(Inventory.getSlots()[3], {id: BLOCK.STONE, count: 5});
  assert.deepEqual(Inventory.getSlots()[15], {id: BLOCK.LOG, count: 17});
  assert.equal(Inventory.countItem(BLOCK.STONE), 5);
  assert.equal(Inventory.countItem(BLOCK.LOG), 17);
});
check('picking from the backpack into an empty hotbar slot retains worn tools', () => {
  fresh();
  Inventory.putIntoSlot(12, {id: ITEM.IRON_PICKAXE, count: 1, durability: 37});
  Inventory.setSelected(8);
  assert.equal(Inventory.pickBlock(ITEM.IRON_PICKAXE), true);
  assert.deepEqual(Inventory.getSlots()[8], {id: ITEM.IRON_PICKAXE, count: 1, durability: 37});
  assert.equal(Inventory.getSlots()[12], null);
});
check('creative pick-block reuses matching hotbar items before creating an unlimited stack', () => {
  Inventory.init(GAME_MODE.CREATIVE);
  const old = Inventory.serialize();
  assert.equal(Inventory.pickBlock(BLOCK.LOG), true);
  assert.equal(Inventory.selectedId(), BLOCK.LOG);
  assert.deepEqual(Inventory.serialize(), old);
  Inventory.setSelected(7);
  assert.equal(Inventory.pickBlock(BLOCK.DIAMOND_ORE), true);
  assert.equal(Inventory.selectedId(), BLOCK.DIAMOND_ORE);
  assert.equal(Inventory.selectedSlot().count, Infinity);
});
check('switch-hand swaps complete finite stacks without merging or losing materials', () => {
  fresh();
  Inventory.putIntoSlot(2, {id: BLOCK.LOG, count: 17});
  Inventory.putEquipment('offhand', {id: BLOCK.LOG, count: 6});
  Inventory.setSelected(2);
  assert.equal(Inventory.swapOffhand(), true);
  assert.deepEqual(Inventory.selectedSlot(), {id: BLOCK.LOG, count: 6});
  assert.deepEqual(Inventory.getEquipment().offhand, {id: BLOCK.LOG, count: 17});
  assert.equal(Inventory.swapOffhand(), true);
  assert.deepEqual(Inventory.selectedSlot(), {id: BLOCK.LOG, count: 17});
});
check('switch-hand supports empty hands and preserves tool durability over save/reload', () => {
  fresh();
  assert.equal(Inventory.swapOffhand(), false);
  Inventory.putIntoSlot(0, {id: ITEM.DIAMOND_SWORD, count: 1, durability: 91});
  assert.equal(Inventory.swapOffhand(), true);
  assert.equal(Inventory.selectedSlot(), null);
  assert.equal(Inventory.getEquipment().offhand.durability, 91);
  Inventory.init(GAME_MODE.SURVIVAL, Inventory.serialize(), Inventory.serializeEquipment());
  assert.equal(Inventory.swapOffhand(), true);
  assert.deepEqual(Inventory.selectedSlot(), {id: ITEM.DIAMOND_SWORD, count: 1, durability: 91});
  assert.equal(Inventory.getEquipment().offhand, null);
});
check('offhand can hold armor as an item while armor equipment remains type restricted', () => {
  fresh();
  const helmet = {id: ITEM.IRON_HELMET, count: 1, durability: 20};
  assert.equal(Inventory.swapEquipmentWithCursor('offhand', {...helmet}), null);
  assert.deepEqual(Inventory.getEquipment().offhand, helmet);
  assert.equal(Inventory.swapOffhand(), true);
  assert.deepEqual(Inventory.selectedSlot(), helmet);
  assert.equal(Inventory.putEquipment('feet', {...helmet}).id, helmet.id);
  assert.equal(Inventory.getEquipment().feet, null);
  assert.equal(Inventory.putEquipment('offhand', {...helmet}), null);
  const leftover = Inventory.putEquipment('offhand', {...helmet});
  assert.deepEqual(leftover, helmet);
  assert.equal(Inventory.getEquipment().offhand.count, 1);
});
check('creative switch-hand preserves unlimited block stacks', () => {
  Inventory.init(GAME_MODE.CREATIVE);
  const before = {...Inventory.selectedSlot()};
  assert.equal(Inventory.swapOffhand(), true);
  assert.equal(Inventory.selectedSlot(), null);
  assert.deepEqual(Inventory.getEquipment().offhand, before);
  assert.equal(Inventory.swapOffhand(), true);
  assert.equal(Inventory.selectedSlot().count, Infinity);
});
check('using offhand items consumes only that hand and never damages held tools', () => {
  fresh();
  Inventory.putIntoSlot(0,{id:ITEM.IRON_PICKAXE,count:1,durability:37});
  Inventory.putEquipment('offhand',{id:BLOCK.TORCH,count:2});
  assert.equal(Inventory.consumeOffhand(),true);
  assert.equal(Inventory.getEquipment().offhand.count,1);
  assert.equal(Inventory.selectedSlot().durability,37);
  assert.equal(Inventory.consumeOffhand(),true);
  assert.equal(Inventory.getEquipment().offhand,null);
  assert.equal(Inventory.consumeOffhand(),false);
  Inventory.putEquipment('offhand',{id:ITEM.IRON_PICKAXE,count:1,durability:18});
  assert.equal(Inventory.consumeOffhand(),false);
  assert.equal(Inventory.getEquipment().offhand.durability,18);
  Inventory.init(GAME_MODE.CREATIVE);
  Inventory.swapOffhand();
  assert.equal(Inventory.consumeOffhand(),true);
  assert.equal(Inventory.getEquipment().offhand.count,Infinity);
});
console.log('All ' + passed + ' classic item control checks passed.');
