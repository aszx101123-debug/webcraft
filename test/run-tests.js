'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lib = ['config.js', 'noise.js', 'terrain.js', 'items.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', 'game', f), 'utf8'))
  .join('\n;\n');
const body = fs.readFileSync(path.join(__dirname, 'test-body.js'), 'utf8');

vm.runInThisContext(lib + '\n;\n' + body, { filename: 'combined-tests.js' });
