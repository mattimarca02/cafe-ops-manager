/*
 * Prova nel browser della quadratura nella Chiusura cassa: esito subito visibile,
 * nota obbligatoria oltre la tolleranza, differenza salvata.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

module.exports = {
  'chiusura cassa: esito della quadratura e nota obbligatoria': async function () {
    await conBrowser(8771, { giorni: 5 }, async function (p, s) {
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-data', '2025-12-20');
      await p.fill('#chiusura-contanti', '350,00');
      await p.fill('#chiusura-pos', '120,50');
      assert.ok(!(await p.isVisible('#chiusura-quadratura')), 'senza registratore niente esito');
      await p.fill('#chiusura-registratore', '468');
      assert.strictEqual(await p.getAttribute('#chiusura-quadratura', 'class'), 'quadratura quadratura-ok');
      assert.ok(/in quadratura/.test(await p.textContent('#chiusura-quadratura')));
      assert.ok(/\+2,50/.test(await p.textContent('#chiusura-quadratura')));

      await p.fill('#chiusura-registratore', '490');
      assert.strictEqual(await p.getAttribute('#chiusura-quadratura', 'class'), 'quadratura quadratura-ammanco');
      assert.ok(/obbligatoria/.test(await p.textContent('#chiusura-note-etichetta')));
      await p.click('#chiusura-salva');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      assert.ok(/Scrivi una nota/.test(await p.textContent('#errore-testo')));
      await p.click('#errore-chiudi');

      await p.fill('#chiusura-registratore', '460');
      assert.strictEqual(await p.getAttribute('#chiusura-quadratura', 'class'), 'quadratura quadratura-eccedenza');
      await p.fill('#chiusura-note', 'Mancia lasciata in cassa');
      await p.click('#chiusura-salva');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      var righe = (await s.leggi('Chiusure')).slice(1).filter(function (r) { return r[5] === 'Mancia lasciata in cassa'; });
      assert.strictEqual(righe.length, 1);
      assert.strictEqual(righe[0][10], 460);
      assert.strictEqual(righe[0][11], 10.5);

      // Nell'elenco la chiusura mostra registratore e differenza
      await p.waitForSelector('#schermo-home', { state: 'visible' });
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await s.attendi();
      await p.click('#elenco-tipo button[data-tipo="chiusure"]');
      await s.attendi();
      assert.ok(/Registratore 460,00 € · differenza \+10,50 €/.test(await p.textContent('#elenco-voci')));
    });
  }
};
