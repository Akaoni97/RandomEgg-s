# TRIBE MACHINE · TM-1

Groovebox virtuale per PC ispirata alle Electribe EMX-1/ESX-1 e alla scena Free Tekno / Tribe.
Pannello hardware blu, display LCD arancione con menu veri, 16 step retroilluminati,
motore audio a **sintesi in tempo reale** (nessun campione) e controllo completo da tastiera.

![Pannello TM-1](docs/pannello.png)

Progetto indipendente: nessun logo o marchio Korg, nessun campione o brano di terzi.
Tutti i suoni sono generati dal codice, tutti i pattern sono originali.

---

## App desktop per Windows 11 (consigliata)

Due versioni, stesso programma:

- **`TRIBE-MACHINE-Setup-0.1.0.exe`** — installer: scegli la cartella, crea l'icona sul desktop e nel menu Start,
  si disinstalla da *Impostazioni → App*. Non servono diritti di amministratore.
- **`TRIBE-MACHINE-Portable-0.1.0.exe`** — un solo file, nessuna installazione: doppio clic e parte (anche da chiavetta USB).

Dove trovarli: su GitHub, scheda **Actions** → workflow **"TRIBE MACHINE · Windows"** → ultima esecuzione →
artifact **TRIBE-MACHINE-windows** (zip con installer, versione portatile e lo screenshot della prova di avvio).
Il workflow parte da solo a ogni modifica della cartella `tribe-machine/` e si può lanciare a mano ("Run workflow").

Al primo avvio Windows SmartScreen può mostrare *"PC protetto da Windows"*, perché l'eseguibile non è firmato
con un certificato commerciale: clicca **Ulteriori informazioni → Esegui comunque**.

Cosa cambia rispetto alla versione browser:
- finestra dedicata a pieno schermo (massimizzata all'avvio, F11 = schermo intero), nessuna barra del browser;
- l'audio parte senza restrizioni di autoplay e il sequencer non rallenta quando la finestra è in secondo piano;
- **Salva con nome** nativo per WAV e progetti, con cartella predefinita `Documenti\TRIBE MACHINE`;
- progetti, slot, campioni e mappa tasti salvati nella cartella utente dell'app (`%APPDATA%\TRIBE MACHINE`);
- permessi ridotti al minimo: solo MIDI e schermo intero (niente microfono, webcam, posizione), nessuna navigazione esterna;
- completamente offline; una sola istanza alla volta; se l'interfaccia va in crash si ricarica (il progetto è salvato in automatico).

### Compilare l'app da sé

Su Windows (PowerShell, nella cartella `tribe-machine`):

```powershell
npm install
npm run dist:win     # crea release\TRIBE-MACHINE-Setup-*.exe e release\TRIBE-MACHINE-Portable-*.exe
npm run app          # prova l'app desktop senza impacchettarla
npm run test:app     # prova automatica di avvio (finestra, audio, LED, render)
```

Da Linux la stessa build funziona con Wine installato (anche a 32 bit, per lo stub dell'installer NSIS).

Scelta tecnica: **Electron** invece di Tauri. Electron include lo stesso Chromium su cui il motore audio è stato
misurato (AudioWorklet, timing, Web MIDI identici), mentre Tauri userebbe WebView2 con comportamenti diversi su
download, MIDI e autoplay da riverificare. Il prezzo è la dimensione: circa 110 MB invece di pochi MB.
La latenza resta quella dell'audio di Chromium su Windows (WASAPI condiviso, tipicamente 10-40 ms); ASIO non è supportato.

## Versione browser (senza installare nulla)

1. Installa **Node.js LTS** (20.19 o successivo) da <https://nodejs.org>.
2. Fai doppio clic su **`AVVIA-TRIBE-MACHINE.bat`**: la prima volta scarica le dipendenze, poi si apre il browser su
   `http://localhost:4173`.
3. Clicca sul pannello o premi un tasto per **accendere** la macchina, poi **Spazio**.

```powershell
npm install      # una sola volta
npm start        # build + avvio locale, apre il browser
npm run dev      # modalità sviluppo con ricarica automatica
npm test         # test automatici
```

Browser consigliati: Chrome o Edge. Dopo l'installazione funziona offline.

---

## Tastiera (codici fisici: la griglia resta uguale con QWERTY, AZERTY, QWERTZ)

I 16 step corrispondono a una griglia 4×4 sulla tastiera (visibile anche sul pannello, sezione KEY GRID):

```
 1   2   3   4      → step 1-4    (LIVE: parti 1-4)
 Q   W   E   R      → step 5-8    (LIVE: parti 5-8)
 A   S   D   F      → step 9-12   (LIVE: note 1-4 della parte selezionata)
 Z   X   C   V      → step 13-16  (LIVE: note 5-8)
```

| Tasto | Funzione |
|---|---|
| Spazio | Play / Pausa |
| Esc | Stop (premuto a macchina ferma = silenzia anche le code) |
| Shift + Spazio | Registrazione ON/OFF (quantizzata, in LIVE MODE) |
| Tab | Modalità tastiera **STEP ↔ LIVE** |
| 1-4 Q-R A-F Z-V | Step on/off (STEP) · pad suonabili (LIVE) |
| Shift + step | Accento (LIVE: colpo accentato) |
| Tieni premuto uno step + `+`/`−` | Nota dello step (Shift = ottava) — lo step non si spegne |
| G | Slide sullo step tenuto (o sullo step selezionato) |
| ↑ / ↓ | Parte precedente / successiva |
| ← / → | Voce precedente / successiva del display |
| `+` / `−` (anche tastierino) | Modifica il valore selezionato (Shift = fine) |
| , / . | Pagina LCD precedente / successiva |
| Enter | ENTER (esegue la voce: salva, carica, export…) |
| Backspace | EXIT (torna alla pagina PATTERN) |
| M / N | Mute / Solo della parte selezionata |
| O / P | Banco step precedente / successivo (pattern da 32-64 step) |
| Pag↑ / Pag↓ | Pattern successivo / precedente (in riproduzione: cambio a fine battuta) |
| L | Song mode ON/OFF |
| T | Tap tempo |
| Canc | Cancella la parte (Shift+Canc = tutto il pattern) |
| Ctrl+S | Salva (WRITE nello slot selezionato) |
| Ctrl+C / Ctrl+V | Copia / incolla pattern |
| Ctrl+Z / Ctrl+Y | Annulla / ripeti (fino a 100 passi) |
| H o F1 | Aiuto con tutti i comandi |
| F2 | Zoom del display |
| F11 | Schermo intero |

`+` e `−` sono riconosciuti anche dal carattere: sulla tastiera italiana funzionano i tasti `+` e `-` normali.
Tutti i comandi a tasto singolo si **riassegnano** da GLOBAL → KEY MAP (o dall'aiuto): un tasto riassegnato
viene tolto dal comando precedente, quindi non si creano conflitti. La mappa è salvata sul PC.
I tasti premuti si illuminano sul pannello; se la finestra perde il fuoco tutte le note e i tasti tenuti
vengono rilasciati (niente note bloccate).

**Mouse**: manopole con trascinamento verticale (Shift = fine), rotellina, doppio clic = valore numerico,
tasto destro = valore iniziale. Step: clic = on/off, tasto destro o Shift+clic = accento, Alt+clic = slide.
Rotellina sul display = VALUE. Mouse e tastiera si usano insieme.

---

## Il pannello

- **LCD**: riga 1 pattern/nome/trasporto/REC · riga 2 BPM, parte, modalità tastiera, mute/solo ·
  righe 3-4 pagina, voce, barra e valore. I messaggi (salvataggi, valori delle manopole) compaiono in negativo.
- Pagine: PATTERN · SOUND/OSC · FILTER · ENVELOPE · MODULATION · PART FX/MIX · MASTER FX · STEP EDIT ·
  SONG · GLOBAL · SAVE/LOAD. Pulsanti MODE dedicati, PAGE ◀▶, CURSOR ◀▶, ENTER, EXIT, WRITE (LED rosso = modifiche non salvate).
- **SOUND**: 8 manopole, le serigrafie cambiano col tipo di parte (kick, snare, clap, hat, perc, bass, acid).
- **PART MIX**: drive, mandate delay/riverbero, pan, livello.
- **MASTER**: filtro performativo LP↔HP, bitcrusher, delay sincronizzato, riverbero, swing, tempo, volume.
- **PARTI**: selezione (LED rosso = trigger), MUTE, SOLO. **TRANSPORT**: display pattern, PAT ±, COPY/PASTE/CLEAR,
  STEP/LIVE, TAP, REC, STOP, PLAY.
- **16 STEP**: rosso = attivo, arancio = accento, verde = playhead, ⌒ = slide, numero = nota (parti melodiche).
- Valvole: il bagliore segue il livello reale dell'uscita master.

---

## Motore audio

Tutto è sintetizzato in tempo reale con Web Audio API:

| Parte | Sintesi |
|---|---|
| KICK | sinusoide/triangolo con pitch envelope esponenziale, click di rumore, clip asimmetrico "hardness", tono |
| SNARE | due oscillatori con pitch envelope + rumore filtrato (snappy) |
| CLAP | rumore passa-banda con tre colpi ravvicinati e coda |
| C.HAT / O.HAT | 6 onde quadre a rapporti inarmonici + rumore, passa-alto risonante. Il closed hat strozza l'open |
| PERC | FM a due operatori con pitch envelope: tom tribali, legni, metalli industriali; altezza per step |
| BASS | synth monofonico: sine/tri/saw/square + sub, LPF/HPF risonante con inviluppo, glide, LFO sincronizzato |
| ACID | monofonico stile 303: saw/square, filtro 24 dB/ott risonante, accent, slide vero (legato senza retrigger), LFO |

Per parte: drive (waveshaper con oversampling e compensazione), pan, livello, mandate.
Master: filtro LP/HP, bitcrusher (AudioWorklet), delay sincronizzato con feedback filtrato, riverbero a
convoluzione con IR generata, **limiter + soft clipper di sicurezza** (picco massimo 0,98).

## Motion sequence

Premi **REC** (Shift+Spazio) mentre la macchina suona e muovi una manopola della parte (SOUND o PART MIX):
il valore viene scritto su ogni step che passa. Da quel momento la manopola **si muove da sola** seguendo
la registrazione (arco verde e badge **M**). Sugli step non registrati vale la posizione della manopola.
Funziona anche con la rotella VALUE sulle pagine della parte e con i CC MIDI.
Cancellazione: PART EDIT → pagina PART FX/MIX → MOTION → ENTER due volte (oppure Ctrl+Z subito dopo).

## Song mode

Pagina **SONG** (pulsante MODE SONG): catena fino a 64 voci, ognuna con pattern e numero di ripetizioni.
POSITION sceglie la voce, PATTERN e REPEATS la modificano, INSERT duplica, DELETE elimina, LENGTH mostra la durata.
Con **SONG** acceso (pulsante SONG sul pannello o tasto L) PLAY suona la catena: ogni pattern viene suonato
per intero il numero di volte indicato, poi si passa al successivo; alla fine riparte dall'inizio. STOP torna
all'inizio. Il display mostra `S03` (voce) e il pannello `S03/05`. In SONG MODE l'EXPORT WAV renderizza l'intera song.
Ogni preset contiene una song dimostrativa (A ×4 → B ×2 → A ×4).

## Campioni personali (WAV, MP3, OGG, FLAC, AIFF)

- **Trascina un file audio sul pannello**: va nella parte selezionata, che diventa di tipo SAMPLE.
- Oppure PART EDIT → SOUND/OSC → voce SAMPLE → ENTER.
- Parametri: PITCH (±24 semitoni, e nota per step), START, REVERSE, CUTOFF, RESO, DECAY, più i comuni.
- Limiti: 12 MB e 30 secondi per file. I campioni sono salvati sul PC (IndexedDB del browser) e
  **incorporati nel file .tribe.json esportato**, quindi un progetto esportato è completo e portabile.
- Trascinare un file `.tribe.json` sul pannello lo importa.

## MIDI (Web MIDI, Chrome/Edge)

GLOBAL → MIDI IN → ENTER (il browser chiede il permesso; poi si riattiva da solo a ogni accensione).

| Messaggio | Funzione |
|---|---|
| Canale 10, note GM | 36 kick · 38/40 snare · 39 clap · 42/44 hat · 46 open hat · tom 41-50 perc |
| Altri canali | Suonano la parte selezionata (F3 = nota base), con legato per BASS/ACID |
| Velocity ≥ 100 | Accento |
| CC 70-77 | Le 8 manopole SOUND della parte selezionata |
| CC 7 / 10 / 91 / 93 / 94 | Level / Pan / Rev send / Dly send / Drive |
| CC 1 (mod wheel) | Filtro master (passa-basso) |

Con REC attivo, le note MIDI vengono registrate come i pad e i CC come motion.

## Preset (5, ognuno con pattern A + variazione B)

OLD SCHOOL TRIBE (172) · FREETEKNO HYPNOTIC (176) · MENTAL ACID (186) · INDUSTRIAL TEKNO (168) · HARDTEK PUMPING (192).
Si caricano da SAVE/LOAD → PRESET → LOAD PRESET (ENTER due volte per confermare).
Al primo avvio viene caricato OLD SCHOOL TRIBE; in seguito si riapre automaticamente l'ultimo progetto.

## Salvataggi

- **Autosave** continuo nel browser: chiudendo e riaprendo si ritrova tutto.
- **8 slot** locali (SAVE/LOAD → SLOT, WRITE / LOAD; Ctrl+S salva nello slot selezionato).
- **EXPORT/IMPORT FILE**: progetto completo in `.tribe.json` (16 pattern, suoni, step, motion, song, campioni), da copiare dove vuoi.
- **EXPORT WAV**: render offline del pattern corrente (4-64 battute) o, in SONG MODE, dell'intera song (fino a 15 minuti) in WAV 16 bit.
- **Nomi**: progetto (SAVE/LOAD → PROJECT), pattern (PATTERN → NAME), parte (PART FX/MIX → PART NAME), con ENTER.
- **Undo/redo** di ogni modifica ai contenuti (Ctrl+Z / Ctrl+Y o pulsanti UNDO/REDO).

I file importati vengono validati e riparati: un file corrotto non blocca la macchina.

---

## Architettura

```
src/
  audio/        motore audio (indipendente da UI e timer)
    engine.ts     bus per parte, mixer, FX master, limiter
    drums.ts      voci percussive one-shot con choke senza click
    monosynth.ts  bass/acid persistenti (slide e legato reali)
    dsp.ts        curve di saturazione, rumore, IR riverbero, worklet bitcrusher
    samples.ts    campioni: IndexedDB, decodifica, incorporazione nei file
    offline.ts    render offline a blocchi (pattern e song) + encoder WAV
  sequencer/    clock e scheduling
    sequencer.ts  lookahead scheduler sull'orologio audio, registrazione quantizzata
    timing.ts     funzioni pure (swing, quantizzazione, tap tempo)
  state/        modello dati, store, preset, salvataggi, motion, undo/redo
  input/        tastiera (mappa riassegnabile, logica step/pad condivisa col mouse) e MIDI
  lcd/          sistema di menu del display
  ui/           pannello React (manopole, pulsanti, LCD, step, overlay)
  machine.ts    "firmware": collega stato, motore, sequencer e animazione LED
```

**Temporizzazione**: un timer in un Web Worker sveglia il sequencer ogni 20 ms; il sequencer programma
nel motore tutti gli step dei successivi 120 ms con tempi assoluti dell'`AudioContext`. Il jitter dei timer
JavaScript non arriva mai all'audio. Il BPM viene letto a ogni step, quindi cambiarlo durante la riproduzione è
immediato e senza salti. Se il PC si blocca, gli step persi vengono saltati invece di suonare tutti insieme.

**LED**: lo step si illumina quando `currentTime − latenza d'uscita` raggiunge il tempo dello step, cioè quando lo
senti. La stessa compensazione è usata per quantizzare la registrazione live; lo step appena suonato a mano non
viene risuonato dal sequencer (niente doppi colpi).

**Motion e song**: il sequencer calcola per ogni step i parametri effettivi (manopole + valori registrati) e li
programma nel motore allo stesso istante audio della nota; il song mode decide il pattern successivo a fine pattern
nello stesso punto in cui avviene il cambio pattern in coda, quindi le transizioni sono a tempo.

**Parametri senza click**: tutte le manopole usano rampe brevi; il cutoff dei synth sta su `frequency` mentre
inviluppo e LFO agiscono su `detune`, così muovere il CUTOFF non interferisce con le automazioni programmate.

La separazione motore/sequencer/stato/UI/input permette di aggiungere un ingresso MIDI (Web MIDI → stesse
funzioni `livePlay`/`dispatch`) e una UI diversa (mobile) senza toccare il motore.

### Analisi rapida (fattibilità e rischi)

- **Fattibilità**: Web Audio offre oscillatori, filtri biquad, waveshaper, convolver e AudioWorklet nativi, sufficienti
  per una groovebox a sintesi con 8 parti. Il render offline è 6-7 volte più veloce del tempo reale.
- **Rischi principali** e come sono gestiti:
  timing (scheduler anticipato, verificato a ±1 campione), latenza su Windows (`latencyHint: interactive`, compensazione
  nei LED; per l'audio a latenza minima servirà il pacchetto desktop/ASIO in fase 3), click e picchi (rampe, choke da 4 ms,
  limiter + clipper), note bloccate (gestione legato nel sequencer, rilascio su stop/blur/mute), politiche di autoplay
  (pulsante POWER), conflitti con scorciatoie del browser (solo Ctrl+S/C/V intercettati, `Alt` lasciato al sistema).
- Tone.js non è usato: la sintesi è scritta direttamente su Web Audio per avere controllo totale su inviluppi,
  slide e scheduling, con meno dipendenze.

---

## Verifiche effettuate

- `npm test`: 18 test (timing, swing, quantizzazione, tap tempo, salvataggio→riapertura identica di tutti i preset,
  riparazione di file corrotti anche con motion/song non validi, motion sequence, song insert/edit/delete,
  undo/redo, rinomina, range dei parametri, nessun tasto assegnato due volte).
- Render offline in Chromium di tutti i pattern dei preset: nessun NaN, picco massimo 0,979, RMS ≈ −9…−12 dBFS;
  ogni parte in solo produce suono, compresa una parte SAMPLE con un WAV importato.
- Precisione: kick a 172 BPM su 2 battute, intervalli misurati 16743-16745 campioni contro 16744,2 attesi (48 kHz).
- Render di una song di 168 s in 36 s (≈4,7× il tempo reale), lineare con la durata.
- Test end-to-end con tastiera e mouse simulati: step, accento, tieni-step+nota, slide, mute, cambio pattern
  a fine battuta, LIVE + REC, Ctrl+S, autosave; song mode (A→B→A→B a ogni battuta), registrazione motion
  trascinando CUTOFF, undo/redo della motion, import di un WAV dal display, rinomina. Nessun errore in console.

App desktop: l'app Electron è stata avviata e controllata automaticamente (finestra, accensione, riproduzione,
LED, render, nessun errore, permesso MIDI); l'installer e il portatile Windows sono stati compilati e ispezionati
(eseguibile x64 con icona e informazioni di versione, pacchetto con solo i file dell'app). La prova dell'eseguibile
su un Windows reale la fa il workflow GitHub Actions.

Non verificato da qui: ascolto reale su PC Windows con una scheda audio specifica (la latenza effettiva dipende
dal driver) e controller MIDI fisici (il codice usa la Web MIDI API standard).

---

## Stato delle funzioni

**Implementato**
- Fase 1 completa: pannello hardware scalabile, LCD a menu con zoom, tastiera STEP/LIVE riassegnabile,
  motore a sintesi, sequencer, BPM, preset, salvataggi
- Fase 2: 8 parti (+ tipo SAMPLE), sequencer fino a 64 step, sintesi completa, effetti, importazione campioni,
  16 pattern, registrazione live quantizzata, **motion sequencing**, 5 preset
- Fase 3: export WAV di pattern e song, **song mode / pattern chain**, **ingresso MIDI**,
  **app desktop Windows** (installer + portatile, build e prova automatiche su Windows)
- Extra: undo/redo, rinomina, drag & drop di campioni e progetti

**Non ancora implementato**
- MIDI clock (sincronizzazione con altre macchine) e uscita MIDI
- Driver audio a bassa latenza (ASIO) e firma digitale dell'eseguibile
- Motion sui parametri master (filtro, crush, delay)
- Modalità smartphone (prevista dall'architettura, non sviluppata)
