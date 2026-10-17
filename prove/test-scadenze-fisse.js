/*
 * Prove delle scadenze fisse del locale (modelli disattivati da attivare dall'app).
 */
'use strict';

var assert = require('assert');

var PIN = '1234';

function oggi(spostamento) {
  return Utilities.formatDate(new Date(new Date().getTime() + (spostamento || 0) * 86400000), FUSO, 'yyyy-MM-dd');
}

module.exports = {
  'setup: modelli disattivati e senza data, aggiunti una volta sola': function () {
    var modelli = leggiRicorrenti_().filter(function (r) { return /^RM-/.test(r.id); });
    assert.strictEqual(modelli.length, 7);
    assert.deepStrictEqual(modelli.map(function (m) { return m.descrizione; }), ['Controllo estintori', 'Manutenzione macchina del caffè',
      'Assicurazione del locale', 'SIAE / licenze musicali', 'Canone RAI speciale', 'TARI (tassa rifiuti)',
      'Revisione impianti (elettrico, gas, caldaia)']);
    assert.ok(modelli.every(function (m) { return !m.attiva && !m.prima; }));
    // Un modello cancellato a mano non ricompare
    var riga = modelli.filter(function (m) { return m.id === 'RM-canone-rai'; })[0].riga;
    scheda_(SCHEDA_RICORRENTI).deleteRow(riga);
    setup();
    var dopo = leggiRicorrenti_().filter(function (r) { return /^RM-/.test(r.id); });
    assert.strictEqual(dopo.length, 6);
    // Nessuna scadenza generata finché sono disattivati
    assert.strictEqual(aggiornaScadenze_(new Date()).daRicorrenti, 0);
  },

  'foglio già in uso (prima di questa versione): i modelli arrivano con setup': function () {
    PropertiesService.getScriptProperties().deleteProperty(PROPRIETA_MODELLI_FISSI);
    // Simula un foglio vecchio: tolgo i modelli
    leggiRicorrenti_().filter(function (r) { return /^RM-/.test(r.id); }).map(function (r) { return r.riga; })
      .sort(function (a, b) { return b - a; }).forEach(function (r) { scheda_(SCHEDA_RICORRENTI).deleteRow(r); });
    PropertiesService.getScriptProperties().deleteProperty(PROPRIETA_MODELLI_FISSI);
    setup();
    assert.strictEqual(leggiRicorrenti_().filter(function (r) { return /^RM-/.test(r.id); }).length, 7);
    assert.strictEqual(leggiRicorrenti_().length, 10, 'i 3 esempi restano');
  },

  'app: attivare con data, frequenza e importo; la scadenza compare': function () {
    var r = scadenzeFisse(PIN);
    assert.ok(r.ok);
    assert.strictEqual(r.voci.length, 7);
    assert.strictEqual(r.voci[0].attiva, false);
    var senzaData = salvaScadenzaFissa(PIN, { id: 'RM-estintori', data: '', frequenza: 'semestrale', attiva: true });
    assert.strictEqual(senzaData.ok, false);
    assert.ok(/data/.test(senzaData.messaggio));
    assert.strictEqual(salvaScadenzaFissa(PIN, { id: 'RM-estintori', data: oggi(10), frequenza: 'ogni tanto', attiva: true }).ok, false);
    assert.strictEqual(salvaScadenzaFissa(PIN, { id: 'R-altro', data: oggi(10), frequenza: 'annuale', attiva: true }).ok, false,
      'solo i modelli RM-');

    var s = salvaScadenzaFissa(PIN, { id: 'RM-estintori', data: oggi(10), frequenza: 'semestrale', importo: '85', attiva: true, persona: 'Maria' });
    assert.ok(s.ok, s.messaggio);
    var est = s.voci.filter(function (v) { return v.id === 'RM-estintori'; })[0];
    assert.ok(est.attiva);
    assert.strictEqual(est.prossima, dataIt_(leggiData_(oggi(10))));
    assert.strictEqual(est.quando, 'tra 10 giorni');
    var riga = leggiRicorrenti_().filter(function (x) { return x.id === 'RM-estintori'; })[0];
    assert.strictEqual(riga.importo, 85);
    assert.ok(/Attivata dall'app da Maria/.test(riga.note));
    var scad = leggiScadenze_().filter(function (x) { return x.descrizione === 'Controllo estintori'; });
    assert.strictEqual(scad.length, 1, 'scadenza creata nello scadenzario');
    assert.strictEqual(scad[0].importo, 85);

    // Disattivata: la scadenza futura non pagata sparisce
    s = salvaScadenzaFissa(PIN, { id: 'RM-estintori', data: oggi(10), frequenza: 'semestrale', importo: '85', attiva: false });
    assert.ok(s.ok);
    assert.strictEqual(leggiScadenze_().filter(function (x) { return x.descrizione === 'Controllo estintori'; }).length, 0);
  }
};
