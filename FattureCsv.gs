/**
 * Bar - Spese & Cassa: lettura dei file CSV del portale "Fatture e Corrispettivi".
 *
 * Il CSV ha una riga per fattura, con colonne separate da punto e virgola:
 * Tipo fattura; Tipo documento; Numero fattura / Documento; Data emissione;
 * Data trasmissione; Codice fiscale fornitore; Partita IVA fornitore;
 * Denominazione fornitore; Codice fiscale cliente; Partita IVA cliente;
 * Denominazione cliente; Imponibile/Importo; Imposta; Sdi/file; …
 *
 * Le colonne si riconoscono per NOME (non per posizione). Le funzioni di
 * questo file non toccano il foglio: restituiscono le fatture lette e il
 * resoconto; la scrittura è in elaboraFileFattura_() (Fatture.gs).
 */

var INTESTAZIONI_CSV = {
  tipoFattura: /^tipo fattura/,
  tipoDocumento: /^tipo documento/,
  numero: /^numero/,
  data: /^data emissione/,
  cfFornitore: /^(codice fiscale|cod\.? ?fisc\.?) fornitore/,
  pivaFornitore: /^(partita iva|p\.? ?iva) fornitore/,
  denFornitore: /^denominazione fornitore/,
  cfCliente: /^(codice fiscale|cod\.? ?fisc\.?) cliente/,
  pivaCliente: /^(partita iva|p\.? ?iva) cliente/,
  denCliente: /^denominazione cliente/,
  imponibile: /^imponibile/,
  imposta: /^imposta/
};
// Senza queste colonne il file non è un elenco di fatture del portale.
var COLONNE_CSV_OBBLIGATORIE = ['numero', 'data', 'imponibile', 'denFornitore'];
var NOMI_COLONNE_CSV = {
  numero: 'Numero fattura', data: 'Data emissione', imponibile: 'Imponibile/Importo',
  denFornitore: 'Denominazione fornitore'
};

// ---------------------------------------------------------------------------
// Testo e codifica
// ---------------------------------------------------------------------------

/** Byte (0…255) di un file CSV → testo: UTF-8 (con o senza BOM) oppure, se non lo è, Windows-1252/ISO-8859-1. */
function byteCsvATesto_(byte) {
  var inizio = (byte.length >= 3 && byte[0] === 0xEF && byte[1] === 0xBB && byte[2] === 0xBF) ? 3 : 0;
  var conSegno = [];
  for (var i = inizio; i < byte.length; i++) conSegno.push(byte[i] > 127 ? byte[i] - 256 : byte[i]);
  var testo = Utilities.newBlob(conSegno).getDataAsString('UTF-8');
  if (testo.indexOf('�') >= 0) {
    // Non è UTF-8 valido: è la codifica "vecchia" di Windows (le lettere accentate sono singoli byte).
    testo = Utilities.newBlob(conSegno).getDataAsString('windows-1252');
  }
  return testo.replace(/^﻿/, '');
}

/**
 * Testo CSV → righe di celle. Gestisce campi tra virgolette (anche con ";", a capo
 * e "" dentro), righe vuote e fine riga \r\n, \n o \r. Il separatore è quello più
 * usato nella prima riga tra ";" "," e tabulazione (predefinito ";").
 */
function leggiCsv_(testo) {
  var t = String(testo === undefined || testo === null ? '' : testo);
  var primaRiga = t.split(/\r\n|\n|\r/)[0] || '';
  var separatore = ';';
  var conteggi = { ';': 0, ',': 0, '\t': 0 };
  var inVirgolette = false;
  for (var k = 0; k < primaRiga.length; k++) {
    var ch = primaRiga.charAt(k);
    if (ch === '"') inVirgolette = !inVirgolette;
    else if (!inVirgolette && conteggi[ch] !== undefined) conteggi[ch]++;
  }
  if (conteggi[';'] === 0 && conteggi['\t'] > 0 && conteggi['\t'] >= conteggi[',']) separatore = '\t';
  else if (conteggi[';'] === 0 && conteggi[','] > 0) separatore = ',';

  var righe = [];
  var riga = [];
  var campo = '';
  var chiuso = true; // true = non siamo dentro virgolette
  var campoQuotato = false;
  var numeroRiga = 1;
  var numeriRighe = []; // numero di riga del file per ogni riga letta (per i messaggi d'errore)
  var inizioRiga = 1;
  var chiudiCampo = function () {
    riga.push(campoQuotato ? campo : campo.replace(/^\s+|\s+$/g, ''));
    campo = '';
    campoQuotato = false;
  };
  var chiudiRiga = function () {
    chiudiCampo();
    var vuota = riga.every(function (c) { return !String(c).replace(/\s+/g, ''); });
    if (!vuota) {
      righe.push(riga);
      numeriRighe.push(inizioRiga);
    }
    riga = [];
  };
  for (var i = 0; i < t.length; i++) {
    var c = t.charAt(i);
    if (!chiuso) {
      if (c === '"') {
        if (t.charAt(i + 1) === '"') { campo += '"'; i++; } else { chiuso = true; }
      } else {
        if (c === '\n') numeroRiga++;
        campo += c;
      }
    } else if (c === '"' && campo.replace(/\s+/g, '') === '') {
      chiuso = false;
      campoQuotato = true;
      campo = '';
    } else if (c === separatore) {
      chiudiCampo();
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && t.charAt(i + 1) === '\n') i++;
      chiudiRiga();
      numeroRiga++;
      inizioRiga = numeroRiga;
    } else {
      campo += c;
    }
  }
  if (campo !== '' || riga.length) chiudiRiga();
  righe.numeriRighe = numeriRighe;
  return righe;
}

// ---------------------------------------------------------------------------
// Valori: date, importi, partite IVA, tipi documento
// ---------------------------------------------------------------------------

/** Minuscolo, senza accenti e con gli spazi ridotti a uno (per riconoscere le intestazioni). */
function normalizzaIntestazione_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/^﻿/, '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** gg/mm/aaaa o aaaa-mm-gg (anche con l'ora dopo) → Date; null se non valida. */
function dataCsv_(testo) {
  var s = String(testo === undefined || testo === null ? '' : testo).trim().split(/[ T]/)[0];
  return s ? leggiData_(s) : null;
}

/**
 * "1.234,56", "1234,56", "1,234.56", "1234.56", "-12,5", "(12,50)", "€ 12,50" → numero (2 decimali).
 * '' se la cella è vuota (valore 0); null se non è un importo.
 * Un solo punto seguito da esattamente tre cifre ("1.234") vale come migliaia, all'italiana.
 */
function importoCsv_(valore) {
  var s = String(valore === undefined || valore === null ? '' : valore).replace(/[€\s ]/g, '');
  if (!s) return '';
  var negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.substring(1, s.length - 1); }
  if (/^[-−–]/.test(s)) { negativo = !negativo; s = s.substring(1); } else if (s.charAt(0) === '+') s = s.substring(1);
  if (/-$/.test(s)) { negativo = !negativo; s = s.substring(0, s.length - 1); }
  var ultimaVirgola = s.lastIndexOf(',');
  var ultimoPunto = s.lastIndexOf('.');
  if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
    // Il simbolo che sta più a destra è il decimale, l'altro separa le migliaia.
    if (ultimaVirgola > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaVirgola >= 0) {
    if ((s.match(/,/g) || []).length > 1) return null;
    s = s.replace(',', '.');
  } else if (ultimoPunto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var n = Math.round(parseFloat(s) * 100) / 100;
  if (n >= 100000000) return null;
  return negativo ? -n : n;
}

/** Partita IVA come nell'importazione XML: senza "IT", con lo zero iniziale che Excel può aver tolto. */
function pivaCsv_(testo) {
  var p = normalizzaPiva_(testo);
  if (/^IT\d{11}$/.test(p)) p = p.substring(2);
  if (/^\d{10}$/.test(p)) p = '0' + p;
  return p;
}

/** "Fattura / Autofattura", "TD04", "TD04 - Nota di credito" … → codice TDxx (o '' se non riconosciuto). */
function codiceTipoDocumento_(testo) {
  var t = String(testo === undefined || testo === null ? '' : testo);
  var m = /TD\s?(\d{2})/i.exec(t);
  if (m) return 'TD' + m[1];
  var n = normalizzaIntestazione_(t);
  if (/nota (di )?credito|nota accredito/.test(n)) return 'TD04';
  if (/nota (di )?debito/.test(n)) return 'TD05';
  if (/^fattura$|^fattura (elettronica|differita|immediata)/.test(n)) return 'TD01';
  return '';
}

// ---------------------------------------------------------------------------
// Lettura delle fatture
// ---------------------------------------------------------------------------

/** Trova la riga delle intestazioni (tra le prime 15) e la posizione di ogni colonna. */
function trovaIntestazioniCsv_(righe) {
  var migliore = null;
  for (var r = 0; r < Math.min(righe.length, 15); r++) {
    var colonne = {};
    righe[r].forEach(function (cella, i) {
      var nome = normalizzaIntestazione_(cella);
      Object.keys(INTESTAZIONI_CSV).forEach(function (chiave) {
        if (colonne[chiave] === undefined && INTESTAZIONI_CSV[chiave].test(nome)) colonne[chiave] = i;
      });
    });
    var mancano = COLONNE_CSV_OBBLIGATORIE.filter(function (k) { return colonne[k] === undefined; });
    if (!mancano.length) return { riga: r, colonne: colonne, numeroColonne: righe[r].length };
    var riconosciute = Object.keys(colonne).length;
    if (!migliore || riconosciute > migliore.riconosciute) migliore = { riconosciute: riconosciute, mancano: mancano };
  }
  return { riga: -1, mancano: migliore ? migliore.mancano : COLONNE_CSV_OBBLIGATORIE };
}

/**
 * Testo di un CSV del portale → { fatture, emesse, errori, righeLette }.
 * fatture: [{ data, numero, fornitore, piva, tipo, imponibile, iva, totale }] (solo ricevute);
 * emesse: quante righe sono fatture emesse (saltate); errori: ["riga 7: …"].
 * Lancia un errore se il file non è un elenco di fatture riconoscibile.
 */
function leggiFattureCsv_(testo) {
  var righe = leggiCsv_(testo);
  if (!righe.length) throw new Error('il file CSV è vuoto');
  var intest = trovaIntestazioniCsv_(righe);
  if (intest.riga < 0) {
    throw new Error('non riconosco le colonne del CSV (mancano: ' +
      intest.mancano.map(function (k) { return NOMI_COLONNE_CSV[k]; }).join(', ') + ')');
  }
  var col = intest.colonne;
  var cella = function (r, chiave) {
    return col[chiave] === undefined || col[chiave] >= r.length ? '' : String(r[col[chiave]]).trim();
  };
  var dati = [];
  var numeriRighe = righe.numeriRighe || [];
  for (var i = intest.riga + 1; i < righe.length; i++) dati.push({ celle: righe[i], numero: numeriRighe[i] || (i + 1) });

  // Il bar è l'identità (P.IVA e codice fiscale) presente nel maggior numero di righe, come cliente
  // (fatture ricevute) o come fornitore (fatture emesse). A parità conta chi è più spesso cliente.
  // Serve a riconoscere le fatture emesse quando "Tipo fattura" non lo dice.
  var identita = function (r, lato) {
    return [pivaCsv_(cella(r, 'piva' + lato)), normalizzaPiva_(cella(r, 'cf' + lato))].filter(function (x) { return x; });
  };
  var righeConIdentita = {};
  var comeCliente = {};
  dati.forEach(function (d) {
    var viste = {};
    identita(d.celle, 'Cliente').forEach(function (x) { viste[x] = true; comeCliente[x] = (comeCliente[x] || 0) + 1; });
    identita(d.celle, 'Fornitore').forEach(function (x) { viste[x] = true; });
    Object.keys(viste).forEach(function (x) { righeConIdentita[x] = (righeConIdentita[x] || 0) + 1; });
  });
  var nomi = Object.keys(righeConIdentita);
  var massimo = Math.max.apply(null, nomi.map(function (x) { return righeConIdentita[x]; }).concat([0]));
  var piuFrequenti = nomi.filter(function (x) { return righeConIdentita[x] === massimo; });
  var massimoCliente = Math.max.apply(null, piuFrequenti.map(function (x) { return comeCliente[x] || 0; }).concat([0]));
  var bar = {};
  // Con una sola riga, o se nessuno dei più frequenti è mai cliente, non si può dedurre chi è il bar.
  if (dati.length >= 2 || massimoCliente > 0) {
    piuFrequenti.forEach(function (x) { if ((comeCliente[x] || 0) === massimoCliente) bar[x] = true; });
  }
  var eDelBar = function (elenco) { return elenco.some(function (x) { return bar[x]; }); };

  var risultato = { fatture: [], emesse: 0, errori: [], righeLette: dati.length };
  dati.forEach(function (d) {
    var r = d.celle;
    var etichetta = 'riga ' + d.numero;
    if (r.length < intest.numeroColonne) {
      risultato.errori.push(etichetta + ': mancano delle colonne (riga incompleta o rovinata)');
      return;
    }
    if (r.length > intest.numeroColonne && r.slice(intest.numeroColonne).some(function (c) { return String(c).trim(); })) {
      risultato.errori.push(etichetta + ': ci sono colonne in più (un ";" dentro un testo senza virgolette?)');
      return;
    }

    // Emessa o ricevuta?
    var tipoFattura = normalizzaIntestazione_(cella(r, 'tipoFattura'));
    var emessa;
    if (/emess/.test(tipoFattura)) emessa = true;
    else if (/ricev/.test(tipoFattura)) emessa = false;
    else {
      emessa = eDelBar(identita(r, 'Fornitore')) && !eDelBar(identita(r, 'Cliente'));
    }
    if (emessa) {
      risultato.emesse++;
      return;
    }

    var numero = cella(r, 'numero');
    if (!numero) { risultato.errori.push(etichetta + ': manca il numero della fattura'); return; }
    var data = dataCsv_(cella(r, 'data'));
    if (!data) { risultato.errori.push(etichetta + ': la data di emissione "' + cella(r, 'data') + '" non è valida'); return; }
    var imponibile = importoCsv_(cella(r, 'imponibile'));
    var imposta = importoCsv_(cella(r, 'imposta'));
    if (imponibile === null || imponibile === '') {
      risultato.errori.push(etichetta + ': l\'importo "' + cella(r, 'imponibile') + '" non è valido');
      return;
    }
    if (imposta === null) {
      risultato.errori.push(etichetta + ': l\'imposta "' + cella(r, 'imposta') + '" non è valida');
      return;
    }
    if (imposta === '') imposta = 0;
    var piva = pivaCsv_(cella(r, 'pivaFornitore')) || normalizzaPiva_(cella(r, 'cfFornitore'));
    var fornitore = cella(r, 'denFornitore') || (piva ? 'Fornitore ' + piva : '');
    if (!fornitore) { risultato.errori.push(etichetta + ': manca il fornitore'); return; }

    // Note di credito: importi negativi. Se il file li ha già negativi non si inverte due volte.
    var codice = codiceTipoDocumento_(cella(r, 'tipoDocumento')) || codiceTipoDocumento_(cella(r, 'tipoFattura')) || 'TD01';
    if (codice === 'TD04') {
      imponibile = -Math.abs(imponibile);
      imposta = -Math.abs(imposta);
    }
    risultato.fatture.push({
      data: data,
      numero: numero,
      fornitore: fornitore,
      piva: piva,
      tipo: codice,
      imponibile: arrotonda_(imponibile),
      iva: arrotonda_(imposta),
      totale: arrotonda_(imponibile + imposta),
      scadenza: null
    });
  });
  return risultato;
}
