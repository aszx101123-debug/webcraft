'use strict';

const gamePage = require('./game-page');

// Include the shared guest loader as well as ordinary script tags.
module.exports = function gameAssets(page) {
  return [...gamePage(page).matchAll(/["'](js\/game\/[^"'?\s]+\.js(?:\?[^"'\s]+)?)["']/g)]
    .map(match => match[1]);
};
