<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AppSettings } from '../types'

const props = defineProps<{
  settings: AppSettings
}>()

const emit = defineEmits<{
  save: []
}>()

const books = ref<{ id: string; name: string }[]>([])

onMounted(async () => {
  books.value = await window.electronAPI.getBooks()
})
</script>

<template>
  <div class="book-tab">
    <div class="scroll-area">
      <h3>选择词书</h3>
      <p class="desc">当前：{{ settings.currentBook }}</p>
      <div class="book-list">
        <div
          v-for="book in books"
          :key="book.id"
          class="book-item"
          :class="{ active: settings.currentBook === book.id }"
          @click="settings.currentBook = book.id"
        >
          {{ book.name }}
        </div>
      </div>
    </div>
    <button class="save-btn" @click="emit('save')">保存选择</button>
  </div>
</template>

<style scoped>
.book-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
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

.book-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.book-item {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.book-item:hover {
  border-color: #4a4aff;
}

.book-item.active {
  background: #4a4aff;
  color: #fff;
  border-color: #4a4aff;
}

.save-btn {
  flex-shrink: 0;
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  border: none;
  background: #4a4aff;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

@media (prefers-color-scheme: dark) {
  .book-item { border-color: #555; color: #ccc; }
  .book-item.active { background: #4a4aff; color: #fff; }
}
</style>
