# 📣 WebCraft 홍보 가이드

배포부터 SNS 문구, 커뮤니티 홍보글, 보도자료까지 — 복사해서 바로 쓸 수 있게 정리했습니다.

---

## 1. 한 줄 피치 (엘리베이터 피치)

> **"설치 없이, 클릭 한 번으로 브라우저에서 즐기는 마인크래프트 스타일 샌드박스 — WebCraft"**

핵심 키워드 3개: `무료` `설치 없음` `바로 플레이`

---

## 2. 먼저 배포하세요 (3가지 방법)

정적 웹사이트라 서버가 필요 없습니다. `webcraft` 폴더 전체를 올리면 끝.

### 방법 A — Netlify Drop (가장 빠름, 1분)
1. https://app.netlify.com/drop 접속
2. `webcraft` 폴더를 브라우저에 드래그 & 드롭
3. 즉시 `https://xxxx.netlify.app` 주소 발급 완료

### 방법 B — GitHub Pages (무료, 영구 주소)
```
cd webcraft
git init
git add .
git commit -m "WebCraft v1.0"
git branch -M main
git remote add origin https://github.com/아이디/webcraft.git
git push -u origin main
```
이후 저장소 Settings → Pages → Branch를 `main`으로 설정하면
`https://아이디.github.io/webcraft/` 로 배포됩니다.

### 방법 C — Vercel
```
cd webcraft
npx vercel --prod
```

### 배포 후 필수 체크
- [ ] 홈페이지가 열리고 "지금 플레이" 버튼 → 게임 실행 확인
- [ ] **index.html의 `og:image`를 절대 주소로 교체** (SNS 미리보기 이미지가 뜨려면 필요)
  - `img/og-image.png` → `https://배포주소/img/og-image.png`
- [ ] https://developers.facebook.com/tools/debug/ 에 주소 입력 → 미리보기 캐시 갱신
- [ ] 카카오톡으로 자신에게 링크 전송 → 미리보기 확인

---

## 3. SNS 홍보 문구

### 트위터(X) — 짧은 버전
> 브라우저에서 바로 도는 마인크래프트 스타일 게임 만들었습니다 ⛏
> 설치 0초, 가입 0초, 가격 0원.
> 클릭하면 3초 후엔 블록을 캐고 있습니다.
> ▶ [링크]

### 트위터(X) — 스레드 (3트윗)
> 1/ 마인크래프트가 하고 싶은데 설치가 귀찮은 사람들 모여보세요. 브라우저만 켜면 되는 WebCraft를 만들었습니다. 무료고 가입도 필요 없습니다. [링크]
>
> 2/ 할 수 있는 것들: 무한히 생성되는 지형(산/바다/숲/동굴), 12종 블록으로 건축, 낮밤 사이클, 자동 저장. 시드를 공유하면 친구랑 같은 지형에서 각자 집도 지을 수 있습니다.
>
> 3/ 조작법은 WASD + 마우스클릭 두 개. 배울 게 없습니다. 점심시간 10분이면 첫 집 완공. ▶ [링크]

### 인스타그램 캡션
> 노트북만 있으면 어디서든 새 세계 하나 ⛏
> WebCraft — 브라우저에서 바로 도는 블록 샌드박스
> 설치없음 · 가입없음 · 무료
> 프로필 링크로 플레이
> #웹게임 #마인크래프트스타일 #인디게임

### 카카오톡 메시지
> (이름)이 게임 만들었어 ㅋㅋ 브라우저서 바로 되는 마인크래프트 느낌! 설치 필요없고 무료야. 점심에 5분만 해봐 👉 [링크]

### 디스코드/커뮤니티 채널
> 웹에서 바로 도는 블록 샌드박스 WebCraft 공유합니다. 설치 없이 클릭만 하면 시작. 시드 공유로 같은 지형에서 놀기도 가능해요. [링크]

---

## 4. 커뮤니티 홍보글 템플릿

### 국내 커뮤니티 (자유게시판 스타일)

**제목:** 브라우저에서 바로 되는 마인크래프트 스타일 게임 만들었습니다

> 안녕하세요, 취미로 웹게임 만드는 사람입니다.
>
> 마크가 갑자기 하고 싶은데 실행 파일 받기 귀찮아서, 그냥 브라우저에서 바로 되는 걸 하나 만들어봤습니다.
>
> **WebCraft** — 설치 없이, 가입 없이, 무료
>
> - 무한히 생성되는 지형 (시드 기반 — 산, 바다, 숲, 동굴)
> - 블록 12종 캐기/쌓기, 낮밤 사이클, 자동 저장
> - 조작법: WASD 이동, 좌클릭 캐기, 우클릭 놓기. 이게 전부입니다
> - 시드를 공유하면 친구랑 같은 지형에서 각자 플레이 가능
>
> ▶ [링크]
>
> 피드백 환영합니다. 다음 업뎃은 모바일 터치 지원 생각 중인데 어떤 게 더 필요할까요?

### 레딣 r/WebGames (영문)

**Title:** I built a Minecraft-style sandbox that runs instantly in the browser — no install, no signup, free

> Hey all! I made WebCraft, a lightweight voxel sandbox that boots in ~3 seconds from a link.
>
> - Procedural infinite terrain (mountains, oceans, forests, caves)
> - 12 block types, day/night cycle, auto-save
> - Controls: WASD + two mouse buttons. That's it.
> - Share a seed to play on identical terrain with friends
>
> Totally free, no ads: [LINK]
>
> Feedback welcome! Mobile touch controls are next on the roadmap.

---

## 5. 보도자료 양식 (블로그/매체용)

> **[WebCraft, 브라우저에서 바로 즐기는 블록 샌드박스 게임 공개]**
>
> (배포일) — 웹 게임 프로젝트 WebCraft가 정식 버전(v1.0)을 공개했다. WebCraft는 설치나 회원가입 없이 웹브라우저에서 즉시 플레이할 수 있는 마인크래프트 스타일 샌드박스 게임으로, 시드 기반 절차적 지형 생성으로 산맥·바다·숲·동굴이 무한히 펼쳐지는 오픈 월드를 제공한다.
>
> 12종 블록을 캐고 쌓는 건축 플레이, 10분 주기의 낮/밤 사이클, 브라우저 자동 저장, 비행 모드를 지원하며, 같은 시드를 공유하면 동일한 지형에서 여러 명이 각자 플레이할 수 있다.
>
> WebCraft는 누구나 무료로 즐길 수 있으며 [주소]에서 바로 플레이할 수 있다.

---

## 6. 해시태그 세트

**국내:** #웹게임 #무료게임 #마인크래프트스타일 #블록게임 #인디게임 #브라우저게임 #픽셀게임
**해외:** #webgame #browsergame #freegame #voxel #sandbox #indiedev #madewiththreejs

---

## 7. 홍보 운영 팁

1. **가장 강력한 무기는 "3초 시작"** — 홍보 문구에 항상 "설치 없음 / 클릭 즉 시작"을 넣으세요. 링크를 받은 사람의 이탈을 막는 게 홍보의 핵심입니다.
2. **시드 이벤트** — 멋진 시드를 찾으면 "시드 20260101으로 시작해보세요. 바로 앞에 폭포지형이 나옵니다" 같은 콘텐츠로 지속 홍보가 가능합니다.
3. **건축 자랑 채널** — 플레이어가 지은 집 스크린샷을 받아 리트윗/공유하면 UGC 순환이 생깁니다.
4. **업데이트 소식은 "무엇이 새로워졌는지 한 장 이미지"로** — `npm run images`로 새 지형 이미지를 자동 생성할 수 있습니다 (다른 시드를 넣어서).
5. **첫 반응 24시간이 중요** — 댓글·질문에는 빠르게 답하세요. "다음 업데이트에 반영하겠습니다"가 가장 좋은 홍보 문구입니다.

---

## 8. 배포 전 최종 체크리스트

- [ ] `npm test` 통과 (지형 로직 21케이스)
- [ ] `npm run images` 통과 (이미지 검증)
- [ ] Chrome/Edge에서 홈페이지 → 게임 플레이 흐름 테스트
- [ ] 게임에서 Esc → 저장 → 새로고침 → 이어하기 확인
- [ ] og:image 절대 주소로 교체
- [ ] 링크 미리보기(카톡/디스코드) 확인
