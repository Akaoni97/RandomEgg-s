# 🎲 NAPOLÌ — Il Monopoli che te fa' 'o pacco

Gioco da tavolo 3D per adulti (18+), ispirato al Monopoli e ambientato a Napoli. È una parodia affettuosa e
senza filtri: stereotipi, parolacce in dialetto e momenti assurdi. Si ride **con** Napoli, non contro Napoli.
Se c'è nonna in salotto c'è la **Modalità Nonna**, che censura tutto con il bip.

Si gioca in 4 sullo stesso dispositivo (hot-seat). Ogni posto può essere preso da un bot, a tre livelli di furbizia:
*Turista*, *Guaglione* e *Boss d'o Rione*.

## Avvio

```bash
npm install
npm run dev      # gioca su http://localhost:5173
npm test         # 55 test vitest su motore, carte, frasi e layout
npm run build    # build di produzione in dist/ (servibile da qualsiasi hosting statico)
```

## Le pedine

| Pedina | Modello 3D | Potere |
|---|---|---|
| 🛵 **Ciro Esposito** | In tre sull'SH, senza casco | *Senza casco*: una volta per giro tira 3 dadi e ne scarta uno (35% di multa della Municipale). +1 negli scippi |
| 🎩 **Totò Tredita** | Bombetta, gilet, mano a tre dita con la moka | *'O Pacco*: quando rifila un mattone lo scoprono solo il 30% delle volte, e su ogni affitto si fa fare il 10% di sconto |
| 🍕 **Luigi Gigi** | Una margherita con le gambe e il ventilatore | *Sfornata*: +30 ₵ ogni volta che passa dal VIA |
| 🙏 **Gennaro San** | Statuina di San Gregorio Armeno con l'ampolla che brilla | *Il Miracolo*: annulla una carta negativa o un'eruzione; l'ampolla si ricarica ogni 3 passaggi dal VIA (con 1 sul dado è tragedia) |

## Le dinamiche

- **Dadi della Smorfia**: ogni somma ha il suo significato. Con l'8 (*'A Maronna*) prendi +20 ₵, con il 4
  (*'O puorco*) offri il caffè a tutti, con l'11 (*'E suricille*) i topi si mangiano 1 ₵ per ogni basso.
- **Malocchio & Corno**: chi riceve il malocchio incassa metà del prossimo affitto. Il corno rosso (30 ₵) lo fa esplodere.
- **'O Pacco**: negli scambi puoi consegnare una scatola chiusa, con dentro la roba promessa o un mattone. Chi la riceve può fidarsi o aprirla.
- **Abusivismo**: puoi costruire senza il gruppo completo a metà prezzo, ma c'è la **Ruspa del Comune** (10% a giro).
- **Il Vesuvio**: sale a ogni passaggio dal VIA. A 100 erutta e distrugge i bassi sul lato rivolto verso il vulcano.
- **Il Napoli segna!**: 50 ₵ a tutti, malocchi tolti e amnistia.
- E poi lo **Scippo**, il **Caffè Sospeso**, **"Conosco a uno"**, il **Presepe vivente**, **'o cugino d'America** e lo **Sciopero ANM**.
- Mazzi: 35 carte *'A Smorfia* e 34 carte *Malocchio*. Più di 30 frasi per pedina.

Le regole complete sono anche nel gioco (📖).

## Bilanciamento

I prezzi sono tarati con partite simulate tra bot (`BALANCE` in `src/engine/engine.ts`): con i bot *Guaglione*
e *Boss* una partita porta in media 2-2,6 fallimenti in circa 130 turni (≈ 45-60 minuti tra umani), e le
quattro pedine vincono tra il 23% e il 27% delle volte (1.200 partite) con i posti a rotazione. Rispetto al Monopoli
classico gli affitti delle proprietà sono ×1,5, bassi e palazzi costano il 25% in meno e nel Caffè Sospeso
finisce solo metà di tasse e multe.

## Struttura

```
src/engine/   regole in TypeScript puro, senza rendering: stato, azioni (apply), carte, frasi, bot
src/three/    scena React Three Fiber: tabellone, diorami, pedine, dadi, Vesuvio, mare, effetti
src/ui/       HUD, pannelli azione, aste, scambi/pacco, schede proprietà, impostazioni
src/audio/    effetti, mandolino e borbottio delle pedine (tutto sintetizzato con Web Audio)
src/store.ts  zustand: applica le azioni, salva in localStorage e mette in fila le animazioni
test/         vitest
```

Il motore è deterministico: il seme casuale fa parte dello stato, e nei test si possono forzare i dadi
(`forcedRolls`) e gli eventi casuali (`forcedRandom`). La UI non cambia mai lo stato direttamente: manda
un'`Action` a `apply(state, action)` e poi anima gli eventi che il motore ha emesso.

Tutti i modelli 3D sono procedurali (geometrie Three.js), le texture sono disegnate su canvas e l'audio
è sintetizzato. Non ci sono asset esterni. L'unica risorsa caricata da fuori sono i font Google (Baloo 2,
Pacifico); se non arrivano, il gioco usa i font di sistema.
