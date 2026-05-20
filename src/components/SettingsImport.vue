<script setup lang="ts">
async function importDialogues() {
  const result = await window.electronAPI.importDialogues()
  if (result) {
    alert(`已导入: ${result.fileName}`)
  }
}
</script>

<template>
  <div class="import-tab">
    <section>
      <h3>导入影视对话</h3>
      <p class="desc">导入影视作品的对白文件，用于本地匹配例句（无需调用大模型）</p>
      <button class="import-btn" @click="importDialogues">选择文件导入</button>
      <p class="desc" style="margin-top: 12px;">
        JSON格式示例：
      </p>
      <pre class="code-block">[
  {
    "sentence": "How you doin'?",
    "translation": "你好吗？",
    "source": "Friends S01E03",
    "sourceType": "tv"
  }
]</pre>
    </section>
  </div>
</template>

<style scoped>
.import-tab {
  flex: 1;
  overflow-y: auto;
}

section {
  margin-bottom: 20px;
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

.import-btn {
  padding: 6px 14px;
  border: none;
  background: #4a4aff;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.code-block {
  background: #f5f5f7;
  padding: 10px;
  border-radius: 6px;
  font-size: 11px;
  overflow-x: auto;
  white-space: pre;
}

@media (prefers-color-scheme: dark) {
  .code-block { background: #2a2a3e; }
}
</style>
