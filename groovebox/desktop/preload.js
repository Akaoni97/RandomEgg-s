// The only bridge between the groovebox page and the app: version, update status, update check, the sample folders.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("matDesktop", {
  version: () => ipcRenderer.invoke("app-version"),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  onUpdate: fn => ipcRenderer.on("update-status", (_e, s) => fn(s)),
  foldersSet: list => ipcRenderer.invoke("folders-set", list),
  folderPick: () => ipcRenderer.invoke("folder-pick"),
  folderList: dir => ipcRenderer.invoke("folder-list", dir),
});
