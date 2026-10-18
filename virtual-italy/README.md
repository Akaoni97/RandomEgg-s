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
npm test             # 16 prove: regole della città + server (iscrizione, email, permessi, tempo reale)
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

- **Mappa** a tutto schermo con trascinamento, pizzico e zoom. Il centro ha la piazza con l'edicola del giornale, il Muro dei Fondatori e la fontana, che arriva a 25 abitanti.
- **Iscrizione** con email, nome utente e password, conferma via email entro 24 ore, accesso con email o nome utente, password dimenticata.
- **Anti-bot**: campo nascosto, tempo minimo di compilazione, limiti per IP. Filtro su nomi e frasi offensive, nomi riservati (sindaco, redazione…).
- **Lotti e case**: si sceglie lo slot, si personalizzano tetto, porta, giardino e oggetto davanti casa. Forma e muri seguono lo stile del quartiere. Senza email confermata la casa resta un cantiere, e il lotto si libera dopo 24 ore.
- **Strade automatiche**: ogni casa viene collegata alla rete con il percorso più breve, riusando i vialetti già esistenti. Le future strade principali sono tratteggiate e si attivano con il loro quartiere, e allora le case vicine si ricollegano.
- **Cinque quartieri** (Centro, Borgo Est, Borgo Ovest, Collina Nord, Marina Sud, 924 lotti in tutto). Il successivo si apre quando quelli aperti sono pieni all'80%.
- **Amicizie**: "Bussa alla porta", cassetta delle lettere, bandierina sulle case degli amici, massimo 20 richieste al giorno, segnalazioni.
- **Giornale**: notizie automatiche (nuovi abitanti, traguardi, quartieri). La redazione genera le immagini per Instagram, post 1080×1350 e storia 1080×1920.
- **Redazione**: provenienza degli iscritti, segnalazioni con sospensione, posta in uscita.
- **Tempo reale**: le case nuove compaiono subito su tutti i telefoni (Server-Sent Events). Di sera le finestre di chi è online sono accese.
- **Privacy**: l'email non è mai pubblica, si possono scaricare i propri dati e cancellare l'account (il lotto torna libero).

## Struttura

```
public/js/core.js    regole: piano regolatore, strade, lotti, abitanti, amicizie, notizie (browser e server)
public/js/render.js  disegno su canvas: terreno, strade, case, notte, cartoline per Instagram
public/js/store.js   collegamento al server (RemoteStore) e demo nel browser (LocalStore)
public/js/app.js     interfaccia
public/js/seed.js    abitanti dimostrativi
server/server.js     HTTP + SQLite + account + email + tempo reale, nessuna dipendenza
test/                prove delle regole e del server
```

## Prima di andare online

1. Un dominio con HTTPS e `COOKIE_SECURE=1`, `BASE_URL` e `TRUST_PROXY=1` se serve.
2. Un account Resend con il dominio verificato (`RESEND_API_KEY`, `MAIL_FROM`).
3. Completare l'informativa privacy con i dati del titolare (il testo nell'app è una sintesi).
4. Backup automatico di `DATA_DIR/virtual-italy.db`.
5. Un processo sempre attivo (systemd, Docker o un servizio come Render o Railway con un disco persistente).
