<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
const fetching = ref(false)
const preview = ref<MovieExample | null>(null)
const showRealExam = ref(false)

const currentWord = computed(() => {
  if (words.value.length === 0) return null
  return words.value[currentIndex.value]
})

const wordContent = computed(() => {
  return currentWord.value?.content.word.content ?? null
})

const wordId = computed(() => {
  return currentWord.value?.content.word.wordId ?? ''
})

// 当前单词的影视例句（用户保存的）
const savedMovieExample = computed(() => {
  const state = learningState.value[wordId.value]
  if (!state || state.movieExamples.length === 0) return null
  return state.movieExamples[0]
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
  preview.value = null
  showRealExam.value = false
}

function prevWord() {
  if (words.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + words.value.length) % words.value.length
  preview.value = null
  showRealExam.value = false
}

function speak() {
  if (!currentWord.value) return
  const utterance = new SpeechSynthesisUtterance(currentWord.value.headWord)
  utterance.lang = 'en-US'
  speechSynthesis.speak(utterance)
}

// 调用大模型获取影视例句
async function fetchExample() {
  if (!currentWord.value || !settings.value) return
  if (!settings.value.useLLM || !settings.value.llmApiKey) {
    alert('请先在设置中配置大模型API')
    return
  }

  fetching.value = true
  preview.value = null

  try {
    const word = currentWord.value.headWord
    const trans = wordContent.value?.trans?.map(t => t.tranCn).join('；') || ''
    const sources = settings.value.preferredSources.join('、')

    const prompt = `请为英语单词"${word}"（意思：${trans}）找一个在影视作品或音乐中的真实使用例句。优先从以下作品中查找：${sources}。

请返回严格JSON格式（不要其他内容）：
{
  "sentence": "英文原句",
  "translation": "中文翻译",
  "source": "来源，如 Friends S01E03",
  "sourceType": "tv 或 movie 或 music",
  "image": "一个能代表这个场景的图片URL（如果没有就留空字符串）"
}`

    const response = await fetch(settings.value.llmApiUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.value.llmApiKey}`,
      },
      body: JSON.stringify({
        model: settings.value.llmModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      }),
    })
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (content) {
      const parsed = JSON.parse(content)
      preview.value = {
        sentence: parsed.sentence,
        translation: parsed.translation,
        source: parsed.source,
        sourceType: parsed.sourceType || 'tv',
        image: parsed.image || undefined,
      }
    }
  } catch (e: any) {
    alert('获取失败: ' + e.message)
  } finally {
    fetching.value = false
  }
}

// 保存预览结果
async function savePreview() {
  if (!preview.value || !wordId.value) return
  const id = wordId.value
  if (!learningState.value[id]) {
    learningState.value[id] = { wordId: id, movieExamples: [] }
  }
  learningState.value[id].movieExamples.unshift(preview.value)
  if (preview.value.image) {
    learningState.value[id].image = preview.value.image
  }
  await window.electronAPI.saveLearningState(learningState.value)
  preview.value = null
}

// 换一个
function tryAnother() {
  preview.value = null
  fetchExample()
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

      <!-- 获取影视例句按钮 -->
      <div class="fetch-area" v-if="!preview && !fetching">
        <button class="fetch-btn" @click="fetchExample"><i class="bi bi-film"></i></button>
      </div>
      <div class="fetch-area" v-if="fetching">
        <span class="fetching-text">...</span>
      </div>

      <!-- 影视例句（用户保存的） -->
      <div class="word-example movie" v-if="savedMovieExample && !preview">
        <p class="section-label">影视例句</p>
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
      <div class="preview-area" v-if="preview">
        <div class="preview-label">预览（未保存）</div>
        <div class="word-example preview">
          <p class="example-sentence">"{{ preview.sentence }}"</p>
          <p class="example-translation">{{ preview.translation }}</p>
          <p class="example-source">—— {{ preview.source }}</p>
        </div>
        <div class="preview-actions">
          <button class="action-btn save" @click="savePreview"><i class="bi bi-check-lg"></i> 保存</button>
          <button class="action-btn retry" @click="tryAnother"><i class="bi bi-arrow-clockwise"></i> 换一个</button>
        </div>
      </div>

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
  </div>
</template>

<style scoped>
.bi {
  cursor: pointer;
  pointer-events: none;
}

.word-wrapper {
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
  padding: 16px 16px 16px 24px;
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
  font-size: 32px;
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
  font-size: 15px;
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
  background: #e0e0e5;
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

.word-example.preview {
  border: 2px dashed #667eea;
  background: #f8f8ff;
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
.preview-area {
  margin-bottom: 10px;
}

.preview-label {
  font-size: 10px;
  color: #667eea;
  margin-bottom: 4px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: transform 0.1s;
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn.save {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.action-btn.retry {
  background: #f0f0f3;
  color: #666;
}

.action-btn.retry:hover {
  background: #e8e8eb;
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

.fetching-text {
  font-size: 13px;
  color: #999;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
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

@media (prefers-color-scheme: dark) {
  .word-card { background: linear-gradient(135deg, #1a1a2e, #16162a); }
  .word-text { color: #f0f0f5; }
  .word-translation { color: #ccc; }
  .word-eng-def { color: #888; }
  .word-phonetic { background: #2a2a3e; color: #aaa; }
  .word-phonetic:hover { background: #33334a; }
  .phonetic-tooltip { background: #555; }
  .phonetic-tooltip::before { border-bottom-color: #555; }
  .hover-reveal { background: #3a3a4a !important; color: transparent !important; }
  .hover-reveal:hover { color: inherit !important; background: transparent !important; }
  .word-example { background: #222236; box-shadow: none; }
  .word-example.preview { background: #252545; border-color: #667eea; }
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
  .fetch-btn { background: #667eea15; color: #8a9aff; }
  .fetch-btn:hover { background: #667eea25; }
  .action-btn.retry { background: #2a2a3e; color: #bbb; }
}
</style>
