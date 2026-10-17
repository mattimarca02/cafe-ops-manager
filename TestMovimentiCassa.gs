/**
 * Bar - Spese & Cassa: prove del contante teorico in cassa.
 * testMovimentiCassa() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testMovimentiCassa() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };

  var chiusure = [
    { data: d('2026-09-30'), contanti: 999 },   // prima della partenza: esclusa
    { data: d('2026-10-01'), contanti: 300 },   // il giorno di partenza è compreso
    { data: d('2026-10-02'), contanti: 250.5 },
    { data: d('2026-10-11'), contanti: 400 }    // dopo "finoA": esclusa
  ];
  var spese = [
    { data: d('2026-10-01'), importo: 20, pagamento: 'Contanti' },
    { data: d('2026-10-02'), importo: 35.25, pagamento: 'Contanti' },
    { data: d('2026-10-02'), importo: 100, pagamento: 'Carta/Bancomat' },  // non in contanti: esclusa
    { data: d('2026-10-03'), importo: 80, pagamento: 'Bonifico' }
  ];
  var movimenti = [
    { data: d('2026-10-02'), tipo: TIPO_VERSAMENTO, importo: 300 },
    { data: d('2026-10-03'), tipo: TIPO_PRELIEVO_PERSONALE, importo: 50 },
    { data: d('2026-10-04'), tipo: TIPO_PRELIEVO_SPESE, importo: 40 },
    { data: d('2026-09-15'), tipo: TIPO_VERSAMENTO, importo: 1000 }        // prima della partenza
  ];
  var r = contanteTeorico_(150, d('2026-10-01'), chiusure, spese, movimenti, d('2026-10-10'));
  verifica('incassi in contanti dal giorno di partenza (550,50)', r.incassiContanti === 550.5);
  verifica('solo le spese pagate in contanti (55,25)', r.speseContanti === 55.25);
  verifica('versamenti 300', r.versamenti === 300);
  verifica('prelievi divisi per tipo', r.prelieviPersonali === 50 && r.prelieviSpese === 40 && r.prelievi === 90);
  verifica('totale = 150 + 550,50 − 55,25 − 300 − 90 = 255,25 (' + r.totale + ')', r.totale === 255.25);
  verifica('senza fondo = 0', contanteTeorico_('', d('2026-10-01'), chiusure, spese, movimenti, d('2026-10-10')).totale === 105.25);
  verifica('fino al giorno di partenza compreso', contanteTeorico_(150, d('2026-10-01'), chiusure, spese, movimenti, d('2026-10-01')).totale === 430);
  verifica('può diventare negativo (manca qualcosa da registrare)',
    contanteTeorico_(0, d('2026-10-02'), [], spese, movimenti, d('2026-10-10')).totale < 0);

  var t = totaliMovimenti_([
    { tipo: TIPO_VERSAMENTO, importo: 300.1 }, { tipo: TIPO_VERSAMENTO, importo: 0.2 },
    { tipo: TIPO_PRELIEVO_PERSONALE, importo: 50 }, { tipo: TIPO_PRELIEVO_SPESE, importo: 10 }
  ]);
  verifica('totali del mese (versato 300,30, prelevato 60)', t.versamenti === 300.3 && t.prelievi === 60 && t.numero === 4);

  var messaggio = falliti.length ?
    '✗ Prova contante in cassa: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova contante in cassa superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
