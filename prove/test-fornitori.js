/*
 * Prove del saldo per fornitore con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var demo = require('./dati-demo');

var PIN = '1234';

function oggi(spostamento) {
  return leggiData_(Utilities.formatDate(new Date(new Date().getTime() + (spostamento || 0) * 86400000), FUSO, 'yyyy-MM-dd'));
}

function fattura(numero, data, totale, scadenza, fornitore, piva) {
  scheda_(SCHEDA_FATTURE).appendRow([data, numero, fornitore || 'Torrefazione Rossi', piva === undefined ? '01234567897' : piva,
    'TD01 - Fattura', totale / 1.22, totale - totale / 1.22, totale, scadenza || '', 'Caffè', numero + '.xml', new Date()]);
}

module.exports = {
  'app: saldo con da pagare, pagato e prossima scadenza; segna pagata': function () {
    // Prima attivazione dello scadenzario: le fatture già scadute vengono segnate pagate
    aggiornaScadenze_(new Date());
    fattura('F1', oggi(-3), 305, oggi(20));
    fattura('F2', oggi(-2), 100, oggi(-1));
    fattura('B1', oggi(-1), 50, '', 'Bevande Bianchi', '09876543210');
    var r = saldoFornitori(PIN);
    assert.ok(r.ok, r.messaggio);
    assert.strictEqual(r.fornitori.length, 2);
    var rossi = r.fornitori[0];
    assert.strictEqual(rossi.nome, 'Torrefazione Rossi');
    assert.strictEqual(rossi.daPagare, 405);
    assert.strictEqual(rossi.scaduto, true);
    assert.ok(/scaduta ieri/.test(rossi.quandoProssima));
    assert.strictEqual(rossi.fatture.length, 2);
    assert.ok(rossi.fatture.every(function (f) { return f.idScadenza && f.stato === 'da pagare'; }));
    assert.strictEqual(r.fornitori[1].daPagare, 0, 'senza scadenza: già pagata');
    assert.strictEqual(r.totali.daPagare, 405);

    var f2 = rossi.fatture.filter(function (f) { return f.numero === 'F2'; })[0];
    assert.ok(segnaScadenzaPagata(PIN, f2.idScadenza, true, 'Maria').ok);
    rossi = saldoFornitori(PIN).fornitori[0];
    assert.strictEqual(rossi.daPagare, 305);
    assert.strictEqual(rossi.scaduto, false);
    assert.strictEqual(rossi.prossima, dataIt_(oggi(20)));
  },

  'report: sezione Saldo fornitori ed Excel': function () {
    demo.riempi({ giorni: 40 });
    var o = annoMeseOggi_();
    var d = calcolaReport_(o.anno, o.mese, o.giorno);
    var html = htmlReport_(d, MESI[o.mese - 1] + ' ' + o.anno, true);
    assert.ok(/Saldo fornitori/.test(html));
    assert.ok(/Torrefazione Rossi/.test(html));
    assert.ok(/Totale ancora da pagare oggi/.test(html));
    assert.ok(/Saldo fornitori \(da pagare oggi:/.test(testoReport_(d, 'mese')));
    inviaReportDiProva();
  },

  'app con i dati demo: niente date nella risposta e numeri coerenti': function () {
    demo.riempi({ giorni: 60 });
    var r = saldoFornitori(PIN);
    assert.ok(r.ok);
    assert.ok(r.fornitori.length >= 2);
    r.fornitori.forEach(function (f) {
      assert.ok(Math.abs(f.pagatoAnno + f.fatture.filter(function (x) { return x.stato === 'da pagare' && x.data.slice(-4) === String(r.anno); })
        .reduce(function (t, x) { return t + x.totale; }, 0) - f.totaleAnno) < 0.01, 'pagato + da pagare dell\'anno = totale dell\'anno');
      f.fatture.forEach(function (x) { assert.strictEqual(typeof x.data, 'string'); });
    });
  }
};
