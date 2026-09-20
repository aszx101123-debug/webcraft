'use strict';

/*
 * WebCraft no-UI mode.
 * The game engine keeps this tiny compatibility layer so gameplay code can
 * run without a HUD, inventory screen, overlays, or other in-game UI.
 */
const UI = (() => {
  let inventoryOpen = false;

  return {
    renderHotbar() {},
    renderHeldItem() {},
    setSelected(i) {
      if (typeof Inventory !== 'undefined' && Inventory.setSelected) Inventory.setSelected(i);
    },
    showItemName() {},
    showOverlay() {},
    showToast() {},
    showMiningProgress() {},
    hideMiningProgress() {},
    setHUD() {},
    setTime() {},
    updateXP() {},
    updateSurvival() {},
    flashVignette() {},
    showDeath() {},
    hideDeath() {},
    openInventory() { inventoryOpen = true; },
    closeInventory() { inventoryOpen = false; },
    isInventoryOpen() { return inventoryOpen; },
    openPicker() {},
    closePicker() {},
    openCraftingTable() {},
    closeCraftingTable() {},
  };
})();
