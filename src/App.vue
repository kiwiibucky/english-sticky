<script setup lang="ts">
import { ref } from 'vue'
import WordCard from './views/WordCard.vue'
import Settings from './views/Settings.vue'

const showSettings = ref(false)
const wordCardRef = ref<InstanceType<typeof WordCard> | null>(null)

function openSettings() {
  showSettings.value = true
}

function backToCard() {
  showSettings.value = false
  // 返回时刷新单词列表
  wordCardRef.value?.loadWords()
}
</script>

<template>
  <Settings v-if="showSettings" @back="backToCard" />
  <WordCard v-else ref="wordCardRef" :on-open-settings="openSettings" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}
</style>
