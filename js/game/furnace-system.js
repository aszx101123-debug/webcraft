'use strict';

// Block-local furnace inventories. Time advances only when the game ticks this system.
const FurnaceSystem = (() => {
  const MAX_STACK = 64, SMELT_SECONDS = 10, MAX_FURNACES = 1024;
  const RECIPES = new Map([
    [BLOCK.IRON_ORE, ITEM.IRON_INGOT], [BLOCK.GOLD_ORE, ITEM.GOLD_INGOT],
    [BLOCK.COPPER_ORE, ITEM.COPPER_INGOT], [BLOCK.SAND, BLOCK.GLASS],
    [BLOCK.COBBLE, BLOCK.STONE]
  ]);
  const FUELS = new Map([
    [ITEM.COAL, 80], [ITEM.STICK, 5],
    [BLOCK.PLANK, 15], [BLOCK.BIRCH_PLANKS, 15], [BLOCK.SPRUCE_PLANKS, 15],
    [BLOCK.LOG, 15], [BLOCK.BIRCH_LOG, 15], [BLOCK.SPRUCE_LOG, 15],
    [BLOCK.CRAFTING_TABLE, 15], [BLOCK.CHEST, 15], [BLOCK.WOOD_STAIRS, 15],
    [BLOCK.BOOKSHELF, 15]
  ]);
  let furnaces = new Map();
  const copy = stack => stack ? { id: stack.id, count: stack.count } : null;
  function keyOf(pos) {
    if (!pos || !['x','y','z'].every(k => Number.isInteger(pos[k]) && Math.abs(pos[k]) <= 1000000) ||
        pos.y < 0 || pos.y >= CONFIG.HEIGHT) return null;
    return pos.x + ',' + pos.y + ',' + pos.z;
  }
  function accepts(slot, id) {
    return slot === 'input' ? RECIPES.has(id) : slot === 'fuel' ? FUELS.has(id) : false;
  }
  function cleanStack(raw, slot) {
    if (!raw || !Number.isInteger(raw.id) || !Number.isInteger(raw.count) ||
        raw.count < 1 || raw.count > MAX_STACK) return null;
    if (slot === 'output' ? ![...RECIPES.values()].includes(raw.id) : !accepts(slot, raw.id)) return null;
    return copy(raw);
  }
  function fresh() {
    return {input:null, fuel:null, output:null, burnRemaining:0, burnDuration:0, cookProgress:0};
  }
  function resolve(pos, create = false) {
    const key = keyOf(pos);
    if (!key) return null;
    if (!furnaces.has(key) && create && furnaces.size < MAX_FURNACES) furnaces.set(key, fresh());
    return furnaces.get(key) || null;
  }
  function init(saved) {
    furnaces = new Map();
    if (!saved || saved.version !== 1 || !Array.isArray(saved.entries)) return;
    for (const entry of saved.entries.slice(0, MAX_FURNACES)) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
          !/^-?\d+,\d+,-?\d+$/.test(entry[0]) || !entry[1] || typeof entry[1] !== 'object') continue;
      const [x,y,z] = entry[0].split(',').map(Number), key = keyOf({x,y,z});
      if (!key || furnaces.has(key)) continue;
      const raw = entry[1], state = fresh();
      for (const slot of ['input','fuel','output']) state[slot] = cleanStack(raw[slot], slot);
      const finite = (n, max) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
      state.burnDuration = finite(raw.burnDuration, 80);
      state.burnRemaining = finite(raw.burnRemaining, state.burnDuration);
      state.cookProgress = state.input ? finite(raw.cookProgress, SMELT_SECONDS - 1e-7) : 0;
      furnaces.set(key, state);
    }
  }
  function getState(pos, create = false) {
    const state = resolve(pos, create);
    return state ? {...state, input:copy(state.input), fuel:copy(state.fuel), output:copy(state.output)} : null;
  }
  function serialize() {
    return {version:1, entries:[...furnaces].map(([key,state]) => [key, {
      ...state, input:copy(state.input), fuel:copy(state.fuel), output:copy(state.output)
    }])};
  }
  function canSmelt(state) {
    const result = state.input && RECIPES.get(state.input.id);
    return !!result && (!state.output || (state.output.id === result && state.output.count < MAX_STACK));
  }
  function update(dt) {
    // Hidden tabs must not finish minutes of cooking in one resumed frame.
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(1, dt);
    for (const [key,state] of furnaces) {
      const [x,y,z] = key.split(',').map(Number);
      if (typeof World !== 'undefined') {
        if (World.getChunk && !World.getChunk(x >> 4, z >> 4)) continue;
        if (World.getBlock && World.getBlock(x,y,z) !== BLOCK.FURNACE) continue;
      }
      let remaining = elapsed;
      // At most one fuel transition and one result per normal game frame.
      while (remaining > 1e-8) {
        const ready = canSmelt(state);
        if (state.burnRemaining <= 1e-8) {
          state.burnRemaining = 0;
          if (!ready || !state.fuel) { state.cookProgress = Math.max(0, state.cookProgress - remaining * 2); break; }
          state.burnDuration = FUELS.get(state.fuel.id) || 0;
          state.burnRemaining = state.burnDuration;
          if (--state.fuel.count === 0) state.fuel = null;
        }
        const step = Math.min(remaining, state.burnRemaining,
          ready ? SMELT_SECONDS - state.cookProgress : remaining);
        state.burnRemaining = Math.max(0, state.burnRemaining - step);
        remaining -= step;
        if (ready) {
          state.cookProgress += step;
          if (state.cookProgress >= SMELT_SECONDS - 1e-8) {
            const outputId = RECIPES.get(state.input.id);
            if (!state.output) state.output = {id:outputId, count:1};
            else state.output.count++;
            if (--state.input.count === 0) state.input = null;
            state.cookProgress = 0;
          }
        } else state.cookProgress = 0;
        if (step <= 1e-8) break;
      }
    }
  }
  // The cursor is passed in and returned, so slot transfers form one transaction.
  function interact(pos, slot, held, right = false) {
    const state = resolve(pos, true);
    if (!state || !['input','fuel','output'].includes(slot)) return {cursor:held, changed:false};
    const current = state[slot];
    if (held && (!Number.isInteger(held.count) || held.count < 1 || held.count > MAX_STACK))
      return {cursor:held, changed:false};
    let cursor = held ? {...held} : null;
    if (slot === 'output') {
      if (!current || (cursor && cursor.id !== current.id)) return {cursor:held, changed:false};
      const capacity = MAX_STACK - (cursor ? cursor.count : 0);
      const count = Math.min(capacity, right ? Math.ceil(current.count / 2) : current.count);
      if (count < 1) return {cursor:held, changed:false};
      cursor = {id:current.id, count:(cursor ? cursor.count : 0) + count};
      current.count -= count;
      if (!current.count) state.output = null;
    } else if (!cursor) {
      if (!current) return {cursor:null, changed:false};
      const count = right ? Math.ceil(current.count / 2) : current.count;
      cursor = {id:current.id, count};
      current.count -= count;
      if (!current.count) state[slot] = null;
    } else {
      if (!accepts(slot, cursor.id)) return {cursor:held, changed:false};
      if (current && current.id !== cursor.id) {
        if (right) return {cursor:held, changed:false};
        state[slot] = copy(cursor); cursor = copy(current);
      } else {
        const capacity = MAX_STACK - (current ? current.count : 0);
        const count = Math.min(capacity, right ? 1 : cursor.count);
        if (count < 1) return {cursor:held, changed:false};
        state[slot] = {id:cursor.id, count:(current ? current.count : 0) + count};
        cursor.count -= count;
        if (!cursor.count) cursor = null;
      }
    }
    if (slot === 'input' && (!state.input || state.input.id !== current?.id)) state.cookProgress = 0;
    return {cursor, changed:true};
  }
  function depositFromInventory(pos, index) {
    const stack = Inventory.getSlots()[index];
    const state = resolve(pos, true);
    if (!stack || !state) return false;
    const slot = RECIPES.has(stack.id) ? 'input' : FUELS.has(stack.id) ? 'fuel' : null;
    if (!slot || (state[slot] && state[slot].id !== stack.id)) return false;
    const capacity = MAX_STACK - (state[slot] ? state[slot].count : 0);
    if (capacity <= 0) return false;
    const taken = Inventory.takeFromSlot(index, Math.min(capacity, stack.count));
    if (!taken) return false;
    const result = interact(pos, slot, taken);
    if (result.cursor) Inventory.putIntoSlot(index, result.cursor);
    return result.changed;
  }
  function withdrawToInventory(pos, slot) {
    const state = resolve(pos), stack = state?.[slot];
    if (!stack || !['input','fuel','output'].includes(slot) || !Inventory.canAdd(stack.id, stack.count)) return false;
    const added = Inventory.add(stack.id, stack.count);
    if (!added) return false;
    stack.count -= added;
    if (stack.count <= 0) state[slot] = null;
    if (slot === 'input' && !state.input) state.cookProgress = 0;
    return true;
  }
  function remove(x,y,z) {
    const pos = typeof x === 'object' ? x : {x,y,z}, key = keyOf(pos);
    const state = key && furnaces.get(key);
    if (!state) return [];
    furnaces.delete(key);
    return [state.input,state.fuel,state.output].filter(Boolean).map(copy);
  }
  return {init, serialize, getState, update, accepts, interact, depositFromInventory,
    withdrawToInventory, remove, SMELT_SECONDS};
})();
