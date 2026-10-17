/*
 * Prove dell'aggiunta rapida di prodotti nella scheda di un fornitore: le funzioni pure di
 * Script.html (ricerca, doppioni, quantità, più ordinati) estratte ed eseguite sul computer.
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, '..', 'Script.html'), 'utf8');
var a = html.indexOf('// INIZIO ricerca fornitori');
var b = html.indexOf('// FINE ricerca prodotti');
assert.ok(a > 0 && b > a, 'blocchi della ricerca non trovati in Script.html');
var f = vm.createContext({});
vm.runInContext(html.substring(a, b), f);

function nomi(elenco) { return elenco.map(function (p) { return p.nome; }); }
function uguali(x, y) { assert.strictEqual(JSON.stringify(x), JSON.stringify(y)); }

function prodotto(id, nome, fornitore, unita, daOrdinare, quantita) {
  return { id: id, nome: nome, fornitore: fornitore, unita: unita || '', daOrdinare: !!daOrdinare, quantita: quantita || 0 };
}

var P = [
  prodotto('1', 'Caffè in grani', 'Torrefazione Rossi', 'kg'),
  prodotto('2', 'Caffè decaffeinato', 'Torrefazione Rossi', 'kg'),
  prodotto('3', 'Tazzine da caffè', 'Torrefazione Rossi', 'scatole', true, 2),
  prodotto('4', 'Cacao amaro', 'Torrefazione Rossi', 'kg'),
  prodotto('5', 'Zucchero', 'Torrefazione Rossi', 'kg'),
  prodotto('6', 'Gazzosa', 'Bevande Bianchi', 'casse'),
  prodotto('7', 'Caffè freddo', 'Bevande Bianchi', 'casse'),
  prodotto('8', 'Èspresso corto', 'Torrefazione Rossi', ''),
  prodotto('9', 'Cappuccino mix', 'Torrefazione Rossi', 'kg'),
  prodotto('10', 'Capsule', 'Torrefazione Rossi', 'kg')
];

module.exports = {
  'ricerca: accenti e maiuscole ignorati, solo prodotti di quel fornitore': function () {
    uguali(nomi(f.cercaProdotti(P, 'Torrefazione Rossi', 'CAFFE')),
      ['Caffè in grani', 'Caffè decaffeinato', 'Tazzine da caffè']);
    uguali(nomi(f.cercaProdotti(P, 'Torrefazione Rossi', 'espresso')), ['Èspresso corto']);
    uguali(nomi(f.cercaProdotti(P, 'Torrefazione Rossi', 'ÈSPRESSO')), ['Èspresso corto']);
    uguali(nomi(f.cercaProdotti(P, 'Bevande Bianchi', 'caffe')), ['Caffè freddo']);
  },

  'ricerca: trova ovunque nel nome, prima chi inizia così': function () {
    uguali(nomi(f.cercaProdotti(P, 'Torrefazione Rossi', 'caff')),
      ['Caffè in grani', 'Caffè decaffeinato', 'Tazzine da caffè']);
    uguali(nomi(f.cercaProdotti(P, 'Torrefazione Rossi', 'zine')), ['Tazzine da caffè']);
  },

  'ricerca: massimo 6 suggerimenti, testo vuoto o senza risultati: nessuno': function () {
    var tanti = [];
    for (var i = 0; i < 15; i++) tanti.push(prodotto('x' + i, 'Acqua ' + i, 'F', ''));
    assert.strictEqual(f.cercaProdotti(tanti, 'F', 'acq').length, 6);
    assert.strictEqual(f.cercaProdotti(P, 'Torrefazione Rossi', '').length, 0);
    assert.strictEqual(f.cercaProdotti(P, 'Torrefazione Rossi', 'zzz').length, 0);
  },

  'doppioni: stesso nome senza maiuscole e accenti = prodotto esistente': function () {
    assert.strictEqual(f.prodottoEsistente(P, 'Torrefazione Rossi', 'caffe  IN grani').id, '1');
    assert.strictEqual(f.prodottoEsistente(P, 'Torrefazione Rossi', 'Caffè'), null);
    assert.strictEqual(f.prodottoEsistente(P, 'Bevande Bianchi', 'Caffè in grani'), null, 'è di un altro fornitore');
    assert.strictEqual(f.prodottoEsistente(P, 'Torrefazione Rossi', ''), null);
  },

  'quantità: 1 se nuovo in lista, +1 se già presente': function () {
    assert.strictEqual(f.quantitaDopoAggiunta(P[0]), 1);
    assert.strictEqual(f.quantitaDopoAggiunta(P[2]), 3);
    assert.strictEqual(f.quantitaDopoAggiunta(prodotto('z', 'Z', 'F', '', true, 0)), 1, 'in lista senza quantità');
    assert.strictEqual(f.quantitaDopoAggiunta(prodotto('z', 'Z', 'F', '', true, 0.5)), 1.5);
  },

  'nuovo prodotto: unità predefinita = la più usata dal fornitore': function () {
    assert.strictEqual(f.unitaPredefinita(P, 'Torrefazione Rossi'), 'kg');
    assert.strictEqual(f.unitaPredefinita(P, 'Bevande Bianchi'), 'casse');
    assert.strictEqual(f.unitaPredefinita(P, 'Sconosciuto'), '');
  },

  'più ordinati: non in lista, per volte ordinate e poi per nome, massimo 6': function () {
    var r = f.piuOrdinati(P, 'Torrefazione Rossi', { '5': 7, '4': 3, '10': 3 });
    uguali(nomi(r), ['Zucchero', 'Cacao amaro', 'Capsule', 'Caffè decaffeinato', 'Caffè in grani', 'Cappuccino mix']);
    assert.ok(nomi(r).indexOf('Tazzine da caffè') < 0, 'quelli già in lista non compaiono');
    assert.strictEqual(r.length, 6);
    uguali(nomi(f.piuOrdinati(P, 'Bevande Bianchi', {})), ['Caffè freddo', 'Gazzosa']);
  }
};
