/*
 * Prove lato server della ricerca del fornitore: fornitori recenti e niente doppioni
 * (maiuscole, accenti, spazi doppi).
 */
'use strict';

var assert = require('assert');

var PIN = '1234';

function spesa(id, fornitore) {
  return { id: id, data: '2026-10-05', importo: '10,00', fornitore: fornitore, categoria: 'Caffè', pagamento: 'Contanti' };
}

function elencoFornitori() {
  return leggiLista_(SCHEDA_FORNITORI);
}

module.exports = {
  'fornitori recenti: gli ultimi 5 usati, senza ripetizioni, dal più recente': function () {
    assert.deepStrictEqual(avvio(PIN).fornitoriRecenti, [], 'nessuna spesa: nessuna scorciatoia');
    ['A Uno', 'B Due', 'C Tre', 'A Uno', 'D Quattro', 'E Cinque', 'F Sei'].forEach(function (f, i) {
      assert.ok(salvaSpesa(PIN, spesa('S' + i, f)).ok);
    });
    assert.deepStrictEqual(avvio(PIN).fornitoriRecenti, ['F Sei', 'E Cinque', 'D Quattro', 'A Uno', 'C Tre']);
  },

  'un nuovo fornitore viene aggiunto alla scheda una volta sola': function () {
    var prima = elencoFornitori().length;
    salvaSpesa(PIN, spesa('S1', 'Cartoleria Nuova'));
    salvaSpesa(PIN, spesa('S2', 'Cartoleria Nuova'));
    assert.strictEqual(elencoFornitori().length, prima + 1);
  },

  'stesso nome con maiuscole, accenti o spazi diversi: nessun doppione': function () {
    scheda_(SCHEDA_FORNITORI).appendRow(['Torrefazione Rossi']);
    salvaSpesa(PIN, spesa('S1', 'Caffè Bianchi'));
    var n = elencoFornitori().length;
    salvaSpesa(PIN, spesa('S2', 'CAFFE BIANCHI'));
    salvaSpesa(PIN, spesa('S3', '  caffè   bianchi '));
    salvaSpesa(PIN, spesa('S4', 'torrefazione rossi'));   // esiste già «Torrefazione Rossi»
    assert.strictEqual(elencoFornitori().length, n, 'nessun fornitore nuovo');
    assert.deepStrictEqual(avvio(PIN).fornitoriRecenti.length, 2, 'e nei recenti compare una volta sola');
  }
};
