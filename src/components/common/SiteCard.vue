<template>
  <div
    class="site-card"
    :class="{ 'is-dragging': isDragging }"
    :draggable="isDraggable"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <!-- 右上角管理按钮 -->
    <div v-if="showActions" class="card-actions-corner" :class="{ 'has-shortcut': isShortcut }">
      <button
        type="button"
        class="btn-move-corner"
        @click.stop="$emit('move', site)"
        title="移动到分类"
        aria-label="移动到分类"
      >
        <AppIcon name="move" :size="14" />
      </button>
      <button
        class="btn-shortcut-corner"
        :class="{ active: isShortcut }"
        @click.stop="handleShortcutToggle"
        :title="isShortcut ? '从快捷方式移除' : '添加到快捷方式'"
      >
        <AppIcon :name="isShortcut ? 'star' : 'starOutline'" :size="14" />
      </button>
      <button
        class="btn-delete-corner"
        @click.stop="$emit('delete', site)"
        title="删除"
      >
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <span v-if="showCategoryBadge && site.category" class="card-category-badge">{{ site.category }}</span>

    <!-- 图标 + 访问按钮 -->
    <div class="card-icon-wrapper" @click="handleIconClick">
      <div class="card-icon">
        <div
          v-if="brandIcon"
          class="brand-icon-shell"
          :class="`brand-${brandIcon.id}`"
          :title="brandIcon.title"
        >
          <svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path :d="brandIcon.path"></path>
          </svg>
        </div>
        <div v-else-if="shouldShowIconImage" class="favicon-shell">
          <img :src="proxiedIconUrl" :alt="site.name" @error="handleIconError" />
        </div>
        <div v-else class="icon-placeholder" :title="site.name">
          <span>{{ defaultIconText }}</span>
        </div>
      </div>
    </div>

    <!-- 内容区域：整行显示 -->
    <div class="card-content" @click="handleContentClick">
      <h3 class="card-title">{{ site.name }}</h3>
      <p v-if="site.description" class="card-description">{{ site.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Site } from '@/stores/sites'
import { useShortcutsStore } from '@/stores/shortcuts'
import AppIcon from './AppIcon.vue'

interface Props {
  site: Site
  showActions?: boolean
  canDrag?: boolean
  showCategoryBadge?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  edit: [site: Site]
  delete: [site: Site]
  move: [site: Site]
  dragStart: [site: Site]
  dragEnd: [site: Site]
  enterEditMode: []
}>()

const isDragging = ref(false)
const iconLoadFailed = ref(false)
const shortcutsStore = useShortcutsStore()
const isShortcut = computed(() => shortcutsStore.isSiteShortcut(props.site))
const isDraggable = computed(() => Boolean(props.canDrag || props.showActions))
const shouldShowIconImage = computed(() => Boolean(props.site.icon && proxiedIconUrl.value && !iconLoadFailed.value))
const brandIcon = computed(() => getBrandIcon(props.site))
const defaultIconText = computed(() => {
  const trimmedName = props.site.name.trim()
  if (!trimmedName) return '?'

  return trimmedName.slice(0, 1).toUpperCase()
})

const brandIcons = {
  github: {
    id: 'github',
    title: 'GitHub',
    path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
  },
  cloudflare: {
    id: 'cloudflare',
    title: 'Cloudflare',
    path: 'M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727'
  }
} as const

type BrandIconKey = keyof typeof brandIcons

function getHost(value: string | undefined) {
  if (!value) return ''

  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

function getBrandIcon(site: Site) {
  const haystack = [
    site.name,
    site.url,
    site.icon,
    getHost(site.url),
    getHost(site.icon)
  ].filter(Boolean).join(' ').toLowerCase()

  let key: BrandIconKey | '' = ''

  if (haystack.includes('github.com') || /\bgithub\b/.test(haystack)) {
    key = 'github'
  } else if (
    haystack.includes('cloudflare.com') ||
    haystack.includes('pages.cloudflare') ||
    haystack.includes('workers.cloudflare') ||
    /\bcloudflare\b/.test(haystack)
  ) {
    key = 'cloudflare'
  }

  return key ? brandIcons[key] : null
}

// 使用代理加载图标，绕过防盗链
const proxiedIconUrl = computed(() => {
  if (!props.site.icon) return ''

  // 如果已经是代理 URL，直接使用
  if (props.site.icon.startsWith('/api/icon-proxy')) {
    return props.site.icon
  }

  // Google Favicon API 不需要代理，直接使用
  if (props.site.icon.includes('google.com/s2/favicons')) {
    return props.site.icon
  }

  // 如果图标 URL 是外部链接，通过代理加载
  if (props.site.icon.startsWith('http://') || props.site.icon.startsWith('https://')) {
    return `/api/icon-proxy?url=${encodeURIComponent(props.site.icon)}`
  }

  // 本地图标或相对路径直接使用
  return props.site.icon
})

watch(() => props.site.icon, () => {
  iconLoadFailed.value = false
})

// 点击图标：访问网站
function handleIconClick() {
  if (props.site.url) {
    window.open(props.site.url, '_blank')
  }
}

async function handleShortcutToggle() {
  await shortcutsStore.toggleSiteShortcut(props.site)
}

// 点击内容：管理模式编辑，普通模式访问
function handleContentClick() {
  if (props.showActions) {
    // 管理模式：编辑
    emit('edit', props.site)
  } else {
    // 普通模式：访问
    if (props.site.url) {
      window.open(props.site.url, '_blank')
    }
  }
}

function handleDragStart(e: DragEvent) {
  if (!isDraggable.value) return

  if (!props.showActions) {
    emit('enterEditMode')
  }

  isDragging.value = true
  emit('dragStart', props.site)
  // 存储站点数据到拖拽数据中
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', 'site')
  e.dataTransfer!.setData('application/json', JSON.stringify(props.site))
}

function handleDragEnd() {
  isDragging.value = false
  emit('dragEnd', props.site)
}

function handleIconError() {
  iconLoadFailed.value = true
}
</script>

<style scoped>
.site-card {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  gap: var(--spacing-xs);
  background: var(--appearance-card-bg);
  color: var(--appearance-card-text-color);
}

.site-card {
  border: 2px solid color-mix(in srgb, var(--appearance-card-border-color) 34%, transparent);
}

.site-card.is-dragging {
  opacity: 0.85;
  border-color: var(--primary-color);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5);
  transform: scale(1.03) rotate(2deg);
}

/* 右上角管理按钮 */
.card-actions-corner {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 10;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.site-card:hover .card-actions-corner {
  opacity: 1;
}

.btn-move-corner,
.btn-shortcut-corner,
.btn-delete-corner {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.7);
  border: none;
}

.btn-move-corner:hover {
  background: color-mix(in srgb, var(--primary-color) 84%, #0f172a);
  color: white;
  transform: scale(1.1);
}

.btn-shortcut-corner.active {
  opacity: 1;
  background: rgba(250, 204, 21, 0.95);
  color: #1f2937;
  box-shadow: 0 0 14px rgba(250, 204, 21, 0.55);
}

.card-actions-corner.has-shortcut {
  opacity: 1;
}

.btn-shortcut-corner:hover {
  background: rgba(250, 204, 21, 0.95);
  color: #1f2937;
  transform: scale(1.1);
}

.btn-delete-corner:hover {
  background: #ef4444;
  color: white;
  transform: scale(1.1);
}

.card-category-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 3;
  max-width: calc(100% - 16px);
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--appearance-card-bg) 76%, var(--primary-color));
  border: 1px solid color-mix(in srgb, var(--appearance-card-border-color) 36%, transparent);
  color: var(--appearance-card-text-color);
  font-size: 11px;
  font-weight: var(--appearance-card-font-weight);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 图标区域 */
.card-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: transform var(--transition-fast);
}

.card-icon-wrapper:hover .card-icon {
  transform: scale(1.1);
}

.favicon-shell,
.brand-icon-shell {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}

.favicon-shell {
  padding: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(226, 232, 240, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 10px 22px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.favicon-shell img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 3px;
  filter:
    drop-shadow(0 0 1px rgba(255, 255, 255, 0.9))
    drop-shadow(0 2px 5px rgba(15, 23, 42, 0.28))
    saturate(1.12)
    contrast(1.08);
}

.brand-icon-shell {
  color: #111827;
  background:
    radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.96), transparent 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(226, 232, 240, 0.94));
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 10px 22px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.brand-icon {
  width: 29px;
  height: 29px;
  fill: currentColor;
  filter:
    drop-shadow(0 0 1px rgba(255, 255, 255, 0.7))
    drop-shadow(0 2px 5px rgba(15, 23, 42, 0.22));
}

.brand-cloudflare .brand-icon {
  width: 32px;
  height: 32px;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--appearance-card-border-color) 42%, transparent);
  background:
    radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.64), transparent 28%),
    linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.32);
}

.icon-placeholder::after {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: calc(var(--radius-md) - 2px);
  border: 1px solid rgba(255, 255, 255, 0.32);
}

.icon-placeholder span {
  position: relative;
  z-index: 1;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 2px 10px rgba(15, 23, 42, 0.42);
}

:global(.theme-glass) .icon-placeholder {
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.92), transparent 30%),
    linear-gradient(135deg, rgba(96, 165, 250, 0.96), rgba(168, 85, 247, 0.94));
  box-shadow:
    0 12px 28px rgba(59, 130, 246, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

:global(.theme-glass) .favicon-shell,
:global(.theme-glass) .brand-icon-shell {
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.98), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(226, 232, 240, 0.86));
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

:global(.theme-glass) .brand-icon-shell {
  color: #0f172a;
}

:global(.theme-cyberpunk) .icon-placeholder {
  border-color: rgba(0, 255, 255, 0.72);
  background:
    radial-gradient(circle at 26% 20%, rgba(0, 255, 255, 0.48), transparent 34%),
    linear-gradient(135deg, #0a0e27, #2b1055 52%, #00ffff);
  color: #00ffff;
  box-shadow:
    0 0 18px rgba(0, 255, 255, 0.58),
    inset 0 0 18px rgba(255, 0, 255, 0.18);
}

:global(.theme-cyberpunk) .favicon-shell {
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.96), transparent 32%),
    linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(203, 213, 225, 0.92));
  border-color: rgba(0, 255, 255, 0.62);
  box-shadow:
    0 0 18px rgba(0, 255, 255, 0.42),
    0 10px 24px rgba(0, 0, 0, 0.3),
    inset 0 0 14px rgba(0, 255, 255, 0.12);
}

:global(.theme-cyberpunk) .favicon-shell img {
  filter:
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))
    drop-shadow(0 0 8px rgba(0, 255, 255, 0.52))
    saturate(1.22)
    contrast(1.14);
}

:global(.theme-cyberpunk) .brand-icon-shell {
  color: #00ffff;
  background:
    radial-gradient(circle at 26% 20%, rgba(0, 255, 255, 0.2), transparent 34%),
    linear-gradient(135deg, rgba(10, 14, 39, 0.96), rgba(43, 16, 85, 0.9));
  border-color: rgba(0, 255, 255, 0.72);
  box-shadow:
    0 0 18px rgba(0, 255, 255, 0.58),
    inset 0 0 18px rgba(255, 0, 255, 0.18);
}

:global(.theme-cyberpunk) .brand-icon {
  filter:
    drop-shadow(0 0 7px rgba(0, 255, 255, 0.78))
    drop-shadow(0 0 14px rgba(255, 0, 255, 0.36));
}

:global(.theme-cyberpunk) .icon-placeholder::after {
  border-color: rgba(255, 0, 255, 0.52);
}

:global(.theme-cyberpunk) .icon-placeholder span {
  text-shadow:
    0 0 8px rgba(0, 255, 255, 0.88),
    0 0 16px rgba(255, 0, 255, 0.56);
}

/* 内容区域：整行显示 */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  min-height: 0;
}

.card-title {
  color: var(--appearance-card-text-color);
  font-size: 14px;
  font-weight: var(--appearance-card-font-weight);
  line-height: 1.3;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-description {
  color: var(--appearance-card-text-color);
  font-size: 12px;
  font-weight: var(--appearance-card-font-weight);
  opacity: 0.72;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
