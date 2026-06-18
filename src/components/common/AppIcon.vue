<template>
  <span
    class="app-icon"
    :style="iconStyle"
    aria-hidden="true"
  ></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const iconUrls = {
  addSite: new URL('../../assets/icons/add-site.svg', import.meta.url).href,
  auth: new URL('../../assets/icons/auth.svg', import.meta.url).href,
  bookmarkImport: new URL('../../assets/icons/bookmark-import.svg', import.meta.url).href,
  chevronDown: new URL('../../assets/icons/chevron-down.svg', import.meta.url).href,
  cloudSync: new URL('../../assets/icons/cloud-sync.svg', import.meta.url).href,
  close: new URL('../../assets/icons/close.svg', import.meta.url).href,
  editMode: new URL('../../assets/icons/edit-mode.svg', import.meta.url).href,
  exitEdit: new URL('../../assets/icons/exit-edit.svg', import.meta.url).href,
  filter: new URL('../../assets/icons/filter.svg', import.meta.url).href,
  grid: new URL('../../assets/icons/grid.svg', import.meta.url).href,
  minus: new URL('../../assets/icons/minus.svg', import.meta.url).href,
  moreVertical: new URL('../../assets/icons/more-vertical.svg', import.meta.url).href,
  review: new URL('../../assets/icons/review.svg', import.meta.url).href,
  search: new URL('../../assets/icons/search.svg', import.meta.url).href,
  settings: new URL('../../assets/icons/settings.svg', import.meta.url).href,
  star: new URL('../../assets/icons/star.svg', import.meta.url).href,
  starOutline: new URL('../../assets/icons/star-outline.svg', import.meta.url).href,
  trash: new URL('../../assets/icons/trash.svg', import.meta.url).href
} as const

export type AppIconName = keyof typeof iconUrls

const props = withDefaults(defineProps<{
  name: AppIconName
  size?: number
}>(), {
  size: 18
})

const iconStyle = computed(() => ({
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
