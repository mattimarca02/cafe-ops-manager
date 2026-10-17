/*
 * Server finto: mostra l'app nel browser del computer, con i dati in memoria
 * (Apps Script finto). Serve per provare l'app e fare gli screenshot.
 *
 *   node prove/server-finto.js [porta]      poi apri http://localhost:8080
 *
 * Indirizzi utili per le prove automatiche:
 *   /rete?stato=off   le chiamate al server falliscono (come senza internet)
 *   /rete?stato=on    torna la rete
 *   /rete?stato=lenta le chiamate arrivano al server ma la risposta si perde
 *   /dati?scheda=Spese  righe di una scheda (JSON)
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var carica = require('./carica');
var demo = require('./dati-demo');

var RADICE = carica.RADICE;

function pagina() {
  var include = function (nome) { return fs.readFileSync(path.join(RADICE, nome + '.html'), 'utf8'); };
  var html = include('Index');
  var funzioni = Object.keys(globalThis).filter(function (k) {
    return typeof globalThis[k] === 'function' && !/_$/.test(k) && /^[a-z]/.test(k) &&
      ['require', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'queueMicrotask',
        'structuredClone', 'atob', 'btoa', 'setImmediate', 'clearImmediate'].indexOf(k) < 0;
  });
  var finto = '<script>\n' +
    '/* google.script.run finto (solo per le prove sul computer) */\n' +
    'var google = { script: { run: null } };\n' +
    '(function () {\n' +
    '  var nomi = ' + JSON.stringify(funzioni) + ';\n' +
    '  function crea(ok, ko) {\n' +
    '    var o = {\n' +
    '      withSuccessHandler: function (f) { return crea(f, ko); },\n' +
    '      withFailureHandler: function (f) { return crea(ok, f); }\n' +
    '    };\n' +
    '    nomi.forEach(function (n) {\n' +
    '      o[n] = function () {\n' +
    '        var argomenti = Array.prototype.slice.call(arguments);\n' +
    '        var x = new XMLHttpRequest();\n' +
    '        x.open("POST", "/chiama", true);\n' +
    '        x.onload = function () {\n' +
    '          if (x.status === 200) { if (ok) ok(JSON.parse(x.responseText).risultato); }\n' +
    '          else if (ko) ko(new Error(x.responseText || "Errore di rete"));\n' +
    '        };\n' +
    '        x.onerror = function () { if (ko) ko(new Error("NetworkError")); };\n' +
    '        x.send(JSON.stringify({ funzione: n, argomenti: argomenti }));\n' +
    '      };\n' +
    '    });\n' +
    '    return o;\n' +
    '  }\n' +
    '  google.script.run = crea(null, null);\n' +
    '})();\n' +
    '</script>\n';
  html = html.replace(/<\?!= include\('([A-Za-z]+)'\); \?>/g, function (t, nome) {
    return (nome === 'Script' ? finto : '') + include(nome);
  });
  return html;
}

/** google.script.run non accetta Date (né funzioni) nelle risposte: le segnalo. */
function cercaVietati(v, percorso) {
  if (v instanceof Date) return percorso;
  if (typeof v === 'function') return percorso;
  if (v && typeof v === 'object') {
    for (var k in v) {
      var p = cercaVietati(v[k], percorso + '.' + k);
      if (p) return p;
    }
  }
  return '';
}

var stato = { rete: 'on', chiamate: [] };

function avvia(porta, opzioni) {
  opzioni = opzioni || {};
  carica.nuovoFoglio();
  if (!opzioni.vuoto) demo.riempi(opzioni);
  if (opzioni.prepara) opzioni.prepara();

  var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pagina());
      return;
    }
    if (u.pathname === '/rete') {
      stato.rete = u.query.stato || 'on';
      res.end('rete: ' + stato.rete);
      return;
    }
    if (u.pathname === '/dati') {
      var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(u.query.scheda);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(s ? s.getDataRange().getValues() : null));
      return;
    }
    if (u.pathname === '/chiamate') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(stato.chiamate));
      return;
    }
    if (u.pathname === '/chiama' && req.method === 'POST') {
      var corpo = '';
      req.on('data', function (c) { corpo += c; });
      req.on('end', function () {
        var richiesta = JSON.parse(corpo);
        stato.chiamate.push(richiesta.funzione);
        if (stato.rete === 'off') {
          res.writeHead(503);
          res.end('NetworkError: Connection failure due to HTTP 0');
          return;
        }
        var risultato;
        try {
          risultato = globalThis[richiesta.funzione].apply(null, richiesta.argomenti);
        } catch (e) {
          console.error(e);
          res.writeHead(500);
          res.end('ScriptError: ' + e.message);
          return;
        }
        var vietato = cercaVietati(risultato, 'risposta');
        if (vietato) {
          console.error('✗ ' + richiesta.funzione + ' restituisce un valore non ammesso da google.script.run: ' + vietato);
          res.writeHead(500);
          res.end('Valore non ammesso nella risposta: ' + vietato);
          return;
        }
        if (stato.rete === 'lenta') {
          // Il server ha salvato ma la risposta "si perde".
          res.writeHead(503);
          res.end('NetworkError: risposta persa');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ risultato: risultato === undefined ? null : risultato }));
      });
      return;
    }
    res.writeHead(404);
    res.end('non trovato');
  });
  server.listen(porta || 8080);
  return server;
}

module.exports = { avvia: avvia, stato: stato };

if (require.main === module) {
  var porta = Number(process.argv[2]) || 8080;
  avvia(porta);
  console.log('Server finto su http://localhost:' + porta + '  (PIN 1234)');
}
