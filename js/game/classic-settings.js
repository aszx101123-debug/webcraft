'use strict';

// Client preferences belong to the browser, independent of any saved world.
const ClassicSettings = (() => {
  const KEY = 'webcraft_classic_options_v1';
  const DEFAULTS = Object.freeze({ fov: 70, sensitivity: 100, invertY: false });
  function normalize(input) {
    const data = input && typeof input === 'object' ? input : {};
    const number = (key, min, max) => Number.isFinite(data[key])
      ? Math.round(Math.max(min, Math.min(max, data[key]))) : DEFAULTS[key];
    return {
      fov: number('fov', 30, 110),
      sensitivity: number('sensitivity', 10, 200),
      invertY: data.invertY === true
    };
  }
  let values = { ...DEFAULTS };
  try { values = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (_) { }
  function get() { return { ...values }; }
  function set(input) {
    values = normalize({ ...values, ...input });
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (_) { }
    return get();
  }
  function reset() { return set(DEFAULTS); }
  function bind(onChange) {
    const fov = document.getElementById('classic-fov');
    const sensitivity = document.getElementById('classic-sensitivity');
    const invert = document.getElementById('classic-invert');
    const render = () => {
      if (fov) fov.value = String(values.fov);
      if (sensitivity) sensitivity.value = String(values.sensitivity);
      if (invert) invert.checked = values.invertY;
      const fovValue = document.getElementById('classic-fov-value');
      const sensitivityValue = document.getElementById('classic-sensitivity-value');
      if (fovValue) fovValue.textContent = values.fov === 70 ? '보통 (70)' : String(values.fov);
      if (sensitivityValue) sensitivityValue.textContent = values.sensitivity + '%';
    };
    const update = patch => {
      const next = set(patch);
      render();
      if (typeof onChange === 'function') onChange(next);
    };
    fov?.addEventListener('input', () => update({ fov: Number(fov.value) }));
    sensitivity?.addEventListener('input', () => update({ sensitivity: Number(sensitivity.value) }));
    invert?.addEventListener('change', () => update({ invertY: invert.checked }));
    document.getElementById('classic-options-reset')?.addEventListener('click', () => update(DEFAULTS));
    render();
  }
  return { get, set, reset, bind };
})();
