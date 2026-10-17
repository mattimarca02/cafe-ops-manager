/**
 * Bar - Spese & Cassa: prove del calcolo del saldo per fornitore.
 * testSaldoFornitori() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testSaldoFornitori() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };
  var fattura = function (data, numero, fornitore, piva, totale, scadenza) {
    return { data: d(data), numero: numero, fornitore: fornitore, piva: piva, totale: totale, scadenza: scadenza ? d(scadenza) : null };
  };
  var scadenza = function (f, pagata, id) {
    return { id: id, origine: 'F|' + chiaveFattura_(f.piva, f.numero, f.data), data: f.scadenza, pagata: pagata };
  };

  var f1 = fattura('2026-10-02', 'A1', 'Torrefazione Rossi', '01234567897', 305, '2026-11-01');   // ottobre, da pagare
  var f2 = fattura('2026-09-02', 'A0', 'Torrefazione Rossi', '01234567897', 300, '2026-10-02');   // settembre, pagata
  var f3 = fattura('2026-08-02', 'A9', 'TORREFAZIONE ROSSI SRL', '01234567897', 250, '2026-09-01'); // stessa P.IVA, scaduta non pagata
  var f4 = fattura('2026-10-05', 'B1', 'Bevande Bianchi', '09876543210', 219.6, null);            // senza scadenza
  var f5 = fattura('2025-11-20', 'B0', 'Bevande Bianchi', '09876543210', 100, '2025-12-20');      // anno scorso, pagata
  var f6 = fattura('2025-12-15', 'C0', 'Panificio', '', 80, '2026-01-15');                        // anno scorso, ancora da pagare
  var f7 = fattura('2026-10-06', 'NC1', 'Bevande Bianchi', '09876543210', -19.6, null);            // nota di credito
  var scadenze = [scadenza(f1, false, 'D1'), scadenza(f2, true, 'D2'), scadenza(f3, false, 'D3'), scadenza(f5, true, 'D5'),
    scadenza(f6, false, 'D6'), { id: 'X', origine: 'R|affitto|2026-10-05', data: d('2026-10-05'), pagata: false }];
  var r = calcolaSaldoFornitori_([f1, f2, f3, f4, f5, f6, f7], scadenze, 2026, 10, d('2026-10-10'));
  var per = {};
  r.fornitori.forEach(function (g) { per[g.nome] = g; });

  verifica('tre fornitori (stessa P.IVA unita anche con nomi diversi)', r.fornitori.length === 3);
  var rossi = per['Torrefazione Rossi'];
  verifica('nome = quello della fattura più recente', !!rossi);
  verifica('Rossi: mese 305, anno 855', rossi.totaleMese === 305 && rossi.totaleAnno === 855);
  verifica('Rossi: pagato 300, da pagare 555', rossi.pagatoAnno === 300 && rossi.daPagare === 555);
  verifica('Rossi: prossima scadenza la più vicina tra le non pagate (01/09)', chiaveGiorno_(rossi.prossima) === '2026-09-01');
  verifica('Rossi: c\'è una scaduta', rossi.scaduto === true);
  verifica('Rossi: 3 fatture, dalla più recente, con ID scadenza', rossi.fatture.length === 3 && rossi.fatture[0].numero === 'A1' &&
    rossi.fatture[0].idScadenza === 'D1' && rossi.fatture[0].stato === 'da pagare');

  var bianchi = per['Bevande Bianchi'];
  verifica('Bianchi: nota di credito sottratta (mese 200)', bianchi.totaleMese === 200 && bianchi.totaleAnno === 200);
  verifica('Bianchi: senza scadenza = già pagata', bianchi.pagatoAnno === 200 && bianchi.daPagare === 0 && bianchi.prossima === null);
  verifica('Bianchi: fattura dell\'anno scorso pagata non in elenco', bianchi.fatture.length === 2 &&
    bianchi.fatture.every(function (f) { return f.stato === 'senza scadenza'; }));

  var pane = per['Panificio'];
  verifica('Panificio: anno scorso ma ancora da pagare → compare', pane.daPagare === 80 && pane.totaleAnno === 0 && pane.fatture.length === 1);
  verifica('ordinati per da pagare', r.fornitori[0].nome === 'Torrefazione Rossi' && r.fornitori[1].nome === 'Panificio');
  verifica('totali', r.totali.daPagare === 635 && r.totali.mese === 505 && r.totali.anno === 1055);
  verifica('nessuna fattura: elenco vuoto', calcolaSaldoFornitori_([], [], 2026, 10, d('2026-10-10')).fornitori.length === 0);

  var messaggio = falliti.length ?
    '✗ Prova saldo fornitori: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova saldo fornitori superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
