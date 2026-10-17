/**
 * Bar - Spese & Cassa: andamento e confronti per i grafici del Riepilogo e
 * per il report mensile.
 *
 * calcolaAndamento_() è una funzione "pura" (riceve gli elenchi, non legge il
 * foglio): viene provata da testAndamento() in TestAndamento.gs.
 */

var MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
var GIORNI_BREVI = ['', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/** Anno e mese spostati di "passo" mesi (anche negativi). */
function spostaMese_(anno, mese, passo) {
  var totale = anno * 12 + (mese - 1) + passo;
  return { anno: Math.floor(totale / 12), mese: (totale % 12) + 1 };
}

/**
 * spese: [{data, importo}] (senza fattura), fatture: [{data, totale}],
 * chiusure: [{data, totale}]. anno/mese: il mese scelto (l'ultimo dei 12).
 * finoAlGiorno: se > 0, per il mese scelto e per i confronti si contano solo i
 * giorni fino a quello (per confrontare un mese in corso alla pari).
 */
function calcolaAndamento_(spese, fatture, chiusure, anno, mese, finoAlGiorno) {
  var perMese = {};
  var vuoto = function (chiave) {
    if (!perMese[chiave]) perMese[chiave] = { spese: 0, incassi: 0, giorniChiusura: 0, speseParziali: 0, incassiParziali: 0 };
    return perMese[chiave];
  };
  var giornoDi = function (d) { return Number(Utilities.formatDate(d, FUSO, 'd')); };
  var aggiungi = function (elenco, campo, quale) {
    elenco.forEach(function (x) {
      if (!x.data) return;
      var m = vuoto(Utilities.formatDate(x.data, FUSO, 'yyyy-MM'));
      var valore = Number(x[campo]) || 0;
      m[quale] += valore;
      if (!finoAlGiorno || giornoDi(x.data) <= finoAlGiorno) m[quale + 'Parziali'] += valore;
      if (quale === 'incassi') m.giorniChiusura++;
    });
  };
  aggiungi(spese, 'importo', 'spese');
  aggiungi(fatture, 'totale', 'spese');
  aggiungi(chiusure, 'totale', 'incassi');

  var mesi = [];
  for (var k = -11; k <= 0; k++) {
    var am = spostaMese_(anno, mese, k);
    var chiave = chiaveMese_(am.anno, am.mese);
    var dati = perMese[chiave] || vuoto(chiave);
    mesi.push({
      chiave: chiave,
      breve: MESI_BREVI[am.mese - 1],
      nome: MESI[am.mese - 1] + ' ' + am.anno,
      spese: arrotonda_(dati.spese),
      incassi: arrotonda_(dati.incassi)
    });
  }

  var periodo = function (passo, etichetta) {
    var am = spostaMese_(anno, mese, passo);
    var dati = perMese[chiaveMese_(am.anno, am.mese)] || vuoto(chiaveMese_(am.anno, am.mese));
    return {
      etichetta: etichetta,
      nome: MESI[am.mese - 1] + ' ' + am.anno,
      spese: arrotonda_(finoAlGiorno ? dati.speseParziali : dati.spese),
      incassi: arrotonda_(finoAlGiorno ? dati.incassiParziali : dati.incassi)
    };
  };
  var confronto = [periodo(0, 'Questo mese'), periodo(-1, 'Il mese prima'), periodo(-12, 'Lo stesso mese dell\'anno scorso')];
  var variazione = function (attuale, prima) {
    if (!prima) return null;
    return Math.round((attuale - prima) / Math.abs(prima) * 100);
  };
  confronto.forEach(function (c, i) {
    if (i === 0) return;
    c.variazioneIncassi = variazione(confronto[0].incassi, c.incassi);
    c.variazioneSpese = variazione(confronto[0].spese, c.spese);
  });

  // Incasso medio per giorno della settimana (chiusure degli ultimi 12 mesi)
  var primo = mesi[0].chiave;
  var ultimo = mesi[mesi.length - 1].chiave;
  var somme = [0, 0, 0, 0, 0, 0, 0, 0];
  var conteggi = [0, 0, 0, 0, 0, 0, 0, 0];
  chiusure.forEach(function (c) {
    if (!c.data) return;
    var m = Utilities.formatDate(c.data, FUSO, 'yyyy-MM');
    if (m < primo || m > ultimo) return;
    var g = Number(Utilities.formatDate(c.data, FUSO, 'u'));
    somme[g] += Number(c.totale) || 0;
    conteggi[g]++;
  });
  var settimana = [];
  for (var g = 1; g <= 7; g++) {
    settimana.push({
      breve: GIORNI_BREVI[g],
      nome: GIORNI_SETTIMANA[g],
      media: conteggi[g] ? arrotonda_(somme[g] / conteggi[g]) : 0,
      giorni: conteggi[g]
    });
  }

  return {
    mesi: mesi,
    confronto: confronto,
    finoAlGiorno: finoAlGiorno || 0,
    settimana: settimana,
    massimoMesi: Math.max.apply(null, mesi.map(function (m) { return Math.max(m.spese, m.incassi); }).concat([0])),
    massimoSettimana: Math.max.apply(null, settimana.map(function (s) { return s.media; }).concat([0]))
  };
}

/** "+12%", "−5%", "uguale" (null = non confrontabile). */
function testoVariazione_(v) {
  if (v === null || v === undefined) return '–';
  if (v === 0) return 'uguale';
  return (v > 0 ? '+' : '−') + Math.abs(v) + '%';
}

// ---------------------------------------------------------------------------
// Parti del report mensile (HTML per email: solo tabelle, niente CSS esterno)
// ---------------------------------------------------------------------------

var COLORE_INCASSI = '#1f6fd1';
var COLORE_SPESE = '#c46a12';

/** Barra orizzontale "da email": una tabella con una cella colorata larga in percentuale. */
function barraEmail_(valore, massimo, colore) {
  var perc = massimo > 0 ? Math.max(0, Math.round(valore / massimo * 100)) : 0;
  if (!perc) return '';
  return '<table style="border-collapse:collapse;width:100%;"><tr><td style="width:' + perc + '%;height:8px;background:' +
    colore + ';border-radius:0 4px 4px 0;font-size:1px;line-height:1px;">&nbsp;</td><td style="font-size:1px;">&nbsp;</td></tr></table>';
}

function htmlAndamento_(a) {
  var stileTd = 'padding:6px 10px;border-bottom:1px solid #ddd;vertical-align:top;';
  var legenda = '<p style="margin:4px 0 8px 0;font-size:13px;color:#555;">' +
    '<span style="display:inline-block;width:10px;height:10px;background:' + COLORE_INCASSI + ';border-radius:2px;"></span> Incassi &nbsp; ' +
    '<span style="display:inline-block;width:10px;height:10px;background:' + COLORE_SPESE + ';border-radius:2px;"></span> Spese (senza fattura + fatture)</p>';

  var h = '<h2 style="margin:28px 0 0 0;font-size:19px;">Confronti</h2>';
  if (a.finoAlGiorno) {
    h += '<p style="color:#555;font-size:13px;margin:4px 0;">Per ogni mese sono contati solo i giorni dall\'1 al ' + a.finoAlGiorno + '.</p>';
  }
  h += legenda;
  var massimo = Math.max.apply(null, a.confronto.map(function (c) { return Math.max(c.spese, c.incassi); }).concat([0]));
  h += '<table style="border-collapse:collapse;min-width:320px;max-width:640px;width:100%;font-size:15px;">';
  a.confronto.forEach(function (c, i) {
    h += '<tr><td style="' + stileTd + '"><b>' + esc_(c.etichetta) + '</b><br><span style="color:#555;">' + esc_(c.nome) + '</span>' +
      '<div style="margin-top:6px;">Incassi ' + formatoEuro_(c.incassi) +
      (i ? ' <span style="color:#555;font-size:13px;">(questo mese: ' + testoVariazione_(c.variazioneIncassi) + ')</span>' : '') + '</div>' +
      barraEmail_(c.incassi, massimo, COLORE_INCASSI) +
      '<div style="margin-top:4px;">Spese ' + formatoEuro_(c.spese) +
      (i ? ' <span style="color:#555;font-size:13px;">(questo mese: ' + testoVariazione_(c.variazioneSpese) + ')</span>' : '') + '</div>' +
      barraEmail_(c.spese, massimo, COLORE_SPESE) + '</td></tr>';
  });
  h += '</table>';

  h += '<h3 style="margin:22px 0 8px 0;font-size:17px;">Ultimi 12 mesi</h3>' + legenda;
  h += '<table style="border-collapse:collapse;min-width:320px;max-width:640px;width:100%;font-size:14px;">';
  a.mesi.forEach(function (m) {
    h += '<tr><td style="' + stileTd + 'white-space:nowrap;width:90px;">' + esc_(m.nome) + '</td><td style="' + stileTd + 'width:55%;">' +
      barraEmail_(m.incassi, a.massimoMesi, COLORE_INCASSI) + '<div style="height:3px;font-size:1px;">&nbsp;</div>' +
      barraEmail_(m.spese, a.massimoMesi, COLORE_SPESE) + '</td><td style="' + stileTd + 'text-align:right;white-space:nowrap;">' +
      formatoEuro_(m.incassi) + '<br><span style="color:#555;">' + formatoEuro_(m.spese) + '</span></td></tr>';
  });
  h += '</table>';

  h += '<h3 style="margin:22px 0 8px 0;font-size:17px;">Incasso medio per giorno della settimana (ultimi 12 mesi)</h3>';
  h += '<table style="border-collapse:collapse;min-width:320px;max-width:640px;width:100%;font-size:14px;">';
  a.settimana.forEach(function (s) {
    h += '<tr><td style="' + stileTd + 'width:90px;">' + esc_(s.nome) + '</td><td style="' + stileTd + 'width:55%;">' +
      barraEmail_(s.media, a.massimoSettimana, COLORE_INCASSI) + '</td><td style="' + stileTd + 'text-align:right;white-space:nowrap;">' +
      (s.giorni ? formatoEuro_(s.media) + ' <span style="color:#555;font-size:12px;">(' + s.giorni + ' gg)</span>' : '–') + '</td></tr>';
  });
  return h + '</table>';
}
