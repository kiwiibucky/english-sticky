<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { VocabEntry, WordLearningState, MovieExample, AppSettings } from '../types'

defineProps<{
  onOpenSettings: () => void
}>()

const words = ref<VocabEntry[]>([])
const currentIndex = ref(0)
const loading = ref(true)
const learningState = ref<Record<string, WordLearningState>>({})
const settings = ref<AppSettings | null>(null)

// LLM 获取状态
const showRealExam = ref(false)

// 手动添加影视例句弹窗
const showAddModal = ref(false)
const newExample = ref({ sentence: '', translation: '', source: '', image: '' })
const imagePreview = ref('')  // 图片预览（base64 或 URL）
const movieExampleIndex = ref(0)

// 搜索功能
const showSearch = ref(false)
const searchQuery = ref('')
const searchHighlight = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return words.value
    .map((w, index) => ({ word: w.headWord, index }))
    .filter(item => item.word.toLowerCase().includes(q))
    .slice(0, 10)
})

function toggleSearch() {
  showSearch.value = !showSearch.value
  searchHighlight.value = 0
  if (showSearch.value) {
    nextTick(() => searchInputRef.value?.focus())
  }
}

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchHighlight.value = Math.min(searchHighlight.value + 1, searchResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchHighlight.value = Math.max(searchHighlight.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (searchResults.value.length > 0) {
      jumpToWord(searchResults.value[searchHighlight.value].index)
    }
  } else if (e.key === 'Escape') {
    showSearch.value = false
    searchQuery.value = ''
  }
}

const currentWord = computed(() => {
  if (words.value.length === 0) return null
  return words.value[currentIndex.value]
})

const wordContent = computed(() => {
  return currentWord.value?.content.word.content ?? null
})

const wordId = computed(() => {
  return currentWord.value?.headWord ?? ''
})

// 当前单词的影视例句（用户保存的）
const movieExamples = computed(() => {
  const state = learningState.value[wordId.value]
  if (!state || state.movieExamples.length === 0) return []
  return state.movieExamples
})

const savedMovieExample = computed(() => {
  if (movieExamples.value.length === 0) return null
  return movieExamples.value[movieExampleIndex.value % movieExamples.value.length]
})

// 当前单词的用户图片
const savedImage = computed(() => {
  return learningState.value[wordId.value]?.image
})

async function loadData() {
  loading.value = true
  settings.value = await window.electronAPI.getSettings()
  learningState.value = await window.electronAPI.getLearningState()
  const bookId = settings.value?.currentBook || 'CET4_1'
  const allWords = await window.electronAPI.getBookWords(bookId)
  // 打乱顺序
  for (let i = allWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allWords[i], allWords[j]] = [allWords[j], allWords[i]]
  }
  words.value = allWords
  currentIndex.value = 0
  loading.value = false
}

function nextWord() {
  if (words.value.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % words.value.length
  showRealExam.value = false
  movieExampleIndex.value = 0
}

function prevWord() {
  if (words.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + words.value.length) % words.value.length
  showRealExam.value = false
  movieExampleIndex.value = 0
}

function speak() {
  if (!currentWord.value) return
  const utterance = new SpeechSynthesisUtterance(currentWord.value.headWord)
  utterance.lang = 'en-US'
  speechSynthesis.speak(utterance)
}

// 打开手动添加弹窗
function openAddModal() {
  newExample.value = { sentence: '', translation: '', source: '', image: '' }
  imagePreview.value = ''
  showAddModal.value = true
}

// 保存手动添加的例句
async function saveManualExample() {
  if (!newExample.value.sentence || !wordId.value) return
  const id = wordId.value
  if (!learningState.value[id]) {
    learningState.value[id] = { wordId: id, movieExamples: [] }
  }

  let imagePath = newExample.value.image || undefined
  // 如果是粘贴的 base64 图片，保存为本地文件
  if (imagePreview.value && imagePreview.value.startsWith('data:image')) {
    imagePath = await window.electronAPI.saveImage(imagePreview.value, id)
  }

  learningState.value[id].movieExamples.push({
    sentence: newExample.value.sentence,
    translation: newExample.value.translation,
    source: newExample.value.source,
    sourceType: 'tv',
    image: imagePath,
  })
  await window.electronAPI.saveLearningState(JSON.parse(JSON.stringify(learningState.value)))
  showAddModal.value = false
  // 切换到刚添加的那条
  movieExampleIndex.value = learningState.value[id].movieExamples.length - 1
}

// 处理粘贴图片
function handleImagePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        imagePreview.value = reader.result as string
        newExample.value.image = ''  // 清空 URL 输入
      }
      reader.readAsDataURL(file)
      break
    }
  }
}

// URL 输入变更时更新预览
function onImageUrlChange() {
  if (newExample.value.image) {
    imagePreview.value = newExample.value.image
  } else {
    imagePreview.value = ''
  }
}

// 切换影视例句
function nextMovieExample() {
  if (movieExamples.value.length <= 1) return
  movieExampleIndex.value = (movieExampleIndex.value + 1) % movieExamples.value.length
}

// 搜索跳转
function jumpToWord(index: number) {
  currentIndex.value = index
  showSearch.value = false
  searchQuery.value = ''
  showRealExam.value = false
  movieExampleIndex.value = 0
}

onMounted(() => {
  loadData()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') prevWord()
  else if (e.key === 'ArrowRight') nextWord()
}

defineExpose({ loadWords: loadData })
</script>

<template>
  <div class="word-wrapper">
    <!-- 拖拽区域 -->
    <div class="drag-region"></div>
    <!-- 左右导航按钮（固定在两侧） -->
    <button v-if="currentWord" class="nav-btn nav-prev" @click="prevWord"><i class="bi bi-chevron-left"></i></button>
    <button v-if="currentWord" class="nav-btn nav-next" @click="nextWord"><i class="bi bi-chevron-right"></i></button>
    <!-- 设置按钮 -->
    <button class="settings-btn" @click="onOpenSettings"><i class="bi bi-gear"></i></button>
    <!-- 搜索按钮 -->
    <button class="search-btn" @click="toggleSearch"><i class="bi bi-search"></i></button>
    <!-- 搜索面板 -->
    <div class="search-panel" v-if="showSearch">
      <input
        ref="searchInputRef"
        class="search-input"
        v-model="searchQuery"
        placeholder="搜索单词..."
        @keydown.stop="handleSearchKeydown"
        @input="searchHighlight = 0"
      />
      <div class="search-results" v-if="searchResults.length > 0">
        <div
          class="search-result-item"
          :class="{ active: i === searchHighlight }"
          v-for="(item, i) in searchResults"
          :key="item.index"
          @click="jumpToWord(item.index)"
          @mouseenter="searchHighlight = i"
        >{{ item.word }}</div>
      </div>
    </div>

    <div class="word-card">
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!currentWord" class="empty-state">
        <p>暂无单词</p>
        <p class="hint">去设置中选择词书</p>
      </div>
      <template v-else>

      <!-- 场景图片 -->
      <div class="word-image" v-if="savedImage">
        <img :src="savedImage" :alt="currentWord.headWord" />
      </div>

      <!-- 单词主体 -->
      <div class="word-main">
        <div class="word-title-row">
          <span class="word-text-wrapper">
            <h1 class="word-text">{{ currentWord.headWord }}<button class="speak-btn" @click.stop="speak"><i class="bi bi-volume-up-fill"></i></button></h1>
            <div class="phonetic-tooltip" v-if="wordContent?.usphone || wordContent?.ukphone">
              <span class="phonetic-item" v-if="wordContent?.usphone">us /{{ wordContent.usphone }}/</span>
              <span class="phonetic-item" v-if="wordContent?.ukphone">uk /{{ wordContent.ukphone }}/</span>
            </div>
          </span>
        </div>
        <div class="word-translation hover-reveal">
          <p v-for="(t, i) in wordContent?.trans" :key="i" class="trans-item">
            <em class="pos">[{{ t.pos }}.]</em> {{ t.tranCn }}
          </p>
        </div>
        <!-- 英文释义 -->
        <p class="word-eng-def" v-if="wordContent?.trans?.some(t => t.tranOther)">
          <span v-for="(t, i) in wordContent.trans.filter(t => t.tranOther)" :key="i">
            {{ t.tranOther }}
          </span>
          </p>
      </div>

      <!-- 添加影视例句按钮 -->
      <div class="fetch-area">
        <button class="fetch-btn" @click="openAddModal"><i class="bi bi-film"></i></button>
      </div>

      <!-- 影视例句（用户保存的） -->
      <div class="word-example movie" v-if="savedMovieExample">
        <div class="section-label-row">
          <p class="section-label">影视例句</p>
          <span v-if="movieExamples.length > 1" class="movie-nav" @click="nextMovieExample">
            {{ movieExampleIndex + 1 }}/{{ movieExamples.length }} <i class="bi bi-chevron-right"></i>
          </span>
        </div>
        <img v-if="savedMovieExample.image" class="movie-image" :src="savedMovieExample.image" />
        <p class="example-sentence">"{{ savedMovieExample.sentence }}"</p>
        <p class="example-translation hover-reveal">{{ savedMovieExample.translation }}</p>
        <p class="example-source">—— {{ savedMovieExample.source }}</p>
      </div>

      <!-- 词书自带例句 -->
      <div class="word-example" v-if="wordContent?.sentence?.sentences?.length">
        <p class="section-label">例句</p>
        <div v-for="(s, i) in wordContent.sentence.sentences.slice(0, 2)" :key="i" class="example-item">
          <p class="example-sentence">"{{ s.sContent }}"</p>
          <p class="example-translation hover-reveal">{{ s.sCn }}</p>
        </div>
      </div>

      <!-- 短语 -->
      <div class="section-block" v-if="wordContent?.phrase?.phrases?.length">
        <p class="section-label">短语</p>
        <div v-for="(p, i) in wordContent.phrase.phrases.slice(0, 3)" :key="i" class="phrase-item">
          <span class="phrase-en">{{ p.pContent }}</span>
          <span class="phrase-cn hover-reveal">{{ p.pCn }}</span>
        </div>
      </div>

      <!-- 同近义词 -->
      <div class="section-block" v-if="wordContent?.syno?.synos?.length">
        <p class="section-label">同近义词</p>
        <div v-for="(s, i) in wordContent.syno.synos" :key="i" class="syno-item">
          <em class="pos">[{{ s.pos }}]</em>
          <span class="syno-words">{{ s.hwds.map(h => h.w).join(', ') }}</span>
        </div>
      </div>

      <!-- 同根词 -->
      <div class="section-block" v-if="wordContent?.relWord?.rels?.length">
        <p class="section-label">同根词</p>
        <div v-for="(r, i) in wordContent.relWord.rels" :key="i" class="rel-group">
          <div v-for="(w, j) in r.words" :key="j" class="rel-item">
            <em class="pos">[{{ r.pos }}]</em>
            <span class="rel-word">{{ w.hwd }}</span>
            <span class="rel-tran hover-reveal">{{ w.tran }}</span>
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <!-- 记忆方法 -->
      <div class="section-block rem-method" v-if="wordContent?.remMethod?.val">
        <span class="section-label">记忆</span>
        <span class="section-text">{{ wordContent.remMethod.val }}</span>
      </div>

      <!-- 真题例句（默认折叠） -->
      <div class="real-exam-section" v-if="wordContent?.realExamSentence?.sentences?.length">
        <button class="collapse-btn" @click="showRealExam = !showRealExam">
          <span>真题例句 ({{ wordContent.realExamSentence.sentences.length }})</span>
          <span class="collapse-arrow"><i :class="showRealExam ? 'bi bi-chevron-down' : 'bi bi-chevron-right'"></i></span>
        </button>
        <div class="word-example real-exam" v-if="showRealExam">
          <div v-for="(s, i) in wordContent.realExamSentence.sentences" :key="i" class="example-item">
            <p class="example-sentence">"{{ s.sContent }}"</p>
            <p class="example-source" v-if="s.sourceInfo">
              —— {{ s.sourceInfo.year }} {{ s.sourceInfo.level }} {{ s.sourceInfo.type }}
            </p>
          </div>
        </div>
      </div>

    </template>
    </div>

    <!-- 添加影视例句弹窗 -->
    <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
      <div class="modal-content">
        <h3>添加影视例句</h3>
        <div class="modal-form">
          <input v-model="newExample.sentence" placeholder="英文原句" />
          <input v-model="newExample.translation" placeholder="中文翻译" />
          <input v-model="newExample.source" placeholder="出处，如 Friends S01E03" />
          <div class="image-input-area">
            <input v-model="newExample.image" placeholder="图片URL（可选）" @input="onImageUrlChange" />
            <div class="paste-area" @paste="handleImagePaste" tabindex="0">
              <span v-if="!imagePreview">Ctrl+V 粘贴图片</span>
              <img v-else :src="imagePreview" class="image-preview" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showAddModal = false">取消</button>
          <button class="modal-btn save" @click="saveManualExample">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bi {
  cursor: pointer;
  pointer-events: none;
}

.word-wrapper {
  --mask-bg: #e0e0e5;
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  -webkit-app-region: drag;
  z-index: 100;
}

.word-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 22px 16px 16px 24px;
  box-sizing: border-box;
  overflow-y: overlay;
  background: linear-gradient(135deg, #667eea0a 0%, #764ba20a 100%);
}

.word-card::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.word-card::-webkit-scrollbar-track {
  background: transparent;
}

.word-card::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.word-card::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}

.word-image {
  width: 100%;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.word-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 单词主体 */
.word-main {
  text-align: center;
  margin-bottom: 8px;
  padding: 0 36px;
}

.word-title-row {
  display: flex;
  justify-content: center;
  margin-bottom: 0px;
}

.word-text-wrapper {
  position: relative;
  display: inline-block;
  cursor: default;
}

.word-text {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  color: #1a1a2e;
  letter-spacing: -0.5px;
  display: inline;
}

.speak-btn {
  position: absolute;
  right: -28px;
  top: 50%;
  transform: translateY(-40%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #bbb;
  padding: 4px;
  transition: color 0.2s;
}

.speak-btn:hover {
  color: #667eea;
}

.phonetic-tooltip {
  position: absolute;
  top: calc(100% + 0px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.phonetic-tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid #333;
}

.word-text-wrapper:hover .phonetic-tooltip {
  opacity: 1;
}

.phonetic-item {
  white-space: nowrap;
}

.word-translation {
  font-size: 12px;
  color: #444;
  margin: 0;
  line-height: 1.6;
}

.trans-item {
  margin: 0;
}

/* 核心：hover 显示隐藏内容 */
.hover-reveal {
  color: transparent !important;
  background: var(--mask-bg);
  border-radius: 4px;
  transition: all 0.25s ease;
  cursor: pointer;
  padding: 1px 4px;
  display: inline-block;
}

.hover-reveal:hover {
  color: inherit !important;
  background: transparent;
}

.pos {
  font-size: 11px;
  color: #aaa;
  margin-right: 2px;
  font-style: normal;
}

.word-eng-def {
  font-size: 12px;
  color: #999;
  margin: 6px 0 0 0;
  font-style: italic;
  line-height: 1.4;
}

.nav-counter {
  font-size: 10px;
  color: #ccc;
  margin-top: 6px;
  display: block;
  letter-spacing: 0.5px;
}

/* 导航按钮 - 固定在wrapper两侧居中 */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(102, 126, 234, 0.12);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
  transition: all 0.2s;
  z-index: 10;
}

.nav-btn:hover {
  background: rgba(102, 126, 234, 0.25);
  color: #4a5fd6;
}

.nav-prev {
  left: 4px;
}

.nav-next {
  right: 4px;
}

/* 区块样式 */
.section-block {
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 10px;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.section-block.rem-method {
  background: linear-gradient(135deg, #fff9e6, #fff3cd);
  border-left: 3px solid #ffc107;
}

.section-label {
  font-size: 10px;
  color: #bbb;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 4px;
}

.section-text {
  color: #555;
  font-size: 13px;
  line-height: 1.5;
}

/* 例句 */
.word-example {
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.word-example.movie {
  border-left: 3px solid #667eea;
}

.word-example.real-exam {
  border-left: 3px solid #ff6b6b;
  margin-top: 8px;
}

.example-item {
  margin-bottom: 8px;
}

.example-item:last-child {
  margin-bottom: 0;
}

.example-sentence {
  font-size: 13px;
  color: #333;
  font-style: italic;
  margin: 0 0 4px 0;
  line-height: 1.5;
}

.example-translation {
  font-size: 12px;
  color: #777;
  margin: 0 0 4px 0;
}

.example-source {
  font-size: 10px;
  color: #bbb;
  margin: 0;
  text-align: right;
}

/* 真题折叠 */
.real-exam-section {
  margin-bottom: 10px;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: #f0f0f3;
  cursor: pointer;
  font-size: 11px;
  color: #999;
  transition: background 0.2s;
}

.collapse-arrow {
  font-size: 11px;
}

/* 短语 */
.phrase-item {
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.phrase-en {
  color: #444;
  font-size: 13px;
}

.phrase-cn {
  color: #888;
  font-size: 12px;
}

.syno-item, .rel-item {
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.6;
}

.syno-item:last-child, .rel-item:last-child {
  margin-bottom: 0;
}

.syno-words {
  color: #555;
}

.rel-word {
  color: #333;
  font-weight: 500;
  margin-right: 6px;
}

.rel-tran {
  color: #888;
  font-size: 11px;
}

.rel-group {
  margin-bottom: 4px;
}

.rel-group:last-child {
  margin-bottom: 0;
}

/* 预览 */
/* 影视例句标题行 */
.section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.movie-nav {
  font-size: 11px;
  color: #667eea;
  cursor: pointer;
}

.movie-image {
  width: 100%;
  max-height: 120px;
  object-fit: cover;
  border-radius: 8px;
  margin: 6px 0;
}

/* 添加弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-form input {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}

.image-input-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.paste-area {
  border: 1.5px dashed #ccc;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #999;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.paste-area:focus {
  border-color: #667eea;
}

.image-preview {
  max-width: 100%;
  max-height: 80px;
  object-fit: contain;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.modal-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.modal-btn.cancel {
  background: #f0f0f3;
  color: #666;
}

.modal-btn.save {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

/* 获取按钮 */
.fetch-area {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.fetch-btn {
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
  transition: all 0.2s;
}

.fetch-btn:hover {
  /* background: linear-gradient(135deg, #667eea25, #764ba225); */
  transform: translateY(-1px);
}

/* 设置按钮 */
.settings-btn {
  position: absolute;
  top: 6px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #f0f0f5;
  font-size: 15px;
  cursor: pointer;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
  z-index: 101;
  -webkit-app-region: no-drag;
}

.settings-btn:hover {
  opacity: 1;
  cursor: pointer;
}

/* 搜索按钮 */
.search-btn {
  position: absolute;
  top: 6px;
  right: 46px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #f0f0f5;
  font-size: 13px;
  cursor: pointer;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
  z-index: 101;
  -webkit-app-region: no-drag;
}

.search-btn:hover {
  opacity: 1;
  cursor: pointer;
}

/* 搜索面板 */
.search-panel {
  position: absolute;
  top: 38px;
  right: 14px;
  width: 180px;
  z-index: 150;
  -webkit-app-region: no-drag;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-input:focus {
  border-color: #667eea;
}

.search-results {
  margin-top: 4px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  max-height: 150px;
  overflow-y: auto;
}

.search-result-item {
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
  transition: background 0.15s;
}

.search-result-item:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.search-result-item.active {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.search-result-item:first-child {
  border-radius: 8px 8px 0 0;
}

.search-result-item:last-child {
  border-radius: 0 0 8px 8px;
}

@media (prefers-color-scheme: dark) {
  .word-wrapper { --mask-bg: #e0e0e5; }
  .word-card { background: linear-gradient(135deg, #1a1a2e, #16162a); }
  .word-text { color: #f0f0f5; }
  .word-translation { color: #ccc; }
  .word-eng-def { color: #888; }
  .word-phonetic { background: #2a2a3e; color: #aaa; }
  .word-phonetic:hover { background: #33334a; }
  .phonetic-tooltip { background: #555; }
  .phonetic-tooltip::before { border-bottom-color: #555; }
  .hover-reveal { background: var(--mask-bg) !important; color: transparent !important; }
  .hover-reveal:hover { color: inherit !important; background: transparent !important; }
  .word-example { background: #222236; box-shadow: none; }
  .section-block { background: #222236; box-shadow: none; }
  .section-block.rem-method { background: #2a2518; }
  .section-text { color: #ccc; }
  .example-sentence { color: #ddd; }
  .example-translation { color: #999; }
  .phrase-en { color: #ddd; }
  .phrase-cn { color: #888; }
  .syno-words, .rel-word { color: #bbb; }
  .collapse-btn { background: #222236; border-color: transparent; color: #888; }
  .collapse-btn:hover { background: #2a2a3e; }
  .nav-btn { background: #2a2a3e; border: none; color: #aaa; opacity: 0.6; }
  .nav-btn:hover { background: #33334a; color: #eee; opacity: 1; }
  .settings-btn { background: #2a2a3e; }
  .search-btn { background: #2a2a3e; }
  .search-input { background: #2a2a3e; color: #eee; border-color: #555; }
  .search-input:focus { border-color: #8a9aff; }
  .search-results { background: #2a2a3e; }
  .search-result-item { color: #ddd; }
  .search-result-item:hover { background: rgba(138, 154, 255, 0.15); color: #a5b4fc; }
  .search-result-item.active { background: rgba(138, 154, 255, 0.15); color: #a5b4fc; }
  .fetch-btn { color: #8a9aff; }
  .fetch-btn:hover { color: #a5b4fc; }
  .modal-content { background: #2a2a3e; color: #eee; }
  .modal-form input { background: #1a1a2e; color: #eee; border-color: #555; }
  .paste-area { border-color: #555; color: #777; }
  .paste-area:focus { border-color: #8a9aff; }
  .modal-btn.cancel { background: #3a3a4e; color: #ccc; }
}
</style>
