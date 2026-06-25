<template>
  <div v-if="loading" class="loading">
    <div class="spinner"></div>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
// 通用加载态组件，只负责展示，不持有异步状态。
interface Props {
  loading: boolean
  message?: string
}

defineProps<Props>()
</script>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  gap: var(--spacing-md);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading p {
  font-size: 14px;
  opacity: 0.7;
}
</style>
