/*
 * Prove dell'importazione dei CSV del portale con l'Apps Script finto:
 * scheda Fatture, doppioni tra XML e CSV, zip, fornitori, cartelle, scadenzario.
 * Tutti i dati sono inventati (esempi/fatture_ricevute_esempio.csv).
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var CSV_ESEMPIO = path.join(__dirname, '..', 'esempi', 'fatture_ricevute_esempio.csv');

function righeFatture() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fatture');
  return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, 13).getValues();
}

function trova(numero) {
  return righeFatture().filter(function (r) { return String(r[1]) === numero; });
}

function nomiFile(cartella) {
  var out = [];
  var it = cartella.getFiles();
  while (it.hasNext()) out.push(it.next().getName());
  return out.sort();
}

function mettiCsv(nome, testo) {
  cartelleFatture_().daImportare.createFile(Utilities.newBlob(testo === undefined ? testoCsvDiEsempio_() : testo, 'text/csv', nome));
}

function mettiXmlEsempio(indice) {
  var es = FATTURE_DI_ESEMPIO[indice];
  cartelleFatture_().daImportare.createFile(Utilities.newBlob(conSegno_(byteEsempio_(es)), 'application/xml', es.nome));
}

function sottocartella(madre, nome) {
  var it = madre.getFoldersByName(nome);
  return it.hasNext() ? it.next() : null;
}

module.exports = {
  'il CSV di esempio nel repository è uguale a quello usato da testImportaCsv': function () {
    var file = fs.readFileSync(CSV_ESEMPIO, 'utf8');
    assert.strictEqual(file, '﻿' + testoCsvDiEsempio_());
  },

  'importa solo le ricevute, riepilogo e righe scritte': function () {
    mettiCsv('portale.csv');
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.importate, 5);
    assert.strictEqual(e.doppie, 1);
    assert.strictEqual(e.emesse, 1);
    assert.strictEqual(e.righeErrore, 2);
    assert.strictEqual(e.errori, 1, 'il file con righe rovinate va in Errori');
    var testo = testoEsitoImportazione_(e);
    assert.ok(/Fatture importate: 5/.test(testo) && /già presenti: 1/.test(testo) &&
      /emesse \(non ricevute\): 1/.test(testo) && /Righe con errore: 2/.test(testo), testo);
    assert.ok(/riga 10: la data di emissione/.test(testo));

    assert.strictEqual(righeFatture().length, 5);
    var f = trova('FT-2026/123')[0];
    assert.strictEqual(Utilities.formatDate(f[0], FUSO, 'dd/MM/yyyy'), '15/09/2026');
    assert.deepStrictEqual([f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[12]],
      ['Torrefazione Esempio Srl', '01234567897', 'TD01 - Fattura', 250, 55, 305, '', 'Da categorizzare', 'portale.csv', 'CSV']);
    assert.ok(f[11] instanceof Date, 'Importata il');
    var nota = trova('NC-0007')[0];
    assert.deepStrictEqual([nota[5], nota[6], nota[7], nota[4]], [-100, -22, -122, 'TD04 - Nota di credito']);
    assert.strictEqual(trova('NC-NEG-1')[0][7], -61);
    assert.strictEqual(trova('B-88').length, 1, 'il doppione nello stesso file è saltato');
    assert.strictEqual(trova('B-88')[0][7], 1506.16);
    assert.strictEqual(trova('B-88')[0][2], 'Bevande "Bianchi" & Figli; Snc');
    assert.strictEqual(trova('12/A')[0][3], 'BNCMRA70A01F205Z');
    assert.strictEqual(trova('EM-1').length, 0, 'la fattura emessa non c\'è');
    assert.strictEqual(trova('X-31').length + trova('X-1').length, 0);

    // Fornitori nuovi senza categoria; fatture da categorizzare
    var fornitori = leggiFornitori_().map(function (x) { return x.nome; }).sort();
    assert.deepStrictEqual(fornitori, ['Alimentari Prova Spa', 'Bevande "Bianchi" & Figli; Snc', 'Mario Bianchi', 'Torrefazione Esempio Srl']);
    assert.ok(leggiFornitori_().every(function (x) { return !x.categoria; }));
    assert.strictEqual(statoCategorizzazione_().fattureDaCategorizzare, 5);

    // File in "Errori" (ci sono righe rovinate); le fatture buone restano importate
    var c = cartelleFatture_();
    assert.deepStrictEqual(nomiFile(c.errori), ['portale.csv']);
    assert.deepStrictEqual(nomiFile(c.daImportare), []);
    // Rilanciando lo stesso file nulla viene duplicato
    mettiCsv('portale-ancora.csv');
    var e2 = importaFattureSilenzioso_();
    assert.strictEqual(e2.importate, 0);
    assert.strictEqual(e2.doppie, 6);
    assert.strictEqual(righeFatture().length, 5);
  },

  'senza righe rovinate il file va in Importate/AAAA-MM': function () {
    var pulito = testoCsvDiEsempio_().split('\r\n').filter(function (r) { return !/^Fattura;TD01 - Fattura;X-/.test(r); }).join('\r\n');
    mettiCsv('pulito.csv', pulito);
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.errori, 0);
    assert.strictEqual(e.righeErrore, 0);
    var c = cartelleFatture_();
    var mese = sottocartella(c.importate, '2026-10');
    assert.ok(mese, 'cartella del mese più recente tra le fatture del file');
    assert.deepStrictEqual(nomiFile(mese), ['pulito.csv']);
  },

  'XML già presente: il CSV non lo tocca e salta il doppione': function () {
    mettiXmlEsempio(0);
    importaFattureSilenzioso_();
    assert.strictEqual(trova('FT-2026/123')[0][12], 'XML');
    mettiCsv('portale.csv');
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.importate, 4);
    assert.strictEqual(e.doppie, 2, 'FT-2026/123 (già da XML) e B-88 (ripetuta)');
    var riga = trova('FT-2026/123');
    assert.strictEqual(riga.length, 1);
    assert.strictEqual(riga[0][12], 'XML');
    assert.strictEqual(Utilities.formatDate(riga[0][8], FUSO, 'dd/MM/yyyy'), '15/10/2026', 'resta la scadenza dell\'XML');
  },

  'CSV prima e XML dopo: la riga viene completata con l\'XML e tiene la categoria': function () {
    mettiCsv('portale.csv');
    importaFattureSilenzioso_();
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fatture');
    var riga = trova('FT-2026/123');
    assert.strictEqual(riga[0][12], 'CSV');
    // La titolare ha già dato una categoria a mano
    var numeroRiga = leggiFatture_().filter(function (f) { return f.numero === 'FT-2026/123'; })[0].riga;
    s.getRange(numeroRiga, 10).setValue('Caffè');
    var prima = righeFatture().length;
    mettiXmlEsempio(0);
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.importate, 0);
    assert.strictEqual(e.doppie, 0);
    assert.strictEqual(e.sostituite, 1);
    assert.ok(/completate con i dati dell'XML/.test(testoEsitoImportazione_(e)));
    assert.strictEqual(righeFatture().length, prima, 'nessuna riga in più');
    var dopo = trova('FT-2026/123');
    assert.strictEqual(dopo.length, 1);
    assert.strictEqual(dopo[0][12], 'XML');
    assert.strictEqual(dopo[0][9], 'Caffè');
    assert.strictEqual(Utilities.formatDate(dopo[0][8], FUSO, 'dd/MM/yyyy'), '15/10/2026');
    assert.strictEqual(dopo[0][10], 'fattura_normale.xml');
  },

  'dentro uno zip: CSV e XML insieme (XML nello stesso zip ha la precedenza)': function () {
    var blobs = [
      Utilities.newBlob(testoCsvDiEsempio_(), 'text/csv', 'elenco.csv'),
      Utilities.newBlob(conSegno_(byteEsempio_(FATTURE_DI_ESEMPIO[0])), 'application/xml', 'fattura_normale.xml'),
      Utilities.newBlob('non sono una fattura', 'text/plain', 'leggimi.txt')
    ];
    cartelleFatture_().daImportare.createFile(Utilities.zip(blobs, 'portale.zip'));
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.sostituite, 1);
    assert.strictEqual(e.importate, 5, '5 fatture dal CSV (il doppione B-88 escluso); quella dell\'XML sostituisce la riga da CSV');
    assert.strictEqual(trova('FT-2026/123').length, 1);
    assert.strictEqual(trova('FT-2026/123')[0][12], 'XML');
    assert.strictEqual(righeFatture().length, 5);
  },

  'CSV in ISO-8859-1 con lettere accentate': function () {
    var testo = 'Numero;Data emissione;Denominazione fornitore;Imponibile;Imposta\r\n9;09/10/2026;Caffè Ànna;10,00;2,20\r\n';
    var byte = [];
    for (var i = 0; i < testo.length; i++) byte.push(testo.charCodeAt(i) & 0xFF); // un byte per lettera = ISO-8859-1
    cartelleFatture_().daImportare.createFile(Utilities.newBlob(byte, 'text/csv', 'latin1.csv'));
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.importate, 1);
    assert.strictEqual(trova('9')[0][2], 'Caffè Ànna');
  },

  'file CSV non riconosciuto → cartella Errori con motivo chiaro': function () {
    mettiCsv('strano.csv', 'a;b;c\r\n1;2;3\r\n');
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.errori, 1);
    assert.ok(/non riconosco le colonne del CSV/.test(e.fileErrore[0]), e.fileErrore[0]);
    assert.deepStrictEqual(nomiFile(cartelleFatture_().errori), ['strano.csv']);
    assert.strictEqual(righeFatture().length, 0);
  },

  'un file con solo fatture emesse va in Importate, non in Errori': function () {
    mettiCsv('emesse.csv', [
      'Tipo fattura;Numero;Data emissione;Denominazione fornitore;Imponibile;Imposta',
      'Emessa;1;01/10/2026;Bar Esempio;10,00;2,20'
    ].join('\r\n'));
    var e = importaFattureSilenzioso_();
    assert.strictEqual(e.emesse, 1);
    assert.strictEqual(e.errori, 0);
    assert.strictEqual(nomiFile(cartelleFatture_().errori).length, 0);
  },

  'le fatture da CSV non creano scadenze': function () {
    mettiCsv('portale.csv');
    importaFattureSilenzioso_();
    var e = aggiornaScadenze_(leggiData_('2026-10-12'));
    assert.strictEqual(e.daFatture, 0);
    assert.strictEqual(leggiScadenze_().length, 0);
  },

  'foglio già esistente: «Prepara il foglio» aggiunge Origine senza toccare i dati': function () {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fatture');
    s.getRange(1, 13).setValue('');
    s.appendRow([leggiData_('2026-09-15'), 'VECCHIA-1', 'Fornitore Vecchio', '01234567897', 'TD01 - Fattura', 10, 2.2, 12.2,
      leggiData_('2026-10-15'), 'Caffè', 'a.xml', new Date()]);
    setup();
    var intestazione = s.getRange(1, 1, 1, 13).getValues()[0];
    assert.strictEqual(intestazione[12], 'Origine');
    var dopo = leggiFatture_();
    assert.strictEqual(dopo.length, 1);
    assert.strictEqual(dopo[0].numero, 'VECCHIA-1');
    assert.strictEqual(dopo[0].totale, 12.2);
    assert.strictEqual(dopo[0].origine, 'XML', 'le righe vecchie valgono come XML');
  },

  'l\'attivatore giornaliero importa anche i CSV': function () {
    mettiCsv('portale.csv');
    importaFattureAutomatica();
    assert.strictEqual(righeFatture().length, 5);
  }
};
