/**
 * Bar - Spese & Cassa: budget mensile per categoria.
 *
 * Scheda "Budget": per ogni categoria un tetto mensile in euro (vuoto = nessun budget).
 * La spesa del mese conta le spese senza fattura e le fatture fornitori (per data del
 * documento), come i totali del Riepilogo.
 *   - Riepilogo: barra per categoria (verde, ambra sopra l'80%, rossa sopra il 100%).
 *   - Email alla titolare una sola volta per categoria e mese quando si supera l'80% e il 100%
 *     (il mese dell'avviso viene scritto nella scheda Budget).
 *   - Report mensile: sezione "Budget per categoria".
 *
 * statoBudget_() e avvisiBudgetDaInviare_() sono funzioni "pure", provate da testBudget().
 */

var SCHEDA_BUDGET = 'Budget';
var INTESTAZIONI_BUDGET = ['Categoria', 'Tetto mensile (€)', 'Avviso 80% inviato per il mese', 'Avviso 100% inviato per il mese', 'Note'];
var BU_CATEGORIA = 1, BU_TETTO = 2, BU_AVVISO_80 = 3, BU_AVVISO_100 = 4;
var SOGLIA_ATTENZIONE_BUDGET = 0.8;

function preparaSchedaBudget_(ss) {
  var s = preparaScheda_(ss, SCHEDA_BUDGET, INTESTAZIONI_BUDGET);
  s.getRange('B:B').setNumberFormat(FORMATO_EURO);
  s.getRange('C:D').setNumberFormat('@');
  s.setColumnWidth(1, 220);
  s.setColumnWidth(2, 160);
  s.setColumnWidth(3, 220);
  s.setColumnWidth(4, 230);
  s.setColumnWidth(5, 360);
  // Una riga per ogni categoria che manca (le righe già presenti non vengono toccate).
  var presenti = {};
  if (s.getLastRow() >= 2) {
    s.getRange(2, 1, s.getLastRow() - 1, 1).getValues().forEach(function (r) {
      presenti[String(r[0]).replace(/^'/, '').trim().toLowerCase()] = true;
    });
  }
  var nuove = leggiLista_(SCHEDA_CATEGORIE).filter(function (c) { return !presenti[c.toLowerCase()]; });
  if (nuove.length) {
    var primaVolta = s.getLastRow() < 2;
    s.getRange(s.getLastRow() + 1, 1, nuove.length, 5).setValues(nuove.map(function (c, i) {
      return [c, '', '', '', primaVolta && i === 0 ? 'Scrivi il tetto mensile in colonna B (vuoto = nessun budget)' : ''];
    }));
  }
}

// ---------------------------------------------------------------------------
// Calcoli (funzioni "pure")
// ---------------------------------------------------------------------------

/**
 * budget: [{ categoria, tetto }]; totali: { categoria → euro spesi nel mese }.
 * Restituisce solo le categorie con un tetto, dalla più "consumata":
 * [{ categoria, tetto, speso, percentuale, residuo, livello: 'ok' | 'attenzione' | 'superato' }]
 */
function statoBudget_(budget, totali) {
  var perNome = {};
  Object.keys(totali || {}).forEach(function (k) { perNome[k.toLowerCase()] = totali[k]; });
  return budget.filter(function (b) { return b.tetto > 0; }).map(function (b) {
    var speso = arrotonda_(perNome[b.categoria.toLowerCase()] || 0);
    return {
      categoria: b.categoria,
      tetto: b.tetto,
      speso: speso,
      percentuale: Math.round(speso / b.tetto * 100),
      residuo: arrotonda_(b.tetto - speso),
      livello: livelloBudget_(speso, b.tetto)
    };
  }).sort(function (a, b) { return b.speso / b.tetto - a.speso / a.tetto; });
}

/** 'superato' sopra il 100%, 'attenzione' sopra l'80%, altrimenti 'ok'. */
function livelloBudget_(speso, tetto) {
  if (speso > tetto + 0.004) return 'superato';
  if (speso > tetto * SOGLIA_ATTENZIONE_BUDGET + 0.004) return 'attenzione';
  return 'ok';
}

/**
 * Quali avvisi mandare: stato (da statoBudget_) con in più avviso80/avviso100 = mese
 * dell'ultimo avviso già mandato. Un solo avviso per soglia, categoria e mese; se si salta
 * direttamente oltre il 100% parte solo quello del 100%.
 */
function avvisiBudgetDaInviare_(stato, chiaveMese) {
  var avvisi = [];
  stato.forEach(function (v) {
    if (v.livello === 'superato' && v.avviso100 !== chiaveMese) avvisi.push({ voce: v, soglia: 100 });
    else if (v.livello === 'attenzione' && v.avviso80 !== chiaveMese && v.avviso100 !== chiaveMese) avvisi.push({ voce: v, soglia: 80 });
  });
  return avvisi;
}

// ---------------------------------------------------------------------------
// Lettura e controllo
// ---------------------------------------------------------------------------

function leggiBudget_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEDA_BUDGET);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 4).getValues().map(function (r, i) {
    var tetto = r[BU_TETTO - 1] === '' ? null : leggiImporto_(r[BU_TETTO - 1]);
    return {
      riga: i + 2,
      categoria: String(r[BU_CATEGORIA - 1]).replace(/^'/, '').trim(),
      tetto: tetto && tetto > 0 ? tetto : null,
      avviso80: String(r[BU_AVVISO_80 - 1]).trim(),
      avviso100: String(r[BU_AVVISO_100 - 1]).trim()
    };
  }).filter(function (b) { return b.categoria; });
}

/** Totali per categoria del mese: spese senza fattura + fatture (per data del documento). */
function totaliCategoriaMese_(anno, mese, spese, fatture) {
  var totali = {};
  raggruppa_(delMese_(spese || leggiSpese_(), anno, mese).concat(comeSpese_(delMese_(fatture || leggiFatture_(), anno, mese))), 'categoria')
    .forEach(function (g) { totali[g.nome] = g.totale; });
  return totali;
}

/** Stato del budget di un mese (con gli avvisi già mandati) per Riepilogo, report e controllo. */
function budgetDelMese_(anno, mese, spese, fatture) {
  var budget = leggiBudget_();
  if (!budget.some(function (b) { return b.tetto; })) return [];
  var perCategoria = {};
  budget.forEach(function (b) { perCategoria[b.categoria] = b; });
  return statoBudget_(budget, totaliCategoriaMese_(anno, mese, spese, fatture)).map(function (v) {
    var b = perCategoria[v.categoria];
    v.riga = b.riga;
    v.avviso80 = b.avviso80;
    v.avviso100 = b.avviso100;
    return v;
  });
}

/**
 * Manda (una volta sola per categoria, soglia e mese) l'email di avviso e segna il mese
 * nella scheda Budget. Restituisce il numero di avvisi mandati.
 */
function controllaBudget_(anno, mese, senzaAttesa) {
  if (!leggiBudget_().some(function (b) { return b.tetto; })) return 0;
  var lock = LockService.getScriptLock();
  if (senzaAttesa) {
    // Dopo una spesa: se qualcun altro sta salvando non aspetto (il telefono aspetta la risposta);
    // ci pensa il controllo di ogni mattina.
    if (!lock.tryLock(0)) return 0;
  } else {
    lock.waitLock(30000);
  }
  try {
    var chiave = chiaveMese_(anno, mese);
    var avvisi = avvisiBudgetDaInviare_(budgetDelMese_(anno, mese), chiave);
    if (!avvisi.length) return 0;
    var destinatario = leggiImpostazione_(IMP_EMAIL_TITOLARE) || Session.getEffectiveUser().getEmail();
    var nomeMese = MESI[mese - 1] + ' ' + anno;
    var titolo = avvisi.map(function (a) { return a.voce.categoria + (a.soglia === 100 ? ' oltre il 100%' : ' oltre l\'80%'); }).join(', ');
    var righe = avvisi.map(function (a) {
      var v = a.voce;
      return v.categoria + ': spesi ' + formatoEuro_(v.speso) + ' su ' + formatoEuro_(v.tetto) + ' (' + v.percentuale + '%)' +
        (a.soglia === 100 ? ' – budget superato di ' + formatoEuro_(-v.residuo) : ' – restano ' + formatoEuro_(v.residuo));
    });
    MailApp.sendEmail({
      to: destinatario,
      subject: 'Bar – Budget di ' + nomeMese + ': ' + titolo,
      htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:680px;">' +
        '<h2 style="margin:0 0 6px 0;">Avviso budget di ' + esc_(nomeMese) + '</h2><ul>' +
        righe.map(function (t, i) {
          return '<li style="margin:6px 0;color:' + (avvisi[i].soglia === 100 ? '#b3261e' : '#9a4a00') + ';">' + esc_(t) + '</li>';
        }).join('') + '</ul>' +
        '<p style="color:#555;">Sono contate le spese senza fattura e le fatture (per data del documento). ' +
        'I tetti si cambiano nella scheda «Budget» del foglio. Per ogni categoria arriva un solo avviso all\'80% e uno al 100% al mese.</p></div>',
      body: 'Avviso budget di ' + nomeMese + ':\n\n- ' + righe.join('\n- ') + '\n\nI tetti si cambiano nella scheda «Budget» del foglio.',
      name: NOME_APP
    });
    var scheda = scheda_(SCHEDA_BUDGET);
    avvisi.forEach(function (a) {
      scheda.getRange(a.voce.riga, a.soglia === 100 ? BU_AVVISO_100 : BU_AVVISO_80).setValue(chiave);
      if (a.soglia === 100 && a.voce.avviso80 !== chiave) scheda.getRange(a.voce.riga, BU_AVVISO_80).setValue(chiave);
    });
    return avvisi.length;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Dopo una spesa salvata o modificata: controlla il budget del mese della spesa (solo se è
 * questo mese o il precedente). Non blocca mai il salvataggio: gli errori vanno nel Registro.
 */
function controllaBudgetDopoSpesa_(data) {
  try {
    var oggi = annoMeseOggi_();
    var prima = spostaMese_(oggi.anno, oggi.mese, -1);
    var chiave = Utilities.formatDate(data, FUSO, 'yyyy-MM');
    if (chiave === chiaveMese_(oggi.anno, oggi.mese)) controllaBudget_(oggi.anno, oggi.mese, true);
    else if (chiave === chiaveMese_(prima.anno, prima.mese)) controllaBudget_(prima.anno, prima.mese, true);
  } catch (e) {
    registraErrore_('controllo budget', e);
  }
}

/** Ogni giorno (dopo l'importazione delle fatture): mese corrente e mese precedente. */
function controllaBudgetRecenti_() {
  var oggi = annoMeseOggi_();
  var prima = spostaMese_(oggi.anno, oggi.mese, -1);
  return controllaBudget_(prima.anno, prima.mese) + controllaBudget_(oggi.anno, oggi.mese);
}

/** Sezione "Budget per categoria" del report mensile (vuota se non ci sono tetti). */
function htmlBudget_(budget) {
  if (!budget.length) return '';
  var colori = { ok: '#0f6b2f', attenzione: '#9a4a00', superato: '#b3261e' };
  var testi = { ok: 'nel budget', attenzione: 'oltre l\'80%', superato: 'superato' };
  return tabellaHtml_('Budget per categoria', budget.map(function (v) {
    return [esc_(v.categoria) + ' <span style="color:' + colori[v.livello] + ';font-size:13px;">(' + v.percentuale + '%, ' +
      testi[v.livello] + ')</span>' + barraEmail_(Math.min(v.speso, v.tetto), v.tetto, colori[v.livello]),
      formatoEuro_(v.speso) + ' / ' + formatoEuro_(v.tetto)];
  }));
}
