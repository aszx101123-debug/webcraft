'use strict';

const SaveSystem = (() => {
  function save(data) {
    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clear() {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { }
  }
  return { save, load, clear };
})();
