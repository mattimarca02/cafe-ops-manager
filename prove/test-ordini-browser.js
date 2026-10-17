/*
 * Prova nel browser della lista "Da ordinare": aggiungi, quantità, link WhatsApp, svuota.
 */
'use strict';

var assert = require('assert');
var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8780;  // la 8770 può essere occupata da macOS (sharingd)
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

async function prodotto(nome) {
  return (await leggi('/dati?scheda=Prodotti')).filter(function (r) { return r[0] === nome; })[0];
}

module.exports = {
  'da ordinare: lista condivisa e messaggio WhatsApp': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 5 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var p = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
      var errori = [];
      p.on('pageerror', function (e) { errori.push(e.message); });
      await p.goto(BASE + '/');
      await aiuto.scriviPin(p);
      assert.strictEqual((await p.textContent('#home-ordini-numero')).trim(), '5');
      await p.click('#vai-ordini');
      await aiuto.attendiFine(p);

      // Aggiungo la Gazzosa e porto la quantità a 3 (tre tocchi veloci su +)
      await p.click('#ordini-prodotti button:has-text("Gazzosa")');
      var riga = p.locator('.riga-prodotto', { hasText: 'Gazzosa' });
      await riga.locator('button:has-text("+")').click();
      await riga.locator('button:has-text("+")').click();
      assert.ok(/3 casse/.test(await riga.textContent()));
      // Singolare con 1, plurale con le altre quantità
      await riga.locator('button[aria-label="Uno in meno"]').click();
      await riga.locator('button[aria-label="Uno in meno"]').click();
      assert.ok(/1 cassa(?!e)/.test(await riga.textContent()), await riga.textContent());
      await riga.locator('button:has-text("+")').click();
      await riga.locator('button:has-text("+")').click();
      assert.ok(/3 casse/.test(await riga.textContent()));
      await p.waitForTimeout(2000);
      var coca = await prodotto('Gazzosa in vetro');
      assert.strictEqual(coca[3], 'SI');
      assert.strictEqual(coca[4], 3);

      // Link WhatsApp con numero e testo del messaggio
      var bianchi = p.locator('.ordine-fornitore', { hasText: 'Bevande Bianchi' });
      var href = await bianchi.locator('a.bottone').getAttribute('href');
      assert.ok(href.indexOf('https://wa.me/393457654321?text=') === 0, href);
      var testo = decodeURIComponent(href.split('?text=')[1]);
      assert.ok(/- Gazzosa in vetro: 3 casse/.test(testo), testo);
      assert.ok(/- Acqua naturale 0,5 l: 3 casse/.test(testo), testo);
      var senza = p.locator('.ordine-fornitore', { hasText: 'Senza fornitore' });
      assert.ok((await senza.locator('a.bottone').getAttribute('href')).indexOf('https://wa.me/?text=') === 0);

      // Ordine inviato: svuoto la lista di Bevande Bianchi
      await bianchi.locator('button:has-text("svuota")').click();
      await p.click('#conferma-si');
      await p.waitForSelector('#schermo-ordini', { state: 'visible' });
      await aiuto.attendiFine(p);
      assert.strictEqual(await p.locator('.ordine-fornitore', { hasText: 'Bevande Bianchi' }).count(), 0);
      assert.strictEqual((await prodotto('Gazzosa in vetro'))[3], '');

      // Nuovo prodotto subito in lista
      await p.click('#ordini-nuovo');
      await p.fill('#np-nome', 'Latte intero');
      await p.selectOption('#np-fornitore', 'Supermercato');
      await p.fill('#np-unita', 'litri');
      await p.click('#np-salva');
      await p.waitForSelector('#schermo-ordini', { state: 'visible', timeout: 10000 });
      assert.ok(/Latte intero/.test(await p.textContent('#ordini-fornitori')));
      assert.strictEqual((await prodotto('Latte intero'))[3], 'SI');
      assert.deepStrictEqual(errori, []);
    } finally {
      await browser.close();
      server.close();
    }
  }
};
