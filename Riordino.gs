/**
 * Bar - Spese & Cassa: lista "Da ordinare" condivisa.
 *
 * Scheda "Prodotti": un prodotto per riga (nome, fornitore, unità). Le colonne
 * "Da ordinare" e "Quantità" sono la lista condivisa: chi apre l'app vede
 * quello che hanno segnato gli altri. Per ogni fornitore l'app prepara il
 * messaggio d'ordine (in Script.html) e lo apre in WhatsApp (link wa.me con il
 * numero preso dalla colonna "Telefono WhatsApp" della scheda Fornitori).
 */

var SCHEDA_PRODOTTI = 'Prodotti';
var INTESTAZIONI_PRODOTTI = ['Prodotto', 'Fornitore', 'Unità', 'Da ordinare (SI/NO)', 'Quantità', 'Segnato da',
  'Aggiornato il', 'ID', 'Unità plurale'];
var PR_NOME = 1, PR_FORNITORE = 2, PR_UNITA = 3, PR_DA_ORDINARE = 4, PR_QUANTITA = 5, PR_SEGNATO_DA = 6,
  PR_AGGIORNATO = 7, PR_ID = 8, PR_UNITA_PLURALE = 9;
var COL_FORNITORI_TELEFONO = 4;
var SENZA_FORNITORE = 'Senza fornitore';

function preparaSchedaProdotti_(ss) {
  var s = preparaScheda_(ss, SCHEDA_PRODOTTI, INTESTAZIONI_PRODOTTI);
  s.getRange('G:G').setNumberFormat(FORMATO_DATA_ORA);
  s.getRange('H:H').setNumberFormat('@');
  s.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['SI', 'NO'], true).setAllowInvalid(true).build());
  s.setColumnWidth(1, 240);
  s.setColumnWidth(2, 220);
  s.setColumnWidth(4, 150);
}

// ---------------------------------------------------------------------------
// Funzioni "pure" (provate da prove/test-riordino.js)
// ---------------------------------------------------------------------------

/**
 * Numero per WhatsApp: solo cifre con il prefisso internazionale, senza "+".
 * "333 123 4567" → "393331234567"; "+39 0471 123456" → "390471123456";
 * "0041 79 1234567" → "41791234567". '' se il numero non sembra valido.
 */
function numeroWhatsApp_(telefono) {
  // Se la cella era in formato numero, Fogli ha tolto lo 0 iniziale dei numeri fissi
  // (0471… → 471…): i cellulari italiani iniziano con 3, quindi lo rimetto.
  if (typeof telefono === 'number') {
    telefono = String(telefono);
    if (/^[1-24-9]\d{5,9}$/.test(telefono)) telefono = '0' + telefono;
  }
  var t = String(telefono === undefined || telefono === null ? '' : telefono).replace(/^'/, '').trim();
  var piu = t.charAt(0) === '+';
  var cifre = t.replace(/\D/g, '');
  if (!cifre) return '';
  if (/^00/.test(cifre)) {
    cifre = cifre.substring(2);
  } else if (!piu && !(/^39/.test(cifre) && cifre.length >= 11)) {
    // Numero italiano scritto senza prefisso (cellulare 3xx o fisso 0xx)
    cifre = '39' + cifre;
  }
  return cifre.length >= 10 && cifre.length <= 15 ? cifre : '';
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

function leggiProdotti_() {
  var s = scheda_(SCHEDA_PRODOTTI);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_PRODOTTI.length).getValues().map(function (r, i) {
    var q = leggiImporto_(r[PR_QUANTITA - 1]);
    return {
      riga: i + 2,
      nome: String(r[PR_NOME - 1]).replace(/^'/, '').trim(),
      fornitore: String(r[PR_FORNITORE - 1]).replace(/^'/, '').trim(),
      unita: String(r[PR_UNITA - 1]).replace(/^'/, '').trim(),
      unitaPlurale: String(r[PR_UNITA_PLURALE - 1]).replace(/^'/, '').trim(),
      daOrdinare: /^(SI|SÌ|S|X|TRUE)$/i.test(String(r[PR_DA_ORDINARE - 1]).trim()) || r[PR_DA_ORDINARE - 1] === true,
      quantita: q && q > 0 ? q : 0,
      segnatoDa: String(r[PR_SEGNATO_DA - 1]).replace(/^'/, ''),
      id: String(r[PR_ID - 1] || '')
    };
  }).filter(function (p) { return p.nome; });
}

/** Telefoni WhatsApp dei fornitori (nome in minuscolo → numero). */
function telefoniFornitori_() {
  var s = scheda_(SCHEDA_FORNITORI);
  var risultato = {};
  if (s.getLastRow() < 2) return risultato;
  s.getRange(2, 1, s.getLastRow() - 1, COL_FORNITORI_TELEFONO).getValues().forEach(function (r) {
    var nome = String(r[0]).replace(/^'/, '').trim().toLowerCase();
    if (nome) risultato[nome] = numeroWhatsApp_(r[COL_FORNITORI_TELEFONO - 1]);
  });
  return risultato;
}

/** I prodotti senza ID (scritti a mano nel foglio) ricevono un ID. */
function assicuraIdProdotti_(prodotti) {
  var senza = prodotti.filter(function (p) { return !p.id; });
  if (!senza.length) return;
  var s = scheda_(SCHEDA_PRODOTTI);
  senza.forEach(function (p) {
    p.id = 'P' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
    s.getRange(p.riga, PR_ID).setValue(p.id);
  });
}

/** Tutto quello che serve alla schermata "Da ordinare". */
function statoRiordino_() {
  var prodotti = leggiProdotti_();
  assicuraIdProdotti_(prodotti);
  var telefoni = telefoniFornitori_();
  var numeri = {};
  prodotti.forEach(function (p) {
    if (p.fornitore) numeri[p.fornitore] = telefoni[p.fornitore.toLowerCase()] || '';
  });
  return {
    ok: true,
    prodotti: prodotti.map(function (p) {
      return {
        id: p.id, nome: p.nome, fornitore: p.fornitore, unita: p.unita, unitaPlurale: p.unitaPlurale,
        daOrdinare: p.daOrdinare, quantita: p.quantita, segnatoDa: p.segnatoDa
      };
    }).sort(function (a, b) {
      return confrontaTesti_(a.fornitore || 'zzz', b.fornitore || 'zzz') || confrontaTesti_(a.nome, b.nome);
    }),
    numeri: numeri,
    fornitori: leggiLista_(SCHEDA_FORNITORI).map(function (f) { return f.replace(/^'/, ''); }).sort(confrontaTesti_),
    daOrdinare: prodotti.filter(function (p) { return p.daOrdinare; }).length
  };
}

function contaDaOrdinare_() {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_PRODOTTI)) return 0;
  return leggiProdotti_().filter(function (p) { return p.daOrdinare; }).length;
}

// ---------------------------------------------------------------------------
// Funzioni chiamate dall'app
// ---------------------------------------------------------------------------

function riordino(pin) {
  return esegui_(pin, function () {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return statoRiordino_();
    } finally {
      lock.releaseLock();
    }
  }, 'riordino');
}

/** Mette o toglie un prodotto dalla lista, con la quantità (0 = senza quantità). */
function impostaDaOrdinare(pin, id, daOrdinare, quantita, persona) {
  return esegui_(pin, function () {
    var q = quantita === '' || quantita === null || quantita === undefined ? 0 : leggiImporto_(quantita);
    if (q === null || q < 0 || q > 9999) return errore_('Quantità non valida.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var s = scheda_(SCHEDA_PRODOTTI);
      var riga = trovaRiga_(s, PR_ID, id);
      if (!riga) return errore_('Prodotto non trovato: forse è stato tolto dal foglio.');
      s.getRange(riga, PR_DA_ORDINARE, 1, 4).setValues([[
        daOrdinare ? 'SI' : '', daOrdinare && q ? q : '', daOrdinare ? pulisci_(persona, 40) : '', new Date()
      ]]);
      return statoRiordino_();
    } finally {
      lock.releaseLock();
    }
  }, 'impostaDaOrdinare');
}

/** Nuovo prodotto (facoltativo: subito nella lista da ordinare). */
function nuovoProdotto(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var nome = pulisci_(dati.nome, 80);
    if (!nome) return errore_('Scrivi il nome del prodotto.');
    var fornitore = pulisci_(dati.fornitore, 80);
    var unita = pulisci_(dati.unita, 20);
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var esistenti = leggiProdotti_();
      var doppione = esistenti.filter(function (p) {
        return p.nome.toLowerCase() === nome.replace(/^'/, '').toLowerCase() &&
          p.fornitore.toLowerCase() === fornitore.replace(/^'/, '').toLowerCase();
      });
      if (doppione.length) return errore_('Questo prodotto c\'è già nell\'elenco.');
      scheda_(SCHEDA_PRODOTTI).appendRow([nome, fornitore, unita, dati.daOrdinare ? 'SI' : '', '',
        dati.daOrdinare ? pulisci_(dati.persona, 40) : '', new Date(),
        'P' + Utilities.getUuid().replace(/-/g, '').substring(0, 10)]);
      if (fornitore) aggiungiFornitore_(fornitore);
      return statoRiordino_();
    } finally {
      lock.releaseLock();
    }
  }, 'nuovoProdotto');
}

/** Dopo aver mandato l'ordine: toglie dalla lista tutti i prodotti di quel fornitore. */
function svuotaOrdine(pin, fornitore) {
  return esegui_(pin, function () {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var s = scheda_(SCHEDA_PRODOTTI);
      var nome = String(fornitore || '');
      leggiProdotti_().forEach(function (p) {
        var suo = (p.fornitore || SENZA_FORNITORE) === nome;
        if (suo && p.daOrdinare) s.getRange(p.riga, PR_DA_ORDINARE, 1, 4).setValues([['', '', '', new Date()]]);
      });
      return statoRiordino_();
    } finally {
      lock.releaseLock();
    }
  }, 'svuotaOrdine');
}
