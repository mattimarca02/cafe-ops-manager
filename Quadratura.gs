/**
 * Bar - Spese & Cassa: quadratura della chiusura cassa con il registratore telematico.
 *
 * Nella Chiusura cassa si può scrivere (facoltativo) il totale della chiusura
 * giornaliera del registratore telematico. Differenza = (contanti + POS) − registratore:
 *   - entro la tolleranza (scheda Impostazioni) → in quadratura;
 *   - positiva oltre la tolleranza → eccedenza (in cassa c'è più del battuto);
 *   - negativa oltre la tolleranza → ammanco.
 *
 * calcolaQuadratura_() e riepilogoQuadratura_() sono funzioni "pure", provate da
 * testQuadratura() in TestQuadratura.gs.
 */

var TOLLERANZA_CASSA_PREDEFINITA = 5;
var NOTA_QUADRATURA_MANCANTE = 'Differenza oltre la tolleranza: nota non scritta';

/** Tolleranza in euro dalla scheda Impostazioni (5 € se vuota o non valida). */
function tolleranzaCassa_() {
  var testo = leggiImpostazione_(IMP_TOLLERANZA_CASSA);
  var n = testo === '' ? null : leggiImporto_(testo);
  return n === null ? TOLLERANZA_CASSA_PREDEFINITA : n;
}

/**
 * Esito della quadratura di un giorno, oppure null se il registratore non è stato scritto.
 * { registratore, differenza, entro (true/false), esito: 'ok' | 'eccedenza' | 'ammanco' }
 */
function calcolaQuadratura_(contanti, pos, registratore, tolleranza) {
  if (registratore === null || registratore === undefined || registratore === '' || isNaN(Number(registratore))) return null;
  var differenza = arrotonda_((Number(contanti) || 0) + (Number(pos) || 0) - Number(registratore));
  // Il piccolo margine evita che 5,00 risulti "oltre" 5 per gli arrotondamenti dei decimali.
  var entro = Math.abs(differenza) <= (Number(tolleranza) || 0) + 0.004;
  return {
    registratore: arrotonda_(Number(registratore)),
    differenza: differenza,
    entro: entro,
    esito: entro ? 'ok' : (differenza > 0 ? 'eccedenza' : 'ammanco')
  };
}

/**
 * Riassunto del mese per il Riepilogo e il report: considera solo le chiusure
 * con il registratore scritto. chiusure: [{ data, contanti, pos, registratore, note }].
 */
function riepilogoQuadratura_(chiusure, tolleranza) {
  var r = { tolleranza: tolleranza, confrontate: 0, conDifferenza: 0, oltreTolleranza: 0, totaleDifferenze: 0, giorni: [] };
  chiusure.forEach(function (c) {
    var q = calcolaQuadratura_(c.contanti, c.pos, c.registratore, tolleranza);
    if (!q) return;
    r.confrontate++;
    if (Math.abs(q.differenza) < 0.005) return;
    r.conDifferenza++;
    if (!q.entro) r.oltreTolleranza++;
    r.totaleDifferenze += q.differenza;
    r.giorni.push({
      data: c.data instanceof Date ? dataIt_(c.data) : String(c.data || ''),
      differenza: q.differenza,
      oltre: !q.entro,
      note: String(c.note || '').replace(/^'/, '')
    });
  });
  r.totaleDifferenze = arrotonda_(r.totaleDifferenze);
  return r;
}

/** "+2,50 €" / "−3,00 €" / "0,00 €" per i testi delle email. */
function differenzaConSegno_(n) {
  if (Math.abs(n) < 0.005) return formatoEuro_(0);
  return (n > 0 ? '+' : '−') + formatoEuro_(Math.abs(n));
}
