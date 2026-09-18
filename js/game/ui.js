'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  let pickerOpen = false;
  let itemNameTimer = null;
  let lastSurvivalSig = '';

  function renderHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    const sel = Inventory.getSelected();
    Inventory.getSlots().forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (i === sel ? ' sel' : '');
      if (s) {
        let cnt = '';
        if (!Inventory.isCreative() && s.count !== Infinity) cnt = `<span class="cnt">${s.count}</span>`;
        el.innerHTML = `<span class="num">${i + 1}</span><img src="${Textures.blockIcon(s.id)}" alt="">${cnt}`;
        el.title = getItemName(s.id);
      }
      el.addEventListener('click', () => setSelected(i));
      bar.appendChild(el);
    });
  }

  function setSelected(i) {
    Inventory.setSelected(i);
    renderHotbar();
    const s = Inventory.selectedSlot();
    if (s) showItemName(getItemName(s.id));
  }

  function showItemName(name) {
    const el = $('item-name');
    if (!el) return;
    el.textContent = name;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(itemNameTimer);
    itemNameTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function showOverlay(name) {
    ['overlay-start', 'overlay-pause', 'loading', 'overlay-death'].forEach(id => $(id).classList.add('hidden'));
    if (name === 'start') $('overlay-start').classList.remove('hidden');
    else if (name === 'pause') $('overlay-pause').classList.remove('hidden');
    else if (name === 'loading') $('loading').classList.remove('hidden');
    else if (name === 'death') $('overlay-death').classList.remove('hidden');
  }

  let toastTimer = null;
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function setHUD(text) { $('hud-info').textContent = text; }
  function setTime(text) { $('hud-time').textContent = text; }

  function iconRow(el, value, max, icons) {
    el.innerHTML = '';
    for (let i = 0; i < max / 2; i++) {
      const left = value - i * 2;
      const src = left >= 2 ? icons.full : left === 1 ? icons.half : icons.empty;
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      el.appendChild(img);
    }
  }

  function updateSurvival(mode, hp, food, air) {
    const el = $('survival-hud');
    if (mode !== GAME_MODE.SURVIVAL) {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
      lastSurvivalSig = '';
      return;
    }
    el.classList.remove('hidden');
    const sig = mode + hp + '/' + food + '/' + air;
    if (sig === lastSurvivalSig) return;
    lastSurvivalSig = sig;
    const icons = Textures.hudIcons();
    iconRow($('hearts'), hp, SURVIVAL.MAX_HP, { full: icons.heart, half: icons.heartHalf, empty: icons.heartEmpty });
    iconRow($('foods'), food, SURVIVAL.MAX_FOOD, { full: icons.food, half: icons.food, empty: icons.foodEmpty });
    const airs = $('airs');
    if (air >= SURVIVAL.MAX_AIR) {
      airs.innerHTML = '';
    } else {
      airs.innerHTML = '';
      for (let i = 0; i < Math.ceil(air); i++) {
        const img = document.createElement('img');
        img.src = icons.bubble;
        img.alt = '';
        airs.appendChild(img);
      }
    }
  }

  function showDeath(cause) {
    const el = $('death-cause');
    if (el) el.textContent = cause ? cause + '…' : '';
    showOverlay('death');
  }

  function hideDeath() {
    $('overlay-death').classList.add('hidden');
  }

  function openPicker(onPick) {
    pickerOpen = true;
    const grid = $('picker-grid');
    grid.innerHTML = '';
    PLACEABLE_IDS.forEach(id => {
      const b = document.createElement('button');
      b.className = 'pick';
      b.innerHTML = `<img src="${Textures.blockIcon(id)}" alt=""><span>${BLOCKS[id].name}</span>`;
      b.addEventListener('click', () => { closePicker(); onPick(id); });
      grid.appendChild(b);
    });
    $('picker').classList.remove('hidden');
  }

  function closePicker() {
    pickerOpen = false;
    $('picker').classList.add('hidden');
  }

  function isPickerOpen() { return pickerOpen; }

  function flashVignette() {
    const v = $('vignette');
    if (!v) return;
    v.classList.remove('show');
    void v.offsetWidth;
    v.classList.add('show');
    setTimeout(() => v.classList.remove('show'), 120);
  }

  return {
    renderHotbar, setSelected, showItemName, showOverlay, showToast, setHUD, setTime,
    updateSurvival, showDeath, hideDeath, openPicker, closePicker, isPickerOpen, flashVignette
  };
})();
