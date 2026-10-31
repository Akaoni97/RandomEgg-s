# Banco Suono 2JZ

Simulatore del suono del motore di una **Toyota Supra RZ (JZA80)** con 2JZ-GTE e cambio Getrag V160:
plancia completa, acceleratore, freno, frizione, cambio a 6 marce. Funziona nel browser, senza dipendenze.

Apri `motori/index.html` (doppio clic va bene) e premi **Accendi l'audio**. Poi `I` per il quadro e
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
| `../test/motori.test.js` | Prove con `npm test` |
