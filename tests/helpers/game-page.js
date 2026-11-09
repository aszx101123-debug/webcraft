'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');

// play.html loads the engine through a shared guest loader; mobile-test.html uses tags.
module.exports = function gamePage(page) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const loader = html.match(/<script\b[^>]*\bsrc=["'](js\/auth-play\.js(?:\?[^"']*)?)["']/);
  return loader ? html + '\n' + fs.readFileSync(path.join(root, loader[1].split('?')[0]), 'utf8') : html;
};
