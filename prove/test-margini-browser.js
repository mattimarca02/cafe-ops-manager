/*
 * Prova nel browser della schermata Margini: nuovo prodotto con anteprima e avviso sotto soglia.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

module.exports = {
  'margini: nuovo prodotto sotto soglia ben evidente': async function () {
    await conBrowser(8776, { giorni: 5, senzaMargini: true }, async function (p, s) {
      await p.click('#vai-margini');
      await s.attendi();
      assert.ok(/Caffè espresso/.test(await p.textContent('#margini-elenco')));
      assert.ok(/88,5%/.test(await p.textContent('#margini-elenco')));
      await p.click('#margini-nuovo');
      await p.fill('#pm-nome', 'Acqua minerale 0,5 l');
      await p.fill('#pm-prezzo', '0,90');
      await p.click('#pm-unita button:has-text("pezzo")');
      await p.fill('#pm-quantita', '1');
      await p.click('#pm-iva button:has-text("22%")');
      await p.fill('#pm-vendita', '1,50');
      assert.strictEqual(await p.getAttribute('#pm-anteprima', 'class'), 'quadratura quadratura-ammanco');
      assert.ok(/Margine 26,8%/.test(await p.textContent('#pm-anteprima')));
      await p.click('#pm-salva');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-margini', { state: 'visible', timeout: 10000 });
      assert.ok(/1 prodotto ha un margine sotto il 60%/.test(await p.textContent('#margini-riassunto')));
      var primo = await p.textContent('#margini-elenco .voce >> nth=0');
      assert.ok(/Acqua minerale/.test(primo) && /Margine sotto il 60%/.test(primo));
      var righe = (await s.leggi('Ricette/Costi')).slice(1).filter(function (r) { return r[0] === 'Acqua minerale 0,5 l'; });
      assert.strictEqual(righe.length, 1);
      assert.strictEqual(righe[0][1], 0.9);
      assert.strictEqual(righe[0][5], 22);
      await p.click('#margini-ordine button[data-ordine="alto"]');
      assert.ok(/Caffè espresso/.test(await p.textContent('#margini-elenco .voce >> nth=0')));
    });
  }
};
