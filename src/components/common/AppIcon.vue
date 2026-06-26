<template>
  <span
    class="app-icon"
    :style="iconStyle"
    aria-hidden="true"
  ></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 所有按钮图标集中在这里注册，组件通过 CSS mask 让 SVG 跟随 currentColor 着色。
const iconUrls = {
  addSite: new URL('../../assets/icons/add-site.svg', import.meta.url).href,
  auth: new URL('../../assets/icons/auth.svg', import.meta.url).href,
  bookmarkExport: new URL('../../assets/icons/bookmark-export.svg', import.meta.url).href,
  bookmarkImport: new URL('../../assets/icons/bookmark-import.svg', import.meta.url).href,
  check: new URL('../../assets/icons/check.svg', import.meta.url).href,
  chevronDown: new URL('../../assets/icons/chevron-down.svg', import.meta.url).href,
  cloudSync: new URL('../../assets/icons/cloud-sync.svg', import.meta.url).href,
  close: new URL('../../assets/icons/close.svg', import.meta.url).href,
  editMode: new URL('../../assets/icons/edit-mode.svg', import.meta.url).href,
  eye: new URL('../../assets/icons/eye.svg', import.meta.url).href,
  eyeOff: new URL('../../assets/icons/eye-off.svg', import.meta.url).href,
  exitEdit: new URL('../../assets/icons/exit-edit.svg', import.meta.url).href,
  filter: new URL('../../assets/icons/filter.svg', import.meta.url).href,
  grid: new URL('../../assets/icons/grid.svg', import.meta.url).href,
  minus: new URL('../../assets/icons/minus.svg', import.meta.url).href,
  move: new URL('../../assets/icons/move.svg', import.meta.url).href,
  moreVertical: new URL('../../assets/icons/more-vertical.svg', import.meta.url).href,
  records: new URL('../../assets/icons/records.svg', import.meta.url).href,
  review: new URL('../../assets/icons/review.svg', import.meta.url).href,
  search: new URL('../../assets/icons/search.svg', import.meta.url).href,
  settings: new URL('../../assets/icons/settings.svg', import.meta.url).href,
  star: new URL('../../assets/icons/star.svg', import.meta.url).href,
  starOutline: new URL('../../assets/icons/star-outline.svg', import.meta.url).href,
  trash: new URL('../../assets/icons/trash.svg', import.meta.url).href,
  upload: new URL('../../assets/icons/upload.svg', import.meta.url).href,
  vault: new URL('../../assets/icons/vault.svg', import.meta.url).href
} as const

export type AppIconName = keyof typeof iconUrls

const props = withDefaults(defineProps<{
  name: AppIconName
  size?: number
}>(), {
  size: 18
})

const iconStyle = computed(() => ({
  // mask URL 放在 CSS 变量里，模板不需要动态拼 class。
  width: `${props.size}px`,
  height: `${props.size}px`,
  '--icon-url': `url("${iconUrls[props.name]}")`
}))
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  background: currentColor;
  mask: var(--icon-url) center / contain no-repeat;
  -webkit-mask: var(--icon-url) center / contain no-repeat;
}
</style>
