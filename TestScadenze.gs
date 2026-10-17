/**
 * Bar - Spese & Cassa: prove dei calcoli delle scadenze ricorrenti.
 * testScadenze() non scrive nulla nel foglio: si può eseguire dall'editor.
 */

function testScadenze() {
  var controlli = 0;
  var falliti = [];
  var verifica = function (descrizione, condizione) {
    controlli++;
    if (!condizione) falliti.push(descrizione);
  };
  var d = function (s) { return leggiData_(s); };
  var date = function (elenco) { return elenco.map(function (x) { return chiaveGiorno_(x); }).join(','); };

  // Frequenze
  verifica('mensile = 1', frequenzaInMesi_('Mensile') === 1);
  verifica('trimestrale = 3', frequenzaInMesi_(' TRIMESTRALE ') === 3);
  verifica('annuale = 12', frequenzaInMesi_('annuale') === 12);
  verifica('bimestrale = 2', frequenzaInMesi_('bimestrale') === 2);
  verifica('semestrale = 6', frequenzaInMesi_('semestrale') === 6);
  verifica('sconosciuta = 0', frequenzaInMesi_('ogni tanto') === 0);

  // Mensile dal 31 gennaio: fine mese nei mesi corti (2028 bisestile)
  var m = occorrenzeRicorrente_(d('2028-01-31'), 1, d('2028-01-01'), d('2028-05-31'), null);
  verifica('mensile dal 31/01 (' + date(m) + ')', date(m) === '2028-01-31,2028-02-29,2028-03-31,2028-04-30,2028-05-31');
  var m2 = occorrenzeRicorrente_(d('2027-01-31'), 1, d('2027-02-01'), d('2027-03-31'), null);
  verifica('febbraio non bisestile (' + date(m2) + ')', date(m2) === '2027-02-28,2027-03-31');

  // Trimestrale: solo le date nell'intervallo, partendo da lontano
  var t = occorrenzeRicorrente_(d('2020-03-16'), 3, d('2026-10-01'), d('2027-04-30'), null);
  verifica('trimestrale dal 16/03/2020 (' + date(t) + ')', date(t) === '2026-12-16,2027-03-16');

  // Annuale dal 29 febbraio
  var a = occorrenzeRicorrente_(d('2024-02-29'), 12, d('2024-01-01'), d('2028-12-31'), null);
  verifica('annuale dal 29/02 (' + date(a) + ')', date(a) === '2024-02-29,2025-02-28,2026-02-28,2027-02-28,2028-02-29');

  // Ultima scadenza e prima scadenza nel futuro
  var u = occorrenzeRicorrente_(d('2026-01-10'), 1, d('2026-01-01'), d('2026-12-31'), d('2026-03-10'));
  verifica('si ferma all\'ultima scadenza (' + date(u) + ')', date(u) === '2026-01-10,2026-02-10,2026-03-10');
  var f = occorrenzeRicorrente_(d('2026-12-05'), 1, d('2026-10-01'), d('2026-11-30'), null);
  verifica('prima scadenza dopo l\'intervallo: nessuna data', f.length === 0);
  verifica('estremi inclusi', occorrenzeRicorrente_(d('2026-10-05'), 1, d('2026-10-05'), d('2026-11-05'), null).length === 2);

  // Giorni da oggi, anche a cavallo del cambio dell'ora
  verifica('giorni attraverso l\'ora legale', giorniDaOggi_(d('2026-03-30'), d('2026-03-28')) === 2);
  verifica('giorni attraverso l\'ora solare', giorniDaOggi_(d('2026-10-26'), d('2026-10-24')) === 2);
  verifica('scaduta ieri', giorniDaOggi_(d('2026-10-08'), d('2026-10-09')) === -1);
  verifica('quandoScade_ domani', quandoScade_(1) === 'domani');
  verifica('aggiungiGiorni_ fine anno', chiaveGiorno_(aggiungiGiorni_(d('2026-12-30'), 3)) === '2027-01-02');

  var messaggio = falliti.length ?
    '✗ Prova scadenze: ' + falliti.length + ' controlli falliti su ' + controlli + ':\n• ' + falliti.join('\n• ') :
    '✓ Prova scadenze superata: ' + controlli + ' controlli tutti corretti.';
  avvisa_(messaggio);
  if (falliti.length) throw new Error(messaggio);
  return messaggio;
}
