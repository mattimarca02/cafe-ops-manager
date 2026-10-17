/**
 * Bar - Spese & Cassa: prove dei calcoli del registro HACCP.
 * testHaccp() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testHaccp() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };

  // Temperature scritte in tanti modi
  verifica('3,5', leggiTemperatura_('3,5') === 3.5);
  verifica('-18', leggiTemperatura_('-18') === -18);
  verifica('meno tipografico −18,5', leggiTemperatura_('−18,5') === -18.5);
  verifica('con °C e spazi', leggiTemperatura_(' 4 °C ') === 4);
  verifica('numero dalla cella', leggiTemperatura_(2.25) === 2.3);
  verifica('testo non valido', leggiTemperatura_('freddo') === null);
  verifica('vuoto', leggiTemperatura_('') === null);
  verifica('fuori da ogni senso (500)', leggiTemperatura_('500') === null);

  // Limiti: gli estremi sono ammessi
  verifica('frigo 0–4: 4 va bene', !fuoriRangeHaccp_(4, 0, 4));
  verifica('frigo 0–4: 4,1 è fuori', fuoriRangeHaccp_(4.1, 0, 4));
  verifica('frigo 0–4: −0,5 è fuori', fuoriRangeHaccp_(-0.5, 0, 4));
  verifica('congelatore −25/−18: −18 va bene', !fuoriRangeHaccp_(-18, -25, -18));
  verifica('congelatore −25/−18: −15 è fuori', fuoriRangeHaccp_(-15, -25, -18));
  verifica('solo massimo', fuoriRangeHaccp_(9, null, 8) && !fuoriRangeHaccp_(-30, null, 8));
  verifica('senza limiti mai fuori', !fuoriRangeHaccp_(99, null, null));

  // Ore
  verifica('11:30 → 690', minutiDaOra_('11:30') === 690);
  verifica('11 → 660', minutiDaOra_('11') === 660);
  verifica('9.15 → 555', minutiDaOra_('9.15') === 555);
  verifica('25:00 non valida', minutiDaOra_('25:00') === null);
  verifica('testoOra_', testoOra_(545) === '09:05');

  // Settimana da lunedì a domenica (10/10/2026 è sabato)
  verifica('lunedì della settimana', lunediDellaSettimana_(d('2026-10-10')) === '2026-10-05');
  verifica('la domenica appartiene alla settimana prima', lunediDellaSettimana_(d('2026-10-11')) === '2026-10-05');
  verifica('il lunedì è l\'inizio', lunediDellaSettimana_(d('2026-10-12')) === '2026-10-12');

  // Stato dei controlli
  var elenco = [
    { id: 'A', nome: 'Frigo', tipo: 'temperatura', min: 0, max: 4, frequenza: 'giornaliera', attivo: true },
    { id: 'B', nome: 'Bagni', tipo: 'spunta', min: null, max: null, frequenza: 'giornaliera', attivo: true },
    { id: 'C', nome: 'Scadenze merce', tipo: 'spunta', min: null, max: null, frequenza: 'settimanale', attivo: true },
    { id: 'D', nome: 'Spento', tipo: 'spunta', min: null, max: null, frequenza: 'giornaliera', attivo: false }
  ];
  var registro = [
    { data: d('2026-10-10'), ora: '08:10', idControllo: 'A', valore: 6, esito: 'FUORI RANGE', riga: 2 },
    { data: d('2026-10-10'), ora: '09:00', idControllo: 'A', valore: 3, esito: 'OK', riga: 3 },
    { data: d('2026-10-09'), ora: '08:00', idControllo: 'B', valore: 'Fatto', esito: 'Fatto', riga: 4 },
    { data: d('2026-10-06'), ora: '10:00', idControllo: 'C', valore: 'Fatto', esito: 'Fatto', riga: 5 }
  ];
  var stato = statoControlliHaccp_(elenco, registro, d('2026-10-10'));
  verifica('i controlli disattivati non compaiono', stato.length === 3);
  verifica('frigo fatto oggi, vale l\'ultima registrazione', stato[0].fatto && stato[0].ultima.ora === '09:00');
  verifica('bagni fatti ieri ma non oggi', !stato[1].fatto);
  verifica('settimanale fatto martedì vale per tutta la settimana', stato[2].fatto);
  var lunediDopo = statoControlliHaccp_(elenco, registro, d('2026-10-12'));
  verifica('il lunedì dopo il settimanale è di nuovo da fare', !lunediDopo[2].fatto);
  verifica('promemoria: solo i giornalieri non fatti', controlliDaSollecitare_(lunediDopo, d('2026-10-12')).length === 2);
  verifica('la domenica anche i settimanali', controlliDaSollecitare_(statoControlliHaccp_(elenco, [], d('2026-10-11')), d('2026-10-11'))
    .length === 3);

  // Giorni con controlli mancanti (per il PDF)
  var mancanti = giorniConControlliMancanti_(elenco, registro, 2026, 10, d('2026-10-10'));
  verifica('10 giorni con qualcosa che manca (1–10 ottobre)', mancanti.length === 10);
  verifica('il 10/10 manca solo Bagni', mancanti[9].data === '10/10/2026' && mancanti[9].mancanti.join() === 'Bagni');
  verifica('il 09/10 manca solo Frigo', mancanti[8].mancanti.join() === 'Frigo');

  var messaggio = falliti.length ?
    '✗ Prova HACCP: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova HACCP superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
