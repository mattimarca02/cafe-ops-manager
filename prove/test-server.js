/*
 * Prove delle funzioni del server con l'Apps Script finto.
 * Ogni funzione esportata parte da un foglio nuovo (setup già eseguito).
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');
var demo = require('./dati-demo');

var PIN = '1234';

function righe(nome) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}

function spesa(extra) {
  var d = { id: 'Sprova-1', data: '2026-10-05', importo: '12,50', fornitore: 'Bar Prova', categoria: 'Caffè', pagamento: 'Contanti', nota: '' };
  for (var k in extra) d[k] = extra[k];
  return d;
}

module.exports = {
  'setup crea le schede e il PIN iniziale': function () {
    var nomi = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); });
    ['Spese', 'Chiusure', 'Categorie', 'Fornitori', 'Fatture', 'Impostazioni'].forEach(function (n) {
      assert.ok(nomi.indexOf(n) >= 0, 'manca la scheda ' + n);
    });
    assert.strictEqual(normalizzaPin_(leggiImpostazione_(IMP_PIN)), '1234');
  },

  'PIN sbagliato non salva nulla': function () {
    var r = salvaSpesa('9999', spesa());
    assert.strictEqual(r.ok, false);
    assert.ok(r.pinErrato);
    assert.strictEqual(righe('Spese').length, 0);
  },

  'spesa salvata una sola volta anche se inviata due volte': function () {
    assert.ok(salvaSpesa(PIN, spesa()).ok);
    var r = salvaSpesa(PIN, spesa());
    assert.ok(r.ok && r.giaSalvata);
    assert.strictEqual(righe('Spese').length, 1);
    assert.strictEqual(righe('Spese')[0][2], 12.5);
  },

  'chiusura con ID: niente doppioni, conflitto per la stessa data': function () {
    var c = { id: 'Cprova-1', data: '05/10/2026', contanti: '300', pos: '100,50', fondo: '150' };
    assert.ok(salvaChiusura(PIN, c, false).ok);
    var r2 = salvaChiusura(PIN, c, false);
    assert.ok(r2.ok && r2.giaSalvata, 'la stessa chiusura rinviata deve risultare già salvata');
    var altra = { id: 'Cprova-2', data: '2026-10-05', contanti: '310', pos: '0' };
    var r3 = salvaChiusura(PIN, altra, false);
    assert.ok(!r3.ok && r3.esiste);
    assert.ok(salvaChiusura(PIN, altra, true).ok);
    var tutte = righe('Chiusure');
    assert.strictEqual(tutte.length, 1);
    assert.strictEqual(tutte[0][1], 310);
    assert.strictEqual(tutte[0][6], 'Cprova-2');
  },

  'riepilogo e report di prova funzionano con dati': function () {
    demo.riempi({ giorni: 70 });
    var r = riepilogo(PIN, 0, 0);
    assert.ok(r.ok, r.messaggio);
    assert.ok(r.incassi > 0);
    inviaReportDiProva();
    assert.strictEqual(gas.finto.email.length, 1);
    assert.ok(/Report di/.test(gas.finto.email[0].htmlBody));
  },

  'installaTrigger crea gli attivatori una sola volta': function () {
    installaTrigger();
    var n = gas.finto.trigger.length;
    installaTrigger();
    assert.strictEqual(gas.finto.trigger.length, n);
  }
};

module.exports['elenco: ricerca senza accenti, filtri e importo'] = function () {
  salvaSpesa(PIN, spesa({ id: 'Selenco-1', fornitore: 'Caffè Rossi', nota: 'miscela', importo: '30' }));
  salvaSpesa(PIN, spesa({ id: 'Selenco-2', fornitore: 'Panificio', categoria: 'Brioche/Pasticceria', pagamento: 'Carta/Bancomat', importo: '12,50' }));
  salvaSpesa(PIN, spesa({ id: 'Selenco-3', data: '2026-09-30', fornitore: 'Panificio', importo: '7' }));
  var r = elenco(PIN, { tipo: 'spese', testo: 'caffe' });
  assert.ok(r.ok, r.messaggio);
  assert.strictEqual(r.numero, 1);
  assert.strictEqual(r.voci[0].fornitore, 'Caffè Rossi');
  assert.strictEqual(elenco(PIN, { tipo: 'spese', testo: 'MISCELA' }).numero, 1);
  assert.strictEqual(elenco(PIN, { tipo: 'spese', testo: '12,50' }).numero, 1);
  assert.strictEqual(elenco(PIN, { tipo: 'spese', mese: '2026-10' }).numero, 2);
  assert.strictEqual(elenco(PIN, { tipo: 'spese', pagamento: 'Carta/Bancomat' }).numero, 1);
  var p = elenco(PIN, { tipo: 'spese', testo: 'panificio' });
  assert.strictEqual(p.numero, 2);
  assert.strictEqual(p.totale, 19.5);
  assert.strictEqual(p.voci[0].dataIso, '2026-10-05', 'la più recente per prima');
  assert.deepStrictEqual(p.mesi.map(function (m) { return m.nome; }), ['Ottobre 2026', 'Settembre 2026']);
};

module.exports['modifica spesa: valori, foto sostituita e tolta'] = function () {
  salvaSpesa(PIN, spesa({ id: 'Smod-1', foto: 'data:image/jpeg;base64,AAAA', fotoTipo: 'image/jpeg' }));
  var link1 = righe('Spese')[0][7];
  assert.ok(link1);
  var r = modificaSpesa(PIN, spesa({ id: 'Smod-1', importo: '13,00', fornitore: 'Altro fornitore', fotoAzione: 'tieni' }));
  assert.ok(r.ok, r.messaggio);
  var riga = righe('Spese')[0];
  assert.strictEqual(riga[2], 13);
  assert.strictEqual(riga[3], 'Altro fornitore');
  assert.strictEqual(riga[7], link1, 'la foto resta');
  assert.ok(riga[9] instanceof Date, 'Modificato il');
  modificaSpesa(PIN, spesa({ id: 'Smod-1', fotoAzione: 'sostituisci', foto: 'data:image/jpeg;base64,BBBB', fotoTipo: 'image/jpeg' }));
  var link2 = righe('Spese')[0][7];
  assert.notStrictEqual(link2, link1);
  var idVecchio = /\/d\/([^/]+)/.exec(link1)[1];
  assert.ok(DriveApp.getFileById(idVecchio).isTrashed(), 'la foto vecchia va nel cestino');
  modificaSpesa(PIN, spesa({ id: 'Smod-1', fotoAzione: 'togli' }));
  assert.strictEqual(righe('Spese')[0][7], '');
  assert.ok(!modificaSpesa(PIN, spesa({ id: 'Snon-esiste' })).ok);
  assert.ok(!modificaSpesa(PIN, spesa({ id: 'Smod-1', importo: 'abc' })).ok);
  assert.strictEqual(righe('Spese').length, 1);
};

module.exports['modifica ed eliminazione chiusura, anche vecchie senza ID'] = function () {
  // Chiusura "vecchia" scritta senza ID (come prima di questa versione)
  scheda_(SCHEDA_CHIUSURE).appendRow([leggiData_('2026-10-01'), 100, 50, 150, 150, '']);
  salvaChiusura(PIN, { id: 'Cmod-2', data: '2026-10-02', contanti: '200', pos: '20' }, false);
  var r = elenco(PIN, { tipo: 'chiusure' });
  assert.strictEqual(r.numero, 2);
  var vecchia = r.voci.filter(function (v) { return v.dataIso === '2026-10-01'; })[0];
  assert.ok(vecchia.id, 'la chiusura vecchia riceve un ID');
  assert.strictEqual(elenco(PIN, { tipo: 'chiusure' }).voci.filter(function (v) { return v.dataIso === '2026-10-01'; })[0].id, vecchia.id,
    'l\'ID resta lo stesso');
  var m = modificaChiusura(PIN, { id: vecchia.id, data: '2026-10-02', contanti: '111', pos: '0' }, false);
  assert.ok(!m.ok && m.esiste, 'conflitto con la chiusura del 2 ottobre');
  assert.ok(modificaChiusura(PIN, { id: vecchia.id, data: '2026-10-02', contanti: '111', pos: '0' }, true).ok);
  var tutte = righe('Chiusure');
  assert.strictEqual(tutte.length, 1);
  assert.strictEqual(tutte[0][1], 111);
  assert.ok(eliminaChiusura(PIN, vecchia.id).ok);
  assert.strictEqual(righe('Chiusure').length, 0);
};

module.exports['chi ha inserito: persone, colonne e report'] = function () {
  var a = avvio(PIN);
  assert.deepStrictEqual(a.persone, [], 'scheda Persone vuota dopo il setup');
  scheda_(SCHEDA_PERSONE).getRange(2, 1, 2, 1).setValues([['Maria'], ['Luca']]);
  assert.deepStrictEqual(avvio(PIN).persone, ['Maria', 'Luca']);
  var oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  salvaSpesa(PIN, spesa({ id: 'Spers-1', data: oggi, persona: 'Maria' }));
  salvaSpesa(PIN, spesa({ id: 'Spers-2', data: oggi, importo: '5', persona: 'Luca' }));
  salvaChiusura(PIN, { id: 'Cpers-1', data: oggi, contanti: '100', persona: 'Luca' }, false);
  assert.strictEqual(righe('Spese')[0][10], 'Maria');
  assert.strictEqual(righe('Chiusure')[0][9], 'Luca');
  // La modifica non cambia chi l'ha inserita
  modificaSpesa(PIN, spesa({ id: 'Spers-1', data: oggi, importo: '20', persona: 'Luca' }));
  assert.strictEqual(righe('Spese')[0][10], 'Maria');
  assert.strictEqual(elenco(PIN, { tipo: 'spese', persona: 'Luca' }).numero, 1);
  assert.strictEqual(elenco(PIN, { tipo: 'chiusure' }).voci[0].inseritoDa, 'Luca');
  inviaReportDiProva();
  var html = gas.finto.email[0].htmlBody;
  assert.ok(/Chi ha inserito/.test(html));
  assert.ok(/Maria/.test(html) && /Luca/.test(html));
  // Persona nella scheda vecchia senza colonna: avvio non si rompe
  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_PERSONE));
  assert.deepStrictEqual(avvio(PIN).persone, []);
};

module.exports['riepilogo e report contengono andamento e confronti'] = function () {
  demo.riempi({ giorni: 400 });
  var r = riepilogo(PIN, 0, 0);
  assert.strictEqual(r.andamento.mesi.length, 12);
  assert.strictEqual(r.andamento.confronto.length, 3);
  assert.ok(r.andamento.finoAlGiorno > 0, 'mese in corso: confronto alla pari');
  var passato = riepilogo(PIN, 2026, 1);
  assert.strictEqual(passato.andamento.finoAlGiorno, 0);
  inviaReportMensile();
  var email = gas.finto.email[gas.finto.email.length - 1];
  assert.ok(/Confronti/.test(email.htmlBody) && /Ultimi 12 mesi/.test(email.htmlBody) && /giorno della settimana/.test(email.htmlBody));
  assert.ok(/commercialista@example.com/.test(email.to));
};

module.exports['PIN bloccato: risposta tecnica (la coda riprova dopo, non scarta)'] = function () {
  for (var i = 0; i < 10; i++) salvaSpesa('0000', spesa());
  var r = salvaSpesa(PIN, spesa());
  assert.ok(!r.ok && r.tecnico && r.bloccato);
  assert.strictEqual(righe('Spese').length, 0);
};
