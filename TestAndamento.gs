/**
 * Bar - Spese & Cassa: prove dei calcoli per i grafici (andamento e confronti).
 * testAndamento() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testAndamento() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };

  var spese = [
    { data: d('2026-10-02'), importo: 100 },
    { data: d('2026-10-20'), importo: 50 },
    { data: d('2026-09-10'), importo: 80 },
    { data: d('2025-10-05'), importo: 40 },
    { data: d('2025-09-30'), importo: 999 }   // fuori dai 12 mesi
  ];
  var fatture = [{ data: d('2026-10-01'), totale: 300 }, { data: d('2026-09-01'), totale: -20 }];
  var chiusure = [
    { data: d('2026-10-05'), totale: 500 },   // lunedì
    { data: d('2026-10-12'), totale: 300 },   // lunedì
    { data: d('2026-10-10'), totale: 900 },   // sabato
    { data: d('2026-09-12'), totale: 700 },   // sabato
    { data: d('2025-10-11'), totale: 400 },   // sabato, ottobre dell'anno scorso
    { data: d('2025-10-04'), totale: 10000 }  // fuori dai 12 mesi per le medie
  ];

  var a = calcolaAndamento_(spese, fatture, chiusure, 2026, 10, 0);
  verifica('12 mesi', a.mesi.length === 12);
  verifica('primo mese novembre 2025', a.mesi[0].chiave === '2025-11' && a.mesi[0].breve === 'nov');
  verifica('ultimo mese ottobre 2026', a.mesi[11].chiave === '2026-10');
  verifica('spese ottobre (spese + fatture) = 450', a.mesi[11].spese === 450);
  verifica('incassi ottobre = 1700', a.mesi[11].incassi === 1700);
  verifica('spese settembre con nota di credito = 60', a.mesi[10].spese === 60);
  verifica('massimo 12 mesi = 1700', a.massimoMesi === 1700);
  verifica('confronto: questo mese', a.confronto[0].incassi === 1700 && a.confronto[0].spese === 450);
  verifica('confronto: mese prima', a.confronto[1].incassi === 700 && a.confronto[1].spese === 60);
  verifica('confronto: anno scorso', a.confronto[2].incassi === 10400 && a.confronto[2].spese === 40);
  verifica('variazione incassi sul mese prima +143%', a.confronto[1].variazioneIncassi === 143);
  verifica('variazione spese sull\'anno scorso +1025%', a.confronto[2].variazioneSpese === 1025);
  verifica('media lunedì = 400 su 2 giorni', a.settimana[0].media === 400 && a.settimana[0].giorni === 2);
  verifica('media sabato = 800 su 2 giorni (esclusa ottobre 2025)', a.settimana[5].media === 800 && a.settimana[5].giorni === 2);
  verifica('domenica senza dati = 0', a.settimana[6].media === 0 && a.settimana[6].giorni === 0);
  verifica('nome giorno', a.settimana[0].nome === 'lunedì' && a.settimana[0].breve === 'lun');

  // Mese in corso confrontato alla pari: solo fino al giorno 10
  var p = calcolaAndamento_(spese, fatture, chiusure, 2026, 10, 10);
  verifica('fino al 10: incassi ottobre 1400', p.confronto[0].incassi === 1400);
  verifica('fino al 10: spese ottobre 400', p.confronto[0].spese === 400);
  verifica('fino al 10: grafico 12 mesi resta completo', p.mesi[11].incassi === 1700);
  verifica('fino al 10: anno scorso solo il 4 ottobre (10000)', p.confronto[2].incassi === 10000);

  // Gennaio: mese prima e anno scorso nell'anno precedente
  var g = calcolaAndamento_([], [], [], 2027, 1, 0);
  verifica('gennaio: mese prima dicembre 2026', g.confronto[1].nome === 'Dicembre 2026');
  verifica('gennaio: anno scorso gennaio 2026', g.confronto[2].nome === 'Gennaio 2026');
  verifica('senza dati: variazione non calcolabile', g.confronto[1].variazioneIncassi === null);
  verifica('testoVariazione_', testoVariazione_(12) === '+12%' && testoVariazione_(-5) === '−5%' &&
    testoVariazione_(null) === '–' && testoVariazione_(0) === 'uguale');
  verifica('spostaMese_ indietro di 13', JSON.stringify(spostaMese_(2026, 1, -13)) === '{"anno":2024,"mese":12}');

  var messaggio = falliti.length ?
    '✗ Prova grafici: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova grafici superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
