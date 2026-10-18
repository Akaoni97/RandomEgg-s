# Prompt di design · Virtual-Italy

Il documento di partenza del progetto. La prima versione (MVP, sezione 8) è quella realizzata in
questa cartella; le versioni 2 e 3 sono il piano per dopo.

```
RUOLO
Sei un team di sviluppo senior (game designer, full-stack developer, pixel/illustration
artist) e devi realizzare "Virtual-Italy", un paese digitale che cresce con le persone reali
che ci vanno ad abitare. Il paese ha un giornale ufficiale: una pagina Instagram
("Virtual-Italy IG") che racconta la vita della città e porta nuovi abitanti tramite il link
in bio.

VISIONE
Non è un social network: è un luogo. L'emozione chiave è "ho una casa in un posto che
stiamo costruendo insieme". La città parte VUOTA: una piazza, una strada principale, un
cartello di benvenuto. Ogni nuova casa è un evento visibile e celebrato. Chi entra presto
deve sentirsi un fondatore.

1. ACCESSO E ISCRIZIONE
- Ingresso dal link nella bio di Virtual-Italy IG → pagina di benvenuto con mappa animata
  della città, contatore "Abitanti: N" e pulsante "Vieni ad abitare qui".
- Iscrizione con EMAIL + NOME UTENTE (+ password, oppure accesso con link magico via email).
  - Nome utente: unico, 3–20 caratteri, lettere/numeri/punto/trattino basso, senza
    distinzione tra maiuscole e minuscole, filtrato contro parole offensive e nomi
    riservati (admin, sindaco, giornale…).
  - Email: unica, confermata con un link di verifica prima che la casa venga costruita.
  - Spunte obbligatorie: accettazione regolamento e informativa privacy; dichiarazione
    di avere almeno 14 anni.
  - Protezione anti-bot: limite di iscrizioni per IP e captcha leggero.
- Finché l'email non è confermata l'utente può scegliere lo slot (prenotato per 24 h), ma
  la casa appare come "cantiere".
- Un account = un abitante = una casa.
- Tracciare la provenienza (es. ?da=instagram, ?da=storia, ?invito=CODICE) per sapere
  quali post del giornale portano più abitanti.
- Profilo abitante: nome utente, numero di abitante ("Abitante n°37"), data di arrivo,
  casa, amici, una breve frase di presentazione. Campo FACOLTATIVO "Il mio Instagram"
  (link al profilo, mostrato solo se l'utente lo vuole).
- Recupero password, cambio email e cancellazione account dalle impostazioni.

2. MAPPA, SLOT E CASE
- Mappa a griglia (tile), vista dall'alto leggermente isometrica, navigabile con
  trascinamento e zoom, fluida su telefono (mobile first: quasi tutti arrivano da
  Instagram).
- La città è divisa in QUARTIERI. All'inizio è aperto solo il Quartiere 1 lungo la strada
  principale. Un nuovo quartiere si sblocca quando quello attuale è pieno al ~80%, e il
  giornale lo annuncia.
- Gli slot liberi sono lotti evidenziati: toccandone uno si vedono i vicini attuali e si
  conferma la scelta.
- Dopo la scelta si genera la casa: stile casuale ma coerente con il quartiere, più
  personalizzazione base (colore del tetto, porta, giardino, un oggetto davanti casa).
- Animazione di costruzione (impalcature → casa finita) e annuncio in città:
  "Benvenuto/a [nome utente], nuovo abitante n°N!".

3. STRADE (requisito chiave)
- Esiste una STRADA PRINCIPALE fissa. Il piano regolatore contiene anche le FUTURE strade
  principali (dorsali dei quartieri futuri), visibili come tracciati tratteggiati.
- Ogni nuova casa viene collegata AUTOMATICAMENTE alla rete stradale: percorso più breve
  (A* sulla griglia) dall'ingresso della casa alla strada esistente più vicina (principale,
  dorsale o vialetto già esistente), evitando gli altri lotti.
- Riusare i tratti esistenti: case vicine condividono lo stesso vialetto invece di crearne
  due paralleli.
- Gerarchia visiva: strada principale > strade di quartiere > vialetti. Incroci disegnati
  automaticamente (autotiling).
- Quando una futura strada principale si attiva con lo sblocco di un quartiere, le case
  vicine si ricollegano a quella se il percorso è più breve.
- Gli slot sono progettati in anticipo nel piano regolatore, così nessuna casa resta mai
  isolata: ogni slot ha un percorso garantito verso una strada.
- Nomi delle vie: ogni via prende il nome scelto dal suo primo abitante (tra proposte
  approvate) o votato dai residenti.

4. AMICIZIE E VICINATO
- Dalla casa di un altro abitante: "Bussa alla porta" = richiesta di amicizia.
- Accetta/rifiuta dalla cassetta delle lettere della propria casa; notifica anche via
  email (disattivabile).
- Lista amici; sulla mappa le case degli amici hanno una bandierina.
- "Invita un vicino": ogni abitante ha un link personale; chi si iscrive da quel link può
  scegliere uno slot accanto a chi lo ha invitato, e i due diventano subito amici.
- Blocco e segnalazione sempre disponibili; limite di richieste al giorno contro lo spam.

5. IL GIORNALE (ponte con Instagram)
- Ogni evento della città genera una "notizia": nuovo abitante, quartiere sbloccato,
  traguardi (10, 25, 50, 100 abitanti), nuova via, nuova opera pubblica.
- Pannello admin "Redazione": elenco delle notizie con immagine già pronta da pubblicare
  (1080×1350 per i post, 1080×1920 per le storie) con lo screenshot della zona interessata
  e un testo suggerito.
- Rubrica "Abitante della settimana": l'admin sceglie un abitante e il sistema prepara la
  card con la sua casa.
- Timelapse mensile: video/GIF della città che cresce, pronto per un Reel.
- Pagina pubblica /giornale dentro la città con l'archivio delle notizie.

6. VITA DELLA CITTÀ
- Fondatori: i primi 100 abitanti hanno una targa sulla casa e il nome sul "Muro dei
  Fondatori" in piazza.
- Traguardi collettivi: a 25 abitanti la fontana, a 50 il bar, a 100 la stazione (e così
  via). Barra di avanzamento visibile in piazza: "Mancano 7 abitanti alla fontana!".
- Finestre accese: di sera la città entra in modalità notturna e le case degli abitanti
  online hanno le luci accese.
- Bacheca della piazza: messaggi brevi (max 200 caratteri), filtrati e segnalabili.
- Stagioni ed eventi: neve d'inverno, luminarie a Natale, sagra estiva con decorazioni
  sbloccabili.
- Il sindaco: ogni 3 mesi elezioni tra gli abitanti; il sindaco sceglie il nome del
  prossimo quartiere o la prossima opera pubblica tra opzioni predefinite.
- Case addormentate: dopo 6 mesi di inattività la casa mostra l'erba alta ma non viene
  tolta; torna normale al rientro dell'abitante. Se l'account viene cancellato la casa
  diventa "in vendita" e lo slot torna libero.

7. TECNOLOGIA
- Frontend: web app (PWA) installabile, mappa disegnata su Canvas o PixiJS.
- Backend: Node.js + database (SQLite all'inizio, Postgres per crescere); aggiornamenti in
  tempo reale via WebSocket (chi è online vede le case nuove apparire dal vivo).
- Invio email (conferma, recupero password, notifiche) tramite un servizio SMTP/
  transazionale.
- Sicurezza: password con hash (scrypt/argon2), cookie di sessione HttpOnly + SameSite,
  protezione CSRF, limite tentativi di accesso.
- Dati principali: Abitante, Casa, Slot, Quartiere, TrattoStrada, Via, Amicizia, Invito,
  Notizia, MessaggioBacheca, Traguardo.
- La generazione delle strade avviene sul server (unica fonte di verità), il client si
  limita a disegnarle.
- Privacy (GDPR): informativa chiara, età minima 14 anni, email mai mostrata
  pubblicamente, esportazione e cancellazione dei propri dati.
- Moderazione: filtro parole su nomi utente, frasi e bacheca; pannello admin per
  segnalazioni, sospensioni e rinomina forzata.

8. ORDINE DI SVILUPPO
MVP (versione 1):
1. Mappa con strada principale, Quartiere 1, slot liberi.
2. Iscrizione con email + nome utente, conferma email, accesso e recupero password.
3. Scelta dello slot, generazione della casa e collegamento automatico alla strada.
4. Profilo abitante e richieste di amicizia.
5. Feed degli eventi, pagina del giornale e immagini esportabili per Instagram.
6. Fondatori e primo traguardo collettivo (la fontana).
Versione 2: link "Invita un vicino", finestre accese, bacheca, nomi delle vie, sblocco
quartieri, timelapse.
Versione 3: sindaco ed elezioni, stagioni ed eventi, case addormentate, abitante della
settimana.

CRITERI DI ACCETTAZIONE
- Con 0 abitanti la città è vuota ma bella e invitante.
- Un nuovo utente arriva dal link in bio, si iscrive e ha la sua casa in meno di 2 minuti
  dal telefono.
- Non è possibile creare due account con la stessa email o lo stesso nome utente.
- Inserendo 50 abitanti di prova in slot casuali, ogni casa è collegata alla rete
  stradale e nessuna strada passa sopra un lotto.
- Due utenti su due telefoni diversi vedono apparire la stessa nuova casa in meno di 2
  secondi.
- Tutto in italiano, leggibile su schermo da 360 px di larghezza.

STILE
Accogliente, un po' fiabesco, colori caldi: tra un paese italiano e un videogioco cozy
(Animal Crossing / Townscaper). Il nome utente compare su un cartellino davanti a ogni
casa.
```

## Scelte fatte nella prima versione

- **Accesso con password** (non con link magico): più semplice da capire per chi arriva da Instagram, con "password dimenticata" via email.
- **Tempo reale con Server-Sent Events** invece di WebSocket: la città manda solo aggiornamenti dal server ai telefoni, e così basta Node.js senza librerie. La prova misura circa 40 ms tra due browser.
- **Finestre accese di sera** e **apertura automatica dei quartieri**, previste per la versione 2, sono già incluse perché costavano poco.
- **Captcha leggero** = campo nascosto + tempo minimo di compilazione, senza servizi esterni.
- **Rinomina forzata** e **cambio email** non ci sono ancora: per ora la redazione può sospendere.
