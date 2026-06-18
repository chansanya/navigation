<template>
  <div id="app" :class="themeClass" :style="appearanceStyle">
    <BackgroundLayer />
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useAuthStore } from './stores/auth'
import { usePrivacyStore } from './stores/privacy'
import BackgroundLayer from './components/layout/BackgroundLayer.vue'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const privacyStore = usePrivacyStore()

const themeClass = computed(() => `theme-${settingsStore.theme}`)

watch(() => settingsStore.siteTitle, (title) => {
  document.title = title.trim() || 'Nav'
}, { immediate: true })

function clampOpacity(value: number) {
  return Math.min(1, Math.max(0, value))
}

const appearanceStyle = computed(() => {
  const appearance = settingsStore.appearance
  const topbarOpacity = Math.round(clampOpacity(appearance.topbarOpacity) * 100)
  const menuOpacity = Math.round(clampOpacity(appearance.menuOpacity) * 100)
  const cardOpacity = Math.round(clampOpacity(appearance.cardOpacity) * 100)

  return {
    '--appearance-topbar-text-color': appearance.topbarTextColor,
    '--appearance-topbar-border-color': appearance.topbarBorderColor,
    '--appearance-topbar-font-weight': appearance.topbarFontWeight,
    '--appearance-topbar-bg': `color-mix(in srgb, ${appearance.topbarBgColor} ${topbarOpacity}%, transparent)`,
    '--appearance-topbar-control-bg': `color-mix(in srgb, ${appearance.topbarBgColor} 34%, transparent)`,
    '--appearance-topbar-control-bg-hover': `color-mix(in srgb, ${appearance.topbarBgColor} 48%, transparent)`,
    '--appearance-topbar-control-danger-bg': 'color-mix(in srgb, #ef4444 24%, transparent)',
    '--appearance-menu-text-color': appearance.menuTextColor,
    '--appearance-menu-border-color': appearance.menuBorderColor,
    '--appearance-menu-font-weight': appearance.menuFontWeight,
    '--appearance-menu-bg': `color-mix(in srgb, ${appearance.menuBgColor} ${menuOpacity}%, transparent)`,
    '--appearance-menu-active-bg': appearance.menuActiveBgColor,
    '--appearance-card-text-color': appearance.cardTextColor,
    '--appearance-card-border-color': appearance.cardBorderColor,
    '--appearance-card-font-weight': appearance.cardFontWeight,
    '--appearance-card-bg': `color-mix(in srgb, ${appearance.cardBgColor} ${cardOpacity}%, transparent)`
  }
})

onMounted(() => {
  authStore.checkSession()
  privacyStore.checkSession()
  settingsStore.fetchSettings()
})
</script>

<style>
#app {
  width: 100%;
  min-height: 100vh;
  position: relative;
  isolation: isolate;
}

.app-content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}
</style>
