/**
 * Bar - Spese & Cassa: saldo per fornitore (schermata "Fornitori" dell'app).
 *
 * Per ogni fornitore: totale delle fatture del mese e dell'anno, già pagato, ancora da
 * pagare e prossima scadenza. "Da pagare" usa lo stato "Pagata" della scheda Scadenze:
 * una fattura è da pagare se la sua scadenza (creata dallo scadenzario) non è segnata
 * pagata. Le fatture senza scadenza nello scadenzario (pagate alla consegna, senza data
 * di pagamento o troppo vecchie) contano come già pagate.
 *
 * calcolaSaldoFornitori_() è una funzione "pura", provata da testSaldoFornitori().
 */

var STATO_FATTURA_DA_PAGARE = 'da pagare';
var STATO_FATTURA_PAGATA = 'pagata';
var STATO_FATTURA_SENZA_SCADENZA = 'senza scadenza';

/**
 * fatture: [{ data, numero, fornitore, piva, totale, scadenza }]
 * scadenze: [{ id, origine, data, pagata }] (scheda Scadenze)
 * anno/mese: il mese dei "totali del mese"; l'anno è quello dei "totali dell'anno".
 * Restituisce { fornitori: [...], totali: { daPagare, mese, anno } } (fornitori dal più "da pagare").
 */
function calcolaSaldoFornitori_(fatture, scadenze, anno, mese, oggi) {
  var perOrigine = {};
  scadenze.forEach(function (s) { if (/^F\|/.test(s.origine || '')) perOrigine[s.origine] = s; });
  var chiaveMese = chiaveMese_(anno, mese);
  var chiaveOggi = chiaveGiorno_(oggi);
  var gruppi = {};
  var ordine = [];

  fatture.forEach(function (f) {
    if (!f.data) return;
    var nome = String(f.fornitore || '').replace(/^'/, '').trim() || 'Fornitore senza nome';
    var chiave = normalizzaPiva_(f.piva) || nome.toLowerCase();
    var g = gruppi[chiave];
    if (!g) {
      g = gruppi[chiave] = { chiave: chiave, nome: nome, piva: normalizzaPiva_(f.piva), totaleMese: 0, totaleAnno: 0, pagatoAnno: 0,
        daPagare: 0, fattureAnno: 0, prossima: null, scaduto: false, fatture: [], ultimaData: '' };
      ordine.push(chiave);
    }
    var giorno = chiaveGiorno_(f.data);
    if (giorno > g.ultimaData) { g.ultimaData = giorno; g.nome = nome; }
    var s = perOrigine['F|' + chiaveFattura_(f.piva, f.numero, f.data)];
    var stato = s ? (s.pagata ? STATO_FATTURA_PAGATA : STATO_FATTURA_DA_PAGARE) : STATO_FATTURA_SENZA_SCADENZA;
    var dellAnno = Number(Utilities.formatDate(f.data, FUSO, 'yyyy')) === anno;
    var totale = Number(f.totale) || 0;
    if (Utilities.formatDate(f.data, FUSO, 'yyyy-MM') === chiaveMese) g.totaleMese += totale;
    if (dellAnno) {
      g.totaleAnno += totale;
      g.fattureAnno++;
      if (stato !== STATO_FATTURA_DA_PAGARE) g.pagatoAnno += totale;
    }
    var scadenza = s && s.data ? s.data : (f.scadenza || null);
    if (stato === STATO_FATTURA_DA_PAGARE) {
      g.daPagare += totale;
      if (scadenza && (!g.prossima || chiaveGiorno_(scadenza) < chiaveGiorno_(g.prossima))) g.prossima = scadenza;
      if (scadenza && chiaveGiorno_(scadenza) < chiaveOggi) g.scaduto = true;
    }
    if (dellAnno || stato === STATO_FATTURA_DA_PAGARE) {
      g.fatture.push({ data: f.data, numero: String(f.numero || '').replace(/^'/, ''), totale: arrotonda_(totale), scadenza: scadenza,
        stato: stato, idScadenza: s ? s.id : '' });
    }
  });

  var fornitori = ordine.map(function (k) { return gruppi[k]; }).filter(function (g) { return g.fatture.length; });
  fornitori.forEach(function (g) {
    g.totaleMese = arrotonda_(g.totaleMese);
    g.totaleAnno = arrotonda_(g.totaleAnno);
    g.pagatoAnno = arrotonda_(g.pagatoAnno);
    g.daPagare = arrotonda_(g.daPagare);
    g.fatture.sort(function (a, b) { return b.data - a.data; });
  });
  fornitori.sort(function (a, b) { return (b.daPagare - a.daPagare) || (b.totaleAnno - a.totaleAnno) || confrontaTesti_(a.nome, b.nome); });
  return {
    fornitori: fornitori,
    totali: {
      daPagare: somma_(fornitori, 'daPagare'),
      mese: somma_(fornitori, 'totaleMese'),
      anno: somma_(fornitori, 'totaleAnno')
    }
  };
}

/** Saldo di un mese leggendo il foglio (porta prima in pari lo scadenzario, se può). */
function saldoFornitoriDelMese_(anno, mese) {
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_SCADENZE)) {
    try {
      aggiornaScadenze_(new Date());
    } catch (e) {
      console.warn('Scadenze non aggiornate prima del saldo fornitori: ' + e);
    }
  }
  var scadenze = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_SCADENZE) ? leggiScadenze_() : [];
  return calcolaSaldoFornitori_(leggiFatture_(), scadenze, anno, mese, new Date());
}

// ---------------------------------------------------------------------------
// Funzione chiamata dall'app
// ---------------------------------------------------------------------------

function saldoFornitori(pin) {
  return esegui_(pin, function () {
    var oggi = annoMeseOggi_();
    var adesso = new Date();
    var saldo = saldoFornitoriDelMese_(oggi.anno, oggi.mese);
    return {
      ok: true,
      nomeMese: MESI[oggi.mese - 1],
      anno: oggi.anno,
      totali: saldo.totali,
      fornitori: saldo.fornitori.map(function (g) {
        return {
          chiave: g.chiave,
          nome: g.nome,
          piva: g.piva,
          totaleMese: g.totaleMese,
          totaleAnno: g.totaleAnno,
          pagatoAnno: g.pagatoAnno,
          daPagare: g.daPagare,
          fattureAnno: g.fattureAnno,
          prossima: g.prossima ? dataIt_(g.prossima) : '',
          quandoProssima: g.prossima ? quandoScade_(giorniDaOggi_(g.prossima, adesso)) : '',
          scaduto: g.scaduto,
          fatture: g.fatture.map(function (f) {
            return {
              data: dataIt_(f.data),
              numero: f.numero,
              totale: f.totale,
              scadenza: f.scadenza ? dataIt_(f.scadenza) : '',
              giorni: f.scadenza ? giorniDaOggi_(f.scadenza, adesso) : null,
              stato: f.stato,
              idScadenza: f.idScadenza
            };
          })
        };
      })
    };
  }, 'saldoFornitori');
}

// ---------------------------------------------------------------------------
// Report mensile
// ---------------------------------------------------------------------------

/** Sezione "Saldo fornitori" del report: fatture del mese e ancora da pagare (oggi). */
function htmlSaldoFornitori_(saldo, nomeMese) {
  var righe = saldo.fornitori.filter(function (g) { return g.totaleMese || g.daPagare; }).map(function (g) {
    return [esc_(g.nome) + '<br><span style="color:#555;font-size:13px;">fatture di ' + esc_(nomeMese) + ': ' + formatoEuro_(g.totaleMese) +
      (g.prossima ? ' · prossima scadenza ' + dataIt_(g.prossima) : '') + '</span>',
      g.daPagare ? '<span style="color:' + (g.scaduto ? '#b3261e' : '#111') + ';">da pagare ' + formatoEuro_(g.daPagare) + '</span>' :
        '<span style="color:#0f6b2f;">nulla da pagare</span>'];
  });
  var h = tabellaHtml_('Saldo fornitori', righe, 'Nessuna fattura nel mese e nulla da pagare.');
  if (righe.length) {
    h += '<p style="color:#555;font-size:13px;margin:6px 0;">Totale ancora da pagare oggi: <b>' + formatoEuro_(saldo.totali.daPagare) +
      '</b> (scadenze delle fatture non segnate «Pagata» nella scheda Scadenze).</p>';
  }
  return h;
}
