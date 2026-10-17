/*
 * Carica i file .gs del progetto nell'Apps Script finto (prove/gas-finto.js).
 * Le funzioni dei file .gs diventano globali, come in Apps Script.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var gas = require('./gas-finto');

var RADICE = path.join(__dirname, '..');

function fileGs() {
  return fs.readdirSync(RADICE).filter(function (n) { return /\.gs$/.test(n); }).sort();
}

var caricato = false;

function carica() {
  if (caricato) return gas;
  gas.installa(globalThis);
  fileGs().forEach(function (nome) {
    var codice = fs.readFileSync(path.join(RADICE, nome), 'utf8');
    vm.runInThisContext(codice, { filename: nome });
  });
  caricato = true;
  return gas;
}

/** Foglio nuovo e vuoto + setup(), come dopo l'installazione. */
function nuovoFoglio() {
  carica();
  gas.azzera();
  globalThis.setup();
  return gas;
}

module.exports = { carica: carica, nuovoFoglio: nuovoFoglio, fileGs: fileGs, RADICE: RADICE };
