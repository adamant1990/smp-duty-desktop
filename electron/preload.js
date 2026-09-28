const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: process.platform,
  isElectron: true,
  version: "0.1.0",
  print: () => ipcRenderer.invoke("print-document")
});
