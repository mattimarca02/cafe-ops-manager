/*
 * Prova nel browser dei Controlli di oggi (HACCP): spunta, temperatura fuori range
 * con azione correttiva obbligatoria, PDF del mese.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;

module.exports = {
  'controlli di oggi: spunta, temperatura fuori range e PDF': async function () {
    await conBrowser(8772, { giorni: 5, senzaHaccp: true }, async function (p, s) {
      assert.strictEqual(await p.textContent('#home-haccp-numero'), '6');
      await p.click('#vai-haccp');
      await s.attendi();
      assert.ok(/6 controlli da fare oggi|5 controlli da fare oggi/.test(await p.textContent('#haccp-riassunto')));
      assert.ok(/Controlli fatti da/.test(await p.textContent('#haccp-persona')));

      // Spunta: Pulizia bagni
      await p.click('#haccp-elenco .voce:has-text("Pulizia bagni") button:has-text("Fatto")');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-haccp', { state: 'visible', timeout: 10000 });
      await s.attendi();
      assert.ok(/Già fatti/.test(await p.textContent('#haccp-elenco')));

      // Congelatore a −12: fuori dai limiti, serve l'azione correttiva
      var voce = p.locator('#haccp-elenco .voce:has-text("Temperatura congelatore")');
      await voce.locator('.campo-temperatura').fill('12');
      await voce.locator('.tasto-segno').click();
      assert.strictEqual(await voce.locator('.campo-temperatura').inputValue(), '-12');
      assert.ok(/fuori dai limiti/.test(await voce.locator('.avviso-fuori').textContent()));
      await voce.locator('button:has-text("Registra temperatura")').click();
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      assert.ok(/azione correttiva/.test(await p.textContent('#errore-testo')));
      await p.click('#errore-chiudi');
      await voce.locator('input[id^="haccp-n-"]').fill('Sbrinato il congelatore, ricontrollo tra un\'ora');
      await voce.locator('button:has-text("Registra temperatura")').click();
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-haccp', { state: 'visible', timeout: 10000 });
      await s.attendi();
      var righe = (await s.leggi('HACCP')).slice(1);
      var congelatore = righe.filter(function (r) { return r[2] === 'Temperatura congelatore'; })[0];
      assert.strictEqual(congelatore[4], -12);
      assert.strictEqual(congelatore[5], 'FUORI RANGE');
      assert.ok(/Sbrinato/.test(congelatore[6]));
      assert.ok(congelatore[7], 'nome di chi ha fatto il controllo');
      assert.ok(/Fuori dai limiti/.test(await p.textContent('#haccp-elenco')));

      // PDF del mese
      await p.click('#haccp-pdf');
      await s.attendi();
      assert.ok(/PDF pronto/.test(await p.textContent('#haccp-pdf-esito')));
      assert.ok(/Registro HACCP/.test(await p.textContent('#haccp-pdf-esito')));
    });
  }
};
