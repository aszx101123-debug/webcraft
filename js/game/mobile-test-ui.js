'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  let pickerOpen = false;
  let itemNameTimer = null;
  let lastSurvivalSig = '';
  let currentWorldId = null;
  let inventoryOpen = false;
  let inventoryCursor = null;
  let selectedInventoryMaterial = null;
  const stackLimit=id=>{const d=getItemDef(id);return d?.toolType||d?.armorType?1:(d?.maxStack||Inventory.MAX_STACK||64);};
  let selectedCraftingMaterial = null;
  let previewFromBack = false;
  let characterControlsBound = false;

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
    const hint=getItemDef(Inventory.selectedId())?.useHint;
    el.textContent = name+(hint?'\n'+hint:'');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(itemNameTimer);
    itemNameTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function showOverlay(name) {
    // Close related UI through its normal path so crafting escrow is never silently lost.
    if (name !== 'inventory' && inventoryOpen && !closeInventory()) return false;
    if (name !== 'crafting' && isCraftingOpen() && !closeCrafting()) return false;
    if (name !== 'furnace' && isFurnaceOpen() && !closeFurnace()) return false;
    ['overlay-start', 'overlay-pause', 'overlay-death', 'overlay-inventory', 'overlay-crafting', 'overlay-furnace'].forEach(id => $(id)?.classList.add('hidden'));
    if (name === 'start') $('overlay-start').classList.remove('hidden');
    else if (name === 'pause') $('overlay-pause').classList.remove('hidden');
    else if (name === 'death') $('overlay-death').classList.remove('hidden');
    return true;
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

  let hoveredInventorySlot=null;
  let mobileSplitMode=false;
  let recipeBookBound=false;
  const selectedRecipe={inventory:null,table:null};

  function clickInventorySlot(index,right=false,shift=false,double=false,clientX=0,clientY=0){
    if(!inventoryOpen)return false;
    const src=Inventory.getSlots()[index];
    if(shift && !inventoryCursor){
      const moved=Inventory.quickMove(index);
      if(!moved)showToast('이동할 공간이 없습니다');
      renderInventory();
      return moved;
    }
    if(double && inventoryCursor && !getToolDef(inventoryCursor.id) &&
       !getArmorDef(inventoryCursor.id) && inventoryCursor.count!==Infinity){
      const max=stackLimit(inventoryCursor.id);
      for(let i=0;i<Inventory.SIZE && inventoryCursor.count<max;i++){
        const stack=Inventory.getSlots()[i];
        if(!stack||stack.id!==inventoryCursor.id||stack.count===Infinity)continue;
        const taken=Inventory.takeFromSlot(i,max-inventoryCursor.count);
        if(taken)inventoryCursor.count+=taken.count;
      }
    }else if(right){
      if(!inventoryCursor){
        if(!src)return false;
        const gear=!!(getToolDef(src.id)||getArmorDef(src.id));
        inventoryCursor=Inventory.takeFromSlot(index,gear?1:Math.ceil(src.count/2));
      }else{
        if(getToolDef(inventoryCursor.id)||getArmorDef(inventoryCursor.id)){
          if(!src)inventoryCursor=Inventory.swapWithSlot(index,inventoryCursor);
        }else if(!src || (src.id===inventoryCursor.id && src.count<stackLimit(inventoryCursor.id))){
          const one={id:inventoryCursor.id,count:1};
          if(!Inventory.putIntoSlot(index,one)){
            inventoryCursor.count--;
            if(inventoryCursor.count<=0)inventoryCursor=null;
          }
        }
      }
    }else inventoryCursor=Inventory.swapWithSlot(index,inventoryCursor);
    renderInventory();
    updateInventoryCursor(clientX,clientY);
    return true;
  }

  function quickSwapHotbar(hotbarIndex){
    if(!inventoryOpen || inventoryCursor || hoveredInventorySlot===null || hotbarIndex<0 || hotbarIndex>=9)return false;
    if(Inventory.swapSlots(hoveredInventorySlot,hotbarIndex)){
      renderInventory();renderHotbar();
      return true;
    }
    return false;
  }

  function renderInventorySlot(index,target) {
    const s=Inventory.getSlots()[index];
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='inventory-slot'+(!s?' empty':'')+
      (index<Inventory.HOTBAR_SIZE?' inventory-hotbar-slot':'')+
      (index===Inventory.getSelected()?' java-selected-hotbar':'')+
      (selectedInventoryMaterial===index?' material-selected':'')+
      (hoveredInventorySlot===index?' java-hovered':'');
    btn.dataset.slot=String(index);
    btn.setAttribute('aria-label',s?getItemName(s.id)+' '+stackLabel(s)+'개, '+(index+1)+'번 칸':'빈 '+(index+1)+'번 칸');
    btn.innerHTML='<span class="inv-num">'+(index<Inventory.HOTBAR_SIZE?index+1:index-Inventory.HOTBAR_SIZE+1)+'</span>';
    if(s){
      const td=getToolDef(s.id);
      const dur=td&&s.durability
        ? '<span class="inv-dur"><i style="transform:scaleX('+Math.max(0,Math.min(1,s.durability/td.maxDurability))+')"></i></span>':'';
      btn.innerHTML+='<img src="'+Textures.blockIcon(s.id)+'" alt=""><span class="inv-count">'+
        (s.count===1?'':stackLabel(s))+'</span>'+dur;
      btn.title=getItemName(s.id)+(td?' · 내구도 '+s.durability+'/'+td.maxDurability:'');
    }else btn.title='빈 칸';
    btn.addEventListener('mousedown',e=>{
      if(document.body.classList.contains('touch-device'))return;
      if(e.button!==0 && e.button!==2)return;
      e.preventDefault();e.stopPropagation();
      clickInventorySlot(index,e.button===2,e.shiftKey,e.detail>=2,e.clientX,e.clientY);
    });
    btn.addEventListener('click',e=>{
      if(!document.body.classList.contains('touch-device'))return;
      e.preventDefault();e.stopPropagation();
      clickInventorySlot(index,mobileSplitMode,false,false,e.clientX,e.clientY);
    });
    btn.addEventListener('mouseenter',e=>{
      hoveredInventorySlot=index;
      updateInventoryCursor(e.clientX,e.clientY);
    });
    btn.addEventListener('mouseleave',()=>{
      if(hoveredInventorySlot===index)hoveredInventorySlot=null;
    });
    btn.addEventListener('contextmenu',e=>e.preventDefault());
    target.appendChild(btn);
  }

  function renderEquipment(){
    const equipment=Inventory.getEquipment();
    document.querySelectorAll('.equip-slot').forEach(btn=>{
      const key=btn.dataset.equip,s=equipment[key],b=btn.querySelector('b');
      if(!b)return;
      if(!s){
        b.replaceChildren();
        btn.title=btn.querySelector('span')?.textContent||'빈 장비 슬롯';
        btn.setAttribute('aria-label',btn.title+' · 비어 있음');
        return;
      }
      const img=document.createElement('img');
      img.src=Textures.blockIcon(s.id);
      img.alt='';
      b.replaceChildren(img);
      btn.title=getItemName(s.id)+(s.durability?' · 내구도 '+s.durability:'');
      btn.setAttribute('aria-label',btn.title+' · '+key+' 장비 슬롯');
    });
  }

  function handleEquipment(key,right=false){
    if(!inventoryOpen)return;
    const current=Inventory.getEquipment()[key];
    if(right && inventoryCursor && (!current || (current.id===inventoryCursor.id && !getToolDef(current.id) && !getArmorDef(current.id)))){
      const one={...inventoryCursor,count:1};
      const left=Inventory.putEquipment(key,one);
      if(!left){
        inventoryCursor.count--;
        if(inventoryCursor.count<=0)inventoryCursor=null;
      }
    }else if(right && !inventoryCursor && current && !getToolDef(current.id) &&
      !getArmorDef(current.id) && current.count>1){
      const removed=Inventory.takeEquipment(key);
      const half=Math.ceil(removed.count/2);
      inventoryCursor={...removed,count:half};
      Inventory.putEquipment(key,{...removed,count:removed.count-half});
    }else{
      const previous=inventoryCursor;
      inventoryCursor=Inventory.swapEquipmentWithCursor(key,inventoryCursor);
      if(previous===inventoryCursor && previous)showToast('장비 종류가 맞지 않습니다');
    }
    renderInventory();
    updateInventoryCursor(innerWidth/2,innerHeight/2);
  }

  const characterFields = [
    ['skin', '피부 색상'], ['hair', '머리 색상'], ['hairStyle', '헤어스타일'],
    ['eyes', '눈 색상'], ['shirt', '상의'], ['shirtStyle', '옷 디테일'],
    ['pants', '바지'], ['boots', '신발'], ['accessory', '액세서리']
  ];
  function updateCharacterPreview() {
    const canvas = $('character-preview');
    if (!canvas) return;
    PlayerModel.drawPreview(canvas, previewFromBack);
    const item = $('character-held-icon');
    if (item) {
      const id = Inventory.selectedId();
      item.classList.toggle('hidden', !id);
      if (id) {
        item.src = Textures.blockIcon(id);
        item.alt = '현재 손에 든 ' + getItemName(id);
      } else item.removeAttribute('src');
    }
  }
  function initializeCharacterEditor() {
    const rotate = $('character-rotate');
    const reset = $('character-reset');
    if (characterControlsBound || !rotate || !reset) return;
    characterControlsBound = true;
    rotate.addEventListener('click', () => {
      previewFromBack = !previewFromBack;
      rotate.textContent = previewFromBack ? '앞에서 보기' : '뒤에서 보기';
      updateCharacterPreview();
    });
    reset.addEventListener('click', () => {
      PlayerModel.setAppearance(null);
      renderCharacterEditor();
      document.dispatchEvent(new Event('webcraft-appearance-changed'));
      showToast('기본 캐릭터 스타일을 적용했습니다');
    });
  }
  function renderCharacterEditor() {
    const controls = $('character-options');
    if (!controls) return;
    initializeCharacterEditor();
    const palette = PlayerModel.getPalettes();
    const appearance = PlayerModel.getAppearance();
    controls.innerHTML = '';
    for (const [field, label] of characterFields) {
      const row = document.createElement('div');
      row.className = 'character-option-row';
      const caption = document.createElement('span');
      caption.className = 'character-option-label';
      caption.textContent = label;
      const buttons = document.createElement('div');
      const stringChoices = typeof palette[field][0].value === 'string';
      buttons.className = stringChoices ? 'character-hair-options' : 'character-swatches';
      palette[field].forEach((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = stringChoices ? 'character-hair-button' : 'character-swatch';
        const selected = appearance[field] === (stringChoices ? choice.value : index);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', label + ': ' + choice.label);
        button.title = choice.label;
        if (stringChoices) button.textContent = choice.label;
        else button.style.backgroundColor = '#' + choice.value.toString(16).padStart(6, '0');
        button.addEventListener('click', () => {
          PlayerModel.setAppearance({
            ...PlayerModel.getAppearance(),
            [field]: stringChoices ? choice.value : index
          });
          renderCharacterEditor();
          document.dispatchEvent(new Event('webcraft-appearance-changed'));
          showToast(choice.label + ' 스타일 적용');
        });
        buttons.appendChild(button);
      });
      row.append(caption, buttons);
      controls.appendChild(row);
    }
    updateCharacterPreview();
  }

  function renderCreativeCatalog(){
    const panel=$('inventory-creative-panel'),list=$('inventory-creative-grid');
    if(!panel||!list || panel.classList.contains('hidden') || !Inventory.isCreative())return;
    const needle=($('inventory-creative-search')?.value||'').trim().toLocaleLowerCase('ko-KR');
    list.replaceChildren();
    const ids=[...new Set([...PLACEABLE_IDS,...Object.keys(ITEMS).map(Number)])]
      .filter(id=>getItemDef(id)&&(!needle||getItemName(id).toLocaleLowerCase('ko-KR').includes(needle)));
    for(const id of ids){
      const def=getItemDef(id);
      const btn=document.createElement('button');
      btn.type='button';btn.className='java-creative-item';
      btn.title=getItemName(id)+(def.useHint?' · '+def.useHint:'');
      const img=document.createElement('img');img.src=Textures.blockIcon(id);img.alt='';
      const name=document.createElement('small');name.textContent=getItemName(id);
      btn.append(img,name);
      btn.addEventListener('click',()=>{
        if(inventoryCursor){
          showToast('손에 든 아이템을 먼저 빈 슬롯에 내려놓으세요');
          return;
        }
        const gear=!!(def.toolType||def.armorType);
        inventoryCursor={id,count:stackLimit(id)};
        if(gear)inventoryCursor.durability=def.maxDurability||1;
        renderInventory();
        updateInventoryCursor(innerWidth/2,innerHeight/2);
      });
      list.appendChild(btn);
    }
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
    renderInventoryCrafting();
    renderInventoryRecipes();
    renderCreativeCatalog();
    updateCharacterPreview();
    const hand=$('java-mainhand-display');
    if(hand)hand.innerHTML=Inventory.selectedId()
      ? '<img src="'+Textures.blockIcon(Inventory.selectedId())+'" alt="">':'<span>비어 있음</span>';
    const split=$('inventory-touch-split');
    if(split){
      split.setAttribute('aria-pressed',String(mobileSplitMode));
      split.textContent='한 개씩 놓기: '+(mobileSplitMode?'켬':'끔');
    }
    const held=$('inventory-held-readout');
    if(held)held.textContent=inventoryCursor
      ? '들고 있음: '+getItemName(inventoryCursor.id)+' ×'+stackLabel(inventoryCursor)
      : '커서: 비어 있음';
  }

  function returnCraftingMaterials() {
    let complete = true;
    for (const cell of Crafting.getVisibleCells()) {
      if (!cell.id) continue;
      if (Inventory.add(cell.id, 1) === 1) Crafting.removeCell(cell.index);
      else complete = false;
    }
    return complete;
  }

  function recipeNode(tag,className,text) {
    const node=document.createElement(tag);node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function recipeIcon(id) {
    const icon=recipeNode('img','recipe-item-icon');icon.src=Textures.blockIcon(id);icon.alt='';return icon;
  }
  function recipeIds(context) {
    return context==='inventory'
      ? {list:'inventory-recipe-list',search:'inventory-recipe-search',filter:'inventory-recipe-filter',detail:'inventory-recipe-detail',count:'inventory-recipe-count'}
      : {list:'recipe-grid',search:'recipe-search',filter:'recipe-filter',detail:'recipe-detail',count:'recipe-count'};
  }
  function bindRecipeBook(context) {
    const ids=recipeIds(context),search=$(ids.search),filter=$(ids.filter);
    if(search)search.oninput=()=>{selectedRecipe[context]=null;renderRecipeBook(context);};
    if(filter)filter.onclick=()=>{
      filter.setAttribute('aria-pressed',String(filter.getAttribute('aria-pressed')!=='true'));
      selectedRecipe[context]=null;renderRecipeBook(context);
    };
  }
  function refreshCraftingView(context) {
    if(context==='inventory')renderInventory();else renderCrafting();
    renderHotbar();updateInventoryCursor(innerWidth/2,innerHeight/2);
  }
  function quickCraft(context,id,amount=1) {
    const made=Crafting.craftRecipe(id,amount,inventoryCursor);
    if(!made.success){
      showToast(made.reason==='materials'?'제작 재료가 부족합니다':made.reason==='station'?'이 제작법은 제작대가 필요합니다':'완성품을 넣을 가방 공간이 부족합니다');
      renderRecipeBook(context);return;
    }
    inventoryCursor=made.cursor;
    refreshCraftingView(context);
    showToast(getItemName(made.id)+' ×'+made.count+' 제작 · 가방에 넣었습니다');
  }
  function renderRecipeBook(context) {
    const ids=recipeIds(context),list=$(ids.list),detail=$(ids.detail);
    if(!list||!detail)return;
    const active=document.activeElement;
    const keepFocus=list.contains?.(active)||detail.contains?.(active);
    const focusRecipe=keepFocus?active?.dataset?.recipeId:null;
    const focusAction=keepFocus?['quick-craft-one','quick-craft-all','recipe-arrange'].find(name=>active?.classList?.contains(name)):null;
    let focusTarget=null;
    const scroll=list.scrollTop;
    const normalize=text=>text.toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
    const needle=normalize(($(ids.search)?.value||'').trim());
    const onlyReady=$(ids.filter)?.getAttribute('aria-pressed')==='true';
    const entries=Crafting.getRecipes().filter(r=>Crafting.recipeFitsGrid(r)&&(!needle||normalize(r.name+' '+Crafting.summary(r)).includes(needle)))
      .map(recipe=>({recipe,state:Crafting.getRecipeState(recipe,inventoryCursor)}));
    const visible=entries.filter(({state})=>!onlyReady||state.maxBatches>0)
      .sort((a,b)=>Number(b.state.maxBatches>0)-Number(a.state.maxBatches>0));
    if(!selectedRecipe[context])selectedRecipe[context]=visible[0]?.recipe.id||null;
    const chosen=entries.find(entry=>entry.recipe.id===selectedRecipe[context]);
    list.replaceChildren();
    for(const {recipe,state} of visible){
      const choice=recipeNode('button','recipe-choice'+(state.maxBatches?' ready':' unavailable'));
      choice.type='button';choice.dataset.recipeId=recipe.id;
      if(recipe.id===focusRecipe)focusTarget=choice;
      choice.setAttribute('aria-pressed',String(chosen?.recipe.id===recipe.id));
      choice.setAttribute('aria-label',recipe.name+' · '+Crafting.summary(recipe));
      choice.title=recipe.note||Crafting.summary(recipe);
      const label=recipeNode('span','recipe-choice-label');
      label.append(recipeNode('strong','',getItemName(recipe.outputId)),recipeNode('small','',
        '×'+recipe.count+' · '+(state.maxBatches?'제작 가능':state.reason==='space'?'가방 공간 부족':'재료 부족')));
      choice.append(recipeIcon(recipe.outputId),label);
      choice.addEventListener('click',()=>{selectedRecipe[context]=recipe.id;renderRecipeBook(context);});
      list.appendChild(choice);
    }
    if(!visible.length)list.appendChild(recipeNode('p','recipe-empty',onlyReady?'지금 만들 수 있는 제작법이 없습니다. 필터를 끄면 필요한 재료를 볼 수 있어요.':'검색 결과가 없습니다. 다른 이름이나 재료로 찾아보세요.'));
    list.scrollTop=scroll;
    const counter=$(ids.count);if(counter)counter.textContent=visible.length+'개 제작법';
    detail.replaceChildren();
    if(!chosen){detail.appendChild(recipeNode('p','recipe-empty','제작법을 선택하면 필요한 재료와 제작 버튼이 표시됩니다.'));return;}
    const {recipe,state}=chosen;
    const heading=recipeNode('div','quick-recipe-heading'),label=recipeNode('div','');
    label.append(recipeNode('strong','',getItemName(recipe.outputId)),recipeNode('small','','한 번에 '+recipe.count+'개'));
    heading.append(recipeIcon(recipe.outputId),label);detail.appendChild(heading);
    const requirements=recipeNode('div','recipe-ingredients');
    for(const item of state.ingredients){
      const missing=item.have<item.count;
      const row=recipeNode('div','recipe-ingredient'+(missing?' missing':''));
      const text=recipeNode('span','',getItemName(item.id));
      text.appendChild(recipeNode('b','',(item.have===Infinity?'∞':item.have)+' / '+item.count+(missing?' · '+(item.count-item.have)+'개 부족':'')));
      row.append(recipeIcon(item.id),text);requirements.appendChild(row);
    }
    detail.appendChild(requirements);
    const status=recipeNode('p','recipe-status',state.maxBatches
      ? '지금 최대 '+state.maxCount+'개 만들 수 있어요.':state.reason==='space'?'완성품을 넣을 가방 공간이 필요합니다.':'빨간색으로 표시된 재료를 더 모아 주세요.');
    status.setAttribute('role','status');detail.appendChild(status);
    const actions=recipeNode('div','quick-craft-actions');
    const one=recipeNode('button','btn quick-craft-one','1회 제작 ×'+recipe.count);
    one.type='button';one.disabled=!state.canCraft;
    if(focusAction==='quick-craft-one')focusTarget=one;
    one.addEventListener('click',()=>quickCraft(context,recipe.id));
    const all=recipeNode('button','btn quick-craft-all','최대 제작'+(state.maxCount?' ×'+state.maxCount:''));
    all.type='button';all.disabled=!state.maxBatches;
    if(focusAction==='quick-craft-all')focusTarget=all;
    all.addEventListener('click',()=>quickCraft(context,recipe.id,'all'));
    actions.append(one,all);detail.appendChild(actions);
    const arrange=recipeNode('button','recipe-arrange','격자에 자동 배치');arrange.type='button';
    if(focusAction==='recipe-arrange')focusTarget=arrange;
    arrange.disabled=state.ingredients.some(item=>item.have<item.count);
    arrange.addEventListener('click',()=>{
      const placed=Crafting.arrangeRecipe(recipe,inventoryCursor);
      if(!placed.success){showToast('기존 재료를 보관할 가방 공간이 필요합니다');return;}
      inventoryCursor=placed.cursor;refreshCraftingView(context);
      if(context==='table'&&$('craft-manual'))$('craft-manual').open=true;
      showToast('재료를 배치했습니다 · 결과를 누르면 제작됩니다');
    });
    detail.appendChild(arrange);
    if(focusTarget){
      if(focusTarget.disabled){heading.tabIndex=-1;focusTarget=heading;}
      focusTarget.focus?.({preventScroll:true});
    }
  }

  function renderInventoryRecipes(){renderRecipeBook('inventory');}

  function renderInventoryCrafting(){
    const grid=$('inventory-craft-grid'),output=$('inventory-craft-output');
    if(!grid||!output)return;
    Crafting.setGridSize(2);
    grid.replaceChildren();
    for(const cellData of Crafting.getVisibleCells()){
      const id=cellData.id;
      const cell=document.createElement('button');
      cell.type='button';
      cell.className='craft-cell'+(id?' filled':'');
      cell.setAttribute('aria-label',id?getItemName(id)+' 2×2 제작 칸':'빈 2×2 제작 칸');
      if(id){
        cell.innerHTML='<img src="'+Textures.blockIcon(id)+'" alt="">';
        cell.title='클릭하여 재료 꺼내기';
        cell.addEventListener('click',()=>{
          if(inventoryCursor && inventoryCursor.id===id && inventoryCursor.count<stackLimit(inventoryCursor.id)){
            inventoryCursor.count++;
            Crafting.removeCell(cellData.index);
          }else if(!inventoryCursor){
            inventoryCursor={id,count:1};
            Crafting.removeCell(cellData.index);
          }else if(Inventory.add(id,1)===1)Crafting.removeCell(cellData.index);
          else{showToast('재료를 보관할 빈 칸이 없습니다');return;}
          renderInventory();
          updateInventoryCursor(innerWidth/2,innerHeight/2);
        });
      }else{
        cell.title='커서에 든 재료를 이 칸에 한 개 넣으세요';
        cell.addEventListener('click',()=>{
          if(!inventoryCursor || getToolDef(inventoryCursor.id)||getArmorDef(inventoryCursor.id)){
            showToast('가방의 블록이나 재료를 먼저 선택하세요');
            return;
          }
          if(Crafting.setCell(cellData.index,inventoryCursor.id)){
            inventoryCursor.count--;
            if(inventoryCursor.count<=0)inventoryCursor=null;
            renderInventory();
            updateInventoryCursor(innerWidth/2,innerHeight/2);
          }
        });
      }
      grid.appendChild(cell);
    }
    const match=Crafting.getMatch();
    const curDef=match?getItemDef(match.outputId):null;
    const gear=!!(curDef?.toolType||curDef?.armorType);
    const canStack=!inventoryCursor ||
      (!gear && inventoryCursor.id===match?.outputId &&
        inventoryCursor.count+match.count<=stackLimit(match.outputId));
    const ready=!!match && Crafting.canTakeGridResult() && canStack;
    output.disabled=!ready;
    output.className='craft-output'+(ready?' ready':'');
    output.innerHTML=match
      ? '<img src="'+Textures.blockIcon(match.outputId)+'" alt=""><span>'+match.name+'<b>×'+match.count+'</b></span>'
      : '<span class="craft-output-empty">?</span>';
    output.title=match?match.name+' · 결과를 들기':'제작법을 맞춰 주세요';
    output.onclick=e=>{
      if(e.shiftKey && !inventoryCursor){
        const recipe=Crafting.getMatch();
        if(recipe)quickCraft('inventory',recipe.id,'all');
        return;
      }else{
        const matched=Crafting.getMatch();
        if(!matched || !Crafting.canTakeGridResult() ||
           (inventoryCursor && (inventoryCursor.id!==matched.outputId ||
             getToolDef(matched.outputId)||getArmorDef(matched.outputId)||
             inventoryCursor.count+matched.count>stackLimit(matched.outputId)))){
          showToast('커서에 든 아이템을 먼저 내려놓으세요');
          return;
        }
        const made=Crafting.takeGridResult();
        if(!made)return;
        if(!inventoryCursor)inventoryCursor=made;
        else inventoryCursor.count+=made.count;
      }
      renderInventory();renderHotbar();
      updateInventoryCursor(e.clientX,e.clientY);
      showToast('제작 완료');
    };
  }

  function openInventory(){
    if(Crafting.getGridSize()!==2 && !returnCraftingMaterials()){
      showToast('제작대 재료를 돌려줄 공간이 부족합니다');
      return false;
    }
    if(Crafting.getGridSize()!==2)Crafting.resetGrid(2);
    inventoryOpen=true;
    bindRecipeBook('inventory');
    const creativeButton=$('inventory-creative-toggle');
    const creativePanel=$('inventory-creative-panel');
    if(creativeButton){
      creativeButton.hidden=!Inventory.isCreative();
      creativeButton.setAttribute('aria-expanded','false');
    }
    creativePanel?.classList.add('hidden');
    hoveredInventorySlot=null;
    mobileSplitMode=false;
    selectedInventoryMaterial=null;
    document.querySelectorAll('#overlay-inventory .equip-slot').forEach(btn=>{
      if(btn.dataset.bound)return;
      btn.dataset.bound='1';
      btn.addEventListener('mousedown',e=>{
        if(document.body.classList.contains('touch-device'))return;
        if(e.button!==0&&e.button!==2)return;
        e.preventDefault();e.stopPropagation();
        handleEquipment(btn.dataset.equip,e.button===2);
      });
      btn.addEventListener('click',e=>{
        if(!document.body.classList.contains('touch-device'))return;
        e.preventDefault();e.stopPropagation();
        handleEquipment(btn.dataset.equip,mobileSplitMode);
      });
      btn.addEventListener('contextmenu',e=>e.preventDefault());
    });
    const openCreative=$('inventory-creative-toggle');
    if(openCreative && !openCreative.dataset.bound){
      openCreative.dataset.bound='1';
      openCreative.addEventListener('click',()=>{
        const panel=$('inventory-creative-panel');
        if(!Inventory.isCreative()||!panel)return;
        const expanded=openCreative.getAttribute('aria-expanded')==='true';
        openCreative.setAttribute('aria-expanded',String(!expanded));
        panel.classList.toggle('hidden',expanded);
        if(!expanded)renderCreativeCatalog();
      });
    }
    const creativeSearch=$('inventory-creative-search');
    if(creativeSearch && !creativeSearch.dataset.bound){
      creativeSearch.dataset.bound='1';
      creativeSearch.addEventListener('input',renderCreativeCatalog);
    }
    const book=$('inventory-recipe-toggle'),panel=$('inventory-recipe-panel');
    if(book && !recipeBookBound){
      recipeBookBound=true;
      book.addEventListener('click',()=>{
        const expanded=book.getAttribute('aria-expanded')==='true';
        book.setAttribute('aria-expanded',String(!expanded));
        panel?.classList.toggle('hidden',expanded);
        if(!expanded)renderInventoryRecipes();
      });
    }
    const split=$('inventory-touch-split');
    if(split && !split.dataset.bound){
      split.dataset.bound='1';
      split.addEventListener('click',()=>{
        mobileSplitMode=!mobileSplitMode;
        split.setAttribute('aria-pressed',String(mobileSplitMode));
        split.textContent='한 개씩 놓기: '+(mobileSplitMode?'켬':'끔');
      });
    }
    renderInventory();
    renderCharacterEditor();
    $('overlay-inventory').classList.remove('hidden');
    return true;
  }

  function closeInventory(){
    if(!returnCraftingMaterials()){
      showToast('제작 재료를 되돌릴 빈 공간이 필요합니다');
      return false;
    }
    if(!inventoryCursorReturn())return false;
    inventoryOpen=false;
    hoveredInventorySlot=null;
    selectedInventoryMaterial=null;
    mobileSplitMode=false;
    $('overlay-inventory').classList.add('hidden');
    return true;
  }

  function getInventoryCursor() {
    if (!inventoryCursor) return null;
    return { ...inventoryCursor };
  }

  function restoreInventoryCursor(stack) {
    if (!stack || !Number.isInteger(stack.id) || !getItemDef(stack.id) ||
        !Number.isInteger(stack.count) || stack.count < 1 || stack.count > stackLimit(stack.id)) return false;
    inventoryCursor = { id: stack.id, count: stack.count };
    if (Number.isFinite(stack.durability)) inventoryCursor.durability = stack.durability;
    return true;
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
      btn.className = 'craft-inv-slot' + (!s ? ' empty' : '') + (selectedCraftingMaterial === i ? ' material-selected' : '');
      btn.disabled = !s;
      btn.innerHTML = s
        ? `<span class="craft-inv-num">${i + 1}</span><img src="${Textures.blockIcon(s.id)}" alt=""><span class="craft-inv-count">${s.count === Infinity ? '∞' : s.count}</span>`
        : `<span class="craft-inv-num">${i + 1}</span>`;
      btn.title = s ? getItemName(s.id) : '빈 슬롯';
      btn.addEventListener('click', () => {
        if (!s) return;
        selectedCraftingMaterial = i;
        showToast(getItemName(s.id) + ' 선택 · 제작 칸을 눌러 넣으세요');
        renderCraftingInventory();
      });
      el.appendChild(btn);
    });
  }

  function renderCrafting() {
    const craftGrid = $('craft-grid');
    const output = $('craft-output');
    if (!craftGrid || !output) return;

    craftGrid.innerHTML = '';
    Crafting.getVisibleCells().forEach(cellData => {
      const id = cellData.id;
      const i = cellData.index;
      const cell = document.createElement('button');
      cell.className = 'craft-cell' + (id ? ' filled' : '');
      cell.setAttribute('aria-label', id ? getItemName(id) : '빈 제작 칸');
      if (id) {
        cell.innerHTML = `<img src="${Textures.blockIcon(id)}" alt=""><span>${getItemName(id)}</span>`;
        cell.title = '클릭하여 빼기';
        cell.addEventListener('click', () => {
          if (Inventory.add(id, 1) === 1) Crafting.removeCell(i);
          else showToast('인벤토리에 빈 칸이 없습니다');
          renderCrafting();
        });
      } else {
        cell.innerHTML = '';
        cell.title = '아래 인벤토리에서 재료를 선택하고 이 칸을 누르세요';
        cell.addEventListener('click', () => {
          const slot = selectedCraftingMaterial === null ? null : Inventory.getSlots()[selectedCraftingMaterial];
          if (!slot || getToolDef(slot.id) || getArmorDef(slot.id)) {
            showToast('먼저 아래에서 제작 재료를 선택하세요');
            return;
          }
          const taken = Inventory.takeFromSlot(selectedCraftingMaterial, 1);
          if (!taken) return;
          if (!Crafting.setCell(i, taken.id)) {
            Inventory.putIntoSlot(selectedCraftingMaterial, taken);
            return;
          }
          renderCrafting();
        });
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
    output.onclick = e => {
      const recipe=Crafting.getMatch();
      if(recipe)quickCraft('table',recipe.id,e?.shiftKey?'all':1);
    };
    renderRecipeBook('table');

    renderCraftingInventory();
    if (inventoryOpen) renderInventory();
  }
  function openCrafting() {
    bindRecipeBook('table');
    if (Crafting.getGridSize() !== 3 && !returnCraftingMaterials()) {
      showToast('2×2 제작 칸의 재료를 돌려줄 공간이 없습니다');
      return false;
    }
    selectedCraftingMaterial = null;
    if (Crafting.getGridSize() !== 3) Crafting.resetGrid(3);
    renderCrafting();
    const clear = $('craft-clear');
    if (clear) clear.onclick = () => {
      if (!returnCraftingMaterials()) showToast('재료를 되돌릴 공간이 없습니다');
      renderCrafting();
    };
    $('overlay-crafting').classList.remove('hidden');
    return true;
  }

  function closeCrafting() {
    if (!returnCraftingMaterials()) { showToast('재료를 돌려줄 공간이 부족합니다'); return false; }
    selectedCraftingMaterial = null;
    $('overlay-crafting').classList.add('hidden');
    return true;
  }

  function isCraftingOpen() { return !$('overlay-crafting').classList.contains('hidden'); }

  let furnacePosition = null, furnaceRenderSignature = '';
  function furnacePlayerClick(index, right, shift, event) {
    if (!furnacePosition) return;
    if (shift && !inventoryCursor) {
      FurnaceSystem.depositFromInventory(furnacePosition, index);
    } else if (right) {
      const stack = Inventory.getSlots()[index];
      if (!inventoryCursor && stack) {
        const gear = !!(getToolDef(stack.id) || getArmorDef(stack.id));
        inventoryCursor = Inventory.takeFromSlot(index, gear ? 1 : Math.ceil(stack.count / 2));
      } else if (inventoryCursor && (!stack || stack.id === inventoryCursor.id)) {
        const gear = !!(getToolDef(inventoryCursor.id) || getArmorDef(inventoryCursor.id));
        if (!stack || !gear) {
          const one = {...inventoryCursor, count:1};
          if (!Inventory.putIntoSlot(index, one)) {
            inventoryCursor.count--;
            if (!inventoryCursor.count) inventoryCursor = null;
          }
        }
      }
    } else inventoryCursor = Inventory.swapWithSlot(index, inventoryCursor);
    renderFurnace(); renderHotbar();
    updateInventoryCursor(event.clientX, event.clientY);
  }
  function furnaceSlotClick(slot, right, shift, event) {
    if (!furnacePosition) return;
    if (shift && !inventoryCursor) FurnaceSystem.withdrawToInventory(furnacePosition, slot);
    else {
      const result = FurnaceSystem.interact(furnacePosition, slot, inventoryCursor, right);
      inventoryCursor = result.cursor;
    }
    renderFurnace(); renderHotbar();
    updateInventoryCursor(event.clientX, event.clientY);
  }
  function furnaceButton(stack, label, action) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'classic-furnace-slot';
    button.title = stack ? getItemName(stack.id) : label;
    button.setAttribute('aria-label', stack ? label + ': ' + getItemName(stack.id) + ' ' + stack.count + '개' : label + ' 빈 칸');
    if (stack) {
      const image = document.createElement('img'); image.src = Textures.blockIcon(stack.id); image.alt = '';
      const count = document.createElement('span'); count.className = 'classic-furnace-count';
      count.textContent = stack.count === 1 ? '' : stackLabel(stack);
      button.append(image, count);
    }
    button.addEventListener('mousedown', event => {
      if (document.body.classList.contains('touch-device') || ![0,2].includes(event.button)) return;
      event.preventDefault(); event.stopPropagation();
      action(event.button === 2, event.shiftKey, event);
    });
    button.addEventListener('click', event => {
      if (!document.body.classList.contains('touch-device')) return;
      event.preventDefault(); event.stopPropagation();
      action(false, false, event);
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
    return button;
  }
  function renderFurnace() {
    const list = $('furnace-recipes');
    if (!list || !furnacePosition || typeof FurnaceSystem === 'undefined') return;
    const state = FurnaceSystem.getState(furnacePosition);
    if (!state) return;
    const inventory = Inventory.getSlots();
    const signature = JSON.stringify([furnacePosition,state.input,state.fuel,state.output,inventory]);
    if (signature !== furnaceRenderSignature) {
      furnaceRenderSignature = signature;
      list.replaceChildren();
      list.className = 'classic-furnace-content';
      const machine = document.createElement('div'); machine.className = 'classic-furnace-machine';
      const input = document.createElement('div'); input.className = 'classic-furnace-input';
      input.appendChild(furnaceButton(state.input, '제련 재료', (right,shift,event) => furnaceSlotClick('input',right,shift,event)));
      const flame = document.createElement('div'); flame.className = 'classic-furnace-flame';
      flame.setAttribute('aria-label','연료');
      const flameFill = document.createElement('i'); flameFill.id = 'furnace-flame-fill'; flame.appendChild(flameFill);
      const fuel = document.createElement('div'); fuel.className = 'classic-furnace-fuel';
      fuel.appendChild(furnaceButton(state.fuel, '연료', (right,shift,event) => furnaceSlotClick('fuel',right,shift,event)));
      const arrow = document.createElement('div'); arrow.className = 'classic-furnace-arrow';
      arrow.setAttribute('role','progressbar'); arrow.setAttribute('aria-label','제련 진행');
      arrow.setAttribute('aria-valuemin','0'); arrow.setAttribute('aria-valuemax','100');
      const progress = document.createElement('i'); progress.id = 'furnace-progress-fill'; arrow.appendChild(progress);
      const output = document.createElement('div'); output.className = 'classic-furnace-output';
      output.appendChild(furnaceButton(state.output, '완성품', (right,shift,event) => furnaceSlotClick('output',right,shift,event)));
      machine.append(input,flame,fuel,arrow,output); list.appendChild(machine);
      const label = document.createElement('h3'); label.textContent = '인벤토리'; list.appendChild(label);
      const grid = document.createElement('div'); grid.className = 'classic-furnace-inventory';
      // Main backpack first, followed by a separated nine-slot hotbar.
      [...Array.from({length:27},(_,i)=>i+9),...Array.from({length:9},(_,i)=>i)].forEach(index => {
        const button = furnaceButton(inventory[index], '인벤토리 ' + (index + 1),
          (right,shift,event) => furnacePlayerClick(index,right,shift,event));
        if (index < 9) button.classList.add('classic-furnace-hotbar');
        grid.appendChild(button);
      });
      list.appendChild(grid);
      const help = document.createElement('small'); help.className = 'classic-furnace-help';
      help.textContent = '클릭: 집기·놓기 · 우클릭: 나누기·1개 놓기 · Shift+클릭: 빠른 이동';
      list.appendChild(help);
    }
    const flameFill = $('furnace-flame-fill'), progress = $('furnace-progress-fill');
    if (flameFill) flameFill.style.height = (state.burnDuration ? state.burnRemaining / state.burnDuration * 100 : 0) + '%';
    if (progress) {
      const percentage = Math.min(100, state.cookProgress / FurnaceSystem.SMELT_SECONDS * 100);
      progress.style.width = percentage + '%';
      progress.parentElement?.setAttribute('aria-valuenow',String(Math.round(percentage)));
    }
    const supply = $('furnace-fuel');
    const status = state.burnRemaining > 0 ? '연료가 타고 있습니다.' : '재료와 연료를 넣어 주세요.';
    if (supply && supply.textContent !== status) supply.textContent = status;
  }

  function openFurnace(target) {
    const overlay = $('overlay-furnace');
    if (!overlay || typeof FurnaceSystem === 'undefined') { showToast('화로 화면을 불러올 수 없습니다'); return false; }
    const position = target || (typeof Interact !== 'undefined' ? Interact.getTarget() : null);
    if (!position || !FurnaceSystem.getState(position, true)) return false;
    furnacePosition = {x:position.x,y:position.y,z:position.z};
    furnaceRenderSignature = '';
    const panel = overlay.querySelector('.panel');
    panel?.classList.add('classic-furnace-panel');
    const heading = panel?.querySelector('h2');
    if (heading) heading.textContent = '화로';
    renderFurnace();
    overlay.classList.remove('hidden');
    updateInventoryCursor(innerWidth/2, innerHeight/2);
    return true;
  }

  function closeFurnace() {
    if (!inventoryCursorReturn()) return false;
    $('overlay-furnace')?.classList.add('hidden');
    furnacePosition = null; furnaceRenderSignature = '';
    return true;
  }

  function isFurnaceOpen() {
    const overlay = $('overlay-furnace');
    return !!overlay && !overlay.classList.contains('hidden');
  }

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
    // Death must never be vetoed by a full bag. Keep held items and crafting
    // escrow in their saved state instead of attempting transactional closes.
    inventoryOpen = false;
    pickerOpen = false;
    hoveredInventorySlot = null;
    selectedInventoryMaterial = null;
    selectedCraftingMaterial = null;
    mobileSplitMode = false;
    furnacePosition = null;
    furnaceRenderSignature = '';
    for (const id of ['overlay-start','overlay-pause','overlay-inventory',
      'overlay-crafting','overlay-furnace','picker','inventory-cursor']) {
      $(id)?.classList.add('hidden');
    }
    $('overlay-death')?.classList.remove('hidden');
  }

  function hideDeath() {
    $('overlay-death').classList.add('hidden');
  }

  function openPicker(onPick) {
    pickerOpen = true;
    const grid = $('picker-grid');
    const search = $('picker-search');
    const category = $('picker-category');
    const count = $('picker-count');
    if (search) search.value = '';
    if (category) category.value = '전체';

    const render = () => {
      const needle = (search?.value || '').trim().toLocaleLowerCase('ko-KR');
      const group = category?.value || '전체';
      const visible = PLACEABLE_IDS.filter(id =>
        (group === '전체' || getBlockCategory(id) === group) &&
        (!needle || BLOCKS[id].name.toLocaleLowerCase('ko-KR').includes(needle))
      );
      grid.replaceChildren();
      if(count)count.textContent = visible.length + '개 블록';
      for(const id of visible) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pick';
        const icon = document.createElement('img');
        icon.src = Textures.blockIcon(id);
        icon.alt = '';
        const label = document.createElement('span');
        label.textContent = BLOCKS[id].name;
        b.title = BLOCKS[id].name + ' · ' + getBlockCategory(id);
        b.append(icon, label);
        b.addEventListener('click', () => { closePicker(); onPick(id); });
        grid.appendChild(b);
      }
      if(!visible.length) {
        const empty = document.createElement('p');
        empty.className = 'picker-empty';
        empty.textContent = '찾는 블록이 없습니다. 다른 이름이나 분류를 선택해 주세요.';
        grid.appendChild(empty);
      }
    };
    if(search) search.oninput = render;
    if(category) category.onchange = render;
    render();
    $('picker').classList.remove('hidden');
    search?.focus?.();
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
    if (inventoryOpen || isFurnaceOpen()) updateInventoryCursor(e.clientX, e.clientY);
  });

  return {
    renderHotbar, setSelected, showItemName, showOverlay, showToast, setHUD, setTime, setMiningProgress,
    setModeLabel, renderWorlds, renderCrafting, openCrafting, closeCrafting, isCraftingOpen,
    renderInventory, openInventory, closeInventory, isInventoryOpen, quickSwapHotbar,
    getInventoryCursor, restoreInventoryCursor,
    renderFurnace, openFurnace, closeFurnace, isFurnaceOpen, dropSelected, updateInventoryCursor,
    updateSurvival, showDeath, hideDeath, openPicker, closePicker, isPickerOpen, setStartEnabled, flashVignette
  };
})();
