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
    el.textContent = name;
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
    if (name !== 'furnace' && isFurnaceOpen()) closeFurnace();
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
      const max=Inventory.MAX_STACK||64;
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
        }else if(!src || (src.id===inventoryCursor.id && src.count<Inventory.MAX_STACK)){
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

  function renderInventoryRecipes(){
    const list=$('inventory-recipe-list');
    if(!list)return;
    list.replaceChildren();
    const recipes=Crafting.getRecipes()
      .filter(r=>Crafting.recipeFitsGrid(r))
      .sort((a,b)=>Number(Crafting.canCraft(b))-Number(Crafting.canCraft(a)));
    for(const r of recipes){
      const available=Crafting.canCraft(r);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='java-recipe-item'+(available?'':' unavailable');
      const img=document.createElement('img');
      img.src=Textures.blockIcon(r.outputId);
      img.alt='';
      const name=document.createElement('span');
      name.textContent=r.name+' ×'+r.count;
      btn.title=r.note||Crafting.summary(r);
      btn.setAttribute('aria-label',btn.title);
      btn.disabled=!available;
      btn.append(img,name);
      btn.addEventListener('click',()=>{
        if(Crafting.getVisibleCells().some(cell=>cell.id) && !returnCraftingMaterials()){
          showToast('제작 재료를 돌려줄 공간이 없습니다');
          return;
        }
        if(!Crafting.autofill(r.id)){
          showToast('해당 제작법을 배치할 수 없습니다');
          renderInventory();
          return;
        }
        renderInventory();
        showToast('제작법 배치 완료 · 결과 아이템을 누르세요');
      });
      list.appendChild(btn);
    }
  }

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
          if(inventoryCursor && inventoryCursor.id===id && inventoryCursor.count<Inventory.MAX_STACK){
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
        inventoryCursor.count+match.count<=Inventory.MAX_STACK);
    const ready=!!match && Crafting.canTakeGridResult() && canStack;
    output.disabled=!ready;
    output.className='craft-output'+(ready?' ready':'');
    output.innerHTML=match
      ? '<img src="'+Textures.blockIcon(match.outputId)+'" alt=""><span>'+match.name+'<b>×'+match.count+'</b></span>'
      : '<span class="craft-output-empty">?</span>';
    output.title=match?match.name+' · 결과를 들기':'제작법을 맞춰 주세요';
    output.onclick=e=>{
      if(e.shiftKey && !inventoryCursor){
        if(!Crafting.craftGrid()){
          showToast('결과 아이템을 넣을 공간이 없습니다');
          return;
        }
      }else{
        const matched=Crafting.getMatch();
        if(!matched || !Crafting.canTakeGridResult() ||
           (inventoryCursor && (inventoryCursor.id!==matched.outputId ||
             getToolDef(matched.outputId)||getArmorDef(matched.outputId)||
             inventoryCursor.count+matched.count>Inventory.MAX_STACK))){
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
        !Number.isInteger(stack.count) || stack.count < 1 || stack.count > 64) return false;
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
    const recipeList = $('recipe-grid');
    if (!craftGrid || !output || !recipeList) return;

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
        if (!returnCraftingMaterials()) { showToast('재료를 되돌릴 공간이 없습니다'); return; }
        if (!Crafting.autofill(recipe.id)) showToast('재료가 부족합니다');
        renderCrafting();
      });
      card.appendChild(btn);
      recipeList.appendChild(card);
    });

    renderCraftingInventory();
    if (inventoryOpen) renderInventory();
  }
  function openCrafting() {
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

  const furnaceRecipes = [
    { input: BLOCK.IRON_ORE, output: ITEM.IRON_INGOT },
    { input: BLOCK.GOLD_ORE, output: ITEM.GOLD_INGOT },
    { input: BLOCK.COPPER_ORE, output: ITEM.COPPER_INGOT },
    { input: BLOCK.SAND, output: BLOCK.GLASS },
    { input: BLOCK.COBBLE, output: BLOCK.STONE },
    { input: BLOCK.CLAY, output: BLOCK.BRICK }
  ];

  function furnaceFuel() {
    if (Inventory.countItem(ITEM.COAL) >= 1) return { id: ITEM.COAL, count: 1 };
    for(const id of [BLOCK.PLANK,BLOCK.BIRCH_PLANKS,BLOCK.SPRUCE_PLANKS]) {
      if (Inventory.countItem(id) >= 2) return { id, count: 2 };
    }
    return null;
  }

  function renderFurnace() {
    const list = $('furnace-recipes');
    if (!list) return;
    list.innerHTML = '';
    const fuel = furnaceFuel();
    const supply = $('furnace-fuel');
    if (supply) supply.textContent = fuel
      ? '사용할 연료: ' + getItemName(fuel.id) + ' ×' + fuel.count
      : '연료 부족: 석탄 1개 또는 같은 종류 판자 2개 필요';
    for (const recipe of furnaceRecipes) {
      const available = Inventory.countItem(recipe.input) >= 1 && !!fuel &&
        Inventory.canAdd(recipe.output, 1) && !Inventory.isCreative();
      const row = document.createElement('div');
      row.className = 'furnace-recipe';
      const icon = document.createElement('img');
      icon.src = Textures.blockIcon(recipe.input);
      icon.alt = '';
      const label = document.createElement('span');
      label.textContent = getItemName(recipe.input) + ' → ' + getItemName(recipe.output);
      const button = document.createElement('button');
      button.className = 'btn small';
      button.textContent = '제련';
      button.disabled = !available;
      button.addEventListener('click', () => {
        const chosenFuel = furnaceFuel();
        if (!chosenFuel || Inventory.countItem(recipe.input) < 1 ||
            !Inventory.canAdd(recipe.output, 1)) {
          showToast('재료·연료 또는 인벤토리 공간을 확인해 주세요');
          renderFurnace();
          return;
        }
        if (!Inventory.removeItem(recipe.input, 1)) return;
        if (!Inventory.removeItem(chosenFuel.id, chosenFuel.count)) {
          Inventory.add(recipe.input, 1);
          renderFurnace();
          return;
        }
        const made = Inventory.add(recipe.output, 1);
        if (made !== 1) {
          Inventory.add(recipe.input, 1);
          Inventory.add(chosenFuel.id, chosenFuel.count);
          showToast('결과물을 보관할 공간이 없습니다');
        } else {
          renderHotbar();
          showToast(getItemName(recipe.output) + ' 제련 완료');
        }
        renderFurnace();
      });
      row.append(icon, label, button);
      list.appendChild(row);
    }
  }

  function openFurnace() {
    const overlay = $('overlay-furnace');
    if (!overlay) { showToast('화로 화면을 불러올 수 없습니다'); return; }
    renderFurnace();
    overlay.classList.remove('hidden');
  }

  function closeFurnace() {
    $('overlay-furnace')?.classList.add('hidden');
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
    showOverlay('death');
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
    if (inventoryOpen) updateInventoryCursor(e.clientX, e.clientY);
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
