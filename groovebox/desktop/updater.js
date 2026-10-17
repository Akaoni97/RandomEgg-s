// Updates. The repo also hosts other projects' releases, so the repo-wide "latest release" is not ours:
// look up the newest "mattone-v*" release by tag and use that release's own files as the update feed.
// Windows installer and Linux AppImage update themselves; the unsigned Mac build and the portable
// Windows build cannot, so they get a notice that opens the download page.
const { app, dialog, shell, net } = require("electron");
const { autoUpdater } = require("electron-updater");

const PREFIX = "mattone-v";
const API = process.env.MATTONE_UPDATE_API || "https://api.github.com/repos/Akaoni97/RandomEgg-s/releases?per_page=50";   // tests use a local server
const CHANNEL = process.platform === "win32" ? "latest.yml" : process.platform === "linux" ? "latest-linux.yml" : null;
const SELF_UPDATE = (process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_DIR) || (process.platform === "linux" && !!process.env.APPIMAGE);

const log = (...a) => console.log("[aggiornamenti]", ...a);

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

async function notify(win, rel) {
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

function selfUpdate(win, rel) {
  autoUpdater.logger = { info: log, warn: log, error: log, debug() {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;   // "Più tardi" still installs it when the app is closed
  autoUpdater.setFeedURL({ provider: "generic", url: rel.feed });
  autoUpdater.once("update-downloaded", async (info) => {
    log("scaricata", info.version);
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "Aggiornamento Mat.Tone",
      message: `Mat.Tone ${info.version} è pronta`,
      detail: "Riavvia ora per usarla, oppure verrà installata quando chiudi l'app. Pattern e impostazioni restano.",
      buttons: ["Riavvia ora", "Più tardi"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });
  autoUpdater.once("error", (e) => { log("errore", e.message); notify(win, rel); });
  autoUpdater.checkForUpdates().catch(() => {});   // failures arrive through the "error" event
}

async function checkForUpdates(win) {
  if (!app.isPackaged) return;
  try {
    const rel = await latestRelease();
    if (!rel || !newer(rel.version, app.getVersion())) return log("nessun aggiornamento, versione", app.getVersion());
    log("nuova versione", rel.version);
    if (SELF_UPDATE && rel.feed) selfUpdate(win, rel);
    else notify(win, rel);
  } catch (e) {
    log("controllo non riuscito:", e.message);   // offline: try again at the next start
  }
}

module.exports = { checkForUpdates };
