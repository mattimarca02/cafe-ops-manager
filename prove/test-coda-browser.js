/*
 * Prova della coda offline nel browser (Chromium) con il server finto:
 * - rete che non risponde → la spesa va nella coda, niente doppioni;
 * - dispositivo offline → la chiusura va subito nella coda;
 * - risposta persa (il server salva ma il telefono non lo sa) → nessun doppione;
 * - ritorno della rete → invio automatico;
 * - chiusura già presente per quel giorno → "da controllare" e sostituzione;
 * - foto in coda e spazio finito sul dispositivo.
 */
'use strict';

var assert = require('assert');
var serverFinto = require('./server-finto');
var aiuto = require('./screenshot');

var PORTA = 8766;
var BASE = 'http://localhost:' + PORTA;
// JPEG minuscolo valido (2x1 pixel): lo stesso usato dalla pagina per la prova di rotazione.
var JPEG = Buffer.from(/data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)/.exec(
  require('fs').readFileSync(require('path').join(__dirname, '..', 'Script.html'), 'utf8'))[1], 'base64');

function http(percorso) {
  return new Promise(function (ok, ko) {
    require('http').get(BASE + percorso, function (res) {
      var t = '';
      res.on('data', function (c) { t += c; });
      res.on('end', function () { ok(t); });
    }).on('error', ko);
  });
}

async function righe(scheda) {
  var tutte = JSON.parse(await http('/dati?scheda=' + encodeURIComponent(scheda)));
  return tutte.slice(1).filter(function (r) { return r.some(function (v) { return v !== ''; }); });
}

async function testoBarra(p) {
  if (!(await p.isVisible('#barra-coda'))) return '';
  return (await p.textContent('#barra-coda-testo')).trim();
}

async function compilaSpesa(p, importo, fornitore) {
  await p.click('#vai-spesa');
  await p.fill('#spesa-importo', importo);
  await p.fill('#spesa-fornitore', fornitore);
  await p.click('#spesa-categorie button >> nth=0');
  await p.click('#spesa-pagamenti button >> nth=0');
}

module.exports = {
  'coda offline: niente perso, niente doppioni': async function () {
    var server = serverFinto.avvia(PORTA, { giorni: 40 });
    var browser = await aiuto.playwright().chromium.launch();
    try {
      var contesto = await browser.newContext({ viewport: { width: 412, height: 800 } });
      var p = await contesto.newPage();
      var errori = [];
      p.on('pageerror', function (e) { errori.push(e.message); });
      await p.goto(BASE + '/');
      await aiuto.scriviPin(p);
      var speseIniziali = (await righe('Spese')).length;
      var chiusureIniziali = (await righe('Chiusure')).length;

      // 1. Il server non risponde: la spesa finisce nella coda.
      await http('/rete?stato=off');
      await compilaSpesa(p, '11,11', 'Panificio Verdi');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      assert.ok(/Manca internet/.test(await p.textContent('#in-coda-testo')));
      await p.click('#in-coda-ok');
      assert.strictEqual(await testoBarra(p), '1 in attesa di invio');
      assert.strictEqual(await p.inputValue('#spesa-importo'), '', 'il modulo deve ripartire vuoto');

      // 2. Dispositivo offline: la chiusura va subito nella coda (nessuna chiamata).
      await contesto.setOffline(true);
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-data', '2030-01-15');
      await p.fill('#chiusura-contanti', '400');
      await p.fill('#chiusura-pos', '100');
      await p.click('#chiusura-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      assert.strictEqual(await testoBarra(p), '2 in attesa di invio');

      // 3. «Invia ora» mentre è ancora offline: avviso chiaro, nulla perso.
      await p.click('#barra-coda-invia');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
      assert.ok(/ancora senza internet/.test(await p.textContent('#errore-testo')));
      await p.click('#errore-chiudi');
      await contesto.setOffline(false);

      // 4. Risposta persa: il server salva, il telefono mette in coda.
      await http('/rete?stato=lenta');
      await compilaSpesa(p, '22,22', 'Supermercato');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      assert.strictEqual((await righe('Spese')).filter(function (r) { return r[2] === 22.22; }).length, 1,
        'il server ha già salvato la spesa 22,22');

      // 5. Torna la rete: invio automatico (evento "online" o controllo periodico).
      await http('/rete?stato=on');
      await contesto.setOffline(true);
      await contesto.setOffline(false);
      await p.waitForFunction(function () {
        return document.getElementById('barra-coda').style.display === 'none';
      }, null, { timeout: 20000 });
      var spese = await righe('Spese');
      assert.strictEqual(spese.length, speseIniziali + 2, 'due spese nuove, nessun doppione');
      assert.strictEqual(spese.filter(function (r) { return r[2] === 22.22; }).length, 1);
      assert.strictEqual(spese.filter(function (r) { return r[2] === 11.11; }).length, 1);
      assert.strictEqual((await righe('Chiusure')).length, chiusureIniziali + 1);

      // 6. Chiusura offline per un giorno che ha già la chiusura → da controllare → sostituisci.
      await contesto.setOffline(true);
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-data', '2030-01-15');
      await p.fill('#chiusura-contanti', '450');
      await p.fill('#chiusura-pos', '0');
      await p.click('#chiusura-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      await contesto.setOffline(false); // invio automatico dopo l'evento "online"
      await p.waitForFunction(function () {
        return /1 da controllare/.test(document.getElementById('barra-coda-testo').textContent);
      }, null, { timeout: 20000 });
      await p.click('#barra-coda-vedi');
      await p.waitForSelector('#schermo-coda', { state: 'visible' });
      assert.ok(/già una chiusura/.test(await p.textContent('#coda-elenco')));
      await p.click('#coda-elenco button:has-text("Sì, sostituisci")');
      await p.waitForSelector('#pannello-salvato', { state: 'visible' });
      await p.waitForSelector('#schermo-home', { state: 'visible' });
      var chiusure = await righe('Chiusure');
      assert.strictEqual(chiusure.length, chiusureIniziali + 1);
      assert.strictEqual(chiusure.filter(function (r) { return r[1] === 450; }).length, 1);

      // 7. Foto in coda: viene inviata quando torna la rete.
      await contesto.setOffline(true);
      await compilaSpesa(p, '33,33', 'Panificio Verdi');
      await p.setInputFiles('#foto-file', { name: 'scontrino.jpg', mimeType: 'image/jpeg', buffer: JPEG });
      await p.waitForSelector('#foto-riquadro', { state: 'visible' });
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      await p.click('#barra-coda-vedi');
      assert.ok(/con foto/i.test(await p.textContent('#coda-elenco')));
      await contesto.setOffline(false);
      await p.click('#coda-invia');
      await p.waitForSelector('#schermo-home', { state: 'visible', timeout: 15000 });
      var conFoto = (await righe('Spese')).filter(function (r) { return r[2] === 33.33; });
      assert.strictEqual(conFoto.length, 1);
      assert.ok(/drive\.google\.com/.test(conFoto[0][7]), 'la foto deve essere stata salvata su Drive');

      // 8. Spazio finito sul dispositivo: si può salvare senza foto.
      await p.evaluate(function () {
        var originale = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (String(v).length > 2000) throw new Error('QuotaExceededError');
          return originale.call(this, k, v);
        };
      });
      await contesto.setOffline(true);
      await compilaSpesa(p, '44,44', 'Panificio Verdi');
      await p.setInputFiles('#foto-file', { name: 'scontrino.jpg', mimeType: 'image/jpeg', buffer: JPEG });
      await p.waitForSelector('#foto-riquadro', { state: 'visible' });
      // La foto minuscola sta nello spazio: ne simulo una grande.
      await p.evaluate(function () {
        var originale = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (String(v).indexOf('data:image') >= 0) throw new Error('QuotaExceededError');
          return originale.call(this, k, v);
        };
      });
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-conferma', { state: 'visible' });
      assert.ok(/non c'è abbastanza spazio/.test(await p.textContent('#conferma-testo')));
      await p.click('#conferma-si');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
      await p.click('#in-coda-ok');
      await contesto.setOffline(false);
      await p.click('#barra-coda-invia');
      await p.waitForSelector('#schermo-home', { state: 'visible', timeout: 15000 });
      var senzaFoto = (await righe('Spese')).filter(function (r) { return r[2] === 44.44; });
      assert.strictEqual(senzaFoto.length, 1);
      assert.ok(/foto da rifare/.test(senzaFoto[0][6]));
      assert.strictEqual(senzaFoto[0][7], '');

      assert.deepStrictEqual(errori, [], 'errori JavaScript nella pagina');
    } finally {
      await browser.close();
      server.close();
    }
  }
};
