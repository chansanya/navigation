<template>
  <div class="preset-config">
    <h3>全局预设</h3>

    <div class="title-row">
      <label>站点名称</label>
      <input
        :value="settingsStore.siteTitle"
        type="text"
        maxlength="24"
        placeholder="Nav"
        @input="handleSiteTitleInput"
      />
    </div>

    <div class="title-row">
      <label>主页 Logo</label>
      <input
        :value="settingsStore.siteLogo"
        type="url"
        maxlength="500"
        placeholder="https://example.com/logo.png"
        @input="handleSiteLogoInput"
      />
    </div>
    <p class="logo-hint">支持 http/https 或站内 / 路径，显示限制为 40x40，留空或加载失败时使用默认图标。</p>

    <div class="preset-row">
      <input
        v-model="presetName"
        type="text"
        maxlength="24"
        placeholder="预设名"
        @keyup.enter="handleCreatePreset"
      />
      <button type="button" class="btn-primary" :disabled="!presetName.trim()" @click="handleCreatePreset">
        新增预设
      </button>
      <button type="button" class="btn-secondary" @click="settingsStore.initializeSettings">
        初始化
      </button>
    </div>

    <div v-if="settingsStore.presets.length > 0" class="preset-grid">
      <button
        v-for="preset in settingsStore.presets"
        :key="preset.id"
        type="button"
        class="preset-card"
        :class="{ active: selectedPresetId === preset.id }"
        @click="applyPreset(preset.id)"
      >
        <span class="preset-preview" :style="getPreviewStyle(preset)">
          <span class="preview-topbar" :style="{ background: preset.appearance.topbarBgColor, borderColor: preset.appearance.topbarBorderColor }"></span>
          <span class="preview-body">
            <span class="preview-menu" :style="{ background: preset.appearance.menuBgColor, borderColor: preset.appearance.menuBorderColor }">
              <span :style="{ background: preset.appearance.menuActiveBgColor }"></span>
            </span>
            <span class="preview-card-sample" :style="{ background: preset.appearance.cardBgColor, borderColor: preset.appearance.cardBorderColor }"></span>
          </span>
        </span>
        <span class="preset-info">
          <strong>{{ preset.name }}</strong>
          <small>{{ preset.siteTitle }} · {{ getPresetMeta(preset) }}</small>
        </span>
      </button>
    </div>
    <p v-else class="empty-presets">暂无预设</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type { SettingsPreset } from '@/stores/settings'

const settingsStore = useSettingsStore()
const presetName = ref('')
const selectedPresetId = ref('')

watch(() => settingsStore.presets, (presets) => {
  if (selectedPresetId.value && !presets.some(preset => preset.id === selectedPresetId.value)) {
    selectedPresetId.value = ''
  }
}, { deep: true })

function handleCreatePreset() {
  const created = settingsStore.createPreset(presetName.value)
  if (!created) return

  const savedPreset = settingsStore.presets.find(preset => preset.name === presetName.value.trim())
  selectedPresetId.value = savedPreset?.id || ''
  presetName.value = ''
}

function handleSiteTitleInput(event: Event) {
  settingsStore.updateSiteTitle((event.target as HTMLInputElement).value)
}

function handleSiteLogoInput(event: Event) {
  settingsStore.updateSiteLogo((event.target as HTMLInputElement).value)
}

function applyPreset(id: string) {
  if (settingsStore.applyPreset(id)) {
    selectedPresetId.value = id
  }
}

function getPreviewStyle(preset: SettingsPreset) {
  if (preset.background.type === 'image') {
    return {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url(${preset.background.value})`
    }
  }

  if (preset.background.type === 'video') {
    return {
      backgroundColor: '#111827'
    }
  }

  return {
    backgroundColor: '#0a0e27'
  }
}

function getPresetMeta(preset: SettingsPreset) {
  const themeLabel = preset.theme === 'cyberpunk' ? '赛博朋克' : '毛玻璃'
  const backgroundLabelMap = {
    image: '图片',
    particles: '粒子',
    video: '视频'
  } as const
  const backgroundLabel = backgroundLabelMap[preset.background.type]
  return `${themeLabel} / ${backgroundLabel}`
}
</script>

<style scoped>
.preset-config {
  padding: var(--spacing-lg);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.preset-config h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
}

.title-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  font-size: 13px;
}

.title-row input {
  min-width: 0;
  height: 36px;
  padding: 0 var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.92);
  color: #111827;
}

.logo-hint {
  margin: -2px 0 var(--spacing-md) 72px;
  font-size: 12px;
  line-height: 1.5;
  color: currentColor;
  opacity: 0.58;
}

.preset-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.preset-row input {
  min-width: 0;
  height: 36px;
  padding: 0 var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.92);
  color: #111827;
}

.btn-primary,
.btn-secondary {
  height: 36px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-secondary {
  background: rgba(127, 127, 127, 0.14);
  color: inherit;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
}

.preset-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  background: rgba(127, 127, 127, 0.12);
  color: inherit;
  border: 2px solid transparent;
  text-align: left;
}

.preset-card.active {
  border-color: var(--primary-color);
}

.preset-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 76px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.preview-topbar {
  display: block;
  height: 14px;
  border: 1px solid;
  border-radius: 3px;
}

.preview-body {
  display: grid;
  grid-template-columns: 34% 1fr;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.preview-menu,
.preview-card-sample {
  display: block;
  border: 1px solid;
  border-radius: 4px;
}

.preview-menu {
  padding: 4px;
}

.preview-menu span {
  display: block;
  height: 10px;
  border-radius: 3px;
}

.preset-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.preset-info strong,
.preset-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-info strong {
  font-size: 13px;
  font-weight: 700;
}

.preset-info small {
  font-size: 11px;
  opacity: 0.68;
}

.empty-presets {
  padding-top: var(--spacing-xs);
  font-size: 13px;
  opacity: 0.58;
}

@media (max-width: 480px) {
  .title-row,
  .preset-row {
    grid-template-columns: 1fr;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
