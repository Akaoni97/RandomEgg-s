// Updates. The repo also hosts other projects' releases, so the repo-wide "latest release" is not ours:
// look up the newest "mattone-v*" release by tag and use that release's own files as the update feed.
// Windows installer and Linux AppImage update themselves; the unsigned Mac build and the portable
// Windows build cannot, so they get a notice that opens the download page.
// Every step is shown in the groovebox (status pill on the top bar) and written to aggiornamenti.log.
const { app, dialog, shell, net } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

const PREFIX = "mattone-v";
const API = process.env.MATTONE_UPDATE_API || "https://api.github.com/repos/Akaoni97/RandomEgg-s/releases?per_page=50";   // tests use a local server
const CHANNEL = process.platform === "win32" ? "latest.yml" : process.platform === "linux" ? "latest-linux.yml" : null;
const SELF_UPDATE = (process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_DIR) || (process.platform === "linux" && !!process.env.APPIMAGE);

function log(...a) {
  console.log("[aggiornamenti]", ...a);
  try { fs.appendFileSync(path.join(app.getPath("userData"), "aggiornamenti.log"), new Date().toISOString() + " " + a.join(" ") + "\n"); } catch (e) { /* not writable */ }
}

let win = null, busy = false, ready = null;
// tell the page what is happening: { state, text, version, percent }
function status(s) {
  log(s.state, s.text || "");
  if (win && !win.isDestroyed()) win.webContents.send("update-status", s);
}

function newer(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
}

async function latestRelease() {
  const res = await net.fetch(API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Mat.Tone" } });
  if (!res.ok) throw new Error("GitHub ha risposto " + res.status);
  let best = null;
  for (const r of await res.json()) {
    if (r.draft || r.prerelease || !r.tag_name.startsWith(PREFIX)) continue;
    const version = r.tag_name.slice(PREFIX.length);
    if (!/^\d+\.\d+\.\d+$/.test(version) || (best && !newer(version, best.version))) continue;
    const feed = (r.assets || []).find(a => a.name === CHANNEL);
    best = { version, page: r.html_url, feed: feed ? feed.browser_download_url.slice(0, -CHANNEL.length) : null };
  }
  return best;
}

async function notify(rel) {
  status({ state: "manual", version: rel.version, text: "È uscita la " + rel.version + ": scaricala dalla pagina" });
  const { response } = await dialog.showMessageBox(win, {
    type: "info",
    title: "Aggiornamento Mat.Tone",
    message: `È uscita Mat.Tone ${rel.version}`,
    detail: `Hai la versione ${app.getVersion()}. Scarica la nuova versione e installala sopra questa: pattern e impostazioni restano.`,
    buttons: ["Scarica", "Più tardi"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) shell.openExternal(rel.page);
}

async function askRestart(version) {
  const { response } = await dialog.showMessageBox(win, {
    type: "info",
    title: "Aggiornamento Mat.Tone",
    message: `Mat.Tone ${version} è pronta`,
    detail: "Riavvia ora per usarla, oppure verrà installata quando chiudi l'app. Pattern e impostazioni restano.",
    buttons: ["Riavvia ora", "Più tardi"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
}

function selfUpdate(rel) {
  return new Promise(resolve => {
    autoUpdater.logger = { info: log, warn: log, error: log, debug() {} };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;   // "Più tardi" still installs it when the app is closed
    autoUpdater.setFeedURL({ provider: "generic", url: rel.feed });
    const off = () => { autoUpdater.removeListener("download-progress", onProgress); autoUpdater.removeListener("update-downloaded", onDone); autoUpdater.removeListener("error", onError); };
    const onProgress = p => status({ state: "download", version: rel.version, percent: Math.round(p.percent), text: "Scarico la " + rel.version + " · " + Math.round(p.percent) + "%" });
    const onDone = info => { off(); ready = info.version; status({ state: "ready", version: info.version, text: "La " + info.version + " è pronta: si installa quando chiudi" }); askRestart(info.version); resolve(); };
    const onError = e => { off(); status({ state: "error", version: rel.version, text: "Aggiornamento non riuscito: " + (e && e.message || e) }); notify(rel); resolve(); };
    autoUpdater.on("download-progress", onProgress); autoUpdater.once("update-downloaded", onDone); autoUpdater.once("error", onError);
    status({ state: "download", version: rel.version, percent: 0, text: "Scarico la " + rel.version + " in sottofondo…" });
    autoUpdater.checkForUpdates().catch(() => {});   // failures arrive through the "error" event
  });
}

// at start (manual = false) or from the "Controlla aggiornamenti" button
async function checkForUpdates(w, manual) {
  if (w) win = w;
  if (!app.isPackaged) return status({ state: "none", text: "Versione di prova: niente aggiornamenti" });
  if (ready) { status({ state: "ready", version: ready, text: "La " + ready + " è pronta: si installa quando chiudi" }); if (manual) askRestart(ready); return; }
  if (busy) return;
  busy = true;
  try {
    status({ state: "checking", text: "Cerco aggiornamenti…" });
    const rel = await latestRelease();
    if (!rel || !newer(rel.version, app.getVersion())) status({ state: "none", text: "Hai l'ultima versione (" + app.getVersion() + ")" });
    else if (SELF_UPDATE && rel.feed) await selfUpdate(rel);
    else await notify(rel);
  } catch (e) {
    status({ state: "offline", text: "Non riesco a controllare: " + e.message });   // offline: try again at the next start
  } finally { busy = false; }
}

module.exports = { checkForUpdates };
