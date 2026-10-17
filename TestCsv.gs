/**
 * Bar - Spese & Cassa: prove della lettura dei CSV del portale "Fatture e Corrispettivi".
 *
 * testImportaCsv() controlla, senza scrivere nulla nel foglio, il parser CSV e il
 * riconoscimento di fatture ricevute/emesse, note di credito, importi, date e codifiche,
 * sul CSV di esempio FINTO (stesso contenuto di esempi/fatture_ricevute_esempio.csv:
 * fornitori e dati inventati).
 */

var RIGHE_CSV_DI_ESEMPIO = [
  "Tipo fattura;Tipo documento;Numero fattura / Documento;Data emissione;Data trasmissione;Codice fiscale fornitore;Partita IVA fornitore;Denominazione fornitore;Codice fiscale cliente;Partita IVA cliente;Denominazione cliente;Imponibile/Importo (totale in euro);Imposta (totale in euro);Sdi/file;Fatture consegnate;Data ricezione;Bollo virtuale",
  "Fattura;TD01 - Fattura;FT-2026/123;15/09/2026;15/09/2026;;01234567897;Torrefazione Esempio Srl;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;250,00;55,00;IT01234567897_00001.xml;;15/09/2026;",
  "Fattura;TD04 - Nota di credito;NC-0007;02/10/2026;02/10/2026;;01234567897;Torrefazione Esempio Srl;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;100,00;22,00;IT01234567897_00002.xml;;02/10/2026;",
  "",
  "Fattura;TD01 - Fattura;B-88;21/09/2026;21/09/2026;;09876543210;\"Bevande \"\"Bianchi\"\" & Figli; Snc\";BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;1.234,56;271,60;IT09876543210_00010.xml;;21/09/2026;",
  "Fattura;TD01 - Fattura;EM-1;30/09/2026;30/09/2026;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;;05555555550;Cliente Fittizio Spa;80,00;17,60;IT12345678903_00003.xml;;30/09/2026;",
  "Fattura;TD01 - Fattura;B-88;21/09/2026;21/09/2026;;09876543210;\"Bevande \"\"Bianchi\"\" & Figli; Snc\";BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;1.234,56;271,60;IT09876543210_00010.xml;;21/09/2026;",
  "Fattura;TD04 - Nota di credito;NC-NEG-1;03/10/2026;03/10/2026;;11122233344;Alimentari Prova Spa;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;-50,00;-11,00;IT11122233344_00004.xml;;03/10/2026;",
  "Fattura;TD01 - Fattura;12/A;2026-10-05;2026-10-05;BNCMRA70A01F205Z;;Mario Bianchi;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;80.50;17.71;IT_CF_00005.xml;;2026-10-05;",
  "Fattura;TD01 - Fattura;X-31;31/02/2026;31/02/2026;;11122233344;Alimentari Prova Spa;BRVNNA85M41H501K;12345678903;Bar Esempio di Anna Verdi;10,00;2,20;IT11122233344_00006.xml;;31/02/2026;",
  "Fattura;TD01 - Fattura;X-1;10/10/2026;",
  ""
];

function testoCsvDiEsempio_() {
  return RIGHE_CSV_DI_ESEMPIO.join('\r\n') + '\r\n';
}

function testImportaCsv() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var giorno = function (d) { return d ? Utilities.formatDate(d, FUSO, FORMATO_DATA) : ''; };

  // --- CSV di esempio ---
  var r = leggiFattureCsv_(testoCsvDiEsempio_());
  verifica('righe di dati lette: 9 (le righe vuote non contano)', r.righeLette === 9);
  verifica('fatture valide lette: 6 (il doppione si toglie all\'importazione)', r.fatture.length === 6);
  verifica('fatture emesse saltate: 1', r.emesse === 1);
  verifica('righe con errore: 2', r.errori.length === 2);
  verifica('errore: data non valida con il numero di riga', /riga 10: la data di emissione "31\/02\/2026" non è valida/.test(r.errori[0] || ''));
  verifica('errore: riga troncata', /riga 11: mancano delle colonne/.test(r.errori[1] || ''));

  var normale = r.fatture[0];
  verifica('riga normale: numero', normale.numero === 'FT-2026/123');
  verifica('riga normale: data 15/09/2026', giorno(normale.data) === '15/09/2026');
  verifica('riga normale: fornitore', normale.fornitore === 'Torrefazione Esempio Srl');
  verifica('riga normale: P.IVA', normale.piva === '01234567897');
  verifica('riga normale: tipo TD01', normale.tipo === 'TD01');
  verifica('riga normale: imponibile 250', normale.imponibile === 250);
  verifica('riga normale: IVA 55', normale.iva === 55);
  verifica('riga normale: totale 305', normale.totale === 305);
  verifica('riga normale: scadenza vuota', normale.scadenza === null);
  verifica('chiave anti-doppione uguale a quella dell\'XML',
    chiaveFattura_(normale.piva, normale.numero, normale.data) === '01234567897|FT-2026/123|2026-09-15');

  var nota = r.fatture[1];
  verifica('nota di credito con importi positivi → negativi', nota.tipo === 'TD04' && nota.imponibile === -100 && nota.iva === -22 && nota.totale === -122);

  var virgolette = r.fatture[2];
  verifica('virgolette e ";" dentro il nome', virgolette.fornitore === 'Bevande "Bianchi" & Figli; Snc');
  verifica('importo 1.234,56 e totale 1.506,16', virgolette.imponibile === 1234.56 && virgolette.iva === 271.6 && virgolette.totale === 1506.16);

  var negativa = r.fatture[4];
  verifica('nota di credito già negativa: non si inverte due volte', negativa.imponibile === -50 && negativa.iva === -11 && negativa.totale === -61);

  var senzaPiva = r.fatture[5];
  verifica('senza P.IVA si usa il codice fiscale', senzaPiva.piva === 'BNCMRA70A01F205Z');
  verifica('data aaaa-mm-gg', giorno(senzaPiva.data) === '05/10/2026');
  verifica('importi con il punto decimale', senzaPiva.imponibile === 80.5 && senzaPiva.iva === 17.71 && senzaPiva.totale === 98.21);
  verifica('numero con barra', senzaPiva.numero === '12/A');

  // --- importi ---
  verifica('importo 1.234,56', importoCsv_('1.234,56') === 1234.56);
  verifica('importo 1234,56', importoCsv_('1234,56') === 1234.56);
  verifica('importo 1234.56', importoCsv_('1234.56') === 1234.56);
  verifica('importo 1,234.56 (all\'americana)', importoCsv_('1,234.56') === 1234.56);
  verifica('importo 12,5', importoCsv_('12,5') === 12.5);
  verifica('importo 1.234 = mille duecento trentaquattro', importoCsv_('1.234') === 1234);
  verifica('importo con euro e spazi', importoCsv_(' € 1.000,00 ') === 1000);
  verifica('importo negativo', importoCsv_('-12,50') === -12.5);
  verifica('importo tra parentesi', importoCsv_('(12,50)') === -12.5);
  verifica('importo vuoto', importoCsv_('') === '');
  verifica('importo non valido', importoCsv_('abc') === null && importoCsv_('1,2,3') === null);

  // --- intestazioni, ordine delle colonne, righe prima delle intestazioni, separatore virgola ---
  var variante = [
    'Titolo del file;;;',
    '',
    '  DENOMINAZIONE   FORNITORE ; Imponibile/Importo ;IMPOSTA;Data Emissione;Numero Fattura / Documento;Partita IVA fornitore;Partita IVA cliente',
    'Rossi Srl;100,00;22,00;09/10/2026;77;IT01234567897;12345678903',
    'Verdi Srl;50,00;;10/10/2026;78;01234567897;12345678903',
    'Fuori Srl;5,00;1,10;10/10/2026;79;09876543210;12345678903'
  ].join('\n');
  var v = leggiFattureCsv_(variante);
  verifica('intestazioni per nome, in ordine diverso e con maiuscole/spazi', v.fatture.length === 3 && v.errori.length === 0);
  verifica('P.IVA con prefisso IT senza prefisso', v.fatture[0].piva === '01234567897');
  verifica('imposta vuota = 0', v.fatture[1].iva === 0 && v.fatture[1].totale === 50);
  verifica('senza «Tipo documento» è una fattura TD01', v.fatture[0].tipo === 'TD01');
  var virgola = leggiFattureCsv_('Numero,Data emissione,Denominazione fornitore,Imponibile,Imposta\n1,01/10/2026,"Rossi, Srl","1,50",0,33');
  verifica('separatore virgola (riga con colonne in più → errore chiaro)', virgola.errori.length === 1);
  var virgola2 = leggiFattureCsv_('Numero,Data emissione,Denominazione fornitore,Imponibile,Imposta\n1,01/10/2026,"Rossi, Srl",100.00,22.00');
  verifica('separatore virgola', virgola2.fatture.length === 1 && virgola2.fatture[0].fornitore === 'Rossi, Srl' && virgola2.fatture[0].totale === 122);

  // --- ricevute / emesse ---
  var emesse = leggiFattureCsv_([
    'Tipo fattura;Numero;Data emissione;Denominazione fornitore;Imponibile;Imposta',
    'Fattura emessa;1;01/10/2026;Bar;10,00;2,20',
    'Fattura ricevuta;2;02/10/2026;Rossi Srl;10,00;2,20'
  ].join('\n'));
  verifica('«Tipo fattura» con emessa/ricevuta', emesse.emesse === 1 && emesse.fatture.length === 1 && emesse.fatture[0].numero === '2');
  var solo = leggiFattureCsv_('Numero;Data emissione;Denominazione fornitore;Imponibile;Imposta;Partita IVA fornitore;Partita IVA cliente\n5;01/10/2026;Rossi Srl;10,00;2,20;01234567897;12345678903');
  verifica('una sola riga: vale come ricevuta', solo.emesse === 0 && solo.fatture.length === 1);

  // --- file non validi ---
  var errori = 0;
  try { leggiFattureCsv_(''); } catch (e) { errori++; }
  try { leggiFattureCsv_('uno;due;tre\n1;2;3'); } catch (e2) { if (/non riconosco le colonne/.test(e2.message)) errori++; }
  verifica('file vuoto o senza le colonne giuste: errore chiaro', errori === 2);

  // --- codifiche ---
  var utf8 = [0xEF, 0xBB, 0xBF].concat(normalizzaByte_(Utilities.newBlob('Caffè Ànna').getBytes()));
  verifica('UTF-8 con BOM', byteCsvATesto_(utf8) === 'Caffè Ànna');
  verifica('UTF-8 senza BOM', byteCsvATesto_(utf8.slice(3)) === 'Caffè Ànna');
  var latin1 = [0x43, 0x61, 0x66, 0x66, 0xE8, 0x20, 0xC0, 0x6E, 0x6E, 0x61]; // "Caffè Ànna" in ISO-8859-1
  verifica('ISO-8859-1 / Windows-1252', byteCsvATesto_(latin1) === 'Caffè Ànna');

  // --- tipi documento ---
  verifica('tipo documento TD04', codiceTipoDocumento_('TD04 - Nota di credito') === 'TD04' && codiceTipoDocumento_('Nota di credito') === 'TD04');
  verifica('tipo documento sconosciuto', codiceTipoDocumento_('boh') === '');

  var messaggio = falliti.length ?
    '✗ Prova CSV: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova CSV superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
