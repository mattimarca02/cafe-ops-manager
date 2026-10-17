# Café Ops Manager – guida in italiano (app «Spese & Cassa»)

> 🇬🇧 English overview, screenshots and technical choices: [README.md](README.md).
> Questa è la **guida all'installazione e all'uso** in italiano. Nome del locale, fornitori,
> persone e importi negli esempi e negli screenshot sono **inventati** («Bar Demo»).
>
> ⚠️ I controlli **HACCP** predefiniti sono solo dimostrativi e vanno confermati con l'ASL o con
> il consulente HACCP. L'app **non** è una consulenza fiscale o contabile: per IVA, scadenze e
> adempimenti chiedi al commercialista.

App web **gratuita** per il bar: sostituisce il foglio di carta delle spese.
Funziona con **Google Sheet + Google Drive + Google Apps Script**: niente server,
niente abbonamenti, niente pubblicità. Si usa dal telefono Android (Chrome) e
anche da un iPad vecchio (Safari).

Com'è fatta: in basso c'è una **barra con cinque voci** sempre a portata di pollice:
**Home** (le due azioni di tutti i giorni e cosa tenere d'occhio oggi), **Spese**,
**Cassa**, **Riepilogo** e **Altro** (HACCP, da ordinare, margini, chi sta usando l'app, esci).
La grafica segue un piccolo sistema di design (colori caldi del bar, testo grande, pulsanti
alti almeno 52px): è descritto in [`docs/DESIGN.md`](docs/DESIGN.md).

Cosa fa:

- **Nuova spesa**: per le spese **senza fattura** (scontrini, piccoli acquisti).
  Data, importo, fornitore, categoria, pagamento, nota e **foto o PDF** dello scontrino
  (la foto viene rimpicciolita sul telefono e salvata su Drive).
- **Chiusura cassa**: a fine giornata incasso contanti, POS e fondo cassa (una per giorno),
  con la **quadratura** facoltativa con il totale del registratore telematico (esito verde,
  ambra o rosso e nota obbligatoria se la differenza supera la tolleranza).
- **Controlli di oggi (HACCP)**: temperature di frigo e congelatore, pulizie, scadenze della merce,
  con azione correttiva per le temperature fuori dai limiti, promemoria email e **registro mensile
  in PDF**. I controlli predefiniti sono solo un esempio: vanno confermati con il consulente HACCP o l'ASL.
- **Versamenti e prelievi**: versamenti in banca e prelievi dalla cassa, con il **contante teorico in cassa**.
- **Riepilogo**: in cima i tre numeri del mese (spese, incassi, differenza); sotto, **sezioni a
  fisarmonica** che si aprono con un tocco: **Da fare** (fatture da categorizzare, scadenze vicine,
  controlli HACCP, prodotti da ordinare, margini bassi: si apre da sola e sparisce se non c'è nulla),
  **Spese per categoria e budget** (barre verdi, ambra e rosse ed email all'80% e al 100%),
  **Andamento** (grafici: confronto con il mese prima e con l'anno scorso, ultimi 12 mesi, incasso
  medio per giorno della settimana), **Fatture e fornitori**, **Cassa** (contante teorico, incassi,
  versamenti e prelievi, quadratura col registratore), **Spese coperte dai ricavi** (quanto delle spese
  è già stato pagato dagli incassi della cassa, per mese, trimestre, anno o date a scelta) e
  **Ultime spese** (con Modifica/Elimina).
- **Cerca e modifica**: ricerca per fornitore, nota o importo, filtri per mese,
  categoria, pagamento e persona; **modifica** di spese (anche lo scontrino) e chiusure.
- **Senza internet** spese e chiusure restano sul dispositivo e partono da sole quando
  torna la rete («N in attesa di invio»), senza doppioni.
- **Chi ha inserito**: ognuno sceglie il proprio nome (ricordato sul dispositivo).
- **Scadenze**: dalle fatture e dalle spese fisse (affitto, utenze, F24…), con email di
  promemoria e «Segna pagata» dall'app; **scadenze fisse del locale** pronte da attivare
  (estintori, macchina del caffè, assicurazione, SIAE, canone RAI, TARI, impianti).
- **Fornitori**: per ogni fornitore fatture del mese e dell'anno, già pagato, da pagare e prossima scadenza.
- **Margini**: costo per porzione, margine e food cost dei prodotti venduti, con avviso sotto soglia.
- **Da ordinare**: lista della spesa condivisa e ordine al fornitore già scritto in **WhatsApp**.
- **Fatture elettroniche**: le fatture dei fornitori scaricate dal portale
  "Fatture e Corrispettivi" vengono lette in automatico (.xml, .xml.p7m, .zip).
- **Report mensile via email** il giorno 1 di ogni mese alla titolare e al
  commercialista, con allegato Excel e confronti.
- **Rete di sicurezza**: backup settimanale del foglio, registro degli errori ed email
  all'assistenza se qualcosa non va.
- **Aggiornamento con un comando** (`npm run deploy`, con clasp).

> **Nessun dato riservato è nel codice.** Email, PIN e ID di cartelle stanno
> solo nella scheda **Impostazioni** del Google Sheet.

---

## Indice

1. [I file del progetto](#1-i-file-del-progetto)
2. [Creare il Google Sheet](#2-creare-il-google-sheet)
3. [Incollare il codice in Apps Script](#3-incollare-il-codice-in-apps-script)
4. [Eseguire setup() e autorizzare i permessi](#4-eseguire-setup-e-autorizzare-i-permessi)
5. [Compilare le Impostazioni](#5-compilare-le-impostazioni)
6. [Attivare le operazioni automatiche (installaTrigger)](#6-attivare-le-operazioni-automatiche)
7. [Pubblicare l'app web](#7-pubblicare-lapp-web)
8. [Mettere l'icona sulla schermata Home](#8-mettere-licona-sulla-schermata-home)
9. [Provare il report](#9-provare-il-report)
10. [Fatture elettroniche: scaricarle e importarle](#10-fatture-elettroniche-scaricarle-e-importarle)
11. [Guida rapida per l'uso di tutti i giorni](#11-guida-rapida-per-luso-di-tutti-i-giorni)
12. [Modificare il codice e aggiornare l'app](#12-modificare-il-codice-e-aggiornare-lapp)
13. [Problemi frequenti](#13-problemi-frequenti)
14. [Prove sul computer](#14-prove-sul-computer-per-chi-modifica-il-codice)

---

## 1. I file del progetto

| File | A cosa serve |
|---|---|
| `Code.gs` | Configurazione, `setup()`, funzioni dell'app (spese, chiusure, riepilogo) |
| `Elenco.gs` | Cerca e modifica: ricerca, filtri, modifica ed eliminazione |
| `Andamento.gs` | Calcoli per i grafici e i confronti (app e report) |
| `Scadenze.gs` | Scadenzario: scadenze da fatture, ricorrenti e spese senza fattura, promemoria email |
| `Riordino.gs` | Lista "Da ordinare" e numeri WhatsApp dei fornitori |
| `Sicurezza.gs` | Backup settimanale, Registro errori, email all'assistenza |
| `Fatture.gs` | Importazione delle fatture elettroniche (`importaFatture()`) da XML, P7M, ZIP e CSV |
| `FattureCsv.gs` | Lettura dei file CSV del portale "Fatture e Corrispettivi" |
| `Quadratura.gs` | Quadratura della chiusura cassa con il registratore telematico |
| `Copertura.gs` | «Spese coperte dai ricavi»: quali spese sono già coperte dagli incassi (calcolo e funzione `coperturaSpese`) |
| `Haccp.gs`, `ModelloHaccp.html` | Registro HACCP: controlli di oggi, promemoria email, registro mensile in PDF (dal modello HTML) |
| `Budget.gs` | Budget mensile per categoria, avvisi email |
| `SaldoFornitori.gs` | Saldo per fornitore (schermata Fornitori e report) |
| `MovimentiCassa.gs` | Versamenti, prelievi e contante teorico in cassa |
| `Margini.gs` | Costo e margine dei prodotti (scheda Ricette/Costi) |
| `Report.gs` | Report mensile via email, allegato Excel, `installaTrigger()`, `inviaReportDiProva()` |
| `TestFatture.gs` | `testImportaFatture()` e `caricaFattureDiEsempio()` per le prove |
| `TestCsv.gs` | `testImportaCsv()`: prova della lettura dei CSV (non scrive nel foglio) |
| `TestScadenze.gs`, `TestAndamento.gs`, `TestQuadratura.gs`, `TestCopertura.gs`, `TestHaccp.gs`, `TestBudget.gs`, `TestSaldoFornitori.gs`, `TestMovimentiCassa.gs`, `TestMargini.gs` | `testScadenze()`, `testAndamento()`, `testQuadratura()`, `testCopertura()`, `testHaccp()`, `testBudget()`, `testSaldoFornitori()`, `testMovimentiCassa()`, `testMargini()`: prove dei calcoli (non scrivono nel foglio) |
| `Index.html` | La pagina dell'app |
| `Stile.html` | L'aspetto grafico: colori, tipografia, pulsanti, carte, barra in basso (regole in `docs/DESIGN.md`) |
| `docs/DESIGN.md` | Il sistema di design: ricerca, palette, scala tipografica, spaziature, componenti |
| `Script.html` | Il codice della pagina (JavaScript "vecchio stile", va anche sui vecchi iPad) |
| `appsscript.json` | Impostazioni del progetto Apps Script (fuso orario, app web) – serve a clasp |
| `esempi/` | 3 fatture elettroniche **finte** per provare l'importazione |
| `prove/`, `strumenti/`, `package.json` | Prove sul computer e comando di aggiornamento: **non** vanno su Apps Script |

---

## 2. Creare il Google Sheet

1. Vai su <https://sheets.google.com> con l'account Google **del bar** (quello che
   userà sempre l'app: le foto e le fatture finiranno nel suo Google Drive).
2. Clicca su **Vuoto** (il foglio con il "+").
3. In alto a sinistra clicca su "Foglio di lavoro senza titolo" e scrivi
   **Bar – Spese e Cassa**.

Non serve creare le schede a mano: le crea `setup()`.

---

## 3. Incollare il codice in Apps Script

1. Nel Google Sheet, apri il menu **Estensioni → Apps Script**.
   Si apre una nuova scheda del browser con l'editor.
2. In alto a sinistra clicca su "Progetto senza titolo" e rinominalo **Bar Spese Cassa**.
3. A sinistra, sotto **File**, c'è già un file `Codice.gs` (o `Code.gs`).
   Cliccaci sopra, **cancella tutto** quello che contiene e incolla tutto il
   contenuto del file `Code.gs` di questo progetto.
4. Aggiungi gli altri file di script: clicca sul **+** accanto a "File" → **Script**,
   scrivi il nome **senza** `.gs` e incolla il contenuto:
   - `Fatture` → contenuto di `Fatture.gs`
   - `FattureCsv` → contenuto di `FattureCsv.gs`
   - `Report` → contenuto di `Report.gs`
   - `Elenco`, `Andamento`, `Scadenze`, `Riordino`, `Sicurezza` → i file con lo stesso nome
   - `TestFatture`, `TestCsv`, `TestScadenze`, `TestAndamento` → i file con lo stesso nome
5. Aggiungi i file HTML: clicca sul **+** → **HTML**, scrivi il nome **senza** `.html`
   (attenzione a maiuscole e minuscole), cancella il contenuto proposto e incolla:
   - `Index` → contenuto di `Index.html`
   - `Stile` → contenuto di `Stile.html`
   - `Script` → contenuto di `Script.html`
6. Clicca sull'icona del **dischetto** (Salva progetto) o premi `Ctrl+S` (`Cmd+S` su Mac).

> Per copiare un file da GitHub: aprilo, clicca sul pulsante **Raw**, poi
> `Ctrl+A` (seleziona tutto) e `Ctrl+C` (copia).

Alla fine a sinistra devi vedere anche `FattureCsv.gs` e `TestCsv.gs` (15 file + questi due): `Codice.gs`, `Fatture.gs`, `Report.gs`,
`Elenco.gs`, `Andamento.gs`, `Scadenze.gs`, `Riordino.gs`, `Sicurezza.gs`,
`TestFatture.gs`, `TestScadenze.gs`, `TestAndamento.gs`, `Index.html`, `Stile.html`,
`Script.html` (e `appsscript.json`, visibile solo se attivi "Mostra il file manifest").

> **Più comodo**: invece di copiare i file a mano puoi usare clasp, vedi il
> [punto 12.2](#122-con-un-solo-comando-clasp--consigliato).

---

## 4. Eseguire setup() e autorizzare i permessi

1. In alto, nella barra dell'editor, c'è un menu a tendina con il nome di una
   funzione. Selezionalo e scegli **setup**.
2. Clicca su **▶ Esegui**.
3. La prima volta Google chiede l'autorizzazione:
   1. **Rivedi autorizzazioni** → scegli l'account Google del bar.
   2. Compare "**Google non ha verificato questa app**". È normale: l'app l'hai
      scritta tu. Clicca su **Avanzate** → **Vai a Bar Spese Cassa (non sicura)**.
   3. Clicca su **Consenti** (se ci sono caselle da spuntare, spuntale tutte).

   I permessi servono per: leggere/scrivere il foglio, salvare foto e fatture su
   Drive, inviare il report via email, creare l'allegato Excel e attivare gli
   orari automatici.
4. In basso compare il **Registro di esecuzione** con "Configurazione completata ✓".

Ora nel Google Sheet trovi le schede **Spese, Chiusure, Categorie, Persone, Fornitori,
Fatture, Scadenze, Scadenze ricorrenti, Prodotti, Registro errori, Impostazioni**, e su
Google Drive le cartelle **Bar - Scontrini** e **Bar - Fatture** (con dentro
*Da importare*, *Importate*, *Errori*). La cartella **Bar - Backup** viene creata al
primo backup.

Ricaricando il Google Sheet compare anche il menu **Bar** in alto, con tutte le
funzioni a portata di clic (non serve più aprire l'editor).

> `setup()` si può rieseguire quando si vuole: non cancella dati.

---

## 5. Compilare le Impostazioni

Apri la scheda **Impostazioni** del Google Sheet e scrivi nella colonna **Valore**:

| Voce | Cosa scrivere |
|---|---|
| Email titolare | l'email della titolare (riceve il report) |
| Email commercialista | l'email del commercialista (riceve il report e vede le foto) |
| PIN di accesso | 4 cifre a scelta. **All'inizio è 1234: cambialo!** |
| Foto visibili a chi ha il link (SI/NO) | lascia **NO** (vedi [problemi frequenti](#13-problemi-frequenti)) |
| Giorni di preavviso scadenze | quanti giorni prima arriva l'email di promemoria (all'inizio **3**) |
| Email assistenza | l'email di chi aiuta con l'app (riceve gli avvisi di errore). Si può lasciare vuota |
| Tolleranza quadratura cassa (€) | differenza massima con il registratore telematico considerata "in quadratura" (all'inizio **5**) |
| Fondo cassa iniziale (€) | i contanti in cassa (fondo compreso) all'inizio della data di partenza qui sotto |
| Data di partenza del contante in cassa | da quale giorno contare il contante teorico, es. `01/11/2026`. Vuota = contante teorico non mostrato |
| Margine minimo prodotti (%) | sotto questo margine un prodotto è segnalato in rosso nella schermata Margini (all'inizio **60**) |
| Ora limite controlli HACCP | se a quest'ora un controllo giornaliero non è fatto arriva il promemoria (all'inizio **11:00**) |
| Email promemoria HACCP | chi riceve il promemoria HACCP. Vuota = l'email della titolare |
| ID cartella scontrini / fatture / backup / HACCP | si compilano da soli, **non toccarli** |

Le altre schede da compilare (tutte facoltative):

- **Categorie**: una categoria per riga.
- **Persone**: i nomi di chi usa l'app, uno per riga (colonna A). Se è vuota l'app
  non chiede il nome.
- **Fornitori**: la colonna **Categoria predefinita** dà automaticamente la categoria
  alle fatture di quel fornitore; la colonna **Telefono WhatsApp** serve per mandare
  gli ordini (es. `333 1234567`).
- **Scadenze ricorrenti**: le spese fisse (affitto, utenze, F24…): descrizione, importo,
  frequenza (mensile, bimestrale, trimestrale, quadrimestrale, semestrale, annuale),
  data della prima scadenza, eventuale ultima scadenza e **SI** in "Attiva". Ci sono
  3 righe di **esempio disattivate**: correggile e metti SI, oppure cancellale.
  Ci sono anche **7 modelli disattivati** delle scadenze fisse del locale (estintori, macchina del
  caffè, assicurazione, SIAE, canone RAI, TARI, impianti): si attivano anche dall'app
  (Scadenze → Scadenze fisse del locale) scrivendo la data.
- **Prodotti**: i prodotti che si ordinano (nome, fornitore, unità come "casse" o "kg").
  Le unità si scrivono come vuoi: l'app le mostra al singolare con quantità 1 ("1 cassa") e al
  plurale con le altre ("3 casse", "0,5 sacchetti"), anche nel messaggio WhatsApp. Le abbreviazioni
  (kg, g, l, ml, cl, pz…) e le parole invariabili (bar, caffè) non cambiano mai. Se il plurale
  automatico sbaglia, scrivilo nell'ultima colonna, **Unità plurale** (es. "fiaschi"): ha la
  precedenza. Nel foglio resta scritto quello che hai messo tu. Per averla su un foglio già in uso:
  **Bar → 1. Prepara il foglio** (non cancella dati).
  Si possono aggiungere anche dall'app.
- **Controlli HACCP**: i controlli da fare (nome, tipo `spunta`/`temperatura`/`nota`, minimo e
  massimo in °C, frequenza `giornaliera`/`settimanale`, attivo SI/NO). Quelli già scritti sono
  **solo un esempio**: falli confermare dal consulente HACCP o dall'ASL. Il registro è nella scheda **HACCP**.
- **Budget**: il tetto mensile di ogni categoria in colonna B (vuoto = nessun budget).
- **Ricette/Costi**: i prodotti venduti con prezzo d'acquisto, unità (kg, l, pezzo), quantità per
  porzione, prezzo di vendita e IVA (c'è l'esempio del caffè). Si possono aggiungere anche dall'app.
- **Movimenti cassa**: versamenti e prelievi (di solito si registrano dall'app).

---

## 6. Attivare le operazioni automatiche

Nel Google Sheet: menu **Bar → 2. Attiva le operazioni automatiche (report, fatture, scadenze, HACCP, backup)**
(oppure nell'editor scegli la funzione **installaTrigger** e clicca **▶ Esegui**).

Vengono creati questi "attivatori" (una sola volta, anche se lo esegui di nuovo):

- **report mensile**: il giorno **1 di ogni mese tra le 8 e le 9** invia il report del mese precedente;
- **importazione fatture**: **ogni giorno tra le 6 e le 7** legge i file in *Bar - Fatture/Da importare*;
- **promemoria scadenze**: **ogni giorno tra le 7 e le 8** aggiorna le scadenze e manda
  l'email alla titolare quando una scadenza è vicina o arriva il giorno;
- **controllo errori**: **ogni giorno tra le 8 e le 9** manda all'Email assistenza gli
  errori delle ultime 24 ore (se ce ne sono);
- **backup settimanale**: **ogni domenica tra le 3 e le 4** copia il foglio nella cartella
  *Bar - Backup* (restano le ultime 8 copie);
- **promemoria HACCP**: **ogni ora** controlla se, dopo l'ora limite, mancano controlli
  giornalieri di oggi e in quel caso manda **un'email al giorno** (solo dopo che il registro HACCP
  è stato usato almeno una volta).

Il giorno 1, insieme al report, viene salvato anche il **registro HACCP del mese in PDF** nella
cartella *Bar - HACCP* (se il registro è in uso). Dopo l'importazione delle fatture viene controllato
anche il **budget** (email una sola volta per categoria e mese all'80% e al 100%).

Se un attivatore fallisce, parte subito un'email all'Email assistenza e l'errore viene
scritto nella scheda **Registro errori**.

Puoi vederli nell'editor, a sinistra, nell'icona della **sveglia** (Attivatori).

---

## 7. Pubblicare l'app web

1. Nell'editor clicca sul pulsante blu **Esegui il deployment** → **Nuovo deployment**.
2. Accanto a "Seleziona tipo" clicca sull'**ingranaggio** → **App web**.
3. Compila:
   - **Descrizione**: `Prima versione`
   - **Esegui come**: **Me** (l'account del bar)
   - **Chi ha accesso**: **Chiunque**
4. Clicca **Esegui il deployment** (se chiede di nuovo l'autorizzazione, ripeti i passi del punto 4).
5. Copia l'**URL dell'app web** (finisce con `/exec`). È il link dell'app:
   mandalo alla titolare (WhatsApp, email…).

> "Chiunque" significa che chi ha il link vede la pagina del PIN. Senza il PIN
> giusto non si vede e non si salva niente. Dopo 10 PIN sbagliati l'app si blocca
> per 15 minuti. Non pubblicare il link in giro.

---

## 8. Mettere l'icona sulla schermata Home

Fallo **sul dispositivo della titolare**, dopo aver aperto il link e scritto il PIN
una volta (il PIN resta ricordato sul dispositivo).

### Android (Chrome)

1. Apri il link dell'app in **Chrome**.
2. Tocca i **tre puntini ⋮** in alto a destra.
3. Tocca **Aggiungi a schermata Home** (o **Installa app**).
4. Scrivi il nome **Spese Bar** e tocca **Aggiungi**.

### iPad (Safari)

1. Apri il link dell'app in **Safari**.
2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto, in alto
   accanto all'indirizzo).
3. Scorri e tocca **Aggiungi alla schermata Home** (sui modelli vecchi: **Aggiungi a Home**).
4. Scrivi il nome **Spese Bar** e tocca **Aggiungi**.

> Se l'iPad non ricorda il PIN (succede con alcune versioni di Safari o in
> navigazione privata), basta riscriverlo: i dati sono comunque al sicuro nel foglio.

---

## 9. Provare il report

Menu **Bar → Invia un report di prova (mese corrente)** (oppure nell'editor la
funzione **inviaReportDiProva**).

- La prova va **solo alla titolare** (non disturba il commercialista).
- Contiene i dati del mese in corso fino a oggi e l'allegato Excel.

Il report vero (giorno 1 del mese) va a titolare e commercialista e contiene:
spese senza fattura (per categoria e per pagamento), fatture fornitori (per
categoria ed elenco), totale per categoria, i 5 fornitori principali, incassi,
differenza incassi − spese totali, **confronti** con il mese prima e con lo stesso mese
dell'anno scorso, **andamento degli ultimi 12 mesi**, **incasso medio per giorno della
settimana**, **chi ha inserito** spese e chiusure, giorni senza chiusura cassa, fatture da
categorizzare, file di fatture non letti, link alla cartella delle foto del mese
(condivisa in sola lettura con il commercialista). Allegato: Excel con i fogli
*Riepilogo, Spese senza fattura, Fatture, Chiusure cassa, Andamento 12 mesi*
(con la colonna "Inserito da").

Nel menu **Bar** ci sono anche: **Invia un promemoria scadenze di prova** (email con le
scadenze dei prossimi 30 giorni), **Aggiorna le scadenze adesso** e **Fai un backup adesso**.

---

## 10. Fatture elettroniche: scaricarle e importarle

Le fatture dei fornitori passano dal Sistema di Interscambio (SdI) e si trovano
sul portale **Fatture e Corrispettivi** dell'Agenzia delle Entrate. Basta farlo
**una volta al mese**.

### 10.1 Scaricare le fatture dal portale (con SPID)

1. Vai su <https://ivaservizi.agenziaentrate.gov.it/portale/> .
2. Clicca su **Entra con SPID** (va bene anche CIE o CNS), scegli il tuo
   gestore SPID e accedi con le credenziali **della titolare** (conferma con l'app
   o l'SMS del gestore).
3. Se compare la scelta dell'utenza di lavoro, scegli **Me stesso** (ditta individuale).
   Se è la prima volta, accetta le condizioni d'uso.
4. Entra in **Fatturazione elettronica** (o "Fatture e Corrispettivi"), poi
   **Consultazione → Fatture elettroniche e altri dati IVA**.
5. Scegli **Fatture ricevute**, imposta il periodo (es. dal **01/09/2026** al
   **30/09/2026**, si possono cercare al massimo 3 mesi per volta) e clicca **Ricerca**.
6. Per scaricare:
   - **tutte insieme**: seleziona le fatture con la casella in cima alla lista e usa
     il pulsante **Download** (scarica uno **.zip**). Se ce ne sono molte, il portale
     propone il **download massivo**: fai la richiesta e, quando è pronta, scarica lo .zip;
   - **una per volta**: clicca sulla fattura → **Download file fattura**
     (scarica un **.xml** oppure un **.xml.p7m** se firmata).

   Le scritte dei pulsanti possono cambiare un po' nel tempo: cerca sempre
   "Fatture ricevute" e "Download".

> **Se la lista è vuota o non puoi scaricare i file**: nel portale cerca la voce
> **Adesione al servizio di consultazione** (sezione Fatturazione elettronica) e
> aderisci. Si fa una volta sola. Le fatture arrivate **prima** dell'adesione
> potrebbero non essere scaricabili.
>
> In alternativa, se le fatture arrivano anche via **PEC**, puoi salvare gli
> allegati `.xml` / `.xml.p7m` delle PEC. Anche il **commercialista** può
> scaricarle per te se ha la delega al "cassetto fiscale / fatturazione elettronica".

### 10.2 Caricarle su Google Drive

1. Vai su <https://drive.google.com> con l'account del bar.
2. Apri **Il mio Drive → Bar - Fatture → Da importare**.
3. Trascina dentro i file scaricati (`.zip`, `.xml`, `.xml.p7m`, `.csv`) oppure
   clicca **+ Nuovo → Caricamento file**.

Non serve scompattare gli .zip: ci pensa l'app (i file "di metadati" dello SdI,
i PDF e gli altri file non-fattura dentro lo .zip vengono ignorati).

### 10.3 Importarle

- **Automatico**: ogni mattina tra le 6 e le 7 (se hai fatto il passo 6), e
  comunque prima del report del giorno 1.
- **Subito**: nel Google Sheet, menu **Bar → Importa fatture**. Alla fine compare
  il riepilogo: **importate**, **saltate perché già presenti**, **saltate perché emesse**
  (solo per i CSV), **righe con errore**, **file con errori**.

Cosa succede:

- ogni fattura diventa una riga della scheda **Fatture** (Data, Numero, Fornitore,
  P.IVA, Tipo documento, Imponibile, IVA, Totale, Scadenza pagamento, Categoria,
  Nome file, Importata il, Origine: *XML* o *CSV*);
- le **note di credito** (TD04) hanno importi **negativi** (riducono le spese);
- i **doppioni** vengono saltati (stessa P.IVA + numero + data): puoi ricaricare
  lo stesso .zip senza problemi;
- i file letti vanno in **Bar - Fatture/Importate/AAAA-MM**, quelli illeggibili in
  **Bar - Fatture/Errori** (e vengono segnalati nel report);
- la **categoria** viene presa dalla scheda **Fornitori** (colonna *Categoria
  predefinita*, cercando per P.IVA o per nome). Se il fornitore è nuovo viene
  aggiunto alla scheda con la categoria vuota e la fattura resta
  **"Da categorizzare"**.

### 10.4 Dare la categoria ai fornitori nuovi

- **Dal telefono**: apri **Riepilogo**. Se ci sono fatture da categorizzare la sezione **Da fare**
  si apre da sola con un riquadro arancione: per ogni fornitore scegli la categoria e tocca
  **Salva categoria**. Diventa la categoria predefinita del fornitore e viene
  applicata a tutte le sue fatture "Da categorizzare".
- **Dal computer**: scrivi la categoria nella colonna *Categoria predefinita*
  della scheda Fornitori (vale per le fatture future) e, se serve, correggi a mano
  la colonna *Categoria* della scheda Fatture.

### 10.5 Importare il file CSV del portale (alternativa all'XML)

Il portale permette di scaricare, oltre ai file delle fatture, anche **un unico file
`.csv`** con l'elenco di tutte le fatture trovate dalla ricerca: una riga per fattura,
con fornitore, numero, data e importi. È più veloce da scaricare, ma contiene meno
informazioni dell'XML (vedi la tabella sotto).

**Scaricarlo dal portale**

1. Entra nel portale come al punto 10.1: **Consultazione → Fatture elettroniche e altri dati IVA**.
2. Scegli **Fatture ricevute**, imposta il periodo (al massimo 3 mesi per volta) e clicca **Ricerca**.
3. Sopra l'elenco dei risultati clicca su **Esporta** / **Scarica elenco** (la scritta può
   cambiare) e scegli il formato **CSV**. Si scarica un file con un nome tipo
   `…fatture….csv`. Non serve aprirlo né modificarlo (se lo apri con Excel e lo salvi,
   va bene lo stesso: l'app riconosce anche le codifiche vecchie e le date/gli importi
   scritti in modi diversi).

**Dove metterlo e come importarlo**

- Mettilo in **Bar - Fatture → Da importare**, insieme (o al posto) degli XML. Va bene
  anche dentro uno `.zip`.
- Poi si fa **come per gli XML**: menu **Bar → Importa fatture** oppure aspetta
  l'importazione automatica della mattina. Il file va in *Importate/AAAA-MM* (o in
  *Errori* se qualche riga non si è potuta leggere: le righe buone sono comunque
  importate, e il motivo delle altre è scritto nel riepilogo e nella scheda *Registro errori*;
  dopo averle corrette puoi rimettere il file in *Da importare*, i doppioni vengono saltati).

**Cosa viene letto**

- Le colonne si riconoscono **per nome** (non per posizione): *Numero fattura / Documento*,
  *Data emissione*, *Partita IVA fornitore* (se manca, il *Codice fiscale fornitore*),
  *Denominazione fornitore*, *Tipo documento*, *Imponibile/Importo*, *Imposta* e le colonne
  del cliente. Il totale è imponibile + imposta.
- Date come `15/09/2026` o `2026-09-15`; importi come `1.234,56` o `1234.56`.
- Sono importate **solo le fatture ricevute**. Le **fatture emesse** dal bar (se il file ne
  contiene) sono saltate e contate nel riepilogo. Per distinguerle l'app guarda la colonna
  *Tipo fattura* (se dice "emessa"/"ricevuta") e altrimenti chi è il cliente e chi il
  fornitore: il bar è il nome presente quasi in tutte le righe. Con un file di **una sola riga**
  vale "ricevuta".
- Le **note di credito** (TD04) hanno importi negativi, anche se nel CSV erano positivi
  (se erano già negativi restano così).
- **Doppioni**: stessa regola dell'XML (P.IVA + numero + data), anche tra CSV e XML. Se la
  fattura c'è già da XML resta quella. Se c'era da CSV e dopo arriva l'XML, la riga viene
  **completata con l'XML** (con la scadenza), tenendo la categoria già scelta.
- I fornitori nuovi vengono aggiunti alla scheda *Fornitori* senza categoria e le fatture
  restano **"Da categorizzare"**, come per gli XML.

**Differenze rispetto agli XML**

| | XML | CSV |
|---|---|---|
| Una riga per fattura nella scheda *Fatture* | sì | sì (colonna *Origine* = CSV) |
| Scadenza di pagamento | **sì** | **no** (nel CSV non c'è) |
| Scadenze nello **scadenzario** (promemoria e «Segna pagata») | sì | **no**: le fatture da CSV non creano scadenze |
| Fatture a più aliquote IVA | somma dei riepiloghi | importi totali del CSV |
| Un solo file per tante fatture | no (uno per fattura, o uno zip) | sì |

> **Limite**: siccome il CSV non ha la data di pagamento, le fatture importate da CSV
> **non compaiono nello scadenzario**. Se ti servono i promemoria di pagamento per
> quelle fatture, scarica anche gli XML: quando arrivano, la riga viene completata e
> la scadenza compare da sola.

**Provare la lettura dei CSV**: nell'editor di Apps Script esegui `testImportaCsv()`
(non scrive niente nel foglio, deve rispondere "✓ Prova CSV superata"). Nella cartella
`esempi/` c'è `fatture_ricevute_esempio.csv` con dati **inventati** (fatture normali,
nota di credito, fattura emessa, virgolette, doppione, righe rovinate).

### 10.6 Provare l'importazione con le fatture di esempio

- Menu **Bar → Prova la lettura delle fatture di esempio** (`testImportaFatture()`):
  controlla, **senza scrivere niente nel foglio**, che le 3 fatture finte vengano
  lette bene come `.xml`, `.xml.p7m` (binario, base64, doppia firma) e dentro uno `.zip`.
  Deve rispondere "✓ Prova fatture superata".
- Menu **Bar → Copia le fatture di esempio in "Da importare"** e poi
  **Bar → Importa fatture**: prova tutto il giro. **Dopo, cancella** le 3 righe di
  prova dalle schede *Fatture* e *Fornitori* (fornitori "Torrefazione Esempio Srl",
  "Bevande Società Fittizia Snc", "Alimentari Prova Spa").

> Nota: il file firmato `.p7m` viene solo "aperto" per leggere la fattura; la
> validità della firma digitale **non** viene verificata (non serve per la contabilità
> del bar: la fattura ufficiale resta quella nel portale dell'Agenzia).

---

## 11. Guida rapida per l'uso di tutti i giorni

(Da stampare e lasciare vicino alla cassa.)

**Dove trovo le cose** → la barra in basso:

| Voce | Cosa c'è |
|---|---|
| **Home** | **Nuova spesa** e **Chiusura cassa**; sotto, «Da tenere d'occhio»: controlli HACCP, scadenze, da ordinare, margini (il numerino dice quanti ce ne sono, la ✓ verde che è tutto a posto) |
| **Spese** | **+ Nuova spesa**, **Cerca e modifica**, **Scadenze**, **Fornitori** |
| **Cassa** | **+ Chiusura cassa**, **Chiusure inserite**, **Versamenti e prelievi** |
| **Riepilogo** | i numeri del mese e le sezioni da aprire |
| **Altro** | **Controlli HACCP**, **Da ordinare**, **Margini**, **In attesa di invio** (solo se c'è qualcosa), **Chi sta usando l'app**, **Esci** |

**Indietro** (in alto a sinistra) riporta alla pagina da cui sei arrivato. Mentre scrivi una spesa,
una chiusura o una scadenza la barra in basso si nasconde: si esce con **Salva** o **Annulla**.
Le spiegazioni lunghe stanno dietro **Mostra altro**.

**Ho comprato qualcosa SENZA fattura** → **Nuova spesa** (in Home o in Spese)
1. Scrivi l'importo, es. `12,50`.
2. Controlla la data (è già oggi).
3. Tocca il campo **Fornitore** e scrivi qualche lettera: sotto compaiono i fornitori che contengono
   quel testo (maiuscole, accenti e spazi doppi non contano: «esse» trova «Essemarket»; prima quelli che
   iniziano così, al massimo 8, poi si scorre). **Toccane uno** per sceglierlo. A campo vuoto vedi i
   **5 fornitori usati più di recente**. Se il nome non c'è, l'ultima riga dice
   **Aggiungi "…" come nuovo fornitore**: toccala e il fornitore viene aggiunto alla scheda
   Fornitori quando salvi. Se scrivi un nome uguale a uno esistente (anche con maiuscole o accenti
   diversi) l'app usa quello esistente, senza creare doppioni.
4. Tocca la **categoria** e **come hai pagato**.
5. (Facoltativo) **Da pagare entro**: solo se la spesa è ancora da pagare (es. una consegna di
   bibite che salderai con bonifico). Scrivi la data oppure tocca **Tra 7 giorni** / **Tra 30 giorni**.
   Se non la compili, la spesa resta come sempre. **Togli la data** la cancella.
6. (Facoltativo) **Foto o file scontrino**: fotografa lo scontrino.
7. Tocca **Salva spesa** → compare **Salvato ✓**.

**Spesa ancora da pagare** → con **Da pagare entro** compilato la spesa compare anche in **Scadenze**
(«Spesa [fornitore] – [nota]», tipo **Spesa**), con il promemoria email come le altre scadenze.
Quando paghi tocca **✓ Segna pagata**: cambia solo lo stato della scadenza, la spesa (importo e data)
non si muove e **non viene contata due volte** nel Riepilogo, nel Budget e nel report. Se modifichi
la spesa (importo, nota, data) la scadenza si aggiorna; se togli la data o elimini la spesa, la
scadenza collegata sparisce (anche se era già segnata pagata). Se hai già pagato in **Contanti** o
**Carta/Bancomat** lascia vuoto il campo: l'app lo ricorda con una nota.

**Le spese CON fattura non si scrivono**: arrivano da sole.

**Fine giornata** → **Chiusura cassa** (in Home o in Cassa): scrivi l'incasso in contanti (senza il fondo
cassa), l'incasso POS e il fondo cassa → **Salva chiusura**. Se l'avevi già fatta,
l'app chiede se vuoi sostituirla.

**Il Riepilogo a sezioni.** I tre numeri del mese (Spese, Incassi, Differenza) restano sempre in
cima. Sotto ci sono sette sezioni: tocca l'intestazione per aprirla, tocca di nuovo per chiuderla.
Ognuna ha una riga di anteprima (per esempio «2 categorie sopra l'80%» o «Contante teorico
345,00 €»). Si apre **una sola sezione alla volta** e l'app ricorda sul dispositivo l'ultima aperta.
**Da fare** fa eccezione: se ha voci è la prima, con un numerino, e si apre da sola; se non c'è
niente da fare non si vede. Le voci di Da fare (scadenze, HACCP, prodotti da ordinare, margini) si
toccano per andare alla pagina giusta. Le sezioni chiuse non vengono disegnate finché non le apri,
così l'app resta veloce anche su un tablet vecchio.

**«Spese coperte dai ricavi»: come si leggono.** Risponde alla domanda «gli incassi della cassa
bastano a pagare le spese?». Apri la sezione dal Riepilogo e scegli il periodo: le frecce ‹ › cambiano
mese (o trimestre, o anno), le pillole *Questo mese*, *Mese scorso*, *Trimestre*, *Anno* saltano subito
al periodo; con *Personalizzato* scrivi due date (dal… al…) e premi **Mostra questo periodo**. Il periodo
scelto resta ricordato sul dispositivo. Con *Tutte / Senza fattura / Fatture* decidi quali spese contare.

Le regole sono semplici:

1. **Si va giorno per giorno**, dal più vecchio. In ogni giorno prima si «aprono» le spese di quel
   giorno (le spese senza fattura con la data della spesa, le fatture con la data del documento; le
   note di credito contano in meno), poi arrivano i ricavi di quel giorno.
2. **I ricavi sono il «Totale incasso» della chiusura cassa** (contanti + POS), uno per giorno.
3. **Un ricavo copre la spesa ancora aperta più vecchia.** Se avanza, passa alla spesa dopo, e così via.
   Esempio: spesa di 400 €, ricavo del primo giorno 329 € → la spesa resta da coprire per **−71,00 €**;
   il giorno dopo il ricavo è 400 € → 71 € chiudono la spesa («Coperta ✓») e **329 € avanzano**.
4. **L'avanzo non si perde.** Se non ci sono spese aperte, il ricavo diventa «avanzo» e copre subito le
   spese che arrivano dopo. Una nota di credito si comporta allo stesso modo: copre le spese più vecchie.
5. I conti sono fatti in centesimi, quindi niente differenze di arrotondamento. Le spese da 0 € non
   vengono mostrate.

Nell'elenco ogni **spesa** è una scheda; sotto ci sono i **ricavi** che la coprono (righe verdi, quelli
dello stesso giorno su una riga) e, in fondo, il **nastrino** con quanto resta: rosso (−71,00 €) finché
c'è da coprire, verde «Coperta ✓» (con la data) quando arriva a zero. Il riquadro in alto riassume
**Spese**, **Ricavi**, **Ancora da coprire** e **Guadagno** (l'avanzo finale: verde; se resta qualcosa da
coprire è il numero negativo, in rosso), quante spese sono coperte su quante e dopo quanti giorni, in media.

Un giorno passato **senza chiusura cassa** non ha ricavi: l'app lo segnala (e, sulle spese di quel giorno,
scrive che manca la chiusura) perché gli incassi di quel giorno non sono contati. Per periodi lunghi si
vedono le prime 30 righe con **Mostra tutto**, oppure il **Riepilogo per mese** (una riga per mese:
spese, ricavi e, a fine mese, lo scoperto in rosso o il guadagno in verde). Se nel periodo non ci sono né
spese né chiusure compare un messaggio chiaro. I dati si leggono una sola volta per periodo e restano
in memoria finché non salvi, modifichi o elimini qualcosa, oppure riapri il Riepilogo dalla pagina iniziale.

**Ho sbagliato una spesa o una chiusura** → **Spese › Cerca e modifica** (oppure
**Cassa › Chiusure inserite**) → cerca (es. il nome del fornitore) o tocca **Filtri** per scegliere
il mese, la categoria, il pagamento o chi l'ha inserita → **Modifica** (correggi e **Salva modifiche**) oppure
**Elimina**. Le ultime 10 spese si trovano anche nel **Riepilogo**, nella sezione **Ultime spese**.

**Manca internet?** Salva lo stesso: compare «Manca internet. La spesa è salvata sul
dispositivo…» e in alto «1 in attesa di invio». Quando torna la connessione parte da
sola (oppure tocca **Invia ora**). Non cancellare i dati del browser finché c'è
qualcosa in attesa. Se compare «da controllare», tocca **Vedi** e scegli cosa fare.

**Registratore telematico** → nella **Chiusura cassa** scrivi anche il totale dello scontrino di
chiusura del registratore: se il riquadro diventa ambra o rosso, scrivi nella nota il perché.

**Controlli HACCP** → Home › **Controlli HACCP** (o Altro): tocca **Fatto** per le pulizie; per frigo e congelatore
scrivi la temperatura (per i gradi sotto zero usa il tasto **−/+**) e **Registra temperatura**.
Se è fuori dai limiti scrivi cosa hai fatto (azione correttiva). In fondo: **Crea il PDF** del mese.

**Porto i soldi in banca / prendo soldi dalla cassa** → **Cassa › Versamenti e prelievi**: scegli il tipo,
scrivi l'importo e **Salva movimento**. In alto vedi quanti contanti dovrebbero esserci in cassa.

**Quanto devo ai fornitori?** → **Spese › Fornitori**: da pagare, prossima scadenza e le fatture di ognuno.

**Il caffè è aumentato** → **Altro › Margini** → **Modifica** sul prodotto → nuovo prezzo d'acquisto →
**Salva prodotto**: vedi subito il nuovo margine.

**Chi sono?** Se l'app chiede «Chi sta usando l'app?» tocca il tuo nome: viene ricordato.
Per cambiarlo: **Cambia** in Home, oppure **Altro › Chi sta usando l'app**.

**Scadenze** → Home o Spese › **Scadenze** (il numerino rosso dice quante sono vicine): quando hai
pagato tocca **✓ Segna pagata**. Per una spesa fissa nuova: **+ Nuova scadenza**. Per estintori,
assicurazione, SIAE, TARI…: **Scadenze fisse del locale** → scrivi la data → **Salva**.

**Manca qualcosa da ordinare** → Home o Altro › **Da ordinare** → tocca il prodotto (o
**+ Nuovo prodotto**) e usa **−** / **+** per la quantità. Quando è il momento di ordinare:
**Invia l'ordine su WhatsApp** (si apre WhatsApp con il messaggio già scritto: controlla
e premi invio), poi **Ordine inviato: svuota la lista**.

**Aggiungere più prodotti di un fornitore in fila** → in **Da ordinare**, nella scheda del fornitore
tocca **+ Prodotto** (accanto al nome). Si apre un campo: scrivi qualche lettera (maiuscole e
accenti non contano, il testo può stare anche in mezzo al nome) e tocca il prodotto tra i
suggerimenti (al massimo 6): finisce subito in lista con quantità 1 e il campo resta aperto per il
prossimo. Se tocchi di nuovo un prodotto già in lista, la quantità sale di 1 e la riga si
evidenzia un attimo. A campo vuoto compaiono come pulsanti i prodotti del fornitore non ancora in
lista (prima quelli che hai ordinato più spesso *da questo dispositivo*). Se il nome non esiste, l'ultima riga
**Aggiungi "…" come nuovo prodotto** lo crea per quel fornitore con l'unità più usata dai suoi
altri prodotti (la cambi dopo nella scheda Prodotti). **Fatto** chiude il campo. **+ Nuovo prodotto**
in fondo resta per i prodotti senza fornitore.

---

## 12. Modificare il codice e aggiornare l'app

Ci sono due modi. Il link dell'app **resta sempre lo stesso**: l'icona sulla Home
continua a funzionare.

> Dopo un aggiornamento che aggiunge colonne o schede nuove, riesegui `setup()`
> (menu **Bar → 1. Prepara il foglio**) e, se ci sono attivatori nuovi,
> **Bar → 2. Attiva le operazioni automatiche**. Non cancellano nessun dato.

### 12.1 A mano, dall'editor (senza installare niente)

1. Incolla il codice nuovo nei file dell'editor (come al punto 3) e salva.
2. **Esegui il deployment → Gestisci deployment**.
3. Clicca sulla **matita** (Modifica).
4. In **Versione** scegli **Nuova versione** → **Esegui il deployment**.

### 12.2 Con un solo comando (clasp) – consigliato

`clasp` è il programma di Google che carica i file dal computer su Apps Script.
Va preparato **una volta sola** (circa 15 minuti); dopo, per aggiornare l'app basta
scrivere `npm run deploy`.

#### Preparazione (una volta sola)

**1. Installa Node.js**

1. Vai su <https://nodejs.org> e scarica la versione **LTS** (il pulsante a sinistra).
2. Apri il file scaricato e clicca sempre **Avanti** / **Continua** fino a **Fine**
   (su Windows lascia spuntate le opzioni proposte).

**2. Apri il "terminale"** (la finestra dove si scrivono i comandi)

- **Windows**: clicca su **Start**, scrivi `cmd` e apri **Prompt dei comandi**.
- **Mac**: premi `Cmd ⌘ + Spazio`, scrivi `Terminale` e premi Invio.

Per controllare che Node.js sia installato scrivi `node --version` e premi **Invio**:
deve comparire un numero tipo `v22.11.0`.

**3. Scarica il progetto sul computer**

1. Apri la pagina del progetto su GitHub, clicca sul pulsante verde **Code** →
   **Download ZIP**.
2. Estrai lo ZIP (doppio clic su Mac; su Windows tasto destro → **Estrai tutto**) e
   sposta la cartella in **Documenti**, rinominandola `cafe-ops-manager`.

**4. Entra nella cartella con il terminale**

- **Windows**: apri la cartella `cafe-ops-manager` in Esplora file, clicca sulla barra
  dell'indirizzo in alto, scrivi `cmd` e premi Invio: si apre il terminale già nella cartella.
- **Mac**: nel Terminale scrivi `cd ` (con uno spazio dopo), trascina la cartella
  `cafe-ops-manager` dentro la finestra e premi Invio.

**5. Installa clasp** (scrive molte righe, è normale; ci vuole un minuto):

```
npm install
```

**6. Attiva l'API di Apps Script** (una volta per account)

Apri <https://script.google.com/home/usersettings> con l'account **del bar** e metti
**Attivata** alla voce **API Google Apps Script**.

**7. Collega clasp all'account del bar**

```
npm run login
```

Si apre il browser: scegli l'account Google **del bar** e clicca **Consenti**.
Quando compare "Logged in" / "Accesso eseguito" puoi chiudere la pagina.

**8. Trova lo Script ID**

1. Apri il Google Sheet → **Estensioni → Apps Script**.
2. A sinistra clicca sulla **rotellina ⚙️ Impostazioni progetto**.
3. Sotto **ID** c'è **ID script** (una lunga sequenza di lettere e numeri): clicca **Copia**.

**9. Scrivi lo Script ID nel file `.clasp.json`**

Crea il file copiando l'esempio:

- **Windows**: `copy .clasp.json.esempio .clasp.json`
- **Mac**: `cp .clasp.json.esempio .clasp.json`

Poi aprilo (Windows: `notepad .clasp.json`; Mac: `open -e .clasp.json`), sostituisci
`INCOLLA-QUI-LO-SCRIPT-ID` con lo Script ID copiato (lascia le virgolette) e salva.
Deve venire così:

```
{
  "scriptId": "1AbCdEf...lungo...XyZ",
  "rootDir": "."
}
```

> `.clasp.json` contiene l'ID dello script: **non va su GitHub** (è già escluso dal
> file `.gitignore`).

#### Aggiornare l'app (ogni volta)

Apri il terminale nella cartella del progetto (passo 4) e scrivi:

```
npm run deploy
```

Il comando:

1. carica tutti i file `.gs` e `.html` e `appsscript.json` su Apps Script;
2. crea una nuova versione;
3. la pubblica sul **deployment già esistente** dell'app web, così il **link resta lo
   stesso**. Alla fine scrive il link dell'app.

Altri comandi utili:

| Comando | A cosa serve |
|---|---|
| `npm run push` | carica solo il codice (per provarlo dall'editor con **Esegui il deployment → Prova deployment**), senza toccare l'app usata dal bar |
| `npm run login` | ricollega clasp all'account (se dice "No credentials found" o "invalid_grant") |
| `npm test` | esegue tutte le prove sul computer (non tocca il foglio vero) |

Se ci sono **più deployment** dell'app web, `npm run deploy` si ferma e li elenca: crea
nella cartella un file `deployment-id.txt` con dentro solo l'ID di quello giusto
(quello che compare nel link dell'app, tra `/s/` e `/exec`).

> **Attenzione**: `clasp` sostituisce **tutti** i file del progetto online con quelli
> del computer. Da quando usi clasp, non modificare più il codice direttamente
> nell'editor (le modifiche andrebbero perse al prossimo `npm run deploy`).
> Il file `Codice.gs` dell'editor verrà sostituito da `Code.gs`: è normale.
>
> Il file `appsscript.json` imposta il fuso orario (Europe/Rome) e l'accesso all'app
> web (esegui come **Me**, accesso **Chiunque**), come al punto 7.

---

## 13. Problemi frequenti

**"Script function not found: doGet" o pagina bianca**
Controlla che i file HTML si chiamino esattamente `Index`, `Stile`, `Script`
e di aver fatto **Nuova versione** nel deployment.

**L'app dice "PIN sbagliato" ma è giusto**
Nella scheda Impostazioni il PIN deve avere 4 cifre. Se hai sbagliato 10 volte,
aspetta 15 minuti.

**Il commercialista non riesce ad aprire le foto**
La cartella del mese viene condivisa con la sua email. Se la sua email **non** è un
account Google, la condivisione non riesce: nella scheda Impostazioni metti **SI**
alla voce *Foto visibili a chi ha il link* (così chi ha il link può vedere le foto
di quel mese, in sola lettura).

**Una fattura è finita in "Errori"**
Il report e il messaggio di importazione dicono il motivo. Prova a riscaricare il
file dal portale e a rimetterlo in *Da importare*. Se una fattura è stata comunque
letta, non verrà duplicata.

**Il report non arriva**
Nell'editor, icona **Esecuzioni** (a sinistra) per vedere eventuali errori.
Controlla le email nella scheda Impostazioni e che l'attivatore esista (icona sveglia).
Google invia anche un'email all'account del bar se un'esecuzione automatica fallisce.

**«⏳ In attesa di invio» non sparisce**
Controlla il Wi-Fi e tocca **Invia ora**. Se una voce è «da controllare», tocca **Vedi**:
c'è scritto il motivo (es. una chiusura già presente per quel giorno: scegli se sostituirla).

**WhatsApp non si apre con il numero del fornitore**
Scrivi il numero nella scheda **Fornitori**, colonna **Telefono WhatsApp** (es. `333 1234567`,
oppure con il prefisso estero `+41 …`). Senza numero WhatsApp fa scegliere il contatto.

**Recuperare un backup**
Su Google Drive apri la cartella **Bar - Backup**: ogni file è una copia completa del
foglio (le ultime 8 settimane). Puoi aprirla e copiare le righe che servono. Non usare la
copia come foglio "vero": l'app resta collegata al foglio originale.

**Cosa vuol dire un'email «Bar – ERRORE in …»?**
Un'operazione automatica non è andata a buon fine. La scheda **Registro errori** e,
nell'editor, l'icona **Esecuzioni** dicono il motivo. Spesso basta rieseguire la funzione
dal menu **Bar**.

**Le foto risultano girate su un iPad vecchio**
L'app corregge da sola l'orientamento sui browser che non lo fanno; se capita
ancora, scatta la foto tenendo il dispositivo in verticale.

---

## 14. Prove sul computer (per chi modifica il codice)

Nella cartella `prove/` c'è un **Apps Script finto** che fa girare il codice sul computer,
con un foglio in memoria (non tocca il foglio vero). Dopo `npm install`:

| Comando | Cosa fa |
|---|---|
| `npm test` | controllo che la pagina sia JavaScript ES5 e CSS adatti ai vecchi iPad, tutte le funzioni `test…()` dei file `Test*.gs` e le prove di tutte le funzioni (anche nel browser: coda offline, modifica, ricerca del fornitore, scadenze, scadenze delle spese, ordini, quadratura, HACCP, fornitori, scadenze fisse, movimenti, margini, sezioni del Riepilogo, spese coperte dai ricavi, navigazione con la barra in basso) |
| `npm run server-finto` | apre l'app su <http://localhost:8080> con dati inventati (PIN `1234`) |
| `npm run screenshot` | foto di tutte le schermate a 320, 412 e 1024 pixel in `prove/screenshot/` e controllo automatico: nessun testo esce da pulsanti e riquadri, pulsanti alti almeno 52px, testo di almeno 17px |

Le prove nel browser usano Chromium tramite Playwright (se manca: `npm install -g playwright`
e `npx playwright install chromium`; in alternativa installalo in un'altra cartella e avvia le prove
con `NODE_PATH=<cartella>/node_modules npm test`).

L'Apps Script finto sa anche leggere i modelli HTML (`HtmlService.createTemplateFromFile`): il
"PDF" del registro HACCP nelle prove è l'HTML con davanti l'intestazione di un PDF.

---

### Privacy e sicurezza

- Tutti i dati restano nel Google Drive dell'account del bar.
- Il repository GitHub **non** contiene email, PIN o ID: stanno solo nella scheda
  Impostazioni (il file `.gitignore` esclude anche file di configurazione ed esportazioni).
- Le fatture di esempio nella cartella `esempi/` sono **inventate**.
