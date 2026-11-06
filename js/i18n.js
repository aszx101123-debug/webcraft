/* WebCraft locale layer: translates interface text without changing game logic. */
(()=>{'use strict';
const rows=[["게임 모드","Game Modes","ゲームモード"],["조작법","Controls","操作方法"],["업데이트","Updates","アップデート"],["플레이","Play","プレイ"],["싱글플레이","Singleplayer","シングルプレイ"],["캐고, 만들고, 살아남으세요!","Mine, build, and survive!","掘って、作って、生き残ろう！"],["시작 화면에서 월드와 게임 모드를 선택하세요.","Select your world and game mode on the start screen.","開始画面でワールドとゲームモードを選んでください。"],["두 가지 플레이 방식","Two Ways to Play","2つのプレイスタイル"],["나무를 캐서 첫 집을 짓거나, 무한한 블록으로 자유롭게 만들어 보세요.","Gather wood to build your first shelter, or build freely with unlimited blocks.","木を集めて最初の家を建てるか、無限のブロックで自由に建築しましょう。"],["서바이벌","Survival","サバイバル"],["크리에이티브","Creative","クリエイティブ"],["자원을 모으고 도구를 제작하세요. 체력과 배고픔을 챙기고 밤의 몬스터를 조심하세요.","Gather resources, craft tools, and survive the night.","資源を集め、道具を作り、夜のモンスターから生き残ろう。"],["블록을 자유롭게 고르고 하늘을 날며 건축하세요. 체력과 자원 걱정 없이 만들 수 있습니다.","Build freely with unlimited blocks and flight.","ブロックを自由に選び、空を飛んで建築できます。"],["기본 조작","Basic Controls","基本操作"],["이동","Move","移動"],["점프 · 수영 · 비행 상승","Jump · Swim · Fly up","ジャンプ・泳ぐ・上昇"],["웅크리기 · 비행 하강","Crouch · Fly down","しゃがむ・下降"],["달리기","Sprint","ダッシュ"],["채굴·공격 / 블록 설치·사용","Mine/Attack · Place/Use","採掘・攻撃／設置・使用"],["핫바 선택","Select hotbar slot","ホットバー選択"],["인벤토리 · 2×2 개인 제작","Inventory · 2×2 crafting","インベントリ・2×2クラフト"],["선택 아이템 버리기","Drop selected item","選択アイテムを捨てる"],["HUD 숨기기 / 디버그 / 시점 전환","Hide HUD / Debug / Camera","HUD非表示／デバッグ／視点"],["일시정지 · 저장","Pause · Save","一時停止・保存"],["첫날의 준비","Your First Day","最初の日の準備"],["나무를 캐서 판자로 바꾸세요.","Mine wood and turn it into planks.","木を採掘して板材にしましょう。"],["인벤토리의 2×2 제작 칸에서 제작대를 만드세요.","Craft a crafting table using the 2×2 inventory grid.","インベントリの2×2欄で作業台を作りましょう。"],["제작대를 설치하고 우클릭하면 3×3 제작을 할 수 있습니다.","Place and use the crafting table for 3×3 recipes.","作業台を設置して使うと3×3クラフトができます。"],["도구와 횃불을 만들고 해가 지기 전에 쉴 곳을 마련하세요.","Craft tools and torches, then find shelter before sunset.","道具と松明を作り、日暮れまでに避難所を用意しましょう。"],["모바일에서는 왼쪽 조이스틱으로 이동하고, 화면을 드래그해 둘러봅니다. 짧게 터치하면 사용·설치, 길게 누르면 채굴합니다.","On mobile, move with the joystick and drag to look around. Tap to use/place, hold to mine.","モバイルではジョイスティックで移動し、ドラッグで視点変更。タップで使用・設置、長押しで採掘。"],["익숙한 블록 게임으로","A Familiar Block-Game Feel","親しみやすいブロックゲームへ"],["복잡한 안내와 부가 화면을 덜어내고, 기본 플레이에 집중했습니다.","Less clutter, more focus on playing.","複雑な表示を減らし、基本プレイに集中しました。"],["단정한 픽셀 메뉴와 핫바","Clean pixel menus and hotbar","シンプルなピクセルメニューとホットバー"],["Shift 웅크리기 · Ctrl 달리기","Shift crouch · Ctrl sprint","Shiftでしゃがむ・Ctrlで走る"],["시간과 연료를 사용하는 화로","Timed, fuel-powered furnace","燃料と時間を使うかまど"],["익숙한 인벤토리와 제작 화면","Classic inventory and crafting","クラシックなインベントリとクラフト"],["현재 버전","Current version","現在のバージョン"],["기존 월드를 그대로 이어서 플레이할 수 있습니다.","Continue playing your existing worlds.","既存のワールドをそのまま続けられます。"],["게임 시작","Start Game","ゲーム開始"],["이전 업데이트","Previous Updates","過去のアップデート"],["스킨 설정","Skin Settings","スキン設定"],["캐릭터 모습","Character Appearance","キャラクターの見た目"],["원하면 캐릭터의 색상과 옷을 바꿀 수 있습니다. 기존 월드에도 적용됩니다.","Change your character's colors and outfit. Changes also apply to existing worlds.","キャラクターの色や服を変更できます。既存ワールドにも反映されます。"],["뒤에서 보기","View Back","背面を見る"],["랜덤 스킨","Random Skin","ランダムスキン"],["기본 모습","Default Look","初期スキン"],["스타일부터 골라 보자","Choose Your Style","スタイルを選ぼう"],["스킨 저장","Save Skin","スキンを保存"],["이 스킨으로 플레이","Play with This Skin","このスキンでプレイ"],["색상을 고르면 자동 저장돼요","Colors are saved automatically","色は自動保存されます"],["플레이어 방명록","Player Guestbook","プレイヤー掲示板"],["WebCraft 방명록","WebCraft Guestbook","WebCraft 掲示板"],["플레이 후 한마디를 남겨주세요. 사이트에 공개되는 공용 방명록입니다.","Leave a message after playing. This guestbook is public.","プレイ後に感想を残してください。公開掲示板です。"],["GitHub에서 작성","Post on GitHub","GitHubに投稿"],["개인정보나 연락처는 남기지 마세요.","Do not post personal or contact information.","個人情報や連絡先は投稿しないでください。"],["저장과 플레이 안내","Saving and Playing","保存とプレイについて"],["월드는 어떻게 저장되나요?","How are worlds saved?","ワールドはどう保存されますか？"],["인터넷이 필요한가요?","Do I need internet?","インターネットは必要ですか？"],["마인크래프트와 같은 게임인가요?","Is this Minecraft?","Minecraftと同じゲームですか？"],["게임을 준비하지 못했습니다","Unable to Start Game","ゲームを起動できませんでした"],["브라우저에서 WebCraft 초기화 중 문제가 발생했습니다.","WebCraft failed to initialize in this browser.","ブラウザでWebCraftの初期化に失敗しました。"],["다시 불러오기","Reload","再読み込み"],["홈으로","Home","ホームへ"],["공격 준비","Attack Ready","攻撃準備"],["월드 저장","Saved Worlds","保存済みワールド"],["새 월드 이름","New world name","新しいワールド名"],["시드(선택)","Seed (optional)","シード（任意）"],["새 월드 만들기","Create World","ワールド作成"],["월드를 준비하고 있습니다…","Preparing world…","ワールドを準備中…"],["서바이벌로 시작","Start Survival","サバイバルで開始"],["크리에이티브로 시작","Start Creative","クリエイティブで開始"],["클릭해서 시작","Click to Start","クリックして開始"],["게임 메뉴","Game Menu","ゲームメニュー"],["게임으로 돌아가기","Back to Game","ゲームに戻る"],["저장하고 월드 선택","Save and Select World","保存してワールド選択"],["터치 조작","Touch Controls","タッチ操作"],["시점 변경","Change Camera","視点変更"],["저장","Save","保存"],["닫기","Close","閉じる"],["돌아가기","Back","戻る"],["인벤토리","Inventory","インベントリ"],["제작","Crafting","クラフト"],["레시피 북","Recipe Book","レシピ本"],["제작 결과","Crafting Result","クラフト結果"],["격자 비우기","Clear Grid","マスを空にする"],["재료","Materials","材料"],["보관 상자","Storage Chest","チェスト"],["내 소지품 · 36칸","My Inventory · 36 slots","持ち物・36スロット"],["상자 · 18칸","Chest · 18 slots","チェスト・18スロット"],["탐험 일지","Exploration Journal","探検日誌"],["새로운 바이옴을 발견하면 월드별로 자동 기록돼요.","New biomes are recorded automatically for each world.","新しいバイオームはワールドごとに自動記録されます。"],["현재 위치를 집으로 지정","Set Home Here","ここを家に設定"],["나만의 거점","My Waypoints","マイ拠点"],["현재 위치 기록","Save Current Location","現在地を記録"],["모험의 기록","Adventure Progress","冒険の記録"],["화로 · 광석 제련","Furnace · Smelting","かまど・製錬"],["연료 확인 중…","Checking fuel…","燃料を確認中…"],["거점 이름 (선택)","Waypoint name (optional)","拠点名（任意）"],["돌아가기 (Esc)","Back (Esc)","戻る (Esc)"],["닫기 (Esc)","Close (Esc)","閉じる (Esc)"],["조작","Controls","操作"],["설정","Settings","設定"],["계속하기","Resume","再開"],["월드 선택","Select World","ワールド選択"],["새 월드","New World","新しいワールド"],["모드 변경","Change Mode","モード変更"],["한국어","한국어","韓国語"]];
const languages={ko:'한국어',en:'English',ja:'日本語'};
const lookup=Object.create(null), reverse=Object.create(null);
for(const [ko,en,ja] of rows){lookup[ko]={ko,en,ja};for(const value of [ko,en,ja])if(value && !(value in reverse))reverse[value]=ko;}
const key='webcraft.language';
const params=new URLSearchParams(location.search);
const initial=params.get('lang');
let current=languages[initial]?initial:(()=>{try{return languages[localStorage.getItem(key)]?localStorage.getItem(key):'ko';}catch{return 'ko';}})();
const originals=new WeakMap();
const clean=s=>s.trim().replace(/\s+/g,' ');
function translateText(node){
 if(node.nodeType!==3)return;
 const value=node.nodeValue,trim=clean(value);
 if(!trim)return;
 let source=originals.get(node);
 if(!source||!(lookup[source])||(!Object.values(lookup[source]).includes(trim)&&trim!==source)){
  source=lookup[trim]?trim:reverse[trim];
  if(!source)return;
  originals.set(node,source);
 }
 const translated=lookup[source]?.[current]||source;
 if(trim===translated)return;
 node.nodeValue=value.replace(value.trim(),translated);
}
function translateElement(el){
 if(el.nodeType!==1)return;
 if(el.matches('script,style,textarea,code,[contenteditable="true"],.notranslate'))return;
 for(const name of ['placeholder','aria-label','title']){
  const val=el.getAttribute(name);
  if(!val)continue;
  const field='data-i18n-origin-'+name;
  let source=el.getAttribute(field);
  if(!source||(!lookup[source]&& !reverse[source])){
   source=lookup[val]?val:reverse[val];
   if(source)el.setAttribute(field,source);
  }
  if(source&&lookup[source])el.setAttribute(name,lookup[source][current]||source);
 }
 for(const child of Array.from(el.childNodes)){
  if(child.nodeType===3)translateText(child);
  else if(child.nodeType===1)translateElement(child);
 }
}
function apply(){
 document.documentElement.lang=current;
 document.title=current==='ko'?document.title.replace(/WebCraft.*/,document.title):'WebCraft — '+(current==='ja'?'ブラウザゲーム':'Browser Game');
 translateElement(document.body);
 for(const s of document.querySelectorAll('.webcraft-language-select'))s.value=current;
}
function selectFor(container){
 if(!container||container.querySelector('.webcraft-language-wrap'))return;
 const wrap=document.createElement('label');wrap.className='webcraft-language-wrap notranslate';
 const label=document.createElement('span');label.textContent='🌐 ';
 const select=document.createElement('select');select.className='webcraft-language-select';
 select.setAttribute('aria-label','Language / 언어 / 言語');
 for(const [code,name] of Object.entries(languages)){const opt=document.createElement('option');opt.value=code;opt.textContent=name;select.appendChild(opt);}
 select.value=current;select.addEventListener('change',()=>{current=select.value;try{localStorage.setItem(key,current);}catch{}apply();});
 wrap.append(label,select);container.appendChild(wrap);
}
const style=document.createElement('style');
style.textContent='.webcraft-language-wrap{display:inline-flex;align-items:center;gap:5px;position:relative;z-index:20;background:#2d2925;color:#fff;border:2px solid #141414;padding:5px 8px;font:12px sans-serif;white-space:nowrap}.webcraft-language-select{background:#303030;color:#fff;border:1px solid #aaa;border-radius:2px;padding:5px 7px;font:inherit;max-width:126px}.webcraft-language-select:focus-visible{outline:2px solid #ffe873}.classic-home .nav-actions .webcraft-language-wrap{margin-right:8px}@media(max-width:600px){.classic-home .nav-actions .webcraft-language-select{max-width:95px;padding:4px}.webcraft-language-wrap{padding:3px}} #overlay-start .webcraft-language-wrap,#overlay-pause .webcraft-language-wrap{margin:8px auto;display:flex;width:max-content}';
document.head.appendChild(style);
function init(){
 if(document.body.classList.contains('classic-home'))selectFor(document.querySelector('.nav-actions')||document.body);
 else{
 selectFor(document.querySelector('#overlay-start .panel'));
 selectFor(document.querySelector('#overlay-pause .panel'));
 }
 apply();
 // Game UI is rebuilt while playing; observe menus only, not the live rendering/HUD tree.
 const roots=document.body.classList.contains('classic-home')?[document.querySelector('#skin-studio')]:Array.from(document.querySelectorAll('[id^="overlay-"],#update-badge'));
 for(const root of roots.filter(Boolean)){
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;translateElement(root);});}).observe(root,{subtree:true,childList:true,characterData:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.WebCraftLanguage={get:()=>current,set(code){if(!languages[code])return;current=code;try{localStorage.setItem(key,code);}catch{}apply();}};
})();