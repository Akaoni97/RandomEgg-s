// TRIBE MACHINE — applicazione desktop (Electron).
// Il processo principale apre una sola finestra che carica la build locale dell'interfaccia:
// nessuna connessione di rete, nessun server. Tutti i dati restano nella cartella utente dell'app.

const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// L'audio può partire senza attendere un clic (il pulsante POWER resta come gesto "hardware")
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Il sequencer non deve rallentare quando la finestra è in secondo piano
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (process.platform === 'win32') app.setAppUserModelId('it.tribemachine.tm1');

let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(start);
}

/** Cartella predefinita per WAV e progetti esportati: Documenti\TRIBE MACHINE */
function exportDir() {
  const dir = path.join(app.getPath('documents'), 'TRIBE MACHINE');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ok */ }
  return dir;
}

const FILTERS = {
  wav: [{ name: 'Audio WAV', extensions: ['wav'] }],
  json: [{ name: 'Progetto TRIBE MACHINE', extensions: ['json'] }],
};

function start() {
  // niente menu: niente scorciatoie Ctrl+R / Ctrl+W che interferiscono con lo strumento
  Menu.setApplicationMenu(null);

  const ses = session.defaultSession;
  // permessi minimi: MIDI e schermo intero, nient'altro (niente microfono, webcam, posizione...).
  // Chromium chiede 'midiSysex' anche per il MIDI semplice; la macchina comunque non usa sysex.
  const allowed = new Set(['midi', 'midiSysex', 'fullscreen']);
  ses.setPermissionRequestHandler((_wc, permission, cb) => { if (process.env.TM_DEBUG) console.log('perm-request', permission); cb(allowed.has(permission)); });
  ses.setPermissionCheckHandler((_wc, permission) => { if (process.env.TM_DEBUG) console.log('perm-check', permission); return allowed.has(permission); });

  // export (WAV, progetto): finestra "Salva con nome" che parte da Documenti\TRIBE MACHINE
  ses.on('will-download', (_e, item) => {
    const name = item.getFilename();
    const ext = path.extname(name).slice(1).toLowerCase();
    item.setSaveDialogOptions({
      title: 'Salva da TRIBE MACHINE',
      defaultPath: path.join(exportDir(), name),
      filters: FILTERS[ext] ?? [],
    });
  });

  win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#111215',
    title: 'TRIBE MACHINE TM-1',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // l'interfaccia non deve mai navigare altrove né aprire finestre
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // se il renderer va in crash, ricarica (il progetto è salvato in automatico)
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') win.reload();
  });

  const devUrl = process.env.TM_DEV_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.on('closed', () => { win = null; });
}

app.on('window-all-closed', () => app.quit());
