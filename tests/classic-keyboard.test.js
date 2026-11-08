'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the production listener with observable dependencies, without WebGL.
const source = fs.readFileSync(path.join(__dirname, '..', 'js/game/mobile-test-main.js'), 'utf8');
const start = source.indexOf("  document.addEventListener('keydown', e => {");
const end = source.indexOf("  document.addEventListener('keyup'", start);
assert.ok(start >= 0 && end > start, 'The active keyboard listener must be available');
const listenerSource = source.slice(start, end);

function createGame(options = {}) {
  const calls = Object.create(null);
  const record = name => (...args) => { (calls[name] ||= []).push(args); };
  const dialogs = {
    journal: false, chest: false, crafting: false, furnace: false,
    picker: false, inventory: false, ...options.dialogs
  };
  const state = {
    started: true, locked: true, paused: false, suppressPause: false,
    mode: 'survival', thirdPersonView: 0, ...options.state
  };
  const player = { flying: false, dead: false, pos: { x: 4, y: 30, z: 6 } };
  const classes = new Set();
  let now = options.now ?? 1000;
  let keydown = null;
  const close = name => () => {
    record('close-' + name)();
    if (options.failedClose === name) return false;
    dialogs[name] = false;
    return true;
  };
  const sandbox = {
    state, Player: player, keys: {},
    GAME_MODE: { CREATIVE: 'creative', SURVIVAL: 'survival' },
    isTouch: !!options.isTouch, touchActive: !!options.touchActive,
    pauseBeganAt: options.pauseBeganAt ?? 0, lastSpaceTap: -Infinity,
    performance: { now: () => now },
    document: {
      addEventListener(name, callback) {
        assert.equal(name, 'keydown');
        keydown = callback;
      },
      body: {
        classList: {
          toggle(name) {
            record('toggle-class')(name);
            if (classes.has(name)) classes.delete(name);
            else classes.add(name);
          }
        }
      },
      getElementById: () => ({ classList: { toggle: record('toggle-debug') } }),
      exitPointerLock: record('exit-pointer-lock')
    },
    WorldJournal: { isOpen: () => dialogs.journal, close: close('journal') },
    BlockFurniture: { isChestOpen: () => dialogs.chest, closeChest: close('chest') },
    UI: {
      isCraftingOpen: () => dialogs.crafting,
      isFurnaceOpen: () => dialogs.furnace,
      isPickerOpen: () => dialogs.picker,
      isInventoryOpen: () => dialogs.inventory,
      closeCrafting: close('crafting'), closeFurnace: close('furnace'),
      closePicker: close('picker'), closeInventory: close('inventory'),
      quickSwapHotbar: record('hotbar-swap'),
      openInventory() { record('open-inventory')(); dialogs.inventory = true; return true; },
      showOverlay: record('overlay'), showToast: record('toast'),
      setSelected: record('selected'), renderHotbar: record('hotbar'),
      dropSelected(wholeStack) {
        record('drop-selected')(wholeStack);
        return { id: 3, count: wholeStack ? 17 : 1 };
      }
    },
    Inventory: { swapOffhand() { record('swap-offhand')(); return true; } },
    Drops: { spawn: record('spawn-drop') },
    resumeInput: record('resume'), disableTouchInput: record('disable-touch'),
    doSave: record('save'), blip: record('sound')
  };
  vm.createContext(sandbox);
  vm.runInContext(listenerSource, sandbox, { filename: 'active-game-keyboard.js' });
  assert.equal(typeof keydown, 'function');
  return {
    state, player, dialogs, calls, classes, sandbox,
    count: name => calls[name]?.length || 0,
    setTime(value) { now = value; },
    press(code, eventOptions = {}) {
      const event = {
        code, repeat: false, ctrlKey: false, shiftKey: false, metaKey: false,
        target: { closest: () => null }, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...eventOptions
      };
      keydown(event);
      return event;
    }
  };
}

for (const dialog of ['chest', 'crafting', 'furnace', 'inventory']) {
  test('E closes the ' + dialog + ' GUI without triggering gameplay controls', () => {
    const game = createGame({ dialogs: { [dialog]: true }, state: { locked: false } });
    const event = game.press('KeyE');
    assert.equal(game.count('close-' + dialog), 1);
    assert.equal(game.dialogs[dialog], false);
    assert.equal(game.count('open-inventory'), 0);
    assert.equal(game.count('swap-offhand'), 0);
    assert.equal(event.defaultPrevented, true);
    if (dialog !== 'chest') assert.equal(game.count('resume'), 1);
    // The chest owns its close callback outside this listener.
  });
}

for (const dialog of ['crafting', 'furnace', 'inventory']) {
  test(dialog + ' close failure keeps a full cursor in its GUI and does not resume', () => {
    const game = createGame({
      dialogs: { [dialog]: true }, state: { locked: false }, failedClose: dialog
    });
    game.press('KeyE');
    assert.equal(game.count('close-' + dialog), 1);
    assert.equal(game.dialogs[dialog], true);
    assert.equal(game.count('resume'), 0);
    assert.equal(game.count('open-inventory'), 0);
  });
}

test('holding E does not repeatedly close an open container', () => {
  for (const dialog of ['chest', 'crafting', 'furnace', 'inventory']) {
    const game = createGame({ dialogs: { [dialog]: true } });
    game.press('KeyE', { repeat: true });
    assert.equal(game.count('close-' + dialog), 0, dialog);
    assert.equal(game.count('resume'), 0, dialog);
    assert.equal(game.dialogs[dialog], true, dialog);
  }
});

for (const mode of ['survival', 'creative']) {
  test('F switches hands rather than flight in ' + mode, () => {
    const game = createGame({ state: { mode } });
    const event = game.press('KeyF');
    assert.equal(game.count('swap-offhand'), 1);
    assert.equal(game.count('hotbar'), 1);
    assert.equal(game.player.flying, false);
    assert.equal(event.defaultPrevented, true);
    game.press('KeyF', { repeat: true });
    assert.equal(game.count('swap-offhand'), 1);
  });
}

test('offhand switching cannot run behind an inventory or container GUI', () => {
  for (const dialog of ['chest', 'crafting', 'furnace', 'inventory', 'picker']) {
    const game = createGame({ dialogs: { [dialog]: true } });
    game.press('KeyF');
    assert.equal(game.count('swap-offhand'), 0, dialog);
    assert.equal(game.count('hotbar'), 0, dialog);
  }
});

test('creative flight toggles on two distinct Space presses, not key repeat', () => {
  const game = createGame({ state: { mode: 'creative' } });
  assert.equal(game.press('Space').defaultPrevented, true);
  assert.equal(game.player.flying, false);
  game.setTime(1100);
  game.press('Space', { repeat: true });
  assert.equal(game.player.flying, false);
  game.setTime(1200);
  game.press('Space');
  assert.equal(game.player.flying, true);
  game.setTime(1300);
  game.press('Space');
  assert.equal(game.player.flying, true, 'a new pair requires another second press');
  game.setTime(1400);
  game.press('Space');
  assert.equal(game.player.flying, false);
});

test('slow Space presses and survival double-Space cannot enable flight', () => {
  const creative = createGame({ state: { mode: 'creative' } });
  creative.press('Space');
  creative.setTime(1400);
  creative.press('Space');
  assert.equal(creative.player.flying, false);
  const survival = createGame();
  survival.press('Space');
  survival.setTime(1100);
  survival.press('Space');
  assert.equal(survival.player.flying, false);
});

test('creative double-Space requires active mouse or touch gameplay input', () => {
  const idle = createGame({ state: { mode: 'creative', locked: false } });
  idle.press('Space'); idle.setTime(1100); idle.press('Space');
  assert.equal(idle.player.flying, false);
  const touch = createGame({
    state: { mode: 'creative', locked: false }, isTouch: true, touchActive: true
  });
  touch.press('Space'); touch.setTime(1100); touch.press('Space');
  assert.equal(touch.player.flying, true);
});

test('Ctrl+Q drops a complete stack while Shift+Q drops only one item', () => {
  const game = createGame();
  game.press('KeyQ', { ctrlKey: true });
  game.press('KeyQ', { shiftKey: true });
  assert.deepEqual(game.calls['drop-selected'], [[true], [false]]);
  assert.equal(game.calls['spawn-drop'][0][1], 17);
  assert.equal(game.calls['spawn-drop'][1][1], 1);
  assert.deepEqual(game.calls['spawn-drop'][0].slice(2,5), [4, 30.7, 6]);
  game.press('KeyQ', { ctrlKey: true, repeat: true });
  assert.equal(game.count('drop-selected'), 2);
  assert.equal(game.count('spawn-drop'), 2);
});

test('F1 toggles the clean HUD once per distinct press', () => {
  const game = createGame();
  assert.equal(game.press('F1').defaultPrevented, true);
  assert.equal(game.classes.has('classic-hud-hidden'), true);
  game.press('F1', { repeat: true });
  assert.equal(game.count('toggle-class'), 1);
  game.press('F1');
  assert.equal(game.classes.has('classic-hud-hidden'), false);
  assert.equal(game.count('toggle-class'), 2);
});

test('Escape opens pause and resumes only after the pause debounce expires', () => {
  const game = createGame({ state: { locked: false }, now: 2000 });
  game.press('Escape');
  assert.equal(game.state.paused, true);
  assert.equal(game.sandbox.pauseBeganAt, 2000);
  assert.deepEqual(game.calls.overlay, [['pause']]);
  assert.equal(game.count('disable-touch'), 1);
  assert.equal(game.count('save'), 1);
  game.setTime(2100);
  game.press('Escape');
  assert.equal(game.state.paused, true);
  assert.equal(game.count('resume'), 0);
  game.setTime(2200);
  game.press('Escape', { repeat: true });
  assert.equal(game.count('resume'), 0);
  game.press('Escape');
  assert.equal(game.state.paused, false);
  assert.equal(game.state.suppressPause, true);
  assert.equal(game.count('resume'), 1);
  assert.deepEqual(game.calls.overlay, [['pause'], [null]]);
});

test('typing in inputs, selects and editable text does not fire game controls', () => {
  for (const field of ['input', 'textarea', 'select', '[contenteditable="true"]']) {
    for (const code of ['KeyF', 'KeyE', 'KeyQ', 'Space', 'Digit4', 'F1', 'F5']) {
    const game = createGame({ state: { mode: 'creative' } });
    const event = game.press(code, {
      target: { closest: selector => selector.split(',').some(part => part.trim() === field) ? {} : null }
    });
    const label = field + ' ' + code;
    assert.equal(event.defaultPrevented, false, label);
    assert.equal(game.count('swap-offhand'), 0, label);
    assert.equal(game.count('open-inventory'), 0, label);
    assert.equal(game.count('drop-selected'), 0, label);
    assert.equal(game.count('selected'), 0, label);
    assert.equal(game.count('toggle-class'), 0, label);
    assert.equal(game.player.flying, false, label);
    assert.equal(game.state.thirdPersonView, 0, label);
    assert.equal(Object.keys(game.sandbox.keys).length, 0, label);
    }
  }
});
