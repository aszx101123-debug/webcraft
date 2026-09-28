# WebCraft — POGL 업로드용 게임 패키지

이 폴더는 기존 WebCraft 사이트의 홈페이지/프로토타입/방명록을 제외하고 게임 본체만 따로 넣을 수 있도록 만든 업로드용 패키지입니다.

## 구조
- `index.html` — 게임 시작점
- `css/game.css` — 게임 UI
- `js/game/` — 월드, 지형, 플레이어, 제작, 아이템, 몹, 저장, UI 등
- `vendor/three.min.js` — Three.js r128 로컬 포함본

## POGL 사용
공개된 pogl-cli 안내 기준으로 `index.html`이 있는 게임 폴더를 배포 대상으로 사용합니다.
따라서 이 `pogl-game` 폴더를 게임 프로젝트의 루트로 사용하면 됩니다.

기존 `index.html`, `play.html`, `prototype.html` 및 다른 WebCraft 파일은 그대로 유지됩니다.
