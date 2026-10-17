/**
 * Bar - Spese & Cassa: costo e margine dei prodotti venduti.
 *
 * Scheda "Ricette/Costi": prodotto, prezzo d'acquisto (scritto a mano, NON preso dalle
 * fatture), unità d'acquisto (kg, l, pezzo), quantità per porzione (g, ml o pezzi), prezzo di
 * vendita IVA inclusa e IVA. Per ogni prodotto l'app calcola:
 *   costo per porzione = prezzo d'acquisto ÷ (1000 se kg/l) × quantità per porzione
 *   prezzo netto       = prezzo di vendita ÷ (1 + IVA)
 *   margine €          = prezzo netto − costo per porzione
 *   margine %          = margine € ÷ prezzo netto
 *   food cost %        = costo per porzione ÷ prezzo netto
 * Schermata "Margini" con avviso se il margine è sotto la soglia di Impostazioni.
 *
 * calcolaMargine_() è una funzione "pura", provata da testMargini().
 */

var SCHEDA_RICETTE = 'Ricette/Costi';
var SCHEDA_RICETTE_ALTERNATIVA = 'Ricette e costi'; // se Fogli non accettasse la "/" nel nome
var INTESTAZIONI_RICETTE = ['Prodotto', 'Prezzo d\'acquisto (€)', 'Unità d\'acquisto (kg, l, pezzo)',
  'Quantità per porzione (g, ml o pezzi)', 'Prezzo di vendita (€, IVA inclusa)', 'IVA (%)', 'Note', 'ID'];
var RI_NOME = 1, RI_PREZZO = 2, RI_UNITA = 3, RI_QUANTITA = 4, RI_VENDITA = 5, RI_IVA = 6, RI_NOTE = 7, RI_ID = 8;
var MARGINE_MINIMO_PREDEFINITO = 60;
var IVA_PREDEFINITA = 10;

function schedaRicette_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SCHEDA_RICETTE) || ss.getSheetByName(SCHEDA_RICETTE_ALTERNATIVA);
}

function preparaSchedaRicette_(ss) {
  var s = ss.getSheetByName(SCHEDA_RICETTE) || ss.getSheetByName(SCHEDA_RICETTE_ALTERNATIVA);
  if (!s) {
    try {
      s = preparaScheda_(ss, SCHEDA_RICETTE, INTESTAZIONI_RICETTE);
    } catch (e) {
      console.warn('Nome "' + SCHEDA_RICETTE + '" non accettato, uso "' + SCHEDA_RICETTE_ALTERNATIVA + '": ' + e);
      s = preparaScheda_(ss, SCHEDA_RICETTE_ALTERNATIVA, INTESTAZIONI_RICETTE);
    }
  } else {
    preparaScheda_(ss, s.getName(), INTESTAZIONI_RICETTE);
  }
  s.getRange('B:B').setNumberFormat('#,##0.00## "€"');
  s.getRange('E:E').setNumberFormat(FORMATO_EURO);
  s.getRange('H:H').setNumberFormat('@');
  s.setColumnWidth(1, 220);
  s.setColumnWidth(2, 150);
  s.setColumnWidth(3, 200);
  s.setColumnWidth(4, 230);
  s.setColumnWidth(5, 220);
  s.setColumnWidth(7, 420);
  if (s.getLastRow() < 2) {
    s.getRange(2, 1, 1, INTESTAZIONI_RICETTE.length).setValues([['Caffè espresso', 18, 'kg', 7, 1.2, 10,
      'ESEMPIO: caffè in grani a 18 € al kg, 7 grammi per tazzina, venduto a 1,20 €. Correggi con i tuoi prezzi.', 'M-caffe']]);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Calcoli (funzioni "pure")
// ---------------------------------------------------------------------------

/** Quante "unità di porzione" ci sono in un'unità d'acquisto: kg → 1000 g, l → 1000 ml, pezzo → 1. */
function fattoreUnita_(unita) {
  var u = String(unita || '').toLowerCase().replace(/[.\s]/g, '');
  if (/^(kg|chilo|chili|chilogrammo|chilogrammi|kilo)$/.test(u)) return 1000;
  if (/^(l|lt|litro|litri)$/.test(u)) return 1000;
  if (/^(cl|centilitro|centilitri)$/.test(u)) return 10;
  return 1; // g, ml, pezzo, confezione, bottiglia…
}

/** Etichetta della quantità per porzione in base all'unità d'acquisto. */
function unitaPorzione_(unita) {
  var f = fattoreUnita_(unita);
  var u = String(unita || '').toLowerCase();
  if (f === 1000 && /^k/.test(u)) return 'g';
  if (f === 1000 || f === 10) return 'ml';
  if (/^g/.test(u)) return 'g';
  if (/^ml/.test(u)) return 'ml';
  return 'pezzi';
}

/**
 * p: { prezzoAcquisto, unita, quantita, prezzoVendita, iva } → { completo, mancano, costo, netto,
 * margine, marginePerc, foodCost } (importi in euro; percentuali con un decimale).
 */
function calcolaMargine_(p) {
  var mancano = [];
  if (!(p.prezzoAcquisto > 0)) mancano.push('prezzo d\'acquisto');
  if (!(p.quantita > 0)) mancano.push('quantità per porzione');
  if (!(p.prezzoVendita > 0)) mancano.push('prezzo di vendita');
  if (mancano.length) return { completo: false, mancano: mancano };
  var iva = p.iva === null || p.iva === undefined || p.iva === '' || isNaN(Number(p.iva)) ? IVA_PREDEFINITA : Number(p.iva);
  var costo = p.prezzoAcquisto / fattoreUnita_(p.unita) * p.quantita;
  var netto = p.prezzoVendita / (1 + iva / 100);
  var margine = netto - costo;
  return {
    completo: true,
    mancano: [],
    iva: iva,
    costo: Math.round(costo * 10000) / 10000,
    netto: Math.round(netto * 10000) / 10000,
    margine: Math.round(margine * 10000) / 10000,
    marginePerc: Math.round(margine / netto * 1000) / 10,
    foodCost: Math.round(costo / netto * 1000) / 10
  };
}

function margineMinimo_() {
  var testo = leggiImpostazione_(IMP_MARGINE_MINIMO);
  var n = testo === '' ? null : Number(String(testo).replace('%', '').replace(',', '.').trim());
  // "60%" scritto nella cella diventa 0,6 per Fogli: lo riporto a 60.
  if (n !== null && n > 0 && n < 1) n = Math.round(n * 1000) / 10;
  return n === null || isNaN(n) || n < 0 || n >= 100 ? MARGINE_MINIMO_PREDEFINITO : n;
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

function leggiRicette_() {
  var s = schedaRicette_();
  if (!s || s.getLastRow() < 2) return [];
  var numero = function (v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    var t = String(v).replace(/[€%\s]/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  };
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_RICETTE.length).getValues().map(function (r, i) {
    return {
      riga: i + 2,
      nome: String(r[RI_NOME - 1]).replace(/^'/, '').trim(),
      prezzoAcquisto: numero(r[RI_PREZZO - 1]),
      unita: String(r[RI_UNITA - 1]).trim() || 'pezzo',
      quantita: numero(r[RI_QUANTITA - 1]),
      prezzoVendita: numero(r[RI_VENDITA - 1]),
      iva: percentualeIva_(numero(r[RI_IVA - 1])),
      note: String(r[RI_NOTE - 1]).replace(/^'/, ''),
      id: String(r[RI_ID - 1] || '')
    };
  }).filter(function (p) { return p.nome; });
}

/** Prodotti con margine calcolato, dal margine più basso; incompleti in fondo. */
function prodottiConMargine_() {
  var soglia = margineMinimo_();
  var prodotti = leggiRicette_();
  var senzaId = prodotti.filter(function (p) { return !p.id; });
  if (senzaId.length) {
    var s = schedaRicette_();
    senzaId.forEach(function (p) {
      p.id = 'M' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
      s.getRange(p.riga, RI_ID).setValue(p.id);
    });
  }
  return prodotti.map(function (p) {
    var m = calcolaMargine_(p);
    return {
      id: p.id, nome: p.nome, prezzoAcquisto: p.prezzoAcquisto, unita: p.unita, unitaPorzione: unitaPorzione_(p.unita),
      quantita: p.quantita, prezzoVendita: p.prezzoVendita, iva: p.iva === null ? IVA_PREDEFINITA : p.iva, note: p.note,
      completo: m.completo, mancano: m.mancano, costo: m.costo, netto: m.netto, margine: m.margine,
      marginePerc: m.marginePerc, foodCost: m.foodCost, sottoSoglia: m.completo && m.marginePerc < soglia
    };
  }).sort(function (a, b) {
    if (a.completo !== b.completo) return a.completo ? -1 : 1;
    return a.completo ? a.marginePerc - b.marginePerc : confrontaTesti_(a.nome, b.nome);
  });
}

function contaMarginiBassi_() {
  if (!schedaRicette_()) return 0;
  return prodottiConMargine_().filter(function (p) { return p.sottoSoglia; }).length;
}

// ---------------------------------------------------------------------------
// Funzioni chiamate dall'app
// ---------------------------------------------------------------------------

function margini(pin) {
  return esegui_(pin, function () {
    return { ok: true, soglia: margineMinimo_(), prodotti: schedaRicette_() ? prodottiConMargine_() : [] };
  }, 'margini');
}

/** Nuovo prodotto (senza id) o modifica di uno esistente. */
function salvaProdottoMargine(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var nome = pulisci_(dati.nome, 80);
    if (!nome) return errore_('Scrivi il nome del prodotto.');
    var prezzo = leggiPrezzo_(dati.prezzoAcquisto);
    if (prezzo === null || prezzo <= 0) return errore_('Il prezzo d\'acquisto non è valido. Esempio: 18,00');
    var quantita = leggiPrezzo_(dati.quantita);
    if (quantita === null || quantita <= 0) return errore_('La quantità per porzione non è valida. Esempio: 7');
    var vendita = leggiImporto_(dati.prezzoVendita);
    if (vendita === null || vendita <= 0) return errore_('Il prezzo di vendita non è valido. Esempio: 1,20');
    var iva = Number(String(dati.iva === undefined || dati.iva === null ? '' : dati.iva).replace(',', '.'));
    if (isNaN(iva) || iva < 0 || iva > 30) return errore_('L\'IVA non è valida.');
    var unita = pulisci_(dati.unita, 20) || 'pezzo';
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var s = schedaRicette_() || preparaSchedaRicette_(SpreadsheetApp.getActiveSpreadsheet());
      var riga = dati.id ? trovaRiga_(s, RI_ID, String(dati.id)) : 0;
      if (dati.id && !riga) return errore_('Questo prodotto non c\'è più nella scheda «' + s.getName() + '».');
      var valori = [nome, prezzo, unita, quantita, vendita, iva];
      if (riga) {
        s.getRange(riga, 1, 1, valori.length).setValues([valori]);
      } else {
        var doppione = leggiRicette_().filter(function (p) { return p.nome.toLowerCase() === nome.replace(/^'/, '').toLowerCase(); });
        if (doppione.length) return errore_('C\'è già un prodotto con questo nome: usa «Modifica».');
        s.appendRow(valori.concat(['', 'M' + Utilities.getUuid().replace(/-/g, '').substring(0, 10)]));
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true, soglia: margineMinimo_(), prodotti: prodottiConMargine_() };
  }, 'salvaProdottoMargine');
}

/** IVA dalla cella: "10%" scritto nel foglio diventa 0,1 → 10. */
function percentualeIva_(n) {
  if (n === null) return null;
  return n > 0 && n < 1 ? Math.round(n * 1000) / 10 : n;
}

/** Come leggiImporto_ ma con più decimali (prezzi al kg come 18,456 o quantità come 7,5). */
function leggiPrezzo_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v === undefined || v === null ? '' : v).replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var n = parseFloat(s);
  return n < 100000 ? Math.round(n * 10000) / 10000 : null;
}
