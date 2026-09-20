'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lib = ['config.js', 'noise.js', 'terrain.js', 'items.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', 'game', f), 'utf8'))
  .join('\n;\n');
const body = fs.readFileSync(path.join(__dirname, 'test-body.js'), 'utf8');

const configText = fs.readFileSync(path.join(__dirname, '..', 'js', 'game', 'config.js'), 'utf8');
const homepageText = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const playText = fs.readFileSync(path.join(__dirname, '..', 'play.html'), 'utf8');
const version = (configText.match(/VERSION:\s*'([^']+)'/) || [])[1];
if (!version) throw new Error('VERSION not found in config.js');
if (!homepageText.includes('LATEST UPDATE · v' + version)) throw new Error('Homepage version is out of sync: ' + version);
if (!homepageText.includes('현재 버전 <b>v' + version + '</b>')) throw new Error('Homepage current-version badge is out of sync: ' + version);
if (!playText.includes('업데이트됨 · v' + version)) throw new Error('Play-page version is out of sync: ' + version);

vm.runInThisContext(lib + '\n;\n' + body, { filename: 'combined-tests.js' });
