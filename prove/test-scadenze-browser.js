/*
 * Prova nel browser della schermata Scadenze: segna pagata e nuova scadenza.
 */
'use strict';

var assert = require('assert');
var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8769;
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
  'scadenze: segna pagata e nuova scadenza': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 40 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var p = await (await browser.newContext({ viewport: { width: 412, height: 800 } })).newPage();
      var errori = [];
      p.on('pageerror', function (e) { errori.push(e.message); });
      await p.goto(BASE + '/');
      await aiuto.scriviPin(p);
      assert.ok(await p.isVisible('#home-scadenze-numero'), 'numerino delle scadenze vicine nella home');
      await p.click('#vai-scadenze');
      await aiuto.attendiFine(p);
      var prima = await p.$$eval('#scadenze-elenco .voce', function (v) { return v.length; });
      await p.click('#scadenze-elenco button:has-text("Segna pagata") >> nth=0');
      await p.click('#conferma-si');
      await p.waitForSelector('#schermo-scadenze', { state: 'visible', timeout: 10000 });
      await aiuto.attendiFine(p);
      assert.strictEqual(await p.$$eval('#scadenze-elenco .voce', function (v) { return v.length; }), prima - 1);
      assert.ok(/Pagata il/.test(await p.textContent('#scadenze-pagate')));
      // Pagata dall'app: ha data e nome (quelle segnate in automatico all'attivazione no)
      var pagate = (await leggi('/dati?scheda=Scadenze')).slice(1).filter(function (r) { return r[6] === 'SI' && r[7]; });
      assert.strictEqual(pagate.length, 1);
      assert.ok(pagate[0][8], 'pagata da (nome)');

      await p.click('#scadenze-nuova');
      await p.fill('#ns-descrizione', 'Tassa rifiuti');
      await p.fill('#ns-importo', '320');
      await p.click('#ns-frequenze button:has-text("Ogni 3 mesi")');
      await p.click('#ns-salva');
      await p.waitForSelector('#schermo-scadenze', { state: 'visible', timeout: 10000 });
      await aiuto.attendiFine(p);
      assert.ok(/Tassa rifiuti/.test(await p.textContent('#scadenze-elenco')));
      var ric = (await leggi('/dati?scheda=' + encodeURIComponent('Scadenze ricorrenti'))).slice(1)
        .filter(function (r) { return r[0] === 'Tassa rifiuti'; });
      assert.strictEqual(ric.length, 1);
      assert.strictEqual(ric[0][2], 'trimestrale');
      assert.deepStrictEqual(errori, []);
    } finally {
      await browser.close();
      server.close();
    }
  }
};
