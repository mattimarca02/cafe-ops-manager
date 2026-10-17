# Bar Demo – Spese & Cassa: sistema di design

Questo documento descrive l'aspetto dell'app: da dove vengono le scelte, i
colori, la tipografia, le spaziature e i componenti. Tutto il CSS sta in
`Stile.html`; i valori qui sotto sono scritti a mano (niente variabili CSS,
per i vecchi iPad).

## 1. Ricerca: cosa abbiamo preso dai prodotti professionali

Abbiamo guardato pagine pubbliche, documentazione e analisi di Stripe
Dashboard, HubSpot, Pipedrive, Linear/Notion, SumUp (Circuit UI), Square,
Zoho Books, Fatture in Cloud e le linee guida Apple/Material per le barre di
navigazione. Non abbiamo copiato loghi, testi, illustrazioni o layout: solo
principi.

| Principio | Da dove | Come lo applichiamo |
|---|---|---|
| La gerarchia la fanno dimensione e peso del testo, non il colore | Analisi della dashboard Stripe | Titolo pagina 28px, numeri grandi 28–34px in grassetto, etichette 17px grigio caldo |
| Il colore serve solo per gli stati (verde = a posto, giallo/ocra = attenzione, rosso = problema) | Stripe, Pipedrive | Pillole e badge colorati solo quando dicono qualcosa; il resto è neutro |
| Prima schermata = poche informazioni che fanno agire | Stripe (home con poche metriche fisse) | Home con 2 azioni e 4 righe di stato, niente elenco di 11 carte |
| Barra in basso con 3–5 destinazioni, «Altro» per il resto | Apple HIG, Material, articoli UX | Home · Spese · Cassa · Riepilogo · Altro |
| La barra in basso è navigazione, non azioni | Apple HIG | «Nuova spesa» e «Chiusura cassa» sono pulsanti nella pagina, non schede |
| I badge solo per cose che chiedono attenzione | Apple HIG | Numero rosso/ocra solo se c'è qualcosa da fare |
| Stato vuoto: dire cosa manca e cosa fare, con tono positivo | HubSpot, Salesforce Lightning, SAP Fiori, Workday Canvas | Icona + una frase, es. «La lista è vuota: non c'è niente da ordinare ✓» |
| Scala di spaziature 4/8, raggi 4–16, numeri «tabellari» | SumUp Circuit UI (token pubblici), Stripe | Spaziature 4·8·12·16·24·32·48; raggi 8·12·16·pillola |
| Liste dense ma leggibili: titolo, una riga di dettaglio, importo allineato a destra | Pipedrive, Zoho Books, Fatture in Cloud | Righe con importo a destra in cifre tabellari |
| I dettagli secondari si nascondono | Linear, Notion | Spiegazioni lunghe dietro «Mostra altro» |

Fonti consultate:
- Analisi della dashboard Stripe: https://www.925studios.co/blog/stripe-dashboard-design-breakdown
- Token di SumUp Circuit UI: https://github.com/sumup-oss/circuit-ui
- Stato vuoto HubSpot: https://developers.hubspot.com/docs/platform/ui-components/emptystate
- Stati vuoti in altri sistemi: https://canvas.workday.com/content/ui-text/empty-states, https://spring-20.lightningdesignsystem.com/guidelines/empty-state
- Barre di navigazione: https://developer.apple.com/design/human-interface-guidelines/tab-bars, https://m3.material.io/components/navigation-bar/guidelines, https://uxplanet.org/perfect-bottom-navigation-for-mobile-app-effabbb98c0f
- Pipedrive (aggiornamenti dell'app mobile e richieste della comunità sui colori di stato): https://community.pipedrive.com

## 2. Vincoli tecnici (non si cambiano)

- CSS per Safari molto vecchi: niente CSS Grid, variabili CSS, flexbox, `gap`,
  `calc`, `clamp/min/max`, `:is/:where`, `position: sticky`. Si usano
  `display: table`, `inline-block` e `position: fixed`. Il controllo
  automatico è `prove/controllo-client.js` (`npm test`).
- Solo font di sistema: `-apple-system, BlinkMacSystemFont, "Segoe UI",
  Roboto, "Helvetica Neue", Arial, sans-serif`.
- Pulsanti alti almeno **52px**, testo almeno **17px** (unica eccezione: le
  etichette dei mesi sotto il grafico dei 12 mesi, che altrimenti non stanno
  in 320px).
- Il testo non esce mai da pulsanti e riquadri (controllo automatico negli
  screenshot).

## 3. Colori

Il carattere resta quello di un bar: espresso, crema, ambra. Rispetto a prima
i toni sono più puliti (crema meno gialla, bordi più leggeri) e c'è un colore
apposta per «attenzione», distinto dall'ambra del marchio.

| Nome | Valore | Uso |
|---|---|---|
| Espresso | `#3a2418` | Intestazione, titoli, pulsante «Chiusura cassa», voce attiva della barra |
| Testo | `#2b1d14` | Testo principale (contrasto 16:1 sul bianco) |
| Testo secondario | `#6b5a4c` | Etichette, dettagli (6,5:1 sul bianco, 5,9:1 sulla crema) |
| Crema (sfondo) | `#f6f2ec` | Sfondo delle pagine |
| Superficie | `#ffffff` | Carte, campi, righe |
| Superficie tenue | `#faf7f3` | Righe premute, campi in sola lettura, scheletri |
| Bordo | `#e9e1d6` | Bordi sottili di carte e separatori |
| Bordo campi | `#d3c6b6` | Bordo di campi e pulsanti secondari |
| Ambra | `#b4561b` | Azione principale, scelta selezionata, focus (4,9:1 con testo bianco) |
| Ambra tenue | `#fcefe3` | Sfondo di scelte selezionate e avvisi informativi (testo `#8a3f0f`) |
| Verde – a posto | `#2f7a4a` | Salvato, incassi, «fatto» (tenue `#e7f3ec`, testo `#1e5a35`) |
| Ocra – attenzione | `#8a5a00` | Cose da fare presto (tenue `#fdf3d7`) |
| Rosso – problema | `#b42318` | Errori, scaduto, elimina (tenue `#fdecea`, testo `#912018`) |

Regola: il colore pieno compare solo in tre posti, cioè l'azione principale,
gli stati e i grafici. Tutto il resto è bianco, crema e grigio caldo.

## 4. Tipografia

| Stile | Dimensione / interlinea | Peso | Uso |
|---|---|---|---|
| Numero grande | 34px / 1.1 | grassetto, cifre tabellari | Totale della chiusura, contante in cassa |
| Numero | 28px / 1.15 | grassetto, cifre tabellari | Box del riepilogo, totali in cima agli elenchi |
| Titolo pagina | 28px / 1.2 (26px sotto i 400px) | grassetto, spaziatura −0,3px | Un solo titolo per pagina |
| Titolo sezione | 21px / 1.25 | grassetto | «Oggi», gruppi della pagina |
| Titolo carta / riga | 18–19px / 1.3 | grassetto | Nome del fornitore, titolo della voce |
| Testo | 18px / 1.45 | normale | Testo normale, campi |
| Dettaglio | 17px / 1.4 | normale, colore secondario | Date, note, spiegazioni |
| Etichetta campo | 17px / 1.3 | grassetto | Sopra ai campi |

Gli importi usano le cifre tabellari (`font-variant-numeric: tabular-nums`),
così si allineano in colonna. I Safari vecchi che non le conoscono mostrano
le cifre normali.

## 5. Spaziature, raggi, ombre

- **Spaziature** su griglia di 4/8px: 4 · 8 · 12 · 16 · 24 · 32 · 48.
  Margine laterale della pagina 16px (24px da 700px in su), spazio fra le
  carte 12px, fra un gruppo e l'altro 24–32px.
- **Raggi**: 8px (piccoli elementi), 12px (campi e pulsanti), 16px (carte),
  pillola (999px) per scelte, badge e stati.
- **Ombre** leggerissime e sempre insieme a un bordo sottile:
  - carta: `0 1px 2px rgba(43,29,20,0.05)`
  - in rilievo (barra in basso, avvisi): `0 -1px 0 #e9e1d6, 0 -4px 16px rgba(43,29,20,0.06)`
- **Bordi**: 1px, mai più spessi. Niente più barre colorate a sinistra su
  ogni carta: la barra rossa a sinistra resta solo per le voci con un problema
  (scaduta, fuori temperatura, da controllare).

## 6. Componenti

### Navigazione
- **Intestazione** scura (espresso), compatta: marchio e nome del bar.
- **Barra in basso** fissa con 5 voci: Home, Spese, Cassa, Riepilogo, Altro.
  Icona 24px + etichetta 17px, voce attiva in espresso con uno sfondo tenue
  dietro l'icona. Le colonne si allargano in base al testo, così «Riepilogo»
  sta anche a 320px. La barra si nasconde nei moduli (spesa, chiusura, nuova
  scadenza, nuovo prodotto), sul PIN e mentre è aperto un messaggio, così non
  si perde quello che si sta scrivendo.
- **Testa della pagina**: link «‹ Indietro» (alto 52px) verso la pagina
  madre, titolo, una riga di sottotitolo.
- **Pagine «Spese», «Cassa», «Altro»**: un'azione principale in cima e
  sotto un elenco a righe (icona, titolo, dettaglio, badge, freccia).

### Pulsanti
| Tipo | Aspetto | Uso |
|---|---|---|
| Primario | Ambra pieno, testo bianco | L'azione della pagina (Salva, Nuova spesa) |
| Secondario | Bianco, bordo `#d3c6b6`, testo espresso | Annulla, Modifica, azioni di contorno |
| Pericolo | Rosso pieno (conferme) o bianco con testo rosso (Elimina nelle righe) | Eliminare |
| Positivo | Verde pieno | «Segna pagata», «Registra» |
| Link | Solo testo, sottolineato al tocco | «Mostra altro», «Cambia» |

Tutti alti almeno 52px, angoli 12px, testo 18px grassetto, icona 20px a sinistra.

### Campi
Alti 56px, bordo 1px `#d3c6b6`, angoli 12px, testo 18px. Al tocco: bordo
ambra e alone ambra di 3px. Gli importi sono più grandi (26px, cifre
tabellari). Campo obbligatorio vuoto: bordo rosso e sfondo rosato.

### Scelte (pillole)
Pillole alte 52px con bordo sottile. Selezionata: sfondo ambra tenue, bordo
ambra, testo ambra scuro e ✓ davanti. I filtri a 2–3 opzioni (Spese/Chiusure,
ordinamenti) sono un **controllo segmentato** a tutta larghezza.

### Carte e righe
- Carta: bianca, bordo 1px, angoli 16px, ombra leggera, padding 16px (24px su tablet).
- Riga di elenco (`.voce`): titolo in grassetto e importo a destra sulla
  stessa riga, dettagli sotto in grigio, pillole di stato, pulsanti in fondo.
- Tabelle di totali: righe separate da un filo, cifre a destra, riga del
  totale in grassetto con un filo più scuro sopra.

### Stati
- **Badge** (numerino): rosso per scadenze e problemi, ocra per cose da fare.
- **Pillola di stato**: verde «✓ …», ocra «da fare», rossa «⚠ …», neutra.
- **Avviso**: riquadro tenue con il testo del colore dello stato.

### Messaggi
- **Caricamento**: scheletro (riquadri grigi che pulsano) al posto della
  rotella, con il testo «Carico…» in piccolo.
- **Salvato ✓**: piccola conferma verde centrata, sparisce da sola.
- **Errore**: carta con icona rossa, messaggio, «Riprova» e «Annulla».
- **Conferma**: carta con domanda e due pulsanti (Sì / No).

### Stati vuoti
Icona tenue + una frase che dice cosa succede e, se serve, cosa fare.

### Icone
Tutte SVG in linea, tratto 2px, angoli e terminazioni arrotondati,
riquadro 24×24. Dimensioni: 20px nei pulsanti, 24px nella barra in basso e
nelle righe.

### Accessibilità
- Contrasto AA per tutto il testo (vedi tabella dei colori).
- Focus visibile: alone ambra di 3px su campi e pulsanti (da tastiera).
- Aree di tocco di almeno 52×52px.
- La barra in basso ha `aria-label` e la voce attiva `aria-current="page"`.
