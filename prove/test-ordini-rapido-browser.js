/*
 * Prova nel browser dell'aggiunta rapida di prodotti dalla scheda di un fornitore.
 */
'use strict';

var assert = require('assert');
var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8781;
var BASE = 'http://localhost:' + PORTA;

function leggi(percorso) {
  return new Promise(function (ok, ko) {
    http.get(BASE + percorso, function (res) {
      var t = '';
      res.on('data', function (c) { t += c; });
      res.on('end', function () { ok(JSON.parse(t)); });
    }).on('error', ko);
  });
}

async function prodotti(nome) {
  return (await leggi('/dati?scheda=Prodotti')).filter(function (r) { return r[0] === nome; });
}

module.exports = {
  'aggiunta rapida: cerca, aggiungi in sequenza, doppione, nuovo prodotto': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 5 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var p = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
      var errori = [];
      p.on('pageerror', function (e) { errori.push(e.message); });
      await p.goto(BASE + '/');
      await aiuto.scriviPin(p);
      await p.click('#vai-ordini');
      await aiuto.attendiFine(p);

      var scheda = p.locator('.ordine-fornitore', { hasText: 'Bevande Bianchi' });
      var bottone = scheda.locator('button.aggiungi-rapido');
      assert.ok((await bottone.boundingBox()).height >= 44, 'area tappabile di almeno 44px');
      assert.strictEqual(await p.locator('.ordine-fornitore', { hasText: 'Senza fornitore' }).locator('button.aggiungi-rapido').count(), 0);
      await bottone.click();
      assert.strictEqual(await p.evaluate(function () { return document.activeElement.id; }), 'rapido-campo');

      // Campo vuoto: pillole dei prodotti non ancora in lista
      var pillole = await p.locator('#rapido-pillole button').allTextContents();
      assert.deepStrictEqual(pillole.sort(), ['Gazzosa in vetro', 'Succhi di frutta assortiti']);

      // Ricerca senza accenti/maiuscole, ovunque nel nome
      await p.fill('#rapido-campo', 'FRUTTA');
      var sugg = await p.locator('#rapido-suggerimenti button').allTextContents();
      assert.ok(/Succhi di frutta assortiti/.test(sugg[0]), sugg.join('|'));
      assert.ok(/Aggiungi "FRUTTA" come nuovo prodotto/.test(sugg[sugg.length - 1]));
      await p.locator('#rapido-suggerimenti button', { hasText: 'Succhi' }).click();
      assert.strictEqual(await p.inputValue('#rapido-campo'), '', 'il campo si svuota');
      assert.strictEqual(await p.evaluate(function () { return document.activeElement.id; }), 'rapido-campo', 'resta il focus');
      assert.ok(/1 cartone(?!i)/.test(await scheda.locator('.riga-prodotto', { hasText: 'Succhi' }).textContent()));

      // Doppione: lo stesso prodotto aumenta di 1 e viene evidenziato
      await p.fill('#rapido-campo', 'succhi');
      await p.locator('#rapido-suggerimenti button.in-lista', { hasText: 'Succhi' }).click();
      var riga = scheda.locator('.riga-prodotto', { hasText: 'Succhi' });
      assert.ok(/2 cartoni/.test(await riga.textContent()));
      assert.ok(/evidenziata/.test(await riga.getAttribute('class')));
      assert.strictEqual(await scheda.locator('.riga-prodotto', { hasText: 'Succhi' }).count(), 1);
      await p.waitForTimeout(2500);
      assert.ok(!/evidenziata/.test(await riga.getAttribute('class')));
      assert.strictEqual((await prodotti('Succhi di frutta assortiti'))[0][4], 2);

      // Nuovo prodotto: unità del fornitore, in lista con quantità 1, niente doppioni
      await p.fill('#rapido-campo', 'Birra analcolica');
      await p.locator('#rapido-suggerimenti button.nuovo').click();
      await p.waitForSelector('.riga-prodotto:has-text("Birra analcolica")');
      await aiuto.attendiFine(p);
      await p.waitForTimeout(1500);
      var nuovo = await prodotti('Birra analcolica');
      assert.strictEqual(nuovo.length, 1);
      assert.strictEqual(nuovo[0][1], 'Bevande Bianchi');
      assert.strictEqual(nuovo[0][3], 'SI');
      assert.strictEqual(nuovo[0][4], 1);
      assert.strictEqual(await p.evaluate(function () { return document.activeElement.id; }), 'rapido-campo');
      await p.fill('#rapido-campo', 'birra  ANALCOLICA');
      assert.strictEqual(await p.locator('#rapido-suggerimenti button.nuovo').count(), 0, 'nome già presente: niente «nuovo»');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(1500);
      assert.strictEqual((await prodotti('Birra analcolica')).length, 1);
      assert.strictEqual((await prodotti('Birra analcolica'))[0][4], 2);

      // Fatto: il pannello si chiude
      await p.click('#rapido-fatto');
      assert.strictEqual(await p.locator('#rapido-campo').count(), 0);
      assert.deepStrictEqual(errori, []);
    } finally {
      await browser.close();
      server.close();
    }
  }
};
