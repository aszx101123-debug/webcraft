/* WebCraft locale layer: translates interface text without changing game logic. */
(()=>{'use strict';
const rows=[["게임 모드","Game Modes","ゲームモード"],["조작법","Controls","操作方法"],["업데이트","Updates","アップデート"],["플레이","Play","プレイ"],["싱글플레이","Singleplayer","シングルプレイ"],["캐고, 만들고, 살아남으세요!","Mine, build, and survive!","掘って、作って、生き残ろう！"],["시작 화면에서 월드와 게임 모드를 선택하세요.","Select your world and game mode on the start screen.","開始画面でワールドとゲームモードを選んでください。"],["두 가지 플레이 방식","Two Ways to Play","2つのプレイスタイル"],["나무를 캐서 첫 집을 짓거나, 무한한 블록으로 자유롭게 만들어 보세요.","Gather wood to build your first shelter, or build freely with unlimited blocks.","木を集めて最初の家を建てるか、無限のブロックで自由に建築しましょう。"],["서바이벌","Survival","サバイバル"],["크리에이티브","Creative","クリエイティブ"],["자원을 모으고 도구를 제작하세요. 체력과 배고픔을 챙기고 밤의 몬스터를 조심하세요.","Gather resources, craft tools, and survive the night.","資源を集め、道具を作り、夜のモンスターから生き残ろう。"],["블록을 자유롭게 고르고 하늘을 날며 건축하세요. 체력과 자원 걱정 없이 만들 수 있습니다.","Build freely with unlimited blocks and flight.","ブロックを自由に選び、空を飛んで建築できます。"],["기본 조작","Basic Controls","基本操作"],["이동","Move","移動"],["점프 · 수영 · 비행 상승","Jump · Swim · Fly up","ジャンプ・泳ぐ・上昇"],["웅크리기 · 비행 하강","Crouch · Fly down","しゃがむ・下降"],["달리기","Sprint","ダッシュ"],["채굴·공격 / 블록 설치·사용","Mine/Attack · Place/Use","採掘・攻撃／設置・使用"],["핫바 선택","Select hotbar slot","ホットバー選択"],["인벤토리 · 2×2 개인 제작","Inventory · 2×2 crafting","インベントリ・2×2クラフト"],["선택 아이템 버리기","Drop selected item","選択アイテムを捨てる"],["HUD 숨기기 / 디버그 / 시점 전환","Hide HUD / Debug / Camera","HUD非表示／デバッグ／視点"],["일시정지 · 저장","Pause · Save","一時停止・保存"],["첫날의 준비","Your First Day","最初の日の準備"],["나무를 캐서 판자로 바꾸세요.","Mine wood and turn it into planks.","木を採掘して板材にしましょう。"],["인벤토리의 2×2 제작 칸에서 제작대를 만드세요.","Craft a crafting table using the 2×2 inventory grid.","インベントリの2×2欄で作業台を作りましょう。"],["제작대를 설치하고 우클릭하면 3×3 제작을 할 수 있습니다.","Place and use the crafting table for 3×3 recipes.","作業台を設置して使うと3×3クラフトができます。"],["도구와 횃불을 만들고 해가 지기 전에 쉴 곳을 마련하세요.","Craft tools and torches, then find shelter before sunset.","道具と松明を作り、日暮れまでに避難所を用意しましょう。"],["모바일에서는 왼쪽 조이스틱으로 이동하고, 화면을 드래그해 둘러봅니다. 짧게 터치하면 사용·설치, 길게 누르면 채굴합니다.","On mobile, move with the joystick and drag to look around. Tap to use/place, hold to mine.","モバイルではジョイスティックで移動し、ドラッグで視点変更。タップで使用・設置、長押しで採掘。"],["익숙한 블록 게임으로","A Familiar Block-Game Feel","親しみやすいブロックゲームへ"],["복잡한 안내와 부가 화면을 덜어내고, 기본 플레이에 집중했습니다.","Less clutter, more focus on playing.","複雑な表示を減らし、基本プレイに集中しました。"],["단정한 픽셀 메뉴와 핫바","Clean pixel menus and hotbar","シンプルなピクセルメニューとホットバー"],["Shift 웅크리기 · Ctrl 달리기","Shift crouch · Ctrl sprint","Shiftでしゃがむ・Ctrlで走る"],["시간과 연료를 사용하는 화로","Timed, fuel-powered furnace","燃料と時間を使うかまど"],["익숙한 인벤토리와 제작 화면","Classic inventory and crafting","クラシックなインベントリとクラフト"],["현재 버전","Current version","現在のバージョン"],["기존 월드를 그대로 이어서 플레이할 수 있습니다.","Continue playing your existing worlds.","既存のワールドをそのまま続けられます。"],["게임 시작","Start Game","ゲーム開始"],["이전 업데이트","Previous Updates","過去のアップデート"],["스킨 설정","Skin Settings","スキン設定"],["캐릭터 모습","Character Appearance","キャラクターの見た目"],["원하면 캐릭터의 색상과 옷을 바꿀 수 있습니다. 기존 월드에도 적용됩니다.","Change your character's colors and outfit. Changes also apply to existing worlds.","キャラクターの色や服を変更できます。既存ワールドにも反映されます。"],["뒤에서 보기","View Back","背面を見る"],["랜덤 스킨","Random Skin","ランダムスキン"],["기본 모습","Default Look","初期スキン"],["스타일부터 골라 보자","Choose Your Style","スタイルを選ぼう"],["스킨 저장","Save Skin","スキンを保存"],["이 스킨으로 플레이","Play with This Skin","このスキンでプレイ"],["색상을 고르면 자동 저장돼요","Colors are saved automatically","色は自動保存されます"],["플레이어 방명록","Player Guestbook","プレイヤー掲示板"],["WebCraft 방명록","WebCraft Guestbook","WebCraft 掲示板"],["플레이 후 한마디를 남겨주세요. 사이트에 공개되는 공용 방명록입니다.","Leave a message after playing. This guestbook is public.","プレイ後に感想を残してください。公開掲示板です。"],["GitHub에서 작성","Post on GitHub","GitHubに投稿"],["개인정보나 연락처는 남기지 마세요.","Do not post personal or contact information.","個人情報や連絡先は投稿しないでください。"],["저장과 플레이 안내","Saving and Playing","保存とプレイについて"],["월드는 어떻게 저장되나요?","How are worlds saved?","ワールドはどう保存されますか？"],["인터넷이 필요한가요?","Do I need internet?","インターネットは必要ですか？"],["마인크래프트와 같은 게임인가요?","Is this Minecraft?","Minecraftと同じゲームですか？"],["게임을 준비하지 못했습니다","Unable to Start Game","ゲームを起動できませんでした"],["브라우저에서 WebCraft 초기화 중 문제가 발생했습니다.","WebCraft failed to initialize in this browser.","ブラウザでWebCraftの初期化に失敗しました。"],["다시 불러오기","Reload","再読み込み"],["홈으로","Home","ホームへ"],["공격 준비","Attack Ready","攻撃準備"],["월드 저장","Saved Worlds","保存済みワールド"],["새 월드 이름","New world name","新しいワールド名"],["시드(선택)","Seed (optional)","シード（任意）"],["새 월드 만들기","Create World","ワールド作成"],["월드를 준비하고 있습니다…","Preparing world…","ワールドを準備中…"],["서바이벌로 시작","Start Survival","サバイバルで開始"],["크리에이티브로 시작","Start Creative","クリエイティブで開始"],["클릭해서 시작","Click to Start","クリックして開始"],["게임 메뉴","Game Menu","ゲームメニュー"],["게임으로 돌아가기","Back to Game","ゲームに戻る"],["저장하고 월드 선택","Save and Select World","保存してワールド選択"],["터치 조작","Touch Controls","タッチ操作"],["시점 변경","Change Camera","視点変更"],["저장","Save","保存"],["닫기","Close","閉じる"],["돌아가기","Back","戻る"],["인벤토리","Inventory","インベントリ"],["제작","Crafting","クラフト"],["레시피 북","Recipe Book","レシピ本"],["제작 결과","Crafting Result","クラフト結果"],["격자 비우기","Clear Grid","マスを空にする"],["재료","Materials","材料"],["보관 상자","Storage Chest","チェスト"],["내 소지품 · 36칸","My Inventory · 36 slots","持ち物・36スロット"],["상자 · 18칸","Chest · 18 slots","チェスト・18スロット"],["탐험 일지","Exploration Journal","探検日誌"],["새로운 바이옴을 발견하면 월드별로 자동 기록돼요.","New biomes are recorded automatically for each world.","新しいバイオームはワールドごとに自動記録されます。"],["현재 위치를 집으로 지정","Set Home Here","ここを家に設定"],["나만의 거점","My Waypoints","マイ拠点"],["현재 위치 기록","Save Current Location","現在地を記録"],["모험의 기록","Adventure Progress","冒険の記録"],["화로 · 광석 제련","Furnace · Smelting","かまど・製錬"],["연료 확인 중…","Checking fuel…","燃料を確認中…"],["거점 이름 (선택)","Waypoint name (optional)","拠点名（任意）"],["돌아가기 (Esc)","Back (Esc)","戻る (Esc)"],["닫기 (Esc)","Close (Esc)","閉じる (Esc)"],["조작","Controls","操作"],["설정","Settings","設定"],["계속하기","Resume","再開"],["월드 선택","Select World","ワールド選択"],["새 월드","New World","新しいワールド"],["모드 변경","Change Mode","モード変更"],["한국어","한국어","韓国語"]];
rows.push(...[["잔디 블록","Grass Block","草ブロック"],["흙","Dirt","土"],["돌","Stone","石"],["조약돌","Cobblestone","丸石"],["모래","Sand","砂"],["통나무","Log","原木"],["잎","Leaves","葉"],["판자","Planks","板材"],["유리","Glass","ガラス"],["벽돌","Bricks","レンガ"],["발광석","Glowstone","グロウストーン"],["물","Water","水"],["기반암","Bedrock","岩盤"],["제작대","Crafting Table","作業台"],["석탄 광석","Coal Ore","石炭鉱石"],["철 광석","Iron Ore","鉄鉱石"],["금 광석","Gold Ore","金鉱石"],["구리 광석","Copper Ore","銅鉱石"],["레드스톤 광석","Redstone Ore","レッドストーン鉱石"],["청금석 광석","Lapis Lazuli Ore","ラピスラズリ鉱石"],["다이아몬드 광석","Diamond Ore","ダイヤモンド鉱石"],["에메랄드 광석","Emerald Ore","エメラルド鉱石"],["흐르는 물","Flowing Water","流れる水"],["눈","Snow","雪"],["화로","Furnace","かまど"],["횃불","Torch","松明"],["자갈","Gravel","砂利"],["자연","Nature","自然"],["점토","Clay","粘土"],["사암","Sandstone","砂岩"],["석재","Stonework","石材"],["석재 벽돌","Stone Bricks","石レンガ"],["매끄러운 돌","Smooth Stone","滑らかな石"],["이끼 낀 조약돌","Mossy Cobblestone","苔むした丸石"],["자작나무 원목","Birch Log","シラカバの原木"],["목재","Wood","木材"],["자작나무 잎","Birch Leaves","シラカバの葉"],["자작나무 판자","Birch Planks","シラカバの板材"],["가문비나무 원목","Spruce Log","トウヒの原木"],["가문비나무 잎","Spruce Leaves","トウヒの葉"],["가문비나무 판자","Spruce Planks","トウヒの板材"],["선인장","Cactus","サボテン"],["책장","Bookshelf","本棚"],["장식","Decoration","装飾"],["돌 반 블록","Stone Slab","石のハーフブロック"],["나무 계단","Wooden Stairs","木の階段"],["나무 문","Wooden Door","木のドア"],["상자","Chest","チェスト"],["나무 문 윗부분","Upper Door","ドア上部"],["돼지고기","Raw Porkchop","生の豚肉"],["소고기","Raw Beef","生の牛肉"],["닭고기","Raw Chicken","生の鶏肉"],["양고기","Raw Mutton","生の羊肉"],["썩은 고기","Rotten Flesh","腐った肉"],["사과","Apple","リンゴ"],["가죽","Leather","革"],["석탄","Coal","石炭"],["철 주괴","Iron Ingot","鉄インゴット"],["금 주괴","Gold Ingot","金インゴット"],["구리 주괴","Copper Ingot","銅インゴット"],["레드스톤","Redstone","レッドストーン"],["청금석","Lapis Lazuli","ラピスラズリ"],["다이아몬드","Diamond","ダイヤモンド"],["에메랄드","Emerald","エメラルド"],["막대기","Stick","棒"],["돼지","Pig","ブタ"],["좀비","Zombie","ゾンビ"],["스켈레톤","Skeleton","スケルトン"],["거미","Spider","クモ"],["광석","Ore","鉱石"],["평원","Plains","平原"],["숲","Forest","森林"],["정글","Jungle","ジャングル"],["늪지대","Swamp","沼地"],["침엽수림","Taiga","タイガ"],["설산","Snowy Mountains","雪山"],["사막","Desert","砂漠"],["고지대","Highlands","高地"],["나무 곡괭이","Wooden Pickaxe","木のツルハシ"],["나무 벌목기","Wooden Axe","木の斧"],["나무 삽","Wooden Shovel","木のシャベル"],["나무 괭이","Wooden Hoe","木のクワ"],["나무 검","Wooden Sword","木の剣"],["돌 곡괭이","Stone Pickaxe","石のツルハシ"],["돌 벌목기","Stone Axe","石の斧"],["돌 삽","Stone Shovel","石のシャベル"],["돌 괭이","Stone Hoe","石のクワ"],["돌 검","Stone Sword","石の剣"],["철 곡괭이","Iron Pickaxe","鉄のツルハシ"],["철 벌목기","Iron Axe","鉄の斧"],["철 삽","Iron Shovel","鉄のシャベル"],["철 괭이","Iron Hoe","鉄のクワ"],["철 검","Iron Sword","鉄の剣"],["금 곡괭이","Golden Pickaxe","金のツルハシ"],["금 벌목기","Golden Axe","金の斧"],["금 삽","Golden Shovel","金のシャベル"],["금 괭이","Golden Hoe","金のクワ"],["금 검","Golden Sword","金の剣"],["다이아몬드 곡괭이","Diamond Pickaxe","ダイヤモンドのツルハシ"],["다이아몬드 벌목기","Diamond Axe","ダイヤモンドの斧"],["다이아몬드 삽","Diamond Shovel","ダイヤモンドのシャベル"],["다이아몬드 괭이","Diamond Hoe","ダイヤモンドのクワ"],["다이아몬드 검","Diamond Sword","ダイヤモンドの剣"],["가죽 투구","Leather Helmet","革のヘルメット"],["가죽 흉갑","Leather Chestplate","革のチェストプレート"],["가죽 레깅스","Leather Leggings","革のレギンス"],["가죽 부츠","Leather Boots","革のブーツ"],["돌 투구","Stone Helmet","石のヘルメット"],["돌 흉갑","Stone Chestplate","石のチェストプレート"],["돌 레깅스","Stone Leggings","石のレギンス"],["돌 부츠","Stone Boots","石のブーツ"],["철 투구","Iron Helmet","鉄のヘルメット"],["철 흉갑","Iron Chestplate","鉄のチェストプレート"],["철 레깅스","Iron Leggings","鉄のレギンス"],["철 부츠","Iron Boots","鉄のブーツ"],["금 투구","Golden Helmet","金のヘルメット"],["금 흉갑","Golden Chestplate","金のチェストプレート"],["금 레깅스","Golden Leggings","金のレギンス"],["금 부츠","Golden Boots","金のブーツ"],["다이아몬드 투구","Diamond Helmet","ダイヤモンドのヘルメット"],["다이아몬드 흉갑","Diamond Chestplate","ダイヤモンドのチェストプレート"],["다이아몬드 레깅스","Diamond Leggings","ダイヤモンドのレギンス"],["다이아몬드 부츠","Diamond Boots","ダイヤモンドのブーツ"],["불러오기","Load","読み込む"],["삭제","Delete","削除"],["저장된 월드가 없습니다.","No saved worlds.","保存済みワールドがありません。"],["월드는 하나 이상 유지됩니다","At least one world must remain","ワールドは最低1つ必要です"],["빈 슬롯","Empty slot","空きスロット"],["빈 칸","Empty slot","空きスロット"],["빈 장비 슬롯","Empty equipment slot","装備スロットが空です"],["피부 색상","Skin Color","肌の色"],["머리 색상","Hair Color","髪の色"],["헤어스타일","Hairstyle","髪型"],["눈 색상","Eye Color","目の色"],["상의","Top","上着"],["옷 디테일","Outfit Details","服の詳細"],["바지","Pants","ズボン"],["신발","Shoes","靴"],["액세서리","Accessory","アクセサリー"],["앞에서 보기","Front View","正面から見る"],["비어 있음","Empty","空"],["켬","On","オン"],["끔","Off","オフ"],["커서: 비어 있음","Cursor: Empty","カーソル：空"],["제작 완료","Crafted!","クラフト完了"],["재료가 부족합니다","Not enough materials","材料が足りません"],["제련 재료","Smelting Input","製錬する材料"],["연료","Fuel","燃料"],["제련 진행","Smelting Progress","製錬の進行"],["완성품","Output","完成品"],["월드가 저장되었습니다","World saved","ワールドを保存しました"],["✓ 월드 저장됨","✓ World saved","✓ ワールド保存済み"],["서바이벌 모드 — 행운을 빕니다","Survival mode — Good luck!","サバイバルモード・頑張って！"],["크리에이티브 모드","Creative mode","クリエイティブモード"],["새 월드 생성","Create new world","新しいワールドを作成"],["이동 조이스틱","Movement Joystick","移動ジョイスティック"],["점프","Jump","ジャンプ"],["비행 시작","Flying enabled","飛行開始"],["비행 종료","Flying disabled","飛行終了"],["1인칭","First Person","一人称"],["3인칭 뒤","Third Person (Back)","三人称（背面）"],["3인칭 앞","Third Person (Front)","三人称（正面）"],["시야","Field of View","視野"],["마우스 감도","Mouse Sensitivity","マウス感度"],["마우스 Y축 반전","Invert Mouse Y Axis","マウスY軸反転"],["렌더 거리","Render Distance","描画距離"],["청크","Chunks","チャンク"],["전체","All","すべて"],["블록 이름 검색...","Search blocks...","ブロックを検索..."],["블록 분류","Block Category","ブロック分類"],["캐릭터와 장비","Character & Equipment","キャラクターと装備"],["보조 손","Offhand","オフハンド"],["2×2 개인 제작","2×2 Personal Crafting","2×2個人クラフト"],["크리에이티브 아이템 목록","Creative Item Catalog","クリエイティブアイテム一覧"],["블록·아이템 검색","Search Blocks & Items","ブロック・アイテム検索"],["내 소지품","My Inventory","持ち物"],["발견한 바이옴","Discovered Biomes","発見したバイオーム"],["기록한 거점","Saved Waypoints","保存した拠点"],["진행 목표","Progress Goals","進行目標"],["현재 위치","Current Position","現在地"],["월드 시드","World Seed","ワールドシード"],["바이옴","Biome","バイオーム"],["내구도","Durability","耐久値"],["슬롯","Slot","スロット"],["새 바이옴 발견","New biome discovered","新しいバイオーム発見"],["현재 손에 든","Currently holding","現在持っている"],["알 수 없음","Unknown","不明"]]);
const languages={ko:'한국어',en:'English',ja:'日本語'};
const lookup=Object.create(null), reverse=Object.create(null);
for(const [ko,en,ja] of rows){lookup[ko]={ko,en,ja};for(const value of [ko,en,ja])if(value && !(value in reverse))reverse[value]=ko;}
const key='webcraft.language';
const params=new URLSearchParams(location.search);
const initial=params.get('lang');
let current=languages[initial]?initial:(()=>{try{return languages[localStorage.getItem(key)]?localStorage.getItem(key):'ko';}catch{return 'ko';}})();
const originals=new WeakMap();
const clean=s=>s.trim().replace(/\s+/g,' ');
const compound=Object.keys(lookup).filter(k=>/[가-힣]/.test(k)).sort((a,b)=>b.length-a.length);
const escapeRegex=s=>Array.from(s).map(c=>'\\.^$*+?()[]{}|'.includes(c)?'\\'+c:c).join('');
function localize(source){
 if(current==='ko')return source;
 if(lookup[source])return lookup[source][current]||source;
 let out=source;
 for(const k of compound){
  if(!out.includes(k))continue;
  const value=lookup[k][current];
  if(!value||value===k)continue;
  // Avoid changing the middle of longer Korean words.
  const re=new RegExp('(?<![가-힣])'+escapeRegex(k)+'(?![가-힣])','g');
  out=out.replace(re,value);
 }
 return out;
}
function translateText(node){
 if(node.nodeType!==3)return;
 const raw=node.nodeValue,trim=clean(raw);
 if(!trim)return;
 let source=originals.get(node);
 if(!source||(!source.includes('가')&&!/[가-힣]/.test(source))||(trim!==source&&trim!==clean(localize(source)))){
  source=lookup[trim]?trim:(reverse[trim]||trim);
  originals.set(node,source);
 }
 const value=localize(source);
 if(trim===value)return;
 node.nodeValue=raw.replace(raw.trim(),value);
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
  else if(!source&&/[가-힣]/.test(val))el.setAttribute(name,localize(val));
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
 if(!container)return;
 const existing=container.querySelector('.webcraft-language-wrap');
 if(existing){const control=existing.querySelector('.webcraft-language-select');if(control){control.value=current;if(!control.dataset.languageBound){control.dataset.languageBound='true';control.addEventListener('change',()=>{current=control.value;try{localStorage.setItem(key,current);}catch{}apply();});}}return;}
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
style.textContent += '.webcraft-hero-language{display:flex;justify-content:center;margin:0 auto 20px}.webcraft-hero-language .webcraft-language-wrap{padding:9px 13px;background:#1e1c1bdc;border:2px solid #ddd;box-shadow:2px 2px 0 #111}.webcraft-hero-language .webcraft-language-select{min-width:130px;font-size:14px}.classic-home .classic-title-menu .webcraft-hero-language{position:relative;z-index:5}';document.head.appendChild(style);
function init(){
 if(document.body.classList.contains('classic-home')){
  selectFor(document.querySelector('.nav-actions')||document.body);
  const hero=document.querySelector('.classic-title-menu');
  if(hero){
    let spot=hero.querySelector('#webcraft-hero-language');
    if(!spot){
      spot=document.createElement('div');
      spot.id='webcraft-hero-language';
      spot.className='webcraft-hero-language';
      const menu=hero.querySelector('.classic-menu-buttons');
      if(menu)hero.insertBefore(spot,menu);
      else hero.appendChild(spot);
    }
    selectFor(spot);
  }
}
 else{
 selectFor(document.querySelector('#overlay-start .panel'));
 selectFor(document.querySelector('#overlay-pause .panel'));
 }
 apply();
 // Game UI is rebuilt while playing; observe menus only, not the live rendering/HUD tree.
 const roots=document.body.classList.contains('classic-home')?[document.querySelector('#skin-studio')]:Array.from(document.querySelectorAll('[id^="overlay-"],#update-badge'));
 // Translate interface elements created at runtime (inventory, crafting, HUD, toast, journal).
 const observer=new MutationObserver(records=>{
  const elements=new Set(),texts=new Set();
  for(const record of records){
   if(record.type==='characterData'){texts.add(record.target);continue;}
   for(const node of record.addedNodes){
    if(node.nodeType===3)texts.add(node);
    else if(node.nodeType===1)elements.add(node);
   }
  }
  for(const node of elements)if(node.isConnected)translateElement(node);
  for(const node of texts)if(node.isConnected)translateText(node);
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.WebCraftLanguage={get:()=>current,set(code){if(!languages[code])return;current=code;try{localStorage.setItem(key,code);}catch{}apply();}};
})();