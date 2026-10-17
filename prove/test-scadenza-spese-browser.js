/*
 * Prova nel browser di «Da pagare entro» sulle spese: scorciatoie a pillola, nota per chi ha già
 * pagato, creazione nello scadenzario, modifica, coda offline senza doppioni.
 */
'use strict';

var assert = require('assert');
var aiuto = require('./aiuto-browser');

async function compila(p, importo, fornitore) {
  await p.click('#vai-spesa');
  await p.fill('#spesa-importo', importo);
  await p.fill('#spesa-fornitore', fornitore);
  await p.click('#spesa-categorie button >> nth=0');
}

function viste(righe) {
  return righe.slice(1).filter(function (r) { return r[5] && String(r[5]).indexOf('S|') === 0; });
}

module.exports = {
  'spesa con «Da pagare entro»: pillole, scadenzario, modifica, coda offline': async function () {
    await aiuto.conBrowser(8791, { giorni: 40 }, async function (p, s) {
      var iniziali = viste(await s.leggi('Scadenze')).length;

      // Nuova spesa: le pillole compilano la data, la nota compare solo per Contanti e Carta/Bancomat
      await compila(p, '45,00', 'Panificio Verdi');
      assert.strictEqual(await p.isVisible('#spesa-scadenza-nota'), false);
      await p.click('#spesa-pagamenti button >> nth=0');
      assert.ok(await p.isVisible('#spesa-scadenza-nota'), 'nota per chi ha già pagato');
      assert.ok(/serve per spese ancora da saldare/.test(await p.textContent('#spesa-scadenza-nota')));
      await p.click('#spesa-pagamenti button >> nth=2');
      assert.strictEqual(await p.isVisible('#spesa-scadenza-nota'), false);
      await p.click('#spesa-scadenza-7');
      var tra7 = await p.inputValue('#spesa-scadenza');
      await p.click('#spesa-scadenza-30');
      var tra30 = await p.inputValue('#spesa-scadenza');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(tra7) && tra30 > tra7, tra7 + ' → ' + tra30);
      assert.ok(await p.isVisible('#spesa-scadenza-togli'));
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-salvato', { state: 'visible', timeout: 10000 }).catch(function () {});
      await s.attendi();
      var sc = viste(await s.leggi('Scadenze'));
      assert.strictEqual(sc.length, iniziali + 1);
      var riga = sc[sc.length - 1];
      assert.ok(/^Spesa Panificio Verdi/.test(riga[2]));
      assert.strictEqual(riga[3], 45);
      assert.strictEqual(riga[4], 'Spesa');

      // Senza data: nessuna scadenza in più
      await compila(p, '5,00', 'Panificio Verdi');
      await p.click('#spesa-pagamenti button >> nth=0');
      await p.click('#spesa-salva');
      await s.attendi();
      assert.strictEqual(viste(await s.leggi('Scadenze')).length, iniziali + 1);

      // Coda offline: la spesa con data passa dalla coda e arriva una volta sola
      await p.context().setOffline(true);
      await compila(p, '77,00', 'Panificio Verdi');
      await p.click('#spesa-pagamenti button >> nth=2');
      await p.click('#spesa-scadenza-7');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      await p.context().setOffline(false);
      await p.waitForFunction(function () {
        return document.getElementById('barra-coda').style.display === 'none';
      }, null, { timeout: 25000 });
      await s.attendi();
      var dopoCoda = viste(await s.leggi('Scadenze'));
      assert.strictEqual(dopoCoda.length, iniziali + 2, 'una sola scadenza in più, nessun doppione');
      assert.strictEqual(dopoCoda.filter(function (r) { return r[3] === 77; }).length, 1);

      // Modifica: la data compare già scritta; svuotandola la voce sparisce
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await s.attendi();
      await p.fill('#elenco-testo', 'panificio');
      await p.press('#elenco-testo', 'Enter');
      await s.attendi();
      await p.click('#elenco-voci .voce:has-text("77,00") >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-spesa', { state: 'visible' });
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(await p.inputValue('#spesa-scadenza')), 'data già scritta');
      await p.click('#spesa-scadenza-togli');
      assert.strictEqual(await p.inputValue('#spesa-scadenza'), '');
      await p.click('#spesa-salva');
      await p.waitForSelector('#schermo-elenco', { state: 'visible', timeout: 10000 });
      await s.attendi();
      var dopoModifica = viste(await s.leggi('Scadenze'));
      assert.strictEqual(dopoModifica.length, iniziali + 1);
      assert.strictEqual(dopoModifica.filter(function (r) { return r[3] === 77; }).length, 0);
    }, 412);
  }
};
