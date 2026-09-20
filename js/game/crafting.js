'use strict';

const Crafting = (() => {
  const recipes = [];
  let grid = new Array(9).fill(null);
  let gridSize = 3;

  function activeIndices() {
    return gridSize === 2 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
  }

  function recipeFitsGrid(recipe) {
    if (!recipe) return false;
    if (recipe.shapeless) return recipe.ingredients.reduce((n, i) => n + i.count, 0) <= gridSize * gridSize;
    return recipe.pattern.some(shape => {
      let minX = 3, minY = 3, maxX = -1, maxY = -1;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        if (!shape[y * 3 + x]) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      return maxX >= minX &&
        (maxX - minX + 1) <= gridSize &&
        (maxY - minY + 1) <= gridSize;
    });
  }

  function add(id, name, outputId, count, opts) {
    recipes.push({
      id, name, outputId, count,
      shapeless: !!opts.shapeless,
      ingredients: opts.ingredients || [],
      pattern: opts.pattern || null,
      note: opts.note || ''
    });
  }

  add('planks', '판자 만들기', BLOCK.PLANK, 4, {
    shapeless: true,
    ingredients: [{ id: BLOCK.LOG, count: 1 }],
    note: '통나무 1개 → 판자 4개'
  });
  add('sticks', '막대기 만들기', ITEM.STICK, 4, {
    shapeless: true,
    ingredients: [{ id: BLOCK.PLANK, count: 2 }],
    note: '판자 2개 → 막대기 4개'
  });
  add('crafting-table', '제작대 만들기', BLOCK.CRAFTING_TABLE, 1, {
    shapeless: true,
    ingredients: [{ id: BLOCK.PLANK, count: 4 }],
    note: '판자 4개'
  });

  const tiers = [
    { key: 'wood', name: '나무', material: BLOCK.PLANK, pick: ITEM.WOODEN_PICKAXE, cutter: ITEM.WOODEN_CUTTER, shovel: ITEM.WOODEN_SHOVEL, hoe: ITEM.WOODEN_HOE },
    { key: 'stone', name: '돌', material: BLOCK.COBBLE, pick: ITEM.STONE_PICKAXE, cutter: ITEM.STONE_CUTTER, shovel: ITEM.STONE_SHOVEL, hoe: ITEM.STONE_HOE },
    { key: 'iron', name: '철', material: ITEM.IRON_INGOT, pick: ITEM.IRON_PICKAXE, cutter: ITEM.IRON_CUTTER, shovel: ITEM.IRON_SHOVEL, hoe: ITEM.IRON_HOE },
    { key: 'gold', name: '금', material: ITEM.GOLD_INGOT, pick: ITEM.GOLD_PICKAXE, cutter: ITEM.GOLD_CUTTER, shovel: ITEM.GOLD_SHOVEL, hoe: ITEM.GOLD_HOE },
    { key: 'diamond', name: '다이아몬드', material: ITEM.DIAMOND, pick: ITEM.DIAMOND_PICKAXE, cutter: ITEM.DIAMOND_CUTTER, shovel: ITEM.DIAMOND_SHOVEL, hoe: ITEM.DIAMOND_HOE }
  ];

  const shapes = {
    pick: [
      [1,1,1, 0,2,0, 0,2,0]
    ],
    cutter: [
      [1,1,0, 1,2,0, 0,2,0],
      [0,1,1, 0,2,1, 0,2,0]
    ],
    shovel: [
      [1,0,0, 2,0,0, 2,0,0]
    ],
    hoe: [
      [1,1,0, 0,2,0, 0,2,0]
    ]
  };

  for (const t of tiers) {
    add(t.key + '-pickaxe', t.name + ' 곡괭이', t.pick, 1, {
      pattern: shapes.pick, ingredients: [{ id: t.material, count: 3 }, { id: ITEM.STICK, count: 2 }]
    });
    add(t.key + '-cutter', t.name + ' 벌목기', t.cutter, 1, {
      pattern: shapes.cutter, ingredients: [{ id: t.material, count: 3 }, { id: ITEM.STICK, count: 2 }]
    });
    add(t.key + '-shovel', t.name + ' 삽', t.shovel, 1, {
      pattern: shapes.shovel, ingredients: [{ id: t.material, count: 1 }, { id: ITEM.STICK, count: 2 }]
    });
    add(t.key + '-hoe', t.name + ' 괭이', t.hoe, 1, {
      pattern: shapes.hoe, ingredients: [{ id: t.material, count: 2 }, { id: ITEM.STICK, count: 2 }]
    });
  }

  function getRecipes() { return recipes.slice(); }
  function resetGrid(size = gridSize) {
    gridSize = size === 2 ? 2 : 3;
    grid = new Array(9).fill(null);
  }
  function setGridSize(size) {
    gridSize = size === 2 ? 2 : 3;
    if (gridSize === 2) {
      const keep = new Set(activeIndices());
      for (let i = 0; i < grid.length; i++) if (!keep.has(i)) grid[i] = null;
    }
  }
  function getGridSize() { return gridSize; }
  function getGrid() { return grid.slice(); }
  function getVisibleCells() {
    return activeIndices().map(index => ({ index, id: grid[index] || null }));
  }

  function setCell(index, id) {
    if (index < 0 || index >= 9 || !activeIndices().includes(index)) return false;
    if (!id) grid[index] = null;
    else grid[index] = id;
    return true;
  }

  function addToFirstEmpty(id) {
    if (!id) return -1;
    const i = activeIndices().find(index => !grid[index]);
    if (i === undefined) return -1;
    grid[i] = id;
    return i;
  }

  function removeCell(index) {
    if (index < 0 || index >= 9) return 0;
    if (!activeIndices().includes(index)) return 0;
    const id = grid[index];
    grid[index] = null;
    return id || 0;
  }

  function normalizedPattern(arr) {
    let cells = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const v = arr[y * 3 + x];
      if (v) cells.push([x, y, v]);
    }
    if (!cells.length) return '';
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    return cells
      .map(c => (c[0] - minX) + ',' + (c[1] - minY) + '=' + c[2])
      .sort()
      .join(';');
  }

  function patternForRecipe(recipe, materialId) {
    return recipe.pattern.map(shape =>
      normalizedPattern(shape.map(v => v === 1 ? materialId : v === 2 ? ITEM.STICK : 0))
    );
  }

  function gridSignature() {
    return grid.map(v => v || 0);
  }

  function matchesRecipe(recipe) {
    if (!recipeFitsGrid(recipe)) return false;
    if (recipe.shapeless) {
      const want = [];
      recipe.ingredients.forEach(i => { for (let n = 0; n < i.count; n++) want.push(i.id); });
      const got = activeIndices().map(i => grid[i]).filter(Boolean);
      want.sort((a,b)=>a-b); got.sort((a,b)=>a-b);
      return want.length === got.length && want.every((v,i)=>v===got[i]);
    }
    const materialId = recipe.ingredients.find(i => i.id !== ITEM.STICK)?.id;
    if (!materialId) return false;
    const allowed = patternForRecipe(recipe, materialId);
    const sig = normalizedPattern(grid);
    return allowed.includes(sig);
  }

  function getMatch() {
    return recipes.find(r => matchesRecipe(r)) || null;
  }

  function canCraft(recipe) {
    return !!recipe && recipeFitsGrid(recipe) &&
      recipe.ingredients.every(x => Inventory.countItem(x.id) >= x.count) &&
      Inventory.canAdd(recipe.outputId, recipe.count);
  }

  function canCraftGrid() {
    const recipe = getMatch();
    return !!recipe && canCraft(recipe);
  }

  function consumeIngredients(recipe) {
    for (const ing of recipe.ingredients) {
      if (!Inventory.removeItem(ing.id, ing.count)) return false;
    }
    return true;
  }

  function craftGrid() {
    const recipe = getMatch();
    if (!recipe || !canCraft(recipe)) return false;
    if (!consumeIngredients(recipe)) return false;
    const made = Inventory.add(recipe.outputId, recipe.count);
    if (made < recipe.count) return false;
    resetGrid();
    return true;
  }

  function autofill(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return false;
    resetGrid();
    const materialId = recipe.ingredients.find(i => i.id !== ITEM.STICK)?.id || 0;
    if (recipe.shapeless) {
      let out = [];
      recipe.ingredients.forEach(i => { for (let n = 0; n < i.count; n++) out.push(i.id); });
      out.forEach((id, i) => { grid[i] = id; });
      return true;
    }
    const shape = recipe.pattern[0];
    for (let i = 0; i < 9; i++) {
      const v = shape[i];
      grid[i] = v === 1 ? materialId : v === 2 ? ITEM.STICK : null;
    }
    return true;
  }

  function summary(recipe) {
    return recipe.ingredients.map(x => getItemName(x.id) + ' x' + x.count).join(' + ');
  }

  return {
    getRecipes, getGrid, setCell, addToFirstEmpty, removeCell, resetGrid,
    getMatch, canCraft, canCraftGrid, craftGrid, autofill, summary
  };
})();