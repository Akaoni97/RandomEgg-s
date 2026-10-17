// Mat·Tone desktop: the same groovebox page, served from the app folder through an app:// scheme
// (fetch() of the sample files does not work from file://, and a fixed origin keeps saved patterns).
const { app, BrowserWindow, protocol, net, session, shell, Menu } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { checkForUpdates } = require("./updater");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const ROOT = path.join(__dirname, "app");

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 420,
    minHeight: 600,
    title: "Mat·Tone",
    backgroundColor: "#100f0d",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, autoplayPolicy: "no-user-gesture-required" },
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
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(request.url).pathname)));
    if (!file.startsWith(ROOT)) return new Response("Non trovato", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // exported beats: ask where to save, starting from the Music folder
  session.defaultSession.on("will-download", (_event, item) => {
    if (process.env.MATTONE_SAVE_DIR) item.setSavePath(path.join(process.env.MATTONE_SAVE_DIR, item.getFilename()));   // automated tests
    else item.setSaveDialogOptions({ title: "Salva il beat", defaultPath: path.join(app.getPath("music"), item.getFilename()) });
  });
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
