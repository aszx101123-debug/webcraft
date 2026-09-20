'use strict';
const UI=(()=>{
const $=id=>document.getElementById(id);
let pickerOpen=false,inventoryOpen=false,inventoryCursor=null,itemNameTimer=null,toastTimer=null,lastSurvivalSig='';
function renderHotbar(){const bar=$('hotbar');bar.innerHTML='';const sel=Inventory.getSelected();Inventory.getSlots().slice(0,Inventory.HOTBAR_SIZE).forEach((s,i)=>{const el=document.createElement('div');el.className='slot'+(i===sel?' sel':'');if(s){const cnt=!Inventory.isCreative()&&s.count!==Infinity?'<span class="cnt">'+s.count+'</span>':'';const td=getToolDef(s.id);const dur=td&&s.durability!=null&&s.count!==Infinity?'<span class="durability" style="position:absolute;left:4px;right:4px;bottom:3px;height:3px;background:#26313a"><i style="display:block;height:100%;width:'+Math.max(0,Math.min(100,s.durability/td.durability*100))+'%;background:#68c96b"></i></span>':'';el.style.position='relative';el.innerHTML='<span class="num">'+(i+1)+'</span><img src="'+Textures.blockIcon(s.id)+'" alt="">'+cnt+dur;el.title=getItemName(s.id);}el.addEventListener('click',()=>setSelected(i));bar.appendChild(el);});if(inventoryOpen)renderInventory();renderHeldItem();}
function renderHeldItem(){
  const el=$('held-item');
  if(!el)return;
  const s=Inventory.selectedSlot();
  if(!s){el.classList.add('hidden');return;}
  el.classList.remove('hidden');
  el.innerHTML='<img src="'+Textures.blockIcon(s.id)+'" alt="">';
}
function setSelected(i){Inventory.setSelected(i);renderHotbar();renderHeldItem();const s=Inventory.selectedSlot();if(s)showItemName(getItemName(s.id));}
function showItemName(name){const el=$('item-name');if(!el)return;el.textContent=name;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(itemNameTimer);itemNameTimer=setTimeout(()=>el.classList.remove('show'),1400);}
function showOverlay(name){['overlay-start','overlay-pause','loading','overlay-death'].forEach(id=>$(id).classList.add('hidden'));if(inventoryOpen&&name!==null)return;if(name==='start')$('overlay-start').classList.remove('hidden');else if(name==='pause')$('overlay-pause').classList.remove('hidden');else if(name==='loading')$('loading').classList.remove('hidden');else if(name==='death')$('overlay-death').classList.remove('hidden');}
function showToast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}
function showMiningProgress(progress,blockName,toolName){
  let el=$('mining-progress');
  if(!el){
    el=document.createElement('div');el.id='mining-progress';
    el.innerHTML='<div class="mining-label"></div><div class="mining-track"><div class="mining-fill"></div></div>';
    const st=document.createElement('style');
    st.textContent='#mining-progress{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:12;min-width:250px;padding:8px 10px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(10,15,20,.82);backdrop-filter:blur(3px);pointer-events:none}.mining-label{font:12px Arial,sans-serif;color:#e8eef5;text-align:center;margin-bottom:6px}.mining-track{height:8px;border-radius:99px;background:#27333e;overflow:hidden}.mining-fill{height:100%;width:0;background:#d9b15d;transition:width .06s linear}';
    document.head.appendChild(st);document.body.appendChild(el);
  }
  $('mining-progress').classList.remove('hidden');
  $('mining-progress').querySelector('.mining-label').textContent=toolName&&toolName!=='손'?blockName+' · '+toolName:blockName+' · 손';
  $('mining-progress').querySelector('.mining-fill').style.width=(Math.max(0,Math.min(1,progress))*100).toFixed(1)+'%';
}
function hideMiningProgress(){const el=$('mining-progress');if(el)el.classList.add('hidden');}
function setHUD(t){$('hud-info').textContent=t;}function setTime(t){$('hud-time').textContent=t;}
function iconRow(el,value,max,icons){el.innerHTML='';for(let i=0;i<max/2;i++){const left=value-i*2,src=left>=2?icons.full:left===1?icons.half:icons.empty,img=document.createElement('img');img.src=src;img.alt='';el.appendChild(img);}}
function updateSurvival(mode,hp,food,air){const el=$('survival-hud');if(mode!==GAME_MODE.SURVIVAL){el.classList.add('hidden');lastSurvivalSig='';return;}el.classList.remove('hidden');const sig=mode+hp+'/'+food+'/'+air;if(sig===lastSurvivalSig)return;lastSurvivalSig=sig;const icons=Textures.hudIcons();iconRow($('hearts'),hp,SURVIVAL.MAX_HP,{full:icons.heart,half:icons.heartHalf,empty:icons.heartEmpty});iconRow($('foods'),food,SURVIVAL.MAX_FOOD,{full:icons.food,half:icons.food,empty:icons.foodEmpty});const airs=$('airs');airs.innerHTML='';if(air<SURVIVAL.MAX_AIR)for(let i=0;i<Math.ceil(air);i++){const img=document.createElement('img');img.src=icons.bubble;img.alt='';airs.appendChild(img);}}
function ensureInventoryUI(){
  if($('inventory-screen'))return;
  const style=document.createElement('style');style.id='inventory-style';
  style.textContent=`
    #inventory-screen{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(4,7,11,.76);backdrop-filter:blur(7px)}
    #inventory-screen.hidden{display:none!important}
    .inventory-panel{width:min(1040px,95vw);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#202b36,#111820);border:2px solid #536272;border-radius:12px;padding:20px;box-shadow:0 30px 100px rgba(0,0,0,.65)}
    .inventory-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .inventory-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}
    .inventory-card,.craft-card{background:rgba(9,14,20,.72);border:1px solid #3a4856;border-radius:10px;padding:14px}
    .inv-title{font-size:12px;color:#9eb1c2;margin-bottom:10px}
    .inventory-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:6px}
    .inventory-slot{aspect-ratio:1;border:2px solid #465564;background:#18222c;border-radius:5px;position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;min-width:40px}
    .inventory-slot:hover{border-color:#b9d0e1;background:#24303c}
    .inventory-slot.hotbar{border-color:#718395}
    .inventory-slot img,.craft-cell img,.craft-out img{width:42px;height:42px;image-rendering:pixelated;pointer-events:none}
    .inventory-slot .stack{position:absolute;right:3px;bottom:2px;font-size:13px;color:#fff;text-shadow:1px 1px #000}
    .inventory-slot .slot-num{position:absolute;left:3px;top:2px;font-size:9px;color:#8ea4b8}
    .craft-grid-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin:10px 0 16px}
    .craft-grid{display:grid;grid-template-columns:repeat(3,58px);gap:5px}
    .craft-grid.size-2{grid-template-columns:repeat(2,58px)}
    .craft-cell{width:58px;height:58px;background:#121a22;border:2px solid #536574;border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;font-size:22px;color:#60758a}
    .craft-cell:hover{border-color:#d8ba72;background:#1b2630}
    .craft-out{width:72px;height:72px;background:#141d26;border:2px solid #7a8c9d;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}
    .craft-out:hover{border-color:#e5c978;box-shadow:0 0 18px rgba(229,201,120,.18)}
    .craft-out.ready{box-shadow:0 0 0 2px rgba(126,200,80,.18),0 0 22px rgba(126,200,80,.14)}
    .craft-cursor{min-height:30px;padding:7px 9px;border-radius:6px;background:#0a1118;border:1px solid #2d3b49;color:#dce7ef;font-size:11px;text-align:center;margin-bottom:10px}
    .craft-help{font-size:11px;line-height:1.6;color:#718597}
    .craft-arrow{font-size:28px;color:#9caebe}
    
  `;
  document.head.appendChild(style);
  const screen=document.createElement('div');screen.id='inventory-screen';screen.className='hidden';
  screen.innerHTML=`
    <div class="inventory-panel">
      <div class="inventory-head">
        <div><h2 id="craft-title">🎒 인벤토리 · 2×2 제작</h2><div class="sub" id="craft-sub">아이템을 클릭한 다음 제작 칸을 클릭해서 직접 넣으세요.</div></div>
        <button class="inventory-close" id="inventory-close">닫기</button>
      </div>
      <div class="inventory-layout">
        <section class="inventory-card">
          <div class="inv-title">인벤토리 36칸 · 위쪽 9칸은 핫바</div>
          <div id="inventory-grid" class="inventory-grid"></div>
          <div class="inventory-tip">제작 칸에 넣은 재료는 제작 전에 모두 돌려받을 수 있습니다.</div>
        </section>
        <section class="craft-card">
          <div class="inv-title" id="craft-size-label">2 × 2 제작창</div>
          <div id="craft-cursor" class="craft-cursor">손에 든 재료: 없음</div>
          <div class="craft-grid-wrap">
            <div id="craft-grid" class="craft-grid size-2"></div>
            <div class="craft-arrow">→</div>
            <div id="craft-out" class="craft-out">?</div>
          </div>
          <div class="craft-help">재료 슬롯을 직접 채우세요. 레시피 모양이 맞으면 결과가 나타납니다.<br>제작대에서는 3×3 전체 칸을 사용할 수 있습니다.</div>
        </section>
      </div>
    </div>`;
  document.body.appendChild(screen);
  $('inventory-close').addEventListener('click',()=>{closeInventory();window.dispatchEvent(new Event('webcraft-inventory-closed'));});
}

function refreshCraftUI(){
  if(!$('craft-grid'))return;
  const size=Crafting.getGridSize();
  const gridEl=$('craft-grid');
  gridEl.className='craft-grid'+(size===2?' size-2':'');
  gridEl.innerHTML='';
  Crafting.getGrid().forEach((id,i)=>{
    const cell=document.createElement('div');cell.className='craft-cell';
    if(id){cell.innerHTML='<img src="'+Textures.blockIcon(id)+'" alt="">';cell.title=getItemName(id);}
    else cell.textContent='+';
    cell.addEventListener('click',()=>handleCraftCell(i));
    gridEl.appendChild(cell);
  });
  $('craft-title').textContent=size===3?'🛠️ 제작대 · 3×3 제작':'🎒 인벤토리 · 2×2 제작';
  $('craft-sub').textContent=size===3?'제작대에서만 3×3 제작법을 사용할 수 있습니다.':'간단한 조합만 가능합니다. 더 복잡한 도구는 제작대가 필요합니다.';
  $('craft-size-label').textContent=size===3?'3 × 3 제작창':'2 × 2 제작창';
  const cursor=document.getElementById('craft-cursor');
  if(cursor)cursor.textContent=craftCursor?('손에 든 재료: '+getItemName(craftCursor.id)+(craftCursor.count>1?' ×'+craftCursor.count:'')):'손에 든 재료: 없음';
  const out=Crafting.getResultRecipe(), outEl=$('craft-out');
  outEl.classList.toggle('ready',!!out);
  outEl.innerHTML=out?'<img src="'+Textures.blockIcon(out.out)+'" alt="">':'<span style="font-size:28px;color:#60758a">?</span>';
  outEl.title=out?out.name:'레시피가 맞지 않습니다';
}

let craftCursor=null;

function handleCraftCell(i){
  if(craftCursor){
    const curId=craftCursor.id;
    const targetId=Crafting.getGrid()[i];
    if(!targetId){
      Crafting.setCell(i,curId);
      craftCursor.count--;
      if(craftCursor.count<=0)craftCursor=null;
    }else if(targetId===curId){
      showToast('이 칸에는 한 개만 넣을 수 있습니다');
    }else{
      const old=targetId;
      Crafting.setCell(i,curId);
      craftCursor.id=old;
      craftCursor.count=1;
    }
  }else{
    const id=Crafting.getGrid()[i];
    if(id){
      Crafting.setCell(i,0);
      const added=Inventory.add(id,1);
      if(added<1) Crafting.setCell(i,id);
    }
  }
  refreshCraftUI();renderInventory();renderHotbar();
}

function collectCraftCursor(){
  if(!craftCursor)return;
  const added=Inventory.add(craftCursor.id,craftCursor.count||1);
  if(added<(craftCursor.count||1)){
    craftCursor.count-=added;
    return false;
  }
  craftCursor=null;
  return true;
}

function closeCraftGrid(){
  for(let i=0;i<Crafting.getGrid().length;i++){
    const id=Crafting.getGrid()[i];
    if(!id)continue;
    const added=Inventory.add(id,1);
    if(added<=0){
      Drops.spawn(id,1,Player.pos.x,Player.pos.y+1.0,Player.pos.z);
      showToast(getItemName(id)+'을(를) 바닥에 떨어뜨렸습니다');
    }
    Crafting.setCell(i,0);
  }
  if(craftCursor){
    const n=craftCursor.count||1;
    const added=Inventory.add(craftCursor.id,n);
    if(added<n){
      const left=n-added;
      Drops.spawn(craftCursor.id,left,Player.pos.x,Player.pos.y+1.0,Player.pos.z);
    }
    craftCursor=null;
  }
  Crafting.setGridSize(2);
  return true;
}

function takeCraftResult(){
  const recipe=Crafting.getResultRecipe();
  if(!recipe)return;
  const preview={id:recipe.out,count:recipe.count};
  if(!Inventory.canAdd(preview.id,preview.count)) { showToast('제작 결과를 넣을 공간이 부족합니다');return; }
  const result=Crafting.takeResult();
  if(!result)return;
  const added=Inventory.add(result.id,result.count);
  if(added<result.count){
    if(added>0)showToast(recipe.name+' 제작 완료');
    else showToast('인벤토리에 공간이 없습니다');
    return;
  }
  showToast(recipe.name+' 제작 완료');
  refreshCraftUI();renderInventory();renderHotbar();
}

function renderInventory(){
  ensureInventoryUI();
  const grid=$('inventory-grid');grid.innerHTML='';
  Inventory.getSlots().forEach((s,i)=>{
    const el=document.createElement('div');el.className='inventory-slot'+(i<Inventory.HOTBAR_SIZE?' hotbar':'');
    if(s){
      const cnt=s.count!==Infinity?'<span class="stack">'+s.count+'</span>':'';
      el.innerHTML='<span class="slot-num">'+(i<Inventory.HOTBAR_SIZE?(i+1):'')+'</span><img src="'+Textures.blockIcon(s.id)+'" alt="">'+cnt;
      if(getToolDef(s.id)&&s.durability!=null&&s.count!==Infinity)el.innerHTML+='<span style="position:absolute;left:3px;right:3px;bottom:2px;height:3px;background:#26313a"><i style="display:block;height:100%;width:'+Math.max(0,Math.min(100,s.durability/getToolDef(s.id).durability*100))+'%;background:#68c96b"></i></span>';
      el.title=getItemName(s.id)+' · 클릭해서 제작 재료 선택';
    }
    el.addEventListener('click',()=>{
      if(craftCursor){
        const added=Inventory.addToSlot(i,craftCursor.id,craftCursor.count,craftCursor.durability);
        if(added>0){craftCursor.count-=added;if(craftCursor.count<=0)craftCursor=null;}
      }else if(s){
        const take=Inventory.takeFromSlot(i,1);
        if(take)craftCursor=take;
      }
      refreshCraftUI();renderInventory();renderHotbar();
    });
    grid.appendChild(el);
  });
}

function openInventory(){
  const h=$('held-item');if(h)h.classList.add('hidden');
  ensureInventoryUI();inventoryCursor=null;inventoryOpen=true;
  Crafting.setGridSize(2);
  $('inventory-screen').classList.remove('hidden');
  renderInventory();refreshCraftUI();showOverlay(null);
}

function openCraftingTable(){
  const h=$('held-item');if(h)h.classList.add('hidden');
  ensureInventoryUI();inventoryCursor=null;inventoryOpen=true;
  Crafting.setGridSize(3);
  $('inventory-screen').classList.remove('hidden');
  renderInventory();refreshCraftUI();showOverlay(null);
}

function closeInventory(){
  if(!inventoryOpen)return;
  closeCraftGrid();
  inventoryOpen=false;inventoryCursor=null;
  $('inventory-screen').classList.add('hidden');renderHeldItem();
}
function isInventoryOpen(){return inventoryOpen;}
function openPicker(onPick){pickerOpen=true;const grid=$('picker-grid');grid.innerHTML='';PLACEABLE_IDS.forEach(id=>{const b=document.createElement('button');b.className='pick';b.innerHTML='<img src="'+Textures.blockIcon(id)+'" alt=""><span>'+BLOCKS[id].name+'</span>';b.addEventListener('click',()=>{closePicker();onPick(id);});grid.appendChild(b);});$('picker').classList.remove('hidden');}
function closePicker(){pickerOpen=false;$('picker').classList.add('hidden');}function isPickerOpen(){return pickerOpen;}
function flashVignette(){const v=$('vignette');if(!v)return;v.classList.remove('show');void v.offsetWidth;v.classList.add('show');setTimeout(()=>v.classList.remove('show'),120);}
return{renderHotbar,setSelected,renderHeldItem,showItemName,showOverlay,showToast,showMiningProgress,hideMiningProgress,setHUD,setTime,updateSurvival,showDeath,hideDeath,openPicker,closePicker,isPickerOpen,openInventory,openCraftingTable,closeInventory,isInventoryOpen,flashVignette};
})();