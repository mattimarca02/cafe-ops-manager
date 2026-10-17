/*
 * Prova nel browser della ricerca del fornitore: suggerimenti, righe tappabili, fornitore nuovo,
 * nessun doppione, scorciatoie a campo vuoto, modifica e coda offline.
 */
'use strict';

var assert = require('assert');
var aiuto = require('./aiuto-browser');

async function rigaSpesa(p, importo) {
  await p.click('#vai-spesa');
  await p.fill('#spesa-importo', importo);
  await p.click('#spesa-categorie button >> nth=0');
  await p.click('#spesa-pagamenti button >> nth=0');
}

async function suggerimenti(p) {
  return p.$$eval('#fornitore-suggerimenti button', function (b) { return b.map(function (x) { return x.textContent; }); });
}

module.exports = {
  'ricerca del fornitore nel modulo spesa': async function () {
    await aiuto.conBrowser(8792, { giorni: 40 }, async function (p, s) {
      var fornitoriIniziali = (await s.leggi('Fornitori')).length;
      await rigaSpesa(p, '12,50');

      // A campo vuoto con il focus: al massimo 5 scorciatoie recenti
      await p.click('#spesa-fornitore');
      assert.ok(await p.isVisible('#fornitore-recenti'));
      var recenti = await p.$$eval('#fornitore-recenti button', function (b) { return b.length; });
      assert.ok(recenti >= 1 && recenti <= 5, 'recenti: ' + recenti);

      // «esse»: trova il testo ovunque, prima chi inizia così; righe alte e leggibili
      await p.fill('#spesa-fornitore', 'ESSE');
      var trovati = await suggerimenti(p);
      assert.strictEqual(trovati[0], 'Essemarket');
      assert.ok(trovati.indexOf('Bar Esse Pi') > 0 && trovati.indexOf('Ortofrutta Esse') > 0, trovati.join(' | '));
      assert.ok(/^Aggiungi "ESSE" come nuovo fornitore$/.test(trovati[trovati.length - 1]), 'ultima riga: aggiungi');
      assert.ok(trovati.length <= 9, 'massimo 8 suggerimenti più la riga «Aggiungi»');
      var misure = await p.$$eval('#fornitore-suggerimenti button', function (b) {
        return b.map(function (x) { return { h: x.getBoundingClientRect().height, f: parseFloat(window.getComputedStyle(x).fontSize) }; });
      });
      misure.forEach(function (m) { assert.ok(m.h >= 52 && m.f >= 17, JSON.stringify(m)); });

      // Senza accenti e maiuscole
      await p.fill('#spesa-fornitore', 'caffe borgo');
      assert.strictEqual((await suggerimenti(p))[0], 'Caffè Borgo Antico');

      // Tocco su un suggerimento = scelto e elenco chiuso
      await p.click('#fornitore-suggerimenti button >> nth=0');
      assert.strictEqual(await p.inputValue('#spesa-fornitore'), 'Caffè Borgo Antico');
      assert.strictEqual(await p.isVisible('#fornitore-suggerimenti'), false);

      // Nome scritto uguale a uno esistente (maiuscole, accenti, spazi): usa quello, nessun doppione
      await p.fill('#spesa-fornitore', '  CAFFE   borgo  antico ');
      assert.ok(!/Aggiungi/.test((await suggerimenti(p)).join('|')), 'nessuna riga «Aggiungi» per un nome esistente');
      await p.click('#spesa-salva');
      await s.attendi();
      var f1 = await s.leggi('Fornitori');
      assert.strictEqual(f1.length, fornitoriIniziali, 'nessun fornitore aggiunto');
      var spese = (await s.leggi('Spese')).slice(1);
      assert.strictEqual(spese[spese.length - 1][3], 'Caffè Borgo Antico', 'salvato con il nome esistente');

      // Fornitore nuovo: riga «Aggiungi», nota, aggiunto alla scheda al salvataggio
      await rigaSpesa(p, '7,00');
      await p.fill('#spesa-fornitore', 'Cartoleria Nuova Stella');
      var ultima = await p.textContent('#fornitore-suggerimenti button >> nth=-1');
      assert.strictEqual(ultima, 'Aggiungi "Cartoleria Nuova Stella" come nuovo fornitore');
      await p.click('#fornitore-suggerimenti button.nuovo');
      assert.strictEqual(await p.inputValue('#spesa-fornitore'), 'Cartoleria Nuova Stella');
      assert.ok(await p.isVisible('#fornitore-nuovo-nota'));
      await p.click('#spesa-salva');
      await s.attendi();
      var f2 = await s.leggi('Fornitori');
      assert.strictEqual(f2.length, fornitoriIniziali + 1);
      assert.strictEqual(f2[f2.length - 1][0], 'Cartoleria Nuova Stella');

      // Il fornitore appena usato è il primo tra i recenti
      await p.click('#vai-spesa');
      await p.click('#spesa-fornitore');
      assert.strictEqual(await p.textContent('#fornitore-recenti button >> nth=0'), 'Cartoleria Nuova Stella');
      await p.click('#spesa-annulla');

      // Campo vuoto: stesso errore di prima
      await rigaSpesa(p, '3,00');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      assert.ok(/fornitore/.test(await p.textContent('#errore-testo')));
      await p.click('#errore-chiudi');

      // Coda offline: la spesa con fornitore nuovo arriva una volta sola
      await p.context().setOffline(true);
      await p.fill('#spesa-fornitore', 'Fornitore Offline');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      await p.context().setOffline(false);
      await p.waitForFunction(function () {
        return document.getElementById('barra-coda').style.display === 'none';
      }, null, { timeout: 25000 });
      await s.attendi();
      var f3 = (await s.leggi('Fornitori')).filter(function (r) { return r[0] === 'Fornitore Offline'; });
      assert.strictEqual(f3.length, 1);

      // Modifica: il fornitore esistente compare già scritto
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await s.attendi();
      await p.fill('#elenco-testo', 'Fornitore Offline');
      await p.press('#elenco-testo', 'Enter');
      await s.attendi();
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-spesa', { state: 'visible' });
      assert.strictEqual(await p.inputValue('#spesa-fornitore'), 'Fornitore Offline');
      assert.strictEqual(await p.isVisible('#fornitore-suggerimenti'), false);
    }, 412);
  }
};
