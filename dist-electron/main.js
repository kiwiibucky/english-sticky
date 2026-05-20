import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const VOCAB_DIR = path.join(process.env.APP_ROOT, "vocabulary", "json-full");
const DATA_DIR = path.join(app.getPath("userData"), "english-sticky-data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const LEARNING_STATE_FILE = path.join(DATA_DIR, "learning-state.json");
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJSON(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
  }
  return defaultValue;
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
const DEFAULT_SETTINGS = {
  preferredSources: ["Friends"],
  useLLM: false,
  llmApiKey: "",
  llmApiUrl: "",
  llmModel: "gpt-3.5-turbo",
  autoSwitch: true,
  switchInterval: 30,
  currentBook: "CET4_1"
};
function registerIPC() {
  ensureDataDir();
  ipcMain.handle("get-books", () => {
    if (!fs.existsSync(VOCAB_DIR)) return [];
    const files = fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => ({
      id: f.replace(".json", ""),
      name: f.replace(".json", "").replace(/_/g, " ")
    }));
  });
  ipcMain.handle("get-book-words", (_event, bookId) => {
    const filePath = path.join(VOCAB_DIR, `${bookId}.json`);
    return readJSON(filePath, []);
  });
  ipcMain.handle("get-settings", () => {
    return readJSON(SETTINGS_FILE, DEFAULT_SETTINGS);
  });
  ipcMain.handle("save-settings", (_event, settings) => {
    writeJSON(SETTINGS_FILE, settings);
    return true;
  });
  ipcMain.handle("get-learning-state", () => {
    return readJSON(LEARNING_STATE_FILE, {});
  });
  ipcMain.handle("save-learning-state", (_event, state) => {
    writeJSON(LEARNING_STATE_FILE, state);
    return true;
  });
  ipcMain.handle("import-dialogues", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "Text Files", extensions: ["txt"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, "utf-8");
    return { fileName: path.basename(filePath), content };
  });
  ipcMain.handle("save-image", (_event, base64Data, wordId) => {
    const imagesDir = path.join(DATA_DIR, "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    const fileName = `${wordId}_${Date.now()}.png`;
    const filePath = path.join(imagesDir, fileName);
    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64");
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });
}
let win;
async function createWindow() {
  win = new BrowserWindow({
    width: 250,
    height: 200,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    skipTaskbar: false,
    frame: false,
    titleBarStyle: "hiddenInset",
    transparent: false,
    resizable: true,
    movable: true,
    fullscreenable: false,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "floating");
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIPC();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
