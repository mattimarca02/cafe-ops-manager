/*
 * Prove di versamenti, prelievi e contante teorico con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var demo = require('./dati-demo');

var PIN = '1234';

function giorno(spostamento) {
  return Utilities.formatDate(new Date(new Date().getTime() + (spostamento || 0) * 86400000), FUSO, 'yyyy-MM-dd');
}

module.exports = {
  'setup: scheda Movimenti cassa e voci in Impostazioni': function () {
    assert.ok(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Movimenti cassa'));
    var t = leggiTabellaImpostazioni_(scheda_(SCHEDA_IMPOSTAZIONI));
    assert.ok(IMP_FONDO_INIZIALE in t && IMP_DATA_PARTENZA_CASSA in t);
    var r = movimentiCassa(PIN);
    assert.ok(r.ok);
    assert.strictEqual(r.contante, null, 'senza data di partenza niente contante teorico');
    assert.strictEqual(riepilogo(PIN, 0, 0).contanteTeorico, null);
  },

  'movimenti: salvataggio, doppioni, errori ed eliminazione': function () {
    var dati = { id: 'Vprova-0001', data: giorno(0), tipo: 'Versamento in banca', importo: '500', nota: 'settimanale', persona: 'Maria' };
    assert.ok(salvaMovimentoCassa(PIN, dati).ok);
    assert.ok(salvaMovimentoCassa(PIN, dati).giaSalvata);
    assert.strictEqual(salvaMovimentoCassa(PIN, { id: 'Vprova-0002', data: giorno(0), tipo: 'Regalo', importo: '5' }).ok, false);
    assert.strictEqual(salvaMovimentoCassa(PIN, { id: 'Vprova-0003', data: giorno(0), tipo: 'Prelievo personale', importo: '-5' }).ok, false);
    assert.strictEqual(salvaMovimentoCassa(PIN, { id: 'Vprova-0004', data: 'ieri', tipo: 'Prelievo personale', importo: '5' }).ok, false);
    var r = movimentiCassa(PIN);
    assert.strictEqual(r.movimenti.length, 1);
    assert.strictEqual(r.movimenti[0].importo, 500);
    assert.strictEqual(r.movimenti[0].persona, 'Maria');
    assert.ok(eliminaMovimentoCassa(PIN, 'Vprova-0001').ok);
    assert.strictEqual(movimentiCassa(PIN).movimenti.length, 0);
  },

  'contante teorico: fondo + contanti − spese in contanti − versamenti − prelievi': function () {
    scriviImpostazione_(IMP_FONDO_INIZIALE, '150');
    scriviImpostazione_(IMP_DATA_PARTENZA_CASSA, leggiData_(giorno(-2)));   // come la scrive Fogli: una data
    salvaChiusura(PIN, { id: 'Cmov-00001', data: giorno(-2), contanti: '300', pos: '100' }, false);
    salvaChiusura(PIN, { id: 'Cmov-00002', data: giorno(-3), contanti: '999', pos: '0' }, false);    // prima: esclusa
    salvaSpesa(PIN, { id: 'Smov-00001', data: giorno(-1), importo: '20', fornitore: 'Panificio', categoria: 'Altro', pagamento: 'Contanti' });
    salvaSpesa(PIN, { id: 'Smov-00002', data: giorno(-1), importo: '70', fornitore: 'Panificio', categoria: 'Altro', pagamento: 'Bonifico' });
    salvaMovimentoCassa(PIN, { id: 'Vmov-00001', data: giorno(-1), tipo: 'Versamento in banca', importo: '200' });
    salvaMovimentoCassa(PIN, { id: 'Vmov-00002', data: giorno(0), tipo: 'Prelievo per spese', importo: '30' });
    var c = movimentiCassa(PIN).contante;
    assert.strictEqual(c.fondo, 150);
    assert.strictEqual(c.incassiContanti, 300);
    assert.strictEqual(c.speseContanti, 20);
    assert.strictEqual(c.versamenti, 200);
    assert.strictEqual(c.prelievi, 30);
    assert.strictEqual(c.totale, 200);
    assert.strictEqual(c.partenza, dataIt_(leggiData_(giorno(-2))));
    var r = riepilogo(PIN, 0, 0);
    assert.strictEqual(r.contanteTeorico.totale, 200);
    // Data scritta come testo nel foglio
    scriviImpostazione_(IMP_DATA_PARTENZA_CASSA, dataIt_(leggiData_(giorno(-2))));
    assert.strictEqual(movimentiCassa(PIN).contante.totale, 200);
  },

  'report: totale versato e prelevato del mese e foglio Excel': function () {
    salvaMovimentoCassa(PIN, { id: 'Vrep-00001', data: '2026-09-05', tipo: 'Versamento in banca', importo: '1.000' });
    salvaMovimentoCassa(PIN, { id: 'Vrep-00002', data: '2026-09-06', tipo: 'Prelievo personale', importo: '150' });
    salvaMovimentoCassa(PIN, { id: 'Vrep-00003', data: '2026-09-07', tipo: 'Prelievo per spese', importo: '45,50' });
    salvaMovimentoCassa(PIN, { id: 'Vrep-00004', data: '2026-10-07', tipo: 'Prelievo per spese', importo: '9' });
    var d = calcolaReport_(2026, 9, 0);
    assert.strictEqual(d.movimenti.versamenti, 1000);
    assert.strictEqual(d.movimenti.prelievi, 195.5);
    var html = htmlReport_(d, 'Settembre 2026', false);
    assert.ok(/Versamenti e prelievi/.test(html));
    assert.ok(html.indexOf('1.000,00 €') > 0 && html.indexOf('195,50 €') > 0);
    assert.ok(/Versato in banca: 1\.000,00 € – prelevato: 195,50 €/.test(testoReport_(d, 'Settembre 2026')));
    assert.strictEqual(d.contanteTeorico, null, 'senza data di partenza');
    scriviImpostazione_(IMP_DATA_PARTENZA_CASSA, '01/09/2026');
    d = calcolaReport_(2026, 9, 0);
    assert.strictEqual(d.contanteTeorico.al, '30/09/2026', 'contante a fine mese');
    assert.strictEqual(d.contanteTeorico.totale, -1195.5);
  },

  'dati demo: risposta senza date e report di prova': function () {
    demo.riempi({ giorni: 40 });
    var r = movimentiCassa(PIN);
    assert.ok(r.ok);
    assert.ok(r.contante && typeof r.contante.totale === 'number');
    inviaReportDiProva();
  }
};
