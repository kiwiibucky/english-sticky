import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// 词书目录（项目内置）
const VOCAB_DIR = path.join(process.env.APP_ROOT, 'vocabulary', 'json-full')

// 用户数据存储目录
const DATA_DIR = path.join(app.getPath('userData'), 'english-sticky-data')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const LEARNING_STATE_FILE = path.join(DATA_DIR, 'learning-state.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJSON(filePath: string, defaultValue: any = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch (e) { /* ignore */ }
  return defaultValue
}

function writeJSON(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

const DEFAULT_SETTINGS = {
  preferredSources: ['Friends'],
  useLLM: false,
  llmApiKey: '',
  llmApiUrl: '',
  llmModel: 'gpt-3.5-turbo',
  autoSwitch: true,
  switchInterval: 30,
  currentBook: 'CET4_1',
}

function registerIPC() {
  ensureDataDir()

  // 获取可用词书列表
  ipcMain.handle('get-books', () => {
    if (!fs.existsSync(VOCAB_DIR)) return []
    const files = fs.readdirSync(VOCAB_DIR).filter(f => f.endsWith('.json'))
    return files.map(f => ({
      id: f.replace('.json', ''),
      name: f.replace('.json', '').replace(/_/g, ' '),
    }))
  })

  // 获取某本词书的单词列表
  ipcMain.handle('get-book-words', (_event, bookId: string) => {
    const filePath = path.join(VOCAB_DIR, `${bookId}.json`)
    return readJSON(filePath, [])
  })

  // 获取设置
  ipcMain.handle('get-settings', () => {
    return readJSON(SETTINGS_FILE, DEFAULT_SETTINGS)
  })

  // 保存设置
  ipcMain.handle('save-settings', (_event, settings) => {
    writeJSON(SETTINGS_FILE, settings)
    return true
  })

  // 获取学习状态（影视例句、图片等用户附加数据）
  ipcMain.handle('get-learning-state', () => {
    return readJSON(LEARNING_STATE_FILE, {})
  })

  // 保存学习状态
  ipcMain.handle('save-learning-state', (_event, state) => {
    writeJSON(LEARNING_STATE_FILE, state)
    return true
  })

  // 导入对话文件
  ipcMain.handle('import-dialogues', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Text Files', extensions: ['txt'] },
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { fileName: path.basename(filePath), content }
  })
}

let win: BrowserWindow | null

async function createWindow() {
  win = new BrowserWindow({
    width: 250,
    height: 200,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    skipTaskbar: false,
    frame: false,
    titleBarStyle: 'hiddenInset',
    transparent: false,
    resizable: true,
    movable: true,
    fullscreenable: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setAlwaysOnTop(true, 'floating')

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIPC()
  createWindow()
})
