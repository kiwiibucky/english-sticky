import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getBooks: () => ipcRenderer.invoke('get-books'),
  getBookWords: (bookId: string) => ipcRenderer.invoke('get-book-words', bookId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getLearningState: () => ipcRenderer.invoke('get-learning-state'),
  saveLearningState: (state: any) => ipcRenderer.invoke('save-learning-state', state),
  importDialogues: () => ipcRenderer.invoke('import-dialogues'),
})
