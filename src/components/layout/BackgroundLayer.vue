<template>
  <div class="background-layer">
    <div
      v-if="background.type === 'image'"
      class="bg-image"
      :style="{ backgroundImage: `url(${background.value})` }"
    ></div>

    <video
      v-else-if="background.type === 'video' && !videoLoadFailed"
      :key="background.value"
      class="bg-video"
      :src="background.value"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      @error="handleVideoError"
    ></video>

    <div
      v-else-if="background.type === 'particles' || videoLoadFailed"
      id="particles-js"
      class="bg-particles"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, nextTick, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const background = computed(() => settingsStore.background)
const videoLoadFailed = ref(false)

// 初始化粒子效果
function initParticles() {
  if (typeof window === 'undefined' || !(window as any).particlesJS) return

  (window as any).particlesJS('particles-js', {
    particles: {
      number: { value: 80, density: { enable: true, value_area: 800 } },
      color: { value: '#ffffff' },
      shape: { type: 'circle' },
      opacity: { value: 0.5, random: false },
      size: { value: 3, random: true },
      line_linked: {
        enable: true,
        distance: 150,
        color: '#ffffff',
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 2,
        direction: 'none',
        random: false,
        straight: false,
        out_mode: 'out',
        bounce: false
      }
    },
    interactivity: {
      detect_on: 'canvas',
      events: {
        onhover: { enable: true, mode: 'grab' },
        onclick: { enable: true, mode: 'push' },
        resize: true
      },
      modes: {
        grab: { distance: 140, line_linked: { opacity: 1 } },
        push: { particles_nb: 4 }
      }
    },
    retina_detect: true
  })
}

async function loadParticles() {
  await nextTick()

  if ((window as any).particlesJS) {
    initParticles()
    return
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-particles-js]')
  if (existingScript) {
    existingScript.addEventListener('load', () => initParticles(), { once: true })
    return
  }

  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js'
  script.dataset.particlesJs = 'true'
  script.onload = () => initParticles()
  document.head.appendChild(script)
}

// 监听背景类型变化
watch(() => background.value, async (newBackground) => {
  videoLoadFailed.value = false

  if (newBackground.type === 'particles') {
    await loadParticles()
  }
}, { immediate: true, deep: true })

onMounted(() => {
  if (background.value.type === 'particles') {
    loadParticles()
  }
})

async function handleVideoError() {
  videoLoadFailed.value = true
  await loadParticles()
}
</script>

<style scoped>
.background-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.bg-image,
.bg-video,
.bg-particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.bg-image {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.bg-video {
  object-fit: cover;
  object-position: center;
  background: #0a0e27;
}

.bg-particles {
  background-color: #0a0e27;
}
</style>
