<script setup lang="ts">
import type { AppSettings } from '../types'

const props = defineProps<{
  settings: AppSettings
}>()

const emit = defineEmits<{
  save: []
}>()

const newSource = ref('')

import { ref } from 'vue'

function addSource() {
  const s = newSource.value.trim()
  if (s && !props.settings.preferredSources.includes(s)) {
    props.settings.preferredSources.push(s)
    newSource.value = ''
  }
}

function removeSource(index: number) {
  props.settings.preferredSources.splice(index, 1)
}
</script>

<template>
  <div class="general-tab">
    <div class="scroll-area">
      <section>
        <h3>高优影视作品</h3>
        <p class="desc">获取例句时会优先从这些作品中查找</p>
        <div class="source-list">
          <div v-for="(source, i) in settings.preferredSources" :key="i" class="source-item">
            <span>{{ source }}</span>
            <button class="remove-btn" @click="removeSource(i)">×</button>
          </div>
        </div>
        <div class="input-row">
          <input v-model="newSource" placeholder="输入作品名称，如 Friends" @keyup.enter="addSource" />
          <button @click="addSource">添加</button>
        </div>
      </section>

      <section>
        <h3>大模型配置</h3>
        <label class="toggle-row">
          <input type="checkbox" v-model="settings.useLLM" />
          <span>启用大模型搜索影视例句</span>
        </label>
        <div v-if="settings.useLLM" class="llm-config">
          <input v-model="settings.llmApiUrl" placeholder="API地址（默认OpenAI）" />
          <input v-model="settings.llmApiKey" type="password" placeholder="API Key" />
          <input v-model="settings.llmModel" placeholder="模型名称，如 gpt-3.5-turbo" />
        </div>
      </section>

      <section>
        <h3>自动切换</h3>
        <label class="toggle-row">
          <input type="checkbox" v-model="settings.autoSwitch" />
          <span>自动切换单词</span>
        </label>
        <div v-if="settings.autoSwitch" class="interval-row">
          <span>间隔</span>
          <input type="number" v-model="settings.switchInterval" min="5" max="300" />
          <span>秒</span>
        </div>
      </section>
    </div>

    <button class="save-btn" @click="emit('save')">保存设置</button>
  </div>
</template>

<style scoped>
.general-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
}

section {
  margin-bottom: 20px;
}

.save-btn {
  flex-shrink: 0;
}

h3 {
  font-size: 14px;
  margin: 0 0 8px 0;
}

.desc {
  font-size: 12px;
  color: #999;
  margin: 0 0 8px 0;
}

.source-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f0f0f5;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #999;
  padding: 0;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.input-row button, .save-btn {
  padding: 6px 14px;
  border: none;
  background: #4a4aff;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.save-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.llm-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.llm-config input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.interval-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
}

.interval-row input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

@media (prefers-color-scheme: dark) {
  .source-item { background: #3a3a4e; }
  input { background: #2a2a2e; color: #eee; border-color: #555; }
}
</style>
