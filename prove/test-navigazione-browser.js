/*
 * Prova nel browser della navigazione: barra in basso, pagine Spese/Cassa/Altro,
 * «Indietro» verso la pagina da cui si arriva, barra nascosta nei moduli e
 * dettagli dietro «Mostra altro».
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

async function visibile(p, sel) { return p.isVisible(sel); }

async function schedaAttiva(p) {
  return p.evaluate(function () {
    var b = document.querySelector('#navigazione button.attiva');
    return b ? b.id : '';
  });
}

module.exports = {
  'barra in basso: cinque schede, scheda attiva e barra nascosta nei moduli': async function () {
    await conBrowser(8797, { giorni: 20 }, async function (p, s) {
      assert.ok(await visibile(p, '#navigazione'));
      assert.strictEqual(await schedaAttiva(p), 'nav-home');
      assert.strictEqual(await p.locator('#navigazione button').count(), 5);

      await p.click('#nav-spese');
      assert.ok(await visibile(p, '#schermo-spese'));
      assert.strictEqual(await schedaAttiva(p), 'nav-spese');
      assert.strictEqual(await p.getAttribute('#nav-spese', 'aria-current'), 'page');

      await p.click('#nav-cassa');
      assert.ok(await visibile(p, '#schermo-cassa'));
      await p.click('#nav-altro');
      assert.ok(await visibile(p, '#schermo-altro'));
      assert.ok(await visibile(p, '#esci'));

      await p.click('#vai-riepilogo');
      await s.attendi();
      assert.ok(await visibile(p, '#schermo-riepilogo'));
      assert.strictEqual(await schedaAttiva(p), 'vai-riepilogo');

      // Nei moduli la barra sparisce (non si perde quello che si sta scrivendo)
      await p.click('#nav-cassa');
      await p.click('#cassa-chiusura');
      assert.ok(await visibile(p, '#schermo-chiusura'));
      assert.ok(!(await visibile(p, '#navigazione')));
      await p.click('#chiusura-annulla');
      assert.ok(await visibile(p, '#navigazione'));

      await p.click('#nav-spese');
      await p.click('#spese-nuova');
      assert.ok(await visibile(p, '#schermo-spesa'));
      assert.ok(!(await visibile(p, '#navigazione')));
      await p.click('#spesa-annulla');

      // Mentre c'è un messaggio la barra non si vede
      await p.click('#vai-spesa');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      assert.ok(!(await visibile(p, '#navigazione')));
      await p.click('#errore-chiudi');
    });
  },

  '«Indietro» torna alla pagina da cui si è arrivati': async function () {
    await conBrowser(8798, { giorni: 20 }, async function (p, s) {
      // Scadenze dalla home → Indietro torna alla home
      await p.click('#vai-scadenze');
      await s.attendi();
      await p.click('#schermo-scadenze .torna-su');
      assert.ok(await visibile(p, '#schermo-home'));

      // Scadenze dalla pagina Spese → Indietro torna a Spese
      await p.click('#nav-spese');
      await p.click('#spese-scadenze');
      await s.attendi();
      assert.strictEqual(await schedaAttiva(p), 'nav-spese');
      await p.click('#schermo-scadenze .torna-su');
      assert.ok(await visibile(p, '#schermo-spese'));

      // Chiusure inserite dalla pagina Cassa: elenco già sulle chiusure, Indietro torna a Cassa
      await p.click('#nav-cassa');
      await p.click('#cassa-elenco');
      await s.attendi();
      assert.ok(await visibile(p, '#schermo-elenco'));
      assert.strictEqual(await p.getAttribute('#elenco-tipo button[data-tipo="chiusure"]', 'class'), 'scelto');
      await p.click('#schermo-elenco .torna-su');
      assert.ok(await visibile(p, '#schermo-cassa'));

      // «Cerca e modifica» dalla pagina Spese riparte dalle spese
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await s.attendi();
      assert.strictEqual(await p.getAttribute('#elenco-tipo button[data-tipo="spese"]', 'class'), 'scelto');

      // HACCP dalla pagina Altro → Indietro torna ad Altro
      await p.click('#nav-altro');
      await p.click('#altro-haccp');
      await s.attendi();
      assert.ok(await visibile(p, '#schermo-haccp'));
      await p.click('#schermo-haccp .torna-su');
      assert.ok(await visibile(p, '#schermo-altro'));
    });
  },

  'home: stato della giornata e «Mostra altro»': async function () {
    await conBrowser(8799, { giorni: 20 }, async function (p, s) {
      assert.ok(/^(Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica) \d+ [a-z]+$/.test(await p.textContent('#home-data')));
      // Ogni riga di stato ha un testo; il numerino c'è solo se c'è qualcosa da fare
      for (var id of ['haccp', 'scadenze', 'ordini', 'margini']) {
        assert.ok((await p.textContent('#home-' + id + '-stato')).length > 3, 'stato ' + id);
      }
      var numero = await p.textContent('#home-scadenze-numero');
      assert.strictEqual(await visibile(p, '#home-scadenze-numero'), Number(numero) > 0);
      assert.strictEqual(await visibile(p, '#home-scadenze-ok'), !(Number(numero) > 0));

      // Dettagli secondari: chiusi, si aprono e si richiudono
      await p.click('#nav-altro');
      await p.click('#altro-margini');
      await s.attendi();
      assert.ok(!(await visibile(p, '#margini-altro')));
      await p.click('#schermo-margini .mostra-altro');
      assert.ok(await visibile(p, '#margini-altro'));
      assert.strictEqual(await p.getAttribute('#schermo-margini .mostra-altro', 'aria-expanded'), 'true');
      assert.strictEqual((await p.textContent('#schermo-margini .mostra-altro')).trim(), 'Mostra meno');
      await p.click('#schermo-margini .mostra-altro');
      assert.ok(!(await visibile(p, '#margini-altro')));

      // Filtri dell'elenco: chiusi finché non se ne sceglie uno
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await s.attendi();
      assert.ok(!(await visibile(p, '#elenco-mese')));
      await p.click('#elenco-filtri-apri');
      await p.selectOption('#elenco-mese', { index: 1 });
      await s.attendi();
      assert.ok(await visibile(p, '#elenco-mese'));
      assert.ok(await visibile(p, '#elenco-azzera'));
    });
  }
};
