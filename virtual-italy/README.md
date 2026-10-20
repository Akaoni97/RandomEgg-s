# Virtual-Italy

Il paese digitale che cresce con chi ci abita. La porta d'ingresso è il link nella bio di
**Virtual-Italy IG**, il giornale della città su Instagram. Chi entra si iscrive con email e nome
utente, sceglie un lotto libero e ci costruisce la sua casa, che viene collegata da sola alla
strada. Poi può bussare alla porta dei vicini per fare amicizia.

Questa è la **prima versione (MVP)** descritta in [`PROMPT.md`](PROMPT.md).

## Avvio rapido

Serve **Node.js 22.5 o successivo**. Non ci sono dipendenze da installare.

```bash
npm start            # città vera, vuota                        → http://localhost:8080
npm run dev          # come sopra, con i link delle email in console e redazione@example.com come redazione
npm run demo         # città già abitata da 18 abitanti finti (archivio separato in data-demo/)
npm test             # 29 prove: regole della città + server (iscrizione, email, permessi, omini, negozi, missioni, tempo reale)
npm run build:demo   # genera dist/virtual-italy-demo.html: demo in un solo file, senza server
```

### Variabili d'ambiente

| Variabile | A cosa serve |
|---|---|
| `PORT`, `HOST` | Dove ascolta il server (predefiniti `8080`, `0.0.0.0`). |
| `BASE_URL` | Indirizzo pubblico del sito, usato nei link delle email (es. `https://virtual-italy.it`). |
| `DATA_DIR` | Cartella dell'archivio `virtual-italy.db` (predefinita `data/`). Va salvata con backup periodici. |
| `ADMIN_EMAILS` | Email della redazione, separate da virgola: chi si iscrive con una di queste vede la Redazione. |
| `RESEND_API_KEY`, `MAIL_FROM` | Invio vero delle email con [Resend](https://resend.com). Senza chiave le email restano nella "posta in uscita" (console e Redazione). |
| `COOKIE_SECURE=1` | Obbligatorio quando il sito è in HTTPS. |
| `TRUST_PROXY=1` | Se il server sta dietro un proxy (Nginx, Render, Railway…), per leggere l'IP vero dei limiti anti-abuso. |
| `REGISTER_PER_HOUR` | Iscrizioni massime all'ora per IP (predefinito 30). |
| `DEV_MAIL=1` | Solo sviluppo: restituisce i link delle email anche nella risposta del server. |

## Il link in bio

Metti nella bio un link con la provenienza, ad esempio `https://tuosito.it/?da=bio`, e nelle storie
`?da=storia`. La Redazione mostra quanti iscritti (e quanti confermati) arrivano da ciascun link.

## Cosa c'è in questa versione

- **Città in 3D** che si gira: due dita (o i tasti ↺ ↻) ruotano la veduta, così niente resta nascosto dietro le case. Terreno, strade, piazza e campi portano la pixel art di sempre come texture; case e negozi sono solidi con le facciate dipinte in pixel (persiane, fiori alle finestre, buganvillee), tetti a coppi, ombre vere e luce calda; di notte si accendono finestre, vetrine e lampioni. Il terreno è a gradoni con muretti e rampe che seguono anche auto e bici; un canale con il ponte e un cigno scende fino al mare. Senza WebGL si torna alla vista piatta di tre quarti. Gli interni delle case restano stanze isometriche come in Habbo.
- **Terza persona:** col tasto 🚶 accanto allo zoom la camera scende alle spalle del proprio omino. Un joystick a sinistra lo fa camminare (o pedalare) per le strade, trascinando lo schermo ci si gira, e il tasto a destra cambia secondo quello che hai vicino: Saluta, Entra al bar, Entra in Municipio, Entra in casa, Siediti, Leggi il giornale, Guarda questo lotto. "Parla" apre gesti e chat, "Vista dall'alto" torna alla città intera. Al computer: WASD o frecce per muoversi, E, Spazio o Invio per l'azione.
- **Piano della città con respiro:** vie in sampietrini ogni 5 caselle, collegate alla strada principale e alle dorsali dei quartieri; in ogni isolato due lotti affacciati sulla via a sud, separati da un giardino, con il cortile alberato dietro. La **piazza** è grande (9×9): lastre di pietra con cornice in cotto, fontana al centro (l'acqua arriva a 25 abitanti), campanile, edicola del giornale, Muro dei Fondatori, panchine, lampioni e i tavolini del bar con gli ombrelloni.
- **Traffico e passanti:** utilitarie, berline, furgoni, Ape e autobus girano sulla corsia di destra di statale, vie del Centro e dorsali, coperti da case e alberi che stanno davanti. Qualche passante passeggia, si siede in piazza e saluta, così la città è viva anche con pochi abitanti.
- **Ciclofficina Ruota Libera:** a piedi si va a passo d'uomo; skateboard, bicicletta e monopattino elettrico fanno girare la città più svelti. Si sale e si scende dal pannello dei gesti.
- **Dentro casa, come in Habbo:** ogni casa ha una stanza 8×8 da arredare (mobili ruotabili, alcuni con il colore a scelta), cinque pavimenti e otto colori di pareti. Il padrone decide chi può entrare (tutti, solo amici, solo lui), e gli ospiti si vedono e parlano in tempo reale. Con la casa arriva un kit di benvenuto (letto, sedia, tavolino, lampada, pianta); in casa si sistema solo quello che si ha nell'inventario, e ciò che si toglie torna lì.
- **Negozi veri in città:** ai lati della piazza, con vetrina e insegna sulla strada principale, ci sono il **Mobilificio Bottega** (25 tra mobili e decorazioni, esposti in negozio) e la **Sartoria Moda** (maglie, gonne, pantaloncini, cappelli e accessori, con i manichini da provare). Si entra con il proprio omino, si tocca la merce e la si prende. Ogni articolo ha il suo prezzo in soldi (`price` in `core.js`).
- **Il Soldo, la moneta della città:** si chiama come l'antica moneta italiana da cui viene la parola "soldi" (moneta d'oro con la S e la stella d'Italia). Ognuno ha il suo borsellino, in alto, visibile solo a lui. Il Comune regala 150 soldi all'iscrizione all'anagrafe; la missione del giorno ne dà 20 (fino a 70 con tanti giorni di fila), le missioni di benvenuto 100, la Casa della settimana 200. Si spendono al Mobilificio, alla Sartoria e alla Ciclofficina. Le cifre stanno in `INCOME` in `core.js`.
- **Lavori: il Bar Centrale.** Di fronte alla piazza, dall'altra parte della strada principale, c'è il bar di Franco. Si fa un turno da barista di 60 secondi: arrivano gli abitanti veri (con il loro ritratto 3D) a ordinare espresso, cappuccino, cornetto, spremuta, tramezzino o acqua, e bisogna comporre il vassoio prima che perdano la pazienza. Si guadagnano 3 soldi per ogni cosa servita, fino a 80 a turno, con 3 turni al giorno. Più clienti servi, più sali di livello (Apprendista → Barista → Maestro del caffè) e la paga cresce del 20% e del 40%. Il gioco gira sul telefono; il server paga solo risultati credibili (turno di almeno 20 secondi, non più di un ordine ogni 2,5 secondi). Tutto in `JOBS` in `core.js`.

- **Missioni:** sette missioni di benvenuto che accompagnano il nuovo abitante (omino, casa, mobili, Sartoria, panchina in piazza, visita a un vicino, giornale), con la Targa di benvenuto come premio. Poi una missione del giorno, uguale per tutti, con la serie di giorni di fila 🔥.
- **Gesti e sedute:** l'omino saluta, balla, salta e manda faccine; si siede sulle panchine della piazza e su sedie, poltrone, divani e pouf. Tutti lo vedono in tempo reale.
- **Libro degli ospiti e cuori:** chi visita una casa firma il libro (una volta al giorno) e lascia un ❤️ (uno a settimana). Il giornale tiene la classifica della settimana e il lunedì annuncia la **Casa della settimana**, con la cartolina pronta per Instagram.
- **Abitanti in 3D:** omini low-poly nello stesso stile della città, con la faccia ben leggibile (occhi con la luce, sopracciglia, guance, bocca), che camminano, salutano, ballano, saltano, si siedono e vanno in bici, skate o monopattino. Da fermi si girano verso chi guarda; il proprio omino si intravede anche dietro le case. Nelle stanze e nelle anteprime si usa lo stesso modello. Si parla con la barra in basso e i messaggi compaiono a tutti in tempo reale.
- **Editor del personaggio:** uomo o donna, carnagione, occhi, undici pettinature, colore dei capelli, barba e baffi o rossetto, maglia o vestito, pantaloni, pantaloncini o gonna, scarpe e accessori, con un palco 3D che si gira col dito e il tasto "A caso".
- **Municipio e anagrafe:** il palazzo comunale chiude la piazza a nord, accanto al campanile, con il portico, le bandiere e il Muro dei Fondatori sotto gli archi. Chi arriva in città va prima in Municipio: allo sportello Carla lo iscrive all'anagrafe (lì si sceglie l'aspetto) e gli consegna la carta d'identità con la foto; solo dopo si sceglie il lotto. Chi aveva già casa risulta iscritto.
- **Iscrizione** con email, nome utente e password, conferma via email entro 24 ore, accesso con email o nome utente, password dimenticata.
- **Anti-bot**: campo nascosto, tempo minimo di compilazione, limiti per IP. Filtro su nomi e frasi offensive, nomi riservati (sindaco, redazione…).
- **Lotti e case**: si sceglie lo slot, si personalizzano tetto, porta, giardino e oggetto davanti casa. Forma e muri seguono lo stile del quartiere. Senza email confermata la casa resta un cantiere, e il lotto si libera dopo 24 ore.
- **Strade automatiche**: ogni casa viene collegata alla rete con il percorso più breve, riusando i vialetti già esistenti. Le future strade principali sono tratteggiate e si attivano con il loro quartiere, e allora le case vicine si ricollegano.
- **Cinque quartieri con il loro carattere**: Centro (palazzine e torrette), Borgo Est e Borgo Ovest (case a schiera e villette), Collina Nord (ville color terra), Marina Sud (case di pescatori colorate come a Burano). 365 lotti in isolati da quattro: le case stanno schiena contro schiena, così ogni via ha case su tutti e due i lati; i lotti liberi hanno il cartello "Libero". Il quartiere successivo si apre quando quelli aperti sono pieni all'80%. Le città salvate con una pianta più vecchia si sistemano da sole all'avvio (ogni casa va sul lotto libero più vicino).
- **Amicizie**: "Bussa alla porta", cassetta delle lettere, bandierina sulle case degli amici, massimo 20 richieste al giorno, segnalazioni.
- **Giornale**: notizie automatiche (nuovi abitanti, traguardi, quartieri). La redazione genera le immagini per Instagram, post 1080×1350 e storia 1080×1920.
- **Redazione**: provenienza degli iscritti, segnalazioni con sospensione, posta in uscita.
- **Tempo reale**: le case nuove compaiono subito su tutti i telefoni (Server-Sent Events). Di sera le finestre di chi è online sono accese.
- **Privacy**: l'email non è mai pubblica, si possono scaricare i propri dati e cancellare l'account (il lotto torna libero).

## Struttura

```
public/js/core.js    regole: piano regolatore, strade, lotti, abitanti, amicizie, notizie (browser e server)
public/js/avatar3d.js gli abitanti in 3D: modello, pose, immagini per stanze e anteprime, palco dell'editor
public/js/town3d.js  la città in 3D (three.js): terreno a gradoni, case, negozi, piazza, alberi, acqua, traffico, notte
public/js/town.js    la pixel art della città (texture del terreno, facciate) e la vista piatta di riserva
public/js/render.js  mappa (telecamera, tocchi, omini), stanze isometriche e mobili, cartoline per Instagram
public/js/art.js     attrezzi di disegno in comune
public/js/store.js   collegamento al server (RemoteStore) e demo nel browser (LocalStore)
public/js/app.js     interfaccia
public/js/seed.js    abitanti dimostrativi
public/vendor/       three.js r128 (licenza MIT, three.LICENSE.txt), incluso così funziona anche senza rete
server/server.js     HTTP + SQLite + account + email + tempo reale, nessuna dipendenza
test/                prove delle regole e del server
```

## Prima di andare online

1. Un dominio con HTTPS e `COOKIE_SECURE=1`, `BASE_URL` e `TRUST_PROXY=1` se serve.
2. Un account Resend con il dominio verificato (`RESEND_API_KEY`, `MAIL_FROM`).
3. Completare l'informativa privacy con i dati del titolare (il testo nell'app è una sintesi).
4. Backup automatico di `DATA_DIR/virtual-italy.db`.
5. Un processo sempre attivo (systemd, Docker o un servizio come Render o Railway con un disco persistente).
