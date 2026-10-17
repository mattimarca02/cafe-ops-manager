/**
 * Bar - Spese & Cassa: elenco con ricerca e filtri, modifica ed eliminazione
 * di spese e chiusure di cassa (schermata "Cerca e modifica" dell'app).
 */

var MAX_VOCI_ELENCO = 100;

/**
 * Elenco di spese o chiusure filtrate.
 * filtri: { tipo: 'spese'|'chiusure', mese: 'AAAA-MM' (vuoto = tutti),
 *           categoria, pagamento, testo (fornitore, nota o importo) }
 */
function elenco(pin, filtri) {
  return esegui_(pin, function () {
    filtri = filtri || {};
    var tipo = filtri.tipo === 'chiusure' ? 'chiusure' : 'spese';
    var mese = /^\d{4}-\d{2}$/.test(String(filtri.mese || '')) ? String(filtri.mese) : '';
    var testo = normalizzaRicerca_(filtri.testo);
    var importoCercato = testo ? leggiImporto_(filtri.testo) : null;
    var categoria = String(filtri.categoria || '');
    var pagamento = String(filtri.pagamento || '');
    var persona = String(filtri.persona || '');

    var tutte = tipo === 'spese' ? leggiSpese_() : leggiChiusureConId_();
    var mesi = {};
    var categorie = {};
    tutte.forEach(function (x) {
      if (x.data) mesi[Utilities.formatDate(x.data, FUSO, 'yyyy-MM')] = true;
      if (x.categoria) categorie[x.categoria] = true;
    });

    var trovate = tutte.filter(function (x) {
      if (!x.data) return false;
      if (mese && Utilities.formatDate(x.data, FUSO, 'yyyy-MM') !== mese) return false;
      if (persona && x.inseritoDa !== persona) return false;
      var stessoImporto = importoCercato !== null &&
        Math.abs((tipo === 'spese' ? x.importo : x.totale) - importoCercato) < 0.005;
      if (tipo === 'spese') {
        if (categoria && x.categoria !== categoria) return false;
        if (pagamento && x.pagamento !== pagamento) return false;
        if (testo && normalizzaRicerca_(x.fornitore + ' ' + x.nota).indexOf(testo) < 0 && !stessoImporto) return false;
      } else if (testo && normalizzaRicerca_(x.note).indexOf(testo) < 0 && !stessoImporto) {
        return false;
      }
      return true;
    });
    trovate.sort(function (a, b) { return (b.data - a.data) || (b.riga - a.riga); });

    return {
      ok: true,
      tipo: tipo,
      numero: trovate.length,
      totale: somma_(trovate, tipo === 'spese' ? 'importo' : 'totale'),
      troncato: trovate.length > MAX_VOCI_ELENCO,
      voci: tipo === 'spese' ? aggiungiScadenzeSpese_(trovate.slice(0, MAX_VOCI_ELENCO).map(spesaPerTelefono_)) :
        trovate.slice(0, MAX_VOCI_ELENCO).map(chiusuraPerTelefono_),
      mesi: Object.keys(mesi).sort().reverse().map(function (k) {
        return { valore: k, nome: MESI[Number(k.substring(5)) - 1] + ' ' + k.substring(0, 4) };
      }),
      categorie: Object.keys(categorie).sort(confrontaTesti_)
    };
  }, 'elenco');
}

/** Minuscole e senza accenti, per cercare "caffe" e trovare "Caffè". */
function normalizzaRicerca_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/^'/, '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Spesa nel formato per il telefono (google.script.run non accetta le date). */
function spesaPerTelefono_(sp) {
  return {
    id: sp.id,
    data: sp.data ? dataIt_(sp.data) : '',
    dataIso: sp.data ? chiaveGiorno_(sp.data) : '',
    importo: sp.importo,
    fornitore: sp.fornitore.replace(/^'/, ''),
    categoria: sp.categoria,
    pagamento: sp.pagamento,
    nota: sp.nota.replace(/^'/, ''),
    foto: sp.foto,
    inseritoDa: sp.inseritoDa || ''
  };
}

function chiusuraPerTelefono_(c) {
  return {
    id: c.id,
    data: dataIt_(c.data),
    dataIso: chiaveGiorno_(c.data),
    giorno: GIORNI_SETTIMANA[Number(Utilities.formatDate(c.data, FUSO, 'u'))],
    contanti: c.contanti,
    pos: c.pos,
    fondo: c.fondo,
    totale: c.totale,
    note: c.note.replace(/^'/, ''),
    inseritoDa: c.inseritoDa || '',
    registratore: c.registratore,
    differenza: c.differenza
  };
}

/** Le chiusure vecchie (prima della coda offline) non hanno ID: lo aggiungo. */
function leggiChiusureConId_() {
  var chiusure = leggiChiusure_();
  if (!chiusure.some(function (c) { return !c.id; })) return chiusure;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Rileggo dentro il lock: nel frattempo qualcuno potrebbe aver tolto una riga.
    chiusure = leggiChiusure_();
    var scheda = scheda_(SCHEDA_CHIUSURE);
    chiusure.forEach(function (c) {
      if (c.id) return;
      c.id = 'C' + Utilities.getUuid().replace(/-/g, '').substring(0, 20);
      scheda.getRange(c.riga, COL_CHIUSURE_ID).setValue(c.id);
    });
  } finally {
    lock.releaseLock();
  }
  return chiusure;
}

// ---------------------------------------------------------------------------
// Modifica ed eliminazione
// ---------------------------------------------------------------------------

/**
 * Modifica una spesa già salvata.
 * dati.fotoAzione: 'tieni' (predefinito), 'sostituisci' (con dati.foto) oppure 'togli'.
 */
function modificaSpesa(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var id = idValido_(dati.id);
    if (!id) return errore_('Spesa non trovata.');
    var v = validaSpesa_(dati);
    if (v.errore) return errore_(v.errore);
    if (dati.fotoAzione === 'sostituisci' && !v.foto) return errore_('Manca la nuova foto.');
    if (v.scadenza && !esisteSchedaScadenze_()) return errore_(MANCA_SCHEDA_SCADENZE);

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var vecchiaFoto = '';
    try {
      var scheda = scheda_(SCHEDA_SPESE);
      var riga = trovaRiga_(scheda, 1, id);
      if (!riga) return errore_('Questa spesa non c\'è più: forse è stata eliminata.');
      var link = String(scheda.getRange(riga, 8).getValue());
      if (dati.fotoAzione === 'sostituisci') {
        vecchiaFoto = link;
        link = salvaFoto_(v.foto, v.tipoFile, v.data, v.fornitore, v.importo);
      } else if (dati.fotoAzione === 'togli') {
        vecchiaFoto = link;
        link = '';
      }
      scheda.getRange(riga, 2, 1, 7).setValues([[v.data, v.importo, v.fornitore, v.categoria, v.pagamento, v.nota, link]]);
      scheda.getRange(riga, COL_SPESE_MODIFICATO).setValue(new Date());
      aggiungiFornitore_(v.fornitore);
      // Scadenza: data compilata → crea/aggiorna; campo svuotato → toglie; campo non inviato (app vecchia) → resta com'è.
      sincronizzaScadenzaSpesa_(id, v.scadenzaInviata ? v.scadenza : undefined, v.fornitore, v.nota, v.importo, v.data);
    } finally {
      lock.releaseLock();
    }
    if (vecchiaFoto) cestinaFoto_(vecchiaFoto);
    controllaBudgetDopoSpesa_(v.data);
    return { ok: true };
  }, 'modificaSpesa');
}

/**
 * Modifica una chiusura già salvata. Se la nuova data ha già un'altra
 * chiusura chiede conferma; con sovrascrivi = true quella vecchia viene tolta.
 */
function modificaChiusura(pin, dati, sovrascrivi) {
  return esegui_(pin, function () {
    dati = dati || {};
    var id = idValido_(dati.id);
    if (!id) return errore_('Chiusura non trovata.');
    var v = validaChiusura_(dati);
    if (v.errore) return errore_(v.errore);

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_CHIUSURE);
      var riga = trovaRiga_(scheda, COL_CHIUSURE_ID, id);
      if (!riga) return errore_('Questa chiusura non c\'è più: forse è stata eliminata.');
      var altra = rigaChiusura_(scheda, v.data, riga);
      if (altra && !sovrascrivi) {
        return {
          ok: false,
          esiste: true,
          messaggio: 'C\'è già un\'altra chiusura cassa per il ' + dataIt_(v.data) + '. Vuoi sostituirla con questa?'
        };
      }
      scheda.getRange(riga, 1, 1, 6).setValues([[v.data, v.contanti, v.pos, v.fondo, v.totale, v.note]]);
      scheda.getRange(riga, COL_CHIUSURE_MODIFICATO).setValue(new Date());
      scheda.getRange(riga, COL_CHIUSURE_REGISTRATORE, 1, 2).setValues([[
        v.registratore === null ? '' : v.registratore, v.differenza === null ? '' : v.differenza]]);
      if (altra) scheda.deleteRow(altra);
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'modificaChiusura');
}

function eliminaChiusura(pin, id) {
  return esegui_(pin, function () {
    if (!idValido_(id)) return errore_('Chiusura non trovata.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_CHIUSURE);
      var riga = trovaRiga_(scheda, COL_CHIUSURE_ID, id);
      if (!riga) return { ok: true, giaEliminata: true };
      scheda.deleteRow(riga);
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'eliminaChiusura');
}
