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
      // Accept one 3x3 shape or multiple variants; armor used to supply a flat array.
      pattern: opts.pattern ? (Array.isArray(opts.pattern[0]) ? opts.pattern : [opts.pattern]) : null,
      note: opts.note || ''
    });
  }

  add('planks', '판자 만들기', BLOCK.PLANK, 4, {
    shapeless: true,
    ingredients: [{ id: BLOCK.LOG, count: 1 }],
    note: '통나무 1개 → 판자 4개'
  });
  add('sticks', '막대기 만들기', ITEM.STICK, 4, {
    pattern: [[1,0,0, 1,0,0, 0,0,0]],
    ingredients: [{ id: BLOCK.PLANK, count: 2 }],
    note: '판자 2개를 세로로 배치'
  });
  add('crafting-table', '제작대 만들기', BLOCK.CRAFTING_TABLE, 1, {
    pattern: [[1,1,0, 1,1,0, 0,0,0]],
    ingredients: [{ id: BLOCK.PLANK, count: 4 }],
    note: '판자 4개를 2×2 정사각형으로'
  });

  // A basic light source for exploring caves.
  add('torches', '횃불 만들기', BLOCK.TORCH, 4, {
    pattern: [[1,0,0, 2,0,0, 0,0,0]],
    ingredients: [{ id: ITEM.COAL, count: 1 }, { id: ITEM.STICK, count: 1 }],
    note: '석탄 위, 막대기 아래 → 횃불 4개'
  });

  // The furnace is crafted on a 3x3 crafting table from eight cobblestone blocks.
  add('furnace', '화로 만들기', BLOCK.FURNACE, 1, {
    pattern: [[1,1,1, 1,0,1, 1,1,1]],
    ingredients: [{ id: BLOCK.COBBLE, count: 8 }],
    note: '제작대 3×3 · 조약돌 8개'
  });

  // New v1.3.2 building and wood recipes (existing 2x2 and 3x3 systems).
  add('birch-planks','자작나무 판자',BLOCK.BIRCH_PLANKS,4,{
    shapeless:true,ingredients:[{id:BLOCK.BIRCH_LOG,count:1}],
    note:'자작나무 원목 1개 → 밝은 판자 4개'
  });
  add('spruce-planks','가문비나무 판자',BLOCK.SPRUCE_PLANKS,4,{
    shapeless:true,ingredients:[{id:BLOCK.SPRUCE_LOG,count:1}],
    note:'가문비나무 원목 1개 → 짙은 판자 4개'
  });
  const square=[1,1,0,1,1,0,0,0,0];
  add('sandstone','사암 만들기',BLOCK.SANDSTONE,1,{
    pattern:[square],ingredients:[{id:BLOCK.SAND,count:4}],note:'모래 4개를 2×2로 배치'
  });
  add('polished-stone','매끄러운 돌',BLOCK.POLISHED_STONE,4,{
    pattern:[square],ingredients:[{id:BLOCK.COBBLE,count:4}],note:'조약돌 4개 → 매끄러운 돌 4개'
  });
  add('stone-bricks','석재 벽돌',BLOCK.STONE_BRICKS,4,{
    pattern:[square],ingredients:[{id:BLOCK.STONE,count:4}],note:'돌 4개 → 석재 벽돌 4개'
  });
  for(const [name,leafId] of [
    ['oak',BLOCK.LEAVES],['birch',BLOCK.BIRCH_LEAVES],['spruce',BLOCK.SPRUCE_LEAVES]
  ]){
    add('mossy-cobble-'+name,'이끼 낀 조약돌',BLOCK.MOSSY_COBBLE,1,{
      shapeless:true,ingredients:[{id:BLOCK.COBBLE,count:1},{id:leafId,count:1}],
      note:'조약돌과 잎 블록 1개씩'
    });
  }
  add('bookshelf','책장',BLOCK.BOOKSHELF,1,{
    pattern:[[1,1,1,2,2,2,1,1,1]],
    ingredients:[{id:BLOCK.PLANK,count:6},{id:ITEM.LEATHER,count:3}],
    note:'판자 6개와 가죽 3개를 사용한 간편 책장 제작'
  });

  // v1.3.3 building parts, in the existing crafting grid.
  add('stone-slab','돌 반 블록',BLOCK.STONE_SLAB,6,{
    pattern:[[1,1,1,0,0,0,0,0,0]],
    ingredients:[{id:BLOCK.COBBLE,count:3}],
    note:'조약돌 3개를 가로로 나란히 → 반 블록 6개'
  });
  add('wood-stairs','나무 계단',BLOCK.WOOD_STAIRS,4,{
    pattern:[[1,0,0,1,1,0,1,1,1]],
    ingredients:[{id:BLOCK.PLANK,count:6}],
    note:'판자를 계단 형태로 6개 배치 → 계단 4개'
  });
  add('wood-door','나무 문',BLOCK.WOOD_DOOR,3,{
    pattern:[[1,1,0,1,1,0,1,1,0]],
    ingredients:[{id:BLOCK.PLANK,count:6}],
    note:'판자 6개를 세로 2열로 배치 → 문 3개'
  });
  add('storage-chest','상자',BLOCK.CHEST,1,{
    pattern:[[1,1,1,1,0,1,1,1,1]],
    ingredients:[{id:BLOCK.PLANK,count:8}],
    note:'판자 8개를 3×3 테두리로 배치 · 18칸 저장'
  });

  const armorTiers=[{key:'leather',name:'가죽',material:ITEM.LEATHER,helmet:ITEM.LEATHER_HELMET,chest:ITEM.LEATHER_CHESTPLATE,legs:ITEM.LEATHER_LEGGINGS,boots:ITEM.LEATHER_BOOTS},{key:'stone',name:'돌',material:BLOCK.COBBLE,helmet:ITEM.STONE_HELMET,chest:ITEM.STONE_CHESTPLATE,legs:ITEM.STONE_LEGGINGS,boots:ITEM.STONE_BOOTS},{key:'iron',name:'철',material:ITEM.IRON_INGOT,helmet:ITEM.IRON_HELMET,chest:ITEM.IRON_CHESTPLATE,legs:ITEM.IRON_LEGGINGS,boots:ITEM.IRON_BOOTS},{key:'gold',name:'금',material:ITEM.GOLD_INGOT,helmet:ITEM.GOLD_HELMET,chest:ITEM.GOLD_CHESTPLATE,legs:ITEM.GOLD_LEGGINGS,boots:ITEM.GOLD_BOOTS},{key:'diamond',name:'다이아몬드',material:ITEM.DIAMOND,helmet:ITEM.DIAMOND_HELMET,chest:ITEM.DIAMOND_CHESTPLATE,legs:ITEM.DIAMOND_LEGGINGS,boots:ITEM.DIAMOND_BOOTS}];const armorShapes={helmet:[1,1,1,1,0,1,0,0,0],chest:[1,0,1,1,1,1,1,1,1],legs:[1,1,1,1,0,1,1,0,1],boots:[0,0,0,1,0,1,1,0,1]};for(const t of armorTiers){add(t.key+'-helmet',t.name+' 투구',t.helmet,1,{pattern:armorShapes.helmet,ingredients:[{id:t.material,count:5}]});add(t.key+'-chest',t.name+' 흉갑',t.chest,1,{pattern:armorShapes.chest,ingredients:[{id:t.material,count:8}]});add(t.key+'-legs',t.name+' 레깅스',t.legs,1,{pattern:armorShapes.legs,ingredients:[{id:t.material,count:7}]});add(t.key+'-boots',t.name+' 부츠',t.boots,1,{pattern:armorShapes.boots,ingredients:[{id:t.material,count:4}]});}
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

  const swords = [
    ['wood', '나무', BLOCK.PLANK, ITEM.WOODEN_SWORD],
    ['stone', '돌', BLOCK.COBBLE, ITEM.STONE_SWORD],
    ['iron', '철', ITEM.IRON_INGOT, ITEM.IRON_SWORD],
    ['gold', '금', ITEM.GOLD_INGOT, ITEM.GOLD_SWORD],
    ['diamond', '다이아몬드', ITEM.DIAMOND, ITEM.DIAMOND_SWORD]
  ];
  for (const [key, name, material, output] of swords) {
    add(key + '-sword', name + ' 검', output, 1, {
      pattern: [[1,0,0, 1,0,0, 2,0,0]],
      ingredients: [{ id: material, count: 2 }, { id: ITEM.STICK, count: 1 }],
      note: '제작대 3×3 · 재료 두 개 위에 막대기'
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

  function patternForRecipe(recipe) {
    const ids = recipe.ingredients.map(i=>i.id);
    return recipe.pattern.map(shape =>
      normalizedPattern(shape.map(v => v > 0 ? (ids[v-1] || 0) : 0))
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
    const allowed = patternForRecipe(recipe);
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

  function canTakeGridResult(){
    const r=getMatch();
    if(!r)return false;
    const m=new Map();
    activeIndices().forEach(i=>{const id=grid[i];if(id)m.set(id,(m.get(id)||0)+1)});
    return r.ingredients.every(x=>(m.get(x.id)||0)>=x.count);
  }
  function canCraftGrid(){
    const r=getMatch();
    return !!r && canTakeGridResult() && Inventory.canAdd(r.outputId,r.count);
  }
  // Personal 2x2 output follows the mouse cursor, not a forced inventory slot.
  function takeGridResult(){
    const recipe=getMatch();
    if(!recipe || !canTakeGridResult())return null;
    const item={id:recipe.outputId,count:recipe.count};
    const def=getItemDef(item.id);
    if(def?.toolType || def?.armorType)item.durability=def.maxDurability||1;
    resetGrid();
    if(typeof WorldMilestones!=='undefined')
      WorldMilestones.record('craft',recipe.outputId,Inventory.isCreative()?'creative':'survival');
    return item;
  }

  function consumeIngredients(recipe) {
    for (const ing of recipe.ingredients) {
      if (!Inventory.removeItem(ing.id, ing.count)) return false;
    }
    return true;
  }

  function craftGrid() {
    const recipe = getMatch();
    if (!recipe || !canCraftGrid()) return false;
    // Source cells are an escrow: commit output first, consume cells only on success.
    const made = Inventory.add(recipe.outputId, recipe.count);
    if (made !== recipe.count) return false;
    resetGrid();
    if(typeof WorldMilestones!=='undefined')
      WorldMilestones.record('craft',recipe.outputId,Inventory.isCreative()?'creative':'survival');
    return true;
  }

  function autofill(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe || !recipeFitsGrid(recipe)) return false;
    // Never clear a player's existing crafting materials when autofill is unaffordable.
    if (activeIndices().some(i => grid[i])) return false;
    if (!recipe.ingredients.every(i => Inventory.countItem(i.id) >= i.count)) return false;
    const removed = [];
    for (const ing of recipe.ingredients) {
      if (!Inventory.removeItem(ing.id, ing.count)) {
        for (const refund of removed) Inventory.add(refund.id, refund.count);
        return false;
      }
      removed.push(ing);
    }
    resetGrid(gridSize);
    if (recipe.shapeless) {
      let out = [];
      recipe.ingredients.forEach(i => { for (let n = 0; n < i.count; n++) out.push(i.id); });
      out.forEach((id, i) => { grid[activeIndices()[i]] = id; });
      return true;
    }
    const shape = recipe.pattern.find(p=>{
      if(gridSize===3)return true;
      const occupied=p.map((v,i)=>v?i:-1).filter(i=>i>=0);
      if(!occupied.length)return false;
      const xs=occupied.map(i=>i%3),ys=occupied.map(i=>Math.floor(i/3));
      return Math.max(...xs)-Math.min(...xs)<2 && Math.max(...ys)-Math.min(...ys)<2;
    });
    if(!shape){
      for(const refund of removed)Inventory.add(refund.id,refund.count);
      return false;
    }
    const ids = recipe.ingredients.map(x=>x.id);
    const occupied=shape.map((v,i)=>v?i:-1).filter(i=>i>=0);
    const dx=gridSize===2?Math.min(...occupied.map(i=>i%3)):0;
    const dy=gridSize===2?Math.min(...occupied.map(i=>Math.floor(i/3))):0;
    for(let i=0;i<9;i++){
      if(!shape[i])continue;
      const nx=(i%3)-dx,ny=Math.floor(i/3)-dy;
      grid[ny*3+nx]=ids[shape[i]-1]||null;
    }
    return true;
  }

  function summary(recipe) {
    return recipe.ingredients.map(x => getItemName(x.id) + ' x' + x.count).join(' + ');
  }

  return {
    getRecipes, getGrid, getVisibleCells, getGridSize, setGridSize,
    setCell, addToFirstEmpty, removeCell, resetGrid,
    getMatch, canCraft, canCraftGrid, canTakeGridResult, takeGridResult,
    craftGrid, autofill, summary, recipeFitsGrid
  };
})();