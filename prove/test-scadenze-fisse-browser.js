/*
 * Prova nel browser delle scadenze fisse del locale: data → attivata da sola → salvata.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

module.exports = {
  'scadenze fisse: attivare la TARI dal telefono': async function () {
    await conBrowser(8774, { giorni: 5 }, async function (p, s) {
      await p.click('#vai-scadenze');
      await s.attendi();
      await p.click('#scadenze-fisse');
      await s.attendi();
      assert.strictEqual(await p.$$eval('#sf-elenco .voce', function (v) { return v.length; }), 7);
      var voce = p.locator('#sf-elenco .voce:has-text("TARI")');
      assert.ok(/Disattivata/.test(await voce.textContent()));
      var data = new Date(Date.now() + 20 * 86400000);
      var iso = data.getFullYear() + '-' + ('0' + (data.getMonth() + 1)).slice(-2) + '-' + ('0' + data.getDate()).slice(-2);
      await voce.locator('input[type="date"]').fill(iso);
      assert.ok(/Promemoria attivo/.test(await voce.locator('.scelta-singola button').textContent()), 'scrivendo la data si attiva');
      await voce.locator('input[inputmode="decimal"]').fill('320,50');
      await voce.locator('select').selectOption('quadrimestrale');
      await voce.locator('button:has-text("Salva")').click();
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-scadenze-fisse', { state: 'visible', timeout: 10000 });
      assert.ok(/Attiva · prossima/.test(await p.locator('#sf-elenco .voce:has-text("TARI")').textContent()));
      var riga = (await s.leggi('Scadenze ricorrenti')).slice(1).filter(function (r) { return r[7] === 'RM-tari'; })[0];
      assert.strictEqual(riga[5], 'SI');
      assert.strictEqual(riga[2], 'quadrimestrale');
      assert.strictEqual(riga[1], 320.5);
      await p.click('#sf-torna');
      await s.attendi();
      assert.ok(/TARI/.test(await p.textContent('#scadenze-elenco')), 'compare tra le scadenze dei prossimi 30 giorni');
    });
  }
};
