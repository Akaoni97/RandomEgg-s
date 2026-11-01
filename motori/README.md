# Night Run

Gioco di guida notturna con gestione di soldi e pezzi, costruito sul Banco Suono 2JZ.
Quadro strumenti in alto, strada a scorrimento sotto, consolle di guida, officina.

La strada è disegnata in **pixel art cartoonesca vista di lato** (`street2d.js`), a 360 px di
altezza: auto con contorni e proporzioni da cartone, schiacciamento in partenza, tuffo in frenata,
sobbalzi sui giunti, pilota che si muove, fumo, fiammate; città su tre piani con insegne a pixel,
balconi, cisterne, negozi, pedoni e un gatto. La Supra ha la silhouette della JZA80 (muso basso,
lunotto inclinato, alettone ad arco) e le cose si scrivono in grande: VROOOM, PSSSH, BANG, SCREEECH, CRASH. Le luci si sommano all'immagine a bande morbide:
pozze sull'asfalto sotto i lampioni, davanti ai fari e dietro agli stop, riflessi sul bagnato.

**Gomme e carrozzeria.** Le gomme hanno temperatura (presa massima verso 90 °C, meno da fredde e
da cotte), usura e sensibilità al carico; si vedono nel quadro e si cambiano in officina. I tamponamenti
ammaccano la carrozzeria (visibile in 2D e 3D, aumenta la resistenza all'aria): si ripara dal carrozziere.
Segni di gomma sull'asfalto, fumo, spruzzi d'acqua sul bagnato e scintille nei tamponamenti.

Dalla barra sotto la strada si passa alla **vista 3D** (`street3d.js`): Supra JZA80 modellata per sezioni con vernice lucida che riflette la città, quattro
fanali tondi, alettone ad arco, ruote con cerchi, dischi e pinze, anteriori sterzanti; edifici di quattro tipi,
alberi, panchine, idranti, fermate, semafori che cambiano colore, strisce, frecce, tombini,
luna e stelle. È l'unica vista che carica modelli .glb.

**Modello 3D della Supra.** L'auto principale (in strada e nella sigla) è
[*Toyota Supra MK4 (LowPoly)*](https://sketchfab.com/3d-models/toyota-supra-mk4-lowpoly-36e53ad2f8f04e819baf5519dcb1bf7a)
di [Mike Farrant](https://sketchfab.com/MikeFarrant), licenza [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
Il file `models/supra_mk4.glb` è una versione ricavata dall'originale: orientato e scalato in metri, ruote
separate in quattro pezzi (girano e sterzano), texture ridotte da 4096 a 1024 px (da 26 a 2,4 MB), materiale
reso opaco. La vernice dell'officina ricolora i pixel rosso carrozzeria dell'atlante delle texture, quindi
loghi, fari e cerchi restano com'erano. Il pulsante "Supra MK4" la ricarica, "Modello di base" torna alla
Supra procedurale (usata anche se il file non si carica, per esempio aprendo la pagina con doppio clic).

**Dettagli della Supra e della città.** Fari a tre proiettori tondi per lato sotto la copertura trasparente,
vetri fumé con riflessi, abitacolo visibile da fuori con sedili, plancia, volante e pilota col cappellino,
maniglie, guarnizioni dei finestrini con filetto cromato, presa laterale incassata con alette, griglie a nido
d'ape, diffusore a pinne e terzo stop sull'alettone. Dentro: plancia a profilo curvo estruso con bordo arrotondato, cassetto e maniglia d'appiglio dal lato passeggero, autoradio con display, pannelli porta in pelle con cuciture, tasca e altoparlante, bracciolo imbottito, alzacristalli, parabrezza con fascia scura antiriflesso in alto; tessuto dei sedili a coste con cuciture rosse,
moquette, cuffia del cambio, freno a mano, bracciolo e bocchette con alette. Strada con rattoppi, crepe,
tracce delle gomme, macchie d'olio, tombini e pozzanghere lucide che riflettono neon e lampioni; marciapiedi
a lastre con cordolo chiaro, cavi elettrici lungo la via, distributori automatici illuminati davanti ai negozi
e uno skyline lontano pieno di finestre accese.

**Visuale pulita.** Nelle viste esterne pali e alberi che passerebbero davanti alla telecamera si nascondono;
dall'abitacolo il quadro si legge sopra la corona del volante, le alette parasole sono ripiegate contro il
cielo, la plancia ha una grana goffrata, una bocchetta del disappannamento alla base del parabrezza e le
cuciture sulla palpebra. I montanti anteriori sono neri come la serra della JZA80.

**Stili dell'interfaccia.** Nel pannello "Interfaccia" si sceglie fra sei stili per quadro e pannelli (vale anche per
il quadro sul cruscotto dell'abitacolo): realistici *Garage*, *Fondo bianco* e *Carbonio e neon*; cartoon *Sticker
Bomb*, *Nastro e spray* e *Fumetto neon*. La scelta resta salvata nel browser.

**Pioggia.** Il pulsante "Pioggia" o il tasto K la accendono e spengono, e la scelta resta salvata. In 3D
cadono migliaia di gocce che si inclinano con la velocità; l'asfalto si fa lucido e riflette di più neon e
lampioni, la nebbia si infittisce e gli aloni dei lampioni si allargano. Dall'abitacolo le gocce si posano sul
parabrezza, a velocità salgono col vento e le spazzole le puliscono (più veloci sopra gli 80 km/h). Anche il 2D
ha pioggia a pixel e schizzi sull'asfalto. Si sente lo scroscio, più ovattato dall'abitacolo, e le gomme
tengono circa un quarto in meno: frenate più lunghe e coda che scappa se si esagera col gas.

**Spruzzi e assistenza.** Gli spruzzi d'acqua escono solo passando sulle pozzanghere (brevi tratti bagnati),
non più per tutto il viaggio. Mollando lo sterzo a meno di 30 cm dal centro di una corsia la Supra ci si centra
piano; fra le corsie resta dov'è. Dall'abitacolo si vedono gli specchietti laterali con la strada riflessa, e la
leva delle frecce si muove quando lampeggiano.

**Sterzo progressivo.** Con A/D un tocco corregge appena e tenendo premuto la sterzata cresce fino al massimo; al
rilascio torna dritta in fretta. La risposta è non lineare (correzioni piccole morbide, sterzata piena decisa);
la levetta del pad resta analogica.

**Stile garage** (predefinito). Quadro e interfaccia hanno il look di un'officina clandestina: strumenti neri vissuti con
ghiera bruna, viti a vista, graffi sul vetro e luce ambra da dietro, numeri e titoli a stencil, lancette
arancio luminose e zona rossa arancio-rossa; pannelli in nero caldo con bordi bruni e accenti ambra. Lo stesso
quadro compare sul cruscotto dell'abitacolo.

**Telecamere e qualità.** Il tasto C (o il pulsante 🎥) passa tra inseguimento, vista laterale, cofano
e **abitacolo**: guida a destra come le JZA80 giapponesi, volante che gira con lo sterzo, leva del cambio
che segue la marcia, sedili con cuciture rosse e il quadro strumenti del gioco disegnato sul cruscotto.
Con qualità *alta* c'è il bloom (fari, insegne, fiammate brillano) con tonemapping ACES e vignettatura;
*bassa* spegne post-processo e ombre per i computer lenti.

**Sterzo reattivo.** Tenendo premuto A/D la Supra risponde subito (velocità laterale che arriva in un
decimo di secondo e cresce con l'andatura) e la vista 3D la segue senza ritardo; il volante gira con le mani
quasi istantaneamente. Le mani sono superfici continue: palmo che si allarga dal polso alle nocche, dita
affusolate a tre falangi con le articolazioni, pollice carnoso, unghie, orologio con vetro. Nell'abitacolo
anche plafoniera, maniglia sul montante, tweeter, cinture, battitacco, logo sul volante e schema delle marce
sul pomello.

**Effetti di velocità.** Con qualità alta, oltre i 45 km/h circa i bordi dell'immagine si sfocano verso il centro con
un filo di aberrazione cromatica; cambiate, valvola, fiammate e tamponamenti danno un colpo di contrasto;
grana leggera. Nelle sterzate brusche ad alta velocità le gomme lasciano segni e un filo di fumo, e
dall'abitacolo la testa si inclina appena con la curva.

**Abitacolo, come nei simulatori.** La testa del pilota è una molla smorzata: va indietro in spinta, avanti
in frenata, di lato nei cambi corsia e guarda verso dove sterzi in proporzione alla velocità (look to apex),
con lo sguardo stabilizzato lontano davanti al cofano, come fanno le telecamere di Assetto Corsa, rFactor 2
e BeamNG. Mani con dorso, palmo, quattro dita a tre falangi avvolte sulla corona alle 10 e 10 (sguardo appena verso il basso: poco cielo, mani in vista), pollice a due falangi
sul lato interno, unghie e orologio al polso sinistro; le braccia seguono con un gomito
calcolato a due segmenti; oltre 35° di sterzo le mani scivolano sulla corona invece di incrociarsi; quando
cambi marcia la mano sinistra va sulla leva con un arco naturale e torna; la strada fa vibrare le mani. Specchietto retrovisore vero (una seconda telecamera
disegna su una texture), tre strumenti supplementari a lancetta sulla consolle rivolta verso il pilota,
manopole del clima, pedaliera, alette parasole, altoparlanti nelle porte e la luce arancio del quadro
che illumina mani e volante.

Proporzioni da gioco di guida: parabrezza che occupa più di metà dello schermo, cornice superiore
sottile, plancia poco sotto l'orizzonte, quadro visibile attraverso la parte alta del volante, montanti
interni scuri e larghi ai lati; dall'abitacolo la scocca esterna si nasconde e resta solo il cofano.
Un portafortuna omamori appeso allo specchietto oscilla con accelerazioni, frenate e cambi corsia.

**Autoradio.** Mentre guidi c'è musica bassa di sottofondo, separata dal motore (volume "Radio" nelle
impostazioni, e il tasto M la spegne con tutto il resto). P o il riquadro in alto a destra della strada cambiano
stazione: FM 89.7 *Redline at Midnight*, FM 91.3 *Red Zone Needles*, FM 94.5 *Metal Alive*, FM 98.1
*Apex to Apex* (ogni stazione riprende la canzone da dove era), FM 76.1 "Synth Notturno" generata in tempo reale (cassa,
rullante, charleston, basso e accordi in La minore con eco a nastro) e radio spenta. Fra una stazione e l'altra
si sente il fruscio della sintonia; il display dell'autoradio nell'abitacolo mostra la stazione. La scelta resta
salvata nel browser.

**Comandi in strada.** F abbaglianti (fascio più lungo in 2D e 3D, spia blu nel quadro), H clacson,
frecce automatiche quando si cambia corsia (spie ◀ ▶ con il ticchettio del relè), B bagagliaio.

**Bagagliaio.** 12 posti e 150 kg al massimo; tutto quello che carichi pesa sulla massa dell'auto e sul
retrotreno (più trazione, più lenta in accelerazione). Tanica (+10 L), kit di riparazione (3 usi, solo da
fermo), ruota di scorta, zavorra, i pacchi delle consegne (non si buttano durante il lavoro) e i trofei dei
capi battuti. Si compra e si butta dal pannello del bagagliaio.

**Intro.** All'apertura parte una sigla sulla canzone *Redline at Midnight* (`audio/redline_at_midnight.mp3`,
`intro.js`) girata con il motore 3D del gioco: la tua Supra (vernice, scarichi e preparazione dell'officina)
nella città notturna, con bande cinematografiche, grana della pellicola e bloom. Le inquadrature seguono il
brano: a mezzanotte la Supra ferma si accende (motorino d'avviamento, due colpi di gas), alla cassa parte
da dietro tra fumo e pattinamento, carrellata laterale in teleobiettivo durante le cambiate, arriva in camera
nel crescendo, al picco il titolo NIGHT RUN, poi il menu con lente orbite mentre la Supra continua ad
affondare e rilasciare. Il suono non è registrato: una simulazione propria guida il motore audio del gioco,
quindi si sentono il 2JZ, il fischio delle turbine e la valvola che soffia a ogni cambiata e rilascio, sotto
la musica. Invio o tocco per iniziare, Esc per saltare, M per la musica; entrando in gioco la canzone sfuma.
Senza three.js resta una versione in pixel art.

## La carriera

- Si parte con € 3.000, una Supra di serie e 50 litri di benzina (serbatoio da 70, consumo reale).
- L'auto resta in prima corsia; se davanti c'è traffico più lento sorpassa da sola e poi rientra.
- Lungo la strada arrivano proposte a tempo (pulsanti o tasti 1-2-3; senza risposta vale l'ultima):
  distributore (pieno, € 20 o tiri dritto), sfide da semaforo sui 400 m con posta, lavoretti di consegna
  con bonus di puntualità.
- Sterzo libero: tieni premuto A o D (o i pulsanti ◀ ▶, o la levetta del pad) e la Supra va dove vuoi sulla
  carreggiata, anche fra le corsie, fino al cordolo; mollato lo sterzo resta lì. Il volante gira con le mani
  del pilota anche da fermo (antiorario a sinistra). Con il sorpasso automatico
  la Supra si sposta da sola dietro al traffico lento; senza, chi tampona paga il carrozziere.
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
