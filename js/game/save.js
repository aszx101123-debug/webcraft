'use strict';

const SaveSystem = (() => {
  const LEGACY_KEY = CONFIG.SAVE_KEY;
  const INDEX_KEY = CONFIG.WORLD_INDEX_KEY;
  const PREFIX = CONFIG.WORLD_DATA_PREFIX;

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function readIndex() {
    const list = readJSON(INDEX_KEY, []);
    return Array.isArray(list) ? list.filter(x => x && x.id && x.name) : [];
  }

  function writeIndex(list) {
    return writeJSON(INDEX_KEY, list);
  }

  function makeId() {
    return 'world-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeSeed() {
    return Math.floor(Math.random() * 2147483647);
  }


  function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function validateWorldData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.seed !== undefined && !isFiniteNumber(data.seed)) return false;
    if (data.player) {
      if (!isFiniteNumber(data.player.x) || !isFiniteNumber(data.player.y) || !isFiniteNumber(data.player.z)) return false;
    }
    if (data.edits !== undefined && !Array.isArray(data.edits)) return false;
    if (data.blockObjects !== undefined && (!Array.isArray(data.blockObjects) || data.blockObjects.length>5000)) return false;
    if (data.inventory !== undefined && !Array.isArray(data.inventory)) return false;
    if (data.equipment !== undefined && (typeof data.equipment !== 'object' || Array.isArray(data.equipment))) return false;
    return true;
  }

  function safeParse(raw) {
    try {
      const data = JSON.parse(raw);
      return validateWorldData(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function migrateLegacy() {
    const existing = readIndex();
    if (existing.length) return existing;
    const legacy = readJSON(LEGACY_KEY, null);
    if (!legacy) return [];
    const id = 'world-legacy';
    const meta = {
      id,
      name: '기존 월드',
      seed: legacy.seed || makeSeed(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    writeJSON(PREFIX + id, legacy);
    const list = [meta];
    writeIndex(list);
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { }
    return list;
  }

  function list() {
    return migrateLegacy().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function get(id) {
    return list().find(w => w.id === id) || null;
  }

  function getActiveId() {
    const listNow = list();
    const active = readJSON(INDEX_KEY + ':active', null);
    if (active && listNow.some(w => w.id === active)) return active;
    return listNow[0] ? listNow[0].id : null;
  }

  function setActiveId(id) {
    const w = get(id);
    if (!w) return false;
    return writeJSON(INDEX_KEY + ':active', id);
  }

  function create(name, seed) {
    const listNow = list();
    const id = makeId();
    const cleanName = String(name || '').trim().slice(0, 24) || ('월드 ' + (listNow.length + 1));
    const cleanSeed = Number.isFinite(seed) ? Math.max(1, Math.floor(seed)) : makeSeed();
    const now = Date.now();
    const meta = { id, name: cleanName, seed: cleanSeed, createdAt: now, updatedAt: now };
    listNow.push(meta);
    if (!writeIndex(listNow)) return null;
    writeJSON(PREFIX + id, null);
    setActiveId(id);
    return meta;
  }

  function remove(id) {
    const listNow = list();
    if (listNow.length <= 1) return false;
    if (!listNow.some(w => w.id === id)) return false;
    try { localStorage.removeItem(PREFIX + id); } catch (e) { }
    const next = listNow.filter(w => w.id !== id);
    if (!writeIndex(next)) return false;
    if (getActiveId() === id) setActiveId(next[0].id);
    return true;
  }

  function rename(id, name) {
    const listNow = list();
    const w = listNow.find(x => x.id === id);
    if (!w) return false;
    w.name = String(name || '').trim().slice(0, 24) || w.name;
    w.updatedAt = Date.now();
    return writeIndex(listNow);
  }

  function save(id, data) {
    const w = get(id);
    if (!w || !validateWorldData(data)) return false;
    const payload = {
      ...data,
      savedAt: Number.isFinite(data.savedAt) ? data.savedAt : Date.now()
    };
    const raw = JSON.stringify(payload);
    if (!raw) return false;
    try {
      JSON.parse(raw);
    } catch (e) {
      return false;
    }
    const ok = writeJSON(PREFIX + id, payload);
    if (!ok) return false;
    const listNow = list();
    const meta = listNow.find(x => x.id === id);
    if (meta) {
      meta.updatedAt = Date.now();
      writeIndex(listNow);
    }
    setActiveId(id);
    return true;
  }

  function load(id) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(PREFIX + id);
      if (!raw) return null;
      return safeParse(raw);
    } catch (e) {
      return null;
    }
  }

  function clear(id) {
    if (id) {
      try { localStorage.removeItem(PREFIX + id); } catch (e) { }
      return true;
    }
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(INDEX_KEY);
      localStorage.removeItem(INDEX_KEY + ':active');
    } catch (e) { }
    return true;
  }

  // Portable, explicit backups: importing always creates a NEW world.
  function exportWorld(id) {
    const meta = get(id);
    const world = load(id);
    if (!meta || !world) return null;
    return {
      type: 'webcraft-world-export',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: { name: meta.name, seed: meta.seed },
      world
    };
  }

  function importWorld(payload) {
    if (!payload || payload.type !== 'webcraft-world-export' ||
        payload.formatVersion !== 1 || !payload.meta || !payload.world) return null;
    const data = payload.world;
    if (!validateWorldData(data)) return null;
    const seed = payload.meta.seed;
    if (!Number.isSafeInteger(seed) || seed < 1 || seed > 2147483647) return null;
    if (data.seed !== undefined && data.seed !== seed) return null;

    // Validate cells and inventory before giving uploaded data to the renderer.
    if (data.edits) {
      if (data.edits.length > 12000) return null;
      for (const entry of data.edits) {
        if (!Array.isArray(entry) || entry.length !== 2 ||
            typeof entry[0] !== 'string' || !/^-?\d+,-?\d+$/.test(entry[0]) ||
            !Array.isArray(entry[1]) || entry[1].length > 16384) return null;
        for (const cell of entry[1]) {
          if (!Array.isArray(cell) || cell.length !== 2 ||
              !Number.isInteger(cell[0]) || cell[0] < 0 || cell[0] >= 16384 ||
              !Number.isInteger(cell[1]) || cell[1] < 0 || cell[1] >= BLOCKS.length) return null;
        }
      }
    }
    // Per-position orientation and chest contents must remain bounded on import.
    if (data.blockObjects) for (const entry of data.blockObjects) {
      if (!Array.isArray(entry) || entry.length!==2 ||
          typeof entry[0]!=='string' || !/^-?\\d+,\\d+,-?\\d+$/.test(entry[0]) ||
          !entry[1] || typeof entry[1]!=='object' || Array.isArray(entry[1]))return null;
      const obj=entry[1];
      if (obj.facing!==undefined &&
          !['north','south','east','west'].includes(obj.facing))return null;
      if (obj.half!==undefined && !['top','bottom'].includes(obj.half))return null;
      if (obj.open!==undefined && typeof obj.open!=='boolean')return null;
      if (obj.chest!==undefined) {
        if (!Array.isArray(obj.chest) || obj.chest.length!==18)return null;
        for (const slot of obj.chest) {
          if (slot===null)continue;
          if (!slot || !Number.isInteger(slot.id) || !getItemDef(slot.id) ||
              !Number.isInteger(slot.count) || slot.count<1 || slot.count>64)return null;
        }
      }
    }
    if (data.inventory && (data.inventory.length > 36 ||
        data.inventory.some(s => s && (
          !Number.isInteger(s.id) || !getItemDef(s.id) ||
          !Number.isInteger(s.count) || (s.count !== -1 && (s.count < 1 || s.count > 64))
        )))) return null;
    if (data.crafting) {
      const craft = data.crafting;
      if ((craft.size !== 2 && craft.size !== 3) ||
          !Array.isArray(craft.grid) || craft.grid.length !== 9) return null;
      for (const id of craft.grid) {
        if (id !== null && id !== 0 && (!Number.isInteger(id) || !getItemDef(id) ||
            getToolDef(id) || getArmorDef(id))) return null;
      }
    }
    if (data.inventoryCursor) {
      const stack = data.inventoryCursor;
      if (!Number.isInteger(stack.id) || !getItemDef(stack.id) ||
          !Number.isInteger(stack.count) || stack.count < 1 || stack.count > 64) return null;
    }
    if (data.player) {
      for (const n of [data.player.x, data.player.y, data.player.z])
        if (!Number.isFinite(n) || Math.abs(n) > 1000000) return null;
    }
    const meta = create(payload.meta.name || '가져온 월드', seed);
    if (!meta) return null;
    const safeWorld = { ...data, worldId: meta.id, worldName: meta.name, seed };
    if (!save(meta.id, safeWorld)) {
      remove(meta.id);
      return null;
    }
    return meta;
  }

  function ensureDefault(seed) {
    let id = getActiveId();
    if (id) return id;
    const meta = create('새로운 월드', Number.isFinite(seed) ? seed : makeSeed());
    return meta ? meta.id : null;
  }

  return {
    list, get, getActiveId, setActiveId, create, remove, rename,
    save, load, clear, ensureDefault, exportWorld, importWorld
  };
})();