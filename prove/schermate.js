/*
 * Schermate fotografate da prove/screenshot.js.
 * Ogni voce: nome del file e azioni per arrivarci partendo dalla home.
 */
'use strict';

/** Il Riepilogo ricorda l'ultima sezione aperta: per partire sempre da zero chiude quelle rimaste aperte. */
async function chiudiSezioniRiepilogo(p, chiavi) {
  for (var c of chiavi) {
    if ((await p.getAttribute('#testa-' + c, 'aria-expanded')) === 'true') await p.click('#testa-' + c);
  }
}

/** Apre «Spese coperte dai ricavi» nel Riepilogo con il periodo voluto ('anno', 'date' = da N a M giorni fa, 'vuoto'). */
async function apriCopertura(p, aiuto, periodo, giorniDa, giorniA) {
  await p.click('#vai-riepilogo');
  await aiuto.attendi(p);
  await chiudiSezioniRiepilogo(p, ['categorie', 'andamento', 'fatture', 'cassa', 'ultime']);
  if ((await p.getAttribute('#testa-dafare', 'aria-expanded')) === 'true') await p.click('#testa-dafare');
  if ((await p.getAttribute('#testa-copertura', 'aria-expanded')) !== 'true') await p.click('#testa-copertura');
  await aiuto.attendi(p);
  if (periodo === 'anno') {
    await p.click('#cop-periodi button[data-periodo="anno"]');
  } else {
    await p.click('#cop-periodi button[data-periodo="personalizzato"]');
    await aiuto.attendi(p);
    var date = await p.evaluate(function (g) {
      var iso = function (n) {
        var d = new Date(new Date().getTime() - n * 86400000);
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      };
      return g ? [iso(g[0]), iso(g[1])] : ['2019-01-01', '2019-01-31'];
    }, periodo === 'date' ? [giorniDa, giorniA] : null);
    await p.fill('#cop-da', date[0]);
    await p.fill('#cop-a', date[1]);
    await p.click('#cop-applica');
  }
  await aiuto.attendi(p);
}

module.exports = [
  { nome: 'pin', vai: async function () {} },
  { nome: 'home', vai: async function () {} },
  // Pagine della barra in basso
  { nome: 'spese', vai: async function (p) { await p.click('#nav-spese'); } },
  { nome: 'cassa', vai: async function (p) { await p.click('#nav-cassa'); } },
  { nome: 'altro', vai: async function (p) { await p.click('#nav-altro'); } },
  {
    // Caricamento: lo scheletro che compare mentre arriva una pagina
    nome: 'caricamento',
    senzaAttesa: true,
    vai: async function (p) {
      await p.evaluate(function () {
        document.getElementById('schermi').style.display = 'none';
        document.getElementById('navigazione').style.display = 'none';
        document.getElementById('pannello-attesa').style.display = 'block';
      });
    },
    dopo: async function (p) { await p.reload(); }
  },
  {
    nome: 'persona-scelta',
    vai: async function (p) {
      await p.evaluate(function () { localStorage.removeItem('barSpeseCassa.persona'); });
      await p.reload();
      await p.waitForSelector('#schermo-persona', { state: 'visible' });
    }
  },
  {
    nome: 'nuova-spesa',
    vai: async function (p) {
      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '12,50');
    }
  },
  {
    nome: 'nuova-spesa-scadenza',
    vai: async function (p) {
      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '45,00');
      await p.click('#spesa-pagamenti button >> nth=0');
      await p.click('#spesa-scadenza-7');
      await p.evaluate(function () { document.getElementById('spesa-scadenza').scrollIntoView(); });
    }
  },
  {
    nome: 'nuova-spesa-fornitore-ricerca',
    vai: async function (p) {
      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '12,50');
      await p.click('#spesa-fornitore');
      await p.keyboard.type('esse');
      await p.evaluate(function () { document.getElementById('spesa-fornitore').scrollIntoView(); window.scrollBy(0, -100); });
    }
  },
  {
    nome: 'nuova-spesa-fornitore-recenti',
    vai: async function (p) {
      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '12,50');
      await p.click('#spesa-fornitore');
      await p.evaluate(function () { document.getElementById('spesa-fornitore').scrollIntoView(); window.scrollBy(0, -100); });
    }
  },
  {
    nome: 'chiusura',
    vai: async function (p) {
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-contanti', '350,00');
      await p.fill('#chiusura-pos', '120,50');
    }
  },
  {
    nome: 'chiusura-quadratura-ok',
    vai: async function (p) {
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-contanti', '350,00');
      await p.fill('#chiusura-pos', '120,50');
      await p.fill('#chiusura-registratore', '468,00');
    }
  },
  {
    nome: 'chiusura-quadratura-ammanco',
    vai: async function (p) {
      await p.click('#vai-chiusura');
      await p.fill('#chiusura-contanti', '350,00');
      await p.fill('#chiusura-pos', '120,50');
      await p.fill('#chiusura-registratore', '1.482,30');
    }
  },
  {
    // Tutte le sezioni chiuse (anche «Da fare», che si apre da sola)
    nome: 'riepilogo-chiuso',
    vai: async function (p, aiuto) {
      await p.click('#vai-riepilogo');
      await aiuto.attendi(p);
      await chiudiSezioniRiepilogo(p, ['categorie', 'andamento', 'fatture', 'cassa', 'copertura', 'ultime']);
      await p.click('#testa-dafare');
    }
  },
  {
    // Una sezione aperta, «Da fare» chiusa
    nome: 'riepilogo-aperto',
    vai: async function (p, aiuto) {
      await p.click('#vai-riepilogo');
      await aiuto.attendi(p);
      await chiudiSezioniRiepilogo(p, ['categorie', 'andamento', 'fatture', 'cassa', 'copertura', 'ultime']);
      await p.click('#testa-dafare');
      await p.click('#testa-categorie');
    }
  },
  {
    // «Da fare» piena: si apre da sola, prima di tutte le altre sezioni
    nome: 'riepilogo-dafare',
    vai: async function (p, aiuto) {
      await p.click('#vai-riepilogo');
      await aiuto.attendi(p);
      await chiudiSezioniRiepilogo(p, ['categorie', 'andamento', 'fatture', 'cassa', 'copertura', 'ultime']);
    }
  },
  {
    // «Spese coperte dai ricavi»: elenco corto (pochi giorni), lungo (anno, prime 30 righe) e periodo vuoto
    nome: 'copertura-corta',
    vai: async function (p, aiuto) { await apriCopertura(p, aiuto, 'date', 6, 3); }
  },
  {
    nome: 'copertura-lunga',
    vai: async function (p, aiuto) { await apriCopertura(p, aiuto, 'anno'); }
  },
  {
    nome: 'copertura-mesi',
    vai: async function (p, aiuto) {
      await apriCopertura(p, aiuto, 'anno');
      await p.click('#cop-vista button[data-vista="mesi"]');
    }
  },
  {
    nome: 'copertura-vuota',
    vai: async function (p, aiuto) { await apriCopertura(p, aiuto, 'vuoto'); }
  },
  {
    nome: 'elenco-spese',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'elenco-filtri',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendi(p);
      await p.click('#elenco-filtri-apri');
      await p.selectOption('#elenco-mese', { index: 1 });
      await aiuto.attendi(p);
      await p.selectOption('#elenco-categoria', 'Caffè');
      await aiuto.attendi(p);
      await p.fill('#elenco-testo', 'rossi');
      await p.click('#elenco-cerca');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'elenco-chiusure',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendi(p);
      await p.click('#elenco-tipo button[data-tipo="chiusure"]');
      await aiuto.attendi(p);
    },
    dopo: async function (p, aiuto) {
      await p.click('#elenco-tipo button[data-tipo="spese"]');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'modifica-spesa',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendi(p);
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-spesa', { state: 'visible' });
    }
  },
  {
    nome: 'modifica-chiusura',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-elenco');
      await aiuto.attendi(p);
      await p.click('#elenco-tipo button[data-tipo="chiusure"]');
      await aiuto.attendi(p);
      await p.click('#elenco-voci .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-chiusura', { state: 'visible' });
    },
    dopo: async function (p, aiuto) {
      await p.click('#chiusura-annulla');
      await p.click('#elenco-tipo button[data-tipo="spese"]');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'scadenze',
    vai: async function (p, aiuto) {
      await p.click('#vai-scadenze');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'scadenze-segna-pagata',
    vai: async function (p, aiuto) {
      await p.click('#vai-scadenze');
      await aiuto.attendi(p);
      await p.click('#scadenze-elenco button:has-text("Segna pagata") >> nth=0');
      await p.waitForSelector('#pannello-conferma', { state: 'visible' });
    }
  },
  {
    nome: 'scadenze-nuova',
    vai: async function (p, aiuto) {
      await p.click('#vai-scadenze');
      await aiuto.attendi(p);
      await p.click('#scadenze-nuova');
      await p.fill('#ns-descrizione', 'Tassa rifiuti (TARI)');
      await p.fill('#ns-importo', '320,00');
      await p.click('#ns-frequenze button:has-text("Ogni 3 mesi")');
    }
  },
  {
    nome: 'haccp',
    vai: async function (p, aiuto) {
      await p.click('#vai-haccp');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'haccp-fuori-range',
    vai: async function (p, aiuto) {
      await p.click('#vai-haccp');
      await aiuto.attendi(p);
      var campo = p.locator('#haccp-elenco .campo-temperatura').nth(1);
      await campo.fill('-12');
      await campo.scrollIntoViewIfNeeded();
    }
  },
  {
    nome: 'fornitori',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-fornitori');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'fornitori-dettaglio',
    vai: async function (p, aiuto) {
      await p.click('#nav-spese');
      await p.click('#vai-fornitori');
      await aiuto.attendi(p);
      await p.click('#fornitori-elenco .voce >> nth=0 >> button:has-text("Vedi le fatture")');
      await p.waitForSelector('#schermo-fornitore', { state: 'visible' });
    }
  },
  {
    nome: 'scadenze-fisse',
    vai: async function (p, aiuto) {
      await p.click('#vai-scadenze');
      await aiuto.attendi(p);
      await p.click('#scadenze-fisse');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'movimenti',
    vai: async function (p, aiuto) {
      await p.click('#nav-cassa');
      await p.click('#vai-movimenti');
      await aiuto.attendi(p);
      await p.click('#movimento-tipi button >> nth=2');
      await p.fill('#movimento-importo', '45,00');
    }
  },
  {
    nome: 'margini',
    vai: async function (p, aiuto) {
      await p.click('#vai-margini');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'margini-prodotto',
    vai: async function (p, aiuto) {
      await p.click('#vai-margini');
      await aiuto.attendi(p);
      await p.click('#margini-elenco .voce >> nth=0 >> button:has-text("Modifica")');
      await p.waitForSelector('#schermo-prodotto-margine', { state: 'visible' });
    }
  },
  {
    nome: 'ordini',
    vai: async function (p, aiuto) {
      await p.click('#vai-ordini');
      await aiuto.attendi(p);
    }
  },
  {
    nome: 'ordini-singolare-plurale',
    vai: async function (p, aiuto) {
      await p.click('#vai-ordini');
      await aiuto.attendi(p);
      // Acqua frizzante: da 2 a 1 («1 cassa»); Acqua naturale resta a 3 («3 casse»)
      var frizzante = p.locator('.riga-prodotto', { hasText: 'Acqua frizzante' });
      if (/2 casse/.test(await frizzante.textContent())) {   // i dati finti restano uguali tra le larghezze
        await frizzante.locator('button[aria-label="Uno in meno"]').click();
      }
      await p.waitForTimeout(800);
    }
  },
  {
    nome: 'ordini-aggiungi-rapido-pillole',
    vai: async function (p, aiuto) {
      await p.click('#vai-ordini');
      await aiuto.attendi(p);
      await p.locator('.ordine-fornitore', { hasText: 'Bevande Bianchi' }).locator('button.aggiungi-rapido').click();
      await p.waitForTimeout(1000);
    }
  },
  {
    nome: 'ordini-aggiungi-rapido-suggerimenti',
    vai: async function (p, aiuto) {
      await p.click('#vai-ordini');
      await aiuto.attendi(p);
      await p.locator('.ordine-fornitore', { hasText: 'Bevande Bianchi' }).locator('button.aggiungi-rapido').click();
      await p.fill('#rapido-campo', 'ac');
      await p.waitForTimeout(1000);
    }
  },
  {
    nome: 'ordini-nuovo-prodotto',
    vai: async function (p, aiuto) {
      await p.click('#vai-ordini');
      await aiuto.attendi(p);
      await p.click('#ordini-nuovo');
      await p.fill('#np-nome', 'Latte intero alta qualità');
      await p.selectOption('#np-fornitore', 'Supermercato');
      await p.fill('#np-unita', 'litri');
    }
  },
  {
    nome: 'coda-salvato-sul-dispositivo',
    vai: async function (p) {
      await p.context().setOffline(true);
      await p.click('#vai-spesa');
      await p.fill('#spesa-importo', '12,50');
      await p.fill('#spesa-fornitore', 'Panificio Verdi');
      await p.click('#spesa-categorie button >> nth=0');
      await p.click('#spesa-pagamenti button >> nth=0');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-in-coda', { state: 'visible' });
    },
    dopo: async function (p) {
      await p.context().setOffline(false);
      await p.evaluate(function () { localStorage.removeItem('barSpeseCassa.coda'); });
    }
  },
  {
    nome: 'errore',
    vai: async function (p) {
      await p.click('#vai-spesa');
      await p.click('#spesa-salva');
      await p.waitForSelector('#pannello-errore', { state: 'visible' });
    }
  },
  {
    nome: 'coda-barra-home',
    vai: async function (p, aiuto) {
      await rete(aiuto.porta, 'off');
      await p.evaluate(function () {
        localStorage.setItem('barSpeseCassa.coda', JSON.stringify([
          { chiave: 'Sabc123', funzione: 'salvaSpesa', argomenti: [{ id: 'Sabc123', data: '2026-10-08', importo: '12,50', fornitore: 'Panificio Verdi', categoria: 'Caffè', pagamento: 'Contanti' }], descrizione: 'Spesa del 08/10/2026 – 12,50 € – Panificio Verdi', creata: 1, errore: '', conflitto: '' },
          { chiave: 'Cabc123', funzione: 'salvaChiusura', argomenti: [{ id: 'Cabc123', data: '2026-10-07', contanti: '400', pos: '120' }, false], descrizione: 'Chiusura cassa del 07/10/2026 – 520,00 €', creata: 2, errore: '', conflitto: 'C\'è già una chiusura cassa per il 07/10/2026. Vuoi sostituirla con questa?' }
        ]));
      });
      await p.click('#vai-spesa');
      await p.click('#spesa-indietro');
      await p.waitForSelector('#barra-coda', { state: 'visible' });
    },
    dopo: async function (p, aiuto) {
      await p.evaluate(function () { localStorage.removeItem('barSpeseCassa.coda'); });
      await rete(aiuto.porta, 'on');
    }
  },
  {
    nome: 'coda-elenco',
    vai: async function (p, aiuto) {
      await rete(aiuto.porta, 'off');
      await p.evaluate(function () {
        var spesa = { id: 'Sabc123', data: '2026-10-08', importo: '12,50', fornitore: 'Panificio Verdi', categoria: 'Caffè', pagamento: 'Contanti', nota: '', foto: 'data:image/jpeg;base64,AAAA', fotoTipo: 'image/jpeg' };
        localStorage.setItem('barSpeseCassa.coda', JSON.stringify([
          { chiave: 'Sabc123', funzione: 'salvaSpesa', argomenti: [spesa], descrizione: 'Spesa del 08/10/2026 – 12,50 € – Panificio Verdi', creata: 1, errore: '', conflitto: '' },
          { chiave: 'Cabc123', funzione: 'salvaChiusura', argomenti: [{ id: 'Cabc123', data: '2026-10-07', contanti: '400', pos: '120' }, false], descrizione: 'Chiusura cassa del 07/10/2026 – 520,00 €', creata: 2, errore: '', conflitto: 'C\'è già una chiusura cassa per il 07/10/2026. Vuoi sostituirla con questa?' },
          { chiave: 'Sdef456', funzione: 'salvaSpesa', argomenti: [{ id: 'Sdef456', data: '2026-10-06', importo: '1.250,00', fornitore: 'Ferramenta Neri con un nome molto lungo per la prova', categoria: 'Manutenzione', pagamento: 'Bonifico' }], descrizione: 'Spesa del 06/10/2026 – 1.250,00 € – Ferramenta Neri con un nome molto lungo per la prova', creata: 3, errore: 'L\'importo non è valido. Esempio: 12,50', conflitto: '' }
        ]));
      });
      await p.click('#vai-spesa');
      await p.click('#spesa-indietro');
      await p.click('#barra-coda-vedi');
      await p.waitForSelector('#schermo-coda', { state: 'visible' });
    },
    dopo: async function (p, aiuto) {
      await p.evaluate(function () { localStorage.removeItem('barSpeseCassa.coda'); });
      await rete(aiuto.porta, 'on');
    }
  }
];

function rete(porta, stato) {
  return new Promise(function (ok) {
    require('http').get('http://localhost:' + porta + '/rete?stato=' + stato, function (r) { r.resume(); r.on('end', ok); });
  });
}
