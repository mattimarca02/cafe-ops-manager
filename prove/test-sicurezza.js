/*
 * Prove della rete di sicurezza: backup, registro errori, email all'assistenza.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');

function copieBackup() {
  var c = cartellaBackup_();
  var out = [];
  var it = c.getFiles();
  while (it.hasNext()) out.push(it.next());
  return out;
}

module.exports = {
  'backup: copia del foglio, restano le ultime 8': function () {
    var e = faiBackup_();
    assert.ok(/^Bar - Backup \d{4}-\d{2}-\d{2} \d{2}\.\d{2}$/.test(e.nome), e.nome);
    assert.strictEqual(copieBackup().length, 1);
    assert.ok(leggiImpostazione_(IMP_ID_CARTELLA_BACKUP), 'ID della cartella salvato in Impostazioni');
    // 9 copie "vecchie" con date diverse + una nuova → ne restano 8, le più recenti
    var cartella = cartellaBackup_();
    var ss = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    for (var i = 1; i <= 9; i++) {
      var f = ss.makeCopy('Bar - Backup 2026-0' + i + '-01 03.00', cartella);
      f._creato = new Date(2026, i - 1, 1);
    }
    cartella.createFile(Utilities.newBlob('altro', 'text/plain', 'Appunti.txt')); // non è un backup: resta
    var e2 = faiBackup_();
    var rimaste = copieBackup().filter(function (f) { return f.getName().indexOf('Bar - Backup') === 0; });
    assert.strictEqual(rimaste.length, 8);
    assert.strictEqual(e2.cestinate, 3);
    var nomi = rimaste.map(function (f) { return f.getName(); });
    assert.ok(nomi.indexOf('Bar - Backup 2026-01-01 03.00') < 0, 'la più vecchia va nel cestino');
    assert.ok(nomi.indexOf('Bar - Backup 2026-09-01 03.00') >= 0);
    assert.strictEqual(copieBackup().length, 9, 'il file che non è un backup resta');
  },

  'registro errori dagli errori dell\'app': function () {
    // Una funzione dell'app che si rompe: messaggio chiaro al telefono, riga nel registro
    var originale = globalThis.leggiSpese_;
    globalThis.leggiSpese_ = function () { throw new Error('foglio rotto per prova'); };
    try {
      var r = riepilogo('1234', 0, 0);
      assert.strictEqual(r.ok, false);
      assert.ok(r.tecnico);
    } finally {
      globalThis.leggiSpese_ = originale;
    }
    var registro = leggiRegistroErrori_();
    assert.strictEqual(registro.length, 1);
    assert.strictEqual(registro[0].funzione, 'app: riepilogo');
    assert.ok(/foglio rotto per prova/.test(registro[0].messaggio));
  },

  'attivatore che fallisce: registro, email immediata, errore rilanciato': function () {
    scriviImpostazione_(IMP_EMAIL_ASSISTENZA, 'assistenza@example.com');
    assert.throws(function () {
      eseguiAttivatore_('provaRotta', function () { throw new Error('Quota superata'); });
    }, /Quota superata/);
    assert.strictEqual(gas.finto.email.length, 1);
    assert.strictEqual(gas.finto.email[0].to, 'assistenza@example.com');
    assert.ok(/ERRORE in provaRotta/.test(gas.finto.email[0].subject));
    assert.strictEqual(leggiRegistroErrori_()[0].funzione, 'attivatore: provaRotta');
    // Senza email assistenza: nessuna email ma il registro sì
    scriviImpostazione_(IMP_EMAIL_ASSISTENZA, '');
    assert.throws(function () { eseguiAttivatore_('altra', function () { throw new Error('x'); }); });
    assert.strictEqual(gas.finto.email.length, 1);
    assert.strictEqual(leggiRegistroErrori_().length, 2);
  },

  'controllo giornaliero: email solo se ci sono errori nelle ultime 24 ore': function () {
    scriviImpostazione_(IMP_EMAIL_ASSISTENZA, 'assistenza@example.com');
    assert.strictEqual(inviaRiepilogoErrori_(new Date()).inviata, false);
    registraErrore_('prova', new Error('errore di ieri'));
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_REGISTRO);
    s.getRange(2, 1).setValue(new Date(Date.now() - 30 * 3600 * 1000)); // 30 ore fa
    assert.strictEqual(inviaRiepilogoErrori_(new Date()).inviata, false, 'errore troppo vecchio');
    registraErrore_('prova', new Error('errore di stanotte'));
    var r = inviaRiepilogoErrori_(new Date());
    assert.ok(r.inviata && r.errori === 1);
    assert.ok(/errore di stanotte/.test(gas.finto.email[0].body));
    assert.ok(!/errore di ieri/.test(gas.finto.email[0].body));
  },

  'il registro non cresce all\'infinito': function () {
    for (var i = 0; i < 560; i++) registraErrore_('prova', new Error('n. ' + i));
    var n = leggiRegistroErrori_().length;
    assert.ok(n <= 550 && n >= 500, 'righe: ' + n);
    assert.ok(/n\. 559/.test(leggiRegistroErrori_()[n - 1].messaggio), 'restano gli ultimi');
  },

  'installaTrigger crea anche backup, scadenze e controllo errori': function () {
    installaTrigger();
    var nomi = gas.finto.trigger.map(function (t) { return t.funzione; }).sort();
    assert.deepStrictEqual(nomi, ['backupSettimanale', 'controlloErrori', 'importaFattureAutomatica',
      'inviaReportMensile', 'promemoriaHaccp', 'promemoriaScadenze']);
    var backup = gas.finto.trigger.filter(function (t) { return t.funzione === 'backupSettimanale'; })[0];
    assert.strictEqual(backup.giornoSettimana, 'SUNDAY');
  }
};
