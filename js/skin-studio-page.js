'use strict';

// Homepage skin editor; uses the same palette, defaults and preview as gameplay.
(() => {
  const skins = window.WebCraftSkins;
  const root = document.getElementById('skin-studio');
  if (!root || !skins) return;
  const $ = id => document.getElementById(id);
  let current = skins.load()?.appearance || {...skins.defaults};
  let back = false;

  const canvas = $('skin-studio-preview');
  const status = $('skin-save-status');
  const options = $('skin-studio-options');
  const presetList = $('skin-studio-presets');
  const labels = skins.labels;
  const fields = [
    'skin','hair','hairStyle','eyes','shirt','shirtStyle','pants','boots','accessory'
  ];

  function paint() {
    skins.draw(canvas,current,back);
  }
  function markSaved(success) {
    status.textContent = success
      ? '저장됨 · 게임 시작 시 이 스킨이 적용돼요'
      : '저장할 수 없습니다 · 브라우저 저장소 설정을 확인해 주세요';
    status.classList.toggle('skin-save-error',!success);
  }
  function persist() {
    const result = skins.save(current);
    markSaved(!!result);
  }
  function renderOptions() {
    options.replaceChildren();
    for (const field of fields) {
      const choices=skins.palettes[field];
      const text=document.createElement('div');
      text.className='skin-option-label';
      text.textContent=labels[field];
      const group=document.createElement('div');
      const textual=typeof choices[0].value==='string';
      group.className='skin-option-choices'+(textual?' skin-text-choices':'');
      for (const [index,choice] of choices.entries()) {
        const button=document.createElement('button');
        button.type='button';
        button.className='skin-option-chip'+(textual?' skin-option-text':'');
        button.title=choice.label;
        const value=textual?choice.value:index;
        button.setAttribute('aria-label',labels[field]+' '+choice.label);
        button.setAttribute('aria-pressed',String(current[field]===value));
        if (textual) button.textContent=choice.label;
        else {
          button.style.setProperty('--skin-chip-color',skins.hex(choice.value));
          button.innerHTML='<span aria-hidden="true"></span>';
        }
        button.addEventListener('click',()=>{
          current={...current,[field]:value};
          paint();persist();renderOptions();renderPresets();
        });
        group.appendChild(button);
      }
      const row=document.createElement('div');
      row.className='skin-option-row';
      row.append(text,group);
      options.appendChild(row);
    }
  }
  function renderPresets() {
    presetList.replaceChildren();
    for (const [i,preset] of skins.presets.entries()) {
      const button=document.createElement('button');
      button.type='button';
      button.className='skin-preset';
      button.textContent=preset.name;
      button.setAttribute('aria-pressed',String(
        Object.keys(skins.defaults).every(key=>current[key]===preset.appearance[key])
      ));
      button.addEventListener('click',()=>{
        current=skins.normalize(preset.appearance);
        paint();persist();renderOptions();renderPresets();
      });
      presetList.appendChild(button);
    }
  }
  function update() {
    paint();renderOptions();renderPresets();
  }
  $('skin-studio-turn').addEventListener('click',()=>{
    back=!back;
    $('skin-studio-turn').textContent=back?'앞에서 보기':'뒤에서 보기';
    paint();
  });
  $('skin-studio-reset').addEventListener('click',()=>{
    current={...skins.defaults};
    update();persist();
  });
  $('skin-studio-random').addEventListener('click',()=>{
    const next={};
    for(const key of Object.keys(skins.defaults)){
      const list=skins.palettes[key],choice=list[Math.floor(Math.random()*list.length)];
      next[key]=typeof skins.defaults[key]==='number'?list.indexOf(choice):choice.value;
    }
    current=skins.normalize(next);
    update();persist();
  });
  $('skin-studio-save').addEventListener('click',persist);
  // Old stored preferences migrate on load through normalized defaults.
  current=skins.normalize(current);
  update();
  if(skins.load())markSaved(true);
  else status.textContent='색상을 고르면 자동 저장돼요';
  root.classList.add('skin-studio-ready');
})();
