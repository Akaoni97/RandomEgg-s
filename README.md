# Magazzino Ferroleghe · versione Claude

Ricostruzione di “MPR Logistics · Magazzino” con la **stessa logica operativa** e una grafica nuova:
baie, mucchi e tettoia; lotti separati; arrivi aggregati *N container in X giorni*; carico, scarico,
appunti, ordini, calendario, storico. Tutto in italiano, usabile da PC e da telefono.

Tutti i dati sono **dimostrativi e inventati** (lotti `DEMO-…`).

## Avvio rapido

Serve **Node.js 22.5 o successivo**. Il progetto non ha dipendenze da installare.

```bash
npm start            # server reale con archivio vuoto  → http://localhost:8080
npm run demo         # server reale precaricato con i dati DEMO
npm test             # 24 prove: casi del pacchetto + server (accessi, conflitti, idempotenza)
npm run build:artifact   # genera dist/magazzino-ferroleghe.html (demo in un solo file)
```

Al primo avvio la console stampa un **codice di configurazione**: apri il sito, inseriscilo e crea
l'amministratore. Gli altri utenti entrano solo con un **invito** (Impostazioni → Utenti e accessi).

Variabili utili: `PORT`, `HOST`, `DATA_DIR` (dove sta `magazzino.db`), `SETUP_CODE`,
`COOKIE_SECURE=1` (obbligatorio dietro HTTPS), `DEMO_DATA=1`.

## Tre livelli, distinti

| | Che cos'è | Condiviso fra dispositivi | Sicurezza |
|---|---|---|---|
| **Demo in un file** (`dist/…html`, o `public/index.html?demo`) | Prototipo con archivio nel browser | **No.** Due schede dello stesso browser simulano due dispositivi | Nessuna: profili senza password, dichiarato a schermo |
| **Server incluso** (`server/server.js`) | Backend reale: SQLite, sessioni, inviti, ruoli | **Sì**, fonte unica per PC e telefono | Password scrypt, cookie HttpOnly+SameSite, protezione CSRF, limite tentativi |
| **Da configurare fuori** | HTTPS, dominio, backup periodico del file `data/magazzino.db`, processo sempre attivo (systemd, Docker, PaaS) | — | Certificato TLS e `COOKIE_SECURE=1` |

## Struttura

```
public/js/core.js     regole del magazzino (unica fonte, usata da browser e server)
public/js/seed.js     dati DEMO generati facendo passare operazioni vere dal motore
public/js/store.js    archivio locale (demo) e remoto (server) con la stessa interfaccia
public/js/views.js    pagine     public/js/dialogs.js  moduli     public/js/app.js  guscio
public/js/art.js      illustrazioni SVG: mezzi, pallet, big bag, mucchi, scena del piazzale
public/styles.css     sistema visivo (giallo sicurezza, antracite, cemento; temi chiaro, notte, Cobalto, Pieno sole)
server/server.js      HTTP + SQLite + account, nessuna dipendenza esterna
test/                 casi di prova del pacchetto e prova d'integrazione del server
```

## Regole mantenute (dal brief e dal sito di riferimento)

- 73 posizioni con nomi stabili: Baie 1–17, 19, 20 · Mucchio 18 e 21–60 · Baie A–L · Tettoia.
  “18” apre il Mucchio 18; “Baia 18” dà un errore che suggerisce il Mucchio 18.
- La ricerca è la pagina iniziale. Scheda posizione: aggiunta materiale, appunti importanti **sopra**
  la giacenza, un riquadro per lotto, “Presente ora / Ancora in arrivo / Spazio libero ora”, barra
  con presente pieno e previsto tratteggiato, “A fine arrivi”, avviso di superamento capienza.
- Capienza baie 1.080,30 t come **parametro provvisorio**; mucchi e tettoia “Capienza non impostata”.
- Lotti mai fusi in automatico. Scarico limitato al disponibile; “Scarica tutto” toglie il lotto
  dalla ricerca e lascia il movimento nello storico.
- Piano di arrivo aggregato: `floor(N × min(X, giorni trascorsi) / X)`, giorno iniziale = 0,
  resto nell'ultimo giorno, fuso Europe/Rome, riconciliazione all'apertura e ogni 30 secondi.
- **Le stime automatiche incrementano la giacenza** e scrivono “Sistema · stima automatica”, come il
  sito attuale. Sono riconoscibili ovunque (righe tratteggiate, etichetta “Include stime”).
- Ricevuto cumulativo indipendente dalla giacenza: uno scarico non viene mai ricreato dal piano.
- Ricevi oggi (container + tonnellate), Ricevi tutto oggi, Modifica piano, Pausa, Annulla arrivo:
  tutto anche da telefono. Annullare toglie solo il futuro; gli ultimi container chiudono il residuo.
- Completare un ordine **non** scarica materiale.
- Un operatore elimina solo i propri appunti; l'amministratore gestisce quelli senza autore.
- Autore di ogni modifica preso dalla sessione sul server, mai da un campo del browser.
- Revisione per elemento: chi salva su una versione vecchia riceve un conflitto e i dati ricaricati.
- Backup JSON completo (senza credenziali), import con anteprima e copia di sicurezza prima.
- Aggiornamento mirato da JSON: solo lotti esistenti nei mucchi indicati; con più lotti serve `lot`.

## Aggiunte di questa versione (segnalate anche nell'interfaccia)

- **Trasferisci**: spostamento parziale o totale fra posizioni, con origine e destinazione nei
  movimenti; il totale del magazzino resta invariato.
- **Conferma arrivati**: segna le stime come consegne reali senza cambiare le quantità.
- **Modalità “solo conferma”** (Impostazioni, proposta): il piano mostra il previsto e chiede di
  confermarlo, senza incrementare da solo. Il valore predefinito resta quello del sito attuale.
- **Ripresa dalla pausa** con scelta: recuperare secondo la formula originale o spostare il calendario.
- **Operazioni idempotenti**: ogni salvataggio ha un identificativo; ripeterlo dopo un errore di rete
  non duplica l'effetto (“Riprova” nel messaggio d'errore).
- **Palette comandi** (Ctrl/⌘+K o “/”): posizioni, lotti, pagine e azioni da tastiera.
- **Schema del piazzale** accanto alla ricerca, dichiaratamente dimostrativo (non è la piantina reale).
- Stime automatiche lato server **anche a sito chiuso**, finché il processo è acceso.
- **Mezzi del piazzale**: pala gommata 10 t, Merlo 4 t, Muletto 1 e 2 da 3 t, con stato (Disponibile,
  In uso, Manutenzione, Fermo) e nota. Si possono assegnare agli ordini; nello scarico e nel trasferimento
  il modulo stima quanti viaggi servono con ciascun mezzo. Nome e portata li cambia l'amministratore.
- **Piazzale animato**: nella ricerca e nell'accesso i mezzi si muovono secondo il loro stato (in
  manutenzione restano parcheggiati con il cono). Cartello della posizione appeso che oscilla, muletto che
  spinge la barra di occupazione, lotti disegnati come mucchi o big bag su pallet, camion nel giorno
  corrente del piano. Tutto si ferma con “Riduci le animazioni” o con la preferenza di sistema.
- Strumenti demo: data simulata (±1 giorno), archivio irraggiungibile, conflitto simulato.

## Casi di prova verificati

`npm test` copre: ricerca 18/49/A/Tettoia; due lotti in baia; svuotamento con appunto e storico;
scarico eccessivo; piano 10/5 con giorno iniziale e due giorni (4 container, 108 t, residuo 162 t);
la sequenza centrale completa fino allo scarico finale; annullo parziale; pausa; resto 7/3 → 2, 2, 3;
ricevi tutto; limiti di Ricevi oggi; modifica piano; ordine completato; trasferimento; conflitto;
idempotenza; aggiornamento mirato e import ambiguo; permessi sugli appunti; server con invito,
CSRF, conflitto fra due utenti, ripetizione di un'operazione e permessi amministrativi.

## Decisioni ancora da chiarire con Luca

- Significato esatto degli ID esterni (codice materiale ≠ numero lotto, qui tenuti separati).
- Calendario lavorativo o giorni consecutivi per i piani (oggi: consecutivi).
- Capienze fisiche reali e geometria della mappa del piazzale.
- Permessi distinti fra Magazzino e Ufficio (oggi: stesse azioni quotidiane, amministrazione a parte).
- Regole di annullo dopo movimenti successivi; gestione di miscele e unità diverse dalle tonnellate.
- Se adottare la modalità “solo conferma” al posto della stima automatica.
