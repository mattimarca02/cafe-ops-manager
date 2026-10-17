/*
 * Screenshot automatici dell'app (server finto) a 320, 412 e 1024 pixel di
 * larghezza, con controllo che nessun testo esca da pulsanti e riquadri.
 *
 *   node prove/screenshot.js            tutte le schermate
 *   node prove/screenshot.js riepilogo  solo le schermate che contengono "riepilogo"
 *
 * Le immagini vanno in prove/screenshot/.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var serverFinto = require('./server-finto');

function playwright() {
  try {
    return require('playwright');
  } catch (e) {
    var globale = childProcess.execSync('npm root -g').toString().trim();
    return require(path.join(globale, 'playwright'));
  }
}

var LARGHEZZE = [320, 412, 1024];
var CARTELLA = path.join(__dirname, 'screenshot');
var PORTA = 8765;

/** Controllo nella pagina: testi che escono dal loro riquadro o pagina più larga dello schermo. */
function controllaTestiFuori() {
  var problemi = [];
  var SCATOLE = 'button, .bottone, .riquadro, .voce, .avviso, .pannello, select, input, .barra-coda, .scheda-grafico, .chip, td, th, ' +
    '.pillola, .contatore, #testata-sezione, .numero, .riassunto, .totale-grande, .riquadro-file, .persona, .carta-home, .carta, .testata, ' +
    '.riga-menu, .azione-home, .gruppo, .navigazione, .salvato, #app';
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    problemi.push('la pagina scorre in orizzontale (' + document.documentElement.scrollWidth + 'px > ' + window.innerWidth + 'px)');
  }
  var visibile = function (el) {
    while (el && el !== document.body) {
      var s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      el = el.parentElement;
    }
    return true;
  };
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var nodo;
  while ((nodo = walker.nextNode())) {
    if (!/\S/.test(nodo.nodeValue)) continue;
    var padre = nodo.parentElement;
    if (!padre || !visibile(padre) || padre.closest('script, style, option')) continue;
    var scatola = padre.closest(SCATOLE);
    if (!scatola) continue;
    var r = document.createRange();
    r.selectNodeContents(nodo);
    var rs = r.getClientRects();
    var b = scatola.getBoundingClientRect();
    var stile = window.getComputedStyle(scatola);
    var sx = b.left + parseFloat(stile.borderLeftWidth);
    var dx = b.right - parseFloat(stile.borderRightWidth);
    for (var i = 0; i < rs.length; i++) {
      if (rs[i].width === 0) continue;
      if (rs[i].right > dx + 1 || rs[i].left < sx - 1) {
        problemi.push('"' + nodo.nodeValue.trim().substring(0, 40) + '" esce da <' + scatola.tagName.toLowerCase() +
          (scatola.id ? '#' + scatola.id : '') + (scatola.className ? '.' + String(scatola.className).replace(/\s+/g, '.') : '') + '>');
        break;
      }
    }
  }
  // Pulsanti e campi più larghi del loro contenitore
  var tutti = document.querySelectorAll('button, .bottone, select, input, .riquadro, .voce, img, svg, table');
  for (var k = 0; k < tutti.length; k++) {
    var el = tutti[k];
    if (!visibile(el) || !el.parentElement) continue;
    var re = el.getBoundingClientRect();
    if (re.width && re.right > window.innerWidth + 1) problemi.push('<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '> esce dallo schermo a destra');
  }
  // Pulsanti alti almeno 52px e testo di almeno 17px (eccezione: sigle dei mesi sotto il grafico)
  var pulsanti = document.querySelectorAll('button, .bottone');
  for (var q = 0; q < pulsanti.length; q++) {
    var pb = pulsanti[q];
    if (!visibile(pb) || pb.closest('.colonne')) continue;
    var alt = pb.getBoundingClientRect().height;
    if (alt && alt < 51.5) {
      problemi.push('pulsante basso (' + Math.round(alt) + 'px): "' + (pb.textContent || pb.getAttribute('aria-label') || '').trim().substring(0, 30) + '"');
    }
  }
  var walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var n2;
  var piccoli = {};
  while ((n2 = walker2.nextNode())) {
    if (!/\S/.test(n2.nodeValue)) continue;
    var el2 = n2.parentElement;
    if (!el2 || !visibile(el2) || el2.closest('script, style, option, .etichette-colonne')) continue;
    var dim = parseFloat(window.getComputedStyle(el2).fontSize);
    if (dim < 16.9) piccoli['testo di ' + dim + 'px: "' + n2.nodeValue.trim().substring(0, 30) + '"'] = true;
  }
  Object.keys(piccoli).forEach(function (k) { problemi.push(k); });
  return problemi;
}

async function scriviPin(pagina) {
  await pagina.waitForFunction(function () {
    var vis = function (id) { var e = document.getElementById(id); return e && e.offsetHeight > 0; };
    return vis('schermo-pin') || vis('schermo-home') || vis('schermo-persona');
  }, null, { timeout: 15000 });
  if (await pagina.isVisible('#schermo-pin')) {
    for (var c of '1234') await pagina.click('#schermo-pin button[data-cifra="' + c + '"]');
  }
  await pagina.waitForFunction(function () {
    var vis = function (id) { var e = document.getElementById(id); return e && e.offsetHeight > 0; };
    return vis('schermo-home') || vis('schermo-persona');
  }, null, { timeout: 15000 });
  if (await pagina.isVisible('#schermo-persona')) await pagina.click('#persona-scelte button >> nth=0');
  await pagina.waitForSelector('#schermo-home', { state: 'visible' });
  await attendiFine(pagina);
}

async function attendiFine(pagina) {
  await pagina.waitForFunction(function () {
    var a = document.getElementById('pannello-attesa');
    return !a || window.getComputedStyle(a).display === 'none';
  }, null, { timeout: 15000 });
  await pagina.waitForTimeout(150);
}

/** Elenco delle schermate da fotografare: nome → azioni per arrivarci (dalla home). */
var SCHERMATE = require('./schermate');

async function principale() {
  var filtro = process.argv[2] || '';
  if (!fs.existsSync(CARTELLA)) fs.mkdirSync(CARTELLA, { recursive: true });
  var server = serverFinto.avvia(PORTA);
  var browser = await playwright().chromium.launch();
  var tuttiProblemi = [];
  var fatte = 0;
  try {
    for (var larghezza of LARGHEZZE) {
      var contesto = await browser.newContext({ viewport: { width: larghezza, height: 760 }, deviceScaleFactor: 1, locale: 'it-IT', timezoneId: 'Europe/Rome' });
      var pagina = await contesto.newPage();
      var erroriPagina = [];
      pagina.on('pageerror', function (e) { erroriPagina.push(e.message); });
      pagina.on('dialog', function (d) { d.dismiss(); });
      await pagina.goto('http://localhost:' + PORTA + '/');
      await pagina.evaluate(function () { try { localStorage.clear(); } catch (e) { /* niente */ } });
      await pagina.goto('http://localhost:' + PORTA + '/');
      for (var s of SCHERMATE) {
        if (filtro && s.nome.indexOf(filtro) < 0) continue;
        if (s.nome === 'pin') await pagina.evaluate(function () { try { localStorage.clear(); } catch (e) { /* niente */ } });
        await pagina.goto('http://localhost:' + PORTA + '/');
        if (s.nome !== 'pin') await scriviPin(pagina);
        else await pagina.waitForSelector('#schermo-pin', { state: 'visible' });
        await s.vai(pagina, { attendi: attendiFine, larghezza: larghezza, porta: PORTA });
        if (!s.senzaAttesa) await attendiFine(pagina);
        var problemi = await pagina.evaluate(controllaTestiFuori);
        problemi.forEach(function (p) { tuttiProblemi.push(s.nome + ' @' + larghezza + 'px: ' + p); });
        // Nella foto a pagina intera la barra in basso (fissa) va in fondo alla pagina, non a metà
        await pagina.evaluate(function () { var n = document.getElementById('navigazione'); if (n) n.style.position = 'static'; });
        await pagina.screenshot({ path: path.join(CARTELLA, s.nome + '-' + larghezza + '.png'), fullPage: true });
        await pagina.evaluate(function () { var n = document.getElementById('navigazione'); if (n) n.style.position = ''; });
        if (s.dopo) await s.dopo(pagina, { porta: PORTA, attendi: attendiFine });
        fatte++;
      }
      erroriPagina.forEach(function (e) { tuttiProblemi.push('errore JavaScript @' + larghezza + 'px: ' + e); });
      await contesto.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('Screenshot fatti: ' + fatte + ' (cartella prove/screenshot)');
  if (tuttiProblemi.length) {
    console.error('✗ Problemi di impaginazione: ' + tuttiProblemi.length);
    tuttiProblemi.forEach(function (p) { console.error('  • ' + p); });
    process.exitCode = 1;
  } else {
    console.log('✓ Nessun testo esce da pulsanti o riquadri.');
  }
}

module.exports = { scriviPin: scriviPin, attendiFine: attendiFine, playwright: playwright, controllaTestiFuori: controllaTestiFuori };

if (require.main === module) {
  principale().catch(function (e) { console.error(e); process.exit(1); });
}
