/*
 * Prove della ricerca del fornitore nel modulo spesa: le funzioni pure di Script.html
 * (normalizzaNome, cercaFornitori, fornitoreEsistente) estratte ed eseguite sul computer.
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, '..', 'Script.html'), 'utf8');
var a = html.indexOf('// INIZIO ricerca fornitori');
var b = html.indexOf('// FINE ricerca fornitori');
assert.ok(a > 0 && b > a, 'blocco della ricerca non trovato in Script.html');
var contesto = vm.createContext({});
vm.runInContext(html.substring(a, b), contesto);
var f = contesto;

/** Le liste create nel contesto isolato hanno un prototipo diverso: le confronto come testo. */
function uguali(a, b) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); }

var ELENCO = ['Caffè Rossi', 'Essemarket', 'Panificio Verdi', 'Bar Esse', 'Tessuti & Co', 'Èlite Servizi', 'Supermercato'];

module.exports = {
  'maiuscole, accenti e spazi doppi vengono ignorati': function () {
    assert.strictEqual(f.normalizzaNome('  CAFFÈ   Rossi '), 'caffe rossi');
    uguali(f.cercaFornitori(ELENCO, 'caffe'), ['Caffè Rossi']);
    uguali(f.cercaFornitori(ELENCO, 'CAFFÈ  ROSSI'), ['Caffè Rossi']);
    uguali(f.cercaFornitori(ELENCO, 'elite'), ['Èlite Servizi']);
    uguali(f.cercaFornitori(ELENCO, 'ÈLITE'), ['Èlite Servizi']);
  },

  'trova il testo ovunque nel nome, prima quelli che iniziano così': function () {
    var r = f.cercaFornitori(ELENCO.concat(['Il Mondo Esse']), 'esse');
    uguali(r, ['Essemarket', 'Bar Esse', 'Il Mondo Esse']);   // chi inizia con «esse» per primo, poi gli altri
    assert.ok(r.indexOf('Caffè Rossi') < 0);
  },

  'massimo 8 suggerimenti, testo vuoto o senza risultati: nessuno': function () {
    var tanti = [];
    for (var i = 1; i <= 20; i++) tanti.push('Fornitore ' + i);
    assert.strictEqual(f.cercaFornitori(tanti, 'forn').length, 8);
    assert.strictEqual(f.cercaFornitori(tanti, 'forn', 3).length, 3);
    uguali(f.cercaFornitori(ELENCO, ''), []);
    uguali(f.cercaFornitori(ELENCO, '   '), []);
    uguali(f.cercaFornitori(ELENCO, 'zzz'), []);
  },

  'nome uguale a uno esistente: si usa quello (niente doppioni)': function () {
    assert.strictEqual(f.fornitoreEsistente(ELENCO, 'caffe rossi'), 'Caffè Rossi');
    assert.strictEqual(f.fornitoreEsistente(ELENCO, ' ESSEMARKET '), 'Essemarket');
    assert.strictEqual(f.fornitoreEsistente(ELENCO, 'elite   servizi'), 'Èlite Servizi');
  },

  'nome nuovo: nessuna corrispondenza esatta': function () {
    assert.strictEqual(f.fornitoreEsistente(ELENCO, 'Esse'), '', '«Esse» non è «Bar Esse»');
    assert.strictEqual(f.fornitoreEsistente(ELENCO, 'Cartoleria Nuova'), '');
    assert.strictEqual(f.fornitoreEsistente(ELENCO, ''), '');
  }
};
