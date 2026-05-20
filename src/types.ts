// 与 vocabulary/json-full/*.json 中的结构一致

export interface VocabEntry {
  wordRank: number
  headWord: string
  content: {
    word: {
      wordHead: string
      wordId: string
      content: {
        usphone?: string
        ukphone?: string
        phone?: string
        usspeech?: string
        ukspeech?: string
        speech?: string
        star?: number
        trans?: { tranCn: string; descCn?: string; pos?: string; tranOther?: string; descOther?: string }[]
        sentence?: {
          sentences: {
            sContent: string
            sContent_eng?: string
            sSpeech?: string
            sCn: string
          }[]
          desc?: string
        }
        realExamSentence?: {
          sentences: {
            sContent: string
            sourceInfo?: {
              paper?: string
              level?: string
              year?: string
              type?: string
            }
          }[]
          desc?: string
        }
        phrase?: {
          phrases: { pContent: string; pCn: string }[]
          desc?: string
        }
        remMethod?: {
          val: string
          desc?: string
        }
        syno?: {
          synos: { pos: string; tran: string; hwds: { w: string }[] }[]
          desc?: string
        }
        relWord?: {
          rels: { pos: string; words: { hwd: string; tran: string }[] }[]
          desc?: string
        }
      }
    }
  }
  bookId: string
}

// 影视例句（通过大模型获取后附加到单词上）
export interface MovieExample {
  sentence: string
  translation: string
  source: string         // 如 "Friends S01E03"
  sourceType: 'tv' | 'movie' | 'music' | 'other'
  image?: string         // 场景图片URL
}

// 用户单词学习状态（存储在本地）
export interface WordLearningState {
  wordId: string         // 对应 VocabEntry.content.word.wordId
  movieExamples: MovieExample[]  // 用户保存的影视例句
  image?: string         // 用户保存的图片
}

export interface AppSettings {
  preferredSources: string[]  // 高优影视作品列表
  useLLM: boolean
  llmApiKey?: string
  llmApiUrl?: string
  llmModel?: string
  autoSwitch: boolean
  switchInterval: number      // 秒
  currentBook?: string        // 当前选择的词书，如 "CET4_1"
}
