# Mat.Tone per PC

App desktop (Electron) con la stessa groovebox di `../mattone.html`, funziona offline: suoni, font ed encoder MP3 sono inclusi.

## Scaricare

Dalla pagina [Releases](https://github.com/Akaoni97/RandomEgg-s/releases), le versioni `mattone-v…`:

- Windows: `Mat.Tone-Setup-<versione>.exe` (installer) oppure `Mat.Tone-Portatile-<versione>.exe`
- Mac: `Mat.Tone-<versione>-<arch>.dmg`
- Linux: `Mat.Tone-<versione>.AppImage`

## Aggiornamenti

All'avvio l'app cerca la Release `mattone-v…` più recente (le Release degli altri progetti del repository vengono ignorate).

- Installer Windows e AppImage Linux: scaricano l'aggiornamento da soli e chiedono se riavviare subito; altrimenti si installa alla chiusura.
- Mac e Windows portatile: mostrano un avviso con il pulsante "Scarica" che apre la pagina della Release.

Pattern e impostazioni restano dopo l'aggiornamento.

## Pubblicare una nuova versione

1. Aumenta `version` in `package.json` (es. `1.0.0` → `1.0.1`).
2. Fai push: il workflow `.github/workflows/mattone-desktop.yml` compila Windows, Mac e Linux e crea la Release `mattone-v1.0.1`.

Un push senza cambio di versione compila soltanto (gli installer restano tra gli artifact della run).

## Compilare in locale

```
npm install
npm start          # prova l'app
npm run dist:win   # oppure dist:mac / dist:linux, risultato in dist/
```
