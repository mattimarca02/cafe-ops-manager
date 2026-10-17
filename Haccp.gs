/**
 * Bar - Spese & Cassa: registro dei controlli HACCP.
 *
 * - Scheda "Controlli HACCP": l'elenco dei controlli da fare (configurabile):
 *   nome, tipo (spunta / temperatura con min e max / nota), frequenza
 *   (giornaliera o settimanale), attivo SI/NO. Gli esempi creati dal setup
 *   sono SOLO indicativi: vanno confermati con il consulente HACCP o l'ASL.
 * - Scheda "HACCP": il registro, una riga per ogni controllo fatto
 *   (data, ora, controllo, valore, esito, azione correttiva, persona).
 * - App → "Controlli di oggi": i controlli da fare oggi e questa settimana.
 * - promemoriaHaccp() (attivatore ogni ora): email se dopo l'ora limite
 *   (Impostazioni) un controllo giornaliero non è stato fatto.
 * - Registro del mese in PDF (dal modello ModelloHaccp.html), salvato nella
 *   cartella Drive "Bar - HACCP": dall'app, dal menu Bar e ogni mese in automatico.
 */

var SCHEDA_CONTROLLI_HACCP = 'Controlli HACCP';
var SCHEDA_HACCP = 'HACCP';
var NOME_CARTELLA_HACCP = 'Bar - HACCP';
var INTESTAZIONI_CONTROLLI_HACCP = ['Controllo', 'Tipo (spunta/temperatura/nota)', 'Min (°C)', 'Max (°C)',
  'Frequenza (giornaliera/settimanale)', 'Attivo (SI/NO)', 'Istruzioni', 'ID'];
var INTESTAZIONI_HACCP = ['Data', 'Ora', 'Controllo', 'Tipo', 'Valore', 'Esito', 'Azione correttiva / Note', 'Persona',
  'ID controllo', 'ID', 'Inserito il'];
var TIPI_HACCP = ['spunta', 'temperatura', 'nota'];
var FREQUENZE_HACCP = ['giornaliera', 'settimanale'];
var ESITO_HACCP_OK = 'OK';
var ESITO_HACCP_FUORI = 'FUORI RANGE';
var ESITO_HACCP_FATTO = 'Fatto';
var ESITO_HACCP_NOTA = 'Annotato';
var NOTA_HACCP_MANCANTE = 'Azione correttiva non indicata';
var ORA_HACCP_PREDEFINITA = '11:00';
var PROPRIETA_PROMEMORIA_HACCP = 'haccpPromemoriaInviatoIl';
var NOTA_ESEMPIO_HACCP = 'ESEMPIO da confermare con il consulente HACCP o l\'ASL (valori e frequenza indicativi).';

// Colonne (da 1) della scheda HACCP
var HA_DATA = 1, HA_ORA = 2, HA_CONTROLLO = 3, HA_TIPO = 4, HA_VALORE = 5, HA_ESITO = 6, HA_NOTE = 7, HA_PERSONA = 8,
  HA_ID_CONTROLLO = 9, HA_ID = 10, HA_INSERITO = 11;

// ---------------------------------------------------------------------------
// Preparazione delle schede (chiamata da setup)
// ---------------------------------------------------------------------------

function preparaSchedeHaccp_(ss) {
  var c = preparaScheda_(ss, SCHEDA_CONTROLLI_HACCP, INTESTAZIONI_CONTROLLI_HACCP);
  c.getRange('H:H').setNumberFormat('@');
  c.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(TIPI_HACCP, true).setAllowInvalid(false).setHelpText('Scegli: ' + TIPI_HACCP.join(', ')).build());
  c.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(FREQUENZE_HACCP, true).setAllowInvalid(false).setHelpText('Scegli: ' + FREQUENZE_HACCP.join(', ')).build());
  c.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['SI', 'NO'], true).setAllowInvalid(true).build());
  c.setColumnWidth(1, 300);
  c.setColumnWidth(2, 190);
  c.setColumnWidth(5, 220);
  c.setColumnWidth(7, 420);
  if (c.getLastRow() < 2) {
    var esempi = [
      ['Temperatura frigo bevande', 'temperatura', 0, 8, 'giornaliera', 'SI', NOTA_ESEMPIO_HACCP, 'H-frigo-bevande'],
      ['Temperatura frigo alimenti', 'temperatura', 0, 4, 'giornaliera', 'SI', NOTA_ESEMPIO_HACCP, 'H-frigo-alimenti'],
      ['Temperatura congelatore', 'temperatura', -25, -18, 'giornaliera', 'SI', NOTA_ESEMPIO_HACCP, 'H-congelatore'],
      ['Pulizia piano di lavoro e macchina del caffè', 'spunta', '', '', 'giornaliera', 'SI', NOTA_ESEMPIO_HACCP, 'H-pulizia-piano'],
      ['Controllo date di scadenza della merce', 'spunta', '', '', 'settimanale', 'SI', NOTA_ESEMPIO_HACCP, 'H-scadenze-merce'],
      ['Pulizia bagni', 'spunta', '', '', 'giornaliera', 'SI', NOTA_ESEMPIO_HACCP, 'H-pulizia-bagni']
    ];
    c.getRange(2, 1, esempi.length, esempi[0].length).setValues(esempi);
  }

  var r = preparaScheda_(ss, SCHEDA_HACCP, INTESTAZIONI_HACCP);
  r.getRange('A:A').setNumberFormat(FORMATO_DATA);
  r.getRange('B:B').setNumberFormat('@');
  r.getRange('I:J').setNumberFormat('@');
  r.getRange('K:K').setNumberFormat(FORMATO_DATA_ORA);
  r.setColumnWidth(3, 300);
  r.setColumnWidth(7, 360);
}

// ---------------------------------------------------------------------------
// Calcoli (funzioni "pure", provate da testHaccp)
// ---------------------------------------------------------------------------

/** "3,5" / "-18" / "−18,5" / 4 → numero; null se non è una temperatura plausibile. */
function leggiTemperatura_(v) {
  if (typeof v === 'number') return isFinite(v) && v >= -60 && v <= 150 ? Math.round(v * 10) / 10 : null;
  var s = String(v === undefined || v === null ? '' : v).replace(/[°C\s]/gi, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  var n = Math.round(parseFloat(s) * 10) / 10;
  return n >= -60 && n <= 150 ? n : null;
}

/** Vero se la temperatura è sotto il minimo o sopra il massimo (gli estremi sono ammessi). */
function fuoriRangeHaccp_(valore, min, max) {
  if (valore === null || valore === undefined) return false;
  return (min !== null && min !== undefined && valore < min) || (max !== null && max !== undefined && valore > max);
}

/** Lunedì della settimana della data ('AAAA-MM-GG'): le settimane vanno da lunedì a domenica. */
function lunediDellaSettimana_(data) {
  var giorno = Number(Utilities.formatDate(data, FUSO, 'u')); // 1 = lunedì … 7 = domenica
  return chiaveGiorno_(aggiungiGiorni_(data, 1 - giorno));
}

/** "11:30" / "11" / "9.15" / Date (cella in formato ora) → minuti dalla mezzanotte; null se non valida. */
function minutiDaOra_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Number(Utilities.formatDate(v, FUSO, 'H')) * 60 + Number(Utilities.formatDate(v, FUSO, 'm'));
  }
  var r = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(String(v === undefined || v === null ? '' : v).trim());
  if (!r) return null;
  var ore = Number(r[1]);
  var minuti = Number(r[2] || 0);
  return ore <= 23 && minuti <= 59 ? ore * 60 + minuti : null;
}

function testoOra_(minuti) {
  return due_(Math.floor(minuti / 60)) + ':' + due_(minuti % 60);
}

/**
 * Stato dei controlli attivi a una certa data.
 * controlli: [{ id, nome, tipo, min, max, frequenza, attivo, istruzioni }]
 * registrazioni: [{ data (Date), ora ('HH:mm'), idControllo, controllo, valore, esito, note, persona, riga }]
 * Un controllo giornaliero è fatto se c'è una registrazione quel giorno; uno
 * settimanale se c'è nella stessa settimana (lunedì–domenica).
 */
function statoControlliHaccp_(controlli, registrazioni, oggi) {
  var chiaveOggi = chiaveGiorno_(oggi);
  var lunedi = lunediDellaSettimana_(oggi);
  var domenica = chiaveGiorno_(aggiungiGiorni_(leggiData_(lunedi), 6));
  return controlli.filter(function (c) { return c.attivo && c.nome; }).map(function (c) {
    var settimanale = c.frequenza === 'settimanale';
    var ultima = null;
    registrazioni.forEach(function (r) {
      if (!r.data) return;
      // Per ID e, in più, per nome (se l'ID del controllo fosse stato riscritto nel foglio).
      var stesso = (r.idControllo && r.idControllo === c.id) || r.controllo === c.nome;
      if (!stesso) return;
      var k = chiaveGiorno_(r.data);
      if (settimanale ? (k < lunedi || k > domenica) : k !== chiaveOggi) return;
      if (!ultima || k + ' ' + r.ora > chiaveGiorno_(ultima.data) + ' ' + ultima.ora ||
          (k + ' ' + r.ora === chiaveGiorno_(ultima.data) + ' ' + ultima.ora && (r.riga || 0) > (ultima.riga || 0))) {
        ultima = r;
      }
    });
    return {
      id: c.id, nome: c.nome, tipo: c.tipo, min: c.min, max: c.max, frequenza: settimanale ? 'settimanale' : 'giornaliera',
      istruzioni: c.istruzioni, fatto: !!ultima, ultima: ultima
    };
  });
}

/** Controlli giornalieri (e, la domenica, settimanali) ancora da fare: per il promemoria. */
function controlliDaSollecitare_(stato, oggi) {
  var domenica = Number(Utilities.formatDate(oggi, FUSO, 'u')) === 7;
  return stato.filter(function (c) { return !c.fatto && (c.frequenza === 'giornaliera' || domenica); });
}

/**
 * Giorni del mese in cui mancano dei controlli giornalieri (per il PDF).
 * Si contano i giorni fino a "finoA" compreso. Restituisce [{ data: 'gg/mm/aaaa', mancanti: ['nome', …] }].
 */
function giorniConControlliMancanti_(controlli, registrazioni, anno, mese, finoA) {
  var giornalieri = controlli.filter(function (c) { return c.attivo && c.nome && c.frequenza !== 'settimanale'; });
  var fatti = {};
  registrazioni.forEach(function (r) {
    if (r.data) fatti[chiaveGiorno_(r.data) + '|' + (r.idControllo || r.controllo)] = true;
  });
  var risultato = [];
  var chiaveFine = finoA ? chiaveGiorno_(finoA) : '9999';
  for (var g = 1; g <= giorniNelMese_(anno, mese); g++) {
    var chiave = anno + '-' + due_(mese) + '-' + due_(g);
    if (chiave > chiaveFine) break;
    var mancanti = giornalieri.filter(function (c) {
      return !fatti[chiave + '|' + c.id] && !fatti[chiave + '|' + c.nome];
    }).map(function (c) { return c.nome; });
    if (mancanti.length) risultato.push({ data: dataIt_(leggiData_(chiave)), mancanti: mancanti });
  }
  return risultato;
}

// ---------------------------------------------------------------------------
// Lettura delle schede
// ---------------------------------------------------------------------------

function leggiControlliHaccp_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_CONTROLLI_HACCP);
  if (!s || s.getLastRow() < 2) return [];
  var numero = function (v) { return v === '' || v === null || v === undefined ? null : leggiTemperatura_(v); };
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_CONTROLLI_HACCP.length).getValues().map(function (r, i) {
    var tipo = String(r[1]).toLowerCase().trim();
    return {
      riga: i + 2,
      nome: String(r[0]).replace(/^'/, '').trim(),
      tipo: TIPI_HACCP.indexOf(tipo) >= 0 ? tipo : 'spunta',
      min: numero(r[2]),
      max: numero(r[3]),
      frequenza: /^sett/i.test(String(r[4]).trim()) ? 'settimanale' : 'giornaliera',
      attivo: !/^(NO|N|FALSE)$/i.test(String(r[5]).trim()) && r[5] !== false,
      istruzioni: String(r[6]).replace(/^'/, '').trim(),
      id: String(r[7] || '')
    };
  }).filter(function (c) { return c.nome; });
}

/** I controlli scritti a mano nel foglio ricevono un ID (serve a collegarli al registro). */
function assicuraIdControlliHaccp_(controlli) {
  if (!controlli.some(function (c) { return !c.id; })) return controlli;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Riletti dentro il lock: un altro telefono potrebbe averli appena scritti.
    var aggiornati = leggiControlliHaccp_();
    var s = scheda_(SCHEDA_CONTROLLI_HACCP);
    aggiornati.forEach(function (c) {
      if (c.id) return;
      c.id = 'H' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
      s.getRange(c.riga, 8).setValue(c.id);
    });
    return aggiornati;
  } finally {
    lock.releaseLock();
  }
}

function leggiRegistroHaccp_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_HACCP);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_HACCP.length).getValues().map(function (r, i) {
    var ora = r[HA_ORA - 1];
    var minuti = minutiDaOra_(ora);
    return {
      riga: i + 2,
      data: comeData_(r[HA_DATA - 1]),
      ora: minuti === null ? '' : testoOra_(minuti),
      controllo: String(r[HA_CONTROLLO - 1]).replace(/^'/, ''),
      tipo: String(r[HA_TIPO - 1]),
      valore: r[HA_VALORE - 1],
      esito: String(r[HA_ESITO - 1]),
      note: String(r[HA_NOTE - 1]).replace(/^'/, ''),
      persona: String(r[HA_PERSONA - 1]).replace(/^'/, ''),
      idControllo: String(r[HA_ID_CONTROLLO - 1] || ''),
      id: String(r[HA_ID - 1] || '')
    };
  }).filter(function (r) { return r.data; });
}

/** "3,5 °C", "Fatto", testo della nota. */
function valoreHaccpLeggibile_(r) {
  if (r.tipo === 'temperatura') {
    var t = leggiTemperatura_(r.valore);
    return t === null ? String(r.valore) : String(t).replace('.', ',') + ' °C';
  }
  return String(r.valore === undefined || r.valore === null ? '' : r.valore).replace(/^'/, '');
}

function oraLimiteHaccp_() {
  var scheda = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_IMPOSTAZIONI);
  var riga = scheda ? rigaImpostazione_(scheda, IMP_ORA_HACCP) : 0;
  // Il testo mostrato nella cella ("11:00"): se Fogli l'ha trasformata in orario, il valore
  // sarebbe una data del 1899 che con il fuso di allora sposterebbe i minuti.
  var minuti = riga ? minutiDaOra_(scheda.getRange(riga, 2).getDisplayValues()[0][0]) : null;
  return minuti === null ? minutiDaOra_(ORA_HACCP_PREDEFINITA) : minuti;
}

/** Vero se il registro HACCP è in uso (almeno una registrazione): prima non si mandano promemoria. */
function haccpInUso_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_HACCP);
  return !!s && s.getLastRow() >= 2;
}

// ---------------------------------------------------------------------------
// Funzioni chiamate dall'app
// ---------------------------------------------------------------------------

/** Controlli da fare oggi e questa settimana, con l'ultima registrazione di ognuno. */
function controlliHaccp(pin) {
  return esegui_(pin, function () {
    var oggi = new Date();
    var controlli = assicuraIdControlliHaccp_(leggiControlliHaccp_());
    var stato = statoControlliHaccp_(controlli, leggiRegistroHaccp_(), oggi);
    var lunedi = leggiData_(lunediDellaSettimana_(oggi));
    var mesi = [];
    var am = annoMeseOggi_();
    for (var k = 0; k < 12; k++) {
      var m = spostaMese_(am.anno, am.mese, -k);
      mesi.push({ valore: chiaveMese_(m.anno, m.mese), nome: MESI[m.mese - 1] + ' ' + m.anno });
    }
    return {
      ok: true,
      oggi: GIORNI_SETTIMANA[Number(Utilities.formatDate(oggi, FUSO, 'u'))] + ' ' + dataIt_(oggi),
      settimana: 'dal ' + dataIt_(lunedi) + ' al ' + dataIt_(aggiungiGiorni_(lunedi, 6)),
      oraLimite: testoOra_(oraLimiteHaccp_()),
      controlli: stato.map(controlloHaccpPerTelefono_),
      configurato: !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_CONTROLLI_HACCP),
      mesi: mesi
    };
  }, 'controlliHaccp');
}

function controlloHaccpPerTelefono_(c) {
  var u = c.ultima;
  return {
    id: c.id, nome: c.nome, tipo: c.tipo, min: c.min, max: c.max, frequenza: c.frequenza, istruzioni: c.istruzioni,
    fatto: c.fatto,
    ultima: u ? {
      data: dataIt_(u.data), ora: u.ora, valore: valoreHaccpLeggibile_(u), esito: u.esito, note: u.note, persona: u.persona
    } : null
  };
}

/**
 * Registra un controllo fatto. dati: { id (creato dal telefono), idControllo, nome, tipo,
 * valore (temperatura o testo), note (azione correttiva), persona, data ('AAAA-MM-GG'), ora ('HH:mm') }.
 */
function registraControlloHaccp(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var id = idValido_(dati.id) || Utilities.getUuid();
    var controllo = null;
    leggiControlliHaccp_().forEach(function (c) { if (c.id && c.id === String(dati.idControllo || '')) controllo = c; });
    // Se nel frattempo il controllo è stato tolto dal foglio (dato in coda offline) si usano i dati arrivati dal telefono.
    var nome = controllo ? controllo.nome : pulisci_(dati.nome, 120);
    var tipo = controllo ? controllo.tipo : (TIPI_HACCP.indexOf(dati.tipo) >= 0 ? dati.tipo : 'spunta');
    if (!nome) return errore_('Controllo non trovato.');
    var note = pulisci_(dati.note, 300);
    var valore, esito;
    if (tipo === 'temperatura') {
      valore = leggiTemperatura_(dati.valore);
      if (valore === null) return errore_('Scrivi la temperatura in gradi. Esempio: 3,5 oppure -18');
      var fuori = controllo ? fuoriRangeHaccp_(valore, controllo.min, controllo.max) :
        fuoriRangeHaccp_(valore, leggiTemperatura_(dati.min), leggiTemperatura_(dati.max));
      esito = fuori ? ESITO_HACCP_FUORI : ESITO_HACCP_OK;
      // L'azione correttiva la chiede l'app; se manca il dato non viene perso.
      if (fuori && !note) note = NOTA_HACCP_MANCANTE;
    } else if (tipo === 'nota') {
      valore = pulisci_(dati.valore, 300);
      if (!valore) return errore_('Scrivi la nota.');
      esito = ESITO_HACCP_NOTA;
    } else {
      valore = ESITO_HACCP_FATTO;
      esito = ESITO_HACCP_FATTO;
    }
    var adesso = new Date();
    var data = leggiData_(dati.data) || leggiData_(chiaveGiorno_(adesso));
    if (chiaveGiorno_(data) > chiaveGiorno_(aggiungiGiorni_(adesso, 1))) data = leggiData_(chiaveGiorno_(adesso));
    var minuti = minutiDaOra_(dati.ora);
    var ora = minuti === null ? Utilities.formatDate(adesso, FUSO, 'HH:mm') : testoOra_(minuti);

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_HACCP);
      if (trovaRiga_(scheda, HA_ID, id) > 0) return { ok: true, giaSalvata: true };
      scheda.appendRow([data, ora, testoSicuro_(nome), tipo, valore, esito, note, leggiPersona_(dati),
        controllo ? controllo.id : idValido_(dati.idControllo), id, adesso]);
    } finally {
      lock.releaseLock();
    }
    return { ok: true, esito: esito };
  }, 'registraControlloHaccp');
}

/** Quanti controlli (di oggi e della settimana) sono ancora da fare: per il numerino nella home. */
function contaHaccpDaFare_() {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_CONTROLLI_HACCP)) return 0;
  return statoControlliHaccp_(leggiControlliHaccp_(), leggiRegistroHaccp_(), new Date())
    .filter(function (c) { return !c.fatto; }).length;
}

/** Dall'app: crea (o ricrea) il PDF del registro del mese e ne restituisce il link. mese: 'AAAA-MM'. */
function esportaHaccpPdf(pin, chiaveMese) {
  return esegui_(pin, function () {
    var r = /^(\d{4})-(\d{2})$/.exec(String(chiaveMese || ''));
    var oggi = annoMeseOggi_();
    var anno = r ? Number(r[1]) : oggi.anno;
    var mese = r ? Number(r[2]) : oggi.mese;
    if (mese < 1 || mese > 12) return errore_('Mese non valido.');
    var file = creaPdfHaccp_(anno, mese);
    return { ok: true, url: file.url, nome: file.nome, righe: file.righe };
  }, 'esportaHaccpPdf');
}

// ---------------------------------------------------------------------------
// Promemoria via email (attivatore ogni ora)
// ---------------------------------------------------------------------------

function promemoriaHaccp() {
  eseguiAttivatore_('promemoriaHaccp', function () {
    return inviaPromemoriaHaccp_(new Date());
  });
}

/**
 * Se è passata l'ora limite e ci sono controlli giornalieri non fatti, manda un'email
 * (una sola volta al giorno). La domenica ricorda anche i settimanali non fatti.
 */
function inviaPromemoriaHaccp_(adesso) {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_CONTROLLI_HACCP)) return { inviata: false };
  // Finché nessuno ha mai registrato un controllo (registro non ancora usato, esempi non confermati) niente email.
  if (!haccpInUso_()) return { inviata: false, motivo: 'registro HACCP non ancora usato' };
  var minutiAdesso = Number(Utilities.formatDate(adesso, FUSO, 'H')) * 60 + Number(Utilities.formatDate(adesso, FUSO, 'm'));
  var limite = oraLimiteHaccp_();
  if (minutiAdesso < limite) return { inviata: false, motivo: 'prima dell\'ora limite' };
  var proprieta = PropertiesService.getScriptProperties();
  var chiaveOggi = chiaveGiorno_(adesso);
  if (proprieta.getProperty(PROPRIETA_PROMEMORIA_HACCP) === chiaveOggi) return { inviata: false, motivo: 'già inviato oggi' };
  var mancanti = controlliDaSollecitare_(statoControlliHaccp_(leggiControlliHaccp_(), leggiRegistroHaccp_(), adesso), adesso);
  if (!mancanti.length) return { inviata: false, motivo: 'tutto fatto' };

  var destinatario = leggiImpostazione_(IMP_EMAIL_HACCP) || leggiImpostazione_(IMP_EMAIL_TITOLARE) ||
    Session.getEffectiveUser().getEmail();
  var righe = mancanti.map(function (c) {
    return c.nome + (c.frequenza === 'settimanale' ? ' (settimanale: oggi è l\'ultimo giorno della settimana)' : '');
  });
  MailApp.sendEmail({
    to: destinatario,
    subject: 'Bar – HACCP: ' + mancanti.length + (mancanti.length === 1 ? ' controllo non ancora fatto' : ' controlli non ancora fatti') +
      ' oggi',
    htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:680px;">' +
      '<h2 style="margin:0 0 6px 0;">Controlli HACCP di oggi</h2>' +
      '<p>Alle ' + testoOra_(limite) + ' questi controlli non risultano ancora registrati:</p><ul>' +
      righe.map(function (t) { return '<li style="margin:4px 0;">' + esc_(t) + '</li>'; }).join('') + '</ul>' +
      '<p style="color:#555;">Apri l\'app → <b>Controlli di oggi</b> per registrarli.</p></div>',
    body: 'Controlli HACCP non ancora registrati oggi (ora limite ' + testoOra_(limite) + '):\n\n- ' + righe.join('\n- ') +
      '\n\nApri l\'app → Controlli di oggi per registrarli.',
    name: NOME_APP
  });
  proprieta.setProperty(PROPRIETA_PROMEMORIA_HACCP, chiaveOggi);
  return { inviata: true, mancanti: mancanti.length, destinatario: destinatario };
}

// ---------------------------------------------------------------------------
// Registro del mese in PDF
// ---------------------------------------------------------------------------

function cartellaHaccp_() {
  var id = leggiImpostazione_(IMP_ID_CARTELLA_HACCP);
  if (id) {
    try {
      var c = DriveApp.getFolderById(id);
      if (!c.isTrashed()) return c;
    } catch (e) {
      console.warn('Cartella HACCP non trovata, ne cerco/creo un\'altra: ' + e);
    }
  }
  var trovate = DriveApp.getRootFolder().getFoldersByName(NOME_CARTELLA_HACCP);
  var cartella = trovate.hasNext() ? trovate.next() : DriveApp.createFolder(NOME_CARTELLA_HACCP);
  scriviImpostazione_(IMP_ID_CARTELLA_HACCP, cartella.getId());
  return cartella;
}

/** Tutto quello che serve al modello ModelloHaccp.html (solo testi, già pronti da stampare). */
function datiPdfHaccp_(anno, mese, adesso) {
  adesso = adesso || new Date();
  var chiave = chiaveMese_(anno, mese);
  var controlli = leggiControlliHaccp_();
  var registrazioni = leggiRegistroHaccp_().filter(function (r) {
    return Utilities.formatDate(r.data, FUSO, 'yyyy-MM') === chiave;
  }).sort(function (a, b) {
    var ka = chiaveGiorno_(a.data) + ' ' + a.ora;
    var kb = chiaveGiorno_(b.data) + ' ' + b.ora;
    return ka < kb ? -1 : ka > kb ? 1 : a.riga - b.riga;
  });
  var meseCorrente = chiave === Utilities.formatDate(adesso, FUSO, 'yyyy-MM');
  var intervallo = function (c) {
    if (c.tipo !== 'temperatura') return '';
    var t = function (n) { return String(n).replace('.', ','); };
    if (c.min !== null && c.max !== null) return 'da ' + t(c.min) + ' a ' + t(c.max) + ' °C';
    if (c.min !== null) return 'almeno ' + t(c.min) + ' °C';
    if (c.max !== null) return 'al massimo ' + t(c.max) + ' °C';
    return '';
  };
  return {
    titolo: 'Registro dei controlli HACCP',
    mese: MESI[mese - 1] + ' ' + anno,
    creatoIl: Utilities.formatDate(adesso, FUSO, FORMATO_DATA_ORA),
    nota: meseCorrente ? 'Mese in corso: registrazioni fino al ' + dataIt_(adesso) + '.' : '',
    controlli: controlli.filter(function (c) { return c.attivo; }).map(function (c) {
      return { nome: c.nome, tipo: c.tipo, limiti: intervallo(c), frequenza: c.frequenza };
    }),
    righe: registrazioni.map(function (r) {
      return {
        data: dataIt_(r.data), ora: r.ora, controllo: r.controllo, valore: valoreHaccpLeggibile_(r),
        esito: r.esito, fuori: r.esito === ESITO_HACCP_FUORI, persona: r.persona, note: r.note
      };
    }),
    fuoriRange: registrazioni.filter(function (r) { return r.esito === ESITO_HACCP_FUORI; }).length,
    mancanti: giorniConControlliMancanti_(controlli, registrazioni, anno, mese, meseCorrente ? adesso : null)
  };
}

/** Crea il PDF del registro del mese nella cartella "Bar - HACCP" (sostituisce quello vecchio dello stesso mese). */
function creaPdfHaccp_(anno, mese) {
  var dati = datiPdfHaccp_(anno, mese, new Date());
  var modello = HtmlService.createTemplateFromFile('ModelloHaccp');
  modello.d = dati;
  var nome = 'Registro HACCP ' + chiaveMese_(anno, mese) + '.pdf';
  var blob = modello.evaluate().getAs('application/pdf').setName(nome);
  var cartella = cartellaHaccp_();
  var vecchi = cartella.getFilesByName(nome);
  while (vecchi.hasNext()) vecchi.next().setTrashed(true);
  var file = cartella.createFile(blob);
  return { url: file.getUrl(), nome: nome, righe: dati.righe.length };
}

/** Dal menu "Bar": PDF del mese scorso. */
function esportaRegistroHaccpDaMenu() {
  if (!permessoRaro_('pdfHaccp', 60)) return avvisa_('Il PDF è appena stato creato: riprova tra un minuto.');
  var oggi = annoMeseOggi_();
  var m = spostaMese_(oggi.anno, oggi.mese, -1);
  var file = creaPdfHaccp_(m.anno, m.mese);
  avvisa_('Registro HACCP di ' + MESI[m.mese - 1] + ' ' + m.anno + ' creato ✓\n\n"' + file.nome + '" nella cartella "' +
    NOME_CARTELLA_HACCP + '" di Google Drive (' + file.righe + ' controlli registrati).\n\n' + file.url);
}
