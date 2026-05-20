import type { VocabEntry, AppSettings, WordLearningState } from './types'

export interface ElectronAPI {
  getBooks: () => Promise<{ id: string; name: string }[]>
  getBookWords: (bookId: string) => Promise<VocabEntry[]>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<boolean>
  getLearningState: () => Promise<Record<string, WordLearningState>>
  saveLearningState: (state: Record<string, WordLearningState>) => Promise<boolean>
  importDialogues: () => Promise<{ fileName: string; content: string } | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
