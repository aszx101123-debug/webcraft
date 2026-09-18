'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let w = 0, h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = (x, y) => {
    const i = y * (stride + 1) + 1 + x * 4;
    return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]];
  };
  return { w, h, px, raw };
}

const dir = path.join(__dirname, '..', 'img');
let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  \u2713 ' + msg);
  else { fails++; console.error('  \u2717 FAIL: ' + msg); }
}

const og = decodePNG(path.join(dir, 'og-image.png'));
console.log('[og-image.png]', og.w + 'x' + og.h);
ok(og.w === 1200 && og.h === 630, '크기 1200x630');
const sky = og.px(50, 15);
ok(sky[2] > sky[0] && sky[2] > 150, `상단 하늘 색 (b=${sky[2]})`);
let titlePx = 0;
for (let y = 40; y < 135; y++) for (let x = 300; x < 900; x++) {
  const p = og.px(x, y);
  if (p[0] > 230 && p[1] > 230 && p[2] > 230) titlePx++;
}
ok(titlePx > 3000, `타이틀 흰색 픽셀 존재 (${titlePx})`);
const colors = new Set();
let greenCount = 0;
for (let y = 0; y < 630; y += 3) for (let x = 0; x < 1200; x += 3) {
  const p = og.px(x, y);
  colors.add((p[0] >> 4) + ',' + (p[1] >> 4) + ',' + (p[2] >> 4));
  if (p[1] > p[0] + 20 && p[1] > p[2] + 20) greenCount++;
}
ok(colors.size > 150, `색상 다양성 (${colors.size} buckets)`);
ok(greenCount > 500, `잔디/ terrain 녹색 픽셀 (${greenCount})`);

const night = decodePNG(path.join(dir, 'shot-night.png'));
console.log('[shot-night.png]', night.w + 'x' + night.h);
const nsky = night.px(30, 10);
ok(nsky[2] > nsky[0] && nsky[0] < 60, `야간 하늘 어두움 (r=${nsky[0]}, b=${nsky[2]})`);
let starPx = 0;
for (let y = 0; y < 300; y += 2) for (let x = 0; x < 900; x += 2) {
  const p = night.px(x, y);
  if (p[0] > 200 && p[1] > 200 && p[2] > 200) starPx++;
}
ok(starPx > 20, `별 존재 (${starPx} 샘플)`);
let glowPx = 0;
for (let y = 0; y < 560; y += 2) for (let x = 0; x < 900; x += 2) {
  const p = night.px(x, y);
  if (p[0] > 200 && p[1] > 170 && p[2] < 160) glowPx++;
}
ok(glowPx > 5, `발광석 노란 픽셀 (${glowPx})`);

const coast = decodePNG(path.join(dir, 'shot-coast.png'));
console.log('[shot-coast.png]', coast.w + 'x' + coast.h);
let waterPx = 0;
for (let y = 0; y < 560; y += 2) for (let x = 0; x < 900; x += 2) {
  const p = coast.px(x, y);
  if (p[2] > p[0] + 30 && p[2] > 140) waterPx++;
}
ok(waterPx > 200, `물(파랑) 픽셀 (${waterPx})`);

const forest = decodePNG(path.join(dir, 'shot-forest.png'));
console.log('[shot-forest.png]', forest.w + 'x' + forest.h);
let darkGreen = 0;
for (let y = 0; y < 560; y += 2) for (let x = 0; x < 900; x += 2) {
  const p = forest.px(x, y);
  if (p[1] > p[0] + 15 && p[1] > p[2] + 15 && p[1] < 150) darkGreen++;
}
ok(darkGreen > 100, `나무(진녹색) 픽셀 (${darkGreen})`);

const icon = decodePNG(path.join(dir, 'icon-512.png'));
console.log('[icon-512.png]', icon.w + 'x' + icon.h);
ok(icon.w === 512 && icon.h === 512, '크기 512x512');
const corner = icon.px(2, 2);
ok(corner[3] === 0, `모서리 투명 (a=${corner[3]})`);
const mid = icon.px(256, 256);
const top = icon.px(256, 256 - 30);
ok(top[1] > top[0] && top[1] > 100, `중앙 상단 잔디색 (rgb=${top.slice(0, 3)})`);

console.log(fails ? '\n' + fails + '개 실패' : '\n이미지 검증 통과');
if (fails) process.exit(1);
