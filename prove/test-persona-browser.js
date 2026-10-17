/*
 * Prova nel browser della scelta di chi sta usando l'app.
 */
'use strict';

var assert = require('assert');
var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8768;
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

module.exports = {
  'scelta del nome ricordata e scritta nelle spese': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 10 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var p = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
      await p.goto(BASE + '/');
      await p.waitForSelector('#schermo-pin', { state: 'visible' });
      for (var c of '1234') await p.click('#schermo-pin button[data-cifra="' + c + '"]');
      await p.waitForSelector('#schermo-persona', { state: 'visible' });
      await p.click('#persona-scelte button:has-text("Luca")');
      await p.waitForSelector('#schermo-home', { state: 'visible' });
      assert.ok(/Luca/.test(await p.textContent('#home-persona-testo')));

      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '8,80');
      await p.fill('#spesa-fornitore', 'Supermercato');
      await p.click('#spesa-categorie button >> nth=0');
      await p.click('#spesa-pagamenti button >> nth=0');
      await p.click('#spesa-salva');
      await p.waitForSelector('#schermo-home', { state: 'visible', timeout: 10000 });
      var riga = (await leggi('/dati?scheda=Spese')).filter(function (r) { return r[2] === 8.8; })[0];
      assert.strictEqual(riga[10], 'Luca');

      // Ricaricando, il nome è ricordato: niente domanda.
      await p.reload();
      await p.waitForSelector('#schermo-home', { state: 'visible' });
      assert.ok(/Luca/.test(await p.textContent('#home-persona-testo')));

      // Cambia
      await p.click('#home-persona-cambia');
      await p.click('#persona-scelte button:has-text("Giulia")');
      assert.ok(/Giulia/.test(await p.textContent('#home-persona-testo')));
    } finally {
      await browser.close();
      server.close();
    }
  }
};
