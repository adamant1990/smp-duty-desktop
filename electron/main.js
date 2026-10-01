import { app, BrowserWindow, shell, ipcMain, Menu, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const credentialsFile = path.join(app.getPath("userData"), "login.dat");

Menu.setApplicationMenu(null);

ipcMain.handle("print-document", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: "Окно приложения не найдено." };

  return new Promise((resolve) => {
    win.webContents.print({
      silent: false,
      printBackground: true,
      color: true,
      margins: { marginType: "none" },
      pageSize: "A4"
    }, (success, failureReason) => {
      resolve({ success, failureReason: failureReason || "" });
    });
  });
});

ipcMain.handle("credentials-load", () => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    if (!fs.existsSync(credentialsFile)) return null;
    const encrypted = Buffer.from(fs.readFileSync(credentialsFile, "utf8"), "base64");
    const payload = safeStorage.decryptString(encrypted);
    return JSON.parse(payload);
  } catch {
    return null;
  }
});

ipcMain.handle("credentials-save", (_event, credentials) => {
  if (!safeStorage.isEncryptionAvailable()) return false;
  try {
    const payload = JSON.stringify({
      email: String(credentials?.email || ""),
      password: String(credentials?.password || "")
    });
    const encrypted = safeStorage.encryptString(payload).toString("base64");
    fs.writeFileSync(credentialsFile, encrypted, { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("credentials-clear", () => {
  try {
    if (fs.existsSync(credentialsFile)) fs.unlinkSync(credentialsFile);
    return true;
  } catch {
    return false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: "#f5f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Restore renderer keyboard focus whenever the native window regains focus.
  // This also covers returning from native dialogs such as window.confirm().
  win.on("focus", () => {
    if (!win.isDestroyed()) win.webContents.focus();
  });

  ipcMain.removeHandler("window-minimize");
  ipcMain.removeHandler("window-toggle-maximize");
  ipcMain.removeHandler("window-close");

  ipcMain.handle("window-minimize", () => {
    win.minimize();
  });

  ipcMain.handle("window-toggle-maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  });

  ipcMain.handle("window-close", () => {
    win.close();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
