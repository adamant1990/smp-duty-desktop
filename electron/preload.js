import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("desktopApp", {
  platform: process.platform,
  isElectron: true,
  version: "0.1.0"
});
