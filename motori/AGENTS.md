# Night Run · guida per gli assistenti (Kimi, Claude e altri)

Gioco di guida notturna nel browser, in italiano, fatto per due persone (il proprietario del repository e suo
cognato). Si gioca da GitHub Pages: https://akaoni97.github.io/RandomEgg-s/ (la radice rimanda a `motori/`).
Il resto del repository (server/, public/, dist/, scripts/) è un altro progetto: **non toccarlo**.

## Com'è fatto
HTML + JavaScript puro: niente build, niente npm, niente framework. Solo three.js 0.147 da CDN per la vista 3D.
`index.html` carica gli script in quest'ordine, e le costanti globali di un file si usano dagli altri
(per esempio `CARS`, `CLUSTERS`, `GAME_LANE_Z`, `GAME_LOCS`):

| File | Cosa contiene |
| --- | --- |
| `dsp.js` | Motore audio sintetizzato (classe `EngineDSP`, gira in un AudioWorklet): cilindri, collettori, scarico, turbo, valvola, aspirazione, carattere per auto (`voice`). |
| `sim.js` | Fisica (classe `SupraSim`, passo 1/4000 s): motore, turbo, frizione, cambio, gomme Pacejka, differenziale, beccheggio, wheel hop, TRC, ABS, tipi di limitatore. |
| `tuning.js` | Catalogo pezzi della Supra, reparto Limitatore comune (`LIMITER_CAT`, `applyLimiter`), `tuningParams()`. |
| `cars.js` | Tutte le auto. V40 col suo catalogo; le auto da disegno con il costruttore comune `GEN_CARS` + `GEN_DATA` + `genCar()`. Quadri strumenti in `CLUSTERS`. |
| `samples.js` | Lettore di campioni audio caricati dall'utente (solo Supra). |
| `car3d.js`, `street3d.js` | Vista 3D. |
| `street2d.js` | Tutta la grafica 2D in pixel art (classe `Street2D`), sfondi dei luoghi (`drawScenery`, `drawNearSide`), traffico, radar delle corsie. |
| `intro.js` | Sigla in 2D. |
| `radio.js` | Radio. |
| `game.js` | Carriera (`StreetGame`): soldi, km, luoghi del mondo (`GAME_LOCS`), traffico (`GAME_TRAFFIC`), negozi e officine, polizia, gare. |
| `index.html` | Interfaccia, quadro strumenti, impostazioni, mappa del mondo, ciclo principale (molto grande). |
| `img/` | Disegni delle auto: `<id>.png`, `<id>_wheel.png`, `<id>_paint.png`; `img/stickers/manifest.json`. |
| `audio/`, `models/` | Suoni e modelli 3D liberi già nel progetto. |

Convenzioni della grafica 2D: canvas logico alto 360 px, strada tra y 236 e 336, 30 px per metro (`PPM`),
`Street2D.rnd(n)` per il caso deterministico (niente `Math.random` per ciò che deve restare fermo), testi a pixel
solo in maiuscolo ASCII (`PX_FONT`). Le auto guardano a destra.

Per aggiungere un'auto: voce in `GEN_CARS` (motore, cambio, turbo, `voice`, `shiftK`, `hesK`), sprite e coppia in
`GEN_DATA`, immagini in `img/`, voce in `CLUSTERS`.

## Regole
1. Lavora su un ramo tuo (es. `kimi/lavoro`, `kimi/revisione`). Mai su `claude/peaceful-goodall-tvifol`: è il
   ramo di Claude ed è quello pubblicato su GitHub Pages. Niente pull request se non richieste.
2. Commenti, testi del gioco e messaggi di commit in italiano, nello stile del codice esistente.
3. Nel repository niente file presi da mod di giochi o senza licenza (suoni, modelli, immagini): l'utente li carica
   in locale nel browser (IndexedDB). Niente copie di grafica, nomi o personaggi di giochi esistenti.
4. Modifiche mirate: non riscrivere file interi senza motivo, non cambiare ciò che funziona se non è richiesto.
   Parametri nuovi del suono e della fisica con valori di default che lasciano Supra e V40 come sono.
5. Modificando un file con uno script: leggi tutto, cambia in memoria, scrivi una volta sola (una scrittura a metà
   ha già troncato dei file).
6. Prima di cambiare qualcosa leggi per intero i file coinvolti: un'auto o un pezzo passano da più file.

## Come provare
- Test automatici (dalla radice del repository, Node 22+): `node --test test/motori.test.js`.
  Oggi passano 24 test su 26. I 2 che falliscono erano già rotti prima:
  "prestazioni realistiche della configurazione originale" (lo 0-100 della prova è 6,28 s, il test vuole meno di 6)
  e "officina: si compra solo con i soldi sufficienti". Non peggiorare il conteggio.
- Nel browser: dalla cartella `motori/` lancia `python3 -m http.server 8765` e apri
  http://localhost:8765/index.html. Comandi: I quadro, Invio avviamento, W gas, S freno, E/Q marce, A/D corsie,
  T mappa del mondo, J strumenti, L launch, Z schermo intero. Controlla che la console non abbia errori.
- Alla fine scrivi un riassunto breve: cosa hai cambiato e dove, cosa hai provato, cosa non hai potuto provare.
