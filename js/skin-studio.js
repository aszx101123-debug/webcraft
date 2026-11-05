'use strict';

// Shared WebCraft skin specification for the homepage and in-game editor.
// Only original, procedural cosmetics; no imported Minecraft textures.
const WebCraftSkins = (() => {
  const KEY = 'webcraft_avatar_v3';
  const palettes = {
    skin: [
      ['도자기',0xf3cfad],['복숭아',0xd5a57f],['꿀빛',0xc99668],['구릿빛',0xb77955],
      ['밤색',0x936047],['진한 갈색',0x694636]
    ].map(([label,value])=>({label,value})),
    hair: [
      ['검정',0x26242a],['다크 브라운',0x4b3428],['밤색',0x7b4b30],['금발',0xbda16d],
      ['은색',0xc9c9cc],['붉은 갈색',0xad5e43],['남색',0x313d69]
    ].map(([label,value])=>({label,value})),
    shirt: [
      ['청록',0x2f8c90],['파랑',0x426ab4],['빨강',0xb35053],['초록',0x518e53],
      ['보라',0x8456a2],['주황',0xc78b3c],['검정',0x343943],
      ['아이보리',0xddddc8],['분홍',0xcc819d]
    ].map(([label,value])=>({label,value})),
    pants: [
      ['남색',0x33435f],['회색',0x6b7888],['갈색',0x70503b],
      ['검정',0x272c38],['진청',0x3b6093],['베이지',0xb5a080]
    ].map(([label,value])=>({label,value})),
    boots: [
      ['검정',0x24262c],['갈색',0x5b4335],['회색',0x666b70],['흰색',0xc4ced0]
    ].map(([label,value])=>({label,value})),
    hairStyle: [
      {label:'짧은 머리',value:'short'},{label:'앞머리',value:'fringe'},
      {label:'긴 머리',value:'long'},{label:'옆 가르마',value:'parted'}
    ],
    shirtStyle: [
      {label:'기본',value:'solid'},{label:'가슴 줄무늬',value:'stripe'},
      {label:'모험가 문양',value:'badge'},{label:'후드티',value:'hoodie'}
    ],
    accessory: [
      {label:'없음',value:'none'},{label:'안경',value:'glasses'},
      {label:'목도리',value:'scarf'},{label:'헤드밴드',value:'headband'}
    ],
    eyes: [
      {label:'검정',value:'dark'},{label:'갈색',value:'brown'},{label:'파랑',value:'blue'}
    ]
  };
  const defaults = Object.freeze({
    skin:1,hair:1,shirt:0,pants:0,boots:0,
    hairStyle:'short',shirtStyle:'solid',accessory:'none',eyes:'dark'
  });
  const presets = [
    {name:'클래식 모험가',appearance:{...defaults}},
    {name:'숲의 탐험가',appearance:{...defaults,shirt:3,pants:2,boots:1,hairStyle:'fringe',shirtStyle:'badge'}},
    {name:'밤하늘',appearance:{...defaults,hair:0,shirt:6,pants:3,shirtStyle:'hoodie',eyes:'blue'}},
    {name:'노을',appearance:{...defaults,hair:5,shirt:5,pants:2,boots:1,shirtStyle:'stripe',accessory:'scarf'}},
    {name:'바다',appearance:{...defaults,hair:4,shirt:1,pants:4,shirtStyle:'stripe',eyes:'blue'}},
    {name:'겨울 여행자',appearance:{...defaults,hair:3,shirt:7,pants:1,boots:3,hairStyle:'long',accessory:'scarf'}}
  ];
  const labels = {
    skin:'피부 색상',hair:'머리 색상',shirt:'상의',pants:'바지',boots:'신발',
    hairStyle:'헤어스타일',shirtStyle:'옷 디테일',accessory:'액세서리',eyes:'눈 색상'
  };
  function normalize(input) {
    const output = {...defaults};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
    for(const key of Object.keys(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(input,key)) continue;
      if (typeof defaults[key] === 'number') {
        if (Number.isInteger(input[key]) && input[key] >= 0 && input[key] < palettes[key].length)
          output[key] = input[key];
      } else if (palettes[key].some(p=>p.value === input[key])) {
        output[key] = input[key];
      }
    }
    return output;
  }
  function hex(value) {return '#'+value.toString(16).padStart(6,'0');}
  function shade(value, factor) {
    const r=Math.max(0,Math.min(255,Math.round(((value>>16)&255)*factor)));
    const g=Math.max(0,Math.min(255,Math.round(((value>>8)&255)*factor)));
    const b=Math.max(0,Math.min(255,Math.round((value&255)*factor)));
    return hex((r<<16)|(g<<8)|b);
  }
  function load() {
    try {
      const record=JSON.parse(localStorage.getItem(KEY)||'null');
      if (record && record.appearance) return {appearance:normalize(record.appearance),updatedAt:Number(record.updatedAt)||0};
    } catch (_) {}
    return null;
  }
  function save(input) {
    const appearance=normalize(input);
    const data={appearance,updatedAt:Date.now()};
    try {localStorage.setItem(KEY,JSON.stringify(data));}
    catch (_) {return null;}
    return data;
  }
  // Pixel-rendered skin, proportionally consistent between homepage and inventory.
  function draw(canvas,input,back=false,gear=null) {
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    const ctx=canvas.getContext('2d');if (!ctx)return false;
    const a=normalize(input),w=canvas.width,h=canvas.height;
    const skin=palettes.skin[a.skin].value, hair=palettes.hair[a.hair].value,
      shirt=palettes.shirt[a.shirt].value,pants=palettes.pants[a.pants].value,
      boots=palettes.boots[a.boots].value;
    ctx.clearRect(0,0,w,h);
    ctx.save();ctx.scale(w/80,h/112);
    ctx.fillStyle='#13222e';ctx.fillRect(0,0,80,112);
    for(let x=0;x<80;x+=8)for(let y=0;y<112;y+=8){
      ctx.fillStyle=((x+y)/8)%2===0?'#1b303c':'#172834';ctx.fillRect(x,y,8,8);
    }
    const r=(x,y,ww,hh,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,ww,hh)};
    // Pixel-precise isometric-free full body (front or back).
    r(16,106,48,3,'rgba(0,0,0,.42)');
    r(28,76,11,28,hex(pants));r(42,76,11,28,shade(pants,.86));
    r(29,80,3,21,shade(pants,1.14));r(43,80,2,20,shade(pants,1.08));
    r(27,99,13,7,hex(boots));r(41,99,13,7,shade(boots,.86));
    r(27,99,13,2,shade(boots,1.24));r(41,99,13,2,shade(boots,1.24));
    r(24,45,32,32,hex(shirt));r(24,45,5,32,shade(shirt,.77));r(51,45,5,32,shade(shirt,.85));
    r(24,48,32,3,shade(shirt,1.24));
    r(13,46,10,36,shade(shirt,.93));r(57,46,10,36,shade(shirt,.83));
    r(13,67,10,14,hex(skin));r(57,67,10,14,shade(skin,.92));
    r(13,65,10,3,shade(shirt,.7));r(57,65,10,3,shade(shirt,.7));
    r(13,75,2,5,shade(skin,.79));r(65,75,2,5,shade(skin,.79));
    if(a.shirtStyle==='stripe') {
      r(24,55,32,4,shade(shirt,1.33));r(24,65,32,3,shade(shirt,.67));
      r(13,57,10,3,shade(shirt,1.28));r(57,57,10,3,shade(shirt,1.28));
    } else if(a.shirtStyle==='badge') {
      r(43,52,10,11,'#e3bf65');r(45,54,6,6,'#244f62');r(47,55,2,6,'#fff0b9');
    } else if(a.shirtStyle==='hoodie'){
      r(27,47,26,6,shade(shirt,.64));r(36,54,2,15,'#e3e6da');r(44,54,2,15,'#e3e6da');
      r(31,69,18,5,shade(shirt,.66));r(34,68,12,2,shade(shirt,1.2));
    }
    // Squared head and hair with multi-tone highlights.
    r(26,13,28,29,hex(skin));r(26,13,4,29,shade(skin,.79));r(50,13,4,29,shade(skin,.87));
    r(27,13,26,3,shade(skin,1.13));
    r(25,9,30,9,hex(hair));r(25,11,4,8,shade(hair,.74));r(27,9,26,2,shade(hair,1.32));
    if(a.hairStyle==='fringe'){r(26,16,30,6,hex(hair));r(40,19,11,5,shade(hair,.86));}
    if(a.hairStyle==='parted'){r(26,15,11,11,hex(hair));r(48,16,6,5,hex(hair));}
    if(a.hairStyle==='long'){
      r(23,17,5,31,shade(hair,.81));r(53,17,5,31,hex(hair));
      r(27,14,27,7,shade(hair,1.08));
    }
    if(!back){
      const eye={dark:'#1d222e',brown:'#68442d',blue:'#2876b9'}[a.eyes];
      r(32,27,5,5,eye);r(45,27,5,5,eye);r(33,27,1,1,'#f7f8ea');r(46,27,1,1,'#f7f8ea');
      r(39,36,5,2,shade(skin,.69));
    }else{
      r(28,18,25,19,hex(hair));r(30,20,19,14,shade(hair,.8));
    }
    if(a.accessory==='glasses'&&!back){
      r(29,24,11,2,'#dae5eb');r(43,24,11,2,'#dae5eb');r(29,24,2,11,'#dae5eb');
      r(38,25,2,10,'#dae5eb');r(43,24,2,11,'#dae5eb');r(52,24,2,11,'#dae5eb');r(40,25,3,2,'#dae5eb');
    }else if(a.accessory==='scarf'){
      r(23,43,34,5,'#d9a05a');r(back?31:52,48,5,18,'#b96846');r(back?32:53,61,3,3,'#efd59f');
    }else if(a.accessory==='headband'){
      r(25,18,30,3,'#d1a855');r(36,18,8,3,'#f0dd8f');
    }
    // Equipped armor is visible in the preview, while base cosmetics are preserved.
    if(gear){
      const armorColor=stack=>{
        if(!stack||stack.id<220||stack.id>239)return null;
        return [0x9a704b,0x92979c,0xc9d4d9,0xe5b54c,0x6bdbe8][Math.floor((stack.id-220)/4)]||null;
      };
      let color=armorColor(gear.chest);if(color){r(24,45,32,26,hex(color));r(29,49,22,3,shade(color,1.25));}
      color=armorColor(gear.head);if(color){r(24,10,32,12,hex(color));r(29,12,22,3,shade(color,1.25));}
      color=armorColor(gear.legs);if(color){r(28,77,11,19,hex(color));r(42,77,11,19,shade(color,.87));}
      color=armorColor(gear.feet);if(color){r(27,99,13,7,hex(color));r(41,99,13,7,shade(color,.86));}
    }
    ctx.restore();
    return true;
  }
  return {KEY,palettes,defaults,presets,labels,normalize,hex,shade,load,save,draw};
})();