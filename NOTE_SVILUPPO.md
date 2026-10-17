# Note di sviluppo

Appunti generici su come è stata costruita l'app, in che ordine e con quali scelte.
Non contengono dati reali: il locale, i fornitori, le persone e gli importi degli esempi
sono inventati («Bar Demo»).

## Vincoli di partenza

- **Costo zero**: niente server né abbonamenti. Tutto gira su Google Apps Script con un
  Google Sheet come database e Google Drive per foto e PDF.
- **Dispositivi**: telefoni Android con Chrome e un **iPad molto vecchio** (Safari senza
  ES6, senza flexbox/grid affidabili). Da qui il JavaScript **ES5** della pagina e il CSS
  con `display: table`, `inline-block` e `position: fixed`.
- **Chi la usa**: personale di un bar, spesso di fretta. Testo grande (≥ 17px), pulsanti
  alti (≥ 52px), poche cose per schermata, tutto in italiano.
- **Niente dati riservati nel codice**: email, PIN e ID di cartelle stanno solo nella scheda
  *Impostazioni* del foglio.

## Iterazioni

Il lavoro è andato avanti a blocchi, un commit per funzione, con revisione del codice e
prove automatiche alla fine di ogni blocco.

1. **Base**: `setup()` che crea le schede, modulo *Nuova spesa* con foto compressa sul
   telefono, *Chiusura cassa*, *Riepilogo*, PIN di accesso.
2. **Fatture elettroniche**: importazione da XML, P7M e ZIP; poi dal **CSV** del portale
   *Fatture e Corrispettivi* (colonne riconosciute per nome, fatture emesse e note di
   credito, chiave anti-doppioni P.IVA + numero + data).
3. **Report mensile** via email con allegato Excel e confronti con il mese prima e con
   l'anno scorso.
4. **Primo blocco di funzioni**: coda offline, cerca e modifica, «chi ha inserito»,
   scadenzario, grafici di andamento, lista «Da ordinare» con ordine via WhatsApp,
   rete di sicurezza (backup settimanale, registro errori, email all'assistenza),
   deploy con clasp.
5. **Secondo blocco**: quadratura cassa con il registratore telematico, registro HACCP
   con PDF mensile, budget per categoria, saldo per fornitore, scadenze fisse del locale,
   versamenti e prelievi con contante teorico, costo e margine dei prodotti.
6. **Rifiniture**: scadenza «Da pagare entro» sulle spese senza fattura, ricerca del
   fornitore scrivendo, riepilogo a sezioni, «Spese coperte dai ricavi» (ogni incasso copre
   la spesa aperta più vecchia, conti in centesimi, periodo a scelta), restyling con barra in
   basso e sistema di design (`docs/DESIGN.md`), aggiunta rapida dei prodotti da ordinare con
   «+ Prodotto», unità al singolare con quantità 1 e al plurale con le altre.

## Scelte tecniche che vale la pena ricordare

- **Coda offline**: la pagina di Apps Script non può aprirsi senza rete, quindi la coda
  copre la rete che cade *mentre* l'app è aperta. Spese e chiusure hanno un **ID creato
  dal telefono** e il server lo riconosce: nessun doppione anche se la risposta si perde.
  Le chiusure in conflitto (stesso giorno) non vengono mai sostituite senza conferma.
- **Quadratura**: la differenza con il registratore è salvata nel foglio ma riepilogo e
  report la **ricalcolano** da contanti, POS e registratore, così una correzione a mano
  nel foglio non lascia numeri incoerenti. Il server non rifiuta mai una chiusura oltre
  tolleranza senza nota (potrebbe arrivare dalla coda offline): la salva e lo annota.
- **HACCP senza spam**: finché il registro è vuoto non partono promemoria né PDF; i
  controlli predefiniti sono marcati «ESEMPIO» e vanno confermati con consulente o ASL.
- **Lock e concorrenza**: più telefoni scrivono sullo stesso foglio. Gli ID assegnati a
  righe già esistenti vengono calcolati sotto `LockService`; il telefono aspetta più del
  server prima di dichiarare «manca internet».
- **Fogli che "aiutano"**: numeri di telefono che perdono lo 0 iniziale, percentuali
  salvate come 0,6, orari trasformati in date del 1899. Il codice li riporta a testo.
- **Funzioni esposte dalla pagina**: Apps Script rende chiamabili tutte le funzioni senza
  `_` finale. Quelle del menu hanno limiti di frequenza e il backup non cestina mai copie
  recenti.

## Come si prova senza Google

- `prove/gas-finto.js` imita in memoria `SpreadsheetApp`, `DriveApp`, `MailApp`,
  `Utilities`, `XmlService`, `HtmlService`, `LockService`, `ScriptApp`. Il codice `.gs`
  gira così sul computer, test compresi.
- `prove/controllo-client.js` analizza la pagina come **ES5** (con acorn) e rifiuta CSS non
  adatto ai vecchi Safari (flexbox, grid, variabili, `calc`, `gap`, `clamp`, `sticky`…).
- `prove/server-finto.js` serve l'app in locale con dati inventati; le prove nel browser
  usano Chromium via Playwright (coda offline, modifica, ricerca fornitore, ordini, HACCP,
  spese coperte dai ricavi, navigazione con la barra in basso…).
- `prove/screenshot.js` fotografa ogni schermata a 320, 412 e 1024 px e verifica che
  nessun testo esca da pulsanti e riquadri.

## Cosa non è coperto dalle prove automatiche

- L'esecuzione sull'Apps Script vero (quote, autorizzazioni, PDF generato da Google).
- Un iPad vecchio reale: la compatibilità è verificata staticamente e con Chromium.
- Fatture a rate (si usa la prima scadenza) e colonne aggiunte a mano nel foglio.
