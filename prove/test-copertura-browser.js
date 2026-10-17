/*
 * Prova nel browser di «Spese coperte dai ricavi» (sezione del Riepilogo): disegno solo all'apertura,
 * una chiamata per periodo, copia già arrivata, periodi, filtri, date a scelta, 30 righe e «Mostra tutto»,
 * riepilogo per mese, periodo vuoto e nessun testo fuori dai box a 320, 412 e 1024 px.
 */
'use strict';

var assert = require('assert');
var conBrowser = require('./aiuto-browser').conBrowser;
var aiuto = require('./screenshot');

var PIN = '1234';
var CHIAVE = 'barSpeseCassa.coperturaPeriodo';

/** Chiamate a coperturaSpese partite dalla pagina (con gli argomenti). */
function contaChiamate(p) {
  var chiamate = [];
  p.on('request', function (rq) {
    if (rq.method() !== 'POST' || !/\/chiama$/.test(rq.url())) return;
    try {
      var c = JSON.parse(rq.postData());
      if (c.funzione === 'coperturaSpese') chiamate.push(c.argomenti);
    } catch (e) { /* niente */ }
  });
  return chiamate;
}

/** L'esempio del testo: spesa 400, ricavi 329 il primo giorno e 400 il secondo, nel mese in corso. */
function preparaEsempio() {
  var oggi = annoMeseOggi_();
  var d = function (g) { return oggi.anno + '-' + due_(oggi.mese) + '-' + due_(g); };
  scriviImpostazione_(IMP_PIN, '1234');
  var r = salvaSpesa('1234', { id: 'Sesempio1x', data: d(1), importo: '400', fornitore: 'Panificio Verdi', categoria: 'Altro', pagamento: 'Contanti' });
  if (!r.ok) throw new Error(r.messaggio);
  salvaChiusura('1234', { id: 'Cesempio1x', data: d(1), contanti: '300', pos: '29' });
  salvaChiusura('1234', { id: 'Cesempio2x', data: d(2), contanti: '400', pos: '0' });
}

/** 60 giorni con una spesa e una piccola chiusura al giorno: elenco lungo, su più mesi. */
function preparaLungo() {
  scriviImpostazione_(IMP_PIN, '1234');
  var oggi = new Date();
  for (var g = 60; g >= 1; g--) {
    var iso = Utilities.formatDate(new Date(oggi.getTime() - g * 86400000), FUSO, 'yyyy-MM-dd');
    salvaSpesa('1234', { id: 'Slungo' + g + 'x', data: iso, importo: '50', fornitore: 'Fornitore con un nome piuttosto lungo numero ' + g, categoria: 'Altro', pagamento: 'Contanti' });
    salvaChiusura('1234', { id: 'Clungo' + g + 'x', data: iso, contanti: '20', pos: '0' });
  }
}

async function apri(p, s) {
  await p.click('#vai-riepilogo');
  await s.attendi();
  if ((await p.getAttribute('#testa-copertura', 'aria-expanded')) !== 'true') {
    await p.click('#testa-copertura');
    await s.attendi();
  }
}

async function righeTipo(p, classe) { return p.locator('#cop-contenuto ' + classe).count(); }

module.exports = {
  'copertura: esempio 400 / 329 / 400, disegno solo all\'apertura, una chiamata per periodo, copia già arrivata': async function () {
    await conBrowser(8801, { vuoto: true, prepara: preparaEsempio }, async function (p, s) {
      var chiamate = contaChiamate(p);
      await p.click('#vai-riepilogo');
      await s.attendi();
      // Sezione chiusa: anteprima di una riga dai dati del Riepilogo, nessuna chiamata e niente disegnato
      assert.strictEqual(chiamate.length, 0);
      assert.strictEqual(await p.innerHTML('#cop-contenuto'), '');
      assert.ok(/La spesa è coperta · guadagno 329,00 €/.test(await p.textContent('#riassunto-copertura')), await p.textContent('#riassunto-copertura'));
      assert.ok((await p.getAttribute('#testa-copertura', 'aria-expanded')) === 'false');

      await p.click('#testa-copertura');
      await s.attendi();
      assert.strictEqual(chiamate.length, 1);
      assert.strictEqual(await p.locator('#cop-etichetta').textContent(), await p.locator('#riepilogo-mese').textContent());
      // Elenco: spesa, ricavi del giorno, nastrino −71 poi ricavi e nastrino «Coperta ✓»
      var testo = await p.textContent('#cop-contenuto');
      assert.ok(/Panificio Verdi/.test(testo) && /400,00 €/.test(testo));
      assert.ok(/−71,00 €/.test(await p.textContent('#cop-contenuto .cop-nastrino.cop-aperta')));
      assert.ok(/Coperta ✓/.test(await p.textContent('#cop-contenuto .cop-nastrino.cop-coperta')));
      assert.strictEqual(await righeTipo(p, '.cop-spesa'), 1);
      assert.strictEqual(await righeTipo(p, '.cop-ricavi'), 2);
      assert.ok(/di cui 329,00 € in avanzo/.test(await p.textContent('#cop-contenuto .cop-ricavi >> nth=1')));
      // Riquadro con i totali, Guadagno verde
      var riquadro = await p.textContent('.cop-riquadro');
      assert.ok(/Spese\s*400,00 €/.test(riquadro) && /Ricavi\s*729,00 €/.test(riquadro) && /Ancora da coprire\s*0,00 €/.test(riquadro), riquadro);
      assert.ok(/Spese coperte: 1 su 1/.test(riquadro));
      assert.ok(await p.locator('.cop-riquadro tr.evidenza td.positivo').count() === 1);
      // Importi allineati a destra, date gg/mm
      assert.ok(/^\d\d\/\d\d$/.test((await p.textContent('#cop-contenuto .cop-spesa .cop-data')).trim()));
      assert.strictEqual(await p.evaluate(function () { return getComputedStyle(document.querySelector('#cop-contenuto td.cop-importo')).textAlign; }), 'right');

      // Filtro «Fatture»: nessuna fattura, solo ricavi; un'altra chiamata. Tornando a «Tutte»: copia già arrivata
      await p.click('#cop-filtro button[data-filtro="fatture"]');
      await s.attendi();
      assert.strictEqual(chiamate.length, 2);
      assert.ok(/Nessuna spesa in questo periodo/.test(await p.textContent('.cop-riquadro')));
      await p.click('#cop-filtro button[data-filtro="senzaFattura"]');
      await s.attendi();
      assert.strictEqual(chiamate.length, 3);
      assert.strictEqual(await righeTipo(p, '.cop-spesa'), 1);
      await p.click('#cop-filtro button[data-filtro="tutte"]');
      assert.strictEqual(chiamate.length, 3, 'copia già arrivata: nessuna nuova chiamata');
      assert.strictEqual(await righeTipo(p, '.cop-spesa'), 1);
      assert.strictEqual(chiamate[0][3], 'tutte');
      assert.strictEqual(chiamate[1][3], 'fatture');

      // Cambio mese nel Riepilogo: la copia resta; riaprendo dalla home i dati si rileggono
      await p.click('#mese-prima');
      await s.attendi();
      await p.click('#mese-dopo');
      await s.attendi();
      assert.strictEqual(chiamate.length, 3);
      await p.click('#nav-home');
      await p.waitForSelector('#schermo-home', { state: 'visible' });
      await p.click('#vai-riepilogo');
      await s.attendi();
      assert.strictEqual(chiamate.length, 4, 'dalla home: dati riletti');
      assert.strictEqual(await righeTipo(p, '.cop-spesa'), 1);
    });
  },

  'copertura: periodi, frecce, periodo ricordato, periodo vuoto': async function () {
    await conBrowser(8802, { vuoto: true, prepara: preparaEsempio }, async function (p, s) {
      var chiamate = contaChiamate(p);
      await apri(p, s);
      var nomi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
      var oggi = new Date();
      assert.ok(await p.locator('#cop-periodi button.scelto').getAttribute('data-periodo') === 'questo');
      assert.strictEqual(await p.evaluate(function () { return document.getElementById('cop-dopo').style.visibility; }), 'hidden', 'niente futuro');

      // Mese scorso: vuoto, messaggio chiaro; la freccia avanti compare
      await p.click('#cop-periodi button[data-periodo="scorso"]');
      await s.attendi();
      assert.ok(/Nessuna spesa e nessuna chiusura cassa in questo periodo/.test(await p.textContent('#cop-contenuto')));
      assert.strictEqual(await righeTipo(p, '.cop-spesa'), 0);
      assert.strictEqual(await p.locator('.cop-riquadro').count(), 0);
      assert.strictEqual(await p.evaluate(function () { return document.getElementById('cop-dopo').style.visibility; }), 'visible');
      // Frecce: un altro mese indietro, poi di nuovo avanti (copia già arrivata)
      var n = chiamate.length;
      await p.click('#cop-prima');
      await s.attendi();
      assert.strictEqual(chiamate.length, n + 1);
      assert.strictEqual(await p.locator('#cop-periodi button.scelto').count(), 0, 'nessuna pillola per un mese qualunque');
      await p.click('#cop-dopo');
      assert.strictEqual(chiamate.length, n + 1);
      // Trimestre e Anno
      await p.click('#cop-periodi button[data-periodo="trimestre"]');
      await s.attendi();
      assert.ok(/° trimestre \d{4}/.test(await p.textContent('#cop-etichetta')));
      assert.ok(await p.locator('.cop-riquadro').count() === 1);
      var ultimaTrimestre = chiamate[chiamate.length - 1];
      assert.ok(/^\d{4}-(01|04|07|10)-01$/.test(ultimaTrimestre[1]));
      await p.click('#cop-periodi button[data-periodo="anno"]');
      await s.attendi();
      assert.strictEqual((await p.textContent('#cop-etichetta')).trim(), String(oggi.getFullYear()));
      assert.deepStrictEqual(chiamate[chiamate.length - 1].slice(1, 3), [oggi.getFullYear() + '-01-01', oggi.getFullYear() + '-12-31']);
      // Il periodo si ricorda sul dispositivo (anche dopo aver ricaricato la pagina)
      var salvato = JSON.parse(await p.evaluate(function (k) { return window.localStorage.getItem(k); }, CHIAVE));
      assert.strictEqual(salvato.p.tipo, 'anno');
      await p.reload();
      await aiuto.scriviPin(p);
      await p.click('#vai-riepilogo');
      await s.attendi();
      assert.ok((await p.textContent('#cop-etichetta')).trim() === String(oggi.getFullYear()));
      // Mese scorso resta «relativo»: l'etichetta segue la data di oggi
      await p.click('#cop-periodi button[data-periodo="scorso"]');
      await s.attendi();
      var scorso = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
      assert.ok(new RegExp(nomi[scorso.getMonth()], 'i').test(await p.textContent('#cop-etichetta')));
      // Valore salvato rovinato: si riparte dal mese in corso senza errori
      await p.evaluate(function (k) { window.localStorage.setItem(k, '{non è json'); }, CHIAVE);
      await p.reload();
      await aiuto.scriviPin(p);
      await p.click('#vai-riepilogo');
      await s.attendi();
      assert.ok(await p.locator('#cop-periodi button.scelto').getAttribute('data-periodo') === 'questo');
    });
  },

  'copertura: date a scelta (errori in chiaro, nessuna chiamata se le date non vanno)': async function () {
    await conBrowser(8803, { vuoto: true, prepara: preparaEsempio }, async function (p, s) {
      var chiamate = contaChiamate(p);
      await apri(p, s);
      await p.click('#cop-periodi button[data-periodo="personalizzato"]');
      await s.attendi();
      assert.ok(await p.isVisible('#cop-personalizzato'));
      assert.ok(/Periodo personalizzato/.test(await p.textContent('#cop-tipo-etichetta')));
      assert.strictEqual(await p.isVisible('#cop-prima'), false, 'frecce nascoste per le date a scelta');
      var n = chiamate.length;
      var oggi = new Date();
      var iso = function (g) { return oggi.getFullYear() + '-' + ('0' + (oggi.getMonth() + 1)).slice(-2) + '-' + ('0' + g).slice(-2); };
      // Data finale prima di quella iniziale
      await p.fill('#cop-da', iso(10));
      await p.fill('#cop-a', iso(3));
      await p.click('#cop-applica');
      assert.ok(/prima della data iniziale/.test(await p.textContent('#cop-errore')));
      assert.ok(await p.isVisible('#cop-errore'));
      assert.strictEqual(chiamate.length, n);
      // Data mancante
      await p.fill('#cop-a', '');
      await p.click('#cop-applica');
      assert.ok(/due date valide/.test(await p.textContent('#cop-errore')));
      assert.strictEqual(chiamate.length, n);
      // Periodo giusto: solo i primi due giorni del mese
      await p.fill('#cop-da', iso(1));
      await p.fill('#cop-a', iso(2));
      await p.click('#cop-applica');
      await s.attendi();
      assert.ok(!(await p.isVisible('#cop-errore')));
      assert.strictEqual(chiamate.length, n + 1);
      assert.deepStrictEqual(chiamate[n].slice(1, 3), [iso(1), iso(2)]);
      assert.ok(/Coperta ✓/.test(await p.textContent('#cop-contenuto')));
      assert.ok(/\d\d\/\d\d\/\d{4} – \d\d\/\d\d\/\d{4}/.test(await p.textContent('#cop-etichetta')));
      // Riaprendo il Riepilogo si ritrovano le stesse date
      await p.reload();
      await aiuto.scriviPin(p);
      await p.click('#vai-riepilogo');
      await s.attendi();
      assert.ok(await p.isVisible('#cop-personalizzato'));
      assert.strictEqual(await p.inputValue('#cop-da'), '');   // i campi si riempiono quando si sceglie «Personalizzato»
      assert.ok(/\d\d\/\d\d\/\d{4} – \d\d\/\d\d\/\d{4}/.test(await p.textContent('#cop-etichetta')));
    });
  },

  'copertura: elenco lungo (prime 30 righe, «Mostra tutto») e riepilogo per mese': async function () {
    await conBrowser(8804, { vuoto: true, prepara: preparaLungo }, async function (p, s) {
      var chiamate = contaChiamate(p);
      await apri(p, s);
      await p.click('#cop-periodi button[data-periodo="anno"]');
      await s.attendi();
      var righe = async function () { return p.locator('#cop-contenuto .cop-spesa, #cop-contenuto .cop-ricavi, #cop-contenuto .cop-nastrino').count(); };
      var mostrate = await righe();
      assert.ok(mostrate >= 30 && mostrate <= 34, 'prime 30 righe (più i nastrini del ricavo): ' + mostrate);
      assert.ok(await p.isVisible('#cop-tutto'));
      assert.ok(/Mostrate le prime \d+ righe su \d+/.test(await p.textContent('#cop-contenuto')));
      var chiamateOra = chiamate.length;
      await p.click('#cop-tutto');
      assert.ok((await righe()) > 120, 'tutte le righe');
      assert.ok(!(await p.isVisible('#cop-tutto')));
      assert.strictEqual(chiamate.length, chiamateOra, 'nessuna nuova chiamata');
      // Riepilogo per mese: una riga per mese
      assert.ok(await p.isVisible('#cop-vista'));
      await p.click('#cop-vista button[data-vista="mesi"]');
      var mesi = await p.locator('#cop-contenuto .cop-mese').count();
      assert.ok(mesi >= 2 && mesi <= 12, 'mesi: ' + mesi);
      assert.ok(/Scoperto/.test(await p.textContent('#cop-contenuto .cop-mese >> nth=-1')));
      assert.ok(await p.locator('#cop-contenuto .cop-mese .negativo').count() > 0);
      assert.strictEqual(await righe(), 0);
      await p.click('#cop-vista button[data-vista="righe"]');
      assert.ok((await righe()) > 120);
      // Cambio di periodo: si riparte dalle prime 30 righe
      await p.click('#cop-periodi button[data-periodo="trimestre"]');
      await s.attendi();
      await p.click('#cop-periodi button[data-periodo="anno"]');
      assert.ok((await righe()) <= 34);
    });
  },

  'copertura: nessun testo fuori dai box (elenco corto, lungo e periodo vuoto) a 320, 412 e 1024 px': async function () {
    for (var larghezza of [320, 412, 1024]) {
      await conBrowser(8805, { vuoto: true, prepara: function () { preparaLungo(); preparaEsempio(); } }, async function (p, s) {
        await apri(p, s);
        var controlla = async function (nome) {
          assert.deepStrictEqual(await p.evaluate(aiuto.controllaTestiFuori), [], nome + ' @' + larghezza + 'px');
        };
        await controlla('mese');                                              // corto
        await p.click('#cop-periodi button[data-periodo="anno"]');
        await s.attendi();
        await controlla('anno (30 righe)');                                   // lungo
        await p.click('#cop-tutto');
        await controlla('anno (tutto)');
        await p.click('#cop-vista button[data-vista="mesi"]');
        await controlla('per mese');
        await p.click('#cop-periodi button[data-periodo="personalizzato"]');
        await s.attendi();
        await p.fill('#cop-da', '2019-01-01');
        await p.fill('#cop-a', '2019-01-31');
        await p.click('#cop-applica');
        await s.attendi();
        assert.ok(/Nessuna spesa e nessuna chiusura/.test(await p.textContent('#cop-contenuto')));
        await controlla('vuoto');
        await p.click('#cop-applica');   // errore di date
        await p.fill('#cop-a', '2018-01-01');
        await p.click('#cop-applica');
        await controlla('errore date');
      }, larghezza);
    }
  }
};
