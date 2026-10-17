/**
 * Bar - Spese & Cassa
 * Web app Google Apps Script collegata a un Google Sheet.
 *
 * IMPORTANTE: in questo file NON ci sono email, PIN o ID di fogli/cartelle.
 * Questi valori stanno solo nella scheda "Impostazioni" del Google Sheet.
 */

// ---------------------------------------------------------------------------
// Configurazione generale
// ---------------------------------------------------------------------------

var FUSO = 'Europe/Rome';
var NOME_APP = 'Bar - Spese & Cassa';
var NOME_CARTELLA_FOTO = 'Bar - Scontrini';

var SCHEDA_SPESE = 'Spese';
var SCHEDA_CHIUSURE = 'Chiusure';
var SCHEDA_CATEGORIE = 'Categorie';
var SCHEDA_FORNITORI = 'Fornitori';
var SCHEDA_IMPOSTAZIONI = 'Impostazioni';
var SCHEDA_FATTURE = 'Fatture';
var SCHEDA_PERSONE = 'Persone';

var INTESTAZIONI_SPESE = ['ID', 'Data', 'Importo', 'Fornitore', 'Categoria', 'Pagamento', 'Nota', 'Link foto', 'Inserito il',
  'Modificato il', 'Inserito da'];
var INTESTAZIONI_CHIUSURE = ['Data', 'Contanti', 'POS', 'Fondo cassa', 'Totale incasso', 'Note', 'ID', 'Inserito il',
  'Modificato il', 'Inserito da', 'Totale registratore', 'Differenza quadratura'];
// Colonne (da 1) usate dalle funzioni di modifica
var COL_SPESE_MODIFICATO = 10;
var COL_CHIUSURE_ID = 7;
var COL_CHIUSURE_MODIFICATO = 9;
var COL_CHIUSURE_REGISTRATORE = 11;
var INTESTAZIONI_FORNITORI = ['Fornitore', 'Categoria predefinita', 'P.IVA', 'Telefono WhatsApp'];
var INTESTAZIONI_FATTURE = ['Data', 'Numero', 'Fornitore', 'P.IVA fornitore', 'Tipo documento', 'Imponibile',
  'IVA', 'Totale', 'Scadenza pagamento', 'Categoria', 'Nome file', 'Importata il', 'Origine'];
var MANCA_SCHEDA_SCADENZE = 'Manca la scheda "Scadenze": dal foglio apri il menu Bar → 1. Prepara il foglio (setup), poi riprova.';
var DA_CATEGORIZZARE = 'Da categorizzare';

var CATEGORIE_PREDEFINITE = [
  'Caffè', 'Bevande', 'Alcolici', 'Alimentari', 'Brioche/Pasticceria',
  'Pulizia e materiali', 'Utenze', 'Affitto', 'Manutenzione', 'Altro'
];
var PAGAMENTI = ['Contanti', 'Carta/Bancomat', 'Bonifico'];

// Voci della scheda Impostazioni (colonna A). I valori vanno in colonna B.
var IMP_EMAIL_TITOLARE = 'Email titolare';
var IMP_EMAIL_COMMERCIALISTA = 'Email commercialista';
var IMP_PIN = 'PIN di accesso';
var IMP_LINK_PUBBLICO = 'Foto visibili a chi ha il link (SI/NO)';
var IMP_ID_CARTELLA = 'ID cartella scontrini';
var IMP_ID_CARTELLA_FATTURE = 'ID cartella fatture';
var IMP_GIORNI_PREAVVISO = 'Giorni di preavviso scadenze';
var IMP_EMAIL_ASSISTENZA = 'Email assistenza';
var IMP_ID_CARTELLA_BACKUP = 'ID cartella backup';
var IMP_TOLLERANZA_CASSA = 'Tolleranza quadratura cassa (€)';
var IMP_FONDO_INIZIALE = 'Fondo cassa iniziale (€)';
var IMP_DATA_PARTENZA_CASSA = 'Data di partenza del contante in cassa';
var IMP_MARGINE_MINIMO = 'Margine minimo prodotti (%)';
var IMP_ORA_HACCP = 'Ora limite controlli HACCP';
var IMP_EMAIL_HACCP = 'Email promemoria HACCP';
var IMP_ID_CARTELLA_HACCP = 'ID cartella HACCP';

var VOCI_IMPOSTAZIONI = [
  [IMP_EMAIL_TITOLARE, '', 'Riceve il report mensile.'],
  [IMP_EMAIL_COMMERCIALISTA, '', 'Riceve il report mensile e può vedere le foto degli scontrini.'],
  [IMP_PIN, '', 'Codice di 4 cifre chiesto all\'apertura dell\'app.'],
  [IMP_LINK_PUBBLICO, 'NO', 'Metti SI solo se il commercialista non ha un account Google e non riesce ad aprire le foto.'],
  [IMP_GIORNI_PREAVVISO, '3', 'Quanti giorni prima di una scadenza arriva l\'email di promemoria (alla titolare).'],
  [IMP_EMAIL_ASSISTENZA, '', 'Chi aiuta con l\'app: riceve un\'email se un\'operazione automatica fallisce o se ci sono errori.'],
  [IMP_TOLLERANZA_CASSA, '5', 'Chiusura cassa: differenza massima (in euro, in più o in meno) tra contanti + POS e il totale ' +
    'del registratore telematico che si considera "in quadratura". Oltre, l\'app chiede una nota.'],
  [IMP_FONDO_INIZIALE, '', 'Contante teorico in cassa: i soldi che c\'erano in cassa (fondo compreso) all\'inizio della ' +
    'data di partenza qui sotto.'],
  [IMP_DATA_PARTENZA_CASSA, '', 'Da quale giorno (compreso) contare incassi in contanti, spese in contanti, versamenti e ' +
    'prelievi per il contante teorico in cassa. Esempio: 01/11/2026. Se è vuota il contante teorico non viene mostrato.'],
  [IMP_MARGINE_MINIMO, '60', 'Schermata Margini: i prodotti con un margine (sul prezzo senza IVA) più basso di questa ' +
    'percentuale vengono segnalati in rosso.'],
  [IMP_ORA_HACCP, '11:00', 'Controlli HACCP: se a quest\'ora (es. 11:00) un controllo giornaliero non è ancora stato ' +
    'registrato, arriva un\'email di promemoria.'],
  [IMP_EMAIL_HACCP, '', 'Chi riceve il promemoria dei controlli HACCP. Se è vuota, va all\'email della titolare.'],
  [IMP_ID_CARTELLA, '', 'Compilato in automatico. Non modificare.'],
  [IMP_ID_CARTELLA_FATTURE, '', 'Compilato in automatico. Non modificare.'],
  [IMP_ID_CARTELLA_BACKUP, '', 'Compilato in automatico. Non modificare.'],
  [IMP_ID_CARTELLA_HACCP, '', 'Compilato in automatico. Non modificare.']
];

var MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
var GIORNI_SETTIMANA = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

var FORMATO_EURO = '#,##0.00 "€"';
var FORMATO_DATA = 'dd/MM/yyyy';
var FORMATO_DATA_ORA = 'dd/MM/yyyy HH:mm';

// ---------------------------------------------------------------------------
// Menu nel foglio e configurazione iniziale
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Bar')
    .addItem('1. Prepara il foglio (setup)', 'setup')
    .addItem('2. Attiva le operazioni automatiche (report, fatture, scadenze, HACCP, backup)', 'installaTrigger')
    .addSeparator()
    .addItem('Importa fatture', 'importaFatture')
    .addItem('Aggiorna le scadenze adesso', 'aggiornaScadenzeDaMenu')
    .addItem('Fai un backup adesso', 'faiBackupAdesso')
    .addItem('Invia un promemoria scadenze di prova', 'inviaPromemoriaScadenzeDiProva')
    .addItem('Invia un report di prova (mese corrente)', 'inviaReportDiProva')
    .addItem('Crea il registro HACCP in PDF (mese scorso)', 'esportaRegistroHaccpDaMenu')
    .addSeparator()
    .addItem('Prova la lettura delle fatture di esempio', 'testImportaFatture')
    .addItem('Copia le fatture di esempio in "Da importare"', 'caricaFattureDiEsempio')
    .addToUi();
}

/**
 * Crea (o completa) tutte le schede necessarie. Si può eseguire più volte
 * senza perdere dati.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(FUSO);
  try {
    ss.setSpreadsheetLocale('it_IT');
  } catch (e) {
    console.warn('Impossibile impostare la lingua del foglio: ' + e);
  }

  var spese = preparaScheda_(ss, SCHEDA_SPESE, INTESTAZIONI_SPESE);
  spese.getRange('A:A').setNumberFormat('@');
  spese.getRange('B:B').setNumberFormat(FORMATO_DATA);
  spese.getRange('C:C').setNumberFormat(FORMATO_EURO);
  spese.getRange('I:J').setNumberFormat(FORMATO_DATA_ORA);
  spese.setColumnWidth(1, 90);
  spese.setColumnWidth(4, 180);
  spese.setColumnWidth(7, 220);
  spese.setColumnWidth(8, 260);

  var chiusure = preparaScheda_(ss, SCHEDA_CHIUSURE, INTESTAZIONI_CHIUSURE);
  chiusure.getRange('A:A').setNumberFormat(FORMATO_DATA);
  chiusure.getRange('B:E').setNumberFormat(FORMATO_EURO);
  chiusure.getRange('G:G').setNumberFormat('@');
  chiusure.getRange('H:I').setNumberFormat(FORMATO_DATA_ORA);
  chiusure.getRange('K:L').setNumberFormat(FORMATO_EURO);
  chiusure.setColumnWidth(6, 260);

  var categorie = preparaScheda_(ss, SCHEDA_CATEGORIE, ['Categoria']);
  if (categorie.getLastRow() < 2) {
    categorie.getRange(2, 1, CATEGORIE_PREDEFINITE.length, 1)
      .setValues(CATEGORIE_PREDEFINITE.map(function (c) { return [c]; }));
  }
  categorie.setColumnWidth(1, 220);

  var persone = preparaScheda_(ss, SCHEDA_PERSONE, ['Nome', 'Note']);
  persone.setColumnWidth(1, 220);
  persone.setColumnWidth(2, 360);
  if (persone.getLastRow() < 2) {
    persone.getRange(2, 2).setValue('← scrivi qui sotto (colonna A) i nomi di chi usa l\'app, uno per riga');
  }

  var fornitori = preparaScheda_(ss, SCHEDA_FORNITORI, INTESTAZIONI_FORNITORI);
  fornitori.getRange('C:D').setNumberFormat('@');
  fornitori.setColumnWidth(1, 260);
  fornitori.setColumnWidth(2, 200);
  fornitori.setColumnWidth(3, 140);
  fornitori.setColumnWidth(4, 170);

  var fatture = preparaScheda_(ss, SCHEDA_FATTURE, INTESTAZIONI_FATTURE);
  fatture.getRange('A:A').setNumberFormat(FORMATO_DATA);
  fatture.getRange('B:B').setNumberFormat('@');
  fatture.getRange('D:D').setNumberFormat('@');
  fatture.getRange('F:H').setNumberFormat(FORMATO_EURO);
  fatture.getRange('I:I').setNumberFormat(FORMATO_DATA);
  fatture.getRange('L:L').setNumberFormat(FORMATO_DATA_ORA);
  fatture.setColumnWidth(3, 240);
  fatture.setColumnWidth(13, 90);
  fatture.setColumnWidth(11, 260);

  preparaSchedeScadenze_(ss);
  preparaSchedaProdotti_(ss);
  preparaSchedeHaccp_(ss);
  preparaSchedaBudget_(ss);
  preparaSchedaMovimenti_(ss);
  preparaSchedaRicette_(ss);
  preparaRegistroErrori_(ss);

  preparaImpostazioni_(ss);
  cartellaFotoPrincipale_();
  cartelleFatture_();

  // Elimina il foglio vuoto creato da Google ("Foglio1" / "Sheet1").
  ['Foglio1', 'Foglio 1', 'Sheet1'].forEach(function (nome) {
    var s = ss.getSheetByName(nome);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(s);
    }
  });

  var pin = normalizzaPin_(leggiImpostazione_(IMP_PIN));
  var msg = 'Configurazione completata ✓\n\n' +
    'Ora apri la scheda "Impostazioni" e scrivi:\n' +
    '• l\'email della titolare\n' +
    '• l\'email del commercialista\n' +
    '• il PIN di 4 cifre' + (pin === '1234' ? ' (adesso è 1234: cambialo!)' : '') + '\n\n' +
    'Facoltativo: nella scheda "Persone" scrivi i nomi di chi usa l\'app.\n\n' +
    'HACCP: i controlli nella scheda "Controlli HACCP" sono solo un ESEMPIO: falli confermare dal consulente HACCP o dall\'ASL.';
  avvisa_(msg);
}

function preparaScheda_(ss, nome, intestazioni) {
  var scheda = ss.getSheetByName(nome) || ss.insertSheet(nome);
  var primaRiga = scheda.getRange(1, 1, 1, intestazioni.length);
  var attuali = primaRiga.getValues()[0];
  // Scrive solo le intestazioni mancanti (utile quando si aggiungono colonne nuove).
  for (var i = 0; i < intestazioni.length; i++) {
    if (!String(attuali[i]).trim()) scheda.getRange(1, i + 1).setValue(intestazioni[i]);
  }
  primaRiga.setFontWeight('bold').setBackground('#e8eaed');
  scheda.setFrozenRows(1);
  return scheda;
}

function preparaImpostazioni_(ss) {
  var scheda = preparaScheda_(ss, SCHEDA_IMPOSTAZIONI, ['Voce', 'Valore', 'Spiegazione']);
  var esistenti = leggiTabellaImpostazioni_(scheda);
  VOCI_IMPOSTAZIONI.forEach(function (voce) {
    if (!(voce[0] in esistenti)) {
      scheda.appendRow(voce);
    }
  });
  var riga = rigaImpostazione_(scheda, IMP_PIN);
  if (riga > 0) {
    var cella = scheda.getRange(riga, 2);
    cella.setNumberFormat('@');
    if (!normalizzaPin_(cella.getValue())) {
      cella.setValue('1234');
    }
  }
  var rigaPartenza = rigaImpostazione_(scheda, IMP_DATA_PARTENZA_CASSA);
  if (rigaPartenza > 0) scheda.getRange(rigaPartenza, 2).setNumberFormat(FORMATO_DATA);
  // L'ora limite HACCP resta testo ("11:00"): se Fogli l'ha trasformata in un orario la riscrivo.
  var rigaOra = rigaImpostazione_(scheda, IMP_ORA_HACCP);
  if (rigaOra > 0) {
    var cellaOra = scheda.getRange(rigaOra, 2);
    var minuti = minutiDaOra_(cellaOra.getDisplayValues()[0][0]);
    cellaOra.setNumberFormat('@');
    cellaOra.setValue(testoOra_(minuti === null ? minutiDaOra_(ORA_HACCP_PREDEFINITA) : minuti));
  }
  scheda.setColumnWidth(1, 260);
  scheda.setColumnWidth(2, 280);
  scheda.setColumnWidth(3, 520);
}

// ---------------------------------------------------------------------------
// Lettura e scrittura delle impostazioni
// ---------------------------------------------------------------------------

function leggiTabellaImpostazioni_(scheda) {
  var risultato = {};
  if (!scheda || scheda.getLastRow() < 2) return risultato;
  var valori = scheda.getRange(2, 1, scheda.getLastRow() - 1, 2).getValues();
  valori.forEach(function (r) {
    var chiave = String(r[0]).trim();
    if (chiave) risultato[chiave] = r[1];
  });
  return risultato;
}

function rigaImpostazione_(scheda, voce) {
  if (scheda.getLastRow() < 2) return 0;
  var chiavi = scheda.getRange(2, 1, scheda.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < chiavi.length; i++) {
    if (String(chiavi[i][0]).trim() === voce) return i + 2;
  }
  return 0;
}

function leggiImpostazione_(voce) {
  var scheda = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_IMPOSTAZIONI);
  var tabella = leggiTabellaImpostazioni_(scheda);
  var valore = tabella[voce];
  return valore === undefined || valore === null ? '' : String(valore).trim();
}

function scriviImpostazione_(voce, valore) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var scheda = ss.getSheetByName(SCHEDA_IMPOSTAZIONI);
  if (!scheda) {
    preparaImpostazioni_(ss);
    scheda = ss.getSheetByName(SCHEDA_IMPOSTAZIONI);
  }
  var riga = rigaImpostazione_(scheda, voce);
  if (riga > 0) {
    scheda.getRange(riga, 2).setValue(valore);
  } else {
    scheda.appendRow([voce, valore, '']);
  }
}

function normalizzaPin_(valore) {
  var s = String(valore === undefined || valore === null ? '' : valore).replace(/\D/g, '');
  if (!s) return '';
  while (s.length < 4) s = '0' + s;
  return s;
}

// ---------------------------------------------------------------------------
// Cartelle di Google Drive per le foto
// ---------------------------------------------------------------------------

function cartellaFotoPrincipale_() {
  var id = leggiImpostazione_(IMP_ID_CARTELLA);
  if (id) {
    try {
      var c = DriveApp.getFolderById(id);
      if (!c.isTrashed()) return c;
    } catch (e) {
      console.warn('Cartella foto non trovata, ne cerco/creo un\'altra: ' + e);
    }
  }
  var trovate = DriveApp.getRootFolder().getFoldersByName(NOME_CARTELLA_FOTO);
  var cartella = trovate.hasNext() ? trovate.next() : DriveApp.createFolder(NOME_CARTELLA_FOTO);
  scriviImpostazione_(IMP_ID_CARTELLA, cartella.getId());
  return cartella;
}

/** Restituisce la cartella "AAAA-MM" (la crea solo se crea = true). */
function cartellaMese_(chiaveMese, crea) {
  var principale = cartellaFotoPrincipale_();
  var trovate = principale.getFoldersByName(chiaveMese);
  if (trovate.hasNext()) return trovate.next();
  return crea ? principale.createFolder(chiaveMese) : null;
}

// ---------------------------------------------------------------------------
// Funzioni di utilità
// ---------------------------------------------------------------------------

function scheda_(nome) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!s) throw new Error('Manca la scheda "' + nome + '". Esegui setup() dal menu Bar.');
  return s;
}

function avvisa_(messaggio) {
  Logger.log(messaggio);
  try {
    SpreadsheetApp.getUi().alert(messaggio);
  } catch (e) {
    // Eseguito dall'editor o da un trigger: basta il registro.
  }
}

/** Converte "2026-10-09" o "09/10/2026" in una data (alle 12:00, ora italiana). */
function leggiData_(testo) {
  var s = String(testo || '').trim();
  var a, m, g, r;
  if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
    a = +r[1]; m = +r[2]; g = +r[3];
  } else if ((r = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s))) {
    g = +r[1]; m = +r[2]; a = +r[3];
  } else {
    return null;
  }
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || g < 1 || g > 31) return null;
  if (g > new Date(a, m, 0).getDate()) return null;
  return Utilities.parseDate(a + '-' + due_(m) + '-' + due_(g) + ' 12:00', FUSO, 'yyyy-MM-dd HH:mm');
}

/** Valore di cella → Date (o null). */
function comeData_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (v) return leggiData_(v);
  return null;
}

/** Accetta "12,50", "12.50", "1.234,50", "1234" … e restituisce un numero (o null). */
function leggiImporto_(v) {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null;
  var s = String(v === undefined || v === null ? '' : v).replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var n = Math.round(parseFloat(s) * 100) / 100;
  return n < 1000000 ? n : null;
}

/** Testo pulito e sicuro da scrivere in una cella (niente formule). */
function pulisci_(v, maxLunghezza) {
  var s = String(v === undefined || v === null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
  if (maxLunghezza && s.length > maxLunghezza) s = s.substring(0, maxLunghezza);
  return testoSicuro_(s);
}

function testoSicuro_(s) {
  s = String(s === undefined || s === null ? '' : s);
  return /^[=+\-@]/.test(s) ? '\'' + s : s;
}

function due_(n) {
  return (n < 10 ? '0' : '') + n;
}

function chiaveGiorno_(data) {
  return Utilities.formatDate(data, FUSO, 'yyyy-MM-dd');
}

function chiaveMese_(anno, mese) {
  return anno + '-' + due_(mese);
}

function dataIt_(data) {
  return Utilities.formatDate(data, FUSO, FORMATO_DATA);
}

function formatoEuro_(n) {
  var neg = n < 0;
  var parti = Math.abs(Number(n) || 0).toFixed(2).split('.');
  var intero = parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + intero + ',' + parti[1] + ' €';
}

function annoMeseOggi_() {
  var oggi = new Date();
  return {
    anno: Number(Utilities.formatDate(oggi, FUSO, 'yyyy')),
    mese: Number(Utilities.formatDate(oggi, FUSO, 'M')),
    giorno: Number(Utilities.formatDate(oggi, FUSO, 'd'))
  };
}

function confrontaTesti_(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase(), 'it');
}

// ---------------------------------------------------------------------------
// Web app: pagina e accesso con PIN
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(NOME_APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Inserisce il contenuto di un altro file HTML (Stile, Script). */
function include(nomeFile) {
  return HtmlService.createHtmlOutputFromFile(nomeFile).getContent();
}

var MAX_TENTATIVI_PIN = 10;
var BLOCCO_PIN_SECONDI = 15 * 60;

/** Restituisce null se il PIN è giusto, altrimenti la risposta di errore. */
function controllaPin_(pin) {
  var cache = CacheService.getScriptCache();
  var errori = parseInt(cache.get('pin_errori') || '0', 10);
  if (errori >= MAX_TENTATIVI_PIN) {
    return { ok: false, tecnico: true, bloccato: true, messaggio: 'Troppi PIN sbagliati. Aspetta 15 minuti e riprova.' };
  }
  var giusto = normalizzaPin_(leggiImpostazione_(IMP_PIN));
  if (!giusto) {
    return { ok: false, messaggio: 'Il PIN non è configurato. Apri il foglio Google, scheda "Impostazioni".' };
  }
  if (String(pin || '').length >= 4 && normalizzaPin_(pin) === giusto) return null;
  cache.put('pin_errori', String(errori + 1), BLOCCO_PIN_SECONDI);
  return { ok: false, pinErrato: true, messaggio: 'PIN sbagliato. Riprova.' };
}

/**
 * Controlla il PIN, esegue la funzione e trasforma gli errori in messaggi
 * chiari. Gli errori vengono scritti nella scheda "Registro errori".
 */
function esegui_(pin, funzione, nome) {
  try {
    var errore = controllaPin_(pin);
    if (errore) return errore;
    return funzione();
  } catch (e) {
    registraErrore_('app: ' + (nome || 'sconosciuta'), e);
    return {
      ok: false,
      tecnico: true,
      messaggio: 'C\'è stato un problema tecnico. Riprova tra poco. (' + (e && e.message ? e.message : e) + ')'
    };
  }
}

/**
 * Esegue una funzione lanciata da un attivatore (trigger): se fallisce scrive
 * l'errore nel Registro errori, avvisa subito l'Email assistenza e rilancia
 * l'errore (così risulta "Non riuscita" anche nelle esecuzioni di Apps Script).
 */
function eseguiAttivatore_(nome, funzione) {
  try {
    return funzione();
  } catch (e) {
    registraErrore_('attivatore: ' + nome, e);
    avvisaAssistenza_(nome, e);
    throw e;
  }
}

function errore_(messaggio) {
  return { ok: false, messaggio: messaggio };
}

/** Per i numeri "di contorno" della home: se qualcosa va storto, 0 (l'app si apre lo stesso). */
function contaSenzaErrori_(funzione) {
  try {
    return funzione();
  } catch (e) {
    console.warn('Conteggio non riuscito: ' + e);
    return 0;
  }
}

/** Nomi della scheda Persone (vuoto se la scheda non c'è ancora: setup non rieseguito). */
function leggiPersone_() {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_PERSONE)) return [];
  return leggiLista_(SCHEDA_PERSONE).map(function (n) { return n.replace(/^'/, ''); });
}

/** Nome di chi ha inserito, arrivato dal telefono (ricordato sul dispositivo). */
function leggiPersona_(dati) {
  return pulisci_(dati && dati.persona, 40);
}

function leggiLista_(nomeScheda) {
  var s = scheda_(nomeScheda);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v; });
}

/** Prima chiamata dell'app: verifica il PIN e restituisce le liste. */
function avvio(pin) {
  return esegui_(pin, function () {
    return {
      ok: true,
      categorie: leggiLista_(SCHEDA_CATEGORIE),
      fornitori: leggiLista_(SCHEDA_FORNITORI).sort(confrontaTesti_),
      fornitoriRecenti: fornitoriRecenti_(5),
      pagamenti: PAGAMENTI,
      persone: leggiPersone_(),
      tolleranzaCassa: tolleranzaCassa_(),
      scadenzeVicine: contaSenzaErrori_(contaScadenzeVicine_),
      daOrdinare: contaSenzaErrori_(contaDaOrdinare_),
      haccpDaFare: contaSenzaErrori_(contaHaccpDaFare_),
      marginiBassi: contaSenzaErrori_(contaMarginiBassi_)
    };
  }, 'avvio');
}

// ---------------------------------------------------------------------------
// Spese
// ---------------------------------------------------------------------------

function salvaSpesa(pin, dati) {
  return esegui_(pin, function () {
    var v = validaSpesa_(dati);
    if (v.errore) return errore_(v.errore);
    // L'ID arriva dal telefono: se la rete cade e si preme "Riprova",
    // la stessa spesa non viene salvata due volte.
    var id = idValido_(dati.id) || Utilities.getUuid();
    if (v.scadenza && !esisteSchedaScadenze_()) return errore_(MANCA_SCHEDA_SCADENZE);

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_SPESE);
      if (trovaRiga_(scheda, 1, id) > 0) {
        // Già salvata: se la prima volta è caduta la rete tra spesa e scadenza, la scadenza si completa ora (senza doppioni).
        if (v.scadenza) sincronizzaScadenzaSpesa_(id, v.scadenza, v.fornitore, v.nota, v.importo, v.data);
        return { ok: true, giaSalvata: true };
      }
      var link = v.foto ? salvaFoto_(v.foto, v.tipoFile, v.data, v.fornitore, v.importo) : '';
      scheda.appendRow([id, v.data, v.importo, v.fornitore, v.categoria, v.pagamento, v.nota, link, new Date(), '',
        leggiPersona_(dati)]);
      aggiungiFornitore_(v.fornitore);
      if (v.scadenza) sincronizzaScadenzaSpesa_(id, v.scadenza, v.fornitore, v.nota, v.importo, v.data);
    } finally {
      lock.releaseLock();
    }
    controllaBudgetDopoSpesa_(v.data);
    return { ok: true };
  }, 'salvaSpesa');
}

/** Controlla i dati di una spesa arrivati dal telefono: { errore } oppure i valori puliti. */
function validaSpesa_(dati) {
  dati = dati || {};
  var data = leggiData_(dati.data);
  if (!data) return { errore: 'La data non è valida.' };
  var importo = leggiImporto_(dati.importo);
  if (importo === null || importo <= 0) return { errore: 'L\'importo non è valido. Esempio: 12,50' };
  var fornitore = pulisci_(dati.fornitore, 80);
  if (!fornitore) return { errore: 'Scegli o scrivi il fornitore.' };
  var categoria = pulisci_(dati.categoria, 60);
  if (!categoria) return { errore: 'Scegli la categoria.' };
  var pagamento = PAGAMENTI.indexOf(dati.pagamento) >= 0 ? dati.pagamento : '';
  if (!pagamento) return { errore: 'Scegli come hai pagato.' };
  var foto = String(dati.foto || '');
  if (foto.length > 15 * 1024 * 1024) return { errore: 'Il file è troppo grande (massimo 10 MB).' };
  // «Da pagare entro»: facoltativo. undefined = il telefono non l'ha mandato (versione vecchia): non si tocca nulla.
  var testoScadenza = dati.scadenza === undefined || dati.scadenza === null ? '' : String(dati.scadenza).trim();
  var scadenza = testoScadenza ? leggiData_(testoScadenza) : null;
  if (testoScadenza && !scadenza) return { errore: 'La data di "Da pagare entro" non è valida.' };
  return {
    scadenza: scadenza,
    scadenzaInviata: dati.scadenza !== undefined,
    data: data,
    importo: importo,
    fornitore: fornitore,
    categoria: categoria,
    pagamento: pagamento,
    nota: pulisci_(dati.nota, 300),
    foto: foto,
    tipoFile: dati.fotoTipo === 'application/pdf' ? 'application/pdf' : 'image/jpeg'
  };
}

/** Salva su Drive la foto (JPEG già compressa dal telefono) o il PDF così com'è. */
function salvaFoto_(base64, tipo, data, fornitore, importo) {
  var pulito = String(base64).replace(/^data:[^,]*,/, '');
  var byte = Utilities.base64Decode(pulito);
  var estensione = tipo === 'application/pdf' ? '.pdf' : '.jpg';
  var cartella = cartellaMese_(Utilities.formatDate(data, FUSO, 'yyyy-MM'), true);
  var nome = chiaveGiorno_(data) + ' - ' +
    String(fornitore).replace(/^'/, '').replace(/[\\\/:*?"<>|]/g, '').substring(0, 50) + ' - ' +
    formatoEuro_(importo).replace(' €', '') + ' euro' + estensione;
  var file = cartella.createFile(Utilities.newBlob(byte, tipo, nome));
  return file.getUrl();
}

/** I fornitori delle ultime spese, dal più recente (senza ripetizioni), per le scorciatoie del modulo. */
function fornitoriRecenti_(quanti) {
  var spese = leggiSpese_();
  var visti = {};
  var elenco = [];
  for (var i = spese.length - 1; i >= 0 && elenco.length < quanti; i--) {
    var nome = spese[i].fornitore.replace(/^'/, '').trim();
    var chiave = normalizzaRicerca_(nome);
    if (!chiave || visti[chiave]) continue;
    visti[chiave] = true;
    elenco.push(nome);
  }
  return elenco;
}

function aggiungiFornitore_(fornitore) {
  var nome = String(fornitore).replace(/^'/, '');
  // Stesso fornitore anche se cambiano maiuscole, accenti o spazi doppi: niente doppioni.
  var esistenti = leggiLista_(SCHEDA_FORNITORI).map(normalizzaRicerca_);
  if (esistenti.indexOf(normalizzaRicerca_(nome)) < 0) {
    scheda_(SCHEDA_FORNITORI).appendRow([testoSicuro_(nome)]);
  }
}

/** Numero di riga (da 2 in poi) in cui la colonna contiene il valore, oppure 0. */
function trovaRiga_(scheda, colonna, valore) {
  if (scheda.getLastRow() < 2) return 0;
  var valori = scheda.getRange(2, colonna, scheda.getLastRow() - 1, 1).getValues();
  for (var i = valori.length - 1; i >= 0; i--) {
    if (String(valori[i][0]) === String(valore)) return i + 2;
  }
  return 0;
}

function leggiSpese_() {
  var s = scheda_(SCHEDA_SPESE);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_SPESE.length).getValues()
    .map(function (r, i) {
      return {
        riga: i + 2,
        id: String(r[0]),
        data: comeData_(r[1]),
        importo: leggiImporto_(r[2]) || 0,
        fornitore: String(r[3]),
        categoria: String(r[4]) || 'Altro',
        pagamento: String(r[5]),
        nota: String(r[6]),
        foto: String(r[7]),
        inserito: r[8],
        modificato: r[9],
        inseritoDa: String(r[10] || '').replace(/^'/, '')
      };
    })
    .filter(function (sp) { return sp.id || sp.data; });
}

function leggiChiusure_() {
  var s = scheda_(SCHEDA_CHIUSURE);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_CHIUSURE.length).getValues()
    .map(function (r, i) {
      var contanti = leggiImporto_(r[1]) || 0;
      var pos = leggiImporto_(r[2]) || 0;
      var registratore = r[10] === '' || r[10] === null || r[10] === undefined ? null : leggiImporto_(r[10]);
      return {
        riga: i + 2,
        data: comeData_(r[0]),
        contanti: contanti,
        pos: pos,
        fondo: leggiImporto_(r[3]) || 0,
        totale: arrotonda_(contanti + pos),
        note: String(r[5]),
        id: String(r[6] || ''),
        inseritoDa: String(r[9] || '').replace(/^'/, ''),
        registratore: registratore,
        // Ricalcolata (non letta dalla colonna L): resta giusta anche se qualcuno corregge a mano i contanti.
        differenza: registratore === null ? null : arrotonda_(contanti + pos - registratore)
      };
    })
    .filter(function (c) { return c.data; });
}

function delMese_(elenco, anno, mese) {
  var chiave = chiaveMese_(anno, mese);
  return elenco.filter(function (x) {
    return x.data && Utilities.formatDate(x.data, FUSO, 'yyyy-MM') === chiave;
  });
}

function eliminaSpesa(pin, id) {
  return esegui_(pin, function () {
    if (!id) return errore_('Spesa non trovata.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_SPESE);
      var riga = trovaRiga_(scheda, 1, id);
      if (!riga) {
        sincronizzaScadenzaSpesa_(id, null);
        return { ok: true, giaEliminata: true };
      }
      var link = String(scheda.getRange(riga, 8).getValue());
      scheda.deleteRow(riga);
      sincronizzaScadenzaSpesa_(id, null);   // via anche la scadenza collegata nello scadenzario
      cestinaFoto_(link);
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'eliminaSpesa');
}

/** Sposta la foto nel cestino di Drive (recuperabile per 30 giorni). */
function cestinaFoto_(link) {
  var r = /\/d\/([A-Za-z0-9_\-]+)/.exec(link) || /[?&]id=([A-Za-z0-9_\-]+)/.exec(link);
  if (!r) return;
  try {
    DriveApp.getFileById(r[1]).setTrashed(true);
  } catch (e) {
    console.warn('Foto non cestinata: ' + e);
  }
}

// ---------------------------------------------------------------------------
// Chiusura cassa
// ---------------------------------------------------------------------------

function salvaChiusura(pin, dati, sovrascrivi) {
  return esegui_(pin, function () {
    var v = validaChiusura_(dati);
    if (v.errore) return errore_(v.errore);
    var data = v.data;
    // Come per le spese, l'ID arriva dal telefono: se la stessa chiusura viene
    // inviata due volte (rete che cade, coda offline) non si crea un doppione.
    var id = idValido_(dati.id) || Utilities.getUuid();
    var riga = [data, v.contanti, v.pos, v.fondo, v.totale, v.note, id, new Date(), '', leggiPersona_(dati),
      v.registratore === null ? '' : v.registratore, v.differenza === null ? '' : v.differenza];

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_CHIUSURE);
      if (idValido_(dati.id) && trovaRiga_(scheda, COL_CHIUSURE_ID, id) > 0) return { ok: true, giaSalvata: true };
      var esistente = rigaChiusura_(scheda, data);
      if (esistente && !sovrascrivi) {
        return {
          ok: false,
          esiste: true,
          messaggio: 'C\'è già una chiusura cassa per il ' + dataIt_(data) + '. Vuoi sostituirla con questa?'
        };
      }
      if (esistente) {
        scheda.getRange(esistente, 1, 1, riga.length).setValues([riga]);
      } else {
        scheda.appendRow(riga);
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'salvaChiusura');
}

/** Controlla i dati di una chiusura arrivati dal telefono: { errore } oppure i valori puliti. */
function validaChiusura_(dati) {
  dati = dati || {};
  var data = leggiData_(dati.data);
  if (!data) return { errore: 'La data non è valida.' };
  var campi = { contanti: 'incasso in contanti', pos: 'incasso POS/carte', fondo: 'fondo cassa' };
  var valori = { data: data };
  for (var campo in campi) {
    var testo = String(dati[campo] === undefined || dati[campo] === null ? '' : dati[campo]).trim();
    var n = testo ? leggiImporto_(testo) : 0;
    if (n === null) return { errore: 'Il valore "' + campi[campo] + '" non è valido. Esempio: 350,00' };
    valori[campo] = n;
  }
  if (!String(dati.contanti || '').trim() && !String(dati.pos || '').trim()) {
    return { errore: 'Scrivi almeno l\'incasso in contanti o quello POS.' };
  }
  valori.totale = arrotonda_(valori.contanti + valori.pos);
  valori.note = pulisci_(dati.note, 300);

  // Quadratura (facoltativa): totale della chiusura giornaliera del registratore telematico.
  var testoRegistratore = String(dati.registratore === undefined || dati.registratore === null ? '' : dati.registratore).trim();
  valori.registratore = testoRegistratore ? leggiImporto_(testoRegistratore) : null;
  if (testoRegistratore && valori.registratore === null) {
    return { errore: 'Il totale del registratore telematico non è valido. Esempio: 470,50' };
  }
  var q = calcolaQuadratura_(valori.contanti, valori.pos, valori.registratore, tolleranzaCassa_());
  valori.differenza = q ? q.differenza : null;
  // La nota è chiesta dall'app; se manca (es. dato in coda offline con una tolleranza
  // cambiata nel frattempo) il salvataggio non viene bloccato ma resta traccia.
  if (q && !q.entro && !valori.note) valori.note = NOTA_QUADRATURA_MANCANTE;
  return valori;
}

/** L'ID creato dal telefono, se ha un formato accettabile; altrimenti ''. */
function idValido_(id) {
  return /^[A-Za-z0-9\-]{6,40}$/.test(String(id || '')) ? String(id) : '';
}

/** Riga della chiusura di quel giorno (0 se non c'è); rigaEsclusa serve per le modifiche. */
function rigaChiusura_(scheda, data, rigaEsclusa) {
  if (scheda.getLastRow() < 2) return 0;
  var chiave = chiaveGiorno_(data);
  var valori = scheda.getRange(2, 1, scheda.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < valori.length; i++) {
    var d = comeData_(valori[i][0]);
    if (d && chiaveGiorno_(d) === chiave && i + 2 !== rigaEsclusa) return i + 2;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Riepilogo
// ---------------------------------------------------------------------------

/** Totali del mese indicato (se mancano anno/mese: mese corrente) e ultime 10 spese. */
function riepilogo(pin, anno, mese) {
  return esegui_(pin, function () {
    var oggi = annoMeseOggi_();
    anno = Number(anno) || oggi.anno;
    mese = Number(mese) || oggi.mese;
    if (mese < 1 || mese > 12) return errore_('Mese non valido.');

    var tutte = leggiSpese_();
    var tutteChiusure = leggiChiusure_();
    var tutteFatture = leggiFatture_();
    var spese = delMese_(tutte, anno, mese);
    var chiusure = delMese_(tutteChiusure, anno, mese);
    var fatture = delMese_(tutteFatture, anno, mese);
    var eMeseCorrente = anno === oggi.anno && mese === oggi.mese;

    var totaleSpese = somma_(spese, 'importo');
    var totaleFatture = somma_(fatture, 'totale');
    var totaleComplessivo = arrotonda_(totaleSpese + totaleFatture);
    var contanti = somma_(chiusure, 'contanti');
    var pos = somma_(chiusure, 'pos');
    var categorizzazione = statoCategorizzazione_();

    var ultime = aggiungiScadenzeSpese_(tutte.slice(-10).reverse().map(spesaPerTelefono_));

    return {
      ok: true,
      anno: anno,
      mese: mese,
      nomeMese: MESI[mese - 1] + ' ' + anno,
      eMeseCorrente: eMeseCorrente,
      // Per il mese in corso i confronti contano solo i giorni fino a oggi (confronto alla pari).
      andamento: calcolaAndamento_(tutte, tutteFatture, tutteChiusure, anno, mese, eMeseCorrente ? oggi.giorno : 0),
      totaleSpese: totaleSpese,
      numeroSpese: spese.length,
      totaleFatture: totaleFatture,
      numeroFatture: fatture.length,
      totaleComplessivo: totaleComplessivo,
      categorie: raggruppa_(spese.concat(comeSpese_(fatture)), 'categoria'),
      budget: budgetDelMese_(anno, mese, tutte, tutteFatture).map(function (v) {
        return { categoria: v.categoria, tetto: v.tetto, speso: v.speso, percentuale: v.percentuale, residuo: v.residuo, livello: v.livello };
      }),
      contanti: contanti,
      pos: pos,
      incassi: arrotonda_(contanti + pos),
      differenza: arrotonda_(contanti + pos - totaleComplessivo),
      giorniConChiusura: chiusure.length,
      movimenti: totaliMovimenti_(delMese_(leggiMovimenti_(), anno, mese)),
      contanteTeorico: contanteTeoricoAl_(new Date(), tutte, tutteChiusure),
      quadratura: riepilogoQuadratura_(chiusure, tolleranzaCassa_()),
      copertura: riassuntoCopertura_(tutte, tutteFatture, tutteChiusure, anno, mese, oggi),
      fattureDaCategorizzare: categorizzazione.fattureDaCategorizzare,
      fornitoriSenzaCategoria: categorizzazione.fornitoriSenzaCategoria,
      ultime: ultime
    };
  }, 'riepilogo');
}

/** Le fatture nello stesso formato delle spese, per sommarle per categoria/fornitore. */
function comeSpese_(fatture) {
  return fatture.map(function (f) {
    return { categoria: f.categoria, fornitore: f.fornitore, importo: f.totale, pagamento: 'Fattura' };
  });
}

function somma_(elenco, campo) {
  return arrotonda_(elenco.reduce(function (t, x) { return t + (Number(x[campo]) || 0); }, 0));
}

function arrotonda_(n) {
  return Math.round(n * 100) / 100;
}

/** Raggruppa e somma gli importi per campo, dal più alto al più basso. */
function raggruppa_(spese, campo) {
  var totali = {};
  spese.forEach(function (sp) {
    var chiave = String(sp[campo] || '').replace(/^'/, '') || 'Non indicato';
    totali[chiave] = (totali[chiave] || 0) + sp.importo;
  });
  return Object.keys(totali)
    .map(function (k) { return { nome: k, totale: arrotonda_(totali[k]) }; })
    .sort(function (a, b) { return b.totale - a.totale; });
}
