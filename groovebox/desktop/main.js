// Mat.Tone desktop: the same groovebox page, served from the app folder through an app:// scheme
// (fetch() of the sample files does not work from file://, and a fixed origin keeps saved patterns).
const { app, BrowserWindow, protocol, net, session, shell, Menu, ipcMain, desktopCapturer, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { checkForUpdates } = require("./updater");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const ROOT = path.join(__dirname, "app");
// the user's sample folders: the page may list and read audio files only inside the folders the user picked
const AUDIO = /\.(wav|mp3|ogg|oga|flac|m4a|aac|opus|webm)$/i;
let roots = [];
const inRoots = p => roots.some(r => p === r || p.startsWith(r.endsWith(path.sep) ? r : r + path.sep));
// 1.0.0 was named "MatTone": keep its settings folder so saved patterns survive the rename to "Mat.Tone"
app.setPath("userData", path.join(app.getPath("appData"), "MatTone"));

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 420,
    minHeight: 600,
    title: "Mat.Tone",
    backgroundColor: "#100f0d",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: "no-user-gesture-required", preload: path.join(__dirname, "preload.js") },
  });
  win.loadURL("app://mattone/index.html");
  // links to the sample libraries open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  // look for a new version once the groovebox is on screen
  win.webContents.once("did-finish-load", () => setTimeout(() => checkForUpdates(win), 3000));
  return win;
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname);
    if (rel.startsWith("/_cartelle/")) {   // a file from one of the user's folders
      const ext = path.resolve(rel.slice("/_cartelle/".length));
      if (!inRoots(ext) || !AUDIO.test(ext)) return new Response("Non trovato", { status: 404 });
      return net.fetch(pathToFileURL(ext).toString());
    }
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response("Non trovato", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // exported beats: ask where to save, starting from the Music folder
  session.defaultSession.on("will-download", (_event, item) => {
    if (process.env.MATTONE_SAVE_DIR) item.setSavePath(path.join(process.env.MATTONE_SAVE_DIR, item.getFilename()));   // automated tests
    else item.setSaveDialogOptions({ title: /\.mattone$/.test(item.getFilename()) ? "Salva il progetto" : "Salva il beat", defaultPath: path.join(app.getPath("music"), item.getFilename()) });
  });
  // "Audio del computer" in the sampler: the screen (never shown) with the system sound, which Windows can give;
  // elsewhere no audio arrives and the page suggests an input like BlackHole or the sound card's monitor
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then(sources => {
      if (!sources.length) return callback({});
      callback(process.platform === "win32" ? { video: sources[0], audio: "loopback" } : { video: sources[0] });
    }).catch(() => callback({}));
  }, { useSystemPicker: true });
  // the page asks for the version and for an update check (Personalizza → App)
  ipcMain.handle("app-version", () => app.getVersion());
  ipcMain.handle("check-updates", e => checkForUpdates(BrowserWindow.fromWebContents(e.sender), true));
  // the sample folders: the page says which ones it knows, asks for a new one, and lists one folder at a time
  ipcMain.handle("folders-set", (_e, list) => {
    roots = (Array.isArray(list) ? list : []).filter(p => typeof p === "string" && fs.existsSync(p)).map(p => path.resolve(p));
    return roots.length;
  });
  ipcMain.handle("folder-pick", async e => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: "Scegli una cartella di suoni", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths.length) return null;
    const p = path.resolve(r.filePaths[0]);
    if (!roots.includes(p)) roots.push(p);
    return { path: p, name: path.basename(p) || p };
  });
  ipcMain.handle("folder-list", async (_e, dir) => {
    const abs = path.resolve(String(dir || ""));
    if (!inRoots(abs)) return null;
    let ents;
    try { ents = await fs.promises.readdir(abs, { withFileTypes: true }); } catch (err) { return null; }
    const by = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }), MAX = 3000;
    const vis = ents.filter(d => !d.name.startsWith("."));
    const dirs = vis.filter(d => d.isDirectory()).sort(by), files = vis.filter(d => d.isFile() && AUDIO.test(d.name)).sort(by);
    const item = d => ({ name: d.name, path: path.join(abs, d.name) });
    return { up: roots.includes(abs) ? null : path.dirname(abs), name: path.basename(abs) || abs, dirs: dirs.slice(0, MAX).map(item), files: files.slice(0, MAX).map(item), more: dirs.length > MAX || files.length > MAX };
  });
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
