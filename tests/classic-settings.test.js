'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/game/classic-settings.js'), 'utf8');
function settings(raw, denied = false) {
  const writes = [];
  const localStorage = {
    getItem() { if (denied) throw new Error('denied'); return raw; },
    setItem(key, value) { if (denied) throw new Error('quota'); writes.push([key, value]); }
  };
  return { api: new Function('localStorage', source + '\nreturn ClassicSettings;')(localStorage), writes };
}
const corrupt = settings('{broken').api;
assert.deepEqual(corrupt.get(), { fov: 70, sensitivity: 100, invertY: false });
const saved = settings(JSON.stringify({ fov: 900, sensitivity: -50, invertY: 'yes' }));
assert.deepEqual(saved.api.get(), { fov: 110, sensitivity: 10, invertY: false });
saved.api.set({ fov: 80, invertY: true });
assert.deepEqual(saved.api.get(), { fov: 80, sensitivity: 10, invertY: true });
const reloaded = settings(saved.writes.at(-1)[1]).api;
assert.deepEqual(reloaded.get(), saved.api.get());
const copy = reloaded.get(); copy.fov = 1;
assert.equal(reloaded.get().fov, 80);
assert.deepEqual(reloaded.reset(), { fov: 70, sensitivity: 100, invertY: false });
assert.equal(settings(null, true).api.set({ fov: 90 }).fov, 90);
console.log('PASS classic options: invalid data, clamping, merge, persistence, isolation and denied storage');
