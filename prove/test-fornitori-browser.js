/*
 * Prova nel browser della schermata Fornitori: ordinamento, dettaglio e «Segna pagata».
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

module.exports = {
  'fornitori: elenco ordinabile, fatture del fornitore e segna pagata': async function () {
    await conBrowser(8773, { giorni: 60 }, async function (p, s) {
      await p.click('#nav-spese');
      await p.click('#vai-fornitori');
      await s.attendi();
      assert.ok(/Ancora da pagare/.test(await p.textContent('#fornitori-riassunto')));
      var nomi = await p.$$eval('#fornitori-elenco .voce-titolo', function (b) { return b.map(function (x) { return x.textContent; }); });
      assert.ok(nomi.length >= 2);
      await p.click('#fornitori-ordine button[data-ordine="nome"]');
      var perNome = await p.$$eval('#fornitori-elenco .voce-titolo', function (b) { return b.map(function (x) { return x.textContent; }); });
      assert.deepStrictEqual(perNome, perNome.slice().sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; }));
      await p.click('#fornitori-ordine button[data-ordine="daPagare"]');

      await p.click('#fornitori-elenco .voce >> nth=0 >> button:has-text("Vedi le fatture")');
      await p.waitForSelector('#schermo-fornitore', { state: 'visible' });
      var daPagare = await p.$$('#fornitore-fatture button:has-text("Segna pagata")');
      assert.ok(daPagare.length >= 1, 'almeno una fattura da pagare nei dati demo');
      var prima = await p.textContent('#fornitore-totali');
      await daPagare[0].click();
      await p.click('#conferma-si');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-fornitore', { state: 'visible', timeout: 10000 });
      await s.attendi();
      assert.notStrictEqual(await p.textContent('#fornitore-totali'), prima, 'il da pagare cambia');
      var pagate = (await s.leggi('Scadenze')).slice(1).filter(function (r) { return r[6] === 'SI' && r[8]; });
      assert.strictEqual(pagate.length, 1, 'segnata pagata con il nome');
      await p.click('#fornitore-torna');
      await p.waitForSelector('#schermo-fornitori', { state: 'visible' });
    });
  }
};
