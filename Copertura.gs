/**
 * Bar - Spese & Cassa: «Spese coperte dai ricavi» (sezione del Riepilogo).
 *
 * calcolaCopertura_() è una funzione "pura" (riceve gli elenchi, non legge il
 * foglio): viene provata da testCopertura() in TestCopertura.gs.
 *
 * Regole (spiegate in modo semplice in README_IT.md):
 *  - i giorni si scorrono in ordine; in ogni giorno le spese si "aprono" PRIMA
 *    dei ricavi dello stesso giorno;
 *  - un ricavo copre la spesa aperta più vecchia (FIFO); se avanza passa alla
 *    successiva; se non ci sono spese aperte va in "avanzo", che copre subito
 *    le spese che si aprono dopo;
 *  - una nota di credito (importo negativo) si comporta come un credito: copre
 *    le spese aperte più vecchie e, se avanza, resta come avanzo;
 *  - tutti i conti sono in centesimi interi (niente errori di arrotondamento).
 */

var FILTRI_COPERTURA = ['tutte', 'senzaFattura', 'fatture'];
var GIORNI_MAX_COPERTURA = 3660;

function centesimi_(euro) {
  return Math.round((Number(euro) || 0) * 100);
}

/** Centesimi interi → euro (esatti al centesimo: 7100 → 71, 12345 → 123.45). */
function daCentesimi_(c) {
  return c / 100;
}

/** Giorno successivo a "yyyy-MM-dd" (calcolo in UTC: nessun problema con l'ora legale). */
function giornoDopo_(chiave) {
  var p = chiave.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + 1));
  return d.getUTCFullYear() + '-' + due_(d.getUTCMonth() + 1) + '-' + due_(d.getUTCDate());
}

/** Giorni tra due chiavi "yyyy-MM-dd" (a − da). */
function giorniTra_(da, a) {
  var p = da.split('-');
  var q = a.split('-');
  return Math.round((Date.UTC(+q[0], +q[1] - 1, +q[2]) - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000);
}

/**
 * spese: [{data, importo, fornitore}] (senza fattura), fatture: [{data, totale, fornitore}]
 * (le note di credito hanno il totale negativo), chiusure: [{data, totale}].
 * da / a: "yyyy-MM-dd", estremi compresi. filtro: 'tutte' | 'senzaFattura' | 'fatture'.
 * oggi: "yyyy-MM-dd" (i giorni dopo oggi non contano come "senza chiusura").
 *
 * Restituisce { ok, righe, totali, mesi, ... } oppure { ok: false, messaggio }.
 * Gli importi delle righe sono in euro; i conti interni sono in centesimi.
 */
function calcolaCopertura_(spese, fatture, chiusure, da, a, filtro, oggi) {
  var reChiave = /^\d{4}-\d{2}-\d{2}$/;
  if (!reChiave.test(da || '') || !reChiave.test(a || '')) return { ok: false, messaggio: 'Date del periodo non valide.' };
  if (a < da) return { ok: false, messaggio: 'La data finale è prima della data iniziale.' };
  if (giorniTra_(da, a) + 1 > GIORNI_MAX_COPERTURA) return { ok: false, messaggio: 'Periodo troppo lungo: scegli al massimo 10 anni.' };
  if (FILTRI_COPERTURA.indexOf(filtro) < 0) filtro = 'tutte';
  oggi = reChiave.test(oggi || '') ? oggi : a;

  var chiave = function (data) { return data ? chiaveGiorno_(data) : ''; };
  var nelPeriodo = function (k) { return k && k >= da && k <= a; };

  // Spese e fatture del periodo, nell'ordine di arrivo (prima senza fattura, poi fatture)
  var voci = [];
  var ignorateZero = 0;
  var aggiungi = function (elenco, campo, origine) {
    (elenco || []).forEach(function (x) {
      var k = chiave(x.data);
      if (!nelPeriodo(k)) return;
      var c = centesimi_(x[campo]);
      if (c === 0) { ignorateZero++; return; }
      voci.push({ giorno: k, centesimi: c, fornitore: String(x.fornitore || '').trim() || 'Senza nome', origine: origine });
    });
  };
  if (filtro !== 'fatture') aggiungi(spese, 'importo', 'spesa');
  if (filtro !== 'senzaFattura') aggiungi(fatture, 'totale', 'fattura');

  var speseDelGiorno = {};
  voci.forEach(function (v) {
    (speseDelGiorno[v.giorno] = speseDelGiorno[v.giorno] || []).push(v);
  });

  // Ricavi: "Totale incasso" delle chiusure, un valore per giorno
  var ricaviDelGiorno = {};
  var conChiusura = {};
  (chiusure || []).forEach(function (c) {
    var k = chiave(c.data);
    if (!nelPeriodo(k)) return;
    conChiusura[k] = true;
    ricaviDelGiorno[k] = (ricaviDelGiorno[k] || 0) + Math.max(0, centesimi_(c.totale));
  });

  var righe = [];
  var aperte = [];          // spese non ancora coperte, la più vecchia per prima
  var avanzo = 0;
  var speseTotali = 0;
  var ricaviTotali = 0;
  var numeroSpese = 0;
  var numeroCoperte = 0;
  var sommaGiorniCopertura = 0;
  var giorniSenzaChiusura = [];
  var perMese = {};
  var ordineMesi = [];
  var numeroRiga = 0;

  var mese = function (k) {
    var m = k.substring(0, 7);
    if (!perMese[m]) {
      perMese[m] = { chiave: m, speseC: 0, ricaviC: 0, scopertoC: 0, avanzoC: 0 };
      ordineMesi.push(m);
    }
    return perMese[m];
  };

  /** Il credito (ricavo o nota di credito) copre le spese aperte, dalla più vecchia; ritorna cosa avanza. */
  var applica = function (credito, giorno, daAvanzo, toccate) {
    while (credito > 0 && aperte.length) {
      var s = aperte[0];
      var uso = Math.min(credito, s.residuo);
      s.residuo -= uso;
      credito -= uso;
      if (toccate.indexOf(s) < 0) toccate.push(s);
      if (s.residuo === 0) {
        aperte.shift();
        s.chiusaIl = giorno;
        s.daAvanzo = daAvanzo;
        numeroCoperte++;
        sommaGiorniCopertura += giorniTra_(s.giorno, giorno);
      }
    }
    return credito;
  };

  var righeNastrini = function (toccate) {
    toccate.forEach(function (s) {
      var coperta = s.residuo === 0;
      righe.push({
        tipo: 'nastrino',
        spesa: s.numero,
        data: s.giorno,
        fornitore: s.fornitore,
        importo: daCentesimi_(s.centesimi),
        residuo: daCentesimi_(coperta ? 0 : -s.residuo),
        coperta: coperta,
        dataChiusura: coperta ? s.chiusaIl : null,
        daAvanzo: coperta ? !!s.daAvanzo : false
      });
    });
  };

  // Scorro tutti i giorni del periodo (anche quelli vuoti, per segnalare le chiusure mancanti)
  for (var giorno = da; giorno <= a; giorno = giornoDopo_(giorno)) {
    var m = mese(giorno);
    var manca = !conChiusura[giorno] && giorno <= oggi;   // giorno passato senza chiusura cassa

    // 1. Le spese del giorno si aprono prima dei ricavi dello stesso giorno
    (speseDelGiorno[giorno] || []).forEach(function (v) {
      var toccate = [];
      speseTotali += v.centesimi;
      m.speseC += v.centesimi;
      if (v.centesimi > 0) {
        numeroRiga++;
        numeroSpese++;
        var s = { numero: numeroRiga, giorno: giorno, fornitore: v.fornitore, centesimi: v.centesimi, residuo: v.centesimi };
        righe.push({ tipo: 'spesa', numero: s.numero, data: giorno, fornitore: v.fornitore, importo: daCentesimi_(v.centesimi),
          origine: v.origine, notaDiCredito: false, senzaChiusura: manca });
        aperte.push(s);
        // L'avanzo disponibile copre subito la spesa appena aperta
        if (avanzo > 0) {
          var usato = Math.min(avanzo, s.residuo);
          avanzo -= usato;
          s.residuo -= usato;
          toccate.push(s);
          if (s.residuo === 0) {
            aperte.pop();
            s.chiusaIl = giorno;
            s.daAvanzo = true;
            numeroCoperte++;
          }
        }
      } else {
        // Nota di credito: righe negative, coprono le spese aperte più vecchie e poi restano come avanzo
        numeroRiga++;
        righe.push({ tipo: 'spesa', numero: numeroRiga, data: giorno, fornitore: v.fornitore, importo: daCentesimi_(v.centesimi),
          origine: v.origine, notaDiCredito: true, senzaChiusura: manca });
        avanzo += applica(-v.centesimi, giorno, true, toccate);
      }
      righeNastrini(toccate);
    });

    // 2. Poi i ricavi del giorno
    var ricavi = ricaviDelGiorno[giorno] || 0;
    if (ricavi > 0) {
      var toccateRicavi = [];
      var restante = applica(ricavi, giorno, false, toccateRicavi);
      avanzo += restante;
      ricaviTotali += ricavi;
      m.ricaviC += ricavi;
      righe.push({ tipo: 'ricavi', data: giorno, importo: daCentesimi_(ricavi),
        suSpese: daCentesimi_(ricavi - restante), inAvanzo: daCentesimi_(restante) });
      righeNastrini(toccateRicavi);
    }

    // 3. Giorni senza chiusura cassa (solo fino a oggi): le spese di quel giorno portano il segnale "senzaChiusura"
    if (manca) giorniSenzaChiusura.push(giorno);

    // Posizione a fine giorno (serve per il riepilogo per mese)
    m.scopertoC = aperte.reduce(function (t, x) { return t + x.residuo; }, 0);
    m.avanzoC = avanzo;
  }

  var scoperto = aperte.reduce(function (t, x) { return t + x.residuo; }, 0);
  var giorniPeriodo = giorniTra_(da, a) + 1;

  return {
    ok: true,
    da: da,
    a: a,
    filtro: filtro,
    righe: righe,
    totali: {
      spese: daCentesimi_(speseTotali),
      ricavi: daCentesimi_(ricaviTotali),
      scoperto: daCentesimi_(scoperto),
      avanzoFinale: daCentesimi_(avanzo),
      // Guadagno = avanzo finale; se resta qualcosa da coprire è il numero negativo (ricavi − spese)
      guadagno: daCentesimi_(avanzo - scoperto),
      numeroSpese: numeroSpese,
      speseCoperte: numeroCoperte,
      giornoMedioCopertura: numeroCoperte ? Math.round(sommaGiorniCopertura / numeroCoperte * 10) / 10 : null,
      giorniPeriodo: giorniPeriodo,
      giorniSenzaChiusura: giorniSenzaChiusura.length,
      speseAImportoZero: ignorateZero
    },
    giorniSenzaChiusura: giorniSenzaChiusura.slice(0, 40),
    // Niente righe per i mesi futuri senza movimenti
    mesi: ordineMesi.filter(function (k) {
      return k + '-01' <= oggi || perMese[k].speseC !== 0 || perMese[k].ricaviC !== 0;
    }).map(function (k) {
      var x = perMese[k];
      return { chiave: k, spese: daCentesimi_(x.speseC), ricavi: daCentesimi_(x.ricaviC),
        scoperto: daCentesimi_(x.scopertoC), avanzo: daCentesimi_(x.avanzoC) };
    })
  };
}

/**
 * Anteprima per il Riepilogo: il mese indicato, con tutte le spese. Se qualcosa va storto
 * restituisce null (il Riepilogo si apre lo stesso).
 */
function riassuntoCopertura_(spese, fatture, chiusure, anno, mese, oggi) {
  try {
    var r = calcolaCopertura_(spese, fatture, chiusure, chiaveMese_(anno, mese) + '-01',
      chiaveMese_(anno, mese) + '-' + due_(new Date(anno, mese, 0).getDate()), 'tutte',
      oggi.anno + '-' + due_(oggi.mese) + '-' + due_(oggi.giorno));
    if (!r.ok) return null;
    var t = r.totali;
    return { numeroSpese: t.numeroSpese, speseCoperte: t.speseCoperte, scoperto: t.scoperto, guadagno: t.guadagno };
  } catch (e) {
    console.warn('Anteprima copertura non calcolata: ' + e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Funzione chiamata dall'app
// ---------------------------------------------------------------------------

/** Una sola chiamata per periodo: legge spese, fatture e chiusure e calcola tutta la copertura. */
function coperturaSpese(pin, da, a, filtro) {
  return esegui_(pin, function () {
    var dal = leggiData_(da);
    var al = leggiData_(a);
    if (!dal || !al) return errore_('Date del periodo non valide.');
    var oggi = annoMeseOggi_();
    var r = calcolaCopertura_(leggiSpese_(), leggiFatture_(), leggiChiusure_(), chiaveGiorno_(dal), chiaveGiorno_(al),
      String(filtro || 'tutte'), oggi.anno + '-' + due_(oggi.mese) + '-' + due_(oggi.giorno));
    return r;
  }, 'coperturaSpese');
}
