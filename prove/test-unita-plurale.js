/*
 * Prove di singolare e plurale delle unità (Script.html, funzioni pure) e della colonna «Unità plurale».
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, '..', 'Script.html'), 'utf8');
var a = html.indexOf('// INIZIO unità al singolare e al plurale');
var b = html.indexOf('// FINE unità al singolare e al plurale');
assert.ok(a > 0 && b > a, 'blocco delle unità non trovato in Script.html');
var f = vm.createContext({ trim: function (s) { return String(s === undefined || s === null ? '' : s).replace(/^\s+|\s+$/g, ''); } });
vm.runInContext(html.substring(a, b), f);

var PIN = '1234';

module.exports = {
  'singolare con 1, plurale con tutte le altre quantità': function () {
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 1), 'sacchetto');
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 2), 'sacchetti');
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 0), 'sacchetti');
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 1.5), 'sacchetti');
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 0.5), 'sacchetti');
    assert.strictEqual(f.unitaPerQuantita('Sacchetto', 1), 'Sacchetto', 'a 1 resta come scritta nel foglio');
    assert.strictEqual(f.unitaPerQuantita('', 3), '');
    assert.strictEqual(f.unitaPerQuantita('  ', 3), '');
  },

  'unità abbreviate o invariabili non cambiano': function () {
    ['kg', 'g', 'gr', 'l', 'lt', 'ml', 'cl', 'dl', 'pz', 'bar', 'caffè', 'Kg', 'CL', 'conf.', 'brik'].forEach(function (u) {
      assert.strictEqual(f.unitaPerQuantita(u, 3), u.toLowerCase(), u);
    });
    assert.strictEqual(f.unitaPerQuantita('kg', 0.5), 'kg');
    assert.strictEqual(f.unitaPerQuantita('kg', 1), 'kg');
  },

  'regole italiane: -o → -i, -a → -e, -e → -i': function () {
    var attesi = {
      sacchetto: 'sacchetti', cartone: 'cartoni', bottiglia: 'bottiglie', cassa: 'casse', confezione: 'confezioni',
      scatola: 'scatole', fusto: 'fusti', litro: 'litri', collo: 'colli', pezzo: 'pezzi', bustina: 'bustine',
      sacco: 'sacchi', pacco: 'pacchi', barca: 'barche', vassoio: 'vassoi', arancia: 'arance', valigia: 'valigie',
      camicia: 'camicie', farmacia: 'farmacie', paio: 'paia', uovo: 'uova', serie: 'serie', bicchiere: 'bicchieri',
      CASSA: 'casse', '  Cartone ': 'cartoni'
    };
    Object.keys(attesi).forEach(function (u) {
      assert.strictEqual(f.unitaPerQuantita(u, 2), attesi[u], u);
    });
  },

  'unità già scritte al plurale nel foglio: restano giuste e con 1 diventano singolari': function () {
    assert.strictEqual(f.unitaPerQuantita('casse', 3), 'casse');
    assert.strictEqual(f.unitaPerQuantita('casse', 1), 'cassa');
    assert.strictEqual(f.unitaPerQuantita('Cartoni', 2), 'cartoni');
    assert.strictEqual(f.unitaPerQuantita('cartoni', 1), 'cartone');
    assert.strictEqual(f.unitaPerQuantita('pezzi', 1), 'pezzo');
    assert.strictEqual(f.unitaPerQuantita('bottiglie', 0.5), 'bottiglie');
    assert.strictEqual(f.unitaPerQuantita('scatole', 1), 'scatola');
    assert.strictEqual(f.unitaPerQuantita('pacchi', 1), 'pacco');
    assert.strictEqual(f.unitaPerQuantita('confezioni', 1), 'confezione');
    assert.strictEqual(f.unitaPerQuantita('casse', 2, 'cassoni'), 'cassoni', 'la colonna Unità plurale vince');
  },

  'più parole: cambia solo la prima': function () {
    assert.strictEqual(f.unitaPerQuantita('cassa da 24', 2), 'casse da 24');
    assert.strictEqual(f.unitaPerQuantita('cartone da 6 bottiglie', 4), 'cartoni da 6 bottiglie');
  },

  'colonna «Unità plurale»: ha la precedenza, ma a 1 si usa il singolare': function () {
    assert.strictEqual(f.unitaPerQuantita('fiasco', 2, 'fiaschi'), 'fiaschi');
    assert.strictEqual(f.unitaPerQuantita('sacchetto', 3, 'sacchettini'), 'sacchettini');
    assert.strictEqual(f.unitaPerQuantita('fiasco', 1, 'fiaschi'), 'fiasco');
    assert.strictEqual(f.unitaPerQuantita('cassa', 2, '  '), 'casse', 'colonna vuota: regola automatica');
  },

  'foglio Prodotti: la colonna Unità plurale arriva all\'app e il valore salvato non cambia': function () {
    assert.strictEqual(INTESTAZIONI_PRODOTTI[INTESTAZIONI_PRODOTTI.length - 1], 'Unità plurale');
    scheda_(SCHEDA_PRODOTTI).appendRow(['Birra', 'Bevande Bianchi', 'fusto', 'SI', 2, '', '', 'P1', 'fusti grandi']);
    scheda_(SCHEDA_PRODOTTI).appendRow(['Acqua', 'Bevande Bianchi', 'cassa', 'SI', 3, '', '', 'P2', '']);
    var r = riordino(PIN);
    var birra = r.prodotti.filter(function (p) { return p.nome === 'Birra'; })[0];
    var acqua = r.prodotti.filter(function (p) { return p.nome === 'Acqua'; })[0];
    assert.strictEqual(birra.unita, 'fusto');
    assert.strictEqual(birra.unitaPlurale, 'fusti grandi');
    assert.strictEqual(acqua.unitaPlurale, '');
    var riga = scheda_(SCHEDA_PRODOTTI).getRange(2, 1, 1, 9).getValues()[0];
    assert.strictEqual(riga[2], 'fusto', 'nel foglio resta il valore originale');
  }
};
