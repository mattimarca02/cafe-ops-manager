/*
 * Prove della quadratura cassa (registratore telematico) con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');
var demo = require('./dati-demo');

var PIN = '1234';

function righeChiusure() {
  var s = scheda_(SCHEDA_CHIUSURE);
  return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_CHIUSURE.length).getValues();
}

module.exports = {
  'setup: colonne del registratore e tolleranza in Impostazioni': function () {
    var intestazioni = scheda_(SCHEDA_CHIUSURE).getRange(1, 1, 1, 12).getValues()[0];
    assert.strictEqual(intestazioni[10], 'Totale registratore');
    assert.strictEqual(intestazioni[11], 'Differenza quadratura');
    assert.strictEqual(tolleranzaCassa_(), 5);
    assert.strictEqual(avvio(PIN).tolleranzaCassa, 5);
    scriviImpostazione_(IMP_TOLLERANZA_CASSA, '2,50');
    assert.strictEqual(tolleranzaCassa_(), 2.5);
    scriviImpostazione_(IMP_TOLLERANZA_CASSA, 'boh');
    assert.strictEqual(tolleranzaCassa_(), 5, 'valore non valido: 5 €');
  },

  'chiusura con registratore: differenza salvata nella riga': function () {
    var r = salvaChiusura(PIN, { id: 'Cquadr-1', data: '2026-10-05', contanti: '350', pos: '120,50', registratore: '468' }, false);
    assert.ok(r.ok, r.messaggio);
    var riga = righeChiusure()[0];
    assert.strictEqual(riga[10], 468);
    assert.strictEqual(riga[11], 2.5);
    assert.strictEqual(riga[5], '', 'entro la tolleranza: nessuna nota automatica');
  },

  'chiusura senza registratore: il campo è facoltativo': function () {
    var r = salvaChiusura(PIN, { id: 'Cquadr-2', data: '2026-10-06', contanti: '300', pos: '' }, false);
    assert.ok(r.ok, r.messaggio);
    var riga = righeChiusure()[0];
    assert.strictEqual(riga[10], '');
    assert.strictEqual(riga[11], '');
    assert.strictEqual(leggiChiusure_()[0].differenza, null);
  },

  'registratore non valido: errore chiaro': function () {
    var r = salvaChiusura(PIN, { id: 'Cquadr-3', data: '2026-10-06', contanti: '300', registratore: 'abc' }, false);
    assert.strictEqual(r.ok, false);
    assert.ok(/registratore/.test(r.messaggio));
  },

  'oltre la tolleranza senza nota: salvata lo stesso con una nota automatica': function () {
    var r = salvaChiusura(PIN, { id: 'Cquadr-4', data: '2026-10-07', contanti: '300', pos: '100', registratore: '420' }, false);
    assert.ok(r.ok);
    var riga = righeChiusure()[0];
    assert.strictEqual(riga[11], -20);
    assert.strictEqual(riga[5], NOTA_QUADRATURA_MANCANTE);
    salvaChiusura(PIN, { id: 'Cquadr-5', data: '2026-10-08', contanti: '300', pos: '100', registratore: '420', note: 'Resto sbagliato' }, false);
    assert.strictEqual(righeChiusure()[1][5], 'Resto sbagliato');
  },

  'modifica: registratore aggiunto, cambiato e tolto': function () {
    salvaChiusura(PIN, { id: 'Cquadr-6', data: '2026-10-09', contanti: '200', pos: '50' }, false);
    assert.ok(modificaChiusura(PIN, { id: 'Cquadr-6', data: '2026-10-09', contanti: '200', pos: '50', registratore: '251' }, false).ok);
    var riga = righeChiusure()[0];
    assert.strictEqual(riga[10], 251);
    assert.strictEqual(riga[11], -1);
    var voce = elenco(PIN, { tipo: 'chiusure' }).voci[0];
    assert.strictEqual(voce.registratore, 251);
    assert.strictEqual(voce.differenza, -1);
    assert.ok(modificaChiusura(PIN, { id: 'Cquadr-6', data: '2026-10-09', contanti: '200', pos: '50', registratore: '' }, false).ok);
    assert.strictEqual(righeChiusure()[0][10], '');
    assert.strictEqual(righeChiusure()[0][11], '');
  },

  'riepilogo e report: giorni con differenza, totale e giorni senza chiusura': function () {
    salvaChiusura(PIN, { id: 'Cquadr-7', data: '2026-09-01', contanti: '300', pos: '100', registratore: '397' }, false);
    salvaChiusura(PIN, { id: 'Cquadr-8', data: '2026-09-02', contanti: '300', pos: '100', registratore: '410', note: 'Scontrino annullato' }, false);
    salvaChiusura(PIN, { id: 'Cquadr-9', data: '2026-09-03', contanti: '300', pos: '100', registratore: '400' }, false);
    var r = riepilogo(PIN, 2026, 9);
    assert.ok(r.ok, r.messaggio);
    assert.strictEqual(r.quadratura.confrontate, 3);
    assert.strictEqual(r.quadratura.conDifferenza, 2);
    assert.strictEqual(r.quadratura.oltreTolleranza, 1);
    assert.strictEqual(r.quadratura.totaleDifferenze, -7);
    var d = calcolaReport_(2026, 9, 0);
    var html = htmlReport_(d, 'Settembre 2026', false);
    assert.ok(/Quadratura cassa/.test(html));
    assert.ok(/Scontrino annullato/.test(html));
    assert.ok(html.indexOf('−7,00 €') >= 0, 'totale delle differenze');
    assert.ok(/Giorni senza chiusura cassa<\/td><td[^>]*>27</.test(html), 'giorni senza chiusura (30 − 3)');
    assert.ok(/Quadratura con il registratore telematico: 3 giorni confrontati, 2 con differenza/.test(testoReport_(d, 'Settembre 2026')));
  },

  'report di prova con i dati demo non si rompe': function () {
    demo.riempi({ giorni: 40 });
    inviaReportDiProva();
    assert.strictEqual(gas.finto.email.length, 1);
    assert.ok(/Quadratura cassa/.test(gas.finto.email[0].htmlBody));
  }
};
