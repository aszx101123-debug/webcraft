'use strict';

const Crafting = (() => {
  const recipes = [];

  function r(id, name, outputId, count, ingredients, note = '') {
    recipes.push({ id, name, outputId, count, ingredients, note });
  }

  r('planks', '판자 만들기', BLOCK.PLANK, 4, [{ id: BLOCK.LOG, count: 1 }], '통나무 1개 → 판자 4개');
  r('sticks', '막대기 만들기', ITEM.STICK, 4, [{ id: BLOCK.PLANK, count: 2 }], '판자 2개 → 막대기 4개');
  r('crafting-table', '제작대 만들기', BLOCK.CRAFTING_TABLE, 1, [{ id: BLOCK.PLANK, count: 4 }], '판자 4개');

  const tiers = [
    { key: 'wood', name: '나무', material: BLOCK.PLANK, pick: ITEM.WOODEN_PICKAXE, cutter: ITEM.WOODEN_AXE, shovel: ITEM.WOODEN_SHOVEL, hoe: ITEM.WOODEN_HOE },
    { key: 'stone', name: '돌', material: BLOCK.COBBLE, pick: ITEM.STONE_PICKAXE, cutter: ITEM.STONE_AXE, shovel: ITEM.STONE_SHOVEL, hoe: ITEM.STONE_HOE },
    { key: 'iron', name: '철', material: ITEM.IRON_INGOT, pick: ITEM.IRON_PICKAXE, cutter: ITEM.IRON_AXE, shovel: ITEM.IRON_SHOVEL, hoe: ITEM.IRON_HOE },
    { key: 'gold', name: '금', material: ITEM.GOLD_INGOT, pick: ITEM.GOLD_PICKAXE, cutter: ITEM.GOLD_AXE, shovel: ITEM.GOLD_SHOVEL, hoe: ITEM.GOLD_HOE },
    { key: 'diamond', name: '다이아몬드', material: ITEM.DIAMOND, pick: ITEM.DIAMOND_PICKAXE, cutter: ITEM.DIAMOND_AXE, shovel: ITEM.DIAMOND_SHOVEL, hoe: ITEM.DIAMOND_HOE }
  ];

  for (const t of tiers) {
    r(t.key + '-pickcutter', t.name + ' 곡괭이', t.pick, 1, [
      { id: t.material, count: 3 }, { id: ITEM.STICK, count: 2 }
    ]);
    r(t.key + '-cutter', t.name + ' 벌목기', t.cutter, 1, [
      { id: t.material, count: 3 }, { id: ITEM.STICK, count: 2 }
    ]);
    r(t.key + '-shovel', t.name + ' 삽', t.shovel, 1, [
      { id: t.material, count: 1 }, { id: ITEM.STICK, count: 2 }
    ]);
    r(t.key + '-hoe', t.name + ' 괭이', t.hoe, 1, [
      { id: t.material, count: 2 }, { id: ITEM.STICK, count: 2 }
    ]);
  }

  function getRecipes() { return recipes; }

  function canCraft(recipe) {
    return recipe.ingredients.every(x => Inventory.countItem(x.id) >= x.count);
  }

  function craft(recipeId) {
    const recipe = recipes.find(x => x.id === recipeId);
    if (!recipe || !canCraft(recipe)) return false;
    const removed = [];
    for (const ing of recipe.ingredients) {
      if (!Inventory.removeItem(ing.id, ing.count)) {
        for (const back of removed) Inventory.add(back.id, back.count);
        return false;
      }
      removed.push(ing);
    }
    const made = Inventory.add(recipe.outputId, recipe.count);
    if (made < recipe.count) {
      for (const back of removed) Inventory.add(back.id, back.count);
      return false;
    }
    return true;
  }

  function summary(recipe) {
    return recipe.ingredients.map(x => `${getItemName(x.id)} x${x.count}`).join(' + ');
  }

  return { getRecipes, canCraft, craft, summary };
})();