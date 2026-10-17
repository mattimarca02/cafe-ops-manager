/*
 * Prova nel browser delle sezioni a fisarmonica del Riepilogo:
 * «Da fare» in cima e aperta, una sola sezione aperta alla volta, sezione ricordata,
 * disegno solo all'apertura, tastiera, «Da fare» nascosta se vuota, nessun testo fuori dai box.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;
var aiuto = require('./screenshot');

var SEZIONI = ['dafare', 'categorie', 'andamento', 'fatture', 'cassa', 'copertura', 'ultime'];

async function aperte(p) {
  return p.evaluate(function (chiavi) {
    return chiavi.filter(function (c) { return document.getElementById('testa-' + c).getAttribute('aria-expanded') === 'true'; });
  }, SEZIONI);
}

async function corpoVisibile(p, chiave) {
  return p.isVisible('#corpo-' + chiave);
}

async function apriRiepilogo(p, s) {
  await p.click('#vai-riepilogo');
  await s.attendi();
}

async function tornaHome(p) {
  await p.click('#nav-home');
  await p.waitForSelector('#schermo-home', { state: 'visible' });
}

module.exports = {
  'riepilogo: «Da fare» aperta per prima, le altre chiuse e disegnate solo all\'apertura': async function () {
    await conBrowser(8793, { giorni: 40 }, async function (p, s) {
      await apriRiepilogo(p, s);
      // I tre box dei numeri sono sempre visibili, prima delle sezioni
      assert.strictEqual(await p.locator('#riepilogo-numeri .numero').count(), 3);
      var ordine = await p.evaluate(function () {
        var ids = [];
        var figli = document.getElementById('riepilogo-sezioni').children;
        for (var i = 0; i < figli.length; i++) if (figli[i].offsetHeight > 0) ids.push(figli[i].id);
        return ids;
      });
      assert.deepStrictEqual(ordine, ['sezione-dafare', 'sezione-categorie', 'sezione-andamento', 'sezione-fatture', 'sezione-cassa', 'sezione-copertura', 'sezione-ultime']);
      assert.deepStrictEqual(await aperte(p), ['dafare']);
      assert.ok(await corpoVisibile(p, 'dafare'));
      assert.ok(/^\d+$/.test(await p.textContent('#badge-dafare')) && Number(await p.textContent('#badge-dafare')) > 0);
      assert.ok(/da categorizzare/.test(await p.textContent('#riassunto-dafare')));
      // Ogni intestazione: alta almeno 56px, con anteprima di una riga
      for (var c of SEZIONI) {
        var alt = await p.evaluate(function (id) { return document.getElementById(id).offsetHeight; }, 'testa-' + c);
        assert.ok(alt >= 56, 'intestazione ' + c + ' alta ' + alt);
        assert.ok((await p.textContent('#riassunto-' + c)).length > 3, 'anteprima di ' + c);
      }
      // Le sezioni chiuse non sono ancora disegnate
      assert.strictEqual(await p.innerHTML('#riepilogo-categorie'), '');
      assert.strictEqual(await p.innerHTML('#grafico-mesi'), '');
      assert.strictEqual(await p.innerHTML('#riepilogo-ultime'), '');
      assert.strictEqual(await p.innerHTML('#cop-contenuto'), '');
      assert.ok(await p.isVisible('#riepilogo-da-categorizzare'));
      assert.ok(await p.locator('#riepilogo-dafare-voci .riga-dafare').count() > 0);
    });
  },

  'riepilogo: una sola sezione aperta, «Da fare» a parte, sezione ricordata, tastiera': async function () {
    await conBrowser(8794, { giorni: 40 }, async function (p, s) {
      await apriRiepilogo(p, s);
      await p.click('#testa-categorie');
      assert.deepStrictEqual(await aperte(p), ['dafare', 'categorie']);
      assert.ok(/\d,\d\d €/.test(await p.textContent('#riepilogo-categorie')));
      assert.ok(await p.locator('#riepilogo-budget .riga-budget').count() > 0);
      await p.click('#testa-andamento');
      assert.deepStrictEqual(await aperte(p), ['dafare', 'andamento']);
      assert.ok(!(await corpoVisibile(p, 'categorie')));
      assert.ok(await p.locator('#grafico-mesi .mese').count() === 12);
      assert.ok(await p.locator('#grafico-settimana .riga-barra').count() > 0);
      // Si può chiudere anche «Da fare»
      await p.click('#testa-dafare');
      assert.deepStrictEqual(await aperte(p), ['andamento']);

      // Tastiera: Invio e Spazio sul pulsante
      await p.focus('#testa-cassa');
      await p.keyboard.press('Enter');
      assert.deepStrictEqual(await aperte(p), ['cassa']);
      assert.ok(await p.isVisible('#riepilogo-contante .contante-cifra'));
      assert.ok(/Incassi − spese/.test(await p.textContent('#riepilogo-cassa-righe')));
      await p.focus('#testa-fatture');
      await p.keyboard.press('Space');
      assert.deepStrictEqual(await aperte(p), ['fatture']);
      assert.ok(/Fatture fornitori/.test(await p.textContent('#riepilogo-spese-righe')));

      // L'ultima sezione aperta viene ricordata (anche aprendo di nuovo il Riepilogo)
      await tornaHome(p);
      await apriRiepilogo(p, s);
      assert.deepStrictEqual(await aperte(p), ['dafare', 'fatture']);
      assert.strictEqual(await p.evaluate(function () { return window.localStorage.getItem('barSpeseCassa.riepilogoSezione'); }), 'fatture');

      // Chiudendola, non resta nulla da ricordare
      await p.click('#testa-fatture');
      assert.deepStrictEqual(await aperte(p), ['dafare']);
      assert.strictEqual(await p.evaluate(function () { return window.localStorage.getItem('barSpeseCassa.riepilogoSezione'); }), '');

      // Ultime spese e cambio mese
      await p.click('#testa-ultime');
      assert.ok(await p.locator('#riepilogo-ultime .riga-spesa').count() > 0);
      await p.click('#mese-prima');
      await s.attendi();
      assert.deepStrictEqual(await aperte(p), ['dafare', 'ultime']);
    });
  },

  'riepilogo: «Da fare» sparisce se non c\'è niente da fare': async function () {
    var prepara = function () {
      // Nessun controllo HACCP da fare: il foglio di prova parte con quelli predefiniti
      var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_CONTROLLI_HACCP);
      if (s && s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
    };
    await conBrowser(8795, { vuoto: true, prepara: prepara }, async function (p, s) {
      await apriRiepilogo(p, s);
      assert.ok(!(await p.isVisible('#sezione-dafare')), '«Da fare» nascosta se vuota');
      assert.deepStrictEqual(await aperte(p), []);
      assert.strictEqual(await p.locator('#riepilogo-sezioni .sezione:visible').count(), 6, 'le altre sei sezioni ci sono');
      // Le altre sezioni si aprono comunque
      await p.click('#testa-ultime');
      assert.ok(/Non hai ancora inserito spese/.test(await p.textContent('#riepilogo-ultime')));
    });
  },

  'riepilogo: nessun testo fuori dai box con tutte le sezioni aperte, a 320, 412 e 1024 px': async function () {
    for (var larghezza of [320, 412, 1024]) {
      await conBrowser(8796, { giorni: 40 }, async function (p, s) {
        await apriRiepilogo(p, s);
        for (var c of SEZIONI) {
          if (await p.isVisible('#testa-' + c) && (await aperte(p)).indexOf(c) < 0) await p.click('#testa-' + c);
          await s.attendi();
          var problemi = await p.evaluate(aiuto.controllaTestiFuori);
          assert.deepStrictEqual(problemi, [], 'sezione ' + c + ' @' + larghezza + 'px');
        }
      }, larghezza);
    }
  }
};
