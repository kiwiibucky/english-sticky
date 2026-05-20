<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AppSettings } from '../types'
import SettingsGeneral from '../components/SettingsGeneral.vue'
import SettingsBook from '../components/SettingsBook.vue'
import SettingsImport from '../components/SettingsImport.vue'

const emit = defineEmits<{
  back: []
}>()

const settings = ref<AppSettings>({
  preferredSources: ['Friends'],
  useLLM: false,
  llmApiKey: '',
  llmApiUrl: '',
  llmModel: 'gpt-3.5-turbo',
  autoSwitch: true,
  switchInterval: 30,
  currentBook: 'CET4_1',
})

const activeTab = ref<'general' | 'book' | 'import'>('general')
const saveMessage = ref('')

onMounted(async () => {
  settings.value = await window.electronAPI.getSettings()
})

async function saveSettings() {
  await window.electronAPI.saveSettings(JSON.parse(JSON.stringify(settings.value)))
  saveMessage.value = '设置已保存'
  setTimeout(() => { saveMessage.value = '' }, 2000)
}
</script>

<template>
  <div class="settings-page">
    <div class="save-toast" v-if="saveMessage">{{ saveMessage }}</div>
    <div class="settings-header">
      <button class="back-btn" @click="emit('back')"><i class="bi bi-chevron-left"></i></button>
      <h4>设置</h4>
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">通用</button>
      <button :class="{ active: activeTab === 'book' }" @click="activeTab = 'book'">词书</button>
      <button :class="{ active: activeTab === 'import' }" @click="activeTab = 'import'">导入</button>
    </div>

    <SettingsGeneral v-if="activeTab === 'general'" :settings="settings" @save="saveSettings" />
    <SettingsBook v-if="activeTab === 'book'" :settings="settings" @save="saveSettings" />
    <SettingsImport v-if="activeTab === 'import'" />
  </div>
</template>

<style scoped>
.bi {
  cursor: pointer;
}

.settings-page {
  height: 100vh;
  overflow: hidden;
  padding: 12px 16px 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-top: 16px;
}

.settings-header h2 {
  margin: 0;
  font-size: 18px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: inherit;
}

.back-btn:hover {
  background: #f0f0f0;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.tabs button {
  padding: 6px 12px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
}

.tabs button.active {
  background: #e8e8ff;
  color: #333;
  font-weight: 600;
}

.save-toast {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(102, 126, 234, 0.9);
  color: #fff;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 200;
}

@media (prefers-color-scheme: dark) {
  .tabs { border-color: #444; }
  .tabs button.active { background: #3a3a5e; color: #eee; }
  .back-btn:hover { background: #333; }
}
</style>
