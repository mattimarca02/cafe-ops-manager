/*
 * Aggiorna l'app con un solo comando:  npm run deploy
 *
 * 1. carica il codice su Apps Script (clasp push);
 * 2. crea una nuova versione e la mette nel deployment ESISTENTE,
 *    così il link dell'app (…/exec) resta lo stesso.
 *
 * Il deployment da aggiornare viene trovato da solo se ce n'è uno.
 * Se ce ne sono più di uno, scrivi l'ID di quello giusto nel file
 * "deployment-id.txt" (nella cartella del progetto, una riga sola).
 */
'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var RADICE = path.join(__dirname, '..');
var FILE_ID = path.join(RADICE, 'deployment-id.txt');
// clasp viene avviato con Node direttamente (funziona uguale su Windows e Mac,
// anche se il percorso contiene spazi). BAR_CLASP serve solo alle prove (un clasp finto).
var CLASP = process.env.BAR_CLASP || claspInstallato();

function claspInstallato() {
  try {
    var cartella = path.join(RADICE, 'node_modules', '@google', 'clasp');
    var bin = require(path.join(cartella, 'package.json')).bin;
    return path.join(cartella, typeof bin === 'string' ? bin : bin.clasp);
  } catch (e) {
    return '';
  }
}

function esci(messaggio) {
  console.error('\n✗ ' + messaggio + '\n');
  process.exit(1);
}

function clasp(argomenti, cattura) {
  var r = childProcess.spawnSync(process.execPath, [CLASP].concat(argomenti), {
    cwd: RADICE,
    encoding: 'utf8',
    stdio: cattura ? ['inherit', 'pipe', 'inherit'] : 'inherit'
  });
  if (r.error) esci('Non riesco ad avviare clasp: hai eseguito "npm install"? (' + r.error.message + ')');
  if (r.status !== 0) {
    esci('clasp si è fermato con un errore (vedi sopra).\n' +
      '  Se dice "No credentials found" o "invalid_grant": esegui "npm run login".\n' +
      '  Se dice "User has not enabled the Apps Script API": attivala su https://script.google.com/home/usersettings');
  }
  return r.stdout || '';
}

if (!fs.existsSync(path.join(RADICE, '.clasp.json'))) {
  esci('Manca il file .clasp.json con lo Script ID.\n' +
    '  Copia ".clasp.json.esempio" in ".clasp.json" e incolla lo Script ID (vedi README_IT.md).');
}
if (!CLASP || !fs.existsSync(CLASP)) esci('clasp non è installato: esegui prima "npm install".');

console.log('1/3 Carico il codice su Apps Script…');
clasp(['push', '--force']);

console.log('2/3 Cerco il deployment dell\'app…');
var uscita = clasp(['list-deployments', '--json'], true);
var inizio = uscita.indexOf('[');
var fine = uscita.lastIndexOf(']');
var deployments;
try {
  deployments = JSON.parse(uscita.substring(inizio, fine + 1));
} catch (e) {
  esci('Non capisco l\'elenco dei deployment restituito da clasp:\n' + uscita);
}
// Il deployment "@HEAD" è quello di prova dell'editor: non è il link dell'app.
var veri = deployments.filter(function (d) { return d.versionNumber; });

var scelto = '';
if (fs.existsSync(FILE_ID)) {
  scelto = fs.readFileSync(FILE_ID, 'utf8').trim();
  if (!veri.some(function (d) { return d.deploymentId === scelto; })) {
    esci('L\'ID scritto in deployment-id.txt non corrisponde a nessun deployment:\n  ' + scelto +
      '\nDeployment esistenti:\n' + veri.map(function (d) {
        return '  ' + d.deploymentId + '  (versione ' + d.versionNumber + ', "' + (d.description || '') + '")';
      }).join('\n'));
  }
} else if (veri.length === 1) {
  scelto = veri[0].deploymentId;
} else if (!veri.length) {
  esci('Non c\'è ancora nessun deployment dell\'app web.\n' +
    '  Fai il primo dall\'editor di Apps Script (README_IT.md, punto 7), poi riesegui "npm run deploy".');
} else {
  esci('Ci sono ' + veri.length + ' deployment: non so quale aggiornare.\n' +
    '  Crea il file deployment-id.txt con dentro l\'ID di quello giusto (quello che finisce come il link dell\'app):\n' +
    veri.map(function (d) {
      return '  ' + d.deploymentId + '  (versione ' + d.versionNumber + ', "' + (d.description || '') + '")';
    }).join('\n'));
}

var adesso = new Date();
var due = function (n) { return (n < 10 ? '0' : '') + n; };
var descrizione = 'Aggiornamento del ' + due(adesso.getDate()) + '/' + due(adesso.getMonth() + 1) + '/' +
  adesso.getFullYear() + ' ' + due(adesso.getHours()) + ':' + due(adesso.getMinutes());

console.log('3/3 Pubblico la nuova versione sul deployment ' + scelto + '…');
clasp(['update-deployment', scelto, '--description', descrizione]);

console.log('\n✓ Fatto! L\'app è aggiornata e il link è sempre lo stesso:');
console.log('  https://script.google.com/macros/s/' + scelto + '/exec\n');
