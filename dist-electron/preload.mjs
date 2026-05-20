"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getBooks: () => electron.ipcRenderer.invoke("get-books"),
  getBookWords: (bookId) => electron.ipcRenderer.invoke("get-book-words", bookId),
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => electron.ipcRenderer.invoke("save-settings", settings),
  getLearningState: () => electron.ipcRenderer.invoke("get-learning-state"),
  saveLearningState: (state) => electron.ipcRenderer.invoke("save-learning-state", state),
  importDialogues: () => electron.ipcRenderer.invoke("import-dialogues")
});
