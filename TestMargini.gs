/**
 * Bar - Spese & Cassa: prove del calcolo di costo e margine dei prodotti.
 * testMargini() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testMargini() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };

  // Caffè: 18 €/kg, 7 g per tazzina, 1,20 € IVA 10%
  var m = calcolaMargine_({ prezzoAcquisto: 18, unita: 'kg', quantita: 7, prezzoVendita: 1.2, iva: 10 });
  verifica('caffè: costo porzione 0,126 €', m.completo && m.costo === 0.126);
  verifica('caffè: prezzo senza IVA 1,0909 €', m.netto === 1.0909);
  verifica('caffè: margine 0,9649 €', m.margine === 0.9649);
  verifica('caffè: margine 88,5%', m.marginePerc === 88.5);
  verifica('caffè: food cost 11,6%', m.foodCost === 11.6);
  verifica('margine + food cost = 100%', Math.abs(m.marginePerc + m.foodCost - 100) < 0.11);

  // Latte: 1,20 €/l, 150 ml per cappuccino, 1,50 €, IVA 10%
  m = calcolaMargine_({ prezzoAcquisto: 1.2, unita: 'litro', quantita: 150, prezzoVendita: 1.5, iva: 10 });
  verifica('litro → millilitri: costo 0,18 €', m.costo === 0.18);
  // Bottiglia: 0,45 € al pezzo, 1 pezzo, 2,50 €, IVA 22%
  m = calcolaMargine_({ prezzoAcquisto: 0.45, unita: 'pezzo', quantita: 1, prezzoVendita: 2.5, iva: 22 });
  verifica('pezzo: costo 0,45 €, netto 2,0492 €', m.costo === 0.45 && m.netto === 2.0492);
  verifica('IVA 22%: margine 78%', m.marginePerc === 78);
  // Venduto sotto costo
  m = calcolaMargine_({ prezzoAcquisto: 3, unita: 'pezzo', quantita: 1, prezzoVendita: 2.2, iva: 10 });
  verifica('sotto costo: margine negativo', m.margine < 0 && m.marginePerc < 0 && m.foodCost > 100);
  // IVA mancante: si usa il 10%
  verifica('IVA vuota = 10%', calcolaMargine_({ prezzoAcquisto: 18, unita: 'kg', quantita: 7, prezzoVendita: 1.2, iva: null }).marginePerc === 88.5);
  // Dati mancanti
  m = calcolaMargine_({ prezzoAcquisto: null, unita: 'kg', quantita: 7, prezzoVendita: 0, iva: 10 });
  verifica('incompleto: elenco di cosa manca', !m.completo && m.mancano.join() === 'prezzo d\'acquisto,prezzo di vendita');

  // Unità
  verifica('kg → 1000', fattoreUnita_('Kg') === 1000 && fattoreUnita_('chili') === 1000);
  verifica('l → 1000', fattoreUnita_('l') === 1000 && fattoreUnita_('Litri') === 1000);
  verifica('pezzo → 1', fattoreUnita_('pezzo') === 1 && fattoreUnita_('confezione') === 1 && fattoreUnita_('') === 1);
  verifica('porzione in grammi / ml / pezzi', unitaPorzione_('kg') === 'g' && unitaPorzione_('litro') === 'ml' && unitaPorzione_('pezzo') === 'pezzi');

  var messaggio = falliti.length ?
    '✗ Prova margini: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova margini superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
