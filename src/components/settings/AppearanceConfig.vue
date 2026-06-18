<template>
  <div class="appearance-config">
    <div class="section-header">
      <h3>界面细节</h3>
    </div>

    <div class="control-section">
      <h4>顶部栏</h4>
      <div class="control-row">
        <label>背景</label>
        <input
          type="color"
          :value="settingsStore.appearance.topbarBgColor"
          @input="handleColorInput('topbarBgColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>文字</label>
        <input
          type="color"
          :value="settingsStore.appearance.topbarTextColor"
          @input="handleColorInput('topbarTextColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>边框</label>
        <input
          type="color"
          :value="settingsStore.appearance.topbarBorderColor"
          @input="handleColorInput('topbarBorderColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>透明度</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settingsStore.appearance.topbarOpacity"
          @input="handleOpacityInput('topbarOpacity', $event)"
        />
        <span>{{ formatPercent(settingsStore.appearance.topbarOpacity) }}</span>
      </div>
      <div class="control-row">
        <label>粗细</label>
        <input
          type="range"
          min="300"
          max="900"
          step="100"
          :value="settingsStore.appearance.topbarFontWeight"
          @input="handleWeightInput('topbarFontWeight', $event)"
        />
        <span>{{ settingsStore.appearance.topbarFontWeight }}</span>
      </div>
    </div>

    <div class="control-section">
      <h4>分类菜单</h4>
      <div class="control-row">
        <label>背景</label>
        <input
          type="color"
          :value="settingsStore.appearance.menuBgColor"
          @input="handleColorInput('menuBgColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>选中</label>
        <input
          type="color"
          :value="settingsStore.appearance.menuActiveBgColor"
          @input="handleColorInput('menuActiveBgColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>文字</label>
        <input
          type="color"
          :value="settingsStore.appearance.menuTextColor"
          @input="handleColorInput('menuTextColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>边框</label>
        <input
          type="color"
          :value="settingsStore.appearance.menuBorderColor"
          @input="handleColorInput('menuBorderColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>透明度</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settingsStore.appearance.menuOpacity"
          @input="handleOpacityInput('menuOpacity', $event)"
        />
        <span>{{ formatPercent(settingsStore.appearance.menuOpacity) }}</span>
      </div>
      <div class="control-row">
        <label>粗细</label>
        <input
          type="range"
          min="300"
          max="900"
          step="100"
          :value="settingsStore.appearance.menuFontWeight"
          @input="handleWeightInput('menuFontWeight', $event)"
        />
        <span>{{ settingsStore.appearance.menuFontWeight }}</span>
      </div>
    </div>

    <div class="control-section">
      <h4>网站卡片</h4>
      <div class="control-row">
        <label>背景</label>
        <input
          type="color"
          :value="settingsStore.appearance.cardBgColor"
          @input="handleColorInput('cardBgColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>文字</label>
        <input
          type="color"
          :value="settingsStore.appearance.cardTextColor"
          @input="handleColorInput('cardTextColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>边框</label>
        <input
          type="color"
          :value="settingsStore.appearance.cardBorderColor"
          @input="handleColorInput('cardBorderColor', $event)"
        />
      </div>
      <div class="control-row">
        <label>透明度</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settingsStore.appearance.cardOpacity"
          @input="handleOpacityInput('cardOpacity', $event)"
        />
        <span>{{ formatPercent(settingsStore.appearance.cardOpacity) }}</span>
      </div>
      <div class="control-row">
        <label>粗细</label>
        <input
          type="range"
          min="300"
          max="900"
          step="100"
          :value="settingsStore.appearance.cardFontWeight"
          @input="handleWeightInput('cardFontWeight', $event)"
        />
        <span>{{ settingsStore.appearance.cardFontWeight }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import type { AppearanceConfig } from '@/stores/settings'

type ColorKey =
  | 'topbarBgColor'
  | 'topbarTextColor'
  | 'topbarBorderColor'
  | 'menuBgColor'
  | 'menuActiveBgColor'
  | 'menuTextColor'
  | 'menuBorderColor'
  | 'cardBgColor'
  | 'cardTextColor'
  | 'cardBorderColor'
type OpacityKey = 'topbarOpacity' | 'menuOpacity' | 'cardOpacity'
type WeightKey = 'topbarFontWeight' | 'menuFontWeight' | 'cardFontWeight'

const settingsStore = useSettingsStore()

function getInputValue(event: Event) {
  return (event.target as HTMLInputElement).value
}

function handleColorInput(key: ColorKey, event: Event) {
  settingsStore.updateAppearance({
    [key]: getInputValue(event)
  } as Partial<AppearanceConfig>)
}

function handleOpacityInput(key: OpacityKey, event: Event) {
  settingsStore.updateAppearance({
    [key]: Number(getInputValue(event))
  } as Partial<AppearanceConfig>)
}

function handleWeightInput(key: WeightKey, event: Event) {
  settingsStore.updateAppearance({
    [key]: Number(getInputValue(event))
  } as Partial<AppearanceConfig>)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
</script>

<style scoped>
.appearance-config {
  padding: var(--spacing-lg);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.control-section {
  padding: var(--spacing-md) 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.control-section h4 {
  margin-bottom: var(--spacing-sm);
  font-size: 13px;
  font-weight: 600;
  color: currentColor;
  opacity: 0.72;
}

.control-row {
  display: grid;
  grid-template-columns: 64px 1fr 44px;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 36px;
  font-size: 13px;
}

.control-row label {
  color: currentColor;
}

.control-row input[type="color"] {
  width: 42px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.control-row input[type="range"] {
  width: 100%;
  accent-color: var(--primary-color);
}

.control-row span {
  color: currentColor;
  font-size: 12px;
  text-align: right;
  opacity: 0.68;
}
</style>
