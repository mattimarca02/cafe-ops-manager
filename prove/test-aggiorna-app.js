/*
 * Prova di "npm run deploy" (strumenti/aggiorna-app.js) con un clasp finto:
 * deve fare push e aggiornare l'UNICO deployment vero (non @HEAD).
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

var RADICE = path.join(__dirname, '..');

function preparaClaspFinto(deployments) {
  var cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-finto-'));
  var registro = path.join(cartella, 'chiamate.txt');
  var script = path.join(cartella, 'clasp');
  fs.writeFileSync(script, '#!/usr/bin/env node\n' +
    'require("fs").appendFileSync(' + JSON.stringify(registro) + ', process.argv.slice(2).join(" ") + "\\n");\n' +
    'if (process.argv[2] === "list-deployments") console.log(' + JSON.stringify(JSON.stringify(deployments)) + ');\n');
  fs.chmodSync(script, 0o755);
  return { script: script, registro: registro };
}

function esegui(finto) {
  return childProcess.spawnSync(process.execPath, [path.join(RADICE, 'strumenti', 'aggiorna-app.js')], {
    cwd: RADICE, encoding: 'utf8', env: Object.assign({}, process.env, { BAR_CLASP: finto.script })
  });
}

module.exports = {
  'npm run deploy aggiorna lo stesso deployment': function () {
    var claspJson = path.join(RADICE, '.clasp.json');
    var cEra = fs.existsSync(claspJson);
    if (!cEra) fs.writeFileSync(claspJson, '{"scriptId":"finto","rootDir":"."}');
    try {
      var finto = preparaClaspFinto([
        { deploymentId: 'AKfyHEAD', versionNumber: null, description: '' },
        { deploymentId: 'AKfyAPP123', versionNumber: 7, description: 'Prima versione' }
      ]);
      var r = esegui(finto);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      var chiamate = fs.readFileSync(finto.registro, 'utf8').trim().split('\n');
      assert.strictEqual(chiamate[0], 'push --force');
      assert.strictEqual(chiamate[1], 'list-deployments --json');
      assert.ok(/^update-deployment AKfyAPP123 --description Aggiornamento del /.test(chiamate[2]), chiamate[2]);
      assert.ok(/AKfyAPP123\/exec/.test(r.stdout));

      // Due deployment: si ferma e chiede quale (senza aggiornare nulla)
      var due = preparaClaspFinto([
        { deploymentId: 'AKfyA', versionNumber: 3, description: 'a' },
        { deploymentId: 'AKfyB', versionNumber: 5, description: 'b' }
      ]);
      var r2 = esegui(due);
      assert.notStrictEqual(r2.status, 0);
      assert.ok(/deployment-id\.txt/.test(r2.stderr));
      assert.strictEqual(fs.readFileSync(due.registro, 'utf8').indexOf('update-deployment'), -1);
    } finally {
      if (!cEra) fs.unlinkSync(claspJson);
    }
  }
};
