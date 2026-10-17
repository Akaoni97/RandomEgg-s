// The only bridge between the groovebox page and the app: version, update status, update check.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("matDesktop", {
  version: () => ipcRenderer.invoke("app-version"),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  onUpdate: fn => ipcRenderer.on("update-status", (_e, s) => fn(s)),
});
