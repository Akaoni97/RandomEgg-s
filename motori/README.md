# 2JZ Night Run

Gioco di guida notturna con gestione di soldi e pezzi, costruito sul Banco Suono 2JZ.
Quadro strumenti in alto, strada a scorrimento sotto, consolle di guida, officina.

La strada è disegnata in **pixel art cartoonesca vista di lato** (`street2d.js`), a 360 px di
altezza: auto con contorni e proporzioni da cartone, schiacciamento in partenza, tuffo in frenata,
sobbalzi sui giunti, pilota che si muove, fumo, fiammate; città su tre piani con insegne a pixel,
balconi, cisterne, negozi, pedoni e un gatto. Le luci si sommano all'immagine a bande morbide:
pozze sull'asfalto sotto i lampioni, davanti ai fari e dietro agli stop, riflessi sul bagnato.

Dalla barra sotto la strada si passa alla **vista 3D** (`street3d.js`): edifici di quattro tipi,
alberi, panchine, idranti, fermate, semafori che cambiano colore, strisce, frecce, tombini, auto
parcheggiate, luna e stelle. È l'unica vista che carica modelli .glb.

## La carriera

- Si parte con € 3.000, una Supra di serie e 50 litri di benzina (serbatoio da 70, consumo reale).
- L'auto resta in prima corsia; se davanti c'è traffico più lento sorpassa da sola e poi rientra.
- Lungo la strada arrivano proposte a tempo (pulsanti o tasti 1-2-3; senza risposta vale l'ultima):
  distributore (pieno, € 20 o tiri dritto), sfide da semaforo sui 400 m con posta, lavoretti di consegna
  con bonus di puntualità.
- Polizia: se le passi accanto in sesta ti ferma, multa in base alla velocità e al livello di ricercato
  (5 stelle, scende col tempo). Un avviso in alto segnala le pattuglie in arrivo.
- Officina: i pezzi si pagano coi contanti e si montano solo da fermo. Le preparazioni pronte mostrano
  quanto manca per completarle.
- Gare di accelerazione sui 400 m: semaforo con tre gialli e verde, zona verde dei giri in partenza
  (freno + colpetti di gas, si molla il freno al verde), tempo di reazione, indicatore di cambiata
  (perfetta / buona / anticipata / tardi; la perfetta è più rapida), telecamera bassa di lato e
  schermata del risultato.
- Scala dei rivali: quattro quartieri con tre rivali e un capo ciascuno, da battere in ordine.
  Le sfide della scala non costano: se vinci incassi il premio.
- Officina con barre delle prestazioni (potenza, coppia, trazione, peso/potenza, 400 m stimati) e gomme
  (Toyo R888R, Mickey Thompson ET Street R) che cambiano l'aderenza.
- Modalità libera: tutto sbloccato, nessun evento, benzina infinita (il vecchio banco suono).
- La carriera si salva nel browser. `window.nightRun` espone simulazione e gioco dalla console.


Simulatore del suono del motore di una **Toyota Supra RZ (JZA80)** con 2JZ-GTE e cambio Getrag V160:
plancia completa, acceleratore, freno, frizione, cambio a 6 marce. Funziona nel browser, senza dipendenze.

Apri `motori/index.html` (doppio clic va bene; la vista 3D scarica three.js da jsDelivr) e premi **Accendi l'audio**. Poi `I` per il quadro e
`Invio` tenuto premuto per l'avviamento. Meglio con le cuffie.

## Da dove viene il suono

Nessuna registrazione. Su GitHub i progetti con campioni di motori (per esempio `markeasting/engine-audio`)
usano file estratti da banche audio di videogiochi, senza una licenza chiara per l'audio, e nessuno ha una 2JZ.
Qui il suono è **sintetizzato fisicamente**, come fanno i simulatori di motore più seri:

1. **Sei cilindri** in ordine di scoppio 1‑5‑3‑6‑2‑4, uno ogni 120° di manovella. Ogni ciclo genera un
   impulso di scarico (blowdown) la cui ampiezza dipende dalla carica d'aria e dal boost, con variazioni
   ciclo per ciclo e piccole differenze tra cilindri.
2. **Collettore**: guide d'onda di lunghezza diversa per cilindro (ghisa 3+3 di serie, tubolare 6‑1 col single).
3. **Turbina** che smorza gli impulsi, poi **tubo** con risonanze a quarto d'onda e **silenziatore**
   (originale, sportivo, straight pipe), radiazione dalla bocca del terminale.
4. **Aspirazione**, fischio della girante (due giranti nel biturbo sequenziale), blow-off, ricircolo o
   pompaggio del compressore ("flutter"), wastegate.
5. **Afterfire** al limitatore, al 2‑step e con la mappa pop & bang; punterie, motorino d'avviamento,
   pompa benzina, rotolamento, vento, stridio delle gomme, fischio della retromarcia.
6. Tre punti d'ascolto: abitacolo, esterno posteriore, vano motore.

## Fluttuazioni del motore

- Giri interpolati campione per campione, senza gradini tra un aggiornamento e l'altro.
- Ogni scoppio accelera l'albero e la compressione lo rallenta: la velocità oscilla dentro il ciclo.
- Semiassi e albero di trasmissione elastici: attaccando e staccando il gas l'auto "singhiozza" a 3–5 Hz.
- Camme lunghe: minimo irregolare con cicli deboli e regime che balla.
- Frizione bidisco: volano più leggero e tintinnio in folle al minimo.
- Scarichi a doppia uscita con immagine stereo.

## Reparto tuning

`tuning.js` elenca parti reali per JZA80/2JZ e il loro effetto su fisica e suono: scarichi (HKS Hi-Power,
Apexi N1 Evolution, Tomei Expreme Ti, Blitz Nür-Spec, straight pipe), downpipe e catalizzatore, turbo
(CT12B di serie, Garrett GTX3582R, Precision 6466, BorgWarner EFR 9180, HKS T51R SPL), valvole (HKS SSQV,
Turbosmart Race Port, GReddy Type-RS, nessuna), wastegate TiAL con screamer pipe, aspirazione HKS Super
Power Flow, camme HKS 264°/272°, centraline Haltech Elite 2500 e Link G4X, frizione bidisco OS Giken.
Il carattere sonoro è una nostra modellazione fisica, non una registrazione dei prodotti.

## Modello 3D e suoni di una mod

Il garage 3D (three.js) mostra un'auto procedurale che reagisce alla simulazione: ruote, beccheggio,
vibrazioni, fiammate dallo scarico. Con **Carica modello .glb** si apre un proprio modello; quelli delle
mod (.yft, .kn5, .dae…) vanno prima esportati in GLB con Blender.

Nel riquadro **Suoni della mod** si caricano campioni in loop (WAV, OGG, MP3, FLAC). Il regime si legge
dal nome del file (`on_4000.ogg`, `off_2500.wav`) e si può correggere; i campioni vengono intonati sui giri
e sfumati tra loro, e si possono miscelare con la sintesi.

Modelli e suoni delle mod non sono inclusi nel repository: spesso sono estratti da giochi commerciali e
non si possono ridistribuire. I file caricati restano nel browser di chi li apre.

## Fisica

`sim.js` integra a 4000 passi al secondo motore (curva di coppia, farfalla, regolatore del minimo,
taglio in rilascio, limitatore a 7000 giri), turbo con inerzia, frizione con slittamento, ruote posteriori
con modello di aderenza, resistenza aerodinamica e frenata. Con la configurazione originale fa
0‑100 km/h in circa 5,2 s e i 400 m in circa 13,3 s, in linea con le prove della JZA80 biturbo.

| File | Contenuto |
|---|---|
| `index.html` | Plancia, comandi (tastiera, touch, gamepad), collegamento audio |
| `dsp.js` | Sintesi audio (gira in un AudioWorklet) |
| `sim.js` | Fisica del veicolo |
| `tuning.js` | Catalogo del reparto tuning |
| `samples.js` | Lettore dei campioni audio caricati |
| `car3d.js` | Modello 3D dell'auto e sue animazioni |
| `street2d.js` | Strada in pixel art cartoonesca vista di lato (vista predefinita) |
| `street3d.js` | Strada notturna in 3D: città, arredo urbano, traffico, polizia, distributore |
| `game.js` | Carriera: soldi, eventi, polizia, sfide, consegne, pilota automatico per le fermate |
| `../test/motori.test.js` | Prove con `npm test` |
