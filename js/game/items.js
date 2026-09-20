'use strict';

const Inventory = (() => {
  const SIZE = 9;
  const MAX_STACK = 64;
  let slots = new Array(SIZE).fill(null);
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

  function init(m, saved) {
    mode = m;
    sel = 0;
    slots = new Array(SIZE).fill(null);
    if (Array.isArray(saved) && saved.length) {
      saved.forEach((s, i) => { if (i < SIZE) slots[i] = normalize(s); });
    } else if (mode === GAME_MODE.CREATIVE) {
      DEFAULT_HOTBAR.forEach((id, i) => slots[i] = { id, count: Infinity });
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
  }

  function getSlots() { return slots; }
  function getSelected() { return sel; }
  function setSelected(i) { sel = ((i % SIZE) + SIZE) % SIZE; }
  function selectedSlot() { return slots[sel]; }
  function selectedId() { const s = slots[sel]; return s ? s.id : 0; }
  function isCreative() { return mode === GAME_MODE.CREATIVE; }

  function setSlot(i, id) {
    if (i < 0 || i >= SIZE) return;
    const def = getItemDef(id);
    if (def && def.toolType) slots[i] = { id, count: 1, durability: def.maxDurability || 1 };
    else slots[i] = id ? { id, count: mode === GAME_MODE.CREATIVE ? Infinity : MAX_STACK } : null;
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
    return total;
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

  return {
    SIZE, MAX_STACK, init, setMode, getSlots, getSelected, setSelected,
    selectedSlot, selectedId, isCreative, setSlot, add, removeItem, countItem,
    consumeSelected, damageSelectedTool, selectedTool, selectedToolDurability, serialize
  };
})();