/*
 * Prove di costo e margine dei prodotti con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');

var PIN = '1234';

module.exports = {
  'setup: scheda Ricette/Costi con l\'esempio del caffè e soglia in Impostazioni': function () {
    assert.ok(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ricette/Costi'));
    var r = margini(PIN);
    assert.ok(r.ok);
    assert.strictEqual(r.soglia, 60);
    assert.strictEqual(r.prodotti.length, 1);
    assert.strictEqual(r.prodotti[0].nome, 'Caffè espresso');
    assert.strictEqual(r.prodotti[0].marginePerc, 88.5);
    assert.strictEqual(r.prodotti[0].sottoSoglia, false);
    setup();
    assert.strictEqual(margini(PIN).prodotti.length, 1, 'l\'esempio non viene duplicato');
  },

  'nuovo prodotto, modifica, soglia e ordinamento': function () {
    var r = salvaProdottoMargine(PIN, { nome: 'Spremuta', prezzoAcquisto: '1,80', unita: 'kg', quantita: '400', prezzoVendita: '3,00', iva: 10 });
    assert.ok(r.ok, r.messaggio);
    var spremuta = r.prodotti.filter(function (p) { return p.nome === 'Spremuta'; })[0];
    assert.strictEqual(spremuta.costo, 0.72);
    assert.strictEqual(spremuta.marginePerc, 73.6);
    // Il prezzo delle arance sale: il margine scende sotto il 75%
    scriviImpostazione_(IMP_MARGINE_MINIMO, '75');
    r = salvaProdottoMargine(PIN, { id: spremuta.id, nome: 'Spremuta', prezzoAcquisto: '2,10', unita: 'kg', quantita: '400',
      prezzoVendita: '3,00', iva: 10 });
    spremuta = r.prodotti.filter(function (p) { return p.nome === 'Spremuta'; })[0];
    assert.strictEqual(spremuta.costo, 0.84);
    assert.ok(spremuta.sottoSoglia);
    assert.strictEqual(r.prodotti[0].nome, 'Spremuta', 'il margine più basso per primo');
    assert.strictEqual(avvio(PIN).marginiBassi, 1);
    assert.strictEqual(margini(PIN).prodotti.length, 2);
  },

  'errori e righe scritte a mano': function () {
    assert.strictEqual(salvaProdottoMargine(PIN, { nome: '', prezzoAcquisto: '1', quantita: '1', prezzoVendita: '2', iva: 10 }).ok, false);
    assert.strictEqual(salvaProdottoMargine(PIN, { nome: 'X', prezzoAcquisto: 'tanto', quantita: '1', prezzoVendita: '2', iva: 10 }).ok, false);
    assert.strictEqual(salvaProdottoMargine(PIN, { nome: 'X', prezzoAcquisto: '1', quantita: '0', prezzoVendita: '2', iva: 10 }).ok, false);
    assert.strictEqual(salvaProdottoMargine(PIN, { nome: 'caffè ESPRESSO', prezzoAcquisto: '1', quantita: '1', prezzoVendita: '2', iva: 10 }).ok,
      false, 'nome doppione');
    assert.strictEqual(salvaProdottoMargine(PIN, { id: 'M-nonce', nome: 'Y', prezzoAcquisto: '1', quantita: '1', prezzoVendita: '2', iva: 10 }).ok, false);
    // Riga scritta a mano, incompleta e senza ID
    schedaRicette_().appendRow(['Brioche', '', 'pezzo', 1, 1.3, '', '', '']);
    var r = margini(PIN);
    var brioche = r.prodotti.filter(function (p) { return p.nome === 'Brioche'; })[0];
    assert.ok(brioche.id, 'riceve un ID');
    assert.strictEqual(brioche.completo, false);
    assert.deepStrictEqual(brioche.mancano, ['prezzo d\'acquisto']);
    assert.strictEqual(r.prodotti[r.prodotti.length - 1].nome, 'Brioche', 'gli incompleti in fondo');
    assert.strictEqual(brioche.iva, 10, 'IVA vuota = 10%');
  },

  'percentuali scritte con % nel foglio (Fogli le salva come 0,6 e 0,1)': function () {
    scriviImpostazione_(IMP_MARGINE_MINIMO, 0.9);
    assert.strictEqual(margineMinimo_(), 90);
    schedaRicette_().appendRow(['Tè', 20, 'kg', 2, 1.5, 0.22, '', 'Mte-001']);
    var te = margini(PIN).prodotti.filter(function (p) { return p.nome === 'Tè'; })[0];
    assert.strictEqual(te.iva, 22);
    assert.strictEqual(te.netto, 1.2295);
    assert.ok(margini(PIN).prodotti.filter(function (p) { return p.nome === 'Caffè espresso'; })[0].sottoSoglia, '88,5% < 90%');
  },

  'unità scritta a mano (cl) mantenuta: costo calcolato in millilitri': function () {
    var r = salvaProdottoMargine(PIN, { nome: 'Amaro', prezzoAcquisto: '15', unita: 'cl', quantita: '40', prezzoVendita: '4', iva: 22 });
    var amaro = r.prodotti.filter(function (p) { return p.nome === 'Amaro'; })[0];
    assert.strictEqual(amaro.unita, 'cl');
    assert.strictEqual(amaro.costo, 60, '15 € al cl ÷ 10 × 40 ml');
  }
};
