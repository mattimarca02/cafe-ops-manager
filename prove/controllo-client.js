/*
 * Controlla che il codice della pagina funzioni sui vecchi iPad:
 * - JavaScript solo ES5 (analizzato con acorn, ecmaVersion 5);
 * - niente funzioni JavaScript arrivate dopo (includes, Promise, fetch…);
 * - CSS senza grid, variabili CSS, gap, clamp, flexbox, calc, ecc.
 * Esegui con: node prove/controllo-client.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var acorn = require('acorn');

var RADICE = path.join(__dirname, '..');
var problemi = [];

function leggi(nome) { return fs.readFileSync(path.join(RADICE, nome), 'utf8'); }

function numeroRiga(testo, indice) { return testo.substring(0, indice).split('\n').length; }

// File HTML del progetto (quelli caricati su Apps Script).
var html = fs.readdirSync(RADICE).filter(function (n) { return /\.html$/.test(n); });

var API_MODERNE = [
  [/\.includes\(/, 'includes()'], [/\.startsWith\(/, 'startsWith()'], [/\.endsWith\(/, 'endsWith()'],
  [/\.padStart\(|\.padEnd\(/, 'padStart/padEnd()'], [/\.repeat\(/, 'repeat()'],
  [/Object\.assign|Object\.entries|Object\.values/, 'Object.assign/entries/values'],
  [/Array\.from|Array\.of/, 'Array.from/of'], [/\.find\(|\.findIndex\(/, 'find()/findIndex()'],
  [/\bPromise\b/, 'Promise'], [/\bfetch\(/, 'fetch()'], [/\bSymbol\b/, 'Symbol'],
  [/new (Map|Set|WeakMap|WeakSet)\b/, 'Map/Set'], [/URLSearchParams/, 'URLSearchParams'],
  [/\.closest\(/, 'closest()'], [/\.append\(|\.prepend\(|\.remove\(\)/, 'append/prepend/remove()'],
  [/requestIdleCallback|IntersectionObserver/, 'API recenti'], [/\.forEach\(/, 'forEach() su NodeList (usa perOgni)'],
  [/Number\.isNaN|Number\.isFinite|Number\.parseFloat|Math\.trunc|Math\.sign/, 'Number/Math ES6']
];

html.forEach(function (nome) {
  var testo = leggi(nome);
  var re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = re.exec(testo))) {
    var codice = m[1];
    if (/<\?/.test(codice)) codice = codice.replace(/<\?!?=?[\s\S]*?\?>/g, 'null');
    var inizio = numeroRiga(testo, m.index) - 1;
    try {
      acorn.parse(codice, { ecmaVersion: 5, sourceType: 'script' });
    } catch (e) {
      problemi.push(nome + ':' + (inizio + (e.loc ? e.loc.line : 0)) + ' non è ES5: ' + e.message);
    }
    var senzaBlocchi = codice.replace(/\/\*[\s\S]*?\*\//g, function (c) { return c.replace(/[^\n]/g, ' '); });
    var righeOriginali = codice.split('\n');
    senzaBlocchi.split('\n').forEach(function (rigaPulita, i) {
      var riga = righeOriginali[i];
      var senzaCommenti = rigaPulita.replace(/\/\/.*$/, '');
      API_MODERNE.forEach(function (api) {
        if (api[0].test(senzaCommenti) && !/es5-ok/.test(riga)) {
          problemi.push(nome + ':' + (inizio + i + 1) + ' usa ' + api[1] + ': ' + riga.trim());
        }
      });
    });
  }

  var reStile = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = reStile.exec(testo))) {
    var css = m[1].replace(/\/\*[\s\S]*?\*\//g, function (c) { return c.replace(/[^\n]/g, ' '); });
    var inizioCss = numeroRiga(testo, m.index) - 1;
    var VIETATI = [
      [/display\s*:\s*(-webkit-|-ms-)?(inline-)?(flex|grid|box)/i, 'flexbox/grid'],
      [/\bgrid-/i, 'CSS Grid'], [/var\(\s*--|--[a-z0-9-]+\s*:/i, 'variabili CSS'],
      [/(^|[\s;{])(row-|column-)?gap\s*:/i, 'gap'], [/clamp\(|\bmin\(|\bmax\(/i, 'clamp/min/max'],
      [/calc\(/i, 'calc()'], [/position\s*:\s*sticky/i, 'position: sticky'], [/object-fit/i, 'object-fit'],
      [/\bflex(-[a-z]+)?\s*:/i, 'proprietà flex'], [/aspect-ratio/i, 'aspect-ratio'], [/@supports/i, '@supports'],
      [/\binset\s*:/i, 'inset']
    ];
    css.split('\n').forEach(function (riga, i) {
      VIETATI.forEach(function (v) {
        if (v[0].test(riga)) problemi.push(nome + ':' + (inizioCss + i + 1) + ' CSS non compatibile (' + v[1] + '): ' + riga.trim());
      });
    });
  }
});

if (problemi.length) {
  console.error('✗ Controllo pagina (ES5 e CSS): ' + problemi.length + ' problemi');
  problemi.forEach(function (p) { console.error('  • ' + p); });
  process.exitCode = 1;
} else {
  console.log('✓ Controllo pagina: JavaScript ES5 e CSS compatibili con i vecchi iPad (' + html.join(', ') + ').');
}
