/*
 * Esegue tutte le prove sul computer:
 *   1. controllo ES5/CSS della pagina (prove/controllo-client.js)
 *   2. le funzioni test...() dei file Test*.gs (le stesse si possono
 *      eseguire anche dall'editor di Apps Script), es. testImportaFatture
 *   3. le prove delle funzioni del server (prove/test-*.js) con l'Apps Script finto
 *
 *   npm test
 */
'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var carica = require('./carica');

var falliti = 0;

function titolo(t) { console.log('\n=== ' + t + ' ==='); }

titolo('Controllo della pagina (ES5 e CSS)');
try {
  childProcess.execFileSync(process.execPath, [path.join(__dirname, 'controllo-client.js')], { stdio: 'inherit' });
} catch (e) {
  falliti++;
}

titolo('Funzioni di prova nei file Test*.gs');
carica.carica();
carica.fileGs().filter(function (n) { return /^Test/.test(n); }).forEach(function (nome) {
  var codice = fs.readFileSync(path.join(carica.RADICE, nome), 'utf8');
  var re = /^function (test[A-Za-z0-9]*)\s*\(/gm;
  var m;
  while ((m = re.exec(codice))) {
    carica.nuovoFoglio();
    try {
      var esito = globalThis[m[1]]();
      console.log('✓ ' + m[1] + ': ' + String(esito).split('\n')[0]);
    } catch (e) {
      falliti++;
      console.error('✗ ' + m[1] + ': ' + (e && e.message ? e.message : e));
    }
  }
});

titolo('Prove delle funzioni del server (prove/test-*.js)');
var fileProve = fs.readdirSync(__dirname).filter(function (n) { return /^test-.*\.js$/.test(n); }).sort();

// I messaggi di errore/avviso scritti dal codice .gs durante le prove (attesi)
// non vengono mostrati: si vedono solo i risultati.
var consoleError = console.error.bind(console);
var consoleWarn = console.warn.bind(console);
function silenzia(attivo) {
  console.error = attivo ? function () {} : consoleError;
  console.warn = attivo ? function () {} : consoleWarn;
}

(async function () {
  for (var nome of fileProve) {
    var prove = require(path.join(__dirname, nome));
    for (var k of Object.keys(prove)) {
      carica.nuovoFoglio();
      try {
        silenzia(true);
        await prove[k]();
        silenzia(false);
        console.log('✓ ' + nome + ' › ' + k);
      } catch (e) {
        silenzia(false);
        falliti++;
        console.error('✗ ' + nome + ' › ' + k + ': ' + (e && e.stack ? e.stack : e));
      }
    }
  }
  console.log('\n' + (falliti ? '✗ ' + falliti + ' prove fallite.' : '✓ Tutte le prove sono andate a buon fine.'));
  process.exitCode = falliti ? 1 : 0;
})();
