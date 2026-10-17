/*
 * Prove dello scadenzario con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');

var PIN = '1234';

function righeScadenze() {
  return leggiScadenze_().sort(function (a, b) { return a.data - b.data; });
}

function fattura(numero, data, scadenza, totale) {
  scheda_(SCHEDA_FATTURE).appendRow([leggiData_(data), numero, 'Fornitore Prova', '01234567897', 'TD01 - Fattura',
    totale / 1.22, totale - totale / 1.22, totale, scadenza ? leggiData_(scadenza) : '', 'Caffè', 'f.xml', new Date()]);
}

/** Riga della ricorrente con quella descrizione (dopo gli esempi e i modelli creati dal setup). */
function rigaRicorrente(descrizione) {
  return leggiRicorrenti_().filter(function (r) { return r.descrizione === descrizione; })[0].riga;
}

function ricorrente(descrizione, importo, frequenza, prima, attiva) {
  scheda_(SCHEDA_RICORRENTI).appendRow([descrizione, importo, frequenza, leggiData_(prima), '', attiva || 'SI', '']);
}

module.exports = {
  'setup prepara le schede e gli esempi disattivati': function () {
    assert.ok(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Scadenze'));
    var ric = leggiRicorrenti_();
    assert.strictEqual(ric.length, 3 + MODELLI_SCADENZE_FISSE.length, '3 esempi + i modelli delle scadenze fisse');
    assert.ok(ric.every(function (r) { return !r.attiva; }), 'esempi e modelli sono disattivati');
    assert.strictEqual(leggiImpostazione_(IMP_GIORNI_PREAVVISO), '3');
    var esito = aggiornaScadenze_(leggiData_('2026-10-09'));
    assert.strictEqual(esito.daRicorrenti, 0);
  },

  'scadenze da fatture e ricorrenti, senza doppioni': function () {
    var oggi = leggiData_('2026-10-09');
    fattura('F1', '2026-09-15', '2026-10-15', 305);
    fattura('F2', '2026-01-10', '2026-02-10', 100);          // troppo vecchia
    fattura('NC1', '2026-10-01', '2026-10-30', -50);          // nota di credito: niente scadenza
    fattura('F3', '2026-10-01', '', 80);                      // senza scadenza
    ricorrente('Affitto', 800, 'mensile', '2026-01-05');
    ricorrente('F24', 1100, 'trimestrale', '2026-03-16');
    var e1 = aggiornaScadenze_(oggi);
    assert.strictEqual(e1.daFatture, 1);
    // Finestra: da un mese indietro (08/09) a 60 giorni avanti (08/12).
    // Affitto: 05/10, 05/11, 05/12; F24: 16/09 (il 16/12 è oltre i 60 giorni)
    assert.strictEqual(e1.daRicorrenti, 4);
    var e2 = aggiornaScadenze_(oggi);
    assert.strictEqual(e2.daFatture + e2.daRicorrenti, 0, 'la seconda volta non aggiunge nulla');
    var date = righeScadenze().map(function (s) { return chiaveGiorno_(s.data) + ' ' + s.descrizione; });
    assert.deepStrictEqual(date, [
      '2026-09-16 F24', '2026-10-05 Affitto', '2026-10-15 Fattura n. F1 – Fornitore Prova', '2026-11-05 Affitto',
      '2026-12-05 Affitto'
    ]);
    // Il giorno dopo il 60° giorno entra anche l'F24 di dicembre
    assert.strictEqual(aggiornaScadenze_(leggiData_('2026-10-17')).daRicorrenti, 1);
  },

  'ricorrente cambiata: le scadenze future non pagate si aggiornano': function () {
    var oggi = leggiData_('2026-10-09');
    ricorrente('Affitto', 800, 'mensile', '2026-01-05');
    aggiornaScadenze_(oggi);
    // Pago quella di novembre in anticipo, poi l'affitto passa al giorno 10
    var nov = righeScadenze().filter(function (s) { return chiaveGiorno_(s.data) === '2026-11-05'; })[0];
    assert.ok(segnaScadenzaPagata(PIN, nov.id, true, 'Maria').ok);
    scheda_(SCHEDA_RICORRENTI).getRange(rigaRicorrente('Affitto'), 4).setValue(leggiData_('2026-01-10'));
    var e = aggiornaScadenze_(oggi);
    assert.strictEqual(e.tolte, 1, 'tolta solo quella futura non pagata (05/12)');
    var date = righeScadenze().map(function (s) { return chiaveGiorno_(s.data) + (s.pagata ? ' pagata' : ''); });
    assert.deepStrictEqual(date, ['2026-09-10', '2026-10-05', '2026-10-10', '2026-11-05 pagata', '2026-11-10']);
    // Disattivata: restano solo quelle passate o pagate
    scheda_(SCHEDA_RICORRENTI).getRange(rigaRicorrente('Affitto'), 6).setValue('NO');
    aggiornaScadenze_(oggi);
    date = righeScadenze().map(function (s) { return chiaveGiorno_(s.data); });
    assert.deepStrictEqual(date, ['2026-09-10', '2026-10-05', '2026-11-05']);
  },

  'promemoria: preavviso, giorno della scadenza, una volta sola': function () {
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    ricorrente('Affitto', 800, 'mensile', '2026-10-12');
    var r1 = inviaPromemoriaScadenze_(leggiData_('2026-10-08')); // mancano 4 giorni: preavviso 3 → niente
    assert.strictEqual(r1.inviata, false);
    var r2 = inviaPromemoriaScadenze_(leggiData_('2026-10-09')); // mancano 3 giorni → preavviso
    assert.ok(r2.inviata && r2.inArrivo === 1);
    assert.strictEqual(gas.finto.email[0].to, 'titolare@example.com');
    assert.ok(/1 in arrivo/.test(gas.finto.email[0].subject));
    assert.ok(/Affitto/.test(gas.finto.email[0].htmlBody) && /800,00/.test(gas.finto.email[0].htmlBody));
    assert.strictEqual(inviaPromemoriaScadenze_(leggiData_('2026-10-10')).inviata, false, 'niente doppio preavviso');
    var r3 = inviaPromemoriaScadenze_(leggiData_('2026-10-12'));
    assert.ok(r3.inviata && r3.oggi === 1, 'avviso il giorno della scadenza');
    assert.strictEqual(inviaPromemoriaScadenze_(leggiData_('2026-10-12')).inviata, false);
    // Pagata: nessun altro avviso
    var s = righeScadenze().filter(function (x) { return chiaveGiorno_(x.data) === '2026-11-12'; })[0];
    segnaScadenzaPagata(PIN, s.id, true, '');
    assert.strictEqual(inviaPromemoriaScadenze_(leggiData_('2026-11-10')).inviata, false);
  },

  'app: elenco scadenze, pagata/da pagare, nuova scadenza': function () {
    var oggi = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
    var r = nuovaScadenza(PIN, { descrizione: 'Tassa rifiuti', importo: '150', data: oggi, frequenza: '', id: 'Dprova-1' });
    assert.ok(r.ok, r.messaggio);
    assert.ok(nuovaScadenza(PIN, { descrizione: 'Tassa rifiuti', importo: '150', data: oggi, frequenza: '', id: 'Dprova-1' }).giaSalvata);
    assert.ok(nuovaScadenza(PIN, { descrizione: 'Internet', importo: '30', data: oggi, frequenza: 'mensile' }).ok);
    assert.ok(!nuovaScadenza(PIN, { descrizione: '', data: oggi }).ok);
    assert.ok(!nuovaScadenza(PIN, { descrizione: 'X', data: 'ieri' }).ok);
    assert.ok(!nuovaScadenza(PIN, { descrizione: 'X', data: oggi, frequenza: 'ogni tanto' }).ok);
    var e = scadenze(PIN);
    assert.ok(e.ok, e.messaggio);
    var nomi = e.daPagare.map(function (s) { return s.descrizione; });
    assert.ok(nomi.indexOf('Tassa rifiuti') >= 0 && nomi.indexOf('Internet') >= 0);
    assert.strictEqual(e.daPagare[0].quando, 'oggi');
    assert.strictEqual(contaScadenzeVicine_(), 2);
    assert.strictEqual(avvio(PIN).scadenzeVicine, 2);
    var id = e.daPagare[0].id;
    assert.ok(segnaScadenzaPagata(PIN, id, true, 'Luca').ok);
    var e2 = scadenze(PIN);
    assert.strictEqual(e2.daPagare.length, 1);
    assert.strictEqual(e2.pagate.length, 1);
    assert.strictEqual(e2.pagate[0].pagataDa, 'Luca');
    assert.ok(segnaScadenzaPagata(PIN, id, false).ok);
    assert.strictEqual(scadenze(PIN).daPagare.length, 2);
  },

  'righe scritte a mano nel foglio ricevono un ID': function () {
    scheda_(SCHEDA_SCADENZE).appendRow(['', leggiData_('2026-10-20'), 'Revisione estintori', 90]);
    aggiornaScadenze_(leggiData_('2026-10-09'));
    var s = righeScadenze()[0];
    assert.ok(s.id);
    assert.strictEqual(s.tipo, 'A mano');
  }
};

module.exports['prima attivazione: fatture già scadute segnate pagate, ricorrente dall\'app senza doppioni'] = function () {
  var oggi = leggiData_('2026-10-09');
  fattura('VECCHIA', '2026-08-20', '2026-09-20', 120);
  fattura('NUOVA', '2026-10-01', '2026-10-30', 80);
  aggiornaScadenze_(oggi);
  var righe = righeScadenze();
  assert.strictEqual(righe[0].pagata, true, 'scaduta prima dell\'attivazione: pagata');
  assert.ok(/in automatico/.test(righe[0].note));
  assert.strictEqual(righe[1].pagata, false);
  // Fatture importate dopo l'attivazione: anche se scadute restano da pagare
  fattura('DOPO', '2026-09-01', '2026-10-01', 50);
  aggiornaScadenze_(oggi);
  assert.strictEqual(righeScadenze().filter(function (s) { return /DOPO/.test(s.descrizione); })[0].pagata, false);

  var dati = { id: 'Dric-1', descrizione: 'Internet', importo: '30', data: '2026-10-20', frequenza: 'mensile' };
  assert.ok(nuovaScadenza(PIN, dati).ok);
  assert.ok(nuovaScadenza(PIN, dati).giaSalvata, 'seconda richiesta uguale: nessun doppione');
  assert.strictEqual(leggiRicorrenti_().filter(function (r) { return r.descrizione === 'Internet'; }).length, 1);
};

module.exports['ricorrente: nuovo importo aggiornato sulle prossime non pagate'] = function () {
  var oggi = leggiData_('2026-10-09');
  ricorrente('Affitto', 800, 'mensile', '2026-01-20');
  aggiornaScadenze_(oggi);
  scheda_(SCHEDA_RICORRENTI).getRange(rigaRicorrente('Affitto'), 2).setValue(850);
  var e = aggiornaScadenze_(oggi);
  assert.strictEqual(e.aggiornate, 2, '20/10 e 20/11');
  var importi = righeScadenze().map(function (s) { return chiaveGiorno_(s.data) + ' ' + s.importo; });
  assert.deepStrictEqual(importi, ['2026-09-20 800', '2026-10-20 850', '2026-11-20 850']);
};
