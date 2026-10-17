/**
 * Bar - Spese & Cassa: prove dei calcoli della quadratura cassa.
 * testQuadratura() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testQuadratura() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };

  // Differenza = contanti + POS − registratore
  var q = calcolaQuadratura_(350, 120.5, 470.5, 5);
  verifica('in pari: differenza 0', q.differenza === 0 && q.entro && q.esito === 'ok');
  q = calcolaQuadratura_(350, 120.5, 467, 5);
  verifica('+3,50 entro 5 €', q.differenza === 3.5 && q.entro && q.esito === 'ok');
  q = calcolaQuadratura_(350, 120.5, 465.5, 5);
  verifica('esattamente 5 € è ancora entro', q.differenza === 5 && q.entro);
  q = calcolaQuadratura_(350, 120.5, 465.49, 5);
  verifica('5,01 € oltre: eccedenza', q.differenza === 5.01 && !q.entro && q.esito === 'eccedenza');
  q = calcolaQuadratura_(300, 100, 412, 5);
  verifica('−12 €: ammanco', q.differenza === -12 && !q.entro && q.esito === 'ammanco');
  q = calcolaQuadratura_(0.1, 0.2, 0.3, 0);
  verifica('decimali: 0,1 + 0,2 − 0,3 = 0 con tolleranza 0', q.differenza === 0 && q.entro);
  q = calcolaQuadratura_(100, 0, 100.01, 0);
  verifica('tolleranza 0: anche 1 centesimo è fuori', !q.entro && q.esito === 'ammanco');
  verifica('registratore non scritto: nessun esito', calcolaQuadratura_(100, 50, null, 5) === null);
  verifica('registratore vuoto: nessun esito', calcolaQuadratura_(100, 50, '', 5) === null);
  q = calcolaQuadratura_(0, 0, 0, 5);
  verifica('registratore 0 (giorno senza incassi) è valido', q && q.differenza === 0);

  // Riassunto del mese
  var d = function (s) { return leggiData_(s); };
  var r = riepilogoQuadratura_([
    { data: d('2026-10-01'), contanti: 300, pos: 100, registratore: 400, note: '' },          // in pari
    { data: d('2026-10-02'), contanti: 300, pos: 100, registratore: 397, note: '' },          // +3 entro
    { data: d('2026-10-03'), contanti: 300, pos: 100, registratore: 420, note: 'Resto sbagliato' }, // −20 oltre
    { data: d('2026-10-04'), contanti: 250, pos: 90, registratore: null, note: '' },          // senza registratore
    { data: d('2026-10-05'), contanti: 280, pos: 90, registratore: 360, note: 'Mancia' }      // +10 oltre
  ], 5);
  verifica('giorni confrontati 4', r.confrontate === 4);
  verifica('giorni con differenza 3', r.conDifferenza === 3);
  verifica('oltre la tolleranza 2', r.oltreTolleranza === 2);
  verifica('totale differenze −7 (' + r.totaleDifferenze + ')', r.totaleDifferenze === -7);
  verifica('elenco dei giorni con data e nota', r.giorni.length === 3 && r.giorni[1].data === '03/10/2026' &&
    r.giorni[1].note === 'Resto sbagliato' && r.giorni[1].oltre === true && r.giorni[0].oltre === false);
  verifica('mese senza registratore: tutto a zero', riepilogoQuadratura_([{ data: d('2026-10-01'), contanti: 1, pos: 1, registratore: null }], 5)
    .confrontate === 0);
  verifica('testo con segno', differenzaConSegno_(-7) === '−7,00 €' && differenzaConSegno_(2.5) === '+2,50 €' &&
    differenzaConSegno_(0.001) === '0,00 €');

  var messaggio = falliti.length ?
    '✗ Prova quadratura cassa: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova quadratura cassa superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
