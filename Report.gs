/**
 * Bar - Spese & Cassa: report mensile via email e attivatori automatici.
 *
 * - installaTrigger(): attiva (una sola volta) il report del giorno 1 alle 8
 *   e l'importazione giornaliera delle fatture.
 * - inviaReportMensile(): eseguita dal trigger, report del mese PRECEDENTE.
 * - inviaReportDiProva(): report del mese corrente, solo alla titolare.
 */

// ---------------------------------------------------------------------------
// Attivatori (trigger)
// ---------------------------------------------------------------------------

function installaTrigger() {
  var esistenti = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  var messaggi = [];

  if (esistenti.indexOf('inviaReportMensile') < 0) {
    ScriptApp.newTrigger('inviaReportMensile')
      .timeBased()
      .onMonthDay(1)
      .atHour(8)
      .inTimezone(FUSO)
      .create();
    messaggi.push('✓ Report mensile attivato: il giorno 1 di ogni mese tra le 8 e le 9.');
  } else {
    messaggi.push('• Il report mensile era già attivo.');
  }

  if (esistenti.indexOf('promemoriaScadenze') < 0) {
    ScriptApp.newTrigger('promemoriaScadenze')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .inTimezone(FUSO)
      .create();
    messaggi.push('✓ Promemoria scadenze attivato: ogni giorno tra le 7 e le 8.');
  } else {
    messaggi.push('• Il promemoria delle scadenze era già attivo.');
  }

  if (esistenti.indexOf('backupSettimanale') < 0) {
    ScriptApp.newTrigger('backupSettimanale')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(3)
      .inTimezone(FUSO)
      .create();
    messaggi.push('✓ Backup settimanale attivato: ogni domenica tra le 3 e le 4 (cartella "' + NOME_CARTELLA_BACKUP + '").');
  } else {
    messaggi.push('• Il backup settimanale era già attivo.');
  }

  if (esistenti.indexOf('controlloErrori') < 0) {
    ScriptApp.newTrigger('controlloErrori')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .inTimezone(FUSO)
      .create();
    messaggi.push('✓ Controllo errori attivato: ogni giorno tra le 8 e le 9 (email a "' + IMP_EMAIL_ASSISTENZA + '").');
  } else {
    messaggi.push('• Il controllo degli errori era già attivo.');
  }

  if (esistenti.indexOf('promemoriaHaccp') < 0) {
    ScriptApp.newTrigger('promemoriaHaccp')
      .timeBased()
      .everyHours(1)
      .create();
    messaggi.push('✓ Promemoria HACCP attivato: controllo ogni ora, email se dopo l\'ora limite mancano controlli di oggi.');
  } else {
    messaggi.push('• Il promemoria HACCP era già attivo.');
  }

  if (esistenti.indexOf('importaFattureAutomatica') < 0) {
    ScriptApp.newTrigger('importaFattureAutomatica')
      .timeBased()
      .everyDays(1)
      .atHour(6)
      .inTimezone(FUSO)
      .create();
    messaggi.push('✓ Importazione fatture attivata: ogni giorno tra le 6 e le 7.');
  } else {
    messaggi.push('• L\'importazione automatica delle fatture era già attiva.');
  }

  avvisa_(messaggi.join('\n'));
}

/** Eseguita ogni giorno dal trigger: importa senza mostrare finestre. */
function importaFattureAutomatica() {
  eseguiAttivatore_('importaFattureAutomatica', function () {
    var esito = importaFattureSilenzioso_();
    Logger.log(testoEsitoImportazione_(esito));
    // Le fatture nuove possono far superare un budget: avviso (una volta per categoria e mese).
    try {
      controllaBudgetRecenti_();
    } catch (e) {
      registraErrore_('importaFattureAutomatica (budget)', e);
    }
  });
}

// ---------------------------------------------------------------------------
// Invio del report
// ---------------------------------------------------------------------------

function inviaReportMensile() {
  eseguiAttivatore_('inviaReportMensile', function () {
    // Prima importa eventuali fatture caricate all'ultimo momento.
    try {
      importaFattureSilenzioso_();
    } catch (e) {
      registraErrore_('inviaReportMensile (importazione fatture)', e);
    }
    var oggi = annoMeseOggi_();
    var anno = oggi.anno;
    var mese = oggi.mese - 1;
    if (mese === 0) {
      mese = 12;
      anno--;
    }
    inviaReport_(anno, mese, false);
    // Archivio mensile del registro HACCP in PDF (cartella "Bar - HACCP"), solo se il registro è in uso.
    // Se non riesce, il report è già partito.
    try {
      if (haccpInUso_()) creaPdfHaccp_(anno, mese);
    } catch (e) {
      registraErrore_('inviaReportMensile (PDF HACCP)', e);
    }
  });
}

function inviaReportDiProva() {
  var oggi = annoMeseOggi_();
  var destinatario = inviaReport_(oggi.anno, oggi.mese, true);
  avvisa_('Report di prova inviato a ' + destinatario + ' ✓\n' +
    '(La prova va solo alla titolare, non al commercialista.)');
}

function inviaReport_(anno, mese, prova) {
  var titolare = leggiImpostazione_(IMP_EMAIL_TITOLARE) || Session.getEffectiveUser().getEmail();
  var commercialista = leggiImpostazione_(IMP_EMAIL_COMMERCIALISTA);
  if (!titolare) throw new Error('Manca l\'email della titolare nella scheda Impostazioni.');

  var oggi = annoMeseOggi_();
  var finoAlGiorno = (prova && anno === oggi.anno && mese === oggi.mese) ? oggi.giorno : 0;
  var dati = calcolaReport_(anno, mese, finoAlGiorno);

  var notaCondivisione = '';
  var cartellaFoto = cartellaMese_(chiaveMese_(anno, mese), false);
  if (cartellaFoto && commercialista && !prova) {
    notaCondivisione = condividiConCommercialista_(cartellaFoto, commercialista);
  }
  dati.linkFoto = cartellaFoto ? cartellaFoto.getUrl() : '';
  dati.notaCondivisione = notaCondivisione;

  var nomeMese = MESI[mese - 1] + ' ' + anno;
  var oggetto = (prova ? '[PROVA] ' : '') + 'Bar – Report spese e incassi di ' + nomeMese;
  var destinatari = prova ? titolare : [titolare, commercialista].filter(function (x) { return x; }).join(',');

  MailApp.sendEmail({
    to: destinatari,
    subject: oggetto,
    htmlBody: htmlReport_(dati, nomeMese, prova),
    body: testoReport_(dati, nomeMese),
    attachments: [creaExcel_(dati, anno, mese)],
    name: NOME_APP
  });
  return destinatari;
}

/** Condivide in sola lettura la cartella foto del mese con il commercialista. */
function condividiConCommercialista_(cartella, email) {
  try {
    cartella.addViewer(email);
    return '';
  } catch (e) {
    console.warn('Condivisione non riuscita con ' + email + ': ' + e);
  }
  if (/^SI$/i.test(leggiImpostazione_(IMP_LINK_PUBBLICO))) {
    cartella.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'La cartella è visibile a chiunque abbia il link (impostazione "SI").';
  }
  return 'Non è stato possibile condividere la cartella con ' + email +
    ' (probabilmente non è un account Google). Se il link non si apre, la titolare può ' +
    'mettere SI nella voce "' + IMP_LINK_PUBBLICO + '" della scheda Impostazioni.';
}

// ---------------------------------------------------------------------------
// Calcoli
// ---------------------------------------------------------------------------

function calcolaReport_(anno, mese, finoAlGiorno) {
  var spese = delMese_(leggiSpese_(), anno, mese);
  var fatture = delMese_(leggiFatture_(), anno, mese);
  var chiusure = delMese_(leggiChiusure_(), anno, mese);
  var ordina = function (a, b) { return a.data - b.data; };
  spese.sort(ordina);
  fatture.sort(ordina);
  chiusure.sort(ordina);

  var totaleSpese = somma_(spese, 'importo');
  var totaleFatture = somma_(fatture, 'totale');
  var totaleComplessivo = arrotonda_(totaleSpese + totaleFatture);
  var contanti = somma_(chiusure, 'contanti');
  var pos = somma_(chiusure, 'pos');
  var tutte = spese.concat(comeSpese_(fatture));

  // Giorni senza chiusura cassa
  var conChiusura = {};
  chiusure.forEach(function (c) { conChiusura[chiaveGiorno_(c.data)] = true; });
  var ultimoGiorno = finoAlGiorno || new Date(anno, mese, 0).getDate();
  var giorniSenza = [];
  for (var g = 1; g <= ultimoGiorno; g++) {
    var giorno = leggiData_(anno + '-' + due_(mese) + '-' + due_(g));
    if (!conChiusura[chiaveGiorno_(giorno)]) {
      giorniSenza.push(GIORNI_SETTIMANA[Number(Utilities.formatDate(giorno, FUSO, 'u'))] + ' ' + dataIt_(giorno));
    }
  }

  var fileInErrore = [];
  try {
    var elenco = cartelleFatture_().errori.getFiles();
    while (elenco.hasNext()) fileInErrore.push(elenco.next().getName());
  } catch (e) {
    console.warn('Cartella errori fatture non leggibile: ' + e);
  }

  return {
    spese: spese,
    fatture: fatture,
    chiusure: chiusure,
    totaleSpese: totaleSpese,
    totaleFatture: totaleFatture,
    totaleComplessivo: totaleComplessivo,
    speseCategoria: raggruppa_(spese, 'categoria'),
    spesePagamento: raggruppa_(spese, 'pagamento'),
    fattureCategoria: raggruppa_(comeSpese_(fatture), 'categoria'),
    categorieTotali: raggruppa_(tutte, 'categoria'),
    topFornitori: topFornitori_(tutte, 5),
    contanti: contanti,
    pos: pos,
    incassi: arrotonda_(contanti + pos),
    differenza: arrotonda_(contanti + pos - totaleComplessivo),
    giorniSenzaChiusura: giorniSenza,
    finoAlGiorno: finoAlGiorno,
    fattureDaCategorizzare: fatture.filter(function (f) { return f.categoria === DA_CATEGORIZZARE; }),
    fileInErrore: fileInErrore,
    perPersona: riepilogoPersone_(spese, chiusure),
    quadratura: riepilogoQuadratura_(chiusure, tolleranzaCassa_()),
    budget: budgetDelMese_(anno, mese),
    saldoFornitori: saldoFornitoriDelMese_(anno, mese),
    movimenti: totaliMovimenti_(delMese_(leggiMovimenti_(), anno, mese)),
    contanteTeorico: contanteTeoricoAl_(finoAlGiorno ? new Date() : leggiData_(anno + '-' + due_(mese) + '-' + due_(new Date(anno, mese, 0).getDate()))),
    andamento: calcolaAndamento_(leggiSpese_(), leggiFatture_(), leggiChiusure_(), anno, mese, finoAlGiorno)
  };
}

/** Quante spese (e per quanto) e quante chiusure ha inserito ogni persona. */
function riepilogoPersone_(spese, chiusure) {
  var persone = {};
  var ordine = [];
  var voce = function (nome) {
    var n = nome || 'Non indicato';
    if (!persone[n]) {
      persone[n] = { nome: n, spese: 0, totaleSpese: 0, chiusure: 0 };
      ordine.push(n);
    }
    return persone[n];
  };
  spese.forEach(function (sp) {
    var p = voce(sp.inseritoDa);
    p.spese++;
    p.totaleSpese = arrotonda_(p.totaleSpese + sp.importo);
  });
  chiusure.forEach(function (c) { voce(c.inseritoDa).chiusure++; });
  // Se nessuno ha indicato il nome non serve mostrare la tabella.
  if (ordine.length === 1 && ordine[0] === 'Non indicato') return [];
  return ordine.sort(confrontaTesti_).map(function (n) { return persone[n]; });
}

/** Primi n fornitori per importo, unendo spese senza fattura e fatture. */
function topFornitori_(elenco, n) {
  var totali = {};
  var nomi = {};
  elenco.forEach(function (x) {
    var nome = String(x.fornitore || '').replace(/^'/, '').trim() || 'Non indicato';
    var chiave = nome.toLowerCase();
    if (!nomi[chiave]) nomi[chiave] = nome;
    totali[chiave] = (totali[chiave] || 0) + x.importo;
  });
  return Object.keys(totali)
    .map(function (k) { return { nome: nomi[k], totale: arrotonda_(totali[k]) }; })
    .sort(function (a, b) { return b.totale - a.totale; })
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Testo dell'email
// ---------------------------------------------------------------------------

function esc_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/^'/, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tabellaHtml_(titolo, righe, vuoto) {
  var stileTd = 'padding:6px 10px;border-bottom:1px solid #ddd;';
  var h = '<h3 style="margin:22px 0 8px 0;font-size:17px;">' + titolo + '</h3>';
  if (!righe.length) return h + '<p style="color:#555;">' + (vuoto || 'Nessun dato.') + '</p>';
  h += '<table style="border-collapse:collapse;min-width:320px;font-size:15px;">';
  righe.forEach(function (r) {
    h += '<tr><td style="' + stileTd + '">' + r[0] + '</td><td style="' + stileTd +
      'text-align:right;font-weight:bold;white-space:nowrap;">' + r[1] + '</td></tr>';
  });
  return h + '</table>';
}

function righeGruppi_(gruppi) {
  return gruppi.map(function (g) { return [esc_(g.nome), formatoEuro_(g.totale)]; });
}

function htmlReport_(d, nomeMese, prova) {
  var colore = d.differenza < 0 ? '#b3261e' : '#0f6b2f';
  var h = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:680px;">';
  if (prova) {
    h += '<p style="background:#fff4e5;border:1px solid #9a4a00;padding:8px;">Questa è una <b>prova</b> sul mese in corso' +
      (d.finoAlGiorno ? ' (dati fino a oggi)' : '') + '.</p>';
  }
  h += '<h2 style="margin:0 0 6px 0;">Report di ' + esc_(nomeMese) + '</h2>';
  h += '<p style="margin:0 0 10px 0;color:#555;">Bar – riepilogo automatico di spese e incassi.</p>';

  h += tabellaHtml_('Riepilogo', [
    ['Spese senza fattura (' + d.spese.length + ')', formatoEuro_(d.totaleSpese)],
    ['Fatture fornitori (' + d.fatture.length + ')', formatoEuro_(d.totaleFatture)],
    ['<b>Totale spese</b>', formatoEuro_(d.totaleComplessivo)],
    ['Incassi in contanti', formatoEuro_(d.contanti)],
    ['Incassi POS / carte', formatoEuro_(d.pos)],
    ['<b>Totale incassi</b>', formatoEuro_(d.incassi)],
    ['<b>Differenza incassi − spese totali</b>', '<span style="color:' + colore + ';">' + formatoEuro_(d.differenza) + '</span>']
  ]);

  // Avvisi
  var avvisi = [];
  if (d.fattureDaCategorizzare.length) {
    avvisi.push('<b>' + d.fattureDaCategorizzare.length + ' fatture da categorizzare</b>: ' +
      d.fattureDaCategorizzare.map(function (f) {
        return esc_(f.fornitore) + ' n. ' + esc_(f.numero) + ' (' + formatoEuro_(f.totale) + ')';
      }).join('; ') + '. Si possono sistemare dal Riepilogo dell\'app o nella scheda Fatture.');
  }
  if (d.fileInErrore.length) {
    avvisi.push('<b>' + d.fileInErrore.length + ' file di fatture non letti</b> (cartella "' + NOME_CARTELLA_FATTURE + '/' +
      CARTELLA_ERRORI + '"): ' + d.fileInErrore.map(esc_).join(', ') + '.');
  }
  if (avvisi.length) {
    h += '<div style="background:#fff4e5;border:1px solid #9a4a00;padding:8px 12px;margin-top:16px;">' +
      '<p style="margin:4px 0;"><b>⚠ Da controllare</b></p><p style="margin:4px 0;">' + avvisi.join('</p><p style="margin:4px 0;">') + '</p></div>';
  }

  h += htmlBudget_(d.budget);

  h += htmlAndamento_(d.andamento);

  h += '<h2 style="margin:28px 0 0 0;font-size:19px;">Spese senza fattura</h2>';
  h += tabellaHtml_('Per categoria', righeGruppi_(d.speseCategoria), 'Nessuna spesa senza fattura.');
  h += tabellaHtml_('Per metodo di pagamento', righeGruppi_(d.spesePagamento), 'Nessuna spesa senza fattura.');

  h += '<h2 style="margin:28px 0 0 0;font-size:19px;">Fatture fornitori</h2>';
  h += tabellaHtml_('Per categoria', righeGruppi_(d.fattureCategoria), 'Nessuna fattura importata per questo mese.');
  h += tabellaHtml_('Elenco fatture', d.fatture.map(function (f) {
    return [dataIt_(f.data) + ' – ' + esc_(f.fornitore) + ' n. ' + esc_(f.numero) +
      (f.tipo.indexOf('TD04') === 0 ? ' <i>(nota di credito)</i>' : '') +
      (f.scadenza ? '<br><span style="color:#555;font-size:13px;">scadenza ' + dataIt_(f.scadenza) + '</span>' : ''),
      formatoEuro_(f.totale)];
  }), 'Nessuna fattura.');

  h += '<h2 style="margin:28px 0 0 0;font-size:19px;">Totali (spese senza fattura + fatture)</h2>';
  h += tabellaHtml_('Totale per categoria', righeGruppi_(d.categorieTotali), 'Nessuna spesa.');
  h += tabellaHtml_('I 5 fornitori principali', righeGruppi_(d.topFornitori), 'Nessun fornitore.');

  h += htmlMovimenti_(d.movimenti, d.contanteTeorico);

  h += htmlSaldoFornitori_(d.saldoFornitori, nomeMese);

  if (d.perPersona.length) {
    h += tabellaHtml_('Chi ha inserito', d.perPersona.map(function (p) {
      return [esc_(p.nome) + ' <span style="color:#555;font-size:13px;">(' + p.spese + (p.spese === 1 ? ' spesa' : ' spese') +
        ', ' + p.chiusure + (p.chiusure === 1 ? ' chiusura' : ' chiusure') + ')</span>', formatoEuro_(p.totaleSpese)];
    }));
  }

  h += htmlQuadratura_(d.quadratura, d.giorniSenzaChiusura.length);

  h += '<h3 style="margin:22px 0 8px 0;font-size:17px;">Giorni senza chiusura cassa registrata</h3>';
  h += d.giorniSenzaChiusura.length ?
    '<p>' + d.giorniSenzaChiusura.length + ' giorni: ' + d.giorniSenzaChiusura.join(', ') + '.</p>' :
    '<p>Nessuno: la chiusura cassa è stata registrata tutti i giorni.</p>';

  h += '<h3 style="margin:22px 0 8px 0;font-size:17px;">Foto degli scontrini</h3>';
  h += d.linkFoto ?
    '<p><a href="' + esc_(d.linkFoto) + '">Apri la cartella delle foto del mese</a> (sola lettura).</p>' :
    '<p>Nessuna foto caricata in questo mese.</p>';
  if (d.notaCondivisione) h += '<p style="color:#555;">' + esc_(d.notaCondivisione) + '</p>';

  h += '<p style="color:#555;margin-top:24px;">In allegato il file Excel con tutte le spese, le fatture e le chiusure di cassa del mese.</p>';
  return h + '</div>';
}

/** Sezione "Quadratura cassa" del report: confronto con il registratore telematico. */
function htmlQuadratura_(q, giorniSenza) {
  var colore = function (n) { return Math.abs(n) < 0.005 ? '#111' : n > 0 ? '#9a4a00' : '#b3261e'; };
  var h = tabellaHtml_('Quadratura cassa (registratore telematico)', [
    ['Giorni con il totale del registratore', String(q.confrontate)],
    ['Giorni con differenza', String(q.conDifferenza) +
      (q.oltreTolleranza ? ' <span style="color:#b3261e;">(' + q.oltreTolleranza + ' oltre la tolleranza)</span>' : '')],
    ['Totale delle differenze', '<span style="color:' + colore(q.totaleDifferenze) + ';">' + differenzaConSegno_(q.totaleDifferenze) + '</span>'],
    ['Giorni senza chiusura cassa', String(giorniSenza)]
  ]);
  h += '<p style="color:#555;font-size:13px;margin:6px 0;">Differenza = contanti + POS − totale del registratore. ' +
    'Tolleranza: ' + formatoEuro_(q.tolleranza) + ' (scheda Impostazioni). Positiva = in cassa c\'è più del battuto; negativa = ammanco.</p>';
  if (q.giorni.length) {
    h += tabellaHtml_('Giorni con differenza', q.giorni.map(function (g) {
      return [esc_(g.data) + (g.oltre ? ' <b style="color:#b3261e;">oltre la tolleranza</b>' : '') +
        (g.note ? '<br><span style="color:#555;font-size:13px;">' + esc_(g.note) + '</span>' : ''),
        '<span style="color:' + colore(g.differenza) + ';">' + differenzaConSegno_(g.differenza) + '</span>'];
    }));
  }
  return h;
}

function testoReport_(d, nomeMese) {
  var r = [];
  r.push('Report di ' + nomeMese);
  r.push('');
  r.push('Spese senza fattura: ' + formatoEuro_(d.totaleSpese));
  r.push('Fatture fornitori: ' + formatoEuro_(d.totaleFatture));
  r.push('Totale spese: ' + formatoEuro_(d.totaleComplessivo));
  r.push('Incassi contanti: ' + formatoEuro_(d.contanti));
  r.push('Incassi POS/carte: ' + formatoEuro_(d.pos));
  r.push('Totale incassi: ' + formatoEuro_(d.incassi));
  r.push('Differenza incassi - spese totali: ' + formatoEuro_(d.differenza));
  r.push('');
  r.push('Confronti:');
  d.andamento.confronto.forEach(function (c, i) {
    r.push('  ' + c.etichetta + ' (' + c.nome + '): incassi ' + formatoEuro_(c.incassi) + ', spese ' + formatoEuro_(c.spese) +
      (i ? ' – questo mese: incassi ' + testoVariazione_(c.variazioneIncassi) + ', spese ' + testoVariazione_(c.variazioneSpese) : ''));
  });
  r.push('');
  r.push('Totale per categoria:');
  d.categorieTotali.forEach(function (g) { r.push('  ' + g.nome + ': ' + formatoEuro_(g.totale)); });
  r.push('');
  if (d.budget.length) {
    r.push('Budget per categoria:');
    d.budget.forEach(function (v) {
      r.push('  ' + v.categoria + ': ' + formatoEuro_(v.speso) + ' su ' + formatoEuro_(v.tetto) + ' (' + v.percentuale + '%)');
    });
    r.push('');
  }
  r.push('I 5 fornitori principali:');
  d.topFornitori.forEach(function (g) { r.push('  ' + g.nome + ': ' + formatoEuro_(g.totale)); });
  r.push('');
  r.push('Versato in banca: ' + formatoEuro_(d.movimenti.versamenti) + ' – prelevato: ' + formatoEuro_(d.movimenti.prelievi) +
    ' (personali ' + formatoEuro_(d.movimenti.prelieviPersonali) + ', per spese ' + formatoEuro_(d.movimenti.prelieviSpese) + ')' +
    (d.contanteTeorico ? ' – contante teorico in cassa al ' + d.contanteTeorico.al + ': ' + formatoEuro_(d.contanteTeorico.totale) : ''));
  r.push('');
  r.push('Saldo fornitori (da pagare oggi: ' + formatoEuro_(d.saldoFornitori.totali.daPagare) + '):');
  d.saldoFornitori.fornitori.filter(function (g) { return g.totaleMese || g.daPagare; }).forEach(function (g) {
    r.push('  ' + g.nome + ': fatture del mese ' + formatoEuro_(g.totaleMese) + ', da pagare ' + formatoEuro_(g.daPagare));
  });
  r.push('');
  if (d.perPersona.length) {
    r.push('Chi ha inserito:');
    d.perPersona.forEach(function (p) {
      r.push('  ' + p.nome + ': ' + p.spese + ' spese (' + formatoEuro_(p.totaleSpese) + '), ' + p.chiusure + ' chiusure');
    });
    r.push('');
  }
  var q = d.quadratura;
  r.push('Quadratura con il registratore telematico: ' + q.confrontate + ' giorni confrontati, ' + q.conDifferenza +
    ' con differenza (' + q.oltreTolleranza + ' oltre la tolleranza di ' + formatoEuro_(q.tolleranza) + '), totale differenze ' +
    differenzaConSegno_(q.totaleDifferenze) + ', giorni senza chiusura ' + d.giorniSenzaChiusura.length);
  q.giorni.forEach(function (g) {
    r.push('  ' + g.data + ': ' + differenzaConSegno_(g.differenza) + (g.oltre ? ' (oltre la tolleranza)' : '') + (g.note ? ' – ' + g.note : ''));
  });
  r.push('Giorni senza chiusura cassa: ' + (d.giorniSenzaChiusura.length ? d.giorniSenzaChiusura.join(', ') : 'nessuno'));
  if (d.fattureDaCategorizzare.length) r.push('Fatture da categorizzare: ' + d.fattureDaCategorizzare.length);
  if (d.fileInErrore.length) r.push('File di fatture non letti: ' + d.fileInErrore.join(', '));
  if (d.linkFoto) r.push('Foto degli scontrini: ' + d.linkFoto);
  r.push('');
  r.push('In allegato il file Excel del mese.');
  return r.join('\n');
}

// ---------------------------------------------------------------------------
// Allegato Excel
// ---------------------------------------------------------------------------

/** Crea un foglio temporaneo, lo esporta in .xlsx e lo cestina. */
function creaExcel_(d, anno, mese) {
  var chiave = chiaveMese_(anno, mese);
  var temporaneo = SpreadsheetApp.create('Bar - report ' + chiave + ' (temporaneo)');
  var idTemporaneo = temporaneo.getId();
  try {
    temporaneo.setSpreadsheetTimeZone(FUSO);
    try { temporaneo.setSpreadsheetLocale('it_IT'); } catch (e) { /* non indispensabile */ }

    var riepilogo = temporaneo.getSheets()[0];
    riepilogo.setName('Riepilogo');
    var righe = [
      ['Report di ' + MESI[mese - 1] + ' ' + anno, ''],
      ['', ''],
      ['Spese senza fattura', d.totaleSpese],
      ['Fatture fornitori', d.totaleFatture],
      ['Totale spese', d.totaleComplessivo],
      ['Incassi contanti', d.contanti],
      ['Incassi POS / carte', d.pos],
      ['Totale incassi', d.incassi],
      ['Differenza incassi - spese totali', d.differenza],
      ['', ''],
      ['Totale per categoria', '']
    ];
    d.categorieTotali.forEach(function (g) { righe.push([testoSicuro_(g.nome), g.totale]); });
    if (d.budget.length) {
      righe.push(['', '']);
      righe.push(['Budget per categoria (speso / tetto)', '']);
      d.budget.forEach(function (v) { righe.push([testoSicuro_(v.categoria) + ' – tetto ' + formatoEuro_(v.tetto) + ' (' + v.percentuale + '%)', v.speso]); });
    }
    righe.push(['', '']);
    righe.push(['I 5 fornitori principali', '']);
    d.topFornitori.forEach(function (g) { righe.push([testoSicuro_(g.nome), g.totale]); });
    riepilogo.getRange(1, 1, righe.length, 2).setValues(righe);
    riepilogo.getRange(1, 2, righe.length, 1).setNumberFormat(FORMATO_EURO);
    riepilogo.getRange('A1').setFontWeight('bold').setFontSize(14);
    riepilogo.setColumnWidth(1, 300);
    riepilogo.setColumnWidth(2, 140);

    scriviSchedaExcel_(temporaneo, 'Spese senza fattura',
      ['Data', 'Importo', 'Fornitore', 'Categoria', 'Pagamento', 'Nota', 'Link foto', 'Inserito da'],
      d.spese.map(function (s) {
        return [s.data, s.importo, testoSicuro_(s.fornitore.replace(/^'/, '')), testoSicuro_(s.categoria),
          s.pagamento, testoSicuro_(s.nota.replace(/^'/, '')), s.foto, testoSicuro_(s.inseritoDa)];
      }),
      { A: FORMATO_DATA, B: FORMATO_EURO });

    scriviSchedaExcel_(temporaneo, 'Fatture', INTESTAZIONI_FATTURE.slice(0, 11),
      d.fatture.map(function (f) {
        return [f.data, testoSicuro_(f.numero), testoSicuro_(f.fornitore), testoSicuro_(f.piva), f.tipo,
          f.imponibile, f.iva, f.totale, f.scadenza || '', testoSicuro_(f.categoria), testoSicuro_(f.nomeFile)];
      }),
      { A: FORMATO_DATA, B: '@', D: '@', F: FORMATO_EURO, G: FORMATO_EURO, H: FORMATO_EURO, I: FORMATO_DATA });

    scriviSchedaExcel_(temporaneo, 'Chiusure cassa', ['Data', 'Contanti', 'POS', 'Fondo cassa', 'Totale incasso', 'Note', 'Inserito da',
      'Totale registratore', 'Differenza quadratura'],
      d.chiusure.map(function (c) {
        return [c.data, c.contanti, c.pos, c.fondo, c.totale, testoSicuro_(c.note.replace(/^'/, '')), testoSicuro_(c.inseritoDa),
          c.registratore === null ? '' : c.registratore, c.differenza === null ? '' : c.differenza];
      }),
      { A: FORMATO_DATA, B: FORMATO_EURO, C: FORMATO_EURO, D: FORMATO_EURO, E: FORMATO_EURO, H: FORMATO_EURO, I: FORMATO_EURO });

    scriviSchedaExcel_(temporaneo, 'Movimenti cassa', ['Data', 'Tipo', 'Importo', 'Nota', 'Persona'],
      delMese_(leggiMovimenti_(), anno, mese).sort(function (a, b) { return a.data - b.data; }).map(function (m) {
        return [m.data, m.tipo, m.importo, testoSicuro_(m.nota), testoSicuro_(m.persona)];
      }),
      { A: FORMATO_DATA, C: FORMATO_EURO });

    scriviSchedaExcel_(temporaneo, 'Saldo fornitori', ['Fornitore', 'P.IVA', 'Fatture del mese', 'Fatture dell\'anno',
      'Già pagato (anno)', 'Da pagare (oggi)', 'Prossima scadenza'],
      d.saldoFornitori.fornitori.map(function (g) {
        return [testoSicuro_(g.nome), testoSicuro_(g.piva), g.totaleMese, g.totaleAnno, g.pagatoAnno, g.daPagare, g.prossima || ''];
      }),
      { B: '@', C: FORMATO_EURO, D: FORMATO_EURO, E: FORMATO_EURO, F: FORMATO_EURO, G: FORMATO_DATA });

    scriviSchedaExcel_(temporaneo, 'Andamento 12 mesi', ['Mese', 'Incassi', 'Spese (senza fattura + fatture)', 'Differenza'],
      d.andamento.mesi.map(function (m) { return [m.nome, m.incassi, m.spese, arrotonda_(m.incassi - m.spese)]; }),
      { B: FORMATO_EURO, C: FORMATO_EURO, D: FORMATO_EURO });

    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + idTemporaneo + '/export?format=xlsx';
    var risposta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (risposta.getResponseCode() !== 200) {
      throw new Error('Impossibile creare il file Excel (codice ' + risposta.getResponseCode() + ').');
    }
    return risposta.getBlob().setName('Bar_report_' + chiave + '.xlsx');
  } finally {
    DriveApp.getFileById(idTemporaneo).setTrashed(true);
  }
}

function scriviSchedaExcel_(ss, nome, intestazioni, righe, formati) {
  var scheda = ss.insertSheet(nome);
  scheda.getRange(1, 1, 1, intestazioni.length).setValues([intestazioni]).setFontWeight('bold').setBackground('#e8eaed');
  scheda.setFrozenRows(1);
  var numeroRighe = Math.max(righe.length, 1);
  Object.keys(formati).forEach(function (colonna) {
    scheda.getRange(colonna + '2:' + colonna + (numeroRighe + 1)).setNumberFormat(formati[colonna]);
  });
  if (righe.length) {
    scheda.getRange(2, 1, righe.length, intestazioni.length).setValues(righe);
  }
  scheda.autoResizeColumns(1, intestazioni.length);
}
