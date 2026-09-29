const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: process.platform,
  isElectron: true,
  version: "0.1.0",
  print: () => ipcRenderer.invoke("print-document"),
  minimize: () => ipcRenderer.invoke("window-minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  close: () => ipcRenderer.invoke("window-close")
});
