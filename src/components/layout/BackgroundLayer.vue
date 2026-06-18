<template>
  <div class="background-layer">
    <div
      v-if="background.type === 'image'"
      class="bg-image"
      :style="{ backgroundImage: `url(${background.value})` }"
    ></div>

    <div
      v-else-if="background.type === 'particles'"
      id="particles-js"
      class="bg-particles"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const background = computed(() => settingsStore.background)

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

// 监听背景类型变化
watch(() => background.value.type, async (newType) => {
  if (newType === 'particles') {
    await nextTick()

    // 动态加载 particles.js
    if (!(window as any).particlesJS) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js'
      script.onload = () => initParticles()
      document.head.appendChild(script)
    } else {
      initParticles()
    }
  }
}, { immediate: true })

onMounted(() => {
  if (background.value.type === 'particles') {
    initParticles()
  }
})
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

.bg-particles {
  background-color: #0a0e27;
}
</style>
