'use strict';

const Inventory = (() => {
  // 27 main inventory slots + 9-slot hotbar = 36 total, like the vanilla player layout.
  const SIZE = 36;
  const HOTBAR_SIZE = 9;
  const MAX_STACK = 64;
  const EQUIPMENT_KEYS=['mainhand','offhand','head','chest','legs','feet'];
  let slots = new Array(SIZE).fill(null);
  let equipment = { mainhand: null, offhand: null, head: null, chest: null, legs: null, feet: null };
  let sel = 0;
  let mode = GAME_MODE.CREATIVE;

  function isGear(d){return !!(d&&(d.toolType||d.armorType));}
  function normalize(s){if(!s||!s.id)return null;const def=getItemDef(s.id);if(!def)return null;if(isGear(def)){
      const max = def.maxDurability || 1;
      const durability = s.durability === undefined ? max : Math.max(0, Math.min(max, s.durability | 0));
      if (durability <= 0) return null;
      return { id: s.id, count: 1, durability };
    }
    let count = s.count;
    if (count === -1 || count === Infinity) count = Infinity;
    else count = Number.isFinite(count) && count > 0 ? Math.min(getMaxStack(s.id), Math.max(1, Math.floor(count))) : 1;
    return { id: s.id, count };
  }

  function cloneStack(s) {
    return normalize(s);
  }

  function init(m, saved, savedEquipment) {
    mode = m;
    sel = 0;
    slots = new Array(SIZE).fill(null);
    equipment = { mainhand: null, offhand: null, head: null, chest: null, legs: null, feet: null };

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
      if (def && isGear(def)) {
        return { id: s.id, count: 1, durability: s.durability || def.maxDurability || 1 };
      }
      if (m === GAME_MODE.CREATIVE) return { id: s.id, count: Infinity };
      return s.count === Infinity ? { id: s.id, count: getMaxStack(s.id) } : s;
    });
    EQUIPMENT_KEYS.forEach(k => {
      const s = equipment[k];
      if (!s) return;
      const def = getItemDef(s.id);
      if (def && isGear(def)) equipment[k] = { id: s.id, count: 1, durability: s.durability || def.maxDurability || 1 };
      else if (m !== GAME_MODE.CREATIVE && s.count === Infinity) equipment[k] = { id: s.id, count: getMaxStack(s.id) };
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
    if (!def) { slots[i] = null; return; }
    if (isGear(def)) slots[i] = { id, count: 1, durability: def.maxDurability || 1 };
    else slots[i] = { id, count: mode === GAME_MODE.CREATIVE ? Infinity : getMaxStack(id) };
  }

  // Middle-click selects an owned block in survival; it must never mint a stack.
  function pickBlock(id) {
    if (!Number.isInteger(id) || !getItemDef(id)) return false;
    const hotbarIndex = slots.slice(0, HOTBAR_SIZE).findIndex(s => s && s.id === id);
    if (hotbarIndex >= 0) {
      sel = hotbarIndex;
      return true;
    }
    if (mode === GAME_MODE.CREATIVE) {
      setSlot(sel, id);
      return true;
    }
    const backpackIndex = slots.findIndex((s, i) => i >= HOTBAR_SIZE && s && s.id === id);
    if (backpackIndex < 0) return false;
    [slots[sel], slots[backpackIndex]] = [slots[backpackIndex], slots[sel]];
    return true;
  }

  // F swaps whole stacks, including tool wear, rather than transferring or merging.
  function swapOffhand() {
    if (!slots[sel] && !equipment.offhand) return false;
    [slots[sel], equipment.offhand] = [equipment.offhand, slots[sel]];
    return true;
  }

  function canAdd(id, count) {
    if (!id || !count || count <= 0) return false;
    const def = getItemDef(id);
    if (!def) return false;
    // A creative infinite stack already covers this item; otherwise require free space.
    if (mode === GAME_MODE.CREATIVE && slots.some(s => s && s.id === id && s.count === Infinity)) return true;
    if (isGear(def)) return slots.filter(s => !s).length >= count;
    let remaining = count;
    for (const s of slots) {
      if (s && s.id === id && !isGear(getItemDef(s.id))) {
        remaining -= Math.max(0, getMaxStack(id) - s.count);
      }
      if (remaining <= 0) return true;
    }
    const empties = slots.filter(s => !s).length;
    return remaining <= empties * getMaxStack(id);
  }

  function add(id, count) {
    if (!id || !count || count <= 0) return 0;
    const def = getItemDef(id);
    if (!def) return 0;
    if (isGear(def)) {
      let added = 0;
      for (let n = 0; n < count; n++) {
        const slot = slots.findIndex(s => !s);
        if (slot < 0) break;
        slots[slot] = { id, count: 1, durability: def.maxDurability || 1 };
        added++;
      }
      return added;
    }
    // Crafted items must actually appear in creative inventory, not just report success.
    if (mode === GAME_MODE.CREATIVE && slots.some(s => s && s.id === id && s.count === Infinity)) return count;
    let left = count;
    for (let i = 0; i < SIZE && left > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && !isGear(getItemDef(s.id)) && s.count < getMaxStack(id)) {
        const t = Math.min(getMaxStack(id) - s.count, left);
        s.count += t;
        left -= t;
      }
    }
    for (let i = 0; i < SIZE && left > 0; i++) {
      if (!slots[i]) {
        const t = Math.min(getMaxStack(id), left);
        slots[i] = { id, count: t };
        left -= t;
      }
    }
    return count - left;
  }

  function removeItem(id, count) {
    if (!id || !Number.isInteger(count) || count <= 0) return false;
    // Atomic check: never consume a partial recipe when inventory is insufficient.
    let available = 0;
    for (const s of slots) if (s && s.id === id && !isGear(getItemDef(s.id))) available += s.count === Infinity ? count : s.count;
    if (available < count) return false;
    let remaining = count;
    for (let i = 0; i < SIZE && remaining > 0; i++) {
      const s = slots[i];
      if (!s || s.id !== id || isGear(getItemDef(s.id))) continue;
      const take = Math.min(s.count, remaining);
      if (s.count !== Infinity) {
        s.count -= take;
        if (s.count <= 0) slots[i] = null;
      }
      remaining -= take;
    }
    return remaining === 0;
  }

  function countItem(id) {
    // Equipped gear isn't an ingredient: recipes only use accessible inventory slots.
    return slots.reduce((n, s) => n + (s && s.id === id ? (s.count === Infinity ? 999999 : s.count) : 0), 0);
  }

  function takeFromSlot(index, amount = null) {
    if (index < 0 || index >= SIZE || !slots[index]) return null;
    const s = slots[index];
    if (s.count === Infinity) return { ...cloneStack(s), count: 1 };
    const n = amount == null ? s.count : Math.max(1, Math.min(s.count, amount | 0));
    const out = { id: s.id, count: n };
    if (isGear(getItemDef(s.id))) out.durability = s.durability;
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
      return Number.isFinite(incoming.count)&&incoming.count>slots[index].count
        ? {...incoming,count:incoming.count-slots[index].count} : null;
    }
    if (current.id !== incoming.id || isGear(def)||isGear(getItemDef(current.id))) return incoming;
    if (current.count === Infinity) return null;
    const cap = getMaxStack(incoming.id) - current.count;
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

  // Inventory hotkeys and quick transfers keep existing item durability intact.
  function swapSlots(a,b) {
    if (!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=SIZE||b>=SIZE||a===b) return false;
    [slots[a],slots[b]]=[slots[b],slots[a]];
    return true;
  }

  function swapWithSlot(index,held) {
    if(!Number.isInteger(index)||index<0||index>=SIZE)return held;
    if(!held)return takeFromSlot(index);
    if(!getItemDef(held.id))return held;
    const current=slots[index];
    if(!current || (current.id===held.id && !isGear(getItemDef(held.id)))) {
      return putIntoSlot(index,held);
    }
    const old=cloneStack(current);
    slots[index]=cloneStack(held);
    return old;
  }

  function swapEquipmentWithCursor(key,held) {
    if(!EQUIPMENT_KEYS.includes(key))return held;
    if(!held)return takeEquipment(key);
    const def=getItemDef(held.id);
    if(!def)return held;
    if(['head','chest','legs','feet'].includes(key) && def.armorType!==key)return held;
    if(key==='mainhand' && def.armorType)return held;
    const current=equipment[key];
    if(!current) {
      equipment[key]=cloneStack(held);
      return null;
    }
    if(current.id===held.id && !isGear(def) && current.count<getMaxStack(held.id)) {
      const n=Math.min(getMaxStack(held.id)-current.count,held.count);
      current.count+=n;
      held.count-=n;
      return held.count>0?held:null;
    }
    equipment[key]=cloneStack(held);
    return cloneStack(current);
  }

  // Classic Shift+click: move between backpack and hotbar; armor auto-equips.
  // Never partially lose a stack if the destination is full.
  function quickMove(index) {
    if(!Number.isInteger(index)||index<0||index>=SIZE)return false;
    const current=slots[index];
    if(!current || current.count===Infinity)return false;
    const def=getItemDef(current.id);
    if(def?.armorType && !equipment[def.armorType]) {
      equipment[def.armorType]=cloneStack(current);
      slots[index]=null;
      return true;
    }
    const dest=index<HOTBAR_SIZE
      ? Array.from({length:SIZE-HOTBAR_SIZE},(_,i)=>i+HOTBAR_SIZE)
      : Array.from({length:HOTBAR_SIZE},(_,i)=>i);
    let moving=takeFromSlot(index);
    if(!moving)return false;
    const original=moving.count;
    if(!isGear(def))for(const i of dest) {
      if(!moving)break;
      if(slots[i]?.id===moving.id)moving=putIntoSlot(i,moving);
    }
    for(const i of dest) {
      if(!moving)break;
      if(!slots[i])moving=putIntoSlot(i,moving);
    }
    if(moving) {
      // Source was vacated first, so restoration always fits any remainder.
      slots[index]=cloneStack(moving);
    }
    return !moving || moving.count<original;
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

  function consumeOffhand() {
    const stack = equipment.offhand;
    if (!stack || isGear(getItemDef(stack.id))) return false;
    if (mode === GAME_MODE.CREATIVE) return true;
    if (--stack.count <= 0) equipment.offhand = null;
    return true;
  }

  function damageSelectedTool(amount = 1) {
    return damageHeld('main',amount);
  }

  function damageHeld(hand,amount=1) {
    if (mode === GAME_MODE.CREATIVE) return false;
    if(!Number.isFinite(amount)||amount<=0)return false;
    const s = hand==='offhand'?equipment.offhand:slots[sel];
    const def = s && getToolDef(s.id);
    if (!s || !def) return false;
    s.durability -= amount;
    if (s.durability <= 0) {
      if(hand==='offhand')equipment.offhand=null;else slots[sel] = null;
      return true;
    }
    return false;
  }

  function canExchangeHeld(hand,resultId) {
    const stack=hand==='offhand'?equipment.offhand:slots[sel];
    if(!stack||!getItemDef(resultId))return false;
    return mode===GAME_MODE.CREATIVE||stack.count===1||canAdd(resultId,1);
  }

  function exchangeHeld(hand,resultId,replaceCreative=false) {
    if(!canExchangeHeld(hand,resultId))return false;
    if(mode===GAME_MODE.CREATIVE){
      if(replaceCreative){
        const next=normalize({id:resultId,count:Infinity});
        if(hand==='offhand')equipment.offhand=next;else slots[sel]=next;
      }
      return true;
    }
    const stack=hand==='offhand'?equipment.offhand:slots[sel];
    if(stack.count===1){
      const next=normalize({id:resultId,count:1});
      if(hand==='offhand')equipment.offhand=next;else slots[sel]=next;
    }else{
      if(add(resultId,1)!==1)return false;
      stack.count--;
    }
    return true;
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
      if (isGear(getItemDef(s.id))) return { id: s.id, count: 1, durability: s.durability };
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
    if(!EQUIPMENT_KEYS.includes(key)||!incoming)return incoming;const d=getItemDef(incoming.id);if(['head','chest','legs','feet'].includes(key)&&(!d||d.armorType!==key))return incoming;if(key==='mainhand'&&d&&d.armorType)return incoming;if(!equipment[key]){
      equipment[key] = cloneStack(incoming);
      return Number.isFinite(incoming.count)&&incoming.count>equipment[key].count
        ? {...incoming,count:incoming.count-equipment[key].count} : null;
    }
    const current = equipment[key];
    if (current.id === incoming.id && !isGear(getItemDef(current.id)) && current.count < getMaxStack(current.id)) {
      const put = Math.min(getMaxStack(current.id) - current.count, incoming.count);
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
      else if (isGear(getItemDef(s.id))) out[k] = { id: s.id, count: 1, durability: s.durability };
      else out[k] = { id: s.id, count: s.count === Infinity ? -1 : s.count };
    });
    return out;
  }

  return {
    SIZE,HOTBAR_SIZE,MAX_STACK,EQUIPMENT_KEYS,getArmorDefense(){return ['head','chest','legs','feet'].reduce((n,k)=>{const d=equipment[k]&&getArmorDef(equipment[k].id);return n+(d?d.defense:0);},0)},
    init, setMode, getSlots, getHotbarSlots, getSelected, setSelected,
    selectedSlot, selectedId, isCreative, getEquipment, setSlot, pickBlock, swapOffhand, canAdd, add,
    removeItem, countItem, takeFromSlot, putIntoSlot, move, dropFromSlot,
    swapSlots, swapWithSlot, swapEquipmentWithCursor, quickMove,
    consumeSelected, consumeOffhand, damageSelectedTool, damageHeld, canExchangeHeld, exchangeHeld,
    stackLimit:getMaxStack, selectedTool, selectedToolDurability,
    serialize, serializeEquipment, takeEquipment, putEquipment
  };
})();
