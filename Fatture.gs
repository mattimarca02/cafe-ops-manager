/**
 * Bar - Spese & Cassa: importazione delle fatture elettroniche ricevute.
 *
 * I file scaricati dal portale "Fatture e Corrispettivi" (.xml, .xml.p7m,
 * .zip) vanno messi nella cartella Drive "Bar - Fatture/Da importare".
 * importaFatture() li legge, scrive una riga per fattura nella scheda
 * "Fatture" e sposta i file in "Importate/AAAA-MM" oppure in "Errori".
 */

var NOME_CARTELLA_FATTURE = 'Bar - Fatture';
var CARTELLA_DA_IMPORTARE = 'Da importare';
var CARTELLA_IMPORTATE = 'Importate';
var CARTELLA_ERRORI = 'Errori';
var ORIGINE_XML = 'XML';
var ORIGINE_CSV = 'CSV';
var TEMPO_MASSIMO_IMPORTAZIONE_MS = 4.5 * 60 * 1000; // Apps Script si ferma a 6 minuti

var TIPI_DOCUMENTO = {
  TD01: 'Fattura',
  TD02: 'Acconto/anticipo su fattura',
  TD03: 'Acconto/anticipo su parcella',
  TD04: 'Nota di credito',
  TD05: 'Nota di debito',
  TD06: 'Parcella',
  TD16: 'Integrazione fattura reverse charge interno',
  TD17: 'Integrazione/autofattura servizi dall\'estero',
  TD18: 'Integrazione acquisto beni intracomunitari',
  TD19: 'Integrazione/autofattura beni ex art.17 c.2',
  TD20: 'Autofattura/regolarizzazione',
  TD24: 'Fattura differita (beni)',
  TD25: 'Fattura differita (servizi)',
  TD26: 'Cessione di beni ammortizzabili',
  TD27: 'Autoconsumo/cessioni gratuite',
  TD28: 'Acquisti da San Marino con IVA'
};

// ---------------------------------------------------------------------------
// Cartelle su Drive
// ---------------------------------------------------------------------------

function cartelleFatture_() {
  var principale = null;
  var id = leggiImpostazione_(IMP_ID_CARTELLA_FATTURE);
  if (id) {
    try {
      principale = DriveApp.getFolderById(id);
      if (principale.isTrashed()) principale = null;
    } catch (e) {
      principale = null;
    }
  }
  if (!principale) {
    var trovate = DriveApp.getRootFolder().getFoldersByName(NOME_CARTELLA_FATTURE);
    principale = trovate.hasNext() ? trovate.next() : DriveApp.createFolder(NOME_CARTELLA_FATTURE);
    scriviImpostazione_(IMP_ID_CARTELLA_FATTURE, principale.getId());
  }
  return {
    principale: principale,
    daImportare: sottocartella_(principale, CARTELLA_DA_IMPORTARE),
    importate: sottocartella_(principale, CARTELLA_IMPORTATE),
    errori: sottocartella_(principale, CARTELLA_ERRORI)
  };
}

function sottocartella_(madre, nome) {
  var trovate = madre.getFoldersByName(nome);
  return trovate.hasNext() ? trovate.next() : madre.createFolder(nome);
}

// ---------------------------------------------------------------------------
// Importazione
// ---------------------------------------------------------------------------

/** Da menu "Bar > Importa fatture" o dal trigger giornaliero. */
function importaFatture() {
  var esito = importaFattureSilenzioso_();
  avvisa_(testoEsitoImportazione_(esito));
  return esito;
}

function importaFattureSilenzioso_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { occupato: true, importate: 0, doppie: 0, errori: 0, fileErrore: [], rimasti: 0, file: 0, emesse: 0, righeErrore: 0, sostituite: 0 };
  }
  try {
    var inizio = new Date().getTime();
    var cartelle = cartelleFatture_();
    var contesto = contestoImportazione_();
    var esito = { importate: 0, doppie: 0, errori: 0, fileErrore: [], rimasti: 0, file: 0, emesse: 0, righeErrore: 0, sostituite: 0 };
    var elenco = cartelle.daImportare.getFiles();
    while (elenco.hasNext()) {
      var file = elenco.next();
      if (new Date().getTime() - inizio > TEMPO_MASSIMO_IMPORTAZIONE_MS) {
        esito.rimasti++;
        continue;
      }
      elaboraFileFattura_(file, cartelle, contesto, esito);
      esito.file++;
    }
    return esito;
  } finally {
    lock.releaseLock();
  }
}

function testoEsitoImportazione_(esito) {
  if (esito.occupato) return 'Un\'importazione è già in corso. Riprova tra qualche minuto.';
  var righe = [
    'Importazione fatture completata.',
    '',
    '✓ Fatture importate: ' + esito.importate,
    '↷ Saltate perché già presenti: ' + esito.doppie,
    '↷ Saltate perché emesse (non ricevute): ' + (esito.emesse || 0),
    '⚠ Righe con errore: ' + (esito.righeErrore || 0),
    '⚠ File con errori: ' + esito.errori
  ];
  if (esito.sostituite) {
    righe.push('✓ Righe da CSV completate con i dati dell\'XML (scadenza compresa): ' + esito.sostituite);
  }
  if (esito.fileErrore.length) {
    righe.push('');
    righe.push('File spostati in "' + NOME_CARTELLA_FATTURE + '/' + CARTELLA_ERRORI + '":');
    esito.fileErrore.forEach(function (r) { righe.push('• ' + r); });
  }
  if (esito.rimasti) {
    righe.push('');
    righe.push('Restano ' + esito.rimasti + ' file da importare: esegui di nuovo "Importa fatture".');
  }
  if (!esito.file && !esito.rimasti) {
    righe.push('');
    righe.push('La cartella "' + NOME_CARTELLA_FATTURE + '/' + CARTELLA_DA_IMPORTARE + '" era vuota.');
  }
  return righe.join('\n');
}

/** Dati già presenti nel foglio, per evitare doppioni e trovare le categorie. */
function contestoImportazione_() {
  var chiavi = {};
  // Per ogni fattura già nel foglio: riga e origine (serve a far prevalere l'XML sul CSV).
  leggiFatture_().forEach(function (f) {
    chiavi[chiaveFattura_(f.piva, f.numero, f.data)] = { riga: f.riga, origine: f.origine, categoria: f.categoria };
  });
  return { chiavi: chiavi, fornitori: leggiFornitori_() };
}

function chiaveFattura_(piva, numero, data) {
  return normalizzaPiva_(piva) + '|' + String(numero || '').replace(/\s+/g, '').toUpperCase() + '|' +
    (data ? chiaveGiorno_(data) : '');
}

function normalizzaPiva_(piva) {
  return String(piva || '').replace(/^'/, '').replace(/\s+/g, '').toUpperCase();
}

function elaboraFileFattura_(file, cartelle, contesto, esito) {
  var nome = file.getName();
  var problemi = [];
  var righe = [];
  var chiaviRighe = [];
  var meseDestinazione = '';
  var registra = function (f, nomeFile, origine) {
    var mese = registraFattura_(f, nomeFile, origine, contesto, esito, righe, chiaviRighe);
    if (mese > meseDestinazione) meseDestinazione = mese;
  };
  try {
    var documenti = documentiDaFile_(file.getBlob(), nome, problemi, 0);
    if (!documenti.length && !problemi.length) {
      problemi.push('nessuna fattura trovata nel file');
    }
    documenti.forEach(function (doc) {
      try {
        if (/\.csv$/i.test(doc.nome)) {
          var csv = leggiFattureCsv_(byteCsvATesto_(normalizzaByte_(doc.byte)));
          csv.fatture.forEach(function (f) { registra(f, doc.nome, ORIGINE_CSV); });
          esito.emesse += csv.emesse;
          if (csv.errori.length) {
            esito.righeErrore += csv.errori.length;
            problemi.push(doc.nome + ': ' + csv.errori.length + (csv.errori.length === 1 ? ' riga non letta' : ' righe non lette') +
              ' (' + csv.errori.slice(0, 5).join('; ') + (csv.errori.length > 5 ? '; e altre ' + (csv.errori.length - 5) : '') + ')');
          } else if (!csv.righeLette) {
            problemi.push(doc.nome + ': nessuna fattura trovata nel file');
          }
          return;
        }
        leggiFileFattura_(doc.byte, doc.nome).forEach(function (f) { registra(f, doc.nome, ORIGINE_XML); });
      } catch (e) {
        problemi.push(doc.nome + ': ' + (e && e.message ? e.message : e));
      }
    });
  } catch (e2) {
    problemi.push(e2 && e2.message ? e2.message : String(e2));
  }

  if (righe.length) {
    var scheda = scheda_(SCHEDA_FATTURE);
    var primaRiga = scheda.getLastRow() + 1;
    scheda.getRange(primaRiga, 1, righe.length, righe[0].length).setValues(righe);
    esito.importate += righe.length;
    // Da ora queste righe sono nel foglio: se più avanti arriva l'XML della stessa fattura si sa dove sono.
    chiaviRighe.forEach(function (chiave, i) {
      contesto.chiavi[chiave].riga = primaRiga + i;
      contesto.chiavi[chiave].pendente = null;
    });
  }

  if (problemi.length) {
    esito.errori++;
    esito.fileErrore.push(nome + ' – ' + problemi.join('; '));
    registraErrore_('importaFatture (file non letto)', new Error(nome + ': ' + problemi.join('; ')));
    file.moveTo(cartelle.errori);
  } else {
    if (!meseDestinazione) meseDestinazione = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM');
    file.moveTo(sottocartella_(cartelle.importate, meseDestinazione));
  }
}

/**
 * Aggiunge una fattura (letta da XML o da CSV) alle righe da scrivere, saltando i doppioni
 * (stessa P.IVA + numero + data, per XML e CSV). Se la fattura c'è già da CSV e ora arriva
 * l'XML, la riga viene completata con l'XML (ha più dettagli e la scadenza), tenendo la
 * categoria. Restituisce il mese "AAAA-MM" della fattura, '' se è stata saltata.
 */
function registraFattura_(f, nomeFile, origine, contesto, esito, righe, chiaviRighe) {
  var chiave = chiaveFattura_(f.piva, f.numero, f.data);
  var presente = contesto.chiavi[chiave];
  if (presente && (origine !== ORIGINE_XML || presente.origine !== ORIGINE_CSV)) {
    esito.doppie++;
    return '';
  }
  var categoria = categoriaFornitore_(contesto.fornitori, f.piva, f.fornitore);
  var riga = [
    f.data, testoSicuro_(f.numero), testoSicuro_(f.fornitore), testoSicuro_(f.piva),
    f.tipo + (TIPI_DOCUMENTO[f.tipo] ? ' - ' + TIPI_DOCUMENTO[f.tipo] : ''),
    f.imponibile, f.iva, f.totale, f.scadenza || '',
    categoria || DA_CATEGORIZZARE, testoSicuro_(nomeFile), new Date(), origine
  ];
  var mese = Utilities.formatDate(f.data, FUSO, 'yyyy-MM');
  if (presente) {
    if (presente.categoria && presente.categoria !== DA_CATEGORIZZARE) riga[9] = presente.categoria;
    if (presente.pendente) {
      Array.prototype.splice.apply(presente.pendente, [0, presente.pendente.length].concat(riga));
    } else {
      scheda_(SCHEDA_FATTURE).getRange(presente.riga, 1, 1, riga.length).setValues([riga]);
    }
    presente.origine = ORIGINE_XML;
    presente.categoria = riga[9];
    esito.sostituite++;
    return mese;
  }
  contesto.chiavi[chiave] = { riga: 0, origine: origine, categoria: riga[9], pendente: riga };
  righe.push(riga);
  chiaviRighe.push(chiave);
  return mese;
}

/**
 * Restituisce l'elenco dei documenti XML/P7M/CSV contenuti nel file
 * (scompattando gli .zip, anche uno dentro l'altro).
 */
function documentiDaFile_(blob, nome, problemi, profondita) {
  var byte = normalizzaByte_(blob.getBytes());
  var eZip = /\.zip$/i.test(nome) || (byte.length > 4 && byte[0] === 0x50 && byte[1] === 0x4B && byte[2] === 0x03 && byte[3] === 0x04);
  if (eZip) {
    if (profondita > 2) {
      problemi.push(nome + ': troppi .zip uno dentro l\'altro');
      return [];
    }
    var interni;
    try {
      interni = Utilities.unzip(blob.setContentType('application/zip'));
    } catch (e) {
      problemi.push(nome + ': archivio .zip non leggibile');
      return [];
    }
    var risultato = [];
    interni.forEach(function (b) {
      var n = String(b.getName() || '');
      if (!n || /\/$/.test(n)) return; // cartella dentro lo zip
      var corto = n.split('/').pop();
      if (/\.(xml|p7m|csv|zip)$/i.test(corto)) {
        risultato = risultato.concat(documentiDaFile_(b, corto, problemi, profondita + 1));
      }
      // Altri file (pdf, html, txt…) vengono ignorati.
    });
    return risultato;
  }
  if (/\.(xml|p7m|csv)$/i.test(nome)) {
    return [{ nome: nome, byte: byte }];
  }
  problemi.push(nome + ': formato non riconosciuto (servono file .xml, .p7m, .csv o .zip)');
  return [];
}

/** Byte di un file .xml o .xml.p7m → elenco di fatture lette. */
function leggiFileFattura_(byte, nome) {
  byte = normalizzaByte_(byte);
  var xml = pareXml_(byte) ? byte : estraiXmlDaP7m_(byte);
  return leggiFatturaXml_(byteATesto_(xml), nome);
}

// ---------------------------------------------------------------------------
// File firmati .p7m (CMS / PKCS#7, binari DER/BER oppure in base64)
// ---------------------------------------------------------------------------

/** Converte i byte "con segno" di Apps Script (-128…127) in numeri 0…255. */
function normalizzaByte_(byte) {
  var out = new Array(byte.length);
  for (var i = 0; i < byte.length; i++) out[i] = byte[i] & 0xFF;
  return out;
}

/** Vero se, saltando BOM e spazi, il contenuto inizia con "<". */
function pareXml_(b) {
  var i = 0;
  if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0A || b[i] === 0x0D)) i++;
  return i < b.length && b[i] === 0x3C;
}

/**
 * Estrae l'XML della fattura da un file firmato .p7m.
 * Gestisce: binario DER/BER (anche con lunghezze indefinite e contenuto
 * spezzato in più blocchi), file in base64 (con o senza intestazioni PEM),
 * firme multiple annidate.
 */
function estraiXmlDaP7m_(byte, profondita) {
  profondita = profondita || 0;
  if (profondita > 4) throw new Error('file firmato non leggibile (troppi livelli di firma)');
  var b = normalizzaByte_(byte);

  if (pareXml_(b)) return b;

  if (b.length && b[0] !== 0x30) {
    // Probabilmente è in base64.
    var decodificati = decodificaBase64Robusto_(b);
    if (!decodificati) throw new Error('file firmato non riconosciuto (né binario né base64)');
    return estraiXmlDaP7m_(decodificati, profondita + 1);
  }

  var contenuto = null;
  try {
    contenuto = cercaContenuto_(b, 0, b.length, 0);
  } catch (e) {
    contenuto = null;
  }
  if (contenuto) {
    if (pareXml_(contenuto)) return contenuto;
    try {
      return estraiXmlDaP7m_(contenuto, profondita + 1); // firma dentro un'altra firma
    } catch (eInterno) {
      // si prova con il piano B qui sotto
    }
  }

  // Ultima possibilità: cerco l'XML direttamente nei byte.
  var trovato = cercaXmlGrezzo_(b);
  if (trovato) return trovato;
  throw new Error('non riesco a estrarre la fattura dal file firmato');
}

function decodificaBase64Robusto_(b) {
  var testo = '';
  for (var i = 0; i < b.length; i++) testo += String.fromCharCode(b[i]);
  testo = testo.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/[\s\r\n]+/g, '');
  if (testo.length < 16 || !/^[A-Za-z0-9+\/=_\-]+$/.test(testo)) return null;
  try {
    return normalizzaByte_(/[_\-]/.test(testo) ? Utilities.base64DecodeWebSafe(testo) : Utilities.base64Decode(testo));
  } catch (e) {
    return null;
  }
}

/**
 * Legge un elemento ASN.1 BER (tag, lunghezza, contenuto) a partire da pos.
 * Restituisce null se i byte non sono un elemento valido.
 */
function leggiTlv_(b, pos, limite) {
  if (pos + 2 > limite) return null;
  var tag = b[pos];
  var p = pos + 1;
  if ((tag & 0x1F) === 0x1F) { // tag a più byte
    while (p < limite && (b[p] & 0x80)) p++;
    p++;
  }
  if (p >= limite) return null;
  var primo = b[p++];
  var lunghezza;
  if (primo === 0x80) {
    lunghezza = -1; // lunghezza indefinita: termina con 00 00
  } else if (primo & 0x80) {
    var n = primo & 0x7F;
    if (n < 1 || n > 4 || p + n > limite) return null;
    lunghezza = 0;
    for (var i = 0; i < n; i++) lunghezza = lunghezza * 256 + b[p++];
  } else {
    lunghezza = primo;
  }
  var costruito = (tag & 0x20) !== 0;
  var inizio = p;
  var fine;
  var dopo;
  if (lunghezza === -1) {
    if (!costruito) return null;
    var q = inizio;
    for (;;) {
      if (q + 2 > limite) return null;
      if (b[q] === 0 && b[q + 1] === 0) {
        fine = q;
        dopo = q + 2;
        break;
      }
      var figlio = leggiTlv_(b, q, limite);
      if (!figlio) return null;
      q = figlio.dopo;
    }
  } else {
    fine = inizio + lunghezza;
    if (fine > limite) return null;
    dopo = fine;
  }
  return { tag: tag, costruito: costruito, inizio: inizio, fine: fine, dopo: dopo };
}

/** Contenuto di un OCTET STRING, anche se spezzato in più blocchi (BER). */
function contenutoOctet_(b, tlv) {
  if (!tlv.costruito) return b.slice(tlv.inizio, tlv.fine);
  var risultato = [];
  var pos = tlv.inizio;
  while (pos < tlv.fine) {
    var figlio = leggiTlv_(b, pos, tlv.fine);
    if (!figlio) return null;
    var pezzo = contenutoOctet_(b, figlio);
    if (!pezzo) return null;
    for (var i = 0; i < pezzo.length; i++) risultato.push(pezzo[i]);
    pos = figlio.dopo;
  }
  return risultato;
}

/**
 * Cerca nella struttura ASN.1 il primo OCTET STRING che contiene un XML
 * (oppure un'altra busta firmata). È il campo "eContent" della firma.
 */
function cercaContenuto_(b, inizio, fine, livello) {
  if (livello > 30) return null;
  var pos = inizio;
  var candidatoFirmato = null;
  while (pos < fine) {
    var tlv = leggiTlv_(b, pos, fine);
    if (!tlv) return candidatoFirmato;
    var tagBase = tlv.tag & 0xDF; // ignora il bit "costruito"
    if (tagBase === 0x04) {
      var contenuto = contenutoOctet_(b, tlv);
      if (contenuto && contenuto.length > 20) {
        if (pareXml_(contenuto)) return contenuto;
        if (!candidatoFirmato && contenuto[0] === 0x30 && contenuto.length > 200 && contieneTesto_(contenuto, 'FatturaElettronica')) {
          candidatoFirmato = contenuto;
        }
      }
    } else if (tlv.costruito) {
      var dentro = cercaContenuto_(b, tlv.inizio, tlv.fine, livello + 1);
      if (dentro && pareXml_(dentro)) return dentro;
      if (dentro && !candidatoFirmato) candidatoFirmato = dentro;
    }
    pos = tlv.dopo;
  }
  return candidatoFirmato;
}

function contieneTesto_(b, testo) {
  var codici = [];
  for (var k = 0; k < testo.length; k++) codici.push(testo.charCodeAt(k));
  outer:
  for (var i = 0; i + codici.length <= b.length; i++) {
    for (var j = 0; j < codici.length; j++) {
      if (b[i + j] !== codici[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Piano B: cerca "<?xml … FatturaElettronica>" direttamente nei byte. */
function cercaXmlGrezzo_(b) {
  var testo = '';
  for (var i = 0; i < b.length; i++) testo += String.fromCharCode(b[i]);
  var inizio = testo.indexOf('<?xml');
  if (inizio < 0) {
    var m = /<([A-Za-z0-9_]+:)?FatturaElettronica[\s>]/.exec(testo);
    if (!m) return null;
    inizio = m.index;
  }
  var r = /<\/([A-Za-z0-9_]+:)?FatturaElettronica>/g;
  var fine = -1;
  var trovato;
  while ((trovato = r.exec(testo))) fine = trovato.index + trovato[0].length;
  if (fine <= inizio) return null;
  return b.slice(inizio, fine);
}

/** Byte → testo, usando la codifica dichiarata nell'XML (di solito UTF-8). */
function byteATesto_(b) {
  var intestazione = '';
  for (var i = 0; i < Math.min(b.length, 200); i++) intestazione += String.fromCharCode(b[i]);
  var m = /encoding\s*=\s*["']([A-Za-z0-9_\-]+)["']/i.exec(intestazione);
  var codifica = m ? m[1].toUpperCase() : 'UTF-8';
  if (codifica === 'ISO-8859-1' || codifica === 'LATIN1') codifica = 'ISO-8859-1';
  else if (codifica.indexOf('WINDOWS-1252') === 0 || codifica === 'CP1252') codifica = 'windows-1252';
  else codifica = 'UTF-8';
  var conSegno = b.map(function (x) { return x > 127 ? x - 256 : x; });
  return Utilities.newBlob(conSegno).getDataAsString(codifica).replace(/^﻿/, '');
}

// ---------------------------------------------------------------------------
// Lettura dell'XML FatturaPA
// ---------------------------------------------------------------------------

/** Figli con un certo nome, ignorando i namespace (p:, ns2:, ecc.). */
function figli_(elemento, nome) {
  if (!elemento) return [];
  return elemento.getChildren().filter(function (c) { return c.getName() === nome; });
}

function figlio_(elemento, nome) {
  var trovati = figli_(elemento, nome);
  return trovati.length ? trovati[0] : null;
}

function percorso_(elemento, nomi) {
  for (var i = 0; i < nomi.length && elemento; i++) elemento = figlio_(elemento, nomi[i]);
  return elemento;
}

function testoDi_(elemento, nome) {
  var e = nome ? figlio_(elemento, nome) : elemento;
  return e ? String(e.getText()).trim() : '';
}

function numeroXml_(testo) {
  var n = parseFloat(String(testo || '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/**
 * Legge il testo XML di una FatturaPA. Restituisce un elemento per ogni
 * FatturaElettronicaBody (un file può contenere più fatture).
 * Per i file di metadati dello SdI restituisce un elenco vuoto.
 */
function leggiFatturaXml_(testo, nomeFile) {
  var documento;
  try {
    documento = XmlService.parse(testo);
  } catch (e) {
    throw new Error('XML non valido');
  }
  var radice = documento.getRootElement();
  var nomeRadice = radice.getName();
  if (nomeRadice === 'FileMetadati' || nomeRadice === 'MetadatiInvioFile') return [];
  if (nomeRadice !== 'FatturaElettronica') throw new Error('il file non è una fattura elettronica');

  var header = figlio_(radice, 'FatturaElettronicaHeader');
  var anagrafici = percorso_(header, ['CedentePrestatore', 'DatiAnagrafici']);
  if (!anagrafici) throw new Error('mancano i dati del fornitore');
  var idIva = figlio_(anagrafici, 'IdFiscaleIVA');
  var paese = testoDi_(idIva, 'IdPaese').toUpperCase();
  var codice = testoDi_(idIva, 'IdCodice');
  var piva = codice ? (paese && paese !== 'IT' ? paese + codice : codice) : testoDi_(anagrafici, 'CodiceFiscale');
  var anagrafica = figlio_(anagrafici, 'Anagrafica');
  var fornitore = testoDi_(anagrafica, 'Denominazione') ||
    (testoDi_(anagrafica, 'Nome') + ' ' + testoDi_(anagrafica, 'Cognome')).trim() ||
    'Fornitore sconosciuto';

  var corpi = figli_(radice, 'FatturaElettronicaBody');
  if (!corpi.length) throw new Error('nessuna fattura nel file');

  return corpi.map(function (corpo) {
    var dgd = percorso_(corpo, ['DatiGenerali', 'DatiGeneraliDocumento']);
    var tipo = testoDi_(dgd, 'TipoDocumento').toUpperCase() || 'TD01';
    var data = leggiData_(testoDi_(dgd, 'Data'));
    var numero = testoDi_(dgd, 'Numero');
    if (!data) throw new Error('data della fattura mancante o non valida');
    if (!numero) throw new Error('numero della fattura mancante');

    var imponibile = 0;
    var iva = 0;
    var righeRiepilogo = 0;
    figli_(corpo, 'DatiBeniServizi').forEach(function (dbs) {
      figli_(dbs, 'DatiRiepilogo').forEach(function (r) {
        imponibile += numeroXml_(testoDi_(r, 'ImponibileImporto'));
        iva += numeroXml_(testoDi_(r, 'Imposta'));
        righeRiepilogo++;
      });
    });
    if (!righeRiepilogo) throw new Error('mancano i dati di riepilogo IVA');

    var totaleDichiarato = testoDi_(dgd, 'ImportoTotaleDocumento');
    var totale = totaleDichiarato ? numeroXml_(totaleDichiarato) : imponibile + iva;

    var scadenza = null;
    figli_(corpo, 'DatiPagamento').forEach(function (dp) {
      figli_(dp, 'DettaglioPagamento').forEach(function (det) {
        var d = leggiData_(testoDi_(det, 'DataScadenzaPagamento'));
        if (d && (!scadenza || d < scadenza)) scadenza = d;
      });
    });

    // Le note di credito riducono le spese: importi negativi.
    var segno = tipo === 'TD04' ? -1 : 1;
    var aggiusta = function (n) {
      n = Math.round(n * 100) / 100;
      return segno < 0 ? -Math.abs(n) : n;
    };

    return {
      data: data,
      numero: numero,
      fornitore: fornitore,
      piva: piva,
      tipo: tipo,
      imponibile: aggiusta(imponibile),
      iva: aggiusta(iva),
      totale: aggiusta(totale),
      scadenza: scadenza,
      nomeFile: nomeFile || ''
    };
  });
}

// ---------------------------------------------------------------------------
// Fornitori e categorie
// ---------------------------------------------------------------------------

function leggiFornitori_() {
  var s = scheda_(SCHEDA_FORNITORI);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 3).getValues().map(function (r, i) {
    return {
      riga: i + 2,
      nome: String(r[0]).replace(/^'/, '').trim(),
      categoria: String(r[1]).trim(),
      piva: normalizzaPiva_(r[2])
    };
  }).filter(function (f) { return f.nome || f.piva; });
}

function trovaFornitore_(fornitori, piva, nome) {
  var p = normalizzaPiva_(piva);
  var n = String(nome || '').trim().toLowerCase();
  var i;
  if (p) {
    for (i = 0; i < fornitori.length; i++) if (fornitori[i].piva === p) return fornitori[i];
  }
  if (n) {
    for (i = 0; i < fornitori.length; i++) if (fornitori[i].nome.toLowerCase() === n) return fornitori[i];
  }
  return null;
}

/**
 * Categoria predefinita del fornitore. Se il fornitore non esiste lo
 * aggiunge alla scheda Fornitori con categoria vuota; se manca la P.IVA la completa.
 */
function categoriaFornitore_(fornitori, piva, nome) {
  var scheda = scheda_(SCHEDA_FORNITORI);
  var f = trovaFornitore_(fornitori, piva, nome);
  if (!f) {
    scheda.appendRow([testoSicuro_(nome), '', normalizzaPiva_(piva)]);
    f = { riga: scheda.getLastRow(), nome: nome, categoria: '', piva: normalizzaPiva_(piva) };
    fornitori.push(f);
  } else if (!f.piva && piva) {
    scheda.getRange(f.riga, 3).setValue(normalizzaPiva_(piva));
    f.piva = normalizzaPiva_(piva);
  }
  return f.categoria;
}

/**
 * Dal telefono: assegna la categoria a un fornitore (diventa la sua
 * categoria predefinita) e alle sue fatture "Da categorizzare".
 */
function impostaCategoriaFornitore(pin, nome, piva, categoria) {
  return esegui_(pin, function () {
    categoria = String(categoria || '').trim();
    if (leggiLista_(SCHEDA_CATEGORIE).indexOf(categoria) < 0) return errore_('Categoria non valida.');
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var fornitori = leggiFornitori_();
      var f = trovaFornitore_(fornitori, piva, nome);
      var schedaF = scheda_(SCHEDA_FORNITORI);
      if (f) {
        schedaF.getRange(f.riga, 2).setValue(categoria);
      } else {
        schedaF.appendRow([testoSicuro_(nome), categoria, normalizzaPiva_(piva)]);
      }
      var p = normalizzaPiva_(piva);
      var n = String(nome || '').trim().toLowerCase();
      var schedaFat = scheda_(SCHEDA_FATTURE);
      if (schedaFat.getLastRow() >= 2) {
        var intervallo = schedaFat.getRange(2, 1, schedaFat.getLastRow() - 1, INTESTAZIONI_FATTURE.length);
        var valori = intervallo.getValues();
        var colonnaCategoria = schedaFat.getRange(2, 10, valori.length, 1);
        var categorie = colonnaCategoria.getValues();
        var modificate = 0;
        for (var i = 0; i < valori.length; i++) {
          var stessoFornitore = p ? normalizzaPiva_(valori[i][3]) === p :
            String(valori[i][2]).replace(/^'/, '').trim().toLowerCase() === n;
          var daFare = !String(categorie[i][0]).trim() || String(categorie[i][0]) === DA_CATEGORIZZARE;
          if (stessoFornitore && daFare) {
            categorie[i][0] = categoria;
            modificate++;
          }
        }
        if (modificate) colonnaCategoria.setValues(categorie);
      }
    } finally {
      lock.releaseLock();
    }
    return { ok: true };
  }, 'impostaCategoriaFornitore');
}

// ---------------------------------------------------------------------------
// Lettura delle fatture già importate
// ---------------------------------------------------------------------------

function leggiFatture_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_FATTURE);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_FATTURE.length).getValues()
    .map(function (r, i) {
      return {
        riga: i + 2,
        data: comeData_(r[0]),
        numero: String(r[1]).replace(/^'/, ''),
        fornitore: String(r[2]).replace(/^'/, ''),
        piva: normalizzaPiva_(r[3]),
        tipo: String(r[4]),
        imponibile: Number(r[5]) || 0,
        iva: Number(r[6]) || 0,
        totale: Number(r[7]) || 0,
        scadenza: comeData_(r[8]),
        categoria: String(r[9]).trim() || DA_CATEGORIZZARE,
        nomeFile: String(r[10]).replace(/^'/, ''),
        importata: r[11],
        // Le righe scritte prima della colonna "Origine" vengono tutte dall'importazione XML.
        origine: String(r[12]).trim().toUpperCase() === ORIGINE_CSV ? ORIGINE_CSV : ORIGINE_XML
      };
    })
    .filter(function (f) { return f.data; });
}

/**
 * Fatture ancora da categorizzare e fornitori (arrivati dalle fatture,
 * cioè con P.IVA) che non hanno una categoria predefinita.
 */
function statoCategorizzazione_() {
  var fatture = leggiFatture_().filter(function (f) { return f.categoria === DA_CATEGORIZZARE; });
  var fornitori = leggiFornitori_();
  var gruppi = {};
  var ordine = [];
  var aggiungi = function (nome, piva) {
    var chiave = normalizzaPiva_(piva) || String(nome).toLowerCase();
    if (!gruppi[chiave]) {
      gruppi[chiave] = { nome: nome, piva: normalizzaPiva_(piva), fatture: 0 };
      ordine.push(chiave);
    }
    return gruppi[chiave];
  };
  fatture.forEach(function (f) { aggiungi(f.fornitore, f.piva).fatture++; });
  fornitori.forEach(function (f) {
    if (f.piva && !f.categoria) aggiungi(f.nome, f.piva);
  });
  return {
    fattureDaCategorizzare: fatture.length,
    fornitoriSenzaCategoria: ordine.map(function (k) { return gruppi[k]; })
  };
}
