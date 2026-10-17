/**
 * Bar - Spese & Cassa: prove della lettura delle fatture elettroniche.
 *
 * testImportaFatture()     controlla, senza scrivere nulla nel foglio, che
 *                          le 3 fatture di esempio vengano lette bene come
 *                          .xml, .xml.p7m (binario e base64, anche con doppia
 *                          firma) e dentro uno .zip.
 * caricaFattureDiEsempio() copia le 3 fatture finte nella cartella
 *                          "Bar - Fatture/Da importare" per provare tutto il
 *                          giro con "Importa fatture" (poi cancella le righe
 *                          di prova dalle schede Fatture e Fornitori).
 *
 * Gli stessi file si trovano nella cartella "esempi" del repository.
 */

var FATTURE_DI_ESEMPIO = [
  {
    nome: "fattura_normale.xml",
    latin1: false,
    atteso: {"data":"15/09/2026","numero":"FT-2026/123","fornitore":"Torrefazione Esempio Srl","piva":"01234567897","tipo":"TD01","imponibile":250,"iva":55,"totale":305,"scadenza":"15/10/2026"},
    xml: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + '\n' +
      "<!-- ESEMPIO FINTO: dati inventati solo per provare l'importazione. -->" + '\n' +
      "<p:FatturaElettronica versione=\"FPR12\" xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" xmlns:p=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" + '\n' +
      "  <FatturaElettronicaHeader>" + '\n' +
      "    <DatiTrasmissione>" + '\n' +
      "      <IdTrasmittente>" + '\n' +
      "        <IdPaese>IT</IdPaese>" + '\n' +
      "        <IdCodice>01234567897</IdCodice>" + '\n' +
      "      </IdTrasmittente>" + '\n' +
      "      <ProgressivoInvio>00001</ProgressivoInvio>" + '\n' +
      "      <FormatoTrasmissione>FPR12</FormatoTrasmissione>" + '\n' +
      "      <CodiceDestinatario>0000000</CodiceDestinatario>" + '\n' +
      "    </DatiTrasmissione>" + '\n' +
      "    <CedentePrestatore>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <IdFiscaleIVA>" + '\n' +
      "          <IdPaese>IT</IdPaese>" + '\n' +
      "          <IdCodice>01234567897</IdCodice>" + '\n' +
      "        </IdFiscaleIVA>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Torrefazione Esempio Srl</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "        <RegimeFiscale>RF01</RegimeFiscale>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Via Finta 1</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CedentePrestatore>" + '\n' +
      "    <CessionarioCommittente>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <CodiceFiscale>RSSMRA60A41B157X</CodiceFiscale>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Bar di Prova</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Via Prova 2</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CessionarioCommittente>" + '\n' +
      "  </FatturaElettronicaHeader>" + '\n' +
      "  <FatturaElettronicaBody>" + '\n' +
      "    <DatiGenerali>" + '\n' +
      "      <DatiGeneraliDocumento>" + '\n' +
      "        <TipoDocumento>TD01</TipoDocumento>" + '\n' +
      "        <Divisa>EUR</Divisa>" + '\n' +
      "        <Data>2026-09-15</Data>" + '\n' +
      "        <Numero>FT-2026/123</Numero>" + '\n' +
      "        <ImportoTotaleDocumento>305.00</ImportoTotaleDocumento>" + '\n' +
      "      </DatiGeneraliDocumento>" + '\n' +
      "    </DatiGenerali>" + '\n' +
      "    <DatiBeniServizi>" + '\n' +
      "      <DettaglioLinee>" + '\n' +
      "        <NumeroLinea>1</NumeroLinea>" + '\n' +
      "        <Descrizione>Caffè in grani miscela bar 1 kg</Descrizione>" + '\n' +
      "        <Quantita>10.00</Quantita>" + '\n' +
      "        <PrezzoUnitario>25.00</PrezzoUnitario>" + '\n' +
      "        <PrezzoTotale>250.00</PrezzoTotale>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "      </DettaglioLinee>" + '\n' +
      "      <DatiRiepilogo>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "        <ImponibileImporto>250.00</ImponibileImporto>" + '\n' +
      "        <Imposta>55.00</Imposta>" + '\n' +
      "        <EsigibilitaIVA>I</EsigibilitaIVA>" + '\n' +
      "      </DatiRiepilogo>" + '\n' +
      "    </DatiBeniServizi>" + '\n' +
      "    <DatiPagamento>" + '\n' +
      "      <CondizioniPagamento>TP02</CondizioniPagamento>" + '\n' +
      "      <DettaglioPagamento>" + '\n' +
      "        <ModalitaPagamento>MP05</ModalitaPagamento>" + '\n' +
      "        <DataScadenzaPagamento>2026-10-15</DataScadenzaPagamento>" + '\n' +
      "        <ImportoPagamento>305.00</ImportoPagamento>" + '\n' +
      "      </DettaglioPagamento>" + '\n' +
      "    </DatiPagamento>" + '\n' +
      "  </FatturaElettronicaBody>" + '\n' +
      "</p:FatturaElettronica>"
  },
  {
    nome: "nota_di_credito.xml",
    latin1: true,
    atteso: {"data":"20/09/2026","numero":"NC 15","fornitore":"Bevande Società Fittizia Snc","piva":"09876543217","tipo":"TD04","imponibile":-40,"iva":-8.8,"totale":-48.8,"scadenza":""},
    xml: "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>" + '\n' +
      "<!-- ESEMPIO FINTO: nota di credito (TD04), codifica ISO-8859-1, namespace predefinito, senza ImportoTotaleDocumento. -->" + '\n' +
      "<FatturaElettronica versione=\"FPR12\" xmlns=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2\">" + '\n' +
      "  <FatturaElettronicaHeader>" + '\n' +
      "    <DatiTrasmissione>" + '\n' +
      "      <IdTrasmittente>" + '\n' +
      "        <IdPaese>IT</IdPaese>" + '\n' +
      "        <IdCodice>09876543217</IdCodice>" + '\n' +
      "      </IdTrasmittente>" + '\n' +
      "      <ProgressivoInvio>A0007</ProgressivoInvio>" + '\n' +
      "      <FormatoTrasmissione>FPR12</FormatoTrasmissione>" + '\n' +
      "      <CodiceDestinatario>0000000</CodiceDestinatario>" + '\n' +
      "    </DatiTrasmissione>" + '\n' +
      "    <CedentePrestatore>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <IdFiscaleIVA>" + '\n' +
      "          <IdPaese>IT</IdPaese>" + '\n' +
      "          <IdCodice>09876543217</IdCodice>" + '\n' +
      "        </IdFiscaleIVA>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Bevande Società Fittizia Snc</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "        <RegimeFiscale>RF01</RegimeFiscale>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Via Inventata 9</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CedentePrestatore>" + '\n' +
      "    <CessionarioCommittente>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <CodiceFiscale>RSSMRA60A41B157X</CodiceFiscale>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Bar di Prova</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Via Prova 2</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CessionarioCommittente>" + '\n' +
      "  </FatturaElettronicaHeader>" + '\n' +
      "  <FatturaElettronicaBody>" + '\n' +
      "    <DatiGenerali>" + '\n' +
      "      <DatiGeneraliDocumento>" + '\n' +
      "        <TipoDocumento>TD04</TipoDocumento>" + '\n' +
      "        <Divisa>EUR</Divisa>" + '\n' +
      "        <Data>2026-09-20</Data>" + '\n' +
      "        <Numero>NC 15</Numero>" + '\n' +
      "        <Causale>Reso vuoti e bottiglie rotte</Causale>" + '\n' +
      "      </DatiGeneraliDocumento>" + '\n' +
      "    </DatiGenerali>" + '\n' +
      "    <DatiBeniServizi>" + '\n' +
      "      <DettaglioLinee>" + '\n' +
      "        <NumeroLinea>1</NumeroLinea>" + '\n' +
      "        <Descrizione>Storno bibite in vetro (reso)</Descrizione>" + '\n' +
      "        <Quantita>1.00</Quantita>" + '\n' +
      "        <PrezzoUnitario>40.00</PrezzoUnitario>" + '\n' +
      "        <PrezzoTotale>40.00</PrezzoTotale>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "      </DettaglioLinee>" + '\n' +
      "      <DatiRiepilogo>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "        <ImponibileImporto>40.00</ImponibileImporto>" + '\n' +
      "        <Imposta>8.80</Imposta>" + '\n' +
      "        <EsigibilitaIVA>I</EsigibilitaIVA>" + '\n' +
      "      </DatiRiepilogo>" + '\n' +
      "    </DatiBeniServizi>" + '\n' +
      "  </FatturaElettronicaBody>" + '\n' +
      "</FatturaElettronica>"
  },
  {
    nome: "fattura_piu_aliquote.xml",
    latin1: false,
    atteso: {"data":"28/09/2026","numero":"2026-0456","fornitore":"Alimentari Prova Spa","piva":"11122233344","tipo":"TD01","imponibile":350,"iva":44,"totale":394,"scadenza":"31/10/2026"},
    xml: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + '\n' +
      "<!-- ESEMPIO FINTO: fattura con aliquote IVA 22%, 10% e 4%, due blocchi DatiBeniServizi e due scadenze di pagamento. -->" + '\n' +
      "<ns2:FatturaElettronica versione=\"FPR12\" xmlns:ns2=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2\">" + '\n' +
      "  <FatturaElettronicaHeader>" + '\n' +
      "    <DatiTrasmissione>" + '\n' +
      "      <IdTrasmittente>" + '\n' +
      "        <IdPaese>IT</IdPaese>" + '\n' +
      "        <IdCodice>11122233344</IdCodice>" + '\n' +
      "      </IdTrasmittente>" + '\n' +
      "      <ProgressivoInvio>0042</ProgressivoInvio>" + '\n' +
      "      <FormatoTrasmissione>FPR12</FormatoTrasmissione>" + '\n' +
      "      <CodiceDestinatario>0000000</CodiceDestinatario>" + '\n' +
      "    </DatiTrasmissione>" + '\n' +
      "    <CedentePrestatore>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <IdFiscaleIVA>" + '\n' +
      "          <IdPaese>IT</IdPaese>" + '\n' +
      "          <IdCodice>11122233344</IdCodice>" + '\n' +
      "        </IdFiscaleIVA>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Alimentari Prova Spa</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "        <RegimeFiscale>RF01</RegimeFiscale>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Viale Esempio 100</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CedentePrestatore>" + '\n' +
      "    <CessionarioCommittente>" + '\n' +
      "      <DatiAnagrafici>" + '\n' +
      "        <CodiceFiscale>RSSMRA60A41B157X</CodiceFiscale>" + '\n' +
      "        <Anagrafica>" + '\n' +
      "          <Denominazione>Bar di Prova</Denominazione>" + '\n' +
      "        </Anagrafica>" + '\n' +
      "      </DatiAnagrafici>" + '\n' +
      "      <Sede>" + '\n' +
      "        <Indirizzo>Via Prova 2</Indirizzo>" + '\n' +
      "        <CAP>12345</CAP>" + '\n' +
      "        <Comune>Città Esempio</Comune>" + '\n' +
      "        <Provincia>XX</Provincia>" + '\n' +
      "        <Nazione>IT</Nazione>" + '\n' +
      "      </Sede>" + '\n' +
      "    </CessionarioCommittente>" + '\n' +
      "  </FatturaElettronicaHeader>" + '\n' +
      "  <FatturaElettronicaBody>" + '\n' +
      "    <DatiGenerali>" + '\n' +
      "      <DatiGeneraliDocumento>" + '\n' +
      "        <TipoDocumento>TD01</TipoDocumento>" + '\n' +
      "        <Divisa>EUR</Divisa>" + '\n' +
      "        <Data>2026-09-28</Data>" + '\n' +
      "        <Numero>2026-0456</Numero>" + '\n' +
      "        <ImportoTotaleDocumento>394.00</ImportoTotaleDocumento>" + '\n' +
      "      </DatiGeneraliDocumento>" + '\n' +
      "    </DatiGenerali>" + '\n' +
      "    <DatiBeniServizi>" + '\n' +
      "      <DettaglioLinee>" + '\n' +
      "        <NumeroLinea>1</NumeroLinea>" + '\n' +
      "        <Descrizione>Detersivi e tovaglioli</Descrizione>" + '\n' +
      "        <Quantita>1.00</Quantita>" + '\n' +
      "        <PrezzoUnitario>100.00</PrezzoUnitario>" + '\n' +
      "        <PrezzoTotale>100.00</PrezzoTotale>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "      </DettaglioLinee>" + '\n' +
      "      <DettaglioLinee>" + '\n' +
      "        <NumeroLinea>2</NumeroLinea>" + '\n' +
      "        <Descrizione>Brioche surgelate</Descrizione>" + '\n' +
      "        <Quantita>4.00</Quantita>" + '\n' +
      "        <PrezzoUnitario>50.00</PrezzoUnitario>" + '\n' +
      "        <PrezzoTotale>200.00</PrezzoTotale>" + '\n' +
      "        <AliquotaIVA>10.00</AliquotaIVA>" + '\n' +
      "      </DettaglioLinee>" + '\n' +
      "      <DatiRiepilogo>" + '\n' +
      "        <AliquotaIVA>22.00</AliquotaIVA>" + '\n' +
      "        <ImponibileImporto>100.00</ImponibileImporto>" + '\n' +
      "        <Imposta>22.00</Imposta>" + '\n' +
      "        <EsigibilitaIVA>I</EsigibilitaIVA>" + '\n' +
      "      </DatiRiepilogo>" + '\n' +
      "      <DatiRiepilogo>" + '\n' +
      "        <AliquotaIVA>10.00</AliquotaIVA>" + '\n' +
      "        <ImponibileImporto>200.00</ImponibileImporto>" + '\n' +
      "        <Imposta>20.00</Imposta>" + '\n' +
      "        <EsigibilitaIVA>I</EsigibilitaIVA>" + '\n' +
      "      </DatiRiepilogo>" + '\n' +
      "    </DatiBeniServizi>" + '\n' +
      "    <DatiBeniServizi>" + '\n' +
      "      <DettaglioLinee>" + '\n' +
      "        <NumeroLinea>3</NumeroLinea>" + '\n' +
      "        <Descrizione>Latte fresco</Descrizione>" + '\n' +
      "        <Quantita>50.00</Quantita>" + '\n' +
      "        <PrezzoUnitario>1.00</PrezzoUnitario>" + '\n' +
      "        <PrezzoTotale>50.00</PrezzoTotale>" + '\n' +
      "        <AliquotaIVA>4.00</AliquotaIVA>" + '\n' +
      "      </DettaglioLinee>" + '\n' +
      "      <DatiRiepilogo>" + '\n' +
      "        <AliquotaIVA>4.00</AliquotaIVA>" + '\n' +
      "        <ImponibileImporto>50.00</ImponibileImporto>" + '\n' +
      "        <Imposta>2.00</Imposta>" + '\n' +
      "        <EsigibilitaIVA>I</EsigibilitaIVA>" + '\n' +
      "      </DatiRiepilogo>" + '\n' +
      "    </DatiBeniServizi>" + '\n' +
      "    <DatiPagamento>" + '\n' +
      "      <CondizioniPagamento>TP01</CondizioniPagamento>" + '\n' +
      "      <DettaglioPagamento>" + '\n' +
      "        <ModalitaPagamento>MP05</ModalitaPagamento>" + '\n' +
      "        <DataScadenzaPagamento>2026-11-30</DataScadenzaPagamento>" + '\n' +
      "        <ImportoPagamento>197.00</ImportoPagamento>" + '\n' +
      "      </DettaglioPagamento>" + '\n' +
      "    </DatiPagamento>" + '\n' +
      "    <DatiPagamento>" + '\n' +
      "      <CondizioniPagamento>TP01</CondizioniPagamento>" + '\n' +
      "      <DettaglioPagamento>" + '\n' +
      "        <ModalitaPagamento>MP05</ModalitaPagamento>" + '\n' +
      "        <DataScadenzaPagamento>2026-10-31</DataScadenzaPagamento>" + '\n' +
      "        <ImportoPagamento>197.00</ImportoPagamento>" + '\n' +
      "      </DettaglioPagamento>" + '\n' +
      "    </DatiPagamento>" + '\n' +
      "  </FatturaElettronicaBody>" + '\n' +
      "</ns2:FatturaElettronica>"
  }
];

function testImportaFatture() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };

  FATTURE_DI_ESEMPIO.forEach(function (es) {
    var xml = byteEsempio_(es);
    var ber = creaP7mDiProva_(xml, true);
    var varianti = [
      { tipo: 'XML', nome: es.nome, byte: xml },
      { tipo: 'P7M binario (DER)', nome: es.nome + '.p7m', byte: creaP7mDiProva_(xml, false) },
      { tipo: 'P7M binario (BER a blocchi)', nome: es.nome + '.p7m', byte: ber },
      { tipo: 'P7M in base64', nome: es.nome + '.p7m', byte: inBase64ConIntestazioni_(ber) },
      { tipo: 'P7M con doppia firma', nome: es.nome + '.p7m.p7m', byte: creaP7mDiProva_(creaP7mDiProva_(xml, false), true) }
    ];
    varianti.forEach(function (v) {
      var etichetta = es.nome + ' [' + v.tipo + ']';
      try {
        var fatture = leggiFileFattura_(v.byte, v.nome);
        verifica(etichetta + ': una fattura', fatture.length === 1);
        confrontaFattura_(fatture[0], es.atteso, etichetta, verifica);
      } catch (e) {
        verifica(etichetta + ': errore "' + e.message + '"', false);
      }
    });
  });

  // Archivio .zip con le 3 fatture (una firmata), un file di metadati SdI e un .txt da ignorare.
  var blobs = FATTURE_DI_ESEMPIO.map(function (es, i) {
    var byte = byteEsempio_(es);
    var nome = es.nome;
    if (i === 0) {
      byte = creaP7mDiProva_(byte, true);
      nome += '.p7m';
    }
    return Utilities.newBlob(conSegno_(byte), 'application/octet-stream', nome);
  });
  blobs.push(Utilities.newBlob('<?xml version="1.0"?><FileMetadati><IdentificativoSdI>1</IdentificativoSdI></FileMetadati>',
    'application/xml', 'IT01234567897_00001_MT_001.xml'));
  blobs.push(Utilities.newBlob('non sono una fattura', 'text/plain', 'leggimi.txt'));
  try {
    var zip = Utilities.zip(blobs, 'fatture_di_prova.zip');
    var problemi = [];
    var documenti = documentiDaFile_(zip, 'fatture_di_prova.zip', problemi, 0);
    verifica('ZIP: 4 file .xml/.p7m trovati (il .txt ignorato)', documenti.length === 4);
    verifica('ZIP: nessun problema', problemi.length === 0);
    var totaleFatture = 0;
    documenti.forEach(function (d) { totaleFatture += leggiFileFattura_(d.byte, d.nome).length; });
    verifica('ZIP: 3 fatture lette (metadati ignorati)', totaleFatture === 3);
  } catch (e) {
    verifica('ZIP: errore "' + e.message + '"', false);
  }

  // File rovinato: deve dare un errore chiaro, non bloccare tutto.
  try {
    leggiFileFattura_(conSegno_([0x30, 0x82, 0x00, 0x05, 1, 2, 3]), 'rotta.xml.p7m');
    verifica('File rovinato: doveva essere segnalato come errore', false);
  } catch (e) {
    verifica('File rovinato segnalato come errore', true);
  }

  // Chiave anti-doppioni.
  var f = leggiFileFattura_(byteEsempio_(FATTURE_DI_ESEMPIO[0]), 'a.xml')[0];
  verifica('Chiave anti-doppioni', chiaveFattura_(f.piva, f.numero, f.data) === '01234567897|FT-2026/123|2026-09-15');

  var messaggio = falliti.length ?
    '✗ Prova fatture: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova fatture superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}

function confrontaFattura_(f, atteso, etichetta, verifica) {
  var data = f.data ? Utilities.formatDate(f.data, FUSO, FORMATO_DATA) : '';
  var scadenza = f.scadenza ? Utilities.formatDate(f.scadenza, FUSO, FORMATO_DATA) : '';
  verifica(etichetta + ': data ' + data, data === atteso.data);
  verifica(etichetta + ': numero ' + f.numero, f.numero === atteso.numero);
  verifica(etichetta + ': fornitore ' + f.fornitore, f.fornitore === atteso.fornitore);
  verifica(etichetta + ': P.IVA ' + f.piva, f.piva === atteso.piva);
  verifica(etichetta + ': tipo ' + f.tipo, f.tipo === atteso.tipo);
  verifica(etichetta + ': imponibile ' + f.imponibile, Math.abs(f.imponibile - atteso.imponibile) < 0.001);
  verifica(etichetta + ': IVA ' + f.iva, Math.abs(f.iva - atteso.iva) < 0.001);
  verifica(etichetta + ': totale ' + f.totale, Math.abs(f.totale - atteso.totale) < 0.001);
  verifica(etichetta + ': scadenza ' + scadenza, scadenza === atteso.scadenza);
}

/** Copia le 3 fatture finte in "Da importare" (la prima come .p7m firmato). */
function caricaFattureDiEsempio() {
  var cartella = cartelleFatture_().daImportare;
  FATTURE_DI_ESEMPIO.forEach(function (es, i) {
    var byte = byteEsempio_(es);
    var nome = 'ESEMPIO_' + es.nome;
    if (i === 0) {
      byte = creaP7mDiProva_(byte, true);
      nome += '.p7m';
    }
    cartella.createFile(Utilities.newBlob(conSegno_(byte), 'application/octet-stream', nome));
  });
  avvisa_('Ho copiato 3 fatture di esempio in "' + NOME_CARTELLA_FATTURE + '/' + CARTELLA_DA_IMPORTARE + '".\n' +
    'Ora usa "Bar > Importa fatture". Alla fine cancella le righe di prova dalle schede Fatture e Fornitori.');
}

// ---------------------------------------------------------------------------
// Strumenti per le prove
// ---------------------------------------------------------------------------

function byteEsempio_(es) {
  if (es.latin1) {
    var out = [];
    for (var i = 0; i < es.xml.length; i++) out.push(es.xml.charCodeAt(i) & 0xFF);
    return out;
  }
  return normalizzaByte_(Utilities.newBlob(es.xml).getBytes());
}

function conSegno_(byte) {
  return byte.map(function (x) { return x > 127 ? x - 256 : x; });
}

function inBase64ConIntestazioni_(byte) {
  var b64 = Utilities.base64Encode(conSegno_(byte));
  var righe = b64.match(/.{1,64}/g).join('\r\n');
  var testo = '-----BEGIN PKCS7-----\r\n' + righe + '\r\n-----END PKCS7-----\r\n';
  var out = [];
  for (var i = 0; i < testo.length; i++) out.push(testo.charCodeAt(i));
  return out;
}

/**
 * Costruisce una busta CMS/PKCS#7 "SignedData" finta ma con la stessa
 * struttura di quelle vere. Con ber = true usa lunghezze indefinite e spezza
 * il contenuto in blocchi da 1000 byte (come fanno molti programmi di firma).
 */
function creaP7mDiProva_(contenuto, ber) {
  var OID_SIGNED_DATA = [0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x07, 0x02];
  var OID_DATA = [0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x07, 0x01];
  var OID_SHA256 = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
  var tlv = function (tag, dati) { return [tag].concat(lunghezzaDer_(dati.length), dati); };
  var indefinito = function (tag, dati) { return [tag, 0x80].concat(dati, [0x00, 0x00]); };
  var falsi = function (n, primo) { var a = [primo]; for (var i = 1; i < n; i++) a.push((i * 37) & 0xFF); return a; };

  var eContent;
  if (ber) {
    var blocchi = [];
    for (var i = 0; i < contenuto.length; i += 1000) {
      blocchi = blocchi.concat(tlv(0x04, contenuto.slice(i, i + 1000)));
    }
    eContent = indefinito(0x24, blocchi);
  } else {
    eContent = tlv(0x04, contenuto);
  }
  var contenitore = ber ? indefinito : tlv;
  var encap = contenitore(0x30, OID_DATA.concat(contenitore(0xA0, eContent)));
  var algoritmi = tlv(0x31, tlv(0x30, OID_SHA256.concat([0x05, 0x00])));
  // Certificato e firma finti: contengono OCTET STRING che NON sono la fattura.
  var certificato = tlv(0xA0, tlv(0x30, tlv(0x30, tlv(0x04, falsi(64, 0x30)).concat(tlv(0x03, falsi(40, 0x00))))));
  var firma = tlv(0x31, tlv(0x30, [0x02, 0x01, 0x01].concat(tlv(0x04, falsi(32, 0x30)), tlv(0x04, falsi(256, 0x11)))));
  var signedData = contenitore(0x30, [0x02, 0x01, 0x01].concat(algoritmi, encap, certificato, firma));
  return contenitore(0x30, OID_SIGNED_DATA.concat(contenitore(0xA0, signedData)));
}

function lunghezzaDer_(n) {
  if (n < 0x80) return [n];
  var byte = [];
  while (n > 0) {
    byte.unshift(n & 0xFF);
    n = Math.floor(n / 256);
  }
  return [0x80 | byte.length].concat(byte);
}
