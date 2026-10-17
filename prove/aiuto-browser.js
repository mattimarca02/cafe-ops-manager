/*
 * Aiuto per le prove nel browser delle funzioni nuove: avvia il server finto e
 * Chromium, entra con il PIN e chiude tutto alla fine (anche se la prova fallisce).
 */
'use strict';

var http = require('http');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

/**
 * conBrowser(porta, opzioniServer, async function (p, strumenti) { ... }, larghezza)
 * strumenti: { leggi(scheda) → righe della scheda (JSON), attendi() → aspetta la fine di "Attendere…", errori }
 */
async function conBrowser(porta, opzioni, prova, larghezza) {
  var server = serverFinto.avvia(porta, opzioni);
  var browser = null;
  try {
    browser = await aiuto.playwright().chromium.launch();
    var contesto = await browser.newContext({ viewport: { width: larghezza || 412, height: 800 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    var p = await contesto.newPage();
    var errori = [];
    p.on('pageerror', function (e) { errori.push(e.message); });
    await p.goto('http://localhost:' + porta + '/');
    await aiuto.scriviPin(p);
    await prova(p, {
      errori: errori,
      attendi: function () { return aiuto.attendiFine(p); },
      leggi: function (scheda) { return leggiScheda(porta, scheda); }
    });
    if (errori.length) throw new Error('Errori JavaScript nella pagina: ' + errori.join(' | '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

function leggiScheda(porta, scheda) {
  return new Promise(function (ok, ko) {
    http.get('http://localhost:' + porta + '/dati?scheda=' + encodeURIComponent(scheda), function (res) {
      var t = '';
      res.on('data', function (c) { t += c; });
      res.on('end', function () { ok(JSON.parse(t)); });
    }).on('error', ko);
  });
}

module.exports = { conBrowser: conBrowser };
