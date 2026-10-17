/**
 * Bar - Spese & Cassa: prove del calcolo «Spese coperte dai ricavi».
 * testCopertura() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testCopertura() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };
  var sp = function (data, importo, fornitore) { return { data: d(data), importo: importo, fornitore: fornitore || 'Fornitore' }; };
  var ft = function (data, totale, fornitore) { return { data: d(data), totale: totale, fornitore: fornitore || 'Fornitore' }; };
  var ch = function (data, totale) { return { data: d(data), totale: totale }; };
  var tipi = function (r) { return r.righe.map(function (x) { return x.tipo; }).join(','); };
  var calcola = function (spese, fatture, chiusure, da, a, filtro, oggi) {
    return calcolaCopertura_(spese, fatture, chiusure, da, a, filtro || 'tutte', oggi || a);
  };

  // --- Esempio: spesa 400, ricavi 329 il primo giorno e 400 il secondo ---
  var r = calcola([sp('2026-10-01', 400, 'Panificio')], [], [ch('2026-10-01', 329), ch('2026-10-02', 400)], '2026-10-01', '2026-10-05');
  verifica('esempio: ok', r.ok === true);
  verifica('esempio: ordine delle righe (la spesa si apre prima dei ricavi dello stesso giorno)',
    tipi(r) === 'spesa,ricavi,nastrino,ricavi,nastrino');
  verifica('esempio: spesa 400 del Panificio', r.righe[0].importo === 400 && r.righe[0].fornitore === 'Panificio' && r.righe[0].data === '2026-10-01');
  verifica('esempio: ricavi del primo giorno 329', r.righe[1].importo === 329 && r.righe[1].suSpese === 329 && r.righe[1].inAvanzo === 0);
  verifica('esempio: nastrino −71', r.righe[2].residuo === -71 && r.righe[2].coperta === false && r.righe[2].dataChiusura === null);
  verifica('esempio: ricavi del secondo giorno 400, 71 sulla spesa e 329 in avanzo',
    r.righe[3].importo === 400 && r.righe[3].suSpese === 71 && r.righe[3].inAvanzo === 329);
  verifica('esempio: nastrino coperta il 02/10', r.righe[4].residuo === 0 && r.righe[4].coperta === true && r.righe[4].dataChiusura === '2026-10-02');
  verifica('esempio: totali', r.totali.spese === 400 && r.totali.ricavi === 729 && r.totali.scoperto === 0 &&
    r.totali.avanzoFinale === 329 && r.totali.guadagno === 329);
  verifica('esempio: 1 spesa coperta su 1, giorno medio 1', r.totali.numeroSpese === 1 && r.totali.speseCoperte === 1 && r.totali.giornoMedioCopertura === 1);
  verifica('esempio: 3 giorni senza chiusura (3, 4 e 5 ottobre)', r.totali.giorniSenzaChiusura === 3 && r.totali.giorniPeriodo === 5);

  // --- Un ricavo copre più spese, dalla più vecchia ---
  r = calcola([sp('2026-10-01', 100, 'A'), sp('2026-10-02', 150, 'B'), sp('2026-10-03', 80, 'C')], [], [ch('2026-10-03', 300)],
    '2026-10-01', '2026-10-03');
  verifica('più spese: righe', tipi(r) === 'spesa,spesa,spesa,ricavi,nastrino,nastrino,nastrino');
  verifica('più spese: la A e la B sono coperte, la C resta a −30',
    r.righe[4].fornitore === 'A' && r.righe[4].coperta && r.righe[5].fornitore === 'B' && r.righe[5].coperta &&
    r.righe[6].fornitore === 'C' && r.righe[6].residuo === -30);
  verifica('più spese: date di chiusura e totali', r.righe[4].dataChiusura === '2026-10-03' && r.totali.scoperto === 30 &&
    r.totali.speseCoperte === 2 && r.totali.numeroSpese === 3 && r.totali.guadagno === -30 && r.totali.avanzoFinale === 0);
  verifica('più spese: giorno medio = (2 + 1) / 2', r.totali.giornoMedioCopertura === 1.5);

  // --- L'avanzo copre le spese che si aprono dopo ---
  r = calcola([sp('2026-10-02', 150, 'A'), sp('2026-10-03', 100, 'B')], [], [ch('2026-10-01', 200)], '2026-10-01', '2026-10-03');
  verifica('avanzo: righe', tipi(r) === 'ricavi,spesa,nastrino,spesa,nastrino');
  verifica('avanzo: il primo ricavo va tutto in avanzo', r.righe[0].inAvanzo === 200 && r.righe[0].suSpese === 0);
  verifica('avanzo: la A è coperta subito dall\'avanzo', r.righe[2].coperta && r.righe[2].daAvanzo && r.righe[2].dataChiusura === '2026-10-02');
  verifica('avanzo: la B è coperta a metà, restano −50', r.righe[4].residuo === -50 && !r.righe[4].coperta);
  verifica('avanzo: totali (scoperto, guadagno negativo)', r.totali.scoperto === 50 && r.totali.avanzoFinale === 0 &&
    r.totali.guadagno === -50 && r.totali.speseCoperte === 1 && r.totali.giornoMedioCopertura === 0);

  // --- Periodo senza ricavi ---
  r = calcola([sp('2026-10-01', 40, 'A'), sp('2026-10-02', 60, 'B')], [], [], '2026-10-01', '2026-10-03', 'tutte', '2026-10-31');
  verifica('senza ricavi: nessuna riga di ricavi, due spese segnalate, tre giorni senza chiusura',
    tipi(r) === 'spesa,spesa' && r.righe[0].senzaChiusura && r.righe[1].senzaChiusura && r.totali.giorniSenzaChiusura === 3);
  verifica('senza ricavi: tutto scoperto', r.totali.spese === 100 && r.totali.ricavi === 0 && r.totali.scoperto === 100 &&
    r.totali.guadagno === -100 && r.totali.speseCoperte === 0 && r.totali.giornoMedioCopertura === null);
  verifica('senza ricavi: nessun mese in avanzo', r.mesi.length === 1 && r.mesi[0].scoperto === 100 && r.mesi[0].avanzo === 0);

  // --- Periodo senza spese né chiusure ---
  r = calcola([], [], [], '2026-10-01', '2026-10-02');
  verifica('vuoto: nessuna riga e totali a zero', r.ok && r.righe.length === 0 && r.totali.spese === 0 && r.totali.ricavi === 0 &&
    r.totali.guadagno === 0 && r.totali.numeroSpese === 0);

  // --- Giorni senza chiusura: segnalati solo fino a oggi; la chiusura a zero conta come chiusura ---
  r = calcola([sp('2026-10-02', 10, 'A')], [], [ch('2026-10-01', 0), ch('2026-10-03', 50)], '2026-10-01', '2026-10-06', 'tutte', '2026-10-04');
  verifica('senza chiusura: il 2 e il 4 (il 5 e il 6 sono futuri, l\'1 ha la chiusura a zero)',
    r.totali.giorniSenzaChiusura === 2 && r.giorniSenzaChiusura.join(',') === '2026-10-02,2026-10-04');
  verifica('senza chiusura: la spesa del 2 porta il segnale, il giorno con la chiusura no', tipi(r) === 'spesa,ricavi,nastrino' && r.righe[0].senzaChiusura === true &&
    r.righe[1].tipo === 'ricavi');
  verifica('con chiusura: nessun segnale sulle spese', calcola([sp('2026-10-03', 10, 'A')], [], [ch('2026-10-03', 5)], '2026-10-03', '2026-10-03').righe[0].senzaChiusura === false);
  verifica('senza chiusura: il ricavo del 3 copre la spesa del 2 (1 giorno)', r.righe[2].coperta && r.totali.giornoMedioCopertura === 1 &&
    r.totali.ricavi === 50 && r.totali.avanzoFinale === 40);

  // --- Note di credito (importo negativo) ---
  r = calcola([], [ft('2026-10-01', 500, 'Birrificio'), ft('2026-10-02', -150, 'Birrificio')], [ch('2026-10-01', 100)], '2026-10-01', '2026-10-02');
  verifica('nota di credito: righe', tipi(r) === 'spesa,ricavi,nastrino,spesa,nastrino');
  verifica('nota di credito: riga negativa segnalata', r.righe[3].importo === -150 && r.righe[3].notaDiCredito === true);
  verifica('nota di credito: copre la fattura aperta (da −400 a −250)', r.righe[2].residuo === -400 && r.righe[4].residuo === -250);
  verifica('nota di credito: spese nette 350, scoperto 250', r.totali.spese === 350 && r.totali.scoperto === 250 &&
    r.totali.guadagno === -250 && r.totali.numeroSpese === 1);
  r = calcola([], [ft('2026-10-01', -80, 'Birrificio'), ft('2026-10-02', 120, 'Altro')], [], '2026-10-01', '2026-10-02');
  verifica('nota di credito senza spese aperte: resta come avanzo e copre la fattura dopo', r.totali.spese === 40 && r.totali.scoperto === 40 &&
    r.righe[r.righe.length - 1].tipo !== 'spesa' && r.righe[2].residuo === -40);
  r = calcola([], [ft('2026-10-01', 100, 'A'), ft('2026-10-02', -100, 'A')], [], '2026-10-01', '2026-10-02');
  verifica('nota di credito pari alla fattura: coperta', r.totali.scoperto === 0 && r.totali.speseCoperte === 1 && r.totali.spese === 0);

  // --- Importi in centesimi interi ---
  r = calcola([sp('2026-10-01', 0.1, 'A'), sp('2026-10-01', 0.2, 'B')], [], [ch('2026-10-01', 0.3)], '2026-10-01', '2026-10-01');
  verifica('centesimi: 0,10 + 0,20 coperti da 0,30 senza resti', r.totali.scoperto === 0 && r.totali.speseCoperte === 2 && r.totali.avanzoFinale === 0);
  r = calcola([sp('2026-10-01', 19.99, 'A')], [], [ch('2026-10-01', 10.1), ch('2026-10-02', 9.89)], '2026-10-01', '2026-10-02');
  verifica('centesimi: 19,99 coperti da 10,10 + 9,89', r.totali.scoperto === 0 && r.totali.speseCoperte === 1 && r.righe[2].residuo === -9.89);
  r = calcola([sp('2026-10-01', 33.33, 'A'), sp('2026-10-01', 33.33, 'B'), sp('2026-10-01', 33.34, 'C')], [], [ch('2026-10-01', 100)], '2026-10-01', '2026-10-01');
  verifica('centesimi: 33,33 + 33,33 + 33,34 = 100 esatti', r.totali.spese === 100 && r.totali.scoperto === 0 && r.totali.avanzoFinale === 0);
  r = calcola([sp('2026-10-01', 12.345, 'A')], [], [], '2026-10-01', '2026-10-01');
  verifica('centesimi: importi con più decimali arrotondati al centesimo', r.totali.spese === 12.35 || r.totali.spese === 12.34);

  // --- Spese a importo zero ---
  r = calcola([sp('2026-10-01', 0, 'Omaggio'), sp('2026-10-01', 20, 'A')], [], [ch('2026-10-01', 20)], '2026-10-01', '2026-10-01');
  verifica('importo zero: ignorata (nessuna riga, non conta come spesa)', r.totali.numeroSpese === 1 && r.totali.speseAImportoZero === 1 &&
    r.righe.filter(function (x) { return x.tipo === 'spesa'; }).length === 1);

  // --- Filtro fatture / senza fattura ---
  var spese = [sp('2026-10-01', 100, 'Bar')];
  var fatture = [ft('2026-10-01', 200, 'Ditta')];
  var chiusure = [ch('2026-10-02', 150)];
  verifica('filtro tutte: 300', calcola(spese, fatture, chiusure, '2026-10-01', '2026-10-02', 'tutte').totali.spese === 300);
  r = calcola(spese, fatture, chiusure, '2026-10-01', '2026-10-02', 'senzaFattura');
  verifica('filtro senza fattura: solo 100, coperte dai 150 con avanzo 50', r.totali.spese === 100 && r.totali.scoperto === 0 && r.totali.avanzoFinale === 50);
  r = calcola(spese, fatture, chiusure, '2026-10-01', '2026-10-02', 'fatture');
  verifica('filtro fatture: solo 200, scoperto 50', r.totali.spese === 200 && r.totali.scoperto === 50 && r.righe[0].origine === 'fattura');
  verifica('filtro sconosciuto: come tutte', calcola(spese, fatture, chiusure, '2026-10-01', '2026-10-02', 'boh').filtro === 'tutte');
  r = calcola(spese, fatture, chiusure, '2026-10-01', '2026-10-02', 'tutte');
  verifica('stesso giorno: prima le spese senza fattura, poi le fatture', r.righe[0].origine === 'spesa' && r.righe[1].origine === 'fattura');

  // --- Confini del periodo (estremi compresi) ---
  r = calcola([sp('2026-09-30', 1000, 'Prima'), sp('2026-10-01', 10, 'Inizio'), sp('2026-10-31', 20, 'Fine'), sp('2026-11-01', 3000, 'Dopo')],
    [], [ch('2026-09-30', 500), ch('2026-10-01', 4), ch('2026-10-31', 6), ch('2026-11-01', 700)], '2026-10-01', '2026-10-31');
  verifica('confini: spese del 30/09 e dell\'1/11 escluse, quelle del 1 e del 31 incluse', r.totali.spese === 30 && r.totali.numeroSpese === 2);
  verifica('confini: ricavi del 30/09 e dell\'1/11 esclusi', r.totali.ricavi === 10);
  verifica('confini: i ricavi del periodo non coprono le spese fuori periodo', r.totali.scoperto === 20 && r.totali.avanzoFinale === 0);
  r = calcola([sp('2026-10-15', 5, 'A')], [], [], '2026-10-15', '2026-10-15');
  verifica('un solo giorno: periodo di 1 giorno', r.totali.giorniPeriodo === 1 && r.totali.numeroSpese === 1);

  // --- Periodo non valido ---
  verifica('periodo al contrario', calcola([], [], [], '2026-10-10', '2026-10-01').ok === false);
  verifica('date non valide', calcola([], [], [], 'boh', '2026-10-01').ok === false);
  verifica('periodo troppo lungo', calcola([], [], [], '2010-01-01', '2026-10-01').ok === false);

  // --- Mesi (riepilogo per mese: posizione a fine mese) ---
  r = calcola([sp('2026-09-20', 300, 'A'), sp('2026-10-05', 100, 'B')], [], [ch('2026-09-25', 200), ch('2026-10-10', 500)], '2026-09-01', '2026-10-31');
  verifica('mesi: settembre e ottobre', r.mesi.length === 2 && r.mesi[0].chiave === '2026-09' && r.mesi[1].chiave === '2026-10');
  verifica('mesi: settembre spese 300, ricavi 200, scoperto 100 a fine mese', r.mesi[0].spese === 300 && r.mesi[0].ricavi === 200 &&
    r.mesi[0].scoperto === 100 && r.mesi[0].avanzo === 0);
  verifica('mesi: ottobre spese 100, ricavi 500, avanzo 300 a fine mese', r.mesi[1].spese === 100 && r.mesi[1].ricavi === 500 &&
    r.mesi[1].scoperto === 0 && r.mesi[1].avanzo === 300);
  verifica('mesi: totali coerenti con le righe dei mesi', r.totali.spese === 400 && r.totali.ricavi === 700 && r.totali.guadagno === 300);
  r = calcola([], [], [], '2026-02-10', '2026-04-05');
  verifica('mesi: anche i mesi senza movimenti (febbraio, marzo, aprile)', r.mesi.length === 3 && r.mesi[1].chiave === '2026-03');
  r = calcola([sp('2026-02-10', 5, 'A')], [], [], '2026-02-01', '2026-05-31', 'tutte', '2026-03-15');
  verifica('mesi: aprile e maggio (futuri, senza movimenti) non compaiono', r.mesi.length === 2 && r.mesi[1].chiave === '2026-03');
  r = calcola([sp('2026-05-10', 5, 'A')], [], [], '2026-02-01', '2026-05-31', 'tutte', '2026-03-15');
  verifica('mesi: un mese futuro con una spesa compare', r.mesi.length === 3 && r.mesi[2].chiave === '2026-05' && r.mesi[2].scoperto === 5);
  r = calcola([], [], [], '2026-03-28', '2026-03-31');
  verifica('ora legale: il 29 marzo 2026 non salta né ripete giorni', r.totali.giorniPeriodo === 4 && r.totali.giorniSenzaChiusura === 4);
  r = calcola([], [], [], '2026-10-24', '2026-10-27');
  verifica('ora legale: ottobre 2026 (fine ora legale)', r.totali.giorniPeriodo === 4 && r.totali.giorniSenzaChiusura === 4);

  // --- Stesso giorno: le spese si aprono prima dei ricavi ---
  r = calcola([sp('2026-10-01', 70, 'A'), sp('2026-10-01', 30, 'B')], [], [ch('2026-10-01', 80)], '2026-10-01', '2026-10-01');
  verifica('stesso giorno: A (la prima arrivata) coperta, B coperta per 10 su 30',
    r.righe[3].fornitore === 'A' && r.righe[3].coperta && r.righe[4].fornitore === 'B' && r.righe[4].residuo === -20);

  var messaggio = falliti.length ?
    '✗ Prova copertura spese: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova copertura spese superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
