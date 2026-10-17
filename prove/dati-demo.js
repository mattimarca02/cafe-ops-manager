/*
 * Dati finti (inventati) per provare l'app con il server finto:
 * spese, chiusure e fatture degli ultimi 14 mesi.
 */
'use strict';

function casuale(seme) {
  var s = seme || 12345;
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function riempi(opzioni) {
  opzioni = opzioni || {};
  var rnd = casuale(opzioni.seme || 42);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oggi = new Date();
  var giorno = function (d) { return leggiData_(Utilities.formatDate(d, FUSO, 'yyyy-MM-dd')); };

  scriviImpostazione_(IMP_PIN, '1234');
  scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
  scriviImpostazione_(IMP_EMAIL_COMMERCIALISTA, 'commercialista@example.com');

  var fornitori = [
    ['Torrefazione Rossi', 'Caffè', '01234567897', '333 1234567'],
    ['Bevande Bianchi', 'Bevande', '09876543210', '+39 345 7654321'],
    ['Panificio Verdi', 'Brioche/Pasticceria', '', ''],
    ['Supermercato', 'Alimentari', '', ''],
    ['Ferramenta Neri', 'Manutenzione', '', '']
  ];
  // Altri fornitori finti: servono a provare la ricerca nel modulo spesa con un elenco lungo.
  ['Essemarket', 'Bar Esse Pi', 'Caffè Borgo Antico', 'Cartoleria Bianca', 'Casa del Latte', 'Centro Ghiaccio', 'Cibus Service',
    'Alimentari Cooperativa Sole', 'Distribuzione Lombarda', 'Dolciaria Ferrari', 'Eurobevande', 'Frutta e Verdura Gina', 'Gelateria Fiordilatte',
    'Igiene Plus', 'Latteria Sociale', 'Lavanderia Express', 'Macelleria Conti', 'Ingrosso Cash & Carry', 'Mondo Ufficio',
    'Ortofrutta Esse', 'Pasticceria Dolce Vita', 'Pescheria del Porto', 'Pulizie Brillanti', 'Salumificio Gallo',
    'Tecnoclima Servizi', 'Tipografia Moderna', 'Vini e Liquori Barbieri', 'Èlite Catering', 'Zucchero e Spezie'
  ].forEach(function (nome) { fornitori.push([nome, '', '', '']); });
  var sf = ss.getSheetByName(SCHEDA_FORNITORI);
  fornitori.forEach(function (f) { sf.appendRow(f); });

  var persone = ['Maria', 'Luca', 'Giulia'];
  if (!opzioni.senzaPersone) {
    ss.getSheetByName(SCHEDA_PERSONE).getRange(2, 1, persone.length, 2)
      .setValues(persone.map(function (n) { return [n, '']; }));
  }

  var prodotti = [
    ['Caffè in grani', 'Torrefazione Rossi', 'kg', 'SI', 6, 'Maria'],
    ['Decaffeinato', 'Torrefazione Rossi', 'kg', '', '', ''],
    ['Acqua naturale 0,5 l', 'Bevande Bianchi', 'casse', 'SI', 3, 'Luca'],
    ['Acqua frizzante 0,5 l', 'Bevande Bianchi', 'casse', 'SI', 2, 'Luca'],
    ['Gazzosa in vetro', 'Bevande Bianchi', 'casse', '', '', ''],
    ['Succhi di frutta assortiti', 'Bevande Bianchi', 'cartoni', '', '', ''],
    ['Cornetti vuoti', 'Panificio Verdi', 'pezzi', 'SI', 40, 'Giulia'],
    ['Zucchero in bustine', 'Supermercato', 'scatole', '', '', ''],
    ['Tovaglioli', '', 'pacchi', 'SI', '', 'Maria']
  ];
  var sp = ss.getSheetByName(SCHEDA_PRODOTTI);
  if (sp) {
    sp.getRange(2, 1, prodotti.length, 6).setValues(prodotti);
  }

  var spese = ss.getSheetByName(SCHEDA_SPESE);
  var chiusure = ss.getSheetByName(SCHEDA_CHIUSURE);
  var righeSpese = [];
  var righeChiusure = [];
  var pagamenti = ['Contanti', 'Carta/Bancomat', 'Bonifico'];
  var giorni = opzioni.giorni || 420;
  for (var g = giorni; g >= 0; g--) {
    var d = giorno(new Date(oggi.getTime() - g * 86400000));
    var settimana = Number(Utilities.formatDate(d, FUSO, 'u'));
    if (settimana !== 1 || rnd() < 0.1) {
      var stagione = 1 + 0.25 * Math.sin((Number(Utilities.formatDate(d, FUSO, 'M')) - 3) / 12 * 2 * Math.PI);
      var base = (settimana >= 5 ? 620 : 430) * stagione;
      var contanti = Math.round(base * (0.55 + rnd() * 0.2) * 100) / 100;
      var pos = Math.round(base * (0.25 + rnd() * 0.15) * 100) / 100;
      // Registratore telematico: di solito in pari o quasi, ogni tanto una differenza vera
      var scarto = rnd() < 0.8 ? 0 : Math.round((rnd() * 24 - 12) * 100) / 100;
      var registratore = g < 60 ? Math.round((contanti + pos - scarto) * 100) / 100 : '';
      righeChiusure.push([d, contanti, pos, 150, Math.round((contanti + pos) * 100) / 100,
        registratore !== '' && Math.abs(scarto) > 5 ? 'Resto sbagliato' : '', 'Cdemo' + g, d, '',
        opzioni.senzaPersone ? '' : persone[Math.floor(rnd() * 3)], registratore, registratore === '' ? '' : scarto]);
    }
    if (rnd() < 0.45) {
      var f = fornitori[Math.floor(rnd() * 4)];
      var importo = Math.round((8 + rnd() * 90) * 100) / 100;
      righeSpese.push(['D' + g + 'x' + Math.floor(rnd() * 1e6).toString(36), d, importo, f[0], f[1],
        pagamenti[Math.floor(rnd() * 2)], rnd() < 0.2 ? 'Nota di prova' : '', '', d, '',
        opzioni.senzaPersone ? '' : persone[Math.floor(rnd() * 3)]]);
    }
  }
  if (righeSpese.length) righeSpese[righeSpese.length - 1][7] = 'https://drive.google.com/file/d/scontrino-finto/view';
  if (righeSpese.length) spese.getRange(2, 1, righeSpese.length, righeSpese[0].length).setValues(righeSpese);
  if (righeChiusure.length) chiusure.getRange(2, 1, righeChiusure.length, righeChiusure[0].length).setValues(righeChiusure);

  var fatture = ss.getSheetByName(SCHEDA_FATTURE);
  var righeFatture = [];
  for (var m = 13; m >= 0; m--) {
    var df = giorno(new Date(oggi.getTime() - (m * 30 + 3) * 86400000));
    var scad = new Date(df.getTime() + 30 * 86400000);
    righeFatture.push([df, 'FT-' + (100 + m), 'Torrefazione Rossi', '01234567897', 'TD01 - Fattura',
      250, 55, 305, scad, 'Caffè', 'esempio' + m + '.xml', df]);
    righeFatture.push([df, 'B-' + (200 + m), 'Bevande Bianchi', '09876543210', 'TD01 - Fattura',
      180, 39.6, 219.6, scad, m === 0 ? DA_CATEGORIZZARE : 'Bevande', 'esempio-b' + m + '.xml', df]);
  }
  fatture.getRange(2, 1, righeFatture.length, righeFatture[0].length).setValues(righeFatture);

  // Registro HACCP: ultimi giorni completi, oggi solo il frigo bevande; una temperatura fuori range ieri
  var registroHaccp = ss.getSheetByName(SCHEDA_HACCP);
  if (registroHaccp && !opzioni.senzaHaccp) {
    var controlliHaccp = leggiControlliHaccp_();
    var righeHaccp = [];
    for (var gh = 6; gh >= 1; gh--) {
      var dh = giorno(new Date(oggi.getTime() - gh * 86400000));
      controlliHaccp.forEach(function (c, i) {
        if (c.frequenza === 'settimanale' && gh !== 3) return;
        var valore = c.tipo === 'temperatura' ? Math.round(((c.min + c.max) / 2 + (rnd() - 0.5)) * 10) / 10 : 'Fatto';
        var fuori = gh === 1 && c.id === 'H-frigo-alimenti';
        if (fuori) valore = 6.5;
        righeHaccp.push([dh, '0' + (8 + (i % 2)) + ':' + (10 + i * 7), c.nome, c.tipo, valore,
          c.tipo === 'temperatura' ? (fuori ? 'FUORI RANGE' : 'OK') : 'Fatto',
          fuori ? 'Porta del frigo rimasta aperta: chiusa e ricontrollata dopo 1 ora (3,5 °C)' : '',
          persone[i % 3], c.id, 'Hdemo' + gh + 'x' + i, dh]);
      });
    }
    var frigo = controlliHaccp[0];
    righeHaccp.push([giorno(oggi), '08:05', frigo.nome, frigo.tipo, 4.5, 'OK', '', 'Maria', frigo.id, 'Hdemo-oggi', giorno(oggi)]);
    registroHaccp.getRange(2, 1, righeHaccp.length, righeHaccp[0].length).setValues(righeHaccp);
  }

  // Budget: qualche tetto mensile (uno vicino al limite, uno superato)
  var schedaBudget = ss.getSheetByName(SCHEDA_BUDGET);
  if (schedaBudget && !opzioni.senzaBudget) {
    var tetti = { 'Caffè': 350, 'Bevande': 220, 'Alimentari': 160, 'Brioche/Pasticceria': 400 };
    leggiBudget_().forEach(function (b) {
      if (tetti[b.categoria]) schedaBudget.getRange(b.riga, 2).setValue(tetti[b.categoria]);
    });
  }

  // Contante in cassa: fondo iniziale, data di partenza (3 settimane fa) e qualche movimento
  var schedaMovimenti = ss.getSheetByName(SCHEDA_MOVIMENTI);
  if (schedaMovimenti && !opzioni.senzaMovimenti) {
    var tra = function (g) { return giorno(new Date(oggi.getTime() - g * 86400000)); };
    scriviImpostazione_(IMP_FONDO_INIZIALE, 150);
    scriviImpostazione_(IMP_DATA_PARTENZA_CASSA, tra(21));
    var movimenti = [
      ['Vdemo1', tra(19), TIPO_VERSAMENTO, 1500, 'Versamento settimanale', 'Maria', tra(19)],
      ['Vdemo2', tra(15), TIPO_PRELIEVO_SPESE, 80, 'Mercato: frutta per le spremute', 'Luca', tra(15)],
      ['Vdemo3', tra(12), TIPO_VERSAMENTO, 1800, 'Versamento settimanale', 'Maria', tra(12)],
      ['Vdemo4', tra(8), TIPO_PRELIEVO_PERSONALE, 300, '', 'Maria', tra(8)],
      ['Vdemo5', tra(5), TIPO_VERSAMENTO, 1600, 'Versamento settimanale', 'Giulia', tra(5)]
    ];
    schedaMovimenti.getRange(2, 1, movimenti.length, movimenti[0].length).setValues(movimenti);
  }

  // Margini: oltre al caffè dell'esempio, qualche prodotto (uno sotto la soglia, uno da completare)
  var ricette = schedaRicette_();
  if (ricette && !opzioni.senzaMargini) {
    [['Cappuccino', 1.25, 'l', 150, 1.5, 10, '', 'Mdemo1'],
      ['Spremuta d\'arancia', 1.9, 'kg', 450, 3, 10, '', 'Mdemo2'],
      ['Acqua minerale 0,5 l', 0.9, 'pezzo', 1, 1.5, 22, '', 'Mdemo3'],
      ['Brioche alla crema', '', 'pezzo', 1, 1.3, 10, 'Manca il prezzo del panificio', 'Mdemo4']].forEach(function (r) { ricette.appendRow(r); });
  }

  // Scadenze ricorrenti: gli esempi del setup attivati e una bolletta tra 2 giorni
  var ric = ss.getSheetByName(SCHEDA_RICORRENTI);
  if (ric && ric.getLastRow() >= 4) {
    ric.getRange(2, 6, 3, 1).setValues([['SI'], ['NO'], ['SI']]);
    ric.appendRow(['Bolletta luce e gas', 236.4, 'bimestrale', giorno(new Date(oggi.getTime() + 2 * 86400000)), '', 'SI', '']);
    ric.appendRow(['Canone POS', 19.9, 'mensile', giorno(oggi), '', 'SI', '']);
    aggiornaScadenze_(oggi);
  }
}

module.exports = { riempi: riempi, casuale: casuale };
