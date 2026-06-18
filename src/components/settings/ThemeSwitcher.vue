<template>
  <div class="theme-switcher">
    <h3>主题风格</h3>
    <div class="themes-grid">
      <div
        v-for="theme in themes"
        :key="theme.value"
        class="theme-card"
        :class="{ active: settingsStore.theme === theme.value }"
        @click="handleThemeChange(theme.value)"
      >
        <div class="theme-preview" :class="`preview-${theme.value}`">
          <div class="preview-card"></div>
        </div>
        <div class="theme-info">
          <h4>{{ theme.label }}</h4>
          <p>{{ theme.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import type { ThemeType } from '@/stores/settings'

const settingsStore = useSettingsStore()

const themes = [
  {
    value: 'glass' as ThemeType,
    label: '毛玻璃',
    description: '半透明拟态化设计'
  },
  {
    value: 'cyberpunk' as ThemeType,
    label: '赛博朋克',
    description: '霓虹色发光效果'
  }
]

function handleThemeChange(theme: ThemeType) {
  settingsStore.updateTheme(theme)
}
</script>

<style scoped>
.theme-switcher {
  padding: var(--spacing-lg);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-switcher h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.theme-card {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  transition: all var(--transition-fast);
}

.theme-card:hover {
  border-color: rgba(102, 126, 234, 0.3);
}

.theme-card.active {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.05);
}

.theme-preview {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.preview-card {
  width: 60px;
  height: 40px;
  border-radius: 8px;
}

/* 主题预览样式 */
.preview-glass {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.preview-glass .preview-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.preview-cyberpunk {
  background: #0a0e27;
}

.preview-cyberpunk .preview-card {
  background: #0a0e27;
  border: 2px solid #00ffff;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.theme-info h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.theme-info p {
  font-size: 12px;
  opacity: 0.7;
}
</style>
