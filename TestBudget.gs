/**
 * Bar - Spese & Cassa: prove dei calcoli del budget per categoria.
 * testBudget() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testBudget() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };

  // Soglie: ambra sopra l'80%, rossa sopra il 100%
  verifica('79% ok', livelloBudget_(79, 100) === 'ok');
  verifica('80% esatto ancora ok', livelloBudget_(80, 100) === 'ok');
  verifica('80,01% attenzione', livelloBudget_(80.01, 100) === 'attenzione');
  verifica('100% esatto attenzione', livelloBudget_(100, 100) === 'attenzione');
  verifica('100,01% superato', livelloBudget_(100.01, 100) === 'superato');

  var budget = [
    { categoria: 'Caffè', tetto: 500 },
    { categoria: 'Bevande', tetto: 300 },
    { categoria: 'Alimentari', tetto: 200 },
    { categoria: 'Altro', tetto: null }
  ];
  var stato = statoBudget_(budget, { 'Caffè': 420, 'bevande': 330, 'Pulizia': 50 });
  verifica('solo le categorie con tetto', stato.length === 3);
  verifica('ordinate dalla più consumata', stato[0].categoria === 'Bevande' && stato[1].categoria === 'Caffè' && stato[2].categoria === 'Alimentari');
  verifica('nome della categoria senza badare alle maiuscole', stato[0].speso === 330);
  verifica('Bevande superato, residuo negativo', stato[0].livello === 'superato' && stato[0].residuo === -30 && stato[0].percentuale === 110);
  verifica('Caffè 84% attenzione', stato[1].livello === 'attenzione' && stato[1].percentuale === 84 && stato[1].residuo === 80);
  verifica('Alimentari senza spese: 0%', stato[2].speso === 0 && stato[2].livello === 'ok');
  verifica('note di credito (negativi) riducono la spesa', statoBudget_([{ categoria: 'Caffè', tetto: 100 }], { 'Caffè': -20 })[0].livello === 'ok');

  // Avvisi una sola volta per soglia, categoria e mese
  var mese = '2026-10';
  var conAvvisi = function (s, a80, a100) { s.avviso80 = a80 || ''; s.avviso100 = a100 || ''; return s; };
  var a = avvisiBudgetDaInviare_([conAvvisi(stato[0]), conAvvisi(stato[1]), conAvvisi(stato[2])], mese);
  verifica('due avvisi: Bevande 100%, Caffè 80%', a.length === 2 && a[0].soglia === 100 && a[0].voce.categoria === 'Bevande' &&
    a[1].soglia === 80 && a[1].voce.categoria === 'Caffè');
  a = avvisiBudgetDaInviare_([conAvvisi(stato[0], mese, mese), conAvvisi(stato[1], mese)], mese);
  verifica('già avvisati questo mese: niente', a.length === 0);
  a = avvisiBudgetDaInviare_([conAvvisi(stato[0], mese, ''), conAvvisi(stato[1], '2026-09')], mese);
  verifica('80% già mandato ma ora oltre il 100%: parte il 100%', a.length === 2 && a[0].soglia === 100);
  verifica('avviso del mese scorso non conta', a[1].soglia === 80);
  a = avvisiBudgetDaInviare_([conAvvisi(stato[1], '', mese)], mese);
  verifica('tornato sotto il 100% dopo l\'avviso: non riparte l\'80%', a.length === 0);

  var messaggio = falliti.length ?
    '✗ Prova budget: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova budget superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
