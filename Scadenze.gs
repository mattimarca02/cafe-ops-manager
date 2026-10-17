/**
 * Bar - Spese & Cassa: scadenzario.
 *
 * Scheda "Scadenze": una riga per ogni pagamento da fare. Viene riempita
 *   - in automatico dalle scadenze di pagamento delle fatture importate;
 *   - in automatico dalle scadenze ricorrenti (scheda "Scadenze ricorrenti":
 *     affitto, utenze, F24… con frequenza mensile, trimestrale, annuale…);
 *   - a mano (riga scritta nel foglio o dal pulsante "Nuova scadenza" dell'app);
 *   - dalle spese senza fattura con il campo "Da pagare entro" compilato.
 *
 * promemoriaScadenze() (attivatore giornaliero) invia un'email N giorni prima
 * (N nella scheda Impostazioni) e il giorno della scadenza.
 */

var SCHEDA_SCADENZE = 'Scadenze';
var SCHEDA_RICORRENTI = 'Scadenze ricorrenti';
var INTESTAZIONI_SCADENZE = ['ID', 'Scadenza', 'Descrizione', 'Importo', 'Tipo', 'Origine', 'Pagata (SI/NO)',
  'Pagata il', 'Pagata da', 'Preavviso inviato il', 'Avviso del giorno inviato il', 'Note'];
var INTESTAZIONI_RICORRENTI = ['Descrizione', 'Importo', 'Frequenza', 'Prima scadenza', 'Ultima scadenza (facoltativa)',
  'Attiva (SI/NO)', 'Note', 'ID'];
var FREQUENZE = ['mensile', 'bimestrale', 'trimestrale', 'quadrimestrale', 'semestrale', 'annuale'];
var MESI_FREQUENZA = { mensile: 1, bimestrale: 2, trimestrale: 3, quadrimestrale: 4, semestrale: 6, annuale: 12 };
var TIPO_FATTURA = 'Fattura';
var TIPO_RICORRENTE = 'Ricorrente';
var TIPO_MANUALE = 'A mano';
var TIPO_SPESA = 'Spesa';
var PREFISSO_ORIGINE_SPESA = 'S|';   // origine = 'S|' + ID della spesa: una sola scadenza per spesa
var PREAVVISO_PREDEFINITO = 3;
var GIORNI_FUTURI_RICORRENTI = 60;   // le ricorrenti vengono scritte fino a 60 giorni avanti
var GIORNI_PASSATI_RICORRENTI = 31;  // e fino a un mese indietro (se l'attivatore era spento)
var GIORNI_PASSATI_FATTURE = 60;     // fatture con scadenza più vecchia di 60 giorni: ignorate
var GIORNI_SCHERMATA = 30;
var PROPRIETA_SCADENZE_AVVIATE = 'scadenzeFattureAvviateIl';
var PROPRIETA_MODELLI_FISSI = 'modelliScadenzeFisseAggiunti';
var PREFISSO_MODELLO_FISSO = 'RM-';
var NOTA_MODELLO_FISSO = 'MODELLO: scrivi la data della prossima scadenza e attivala (anche dall\'app: Scadenze → Scadenze fisse del locale)';

/** Scadenze fisse del locale: modelli pronti e disattivati, con la data da compilare. */
var MODELLI_SCADENZE_FISSE = [
  { id: 'RM-estintori', descrizione: 'Controllo estintori', frequenza: 'semestrale' },
  { id: 'RM-macchina-caffe', descrizione: 'Manutenzione macchina del caffè', frequenza: 'annuale' },
  { id: 'RM-assicurazione', descrizione: 'Assicurazione del locale', frequenza: 'annuale' },
  { id: 'RM-siae', descrizione: 'SIAE / licenze musicali', frequenza: 'annuale' },
  { id: 'RM-canone-rai', descrizione: 'Canone RAI speciale', frequenza: 'annuale' },
  { id: 'RM-tari', descrizione: 'TARI (tassa rifiuti)', frequenza: 'semestrale' },
  { id: 'RM-impianti', descrizione: 'Revisione impianti (elettrico, gas, caldaia)', frequenza: 'annuale' }
];

// Colonne (da 1) della scheda Scadenze
var SC_ID = 1, SC_DATA = 2, SC_DESCRIZIONE = 3, SC_IMPORTO = 4, SC_TIPO = 5, SC_ORIGINE = 6, SC_PAGATA = 7,
  SC_PAGATA_IL = 8, SC_PAGATA_DA = 9, SC_PREAVVISO = 10, SC_AVVISO = 11, SC_NOTE = 12;

// ---------------------------------------------------------------------------
// Preparazione delle schede (chiamata da setup)
// ---------------------------------------------------------------------------

function preparaSchedeScadenze_(ss) {
  var sc = preparaScheda_(ss, SCHEDA_SCADENZE, INTESTAZIONI_SCADENZE);
  sc.getRange('A:A').setNumberFormat('@');
  sc.getRange('B:B').setNumberFormat(FORMATO_DATA);
  sc.getRange('D:D').setNumberFormat(FORMATO_EURO);
  sc.getRange('H:H').setNumberFormat(FORMATO_DATA);
  sc.getRange('J:K').setNumberFormat(FORMATO_DATA_ORA);
  sc.getRange('G2:G').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['SI', 'NO'], true).setAllowInvalid(true).build());
  sc.setColumnWidth(3, 300);
  sc.setColumnWidth(6, 220);

  var ric = preparaScheda_(ss, SCHEDA_RICORRENTI, INTESTAZIONI_RICORRENTI);
  ric.getRange('B:B').setNumberFormat(FORMATO_EURO);
  ric.getRange('D:E').setNumberFormat(FORMATO_DATA);
  ric.getRange('H:H').setNumberFormat('@');
  ric.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(FREQUENZE, true).setAllowInvalid(false)
    .setHelpText('Scegli: ' + FREQUENZE.join(', ')).build());
  ric.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['SI', 'NO'], true).setAllowInvalid(true).build());
  ric.setColumnWidth(1, 240);
  ric.setColumnWidth(5, 190);
  ric.setColumnWidth(7, 320);
  if (ric.getLastRow() < 2) {
    var oggi = annoMeseOggi_();
    var prossimoMese = oggi.mese === 12 ? 1 : oggi.mese + 1;
    var anno = oggi.mese === 12 ? oggi.anno + 1 : oggi.anno;
    var esempi = [
      ['Affitto del locale', 800, 'mensile', leggiData_(anno + '-' + due_(prossimoMese) + '-05'), '', 'NO',
        'ESEMPIO: correggi importo e data e metti SI in "Attiva" per usarla'],
      ['Bolletta luce', 250, 'bimestrale', leggiData_(anno + '-' + due_(prossimoMese) + '-20'), '', 'NO',
        'ESEMPIO: metti SI per attivarla, oppure cancella la riga'],
      ['F24 contributi', 1100, 'trimestrale', leggiData_(anno + '-' + due_(prossimoMese) + '-16'), '', 'NO',
        'ESEMPIO: metti SI per attivarla, oppure cancella la riga']
    ];
    ric.getRange(2, 1, esempi.length, 7).setValues(esempi);
  }
  aggiungiModelliScadenzeFisse_(ric);
}

/**
 * Aggiunge (una volta sola) i modelli delle scadenze fisse del locale, disattivati e senza data.
 * Se un modello viene cancellato dal foglio non ricompare al setup successivo.
 */
function aggiungiModelliScadenzeFisse_(ric) {
  var proprieta = PropertiesService.getScriptProperties();
  var aggiunti = (proprieta.getProperty(PROPRIETA_MODELLI_FISSI) || '').split(',');
  var presenti = {};
  if (ric.getLastRow() >= 2) {
    ric.getRange(2, 8, ric.getLastRow() - 1, 1).getValues().forEach(function (r) { presenti[String(r[0])] = true; });
  }
  var nuovi = MODELLI_SCADENZE_FISSE.filter(function (m) { return aggiunti.indexOf(m.id) < 0 && !presenti[m.id]; });
  if (nuovi.length) {
    ric.getRange(ric.getLastRow() + 1, 1, nuovi.length, INTESTAZIONI_RICORRENTI.length).setValues(nuovi.map(function (m) {
      return [m.descrizione, '', m.frequenza, '', '', 'NO', NOTA_MODELLO_FISSO, m.id];
    }));
  }
  proprieta.setProperty(PROPRIETA_MODELLI_FISSI, MODELLI_SCADENZE_FISSE.map(function (m) { return m.id; })
    .concat(aggiunti.filter(function (id) { return id; })).filter(function (id, i, tutti) { return tutti.indexOf(id) === i; }).join(','));
}

// ---------------------------------------------------------------------------
// Calcoli (funzioni "pure", provate da testScadenze)
// ---------------------------------------------------------------------------

/** "Mensile", "trimestrale ", "ANNUALE"… → numero di mesi (0 se non riconosciuta). */
function frequenzaInMesi_(testo) {
  var t = String(testo || '').toLowerCase().trim();
  if (MESI_FREQUENZA[t]) return MESI_FREQUENZA[t];
  if (/^ogni\s+mese$|^mese$/.test(t)) return 1;
  if (/^ogni\s+anno$|^anno$|^annua$/.test(t)) return 12;
  return 0;
}

function giorniNelMese_(anno, mese) {
  return new Date(anno, mese, 0).getDate();
}

/**
 * Date delle scadenze di una ricorrente comprese tra dal e al (inclusi).
 * Il giorno resta quello della prima scadenza: se il mese è più corto si usa
 * l'ultimo giorno (31 gennaio → 28/29 febbraio → 31 marzo…).
 * Le date sono oggetti Date alle 12:00 ora italiana.
 */
function occorrenzeRicorrente_(prima, mesiPasso, dal, al, ultima) {
  var risultato = [];
  if (!prima || !mesiPasso) return risultato;
  var a0 = Number(Utilities.formatDate(prima, FUSO, 'yyyy'));
  var m0 = Number(Utilities.formatDate(prima, FUSO, 'M'));
  var g0 = Number(Utilities.formatDate(prima, FUSO, 'd'));
  var chiaveDal = chiaveGiorno_(dal);
  var chiaveAl = chiaveGiorno_(al);
  var chiaveUltima = ultima ? chiaveGiorno_(ultima) : '';
  // Parto qualche passo prima di "dal" per non ciclare dall'inizio dei tempi.
  var aDal = Number(Utilities.formatDate(dal, FUSO, 'yyyy'));
  var mDal = Number(Utilities.formatDate(dal, FUSO, 'M'));
  var mesiDiDistanza = (aDal - a0) * 12 + (mDal - m0);
  var k = Math.max(0, Math.floor(mesiDiDistanza / mesiPasso) - 1);
  for (var giri = 0; giri < 500; giri++, k++) {
    var totaleMesi = (m0 - 1) + k * mesiPasso;
    var anno = a0 + Math.floor(totaleMesi / 12);
    var mese = (totaleMesi % 12) + 1;
    var giorno = Math.min(g0, giorniNelMese_(anno, mese));
    var chiave = anno + '-' + due_(mese) + '-' + due_(giorno);
    if (chiave > chiaveAl || (chiaveUltima && chiave > chiaveUltima)) break;
    if (chiave >= chiaveDal) risultato.push(leggiData_(chiave));
  }
  return risultato;
}

/** Giorni (interi) da oggi alla data: 0 = oggi, 1 = domani, -2 = due giorni fa. */
function giorniDaOggi_(data, oggi) {
  var a = leggiData_(chiaveGiorno_(data));
  var b = leggiData_(chiaveGiorno_(oggi || new Date()));
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function aggiungiGiorni_(data, giorni) {
  return leggiData_(chiaveGiorno_(new Date(leggiData_(chiaveGiorno_(data)).getTime() + giorni * 86400000)));
}

function giorniPreavviso_() {
  var n = parseInt(leggiImpostazione_(IMP_GIORNI_PREAVVISO), 10);
  return isFinite(n) && n >= 0 && n <= 60 ? n : PREAVVISO_PREDEFINITO;
}

// ---------------------------------------------------------------------------
// Lettura e aggiornamento della scheda Scadenze
// ---------------------------------------------------------------------------

function leggiScadenze_() {
  var s = scheda_(SCHEDA_SCADENZE);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_SCADENZE.length).getValues().map(function (r, i) {
    return {
      riga: i + 2,
      id: String(r[SC_ID - 1]),
      data: comeData_(r[SC_DATA - 1]),
      descrizione: String(r[SC_DESCRIZIONE - 1]).replace(/^'/, ''),
      importo: leggiImporto_(r[SC_IMPORTO - 1]),
      tipo: String(r[SC_TIPO - 1]),
      origine: String(r[SC_ORIGINE - 1]),
      pagata: /^(SI|SÌ|S|X|OK|PAGATA|PAGATO|TRUE)$/i.test(String(r[SC_PAGATA - 1]).trim()) || r[SC_PAGATA - 1] === true,
      pagataIl: comeData_(r[SC_PAGATA_IL - 1]),
      pagataDa: String(r[SC_PAGATA_DA - 1]).replace(/^'/, ''),
      preavviso: r[SC_PREAVVISO - 1],
      avviso: r[SC_AVVISO - 1],
      note: String(r[SC_NOTE - 1]).replace(/^'/, '')
    };
  }).filter(function (x) { return x.data || x.descrizione; });
}

function leggiRicorrenti_() {
  var s = scheda_(SCHEDA_RICORRENTI);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_RICORRENTI.length).getValues().map(function (r, i) {
    return {
      riga: i + 2,
      descrizione: String(r[0]).replace(/^'/, '').trim(),
      importo: leggiImporto_(r[1]),
      frequenza: String(r[2]).trim(),
      mesi: frequenzaInMesi_(r[2]),
      prima: comeData_(r[3]),
      ultima: comeData_(r[4]),
      attiva: !/^(NO|N|FALSE)$/i.test(String(r[5]).trim()) && r[5] !== false,
      note: String(r[6]),
      id: String(r[7] || '')
    };
  }).filter(function (x) { return x.descrizione || x.prima; });
}

/**
 * Porta la scheda Scadenze in pari: aggiunge le scadenze delle fatture e delle
 * ricorrenti che mancano, dà un ID alle righe scritte a mano e toglie le
 * scadenze future non pagate di ricorrenti cambiate o disattivate.
 * Si può eseguire quante volte si vuole: non crea doppioni.
 */
function aggiornaScadenze_(oggi) {
  oggi = oggi || new Date();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var scheda = scheda_(SCHEDA_SCADENZE);
    var esistenti = leggiScadenze_();
    var origini = {};
    esistenti.forEach(function (s) { if (s.origine) origini[s.origine] = s; });
    var nuove = [];
    var esito = { daFatture: 0, daRicorrenti: 0, tolte: 0 };

    // ID alle righe scritte a mano nel foglio
    esistenti.forEach(function (s) {
      if (!s.id) {
        s.id = nuovoIdScadenza_();
        scheda.getRange(s.riga, SC_ID).setValue(s.id);
        if (!s.tipo) scheda.getRange(s.riga, SC_TIPO).setValue(TIPO_MANUALE);
      }
    });

    // (a) Fatture importate con scadenza di pagamento.
    // La prima volta (scadenzario appena attivato) le fatture già scadute vengono segnate
    // come pagate: erano state pagate prima, senza scadenzario, e non devono far partire avvisi.
    var proprieta = PropertiesService.getScriptProperties();
    var primaVolta = !proprieta.getProperty(PROPRIETA_SCADENZE_AVVIATE);
    var chiaveOggiFatture = chiaveGiorno_(oggi);
    var limiteFatture = aggiungiGiorni_(oggi, -GIORNI_PASSATI_FATTURE);
    leggiFatture_().forEach(function (f) {
      if (!f.scadenza || f.totale <= 0 || f.scadenza < limiteFatture) return;
      var origine = 'F|' + chiaveFattura_(f.piva, f.numero, f.data);
      if (origini[origine]) return;
      origini[origine] = true;
      var riga = rigaScadenza_(f.scadenza, 'Fattura n. ' + f.numero + ' – ' + f.fornitore, f.totale, TIPO_FATTURA, origine);
      if (primaVolta && chiaveGiorno_(f.scadenza) < chiaveOggiFatture) {
        riga[SC_PAGATA - 1] = 'SI';
        riga[SC_NOTE - 1] = 'Segnata pagata in automatico: era già scaduta quando è stato attivato lo scadenzario';
      }
      nuove.push(riga);
      esito.daFatture++;
    });
    if (primaVolta) proprieta.setProperty(PROPRIETA_SCADENZE_AVVIATE, chiaveOggiFatture);

    // (b) Scadenze ricorrenti
    var schedaRic = scheda_(SCHEDA_RICORRENTI);
    var dal = aggiungiGiorni_(oggi, -GIORNI_PASSATI_RICORRENTI);
    var al = aggiungiGiorni_(oggi, GIORNI_FUTURI_RICORRENTI);
    var attese = {}; // origine → true per le ricorrenti valide (dal futuro)
    leggiRicorrenti_().forEach(function (r) {
      if (!r.id) {
        r.id = 'R' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
        schedaRic.getRange(r.riga, 8).setValue(r.id);
      }
      if (!r.attiva || !r.mesi || !r.prima || !r.descrizione) return;
      occorrenzeRicorrente_(r.prima, r.mesi, dal, al, r.ultima).forEach(function (d) {
        var origine = 'R|' + r.id + '|' + chiaveGiorno_(d);
        attese[origine] = true;
        var gia = origini[origine];
        if (gia && gia.riga && !gia.pagata && chiaveGiorno_(d) >= chiaveGiorno_(oggi) &&
            (gia.descrizione !== r.descrizione || gia.importo !== r.importo)) {
          // Ricorrente cambiata (es. aumento dell'affitto): aggiorno le prossime non pagate.
          scheda.getRange(gia.riga, SC_DESCRIZIONE, 1, 2).setValues([[testoSicuro_(r.descrizione), r.importo === null ? '' : r.importo]]);
          esito.aggiornate = (esito.aggiornate || 0) + 1;
        }
        if (gia) return;
        origini[origine] = true;
        nuove.push(rigaScadenza_(d, r.descrizione, r.importo, TIPO_RICORRENTE, origine));
        esito.daRicorrenti++;
      });
    });

    // Ricorrenti cambiate (giorno, frequenza) o disattivate: tolgo le scadenze future non pagate
    // che non corrispondono più. Quelle passate o pagate restano come storico.
    var chiaveOggi = chiaveGiorno_(oggi);
    var daTogliere = esistenti.filter(function (s) {
      return s.tipo === TIPO_RICORRENTE && /^R\|/.test(s.origine) && !s.pagata && s.data &&
        chiaveGiorno_(s.data) > chiaveOggi && !attese[s.origine];
    }).map(function (s) { return s.riga; }).sort(function (a, b) { return b - a; });
    daTogliere.forEach(function (riga) { scheda.deleteRow(riga); });
    esito.tolte = daTogliere.length;

    if (nuove.length) {
      scheda.getRange(scheda.getLastRow() + 1, 1, nuove.length, INTESTAZIONI_SCADENZE.length).setValues(nuove);
    }
    return esito;
  } finally {
    lock.releaseLock();
  }
}

function nuovoIdScadenza_() {
  return 'D' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

function rigaScadenza_(data, descrizione, importo, tipo, origine) {
  return [nuovoIdScadenza_(), data, testoSicuro_(descrizione), importo === null ? '' : importo, tipo,
    origine, '', '', '', '', '', ''];
}

// ---------------------------------------------------------------------------
// Scadenza di pagamento di una spesa senza fattura ("Da pagare entro")
// ---------------------------------------------------------------------------
// La spesa resta SOLO nella scheda Spese (è lì che la leggono Riepilogo, Budget e report).
// La scadenza è una riga a parte in Scadenze con origine «S|<ID spesa>»: Riepilogo, Budget e
// report non leggono mai la scheda Scadenze, quindi la spesa non viene contata due volte.
// Segnare «Pagata» tocca solo quella riga, mai la spesa.

function esisteSchedaScadenze_() {
  return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_SCADENZE);
}

/** «Spesa [fornitore] – [nota]» (senza il trattino se la nota è vuota). */
function descrizioneScadenzaSpesa_(fornitore, nota) {
  var f = String(fornitore === undefined || fornitore === null ? '' : fornitore).replace(/^'/, '').trim();
  var n = String(nota === undefined || nota === null ? '' : nota).replace(/^'/, '').trim();
  return 'Spesa ' + f + (n ? ' – ' + n : '');
}

/**
 * Porta in pari la scadenza collegata a una spesa (da chiamare con il lock già preso):
 *   scadenza = data  → crea la riga, o la aggiorna se c'è già (data, descrizione, importo; lo stato «Pagata» resta);
 *   scadenza vuota   → toglie la riga collegata, se c'è;
 *   scadenza undefined → (app vecchia) la data resta, seguono solo descrizione e importo.
 * Si può ripetere quante volte si vuole: per ogni spesa esiste al massimo una riga.
 * Restituisce 'creata', 'aggiornata', 'tolta' oppure '' (niente da fare).
 */
function sincronizzaScadenzaSpesa_(idSpesa, scadenza, fornitore, nota, importo, dataSpesa) {
  if (!esisteSchedaScadenze_()) return '';
  var scheda = scheda_(SCHEDA_SCADENZE);
  var origine = PREFISSO_ORIGINE_SPESA + idSpesa;
  var riga = trovaRiga_(scheda, SC_ORIGINE, origine);
  if (scadenza === undefined) {
    if (!riga) return '';
    scheda.getRange(riga, SC_DESCRIZIONE, 1, 2).setValues([[testoSicuro_(descrizioneScadenzaSpesa_(fornitore, nota)), importo]]);
    return 'aggiornata';
  }
  if (!scadenza) {
    if (!riga) return '';
    scheda.deleteRow(riga);
    return 'tolta';
  }
  var descrizione = descrizioneScadenzaSpesa_(fornitore, nota);
  if (riga) {
    scheda.getRange(riga, SC_DATA, 1, 3).setValues([[scadenza, testoSicuro_(descrizione), importo]]);
    return 'aggiornata';
  }
  var nuova = rigaScadenza_(scadenza, descrizione, importo, TIPO_SPESA, origine);
  nuova[SC_NOTE - 1] = 'Da una spesa senza fattura' + (dataSpesa ? ' del ' + dataIt_(dataSpesa) : '');
  scheda.appendRow(nuova);
  return 'creata';
}

/** Aggiunge alle spese (formato telefono) la scadenza collegata: scadenzaIso, scadenza e scadenzaPagata. */
function aggiungiScadenzeSpese_(voci) {
  var per = {};
  if (esisteSchedaScadenze_()) {
    leggiScadenze_().forEach(function (s) {
      if (s.origine.indexOf(PREFISSO_ORIGINE_SPESA) === 0) per[s.origine] = s;
    });
  }
  return voci.map(function (v) {
    var s = per[PREFISSO_ORIGINE_SPESA + v.id];
    v.scadenzaIso = s && s.data ? chiaveGiorno_(s.data) : '';
    v.scadenza = s && s.data ? dataIt_(s.data) : '';
    v.scadenzaPagata = !!(s && s.pagata);
    return v;
  });
}

// ---------------------------------------------------------------------------
// Promemoria via email (attivatore giornaliero)
// ---------------------------------------------------------------------------

function promemoriaScadenze() {
  eseguiAttivatore_('promemoriaScadenze', function () {
    return inviaPromemoriaScadenze_(new Date());
  });
}

/**
 * Invia un'email con le scadenze non pagate che entrano nei giorni di
 * preavviso e con quelle che scadono oggi (o sono scadute senza avviso).
 * Ogni scadenza riceve al massimo un preavviso e un avviso del giorno.
 */
function inviaPromemoriaScadenze_(oggi) {
  aggiornaScadenze_(oggi);
  var preavviso = giorniPreavviso_();
  var scheda = scheda_(SCHEDA_SCADENZE);
  var inArrivo = [];
  var diOggi = [];
  leggiScadenze_().forEach(function (s) {
    if (s.pagata || !s.data) return;
    var giorni = giorniDaOggi_(s.data, oggi);
    s.giorni = giorni;
    if (giorni <= 0 && !s.avviso && giorni >= -7) diOggi.push(s);
    else if (giorni > 0 && giorni <= preavviso && !s.preavviso) inArrivo.push(s);
  });
  if (!inArrivo.length && !diOggi.length) return { inviata: false };

  var scadute = leggiScadenze_().filter(function (s) {
    return !s.pagata && s.data && giorniDaOggi_(s.data, oggi) < 0 &&
      !diOggi.some(function (x) { return x.riga === s.riga; });
  });

  var destinatario = leggiImpostazione_(IMP_EMAIL_TITOLARE) || Session.getEffectiveUser().getEmail();
  var parti = [];
  if (diOggi.length) parti.push(diOggi.length + (diOggi.length === 1 ? ' da pagare oggi' : ' da pagare oggi o già scadute'));
  if (inArrivo.length) parti.push(inArrivo.length + ' in arrivo');
  MailApp.sendEmail({
    to: destinatario,
    subject: 'Bar – Scadenze: ' + parti.join(', '),
    htmlBody: htmlPromemoria_(diOggi, inArrivo, scadute, preavviso),
    body: testoPromemoria_(diOggi, inArrivo, scadute),
    name: NOME_APP
  });
  var adesso = new Date();
  diOggi.forEach(function (s) { scheda.getRange(s.riga, SC_AVVISO).setValue(adesso); });
  inArrivo.forEach(function (s) { scheda.getRange(s.riga, SC_PREAVVISO).setValue(adesso); });
  return { inviata: true, oggi: diOggi.length, inArrivo: inArrivo.length, destinatario: destinatario };
}

function quandoScade_(giorni) {
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'domani';
  if (giorni > 1) return 'tra ' + giorni + ' giorni';
  if (giorni === -1) return 'scaduta ieri';
  return 'scaduta da ' + (-giorni) + ' giorni';
}

function righePromemoria_(elenco, oggi) {
  return elenco.map(function (s) {
    var g = s.giorni !== undefined ? s.giorni : giorniDaOggi_(s.data, oggi);
    return [dataIt_(s.data) + ' – ' + esc_(s.descrizione) + '<br><span style="color:#555;font-size:13px;">' +
      quandoScade_(g) + '</span>', s.importo === null ? '–' : formatoEuro_(s.importo)];
  });
}

function htmlPromemoria_(diOggi, inArrivo, scadute, preavviso) {
  var h = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:680px;">';
  h += '<h2 style="margin:0 0 6px 0;">Promemoria scadenze</h2>';
  if (diOggi.length) h += tabellaHtml_('Da pagare oggi', righePromemoria_(diOggi));
  if (inArrivo.length) h += tabellaHtml_('In arrivo nei prossimi ' + preavviso + ' giorni', righePromemoria_(inArrivo));
  if (scadute.length) h += tabellaHtml_('Ancora da pagare (già scadute)', righePromemoria_(scadute));
  h += '<p style="color:#555;margin-top:24px;">Quando hai pagato, apri l\'app → <b>Scadenze</b> → <b>Segna pagata</b> ' +
    '(oppure scrivi SI nella colonna "Pagata" della scheda Scadenze).</p>';
  return h + '</div>';
}

function testoPromemoria_(diOggi, inArrivo, scadute) {
  var r = ['Promemoria scadenze', ''];
  var aggiungi = function (titolo, elenco) {
    if (!elenco.length) return;
    r.push(titolo + ':');
    elenco.forEach(function (s) {
      r.push('  ' + dataIt_(s.data) + ' – ' + s.descrizione + ' – ' +
        (s.importo === null ? '' : formatoEuro_(s.importo)));
    });
    r.push('');
  };
  aggiungi('Da pagare oggi', diOggi);
  aggiungi('In arrivo', inArrivo);
  aggiungi('Già scadute', scadute);
  r.push('Quando hai pagato: app → Scadenze → Segna pagata.');
  return r.join('\n');
}

/** Dal menu "Bar": porta in pari la scheda Scadenze e dice cosa ha fatto. */
function aggiornaScadenzeDaMenu() {
  var esito = aggiornaScadenze_(new Date());
  avvisa_('Scadenze aggiornate ✓\n\n' +
    '• dalle fatture: ' + esito.daFatture + ' nuove\n' +
    '• dalle scadenze ricorrenti: ' + esito.daRicorrenti + ' nuove' +
    (esito.tolte ? '\n• tolte perché la ricorrente è cambiata: ' + esito.tolte : ''));
}

/** Dal menu "Bar": email di prova con tutte le scadenze non pagate dei prossimi 30 giorni (senza segnarle). */
function inviaPromemoriaScadenzeDiProva() {
  if (!permessoRaro_('promemoriaProva', 120)) return avvisa_('Promemoria di prova già inviato da poco: riprova tra 2 minuti.');
  var oggi = new Date();
  aggiornaScadenze_(oggi);
  var elenco = leggiScadenze_().filter(function (s) {
    return !s.pagata && s.data && giorniDaOggi_(s.data, oggi) <= GIORNI_SCHERMATA;
  }).sort(function (a, b) { return a.data - b.data; });
  var destinatario = leggiImpostazione_(IMP_EMAIL_TITOLARE) || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: destinatario,
    subject: '[PROVA] Bar – Scadenze dei prossimi ' + GIORNI_SCHERMATA + ' giorni',
    htmlBody: htmlPromemoria_([], elenco, [], GIORNI_SCHERMATA),
    body: testoPromemoria_([], elenco, []),
    name: NOME_APP
  });
  avvisa_('Promemoria di prova inviato a ' + destinatario + ' ✓ (' + elenco.length + ' scadenze).');
}

// ---------------------------------------------------------------------------
// Funzioni chiamate dall'app
// ---------------------------------------------------------------------------

/** Scadenze non pagate fino a 30 giorni da oggi (anche quelle scadute) e le ultime pagate. */
function scadenze(pin) {
  return esegui_(pin, function () {
    var oggi = new Date();
    var preavviso = giorniPreavviso_();
    aggiornaScadenze_(oggi);
    var tutte = leggiScadenze_().filter(function (s) { return s.data; });
    var daPagare = tutte.filter(function (s) {
      return !s.pagata && giorniDaOggi_(s.data, oggi) <= GIORNI_SCHERMATA;
    }).sort(function (a, b) { return a.data - b.data; });
    var pagate = tutte.filter(function (s) {
      return s.pagata && s.pagataIl && giorniDaOggi_(s.pagataIl, oggi) >= -GIORNI_SCHERMATA;
    }).sort(function (a, b) { return b.pagataIl - a.pagataIl; }).slice(0, 15);
    return {
      ok: true,
      giorni: GIORNI_SCHERMATA,
      daPagare: daPagare.map(function (s) { return scadenzaPerTelefono_(s, oggi); }),
      pagate: pagate.map(function (s) { return scadenzaPerTelefono_(s, oggi); }),
      totaleDaPagare: somma_(daPagare.map(function (s) { return { importo: s.importo || 0 }; }), 'importo'),
      vicine: daPagare.filter(function (s) { return giorniDaOggi_(s.data, oggi) <= preavviso; }).length,
      frequenze: FREQUENZE
    };
  }, 'scadenze');
}

function scadenzaPerTelefono_(s, oggi) {
  var g = giorniDaOggi_(s.data, oggi);
  return {
    id: s.id,
    data: dataIt_(s.data),
    giorno: GIORNI_SETTIMANA[Number(Utilities.formatDate(s.data, FUSO, 'u'))],
    giorni: g,
    quando: quandoScade_(g),
    descrizione: s.descrizione,
    importo: s.importo,
    tipo: s.tipo,
    pagataIl: s.pagataIl ? dataIt_(s.pagataIl) : '',
    pagataDa: s.pagataDa
  };
}

/** Segna una scadenza come pagata (pagata = true) o di nuovo da pagare (false). */
function segnaScadenzaPagata(pin, id, pagata, persona) {
  return esegui_(pin, function () {
    if (!id) return errore_('Scadenza non trovata.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var scheda = scheda_(SCHEDA_SCADENZE);
      var riga = trovaRiga_(scheda, SC_ID, id);
      if (!riga) return errore_('Questa scadenza non c\'è più nel foglio.');
      if (pagata) {
        scheda.getRange(riga, SC_PAGATA, 1, 3).setValues([['SI', leggiData_(chiaveGiorno_(new Date())), pulisci_(persona, 40)]]);
      } else {
        scheda.getRange(riga, SC_PAGATA, 1, 3).setValues([['', '', '']]);
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'segnaScadenzaPagata');
}

/**
 * Nuova scadenza dall'app. frequenza = '' (una volta sola) → riga in Scadenze;
 * altrimenti riga in "Scadenze ricorrenti" (attiva).
 */
function nuovaScadenza(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var descrizione = pulisci_(dati.descrizione, 120);
    if (!descrizione) return errore_('Scrivi che cosa va pagato (es. Affitto).');
    var data = leggiData_(dati.data);
    if (!data) return errore_('La data della scadenza non è valida.');
    var testoImporto = String(dati.importo || '').trim();
    var importo = testoImporto ? leggiImporto_(testoImporto) : null;
    if (testoImporto && (importo === null || importo <= 0)) return errore_('L\'importo non è valido. Esempio: 800,00');
    var frequenza = String(dati.frequenza || '');
    if (frequenza && FREQUENZE.indexOf(frequenza) < 0) return errore_('Frequenza non valida.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (frequenza) {
        // L'ID arriva dal telefono: se la stessa richiesta arriva due volte non si crea un doppione.
        var idRicorrente = idValido_(dati.id) ? 'R' + idValido_(dati.id) : 'R' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
        var ric = scheda_(SCHEDA_RICORRENTI);
        if (trovaRiga_(ric, 8, idRicorrente) > 0) return { ok: true, giaSalvata: true };
        ric.appendRow([descrizione, importo === null ? '' : importo, frequenza, data, '', 'SI',
          'Inserita dall\'app' + (dati.persona ? ' da ' + pulisci_(dati.persona, 40) : ''), idRicorrente]);
      } else {
        var riga = rigaScadenza_(data, descrizione, importo, TIPO_MANUALE, 'M|' + (idValido_(dati.id) || nuovoIdScadenza_()));
        var scheda = scheda_(SCHEDA_SCADENZE);
        if (idValido_(dati.id) && trovaRiga_(scheda, SC_ORIGINE, riga[SC_ORIGINE - 1]) > 0) return { ok: true, giaSalvata: true };
        scheda.appendRow(riga);
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'nuovaScadenza');
}

/** Quante scadenze non pagate cadono entro i giorni di preavviso (per il pulsante nella home). */
function contaScadenzeVicine_() {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_SCADENZE)) return 0;
  var oggi = new Date();
  var preavviso = giorniPreavviso_();
  return leggiScadenze_().filter(function (s) {
    return !s.pagata && s.data && giorniDaOggi_(s.data, oggi) <= preavviso;
  }).length;
}

// ---------------------------------------------------------------------------
// Scadenze fisse del locale (estintori, assicurazione, SIAE, TARI…) dall'app
// ---------------------------------------------------------------------------

/** I modelli delle scadenze fisse (righe di "Scadenze ricorrenti" con ID che inizia con RM-). */
function scadenzeFisse(pin) {
  return esegui_(pin, function () {
    return { ok: true, frequenze: FREQUENZE, voci: vociScadenzeFisse_(new Date()) };
  }, 'scadenzeFisse');
}

function vociScadenzeFisse_(oggi) {
  var tra400 = aggiungiGiorni_(oggi, 400);
  return leggiRicorrenti_().filter(function (r) { return r.id.indexOf(PREFISSO_MODELLO_FISSO) === 0; }).map(function (r) {
    var prossima = r.attiva && r.prima && r.mesi ? occorrenzeRicorrente_(r.prima, r.mesi, oggi, tra400, r.ultima)[0] : null;
    return {
      id: r.id,
      descrizione: r.descrizione,
      importo: r.importo,
      frequenza: FREQUENZE.indexOf(r.frequenza) >= 0 ? r.frequenza : 'annuale',
      dataIso: r.prima ? chiaveGiorno_(r.prima) : '',
      attiva: r.attiva && !!r.prima,
      prossima: prossima ? dataIt_(prossima) : '',
      quando: prossima ? quandoScade_(giorniDaOggi_(prossima, oggi)) : ''
    };
  });
}

/**
 * Attiva/disattiva una scadenza fissa e ne cambia data, frequenza e importo.
 * dati: { id, data ('AAAA-MM-GG' o 'gg/mm/aaaa'), frequenza, importo, attiva }
 */
function salvaScadenzaFissa(pin, dati) {
  return esegui_(pin, function () {
    dati = dati || {};
    var id = String(dati.id || '');
    if (id.indexOf(PREFISSO_MODELLO_FISSO) !== 0) return errore_('Scadenza non trovata.');
    var testoData = String(dati.data || '').trim();
    var data = testoData ? leggiData_(testoData) : null;
    if (testoData && !data) return errore_('La data non è valida.');
    if (dati.attiva && !data) return errore_('Per attivarla scrivi la data della prossima scadenza.');
    var frequenza = String(dati.frequenza || '');
    if (FREQUENZE.indexOf(frequenza) < 0) return errore_('Scegli ogni quanto si ripete.');
    var testoImporto = String(dati.importo === undefined || dati.importo === null ? '' : dati.importo).trim();
    var importo = testoImporto ? leggiImporto_(testoImporto) : null;
    if (testoImporto && (importo === null || importo <= 0)) return errore_('L\'importo non è valido. Esempio: 350,00');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var ric = scheda_(SCHEDA_RICORRENTI);
      var riga = trovaRiga_(ric, 8, id);
      if (!riga) return errore_('Questa scadenza non c\'è più nella scheda «Scadenze ricorrenti».');
      ric.getRange(riga, 2, 1, 2).setValues([[importo === null ? '' : importo, frequenza]]);
      ric.getRange(riga, 4).setValue(data || '');
      ric.getRange(riga, 6).setValue(dati.attiva ? 'SI' : 'NO');
      var nota = String(ric.getRange(riga, 7).getValue());
      if (nota === NOTA_MODELLO_FISSO && dati.attiva) {
        ric.getRange(riga, 7).setValue('Attivata dall\'app' + (dati.persona ? ' da ' + pulisci_(dati.persona, 40) : ''));
      }
    } finally {
      lock.releaseLock();
    }
    aggiornaScadenze_(new Date());
    return { ok: true, frequenze: FREQUENZE, voci: vociScadenzeFisse_(new Date()) };
  }, 'salvaScadenzaFissa');
}
