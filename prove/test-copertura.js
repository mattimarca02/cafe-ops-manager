/*
 * Prove di «Spese coperte dai ricavi» con l'Apps Script finto: la funzione coperturaSpese()
 * legge davvero le schede Spese, Fatture e Chiusure.
 */
'use strict';

var assert = require('assert');

var PIN = '1234';
var n = 0;

function spesa(data, importo, fornitore) {
  n++;
  var r = salvaSpesa(PIN, { id: 'Scop-' + n + 'x', data: data, importo: importo, fornitore: fornitore || 'Prova',
    categoria: 'Altro', pagamento: 'Contanti' });
  assert.ok(r.ok, r.messaggio);
}

function chiusura(data, contanti, pos) {
  n++;
  var r = salvaChiusura(PIN, { id: 'Ccop-' + n + 'x', data: data, contanti: contanti, pos: pos || '0' });
  assert.ok(r.ok, r.messaggio);
}

function fattura(data, numero, fornitore, totale) {
  scheda_(SCHEDA_FATTURE).appendRow([leggiData_(data), numero, fornitore, '01234567897', totale < 0 ? 'TD04 - Nota di credito' : 'TD01 - Fattura',
    totale, 0, totale, '', 'Altro', 'f.xml', new Date(), 'XML']);
}

module.exports = {
  'esempio 400 / 329 / 400 letto dal foglio (spesa, chiusure contanti + POS)': function () {
    spesa('2026-03-10', '400', 'Panificio');
    chiusura('2026-03-10', '300', '29');
    chiusura('2026-03-11', '100', '300');
    var r = coperturaSpese(PIN, '2026-03-10', '2026-03-12', 'tutte');
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.righe.map(function (x) { return x.tipo; }), ['spesa', 'ricavi', 'nastrino', 'ricavi', 'nastrino']);
    assert.strictEqual(r.righe[2].residuo, -71);
    assert.strictEqual(r.righe[4].coperta, true);
    assert.strictEqual(r.righe[4].dataChiusura, '2026-03-11');
    assert.strictEqual(r.totali.ricavi, 729);
    assert.strictEqual(r.totali.avanzoFinale, 329);
    assert.strictEqual(r.totali.guadagno, 329);
    assert.strictEqual(r.totali.giorniSenzaChiusura, 1, 'il 12 marzo non ha la chiusura');
  },

  'unisce spese senza fattura e fatture, con la nota di credito negativa, e filtra': function () {
    spesa('2026-03-01', '100', 'Bar');
    fattura('2026-03-01', 'F1', 'Ditta', 200);
    fattura('2026-03-02', 'NC1', 'Ditta', -50);
    chiusura('2026-03-03', '120', '0');
    var tutte = coperturaSpese(PIN, '2026-03-01', '2026-03-03');
    assert.strictEqual(tutte.filtro, 'tutte', 'filtro predefinito: tutte');
    assert.strictEqual(tutte.totali.spese, 250);
    assert.strictEqual(tutte.totali.scoperto, 130);
    assert.ok(tutte.righe.some(function (x) { return x.tipo === 'spesa' && x.notaDiCredito && x.importo === -50; }));
    var senza = coperturaSpese(PIN, '2026-03-01', '2026-03-03', 'senzaFattura');
    assert.strictEqual(senza.totali.spese, 100);
    assert.strictEqual(senza.totali.scoperto, 0);
    assert.strictEqual(senza.totali.avanzoFinale, 20);
    var fatt = coperturaSpese(PIN, '2026-03-01', '2026-03-03', 'fatture');
    assert.strictEqual(fatt.totali.spese, 150);
    assert.strictEqual(fatt.totali.scoperto, 30);
  },

  'le date lette dal foglio rispettano i confini del periodo (estremi compresi)': function () {
    spesa('2026-02-28', '10');
    spesa('2026-03-01', '20');
    spesa('2026-03-31', '30');
    spesa('2026-04-01', '40');
    var r = coperturaSpese(PIN, '2026-03-01', '2026-03-31', 'tutte');
    assert.strictEqual(r.totali.spese, 50);
    assert.strictEqual(r.totali.numeroSpese, 2);
  },

  'foglio vuoto: nessuna riga e nessun errore': function () {
    var r = coperturaSpese(PIN, '2026-03-01', '2026-03-31', 'tutte');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.righe.length, 0);
    assert.strictEqual(r.totali.spese, 0);
  },

  'PIN sbagliato e date non valide': function () {
    assert.strictEqual(coperturaSpese('0000', '2026-03-01', '2026-03-31', 'tutte').ok, false);
    var r = coperturaSpese(PIN, 'boh', '2026-03-31', 'tutte');
    assert.strictEqual(r.ok, false);
    assert.ok(/non valide/.test(r.messaggio));
    r = coperturaSpese(PIN, '2026-03-31', '2026-03-01', 'tutte');
    assert.strictEqual(r.ok, false);
    assert.ok(/prima della data iniziale/.test(r.messaggio));
  },

  'la risposta è ammessa da google.script.run (niente Date né funzioni)': function () {
    spesa('2026-03-05', '12,50', 'Prova');
    chiusura('2026-03-05', '10', '5');
    var r = coperturaSpese(PIN, '2026-03-01', '2026-03-31', 'tutte');
    assert.doesNotThrow(function () { JSON.parse(JSON.stringify(r)); });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), r);
  }
};
