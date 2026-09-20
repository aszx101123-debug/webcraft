'use strict';

const Inventory = (() => {
  // 27 main inventory slots + 9-slot hotbar = 36 total, like the vanilla player layout.
  const SIZE = 36;
  const HOTBAR_SIZE = 9;
  const MAX_STACK = 64;
  const EQUIPMENT_KEYS = ['mainhand', 'offhand', 'head', 'body'];
  let slots = new Array(SIZE).fill(null);
  let equipment = { mainhand: null, offhand: null, head: null, body: null };
  let sel = 0;
  let mode = GAME_MODE.CREATIVE;

  function normalize(s) {
    if (!s || !s.id) return null;
    const def = getItemDef(s.id);
    if (!def) return null;
    if (def.toolType) {
      const max = def.maxDurability || 1;
      const durability = s.durability === undefined ? max : Math.max(0, Math.min(max, s.durability | 0));
      if (durability <= 0) return null;
      return { id: s.id, count: 1, durability };
    }
    let count = s.count;
    if (count === -1 || count === Infinity) count = Infinity;
    else count = Math.max(1, count | 0);
    return { id: s.id, count };
  }

  function cloneStack(s) {
    return normalize(s);
  }

  function init(m, saved, savedEquipment) {
    mode = m;
    sel = 0;
    slots = new Array(SIZE).fill(null);
    equipment = { mainhand: null, offhand: null, head: null, body: null };

    if (Array.isArray(saved) && saved.length) {
      saved.forEach((s, i) => { if (i < SIZE) slots[i] = normalize(s); });
    } else if (mode === GAME_MODE.CREATIVE) {
      DEFAULT_HOTBAR.forEach((id, i) => slots[i] = { id, count: Infinity });
    }

    if (savedEquipment && typeof savedEquipment === 'object') {
      EQUIPMENT_KEYS.forEach(k => equipment[k] = normalize(savedEquipment[k]));
    }
  }

  function setMode(m) {
    mode = m;
    slots = slots.map(s => {
      if (!s) return null;
      const def = getItemDef(s.id);
      if (def && def.toolType) {
        return { id: s.id, count: 1, durability: def.maxDurability || s.durability || 1 };
      }
      if (m === GAME_MODE.CREATIVE) return { id: s.id, count: Infinity };
      return s.count === Infinity ? { id: s.id, count: MAX_STACK } : s;
    });
    EQUIPMENT_KEYS.forEach(k => {
      const s = equipment[k];
      if (!s) return;
      const def = getItemDef(s.id);
      if (def && def.toolType) equipment[k] = { id: s.id, count: 1, durability: def.maxDurability || s.durability || 1 };
      else if (m !== GAME_MODE.CREATIVE && s.count === Infinity) equipment[k] = { id: s.id, count: MAX_STACK };
    });
  }

  function getSlots() { return slots; }
  function getHotbarSlots() { return slots.slice(0, HOTBAR_SIZE); }
  function getSelected() { return sel; }
  function setSelected(i) { sel = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE; }
  function selectedSlot() { return slots[sel]; }
  function selectedId() { const s = slots[sel]; return s ? s.id : 0; }
  function isCreative() { return mode === GAME_MODE.CREATIVE; }
  function getEquipment() { return equipment; }

  function setSlot(i, id) {
    if (i < 0 || i >= SIZE) return;
    const def = getItemDef(id);
    if (def && def.toolType) slots[i] = { id, count: 1, durability: def.maxDurability || 1 };
    else slots[i] = id ? { id, count: mode === GAME_MODE.CREATIVE ? Infinity : MAX_STACK } : null;
  }

  function canAdd(id, count) {
    if (!id || !count || count <= 0) return false;
    const def = getItemDef(id);
    if (!def) return false;
    if (mode === GAME_MODE.CREATIVE) return true;
    if (def.toolType) return slots.filter(s => !s).length >= count;
    let remaining = count;
    for (const s of slots) {
      if (s && s.id === id && !getItemDef(s.id).toolType) {
        remaining -= Math.max(0, MAX_STACK - s.count);
      }
      if (remaining <= 0) return true;
    }
    const empties = slots.filter(s => !s).length;
    return remaining <= empties * MAX_STACK;
  }

  function add(id, count) {
    if (!id || !count || count <= 0) return 0;
    const def = getItemDef(id);
    if (!def) return 0;
    if (def.toolType) {
      let added = 0;
      for (let n = 0; n < count; n++) {
        const slot = slots.findIndex(s => !s);
        if (slot < 0) break;
        slots[slot] = { id, count: 1, durability: def.maxDurability || 1 };
        added++;
      }
      return added;
    }
    if (mode === GAME_MODE.CREATIVE) return count;
    let left = count;
    for (let i = 0; i < SIZE && left > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && !getItemDef(s.id).toolType && s.count < MAX_STACK) {
        const t = Math.min(MAX_STACK - s.count, left);
        s.count += t;
        left -= t;
      }
    }
    for (let i = 0; i < SIZE && left > 0; i++) {
      if (!slots[i]) {
        const t = Math.min(MAX_STACK, left);
        slots[i] = { id, count: t };
        left -= t;
      }
    }
    return count - left;
  }

  function removeItem(id, count) {
    if (!id || count <= 0) return false;
    let remaining = count;
    for (let i = 0; i < SIZE && remaining > 0; i++) {
      const s = slots[i];
      if (!s || s.id !== id || getItemDef(s.id).toolType) continue;
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count <= 0) slots[i] = null;
    }
    return remaining === 0;
  }

  function countItem(id) {
    let total = 0;
    slots.forEach(s => { if (s && s.id === id) total += s.count === Infinity ? 999999 : s.count; });
    EQUIPMENT_KEYS.forEach(k => {
      const s = equipment[k];
      if (s && s.id === id) total += s.count === Infinity ? 999999 : s.count;
    });
    return total;
  }

  function takeFromSlot(index, amount = null) {
    if (index < 0 || index >= SIZE || !slots[index]) return null;
    const s = slots[index];
    if (s.count === Infinity) return cloneStack(s);
    const n = amount == null ? s.count : Math.max(1, Math.min(s.count, amount | 0));
    const out = { id: s.id, count: n };
    if (getItemDef(s.id).toolType) out.durability = s.durability;
    s.count -= n;
    if (s.count <= 0) slots[index] = null;
    return out;
  }

  function putIntoSlot(index, incoming) {
    if (index < 0 || index >= SIZE || !incoming) return incoming;
    const def = getItemDef(incoming.id);
    if (!def) return incoming;
    const current = slots[index];
    if (!current) {
      slots[index] = cloneStack(incoming);
      return null;
    }
    if (current.id !== incoming.id || def.toolType || getItemDef(current.id).toolType) return incoming;
    if (current.count === Infinity) return incoming;
    const cap = MAX_STACK - current.count;
    if (cap <= 0) return incoming;
    const put = Math.min(cap, incoming.count);
    current.count += put;
    incoming.count -= put;
    return incoming.count > 0 ? incoming : null;
  }

  function move(from, to, amount = null) {
    if (from === to || from < 0 || to < 0 || from >= SIZE || to >= SIZE) return false;
    const moving = takeFromSlot(from, amount);
    if (!moving) return false;
    const leftover = putIntoSlot(to, moving);
    if (leftover) {
      putIntoSlot(from, leftover);
      return false;
    }
    return true;
  }

  function dropFromSlot(index, amount = 1) {
    return takeFromSlot(index, amount);
  }

  function consumeSelected() {
    if (mode === GAME_MODE.CREATIVE) return true;
    const s = slots[sel];
    if (!s || getItemDef(s.id).toolType) return false;
    if (--s.count <= 0) slots[sel] = null;
    return true;
  }

  function damageSelectedTool(amount = 1) {
    if (mode === GAME_MODE.CREATIVE) return false;
    const s = slots[sel];
    const def = s && getToolDef(s.id);
    if (!s || !def) return false;
    s.durability -= amount;
    if (s.durability <= 0) {
      slots[sel] = null;
      return true;
    }
    return false;
  }

  function selectedTool() {
    const s = slots[sel];
    return s ? getToolDef(s.id) : null;
  }

  function selectedToolDurability() {
    const s = slots[sel];
    return s && getToolDef(s.id) ? s.durability : 0;
  }

  function serialize() {
    return slots.map(s => {
      if (!s) return null;
      if (getItemDef(s.id).toolType) return { id: s.id, count: 1, durability: s.durability };
      return { id: s.id, count: s.count === Infinity ? -1 : s.count };
    });
  }

  function takeEquipment(key) {
    if (!EQUIPMENT_KEYS.includes(key) || !equipment[key]) return null;
    const out = equipment[key];
    equipment[key] = null;
    return out;
  }

  function putEquipment(key, incoming) {
    if (!EQUIPMENT_KEYS.includes(key) || !incoming) return incoming;
    if (!equipment[key]) {
      equipment[key] = cloneStack(incoming);
      return null;
    }
    const current = equipment[key];
    if (current.id === incoming.id && !getItemDef(current.id).toolType && current.count < MAX_STACK) {
      const put = Math.min(MAX_STACK - current.count, incoming.count);
      current.count += put;
      incoming.count -= put;
      return incoming.count > 0 ? incoming : null;
    }
    return incoming;
  }

  function serializeEquipment() {
    const out = {};
    EQUIPMENT_KEYS.forEach(k => {
      const s = equipment[k];
      if (!s) out[k] = null;
      else if (getItemDef(s.id).toolType) out[k] = { id: s.id, count: 1, durability: s.durability };
      else out[k] = { id: s.id, count: s.count === Infinity ? -1 : s.count };
    });
    return out;
  }

  return {
    SIZE, HOTBAR_SIZE, MAX_STACK, EQUIPMENT_KEYS,
    init, setMode, getSlots, getHotbarSlots, getSelected, setSelected,
    selectedSlot, selectedId, isCreative, getEquipment, setSlot, canAdd, add,
    removeItem, countItem, takeFromSlot, putIntoSlot, move, dropFromSlot,
    consumeSelected, damageSelectedTool, selectedTool, selectedToolDurability,
    serialize, serializeEquipment, takeEquipment, putEquipment
  };
})();
