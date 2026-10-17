/*
 * Prova nel browser di «Cerca e modifica»: ricerca, modifica di una spesa
 * e di una chiusura (con conflitto di data), eliminazione.
 */
'use strict';

var assert = require('assert');
var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8767;
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
  'cerca e modifica dal telefono': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 60 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var p = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
      var errori = [];
      p.on('pageerror', function (e) { errori.push(e.message); });
      await p.goto(BASE + '/');
      await aiuto.scriviPin(p);

      // Ricerca
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendiFine(p);
      await p.fill('#elenco-testo', 'panificio');
      await p.press('#elenco-testo', 'Enter');
      await aiuto.attendiFine(p);
      var testoElenco = await p.textContent('#elenco-voci');
      assert.ok(/Panificio Verdi/.test(testoElenco));
      assert.ok(!/Torrefazione/.test(testoElenco));

      // Modifica della prima spesa trovata
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-spesa', { state: 'visible' });
      assert.strictEqual(await p.textContent('#spesa-titolo'), 'Modifica spesa');
      assert.strictEqual(await p.inputValue('#spesa-fornitore'), 'Panificio Verdi');
      await p.fill('#spesa-importo', '99,99');
      await p.fill('#spesa-nota', 'corretta dal telefono');
      await p.click('#spesa-salva');
      await p.waitForSelector('#schermo-elenco', { state: 'visible', timeout: 10000 });
      await aiuto.attendiFine(p);
      var spese = (await leggi('/dati?scheda=Spese')).slice(1);
      var corrette = spese.filter(function (r) { return r[2] === 99.99; });
      assert.strictEqual(corrette.length, 1);
      assert.strictEqual(corrette[0][6], 'corretta dal telefono');
      assert.ok(corrette[0][9], 'colonna Modificato il compilata');

      // «Nuova spesa» dopo una modifica riparte vuota
      await p.click('#nav-home');
      await p.click('#vai-spesa');
      assert.strictEqual(await p.textContent('#spesa-titolo'), 'Nuova spesa');
      assert.strictEqual(await p.inputValue('#spesa-importo'), '');
      await p.click('#spesa-annulla');

      // Modifica di una chiusura spostandola su un giorno che ne ha già una
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendiFine(p);
      await p.click('#elenco-tipo button[data-tipo="chiusure"]');
      await aiuto.attendiFine(p);
      var prima = (await leggi('/dati?scheda=Chiusure')).slice(1).filter(function (r) { return r[0]; }).length;
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-chiusura', { state: 'visible' });
      var seconda = (await p.$$eval('#elenco-voci .voce b', function (b) { return b.map(function (x) { return x.textContent; }); }))[1];
      var data = /(\d{2})\/(\d{2})\/(\d{4})/.exec(seconda);
      await p.fill('#chiusura-data', data[3] + '-' + data[2] + '-' + data[1]);
      await p.fill('#chiusura-contanti', '777');
      // Con il registratore scritto la differenza supera la tolleranza: serve la nota
      await p.fill('#chiusura-note', 'Corretta dal telefono');
      await p.click('#chiusura-salva');
      await p.waitForSelector('#pannello-conferma', { state: 'visible' });
      assert.ok(/già un'altra chiusura/.test(await p.textContent('#conferma-testo')));
      await p.click('#conferma-si');
      await p.waitForSelector('#schermo-elenco', { state: 'visible', timeout: 10000 });
      await aiuto.attendiFine(p);
      var chiusure = (await leggi('/dati?scheda=Chiusure')).slice(1).filter(function (r) { return r[0]; });
      assert.strictEqual(chiusure.length, prima - 1, 'la chiusura sostituita viene tolta');
      assert.strictEqual(chiusure.filter(function (r) { return r[1] === 777; }).length, 1);

      // Eliminazione
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Elimina")');
      await p.click('#conferma-si');
      await p.waitForSelector('#schermo-elenco', { state: 'visible', timeout: 10000 });
      assert.strictEqual((await leggi('/dati?scheda=Chiusure')).slice(1).filter(function (r) { return r[0]; }).length, prima - 2);

      assert.deepStrictEqual(errori, []);
    } finally {
      await browser.close();
      server.close();
    }
  }
};
