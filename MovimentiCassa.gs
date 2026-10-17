/**
 * Bar - Spese & Cassa: versamenti in banca e prelievi dalla cassa.
 *
 * Scheda "Movimenti cassa": versamento in banca, prelievo personale, prelievo per spese.
 * Contante teorico in cassa = fondo cassa iniziale + incassi in contanti − spese pagate in
 * contanti − versamenti − prelievi, contando dalla "Data di partenza del contante in cassa"
 * (compresa) a oggi. Fondo e data di partenza stanno nella scheda Impostazioni.
 *
 * contanteTeorico_() è una funzione "pura", provata da testMovimentiCassa().
 */

var SCHEDA_MOVIMENTI = 'Movimenti cassa';
var INTESTAZIONI_MOVIMENTI = ['ID', 'Data', 'Tipo', 'Importo', 'Nota', 'Persona', 'Inserito il'];
var TIPO_VERSAMENTO = 'Versamento in banca';
var TIPO_PRELIEVO_PERSONALE = 'Prelievo personale';
var TIPO_PRELIEVO_SPESE = 'Prelievo per spese';
var TIPI_MOVIMENTO = [TIPO_VERSAMENTO, TIPO_PRELIEVO_PERSONALE, TIPO_PRELIEVO_SPESE];
var MO_ID = 1, MO_DATA = 2, MO_TIPO = 3, MO_IMPORTO = 4, MO_NOTA = 5, MO_PERSONA = 6, MO_INSERITO = 7;
var MOVIMENTI_IN_ELENCO = 20;

function preparaSchedaMovimenti_(ss) {
  var s = preparaScheda_(ss, SCHEDA_MOVIMENTI, INTESTAZIONI_MOVIMENTI);
  s.getRange('A:A').setNumberFormat('@');
  s.getRange('B:B').setNumberFormat(FORMATO_DATA);
  s.getRange('D:D').setNumberFormat(FORMATO_EURO);
  s.getRange('G:G').setNumberFormat(FORMATO_DATA_ORA);
  s.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(TIPI_MOVIMENTO, true).setAllowInvalid(false).setHelpText('Scegli: ' + TIPI_MOVIMENTO.join(', ')).build());
  s.setColumnWidth(3, 200);
  s.setColumnWidth(5, 300);
}

// ---------------------------------------------------------------------------
// Calcoli (funzione "pura")
// ---------------------------------------------------------------------------

/**
 * fondo: euro in cassa all'inizio del giorno di partenza; partenza: Date;
 * chiusure: [{ data, contanti }]; spese: [{ data, importo, pagamento }]; movimenti: [{ data, tipo, importo }];
 * finoA: Date (compresa). Restituisce i pezzi del calcolo e il totale.
 */
function contanteTeorico_(fondo, partenza, chiusure, spese, movimenti, finoA) {
  var dal = chiaveGiorno_(partenza);
  var al = chiaveGiorno_(finoA);
  var dentro = function (x) {
    if (!x.data) return false;
    var k = chiaveGiorno_(x.data);
    return k >= dal && k <= al;
  };
  var r = { fondo: arrotonda_(Number(fondo) || 0), incassiContanti: 0, speseContanti: 0, versamenti: 0, prelieviPersonali: 0, prelieviSpese: 0 };
  chiusure.filter(dentro).forEach(function (c) { r.incassiContanti += Number(c.contanti) || 0; });
  spese.filter(dentro).forEach(function (sp) { if (sp.pagamento === 'Contanti') r.speseContanti += Number(sp.importo) || 0; });
  movimenti.filter(dentro).forEach(function (m) {
    var n = Number(m.importo) || 0;
    if (m.tipo === TIPO_VERSAMENTO) r.versamenti += n;
    else if (m.tipo === TIPO_PRELIEVO_SPESE) r.prelieviSpese += n;
    else r.prelieviPersonali += n;
  });
  ['incassiContanti', 'speseContanti', 'versamenti', 'prelieviPersonali', 'prelieviSpese'].forEach(function (k) { r[k] = arrotonda_(r[k]); });
  r.prelievi = arrotonda_(r.prelieviPersonali + r.prelieviSpese);
  r.totale = arrotonda_(r.fondo + r.incassiContanti - r.speseContanti - r.versamenti - r.prelievi);
  return r;
}

/** Totali dei movimenti di un elenco (per il report): { versamenti, prelieviPersonali, prelieviSpese, numero }. */
function totaliMovimenti_(movimenti) {
  var t = { versamenti: 0, prelieviPersonali: 0, prelieviSpese: 0, numero: movimenti.length };
  movimenti.forEach(function (m) {
    if (m.tipo === TIPO_VERSAMENTO) t.versamenti += m.importo;
    else if (m.tipo === TIPO_PRELIEVO_SPESE) t.prelieviSpese += m.importo;
    else t.prelieviPersonali += m.importo;
  });
  t.versamenti = arrotonda_(t.versamenti);
  t.prelieviPersonali = arrotonda_(t.prelieviPersonali);
  t.prelieviSpese = arrotonda_(t.prelieviSpese);
  t.prelievi = arrotonda_(t.prelieviPersonali + t.prelieviSpese);
  return t;
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

function leggiMovimenti_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_MOVIMENTI);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_MOVIMENTI.length).getValues().map(function (r, i) {
    var tipo = String(r[MO_TIPO - 1]).trim();
    return {
      riga: i + 2,
      id: String(r[MO_ID - 1] || ''),
      data: comeData_(r[MO_DATA - 1]),
      tipo: TIPI_MOVIMENTO.indexOf(tipo) >= 0 ? tipo : TIPO_PRELIEVO_PERSONALE,
      importo: leggiImporto_(r[MO_IMPORTO - 1]) || 0,
      nota: String(r[MO_NOTA - 1]).replace(/^'/, ''),
      persona: String(r[MO_PERSONA - 1]).replace(/^'/, '')
    };
  }).filter(function (m) { return m.data && m.importo; });
}

/** Fondo iniziale e data di partenza dalla scheda Impostazioni ({ impostato: false } se manca la data). */
function impostazioniContante_() {
  var tabella = leggiTabellaImpostazioni_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_IMPOSTAZIONI));
  var partenza = comeData_(tabella[IMP_DATA_PARTENZA_CASSA]);
  var grezzo = tabella[IMP_FONDO_INIZIALE];
  var fondo = grezzo === '' || grezzo === undefined || grezzo === null ? 0 : leggiImporto_(grezzo);
  return { impostato: !!partenza, partenza: partenza, fondo: fondo || 0 };
}

/** Contante teorico a una data (null se in Impostazioni manca la data di partenza). */
function contanteTeoricoAl_(finoA, spese, chiusure) {
  var imp = impostazioniContante_();
  if (!imp.impostato || chiaveGiorno_(imp.partenza) > chiaveGiorno_(finoA)) return null;
  var r = contanteTeorico_(imp.fondo, imp.partenza, chiusure || leggiChiusure_(), spese || leggiSpese_(), leggiMovimenti_(), finoA);
  r.partenza = dataIt_(imp.partenza);
  r.al = dataIt_(finoA);
  return r;
}

function movimentoPerTelefono_(m) {
  return { id: m.id, data: dataIt_(m.data), tipo: m.tipo, importo: m.importo, nota: m.nota, persona: m.persona };
}

// ---------------------------------------------------------------------------
// Funzioni chiamate dall'app
// ---------------------------------------------------------------------------

function movimentiCassa(pin) {
  return esegui_(pin, function () {
    var movimenti = leggiMovimenti_().sort(function (a, b) { return (b.data - a.data) || (b.riga - a.riga); });
    return {
      ok: true,
      tipi: TIPI_MOVIMENTO,
      contante: contanteTeoricoAl_(new Date()),
      movimenti: movimenti.slice(0, MOVIMENTI_IN_ELENCO).map(movimentoPerTelefono_),
      altri: Math.max(0, movimenti.length - MOVIMENTI_IN_ELENCO)
    };
  }, 'movimentiCassa');
}

/** dati: { id (creato dal telefono), data, tipo, importo, nota, persona } */
function salvaMovimentoCassa(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var data = leggiData_(dati.data);
    if (!data) return errore_('La data non è valida.');
    if (TIPI_MOVIMENTO.indexOf(dati.tipo) < 0) return errore_('Scegli il tipo: versamento in banca, prelievo personale o prelievo per spese.');
    var importo = leggiImporto_(dati.importo);
    if (importo === null || importo <= 0) return errore_('L\'importo non è valido. Esempio: 500,00');
    var id = idValido_(dati.id) || Utilities.getUuid();
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var s = scheda_(SCHEDA_MOVIMENTI);
      if (trovaRiga_(s, MO_ID, id) > 0) return { ok: true, giaSalvata: true };
      s.appendRow([id, data, dati.tipo, importo, pulisci_(dati.nota, 300), leggiPersona_(dati), new Date()]);
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'salvaMovimentoCassa');
}

function eliminaMovimentoCassa(pin, id) {
  return esegui_(pin, function () {
    if (!id) return errore_('Movimento non trovato.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var s = scheda_(SCHEDA_MOVIMENTI);
      var riga = trovaRiga_(s, MO_ID, id);
      if (!riga) return { ok: true, giaEliminato: true };
      s.deleteRow(riga);
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'eliminaMovimentoCassa');
}

// ---------------------------------------------------------------------------
// Report mensile
// ---------------------------------------------------------------------------

function htmlMovimenti_(t, contante) {
  var righe = [
    ['Versato in banca', formatoEuro_(t.versamenti)],
    ['Prelievi personali', formatoEuro_(t.prelieviPersonali)],
    ['Prelievi per spese', formatoEuro_(t.prelieviSpese)],
    ['<b>Totale prelevato</b>', formatoEuro_(t.prelievi)]
  ];
  if (contante) righe.push(['<b>Contante teorico in cassa al ' + contante.al + '</b>', formatoEuro_(contante.totale)]);
  var h = tabellaHtml_('Versamenti e prelievi', righe);
  if (contante) {
    h += '<p style="color:#555;font-size:13px;margin:6px 0;">Contante teorico = fondo iniziale ' + formatoEuro_(contante.fondo) +
      ' (dal ' + contante.partenza + ') + incassi in contanti ' + formatoEuro_(contante.incassiContanti) + ' − spese in contanti ' +
      formatoEuro_(contante.speseContanti) + ' − versamenti ' + formatoEuro_(contante.versamenti) + ' − prelievi ' +
      formatoEuro_(contante.prelievi) + '.</p>';
  }
  return h;
}
