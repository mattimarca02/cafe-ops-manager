/*
 * Prove di "Da pagare entro" sulle spese senza fattura, con l'Apps Script finto:
 * creazione, modifica, eliminazione, data vuota, nessun doppione, nessun doppio conteggio.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');

var PIN = '1234';

function spesa(extra) {
  var d = { id: 'Sscad-1', data: '2026-10-05', importo: '40,00', fornitore: 'Bibite Rossi', categoria: 'Bevande',
    pagamento: 'Bonifico', nota: 'Birre', scadenza: '2026-11-04' };
  for (var k in extra) d[k] = extra[k];
  return d;
}

function scadenzeDiSpese() {
  return leggiScadenze_().filter(function (s) { return s.origine.indexOf('S|') === 0; });
}

function righeSpese() {
  return leggiSpese_();
}

module.exports = {
  'senza data la spesa si comporta come prima: nessuna scadenza': function () {
    assert.ok(salvaSpesa(PIN, spesa({ scadenza: '' })).ok);
    assert.ok(salvaSpesa(PIN, spesa({ id: 'Sscad-2', scadenza: undefined })).ok);
    assert.strictEqual(righeSpese().length, 2);
    assert.strictEqual(leggiScadenze_().length, 0);
  },

  'con la data crea la voce nello scadenzario': function () {
    assert.ok(salvaSpesa(PIN, spesa()).ok);
    var s = scadenzeDiSpese();
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].descrizione, 'Spesa Bibite Rossi – Birre');
    assert.strictEqual(s[0].importo, 40);
    assert.strictEqual(chiaveGiorno_(s[0].data), '2026-11-04');
    assert.strictEqual(s[0].tipo, 'Spesa');
    assert.strictEqual(s[0].origine, 'S|Sscad-1');
    assert.strictEqual(s[0].pagata, false);
    assert.ok(s[0].id, 'ha il suo ID');
  },

  'senza nota la descrizione non ha il trattino': function () {
    salvaSpesa(PIN, spesa({ nota: '' }));
    assert.strictEqual(scadenzeDiSpese()[0].descrizione, 'Spesa Bibite Rossi');
  },

  'data non valida: errore e niente salvato': function () {
    var r = salvaSpesa(PIN, spesa({ scadenza: '31/02/2026' }));
    assert.strictEqual(r.ok, false);
    assert.ok(/Da pagare entro/.test(r.errore || r.messaggio || JSON.stringify(r)));
    assert.strictEqual(righeSpese().length, 0);
    assert.strictEqual(leggiScadenze_().length, 0);
  },

  'invio ripetuto (coda offline): nessun doppione': function () {
    assert.ok(salvaSpesa(PIN, spesa()).ok);
    var r = salvaSpesa(PIN, spesa());
    assert.ok(r.ok && r.giaSalvata);
    salvaSpesa(PIN, spesa());
    assert.strictEqual(righeSpese().length, 1);
    assert.strictEqual(scadenzeDiSpese().length, 1);
  },

  'se la prima volta mancava la scadenza, il rinvio la completa una volta sola': function () {
    // Simulo la rete caduta tra spesa e scadenza: la spesa c'è, la scadenza no.
    salvaSpesa(PIN, spesa({ scadenza: '' }));
    assert.strictEqual(scadenzeDiSpese().length, 0);
    var r = salvaSpesa(PIN, spesa());
    assert.ok(r.ok && r.giaSalvata);
    salvaSpesa(PIN, spesa());
    assert.strictEqual(scadenzeDiSpese().length, 1);
  },

  'modifica: cambia data, importo e descrizione senza doppioni': function () {
    salvaSpesa(PIN, spesa());
    var r = modificaSpesa(PIN, spesa({ importo: '55,50', nota: 'Birre e acqua', scadenza: '2026-11-20' }));
    assert.ok(r.ok);
    modificaSpesa(PIN, spesa({ importo: '55,50', nota: 'Birre e acqua', scadenza: '2026-11-20' }));
    var s = scadenzeDiSpese();
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].descrizione, 'Spesa Bibite Rossi – Birre e acqua');
    assert.strictEqual(s[0].importo, 55.5);
    assert.strictEqual(chiaveGiorno_(s[0].data), '2026-11-20');
    assert.strictEqual(righeSpese()[0].importo, 55.5);
  },

  'modifica: aggiungere la data a una spesa che non l\'aveva crea la voce': function () {
    salvaSpesa(PIN, spesa({ scadenza: '' }));
    assert.ok(modificaSpesa(PIN, spesa({ scadenza: '2026-11-04' })).ok);
    assert.strictEqual(scadenzeDiSpese().length, 1);
  },

  'modifica: togliere la data toglie la voce collegata (le altre restano)': function () {
    scheda_(SCHEDA_SCADENZE).appendRow(rigaScadenza_(leggiData_('2026-11-05'), 'Affitto', 800, TIPO_MANUALE, 'M|x'));
    salvaSpesa(PIN, spesa());
    salvaSpesa(PIN, spesa({ id: 'Sscad-2', fornitore: 'Altro', scadenza: '2026-11-10' }));
    assert.strictEqual(leggiScadenze_().length, 3);
    assert.ok(modificaSpesa(PIN, spesa({ scadenza: '' })).ok);
    var rimaste = leggiScadenze_().map(function (s) { return s.origine; }).sort();
    assert.deepStrictEqual(rimaste, ['M|x', 'S|Sscad-2']);
  },

  'modifica da app vecchia (campo non inviato): la data resta, importo e nota seguono': function () {
    salvaSpesa(PIN, spesa());
    var d = spesa({ importo: '60,00', nota: 'Nuova nota' });
    delete d.scadenza;
    assert.ok(modificaSpesa(PIN, d).ok);
    var s = scadenzeDiSpese();
    assert.strictEqual(s.length, 1);
    assert.strictEqual(chiaveGiorno_(s[0].data), '2026-11-04');
    assert.strictEqual(s[0].importo, 60);
    assert.strictEqual(s[0].descrizione, 'Spesa Bibite Rossi – Nuova nota');
  },

  'eliminare la spesa toglie la voce collegata': function () {
    salvaSpesa(PIN, spesa());
    salvaSpesa(PIN, spesa({ id: 'Sscad-2', scadenza: '2026-11-10' }));
    assert.ok(eliminaSpesa(PIN, 'Sscad-1').ok);
    assert.deepStrictEqual(scadenzeDiSpese().map(function (s) { return s.origine; }), ['S|Sscad-2']);
    assert.ok(eliminaSpesa(PIN, 'Sscad-1').giaEliminata, 'una seconda eliminazione non fa danni');
    assert.strictEqual(scadenzeDiSpese().length, 1);
  },

  'segnare Pagata non cambia la spesa e non la fa contare due volte': function () {
    salvaSpesa(PIN, spesa());
    salvaSpesa(PIN, spesa({ id: 'Sscad-2', importo: '10,00', categoria: 'Caffè', scadenza: '' }));
    var fotografia = function () {
      var r = riepilogo(PIN, 2026, 10);
      delete r.ultime;   // elenco con lo stato della scadenza (cambia di proposito): contano i totali
      return JSON.stringify({ spese: righeSpese(), r: r, c: calcolaReport_(2026, 10), b: totaliCategoriaMese_(2026, 10) });
    };
    var prima = fotografia();
    var voce = scadenzeDiSpese()[0];
    assert.ok(segnaScadenzaPagata(PIN, voce.id, true, 'Maria').ok);
    assert.strictEqual(scadenzeDiSpese()[0].pagata, true);
    var dopo = fotografia();
    assert.strictEqual(dopo, prima, 'spese, Riepilogo, report e budget identici');
    var rie = riepilogo(PIN, 2026, 10);
    assert.strictEqual(rie.totaleSpese, 50, '40 + 10, la scadenza non si somma');
    assert.strictEqual(rie.totaleComplessivo, 50);
    assert.strictEqual(calcolaReport_(2026, 10).totaleSpese, 50);
    assert.strictEqual(totaliCategoriaMese_(2026, 10)['Bevande'], 40);
    // Anche il saldo fornitori (solo fatture) non cambia
    assert.strictEqual(saldoFornitoriDelMese_(2026, 10).totali.daPagare, 0);
  },

  'modificare una spesa già pagata nello scadenzario mantiene lo stato «Pagata»': function () {
    salvaSpesa(PIN, spesa());
    segnaScadenzaPagata(PIN, scadenzeDiSpese()[0].id, true, 'Maria');
    modificaSpesa(PIN, spesa({ scadenza: '2026-12-01' }));
    var s = scadenzeDiSpese();
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].pagata, true);
    assert.strictEqual(s[0].pagataDa, 'Maria');
  },

  'elenco, riepilogo e schermata Scadenze mostrano la voce': function () {
    salvaSpesa(PIN, spesa());
    salvaSpesa(PIN, spesa({ id: 'Sscad-2', scadenza: '' }));
    var el = elenco(PIN, { tipo: 'spese' });
    var perId = {};
    el.voci.forEach(function (v) { perId[v.id] = v; });
    assert.strictEqual(perId['Sscad-1'].scadenzaIso, '2026-11-04');
    assert.strictEqual(perId['Sscad-1'].scadenza, '04/11/2026');
    assert.strictEqual(perId['Sscad-1'].scadenzaPagata, false);
    assert.strictEqual(perId['Sscad-2'].scadenzaIso, '');
    var ult = riepilogo(PIN, 2026, 10).ultime.filter(function (v) { return v.id === 'Sscad-1'; })[0];
    assert.strictEqual(ult.scadenzaIso, '2026-11-04');
    var sc = scadenze(PIN);
    assert.ok(sc.ok);
    var voce = sc.daPagare.filter(function (x) { return x.tipo === 'Spesa'; });
    assert.strictEqual(voce.length, 1);
    assert.strictEqual(voce[0].descrizione, 'Spesa Bibite Rossi – Birre');
  },

  'il promemoria email include la spesa in scadenza': function () {
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    salvaSpesa(PIN, spesa({ scadenza: '2026-10-12' }));
    var r = inviaPromemoriaScadenze_(leggiData_('2026-10-12'));
    assert.ok(r.inviata && r.oggi === 1);
    assert.ok(/Bibite Rossi/.test(gas.finto.email[0].htmlBody) && /40,00/.test(gas.finto.email[0].htmlBody));
  },

  'senza la scheda Scadenze: errore chiaro se serve, nessun problema se non serve': function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.deleteSheet(ss.getSheetByName('Scadenze'));
    assert.ok(salvaSpesa(PIN, spesa({ scadenza: '' })).ok);
    var r = salvaSpesa(PIN, spesa({ id: 'Sscad-2' }));
    assert.strictEqual(r.ok, false);
    assert.ok(/Prepara il foglio/.test(r.errore || r.messaggio || JSON.stringify(r)));
    assert.strictEqual(righeSpese().length, 1, 'la spesa con scadenza non è stata salvata a metà');
    assert.ok(eliminaSpesa(PIN, 'Sscad-1').ok);
  }
};
