/*
 * Prove della lista "Da ordinare" e dei messaggi WhatsApp.
 */
'use strict';

var assert = require('assert');

var PIN = '1234';

module.exports = {
  'numeri WhatsApp': function () {
    assert.strictEqual(numeroWhatsApp_('333 123 4567'), '393331234567');
    assert.strictEqual(numeroWhatsApp_('+39 333-1234567'), '393331234567');
    assert.strictEqual(numeroWhatsApp_('0039 3331234567'), '393331234567');
    assert.strictEqual(numeroWhatsApp_('393331234567'), '393331234567');
    assert.strictEqual(numeroWhatsApp_('0471 123456'), '390471123456');
    assert.strictEqual(numeroWhatsApp_('+41 79 123 45 67'), '41791234567');
    assert.strictEqual(numeroWhatsApp_(3331234567), '393331234567', 'numero salvato come numero nel foglio');
    assert.strictEqual(numeroWhatsApp_(471123456), '390471123456', 'fisso che ha perso lo 0 nel foglio');
    assert.strictEqual(numeroWhatsApp_('12'), '');
    assert.strictEqual(numeroWhatsApp_(''), '');
  },

  'lista condivisa: aggiungi, quantità, svuota': function () {
    scheda_(SCHEDA_FORNITORI).appendRow(['Bevande Bianchi', 'Bevande', '', '333 1234567']);
    var r = nuovoProdotto(PIN, { nome: 'Acqua naturale', fornitore: 'Bevande Bianchi', unita: 'casse' });
    assert.ok(r.ok, r.messaggio);
    nuovoProdotto(PIN, { nome: 'Gazzosa', fornitore: 'Bevande Bianchi', unita: 'casse' });
    nuovoProdotto(PIN, { nome: 'Zucchero', fornitore: 'Supermercato', unita: 'kg', daOrdinare: true, persona: 'Maria' });
    // Prodotto scritto a mano nel foglio, senza ID
    scheda_(SCHEDA_PRODOTTI).appendRow(['Tovaglioli', '', 'pacchi', 'SI']);
    assert.ok(!nuovoProdotto(PIN, { nome: 'acqua naturale', fornitore: 'Bevande Bianchi' }).ok, 'niente doppioni');
    var stato = riordino(PIN);
    assert.strictEqual(stato.prodotti.length, 4);
    assert.ok(stato.prodotti.every(function (p) { return p.id; }), 'tutti hanno un ID');
    assert.strictEqual(stato.daOrdinare, 2);
    var acqua = stato.prodotti.filter(function (p) { return p.nome === 'Acqua naturale'; })[0];
    stato = impostaDaOrdinare(PIN, acqua.id, true, '3', 'Luca');
    assert.ok(stato.ok, stato.messaggio);
    assert.strictEqual(stato.numeri['Bevande Bianchi'], '393331234567');
    assert.strictEqual(stato.numeri.Supermercato, '');
    assert.strictEqual(stato.prodotti.filter(function (p) { return p.nome === 'Acqua naturale'; })[0].quantita, 3);
    assert.ok(stato.fornitori.indexOf('Supermercato') >= 0, 'fornitore nuovo aggiunto alla scheda Fornitori');
    assert.strictEqual(contaDaOrdinare_(), 3);
    assert.strictEqual(avvio(PIN).daOrdinare, 3);
    assert.ok(!impostaDaOrdinare(PIN, acqua.id, true, 'tanta').ok);
    stato = svuotaOrdine(PIN, 'Bevande Bianchi');
    assert.strictEqual(stato.daOrdinare, 2);
    stato = svuotaOrdine(PIN, 'Senza fornitore');
    assert.strictEqual(stato.daOrdinare, 1);
    var riga = scheda_(SCHEDA_PRODOTTI).getRange(2, 1, 1, 8).getValues()[0];
    assert.strictEqual(riga[3], '', 'Da ordinare svuotato');
    assert.strictEqual(riga[4], '', 'Quantità svuotata');
  }
};
