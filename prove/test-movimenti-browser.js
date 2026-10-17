/*
 * Prova nel browser di Versamenti e prelievi: nuovo movimento, contante teorico aggiornato, eliminazione.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

function cifra(testo) { return Number(/(-?\s?[\d.]+,\d\d) €/.exec(testo)[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); }

module.exports = {
  'versamenti e prelievi: salva, contante aggiornato, elimina': async function () {
    await conBrowser(8775, { giorni: 30 }, async function (p, s) {
      await p.click('#nav-cassa');
      await p.click('#vai-movimenti');
      await s.attendi();
      var prima = cifra(await p.textContent('#movimenti-contante .contante-cifra'));
      await p.click('#movimento-salva');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      await p.click('#errore-chiudi');
      await p.click('#movimento-tipi button:has-text("Versamento in banca")');
      await p.fill('#movimento-importo', '250,00');
      await p.fill('#movimento-nota', 'Prova dal telefono');
      await p.click('#movimento-salva');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-movimenti', { state: 'visible', timeout: 10000 });
      await s.attendi();
      var dopo = cifra(await p.textContent('#movimenti-contante .contante-cifra'));
      assert.strictEqual(Math.round((prima - dopo) * 100), 25000, 'il contante scende di 250 €');
      assert.ok(/Prova dal telefono/.test(await p.textContent('#movimenti-elenco')));
      var righe = (await s.leggi('Movimenti cassa')).slice(1).filter(function (r) { return r[4] === 'Prova dal telefono'; });
      assert.strictEqual(righe.length, 1);
      assert.strictEqual(righe[0][3], 250);
      assert.ok(righe[0][5], 'persona');
      await p.click('#movimenti-elenco .voce:has-text("Prova dal telefono") button:has-text("Elimina")');
      await p.click('#conferma-si');
      await p.waitForSelector('#schermo-movimenti', { state: 'visible', timeout: 10000 });
      await s.attendi();
      assert.ok(!/Prova dal telefono/.test(await p.textContent('#movimenti-elenco')));

      // Il Riepilogo mostra lo stesso contante teorico
      await p.click('#nav-home');
      await p.click('#vai-riepilogo');
      await s.attendi();
      // Il contante sta nella sezione «Cassa», chiusa finché non la si apre
      await p.click('#testa-cassa');
      assert.strictEqual(cifra(await p.textContent('#riepilogo-contante .contante-cifra')), prima);
    });
  }
};
