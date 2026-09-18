'use strict';

const Inventory = (() => {
  const SIZE = 9;
  const MAX_STACK = 64;
  let slots = new Array(SIZE).fill(null);
  let sel = 0;
  let mode = GAME_MODE.CREATIVE;

  function normalize(s) {
    if (!s || !s.id) return null;
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
    if (m === GAME_MODE.CREATIVE) {
      slots = slots.map(s => s ? { id: s.id, count: Infinity } : null);
    } else {
      slots = slots.map(s => s && s.count === Infinity ? { id: s.id, count: MAX_STACK } : s);
    }
  }

  function getSlots() { return slots; }
  function getSelected() { return sel; }
  function setSelected(i) { sel = ((i % SIZE) + SIZE) % SIZE; }
  function selectedSlot() { return slots[sel]; }
  function selectedId() { const s = slots[sel]; return s ? s.id : 0; }
  function isCreative() { return mode === GAME_MODE.CREATIVE; }

  function setSlot(i, id) {
    if (i < 0 || i >= SIZE) return;
    slots[i] = id ? { id, count: mode === GAME_MODE.CREATIVE ? Infinity : MAX_STACK } : null;
  }

  function add(id, count) {
    if (!id || !count || count <= 0) return 0;
    if (mode === GAME_MODE.CREATIVE) return count;
    let left = count;
    for (let i = 0; i < SIZE && left > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && s.count < MAX_STACK) {
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

  function consumeSelected() {
    if (mode === GAME_MODE.CREATIVE) return true;
    const s = slots[sel];
    if (!s) return false;
    if (--s.count <= 0) slots[sel] = null;
    return true;
  }

  function serialize() {
    return slots.map(s => s ? { id: s.id, count: s.count === Infinity ? -1 : s.count } : null);
  }

  return {
    SIZE, MAX_STACK, init, setMode, getSlots, getSelected, setSelected,
    selectedSlot, selectedId, isCreative, setSlot, add, consumeSelected, serialize
  };
})();
