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
    if (!w) return false;
    const ok = writeJSON(PREFIX + id, data);
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
    const data = readJSON(PREFIX + id, null);
    return data && typeof data === 'object' ? data : null;
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

  function ensureDefault(seed) {
    let id = getActiveId();
    if (id) return id;
    const meta = create('새로운 월드', Number.isFinite(seed) ? seed : makeSeed());
    return meta ? meta.id : null;
  }

  return {
    list, get, getActiveId, setActiveId, create, remove, rename,
    save, load, clear, ensureDefault
  };
})();