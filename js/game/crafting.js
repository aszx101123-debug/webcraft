'use strict';

const Crafting = (() => {
  const RECIPES = [
    {id:'planks',name:'판자 ×4',out:BLOCK.PLANK,count:4,pattern:[[BLOCK.LOG]]},
    {id:'sticks',name:'막대기 ×4',out:ITEM.STICK,count:4,pattern:[[BLOCK.PLANK],[BLOCK.PLANK]]},
    {id:'table',name:'제작대',out:BLOCK.CRAFTING_TABLE,count:1,pattern:[[BLOCK.PLANK,BLOCK.PLANK],[BLOCK.PLANK,BLOCK.PLANK]]},
    {id:'bed',name:'침대',out:BLOCK.BED,count:1,pattern:[[ITEM.WOOL,ITEM.WOOL,ITEM.WOOL],[BLOCK.PLANK,BLOCK.PLANK,BLOCK.PLANK]],table:true},
    {id:'torch',name:'횃불 ×4',out:BLOCK.TORCH,count:4,pattern:[[ITEM.COAL],[ITEM.STICK]]},
    {id:'furnace',name:'화로',out:BLOCK.FURNACE,count:1,pattern:[[BLOCK.COBBLE,BLOCK.COBBLE,BLOCK.COBBLE],[BLOCK.COBBLE,0,BLOCK.COBBLE],[BLOCK.COBBLE,BLOCK.COBBLE,BLOCK.COBBLE]],table:true},
    {id:'wood_pickaxe',name:'나무 곡괭이',out:ITEM.WOOD_PICKAXE,count:1,pattern:[[BLOCK.PLANK,BLOCK.PLANK,BLOCK.PLANK],[0,ITEM.STICK,0],[0,ITEM.STICK,0]],table:true},
    {id:'stone_pickaxe',name:'돌 곡괭이',out:ITEM.STONE_PICKAXE,count:1,pattern:[[BLOCK.COBBLE,BLOCK.COBBLE,BLOCK.COBBLE],[0,ITEM.STICK,0],[0,ITEM.STICK,0]],table:true},
    {id:'iron_pickaxe',name:'철 곡괭이',out:ITEM.IRON_PICKAXE,count:1,pattern:[[ITEM.RAW_IRON,ITEM.RAW_IRON,ITEM.RAW_IRON],[0,ITEM.STICK,0],[0,ITEM.STICK,0]],table:true},
    {id:'diamond_pickaxe',name:'다이아몬드 곡괭이',out:ITEM.DIAMOND_PICKAXE,count:1,pattern:[[ITEM.DIAMOND,ITEM.DIAMOND,ITEM.DIAMOND],[0,ITEM.STICK,0],[0,ITEM.STICK,0]],table:true},
    {id:'wood_axe',name:'나무 도끼',out:ITEM.WOOD_AXE,count:1,pattern:[[BLOCK.PLANK,BLOCK.PLANK],[BLOCK.PLANK,ITEM.STICK],[0,ITEM.STICK]],table:true},
    {id:'stone_axe',name:'돌 도끼',out:ITEM.STONE_AXE,count:1,pattern:[[BLOCK.COBBLE,BLOCK.COBBLE],[BLOCK.COBBLE,ITEM.STICK],[0,ITEM.STICK]],table:true},
    {id:'diamond_axe',name:'다이아몬드 도끼',out:ITEM.DIAMOND_AXE,count:1,pattern:[[ITEM.DIAMOND,ITEM.DIAMOND],[ITEM.DIAMOND,ITEM.STICK],[0,ITEM.STICK]],table:true},
    {id:'wood_shovel',name:'나무 삽',out:ITEM.WOOD_SHOVEL,count:1,pattern:[[BLOCK.PLANK],[ITEM.STICK],[ITEM.STICK]],table:true},
    {id:'stone_shovel',name:'돌 삽',out:ITEM.STONE_SHOVEL,count:1,pattern:[[BLOCK.COBBLE],[ITEM.STICK],[ITEM.STICK]],table:true},
    {id:'diamond_shovel',name:'다이아몬드 삽',out:ITEM.DIAMOND_SHOVEL,count:1,pattern:[[ITEM.DIAMOND],[ITEM.STICK],[ITEM.STICK]],table:true},
    {id:'diamond_sword',name:'다이아몬드 검',out:ITEM.DIAMOND_SWORD,count:1,pattern:[[ITEM.DIAMOND],[ITEM.DIAMOND],[ITEM.STICK]],table:true},
    {id:'brick',name:'벽돌 ×4',out:BLOCK.BRICK,count:4,pattern:[[BLOCK.STONE,BLOCK.STONE],[BLOCK.STONE,BLOCK.STONE]]}
  ];

  let gridSize = 2;
  let grid = [];
  let result = null;
  let resultRecipe = null;

  const emptyGrid = size => Array.from({length:size*size},()=>0);
  const key = (a,b) => a.join(',')===b.join(',');

  function setGridSize(size){gridSize=size;grid=emptyGrid(size);result=null;resultRecipe=null;updateResult();}
  function getGridSize(){return gridSize;}
  function getGrid(){return grid;}
  function getResult(){return result;}
  function getResultRecipe(){return resultRecipe;}

  function matches(pattern){
    const ph=pattern.length,pw=pattern[0].length;
    if(ph>gridSize||pw>gridSize)return false;
    const p=pattern.flat();
    for(let oy=0;oy<=gridSize-ph;oy++)for(let ox=0;ox<=gridSize-pw;ox++){
      let ok=true;
      for(let y=0;y<gridSize;y++)for(let x=0;x<gridSize;x++){
        const want=(x>=ox&&x<ox+pw&&y>=oy&&y<oy+ph)?pattern[y-oy][x-ox]:0;
        if(grid[y*gridSize+x]!==want){ok=false;break;}
      }
      if(ok)return true;
    }
    return false;
  }

  function updateResult(){
    result=null;resultRecipe=null;
    for(const r of RECIPES){
      if(!!r.table !== (gridSize===3)) continue;
      if(matches(r.pattern)){result=r.out;resultRecipe=r;break;}
    }
  }

  function setCell(i,id){if(i<0||i>=grid.length)return false;grid[i]=id||0;updateResult();return true;}
  function clear(){grid.fill(0);updateResult();}

  function takeResult(){
    if(!resultRecipe)return null;
    const out={id:resultRecipe.out,count:resultRecipe.count};
    const pattern=resultRecipe.pattern;
    const ph=pattern.length,pw=pattern[0].length;
    let offX=0,offY=0;
    const gh=gridSize,gw=gridSize;
    outer:for(let oy=0;oy<=gh-ph;oy++)for(let ox=0;ox<=gw-pw;ox++){
      let ok=true;for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
        const want=(x>=ox&&x<ox+pw&&y>=oy&&y<oy+ph)?pattern[y-oy][x-ox]:0;
        if(grid[y*gw+x]!==want){ok=false;break;}
      }
      if(ok){offX=ox;offY=oy;break outer;}
    }
    for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)if(pattern[y][x])grid[(offY+y)*gw+offX+x]=0;
    updateResult();
    return out;
  }

  return {recipes:()=>RECIPES.slice(),setGridSize,getGridSize,getGrid,getResult,getResultRecipe,setCell,clear,updateResult,takeResult};
})();