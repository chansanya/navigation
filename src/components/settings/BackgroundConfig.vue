<template>
  <div class="background-config">
    <h3>背景设置</h3>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-button"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <!-- 图片背景 -->
      <div v-if="activeTab === 'image'" class="config-image">
        <input
          v-model="imageUrl"
          type="url"
          class="image-input"
          placeholder="输入图片 URL"
          @change="handleImageChange"
        />
        <div v-if="imageUrl" class="image-preview">
          <img :src="imageUrl" alt="背景预览" @error="handleImageError" />
        </div>
      </div>

      <!-- 视频背景 -->
      <div v-if="activeTab === 'video'" class="config-video">
        <input
          v-model="videoUrl"
          type="url"
          class="media-input"
          placeholder="输入 MP4 / WebM URL"
          @change="handleVideoChange"
        />
        <div v-if="videoUrl" class="video-preview">
          <video :src="videoUrl" muted loop playsinline controls @error="handleVideoError"></video>
        </div>
      </div>

      <!-- 粒子效果 -->
      <div v-if="activeTab === 'particles'" class="config-particles">
        <p class="particles-desc">启用动态粒子背景效果（科技感十足）</p>
        <button class="btn-apply" @click="handleParticlesEnable">启用粒子效果</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

type TabType = 'image' | 'particles' | 'video'

const activeTab = ref<TabType>('particles')

const tabs = [
  { value: 'image' as TabType, label: '图片' },
  { value: 'video' as TabType, label: '视频' },
  { value: 'particles' as TabType, label: '粒子' }
]

// 图片
const imageUrl = ref('')
const videoUrl = ref('')

// 根据当前设置初始化值
watch(() => settingsStore.background, (bg) => {
  activeTab.value = bg.type
  if (bg.type === 'image') {
    imageUrl.value = bg.value
  } else if (bg.type === 'video') {
    videoUrl.value = bg.value
  }
}, { immediate: true })

function handleImageChange() {
  settingsStore.updateBackground({
    type: 'image',
    value: imageUrl.value
  })
}

function handleParticlesEnable() {
  settingsStore.updateBackground({
    type: 'particles',
    value: 'default'
  })
}

function handleVideoChange() {
  settingsStore.updateBackground({
    type: 'video',
    value: videoUrl.value
  })
}

function handleImageError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}

function handleVideoError(e: Event) {
  const target = e.target as HTMLVideoElement
  target.style.display = 'none'
}
</script>

<style scoped>
.background-config {
  padding: var(--spacing-lg);
}

.background-config h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  background: rgba(0, 0, 0, 0.05);
  padding: 4px;
  border-radius: var(--radius-md);
}

.tab-button {
  padding: var(--spacing-sm);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.tab-button.active {
  background: white;
  box-shadow: var(--shadow-sm);
}

.tab-content {
  padding: var(--spacing-md) 0;
}

/* 图片配置 */
.image-input,
.media-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
}

.image-preview {
  width: 100%;
  height: 150px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-preview {
  width: 100%;
  height: 150px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #0a0e27;
}

.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 粒子配置 */
.config-particles {
  text-align: center;
}

.particles-desc {
  font-size: 14px;
  margin-bottom: var(--spacing-md);
  opacity: 0.7;
}

.btn-apply {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--primary-color);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: opacity var(--transition-fast);
}

.btn-apply:hover {
  opacity: 0.9;
}
</style>
