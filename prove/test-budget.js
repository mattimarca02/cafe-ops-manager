/*
 * Prove del budget per categoria con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');

var PIN = '1234';

function oggiIso() { return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd'); }

function tetto(categoria, euro) {
  var b = leggiBudget_().filter(function (x) { return x.categoria === categoria; })[0];
  scheda_(SCHEDA_BUDGET).getRange(b.riga, 2).setValue(euro);
}

var n = 0;
function spesa(categoria, importo, data) {
  n++;
  var r = salvaSpesa(PIN, { id: 'Sbudget-' + n + 'x', data: data || oggiIso(), importo: importo, fornitore: 'Prova',
    categoria: categoria, pagamento: 'Contanti' });
  assert.ok(r.ok, r.messaggio);
}

module.exports = {
  'setup: scheda Budget con tutte le categorie, senza toccare i tetti già scritti': function () {
    var b = leggiBudget_();
    assert.strictEqual(b.length, CATEGORIE_PREDEFINITE.length);
    assert.ok(b.every(function (x) { return x.tetto === null; }));
    tetto('Caffè', 500);
    scheda_(SCHEDA_CATEGORIE).appendRow(['Gelati']);
    setup();
    b = leggiBudget_();
    assert.strictEqual(b.length, CATEGORIE_PREDEFINITE.length + 1, 'la categoria nuova viene aggiunta');
    assert.strictEqual(b.filter(function (x) { return x.categoria === 'Caffè'; })[0].tetto, 500);
  },

  'senza tetti: nessun avviso e riepilogo vuoto': function () {
    spesa('Caffè', '900');
    assert.strictEqual(gas.finto.email.length, 0);
    assert.deepStrictEqual(riepilogo(PIN, 0, 0).budget, []);
  },

  'email una sola volta all\'80% e al 100%, spese e fatture insieme': function () {
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    tetto('Caffè', 500);
    spesa('Caffè', '300');
    assert.strictEqual(gas.finto.email.length, 0, '60%: niente');
    // Fattura dello stesso mese (per data del documento) nella stessa categoria
    scheda_(SCHEDA_FATTURE).appendRow([leggiData_(oggiIso()), 'F1', 'Torrefazione', '01234567897', 'TD01 - Fattura', 82, 18, 100,
      '', 'Caffè', 'f.xml', new Date()]);
    spesa('Caffè', '10');
    assert.strictEqual(gas.finto.email.length, 1, '82%: avviso dell\'80%');
    assert.ok(/Caffè oltre l'80%/.test(gas.finto.email[0].subject));
    assert.strictEqual(gas.finto.email[0].to, 'titolare@example.com');
    spesa('Caffè', '20');
    assert.strictEqual(gas.finto.email.length, 1, 'stesso mese: niente doppioni');
    spesa('Caffè', '100');
    assert.strictEqual(gas.finto.email.length, 2, '106%: avviso del 100%');
    assert.ok(/oltre il 100%/.test(gas.finto.email[1].subject));
    assert.ok(/superato di 30,00 €/.test(gas.finto.email[1].body));
    spesa('Caffè', '5');
    assert.strictEqual(gas.finto.email.length, 2);
    var b = leggiBudget_().filter(function (x) { return x.categoria === 'Caffè'; })[0];
    var mese = oggiIso().substring(0, 7);
    assert.strictEqual(b.avviso80, mese);
    assert.strictEqual(b.avviso100, mese);

    var r = riepilogo(PIN, 0, 0);
    assert.strictEqual(r.budget.length, 1);
    assert.strictEqual(r.budget[0].speso, 535);
    assert.strictEqual(r.budget[0].livello, 'superato');
  },

  'spesa oltre il 100% di colpo: un solo avviso (quello del 100%)': function () {
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    tetto('Bevande', 100);
    spesa('Bevande', '150');
    assert.strictEqual(gas.finto.email.length, 1);
    assert.ok(/oltre il 100%/.test(gas.finto.email[0].subject));
    spesa('Bevande', '1');
    assert.strictEqual(gas.finto.email.length, 1);
  },

  'spese vecchie (oltre il mese scorso) non mandano avvisi; fatture importate sì (controllo giornaliero)': function () {
    tetto('Alimentari', 50);
    spesa('Alimentari', '80', '2025-01-10');
    assert.strictEqual(gas.finto.email.length, 0);
    scheda_(SCHEDA_FATTURE).appendRow([leggiData_(oggiIso()), 'F9', 'Super', '', 'TD01 - Fattura', 50, 5, 55, '', 'Alimentari', 'g.xml', new Date()]);
    importaFattureAutomatica();
    assert.strictEqual(gas.finto.email.length, 1);
  },

  'report: sezione Budget per categoria': function () {
    tetto('Caffè', 200);
    spesa('Caffè', '150', '2026-09-10');
    var d = calcolaReport_(2026, 9, 0);
    var html = htmlReport_(d, 'Settembre 2026', false);
    assert.ok(/Budget per categoria/.test(html));
    assert.ok(/75%, nel budget/.test(html));
    assert.ok(/Caffè: 150,00 € su 200,00 € \(75%\)/.test(testoReport_(d, 'Settembre 2026')));
  },

  'dopo una spesa il controllo non aspetta se un altro salvataggio ha il lock': function () {
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    tetto('Caffè', 10);
    var originale = LockService.getScriptLock;
    // Un altro telefono sta salvando: il lock non è libero subito
    LockService.getScriptLock = function () {
      var l = originale();
      l.tryLock = function () { return false; };
      return l;
    };
    try {
      spesa('Caffè', '50');
    } finally {
      LockService.getScriptLock = originale;
    }
    assert.strictEqual(gas.finto.email.length, 0, 'nessuna attesa e nessuna email: ci pensa il controllo del mattino');
    assert.strictEqual(controllaBudgetRecenti_(), 1, 'il controllo giornaliero manda l\'avviso');
    assert.strictEqual(gas.finto.email.length, 1);
  }
};
