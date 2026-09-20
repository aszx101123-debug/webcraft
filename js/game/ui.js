'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  let pickerOpen = false;
  let itemNameTimer = null;
  let lastSurvivalSig = '';
  let currentWorldId = null;
  let inventoryOpen = false;
  let inventoryCursor = null;

  function renderHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    const sel = Inventory.getSelected();
    Inventory.getHotbarSlots().forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (i === sel ? ' sel' : '') + (!s ? ' empty' : '');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', s ? getItemName(s.id) + ' 슬롯 ' + (i + 1) : '빈 슬롯 ' + (i + 1));
      if (s) {
        let cnt = '';
        if (!Inventory.isCreative() && s.count !== Infinity) cnt = `<span class="cnt">${s.count}</span>`;
        let durability = '';
        const td = getToolDef(s.id);
        if (td && s.durability) {
          const ratio = Math.max(0, Math.min(1, s.durability / td.maxDurability));
          durability = `<span class="dur-wrap"><span class="dur-fill" style="width:${Math.round(ratio * 100)}%"></span></span>`;
        }
        el.innerHTML = `<span class="num">${i + 1}</span><img src="${Textures.blockIcon(s.id)}" alt="">${cnt}${durability}`;
        el.title = td ? `${getItemName(s.id)} · 내구도 ${s.durability}/${td.maxDurability}` : getItemName(s.id);
      } else {
        el.innerHTML = `<span class="num">${i + 1}</span>`;
        el.title = '빈 슬롯';
      }
      el.addEventListener('click', () => setSelected(i));
      bar.appendChild(el);
    });
  }

  function setSelected(i) {
    Inventory.setSelected(i);
    renderHotbar();
    const s = Inventory.selectedSlot();
    showItemName(s ? getItemName(s.id) : '빈 슬롯');
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
    ['overlay-start', 'overlay-pause', 'overlay-death', 'overlay-inventory'].forEach(id => $(id)?.classList.add('hidden'));
    if (name !== 'inventory') inventoryCursorReturn();
    if (name === 'start') $('overlay-start').classList.remove('hidden');
    else if (name === 'pause') $('overlay-pause').classList.remove('hidden');
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

  function renderWorlds(worlds, activeId) {
    const list = $('world-list');
    if (!list) return;
    currentWorldId = activeId || null;
    list.innerHTML = '';
    if (!worlds.length) {
      list.innerHTML = '<div class="world-detail">저장된 월드가 없습니다.</div>';
      return;
    }
    worlds.forEach(w => {
      const row = document.createElement('div');
      row.className = 'world-row' + (w.id === activeId ? ' active' : '');
      const meta = document.createElement('div');
      meta.className = 'world-meta';
      meta.innerHTML = `<div class="world-name">${escapeHTML(w.name)}${w.id === activeId ? ' · 현재' : ''}</div><div class="world-detail">시드 ${w.seed} · ${new Date(w.updatedAt || w.createdAt || Date.now()).toLocaleString()}</div>`;
      row.appendChild(meta);
      if (w.id !== activeId) {
        const load = document.createElement('button');
        load.className = 'btn small';
        load.textContent = '불러오기';
        load.addEventListener('click', () => location.href = 'play.html?world=' + encodeURIComponent(w.id));
        row.appendChild(load);
      }
      const del = document.createElement('button');
      del.className = 'btn small ghost';
      del.textContent = '삭제';
      del.disabled = worlds.length <= 1 || w.id === activeId;
      del.addEventListener('click', () => {
        if (confirm(`"${w.name}" 월드를 삭제할까요?`)) {
          if (SaveSystem.remove(w.id)) renderWorlds(SaveSystem.list(), SaveSystem.getActiveId());
          else showToast('월드는 하나 이상 유지됩니다');
        }
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function escapeHTML(v) {
    return String(v).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
  }


  function stackLabel(s) {
    if (!s) return '';
    return s.count === Infinity ? '∞' : String(s.count);
  }

  function updateInventoryCursor(clientX, clientY) {
    const el = $('inventory-cursor');
    if (!el) return;
    if (!inventoryCursor) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.style.left = (clientX || innerWidth / 2) + 'px';
    el.style.top = (clientY || innerHeight / 2) + 'px';
    el.innerHTML = `<img src="${Textures.blockIcon(inventoryCursor.id)}" alt=""><span>${stackLabel(inventoryCursor)}</span>`;
  }

  function inventoryCursorReturn() {
    if (!inventoryCursor) return true;
    let left = inventoryCursor;
    for (let i = 0; i < Inventory.SIZE && left; i++) left = Inventory.putIntoSlot(i, left);
    if (left) {
      showToast('인벤토리가 가득 차서 아이템을 되돌릴 수 없습니다');
      return false;
    }
    inventoryCursor = null;
    const el = $('inventory-cursor');
    if (el) el.classList.add('hidden');
    renderHotbar();
    return true;
  }

  function renderInventorySlot(index, target) {
    const s = Inventory.getSlots()[index];
    const btn = document.createElement('button');
    btn.className = 'inventory-slot' + (!s ? ' empty' : '') + (index < Inventory.HOTBAR_SIZE ? ' inventory-hotbar-slot' : '');
    btn.setAttribute('aria-label', s ? getItemName(s.id) + ' 슬롯 ' + (index + 1) : '빈 슬롯');
    btn.innerHTML = `<span class="inv-num">${index < Inventory.HOTBAR_SIZE ? index + 1 : index - Inventory.HOTBAR_SIZE + 1}</span>`;
    if (s) {
      const td = getToolDef(s.id);
      const dur = td && s.durability ? `<span class="inv-dur"><i style="transform:scaleX(${Math.max(0, Math.min(1, s.durability / td.maxDurability))})"></i></span>` : '';
      btn.innerHTML += `<img src="${Textures.blockIcon(s.id)}" alt=""><span class="inv-count">${stackLabel(s)}</span>${dur}`;
      btn.title = td ? `${getItemName(s.id)} · 내구도 ${s.durability}/${td.maxDurability}` : getItemName(s.id);
    } else btn.title = '빈 슬롯';

    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 2) {
        if (!inventoryCursor) {
          const src = Inventory.getSlots()[index];
          if (!src) return;
          if (src.count === Infinity) inventoryCursor = { id: src.id, count: 1 };
          else inventoryCursor = Inventory.takeFromSlot(index, Math.ceil(src.count / 2));
        } else {
          const one = { id: inventoryCursor.id, count: 1 };
          if (getToolDef(one.id)) one.durability = inventoryCursor.durability || getToolDef(one.id).maxDurability;
          const left = Inventory.putIntoSlot(index, one);
          if (!left) {
            inventoryCursor.count -= 1;
            if (inventoryCursor.count <= 0) inventoryCursor = null;
          }
        }
      } else if (e.button === 0) {
        const current = Inventory.getSlots()[index];
        if (!inventoryCursor) {
          if (current) inventoryCursor = Inventory.takeFromSlot(index);
        } else if (!current) {
          inventoryCursor = Inventory.putIntoSlot(index, inventoryCursor);
        } else if (current.id === inventoryCursor.id && !getToolDef(current.id)) {
          inventoryCursor = Inventory.putIntoSlot(index, inventoryCursor);
        } else {
          const old = Inventory.takeFromSlot(index);
          const left = Inventory.putIntoSlot(index, inventoryCursor);
          inventoryCursor = left || old;
        }
      }
      renderInventory();
      updateInventoryCursor(e.clientX, e.clientY);
    });
    btn.addEventListener('mouseenter', e => updateInventoryCursor(e.clientX, e.clientY));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    target.appendChild(btn);
  }

  function renderEquipment() {
    const equipment = Inventory.getEquipment();
    document.querySelectorAll('.equip-slot').forEach(btn => {
      const key = btn.dataset.equip;
      const s = equipment[key];
      const b = btn.querySelector('b');
      if (!s) {
        b.innerHTML = btn.classList.contains('disabled') ? '준비중' : '빈 슬롯';
        return;
      }
      b.innerHTML = `<img src="${Textures.blockIcon(s.id)}" alt="">`;
      b.title = getItemName(s.id);
    });
  }

  function handleEquipment(key) {
    if (!inventoryCursor) {
      const got = Inventory.takeEquipment(key);
      if (got) inventoryCursor = got;
    } else {
      const left = Inventory.putEquipment(key, inventoryCursor);
      inventoryCursor = left || null;
    }
    renderInventory();
    updateInventoryCursor(innerWidth / 2, innerHeight / 2);
  }

  function renderInventory() {
    const grid = $('inventory-grid');
    const hotbar = $('inventory-hotbar-grid');
    if (!grid || !hotbar) return;
    grid.innerHTML = '';
    hotbar.innerHTML = '';
    for (let i = Inventory.HOTBAR_SIZE; i < Inventory.SIZE; i++) renderInventorySlot(i, grid);
    for (let i = 0; i < Inventory.HOTBAR_SIZE; i++) renderInventorySlot(i, hotbar);
    renderEquipment();
  }

  function openInventory() {
    inventoryOpen = true;
    inventoryCursor = null;
    document.querySelectorAll('.equip-slot:not(.disabled)').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        handleEquipment(btn.dataset.equip);
      });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    renderInventory();
    $('overlay-inventory').classList.remove('hidden');
  }

  function closeInventory() {
    inventoryCursorReturn();
    inventoryOpen = false;
    $('overlay-inventory').classList.add('hidden');
  }

  function isInventoryOpen() { return inventoryOpen; }

  function dropSelected(full = false) {
    if (Inventory.isCreative()) return null;
    return Inventory.dropFromSlot(Inventory.getSelected(), full ? null : 1);
  }

  function renderCraftingInventory() {
    const el = $('craft-inventory');
    if (!el) return;
    el.innerHTML = '';
    Inventory.getSlots().forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'craft-inv-slot' + (!s ? ' empty' : '');
      btn.disabled = !s;
      btn.innerHTML = s
        ? `<span class="craft-inv-num">${i + 1}</span><img src="${Textures.blockIcon(s.id)}" alt=""><span class="craft-inv-count">${s.count === Infinity ? '∞' : s.count}</span>`
        : `<span class="craft-inv-num">${i + 1}</span>`;
      btn.title = s ? getItemName(s.id) : '빈 슬롯';
      btn.addEventListener('click', () => {
        if (!s) return;
        if (Crafting.addToFirstEmpty(s.id) >= 0) renderCrafting();
        else showToast('제작 격자가 가득 찼습니다');
      });
      el.appendChild(btn);
    });
  }

  function renderCrafting() {
    const craftGrid = $('craft-grid');
    const output = $('craft-output');
    const recipeList = $('recipe-grid');
    if (!craftGrid || !output || !recipeList) return;

    craftGrid.innerHTML = '';
    Crafting.getGrid().forEach((id, i) => {
      const cell = document.createElement('button');
      cell.className = 'craft-cell' + (id ? ' filled' : '');
      cell.setAttribute('aria-label', id ? getItemName(id) : '빈 제작 칸');
      if (id) {
        cell.innerHTML = `<img src="${Textures.blockIcon(id)}" alt=""><span>${getItemName(id)}</span>`;
        cell.title = '클릭하여 빼기';
        cell.addEventListener('click', () => {
          Crafting.removeCell(i);
          renderCrafting();
        });
      } else {
        cell.innerHTML = '';
        cell.title = '재료를 선택해서 놓기';
      }
      craftGrid.appendChild(cell);
    });

    const match = Crafting.getMatch();
    const ready = !!match && Crafting.canCraftGrid();
    output.disabled = !ready;
    output.className = 'craft-output' + (ready ? ' ready' : '');
    output.innerHTML = match
      ? `<img src="${Textures.blockIcon(match.outputId)}" alt=""><span>${match.name}<b>×${match.count}</b></span>`
      : '<span class="craft-output-empty">?</span>';
    output.title = ready ? '클릭하여 제작' : (match ? '재료가 부족합니다' : '제작법을 맞춰 주세요');
    output.onclick = () => {
      if (!Crafting.craftGrid()) {
        showToast('재료가 부족하거나 제작법이 맞지 않습니다');
        return;
      }
      renderCrafting();
      renderHotbar();
      const made = Crafting.getMatch();
      showToast('제작 완료');
    };

    recipeList.innerHTML = '';
    Crafting.getRecipes().forEach(recipe => {
      const ready = Crafting.canCraft(recipe);
      const card = document.createElement('div');
      card.className = 'recipe-card' + (ready ? ' ready' : '');
      card.innerHTML = `<div class="recipe-icon"><img src="${Textures.blockIcon(recipe.outputId)}" alt=""></div>
        <div><div class="recipe-name">${recipe.name}</div><div class="recipe-ing">${Crafting.summary(recipe)} · ${recipe.note || ''}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = '배치';
      btn.disabled = !ready;
      btn.addEventListener('click', () => {
        Crafting.autofill(recipe.id);
        renderCrafting();
      });
      card.appendChild(btn);
      recipeList.appendChild(card);
    });

    renderCraftingInventory();
    if (inventoryOpen) renderInventory();
  }
  function openCrafting() {
    Crafting.resetGrid();
    renderCrafting();
    $('overlay-crafting').classList.remove('hidden');
  }

  function closeCrafting() {
    $('overlay-crafting').classList.add('hidden');
  }

  function isCraftingOpen() { return !$('overlay-crafting').classList.contains('hidden'); }

  function setMiningProgress(progress) {
    const wrap = $('mine-progress');
    const fill = $('mine-progress-fill');
    if (!wrap || !fill) return;
    const p = Math.max(0, Math.min(1, progress || 0));
    fill.style.transform = `scaleX(${p})`;
    wrap.classList.toggle('show', p > 0);
    wrap.setAttribute('aria-hidden', p > 0 ? 'false' : 'true');
  }

  function setModeLabel(mode) {
    const el = $('mode-badge');
    if (!el) return;
    const survival = mode === GAME_MODE.SURVIVAL;
    el.textContent = survival ? '🛡 서바이벌' : '✦ 크리에이티브';
    el.classList.toggle('survival', survival);
    el.classList.toggle('creative', !survival);
  }

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

  function setStartEnabled(enabled) {
    ['btn-start-survival', 'btn-start-creative', 'start-btn'].forEach(id => {
      const el = $(id);
      if (el) el.disabled = !enabled;
    });
    const status = $('start-status');
    if (status) {
      status.textContent = enabled ? '월드 준비 완료 · 원하는 모드로 시작하세요.' : '월드를 준비하고 있습니다…';
      status.classList.toggle('ready', enabled);
    }
  }

  function flashVignette() {
    const v = $('vignette');
    if (!v) return;
    v.classList.remove('show');
    void v.offsetWidth;
    v.classList.add('show');
    setTimeout(() => v.classList.remove('show'), 120);
  }

  document.addEventListener('mousemove', e => {
    if (inventoryOpen) updateInventoryCursor(e.clientX, e.clientY);
  });

  return {
    renderHotbar, setSelected, showItemName, showOverlay, showToast, setHUD, setTime, setMiningProgress,
    setModeLabel, renderWorlds, renderCrafting, openCrafting, closeCrafting, isCraftingOpen,
    renderInventory, openInventory, closeInventory, isInventoryOpen, dropSelected, updateInventoryCursor,
    updateSurvival, showDeath, hideDeath, openPicker, closePicker, isPickerOpen, setStartEnabled, flashVignette
  };
})();
