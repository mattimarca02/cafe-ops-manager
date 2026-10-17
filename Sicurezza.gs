/**
 * Bar - Spese & Cassa: rete di sicurezza.
 *
 * - backupSettimanale(): copia del Foglio nella cartella Drive "Bar - Backup",
 *   tenendo le ultime 8 copie (attivatore settimanale, domenica notte).
 * - Scheda "Registro errori": ogni funzione del server ci scrive i suoi errori.
 * - Email all'indirizzo "Email assistenza" (scheda Impostazioni) quando un
 *   attivatore fallisce e, ogni mattina, se ci sono errori nelle ultime 24 ore
 *   (controlloErrori).
 */

var NOME_CARTELLA_BACKUP = 'Bar - Backup';
var PREFISSO_BACKUP = 'Bar - Backup ';
var COPIE_BACKUP = 8;
var GIORNI_MINIMI_BACKUP = 50; // una copia più giovane di così non viene mai cestinata
var SCHEDA_REGISTRO = 'Registro errori';
var INTESTAZIONI_REGISTRO = ['Data', 'Funzione', 'Messaggio', 'Dettagli'];
var MAX_RIGHE_REGISTRO = 500;

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

function backupSettimanale() {
  eseguiAttivatore_('backupSettimanale', function () {
    return faiBackup_();
  });
}

/** Dal menu "Bar". */
function faiBackupAdesso() {
  if (!permessoRaro_('backupAdesso', 600)) return avvisa_('È già stato fatto un backup pochi minuti fa: riprova più tardi.');
  var esito = faiBackup_();
  avvisa_('Backup fatto ✓\n\n"' + esito.nome + '" nella cartella "' + NOME_CARTELLA_BACKUP + '" di Google Drive.\n' +
    'Copie tenute: ' + esito.copie + (esito.cestinate ? ' (spostate nel cestino le ' + esito.cestinate + ' più vecchie)' : '') + '.');
}

function cartellaBackup_() {
  var id = leggiImpostazione_(IMP_ID_CARTELLA_BACKUP);
  if (id) {
    try {
      var c = DriveApp.getFolderById(id);
      if (!c.isTrashed()) return c;
    } catch (e) {
      console.warn('Cartella backup non trovata, ne cerco/creo un\'altra: ' + e);
    }
  }
  var trovate = DriveApp.getRootFolder().getFoldersByName(NOME_CARTELLA_BACKUP);
  var cartella = trovate.hasNext() ? trovate.next() : DriveApp.createFolder(NOME_CARTELLA_BACKUP);
  scriviImpostazione_(IMP_ID_CARTELLA_BACKUP, cartella.getId());
  return cartella;
}

/** Copia il Foglio e tiene solo le ultime COPIE_BACKUP copie (le altre vanno nel cestino). */
function faiBackup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cartella = cartellaBackup_();
  var nome = PREFISSO_BACKUP + Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH.mm');
  DriveApp.getFileById(ss.getId()).makeCopy(nome, cartella);

  var copie = [];
  var elenco = cartella.getFiles();
  while (elenco.hasNext()) {
    var f = elenco.next();
    if (f.getName().indexOf(PREFISSO_BACKUP) === 0) copie.push(f);
  }
  // Dalla più recente alla più vecchia (a parità di data conta il nome, che contiene data e ora).
  copie.sort(function (a, b) {
    return (b.getDateCreated().getTime() - a.getDateCreated().getTime()) || (b.getName() < a.getName() ? -1 : 1);
  });
  // Oltre alle ultime 8, le copie più giovani di 50 giorni restano comunque: così tanti
  // backup fatti di fila (per sbaglio) non possono cancellare quelli delle settimane prima.
  var cestinate = 0;
  var limite = new Date().getTime() - GIORNI_MINIMI_BACKUP * 86400000;
  copie.slice(COPIE_BACKUP).forEach(function (f) {
    if (f.getDateCreated().getTime() > limite) return;
    f.setTrashed(true);
    cestinate++;
  });
  return { nome: nome, copie: Math.min(copie.length, COPIE_BACKUP), cestinate: cestinate };
}

/**
 * Le funzioni del menu non chiedono il PIN e Apps Script le rende chiamabili anche
 * dalla pagina web: per quelle che mandano email o fanno copie limito la frequenza.
 * Restituisce false se la stessa operazione è stata fatta meno di "secondi" fa.
 */
function permessoRaro_(chiave, secondi) {
  var cache = CacheService.getScriptCache();
  if (cache.get('raro_' + chiave)) return false;
  cache.put('raro_' + chiave, '1', secondi);
  return true;
}

// ---------------------------------------------------------------------------
// Registro errori
// ---------------------------------------------------------------------------

function preparaRegistroErrori_(ss) {
  var s = preparaScheda_(ss, SCHEDA_REGISTRO, INTESTAZIONI_REGISTRO);
  s.getRange('A:A').setNumberFormat(FORMATO_DATA_ORA);
  s.setColumnWidth(1, 140);
  s.setColumnWidth(2, 200);
  s.setColumnWidth(3, 420);
  s.setColumnWidth(4, 420);
  return s;
}

/**
 * Scrive un errore nella scheda "Registro errori". Non lancia mai errori a sua
 * volta (se il foglio non è raggiungibile resta solo il registro di Apps Script).
 */
function registraErrore_(funzione, errore) {
  var messaggio = errore && errore.message ? errore.message : String(errore);
  var dettagli = errore && errore.stack ? String(errore.stack) : '';
  console.error(funzione + ': ' + messaggio + (dettagli ? '\n' + dettagli : ''));
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var s = ss.getSheetByName(SCHEDA_REGISTRO) || preparaRegistroErrori_(ss);
    s.appendRow([new Date(), testoSicuro_(funzione), testoSicuro_(messaggio.substring(0, 1000)),
      testoSicuro_(dettagli.substring(0, 2000))]);
    // Tengo solo gli ultimi MAX_RIGHE_REGISTRO errori.
    var righe = s.getLastRow() - 1;
    if (righe > MAX_RIGHE_REGISTRO + 50) s.deleteRows(2, righe - MAX_RIGHE_REGISTRO);
  } catch (e) {
    console.error('Impossibile scrivere nel Registro errori: ' + e);
  }
}

function leggiRegistroErrori_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_REGISTRO);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 4).getValues().map(function (r) {
    return { data: comeData_(r[0]), funzione: String(r[1]), messaggio: String(r[2]), dettagli: String(r[3]) };
  }).filter(function (x) { return x.data; });
}

// ---------------------------------------------------------------------------
// Email all'assistenza
// ---------------------------------------------------------------------------

function emailAssistenza_() {
  return leggiImpostazione_(IMP_EMAIL_ASSISTENZA);
}

/** Avviso immediato: un attivatore (report, fatture, scadenze, backup) è fallito. */
function avvisaAssistenza_(funzione, errore) {
  var destinatario = emailAssistenza_();
  if (!destinatario) return false;
  try {
    MailApp.sendEmail({
      to: destinatario,
      subject: 'Bar – ERRORE in ' + funzione,
      body: 'Un\'operazione automatica dell\'app del bar non è andata a buon fine.\n\n' +
        'Funzione: ' + funzione + '\n' +
        'Quando: ' + Utilities.formatDate(new Date(), FUSO, FORMATO_DATA_ORA) + '\n' +
        'Errore: ' + (errore && errore.message ? errore.message : errore) + '\n\n' +
        (errore && errore.stack ? errore.stack + '\n\n' : '') +
        'Gli errori sono elencati anche nella scheda "' + SCHEDA_REGISTRO + '" del foglio.',
      name: NOME_APP
    });
    return true;
  } catch (e) {
    console.error('Email all\'assistenza non inviata: ' + e);
    return false;
  }
}

/** Attivatore giornaliero: se nelle ultime 24 ore ci sono errori, li manda all'assistenza. */
function controlloErrori() {
  eseguiAttivatore_('controlloErrori', function () {
    return inviaRiepilogoErrori_(new Date());
  });
}

function inviaRiepilogoErrori_(adesso) {
  var destinatario = emailAssistenza_();
  var limite = adesso.getTime() - 24 * 3600 * 1000;
  var recenti = leggiRegistroErrori_().filter(function (x) { return x.data.getTime() >= limite; });
  if (!recenti.length || !destinatario) return { inviata: false, errori: recenti.length };
  var righe = recenti.map(function (x) {
    return '• ' + Utilities.formatDate(x.data, FUSO, FORMATO_DATA_ORA) + ' – ' + x.funzione + ': ' + x.messaggio;
  });
  MailApp.sendEmail({
    to: destinatario,
    subject: 'Bar – ' + recenti.length + (recenti.length === 1 ? ' errore' : ' errori') + ' nelle ultime 24 ore',
    body: 'Nelle ultime 24 ore l\'app del bar ha registrato questi errori:\n\n' + righe.join('\n') +
      '\n\nI dettagli sono nella scheda "' + SCHEDA_REGISTRO + '" del foglio.',
    name: NOME_APP
  });
  return { inviata: true, errori: recenti.length };
}
