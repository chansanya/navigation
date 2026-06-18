<template>
  <div class="category-section">
    <h2 class="category-title">{{ category }}</h2>
    <div class="sites-grid">
      <SiteCard
        v-for="site in sites"
        :key="site.id"
        :site="site"
        :show-actions="showActions"
        @edit="$emit('edit', site)"
        @delete="$emit('delete', site)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Site } from '@/stores/sites'
import SiteCard from './SiteCard.vue'

interface Props {
  category: string
  sites: Site[]
  showActions?: boolean
}

defineProps<Props>()
defineEmits<{
  edit: [site: Site]
  delete: [site: Site]
}>()
</script>

<style scoped>
.category-section {
  margin-bottom: var(--spacing-xl);
}

.category-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
  padding-left: var(--spacing-sm);
}

.sites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .sites-grid {
    grid-template-columns: 1fr;
  }
}
</style>
