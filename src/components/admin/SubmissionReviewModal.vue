<template>
  <div class="review-overlay" @click.self="$emit('close')">
    <section class="review-dialog">
      <div class="review-header">
        <div>
          <h2>审核列表</h2>
          <p>{{ submissions.length }} 条待审核</p>
        </div>
        <button type="button" class="btn-close" @click="$emit('close')">×</button>
      </div>

      <Loading v-if="loading" :loading="true" message="加载中..." />

      <div v-else-if="submissions.length === 0" class="empty-state">
        暂无待审核投稿
      </div>

      <div v-else class="submission-list">
        <article v-for="submission in submissions" :key="submission.id" class="submission-card">
          <div class="submission-main">
            <div class="submission-icon">
              <img v-if="submission.icon" :src="getIconUrl(submission.icon)" :alt="submission.name" />
              <span v-else>{{ submission.name.slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="submission-info">
              <input v-model="submission.name" class="title-input" />
              <a :href="submission.url" target="_blank" rel="noreferrer">{{ submission.url }}</a>
              <p v-if="submission.description">{{ submission.description }}</p>
              <small>{{ submission.email }}</small>
            </div>
          </div>

          <div class="review-fields">
            <label>
              分类
              <select v-model="submission.category">
                <option v-for="category in categories" :key="category.name" :value="category.name">
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label>
              图标
              <input v-model="submission.icon" />
            </label>
            <label>
              描述
              <textarea v-model="submission.description" rows="2"></textarea>
            </label>
          </div>

          <div class="review-actions">
            <button type="button" class="btn-reject" @click="reviewSubmission(submission, 'reject')">拒绝</button>
            <button type="button" class="btn-approve" @click="reviewSubmission(submission, 'approve')">通过收录</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePrivacyStore } from '@/stores/privacy'
import Loading from '@/components/common/Loading.vue'

const emit = defineEmits<{
  close: []
  changed: []
}>()

interface Submission {
  id: number
  name: string
  url: string
  icon?: string | null
  category?: string
  description?: string | null
  email: string
}

interface Category {
  id?: number
  name: string
  sort: number
}

const authStore = useAuthStore()
const privacyStore = usePrivacyStore()
const loading = ref(false)
const submissions = ref<Submission[]>([])
const categories = ref<Category[]>([])

onMounted(() => {
  fetchData()
})

async function fetchData() {
  loading.value = true

  try {
    await Promise.all([
      fetchSubmissions(),
      fetchCategories()
    ])
  } finally {
    loading.value = false
  }
}

async function fetchSubmissions() {
  const response = await fetch('/api/submissions', {
    headers: {
      'Authorization': `Bearer ${authStore.token}`,
      ...privacyStore.privacyHeaders()
    }
  })
  const data = await response.json() as { success: boolean; submissions?: Submission[] }
  if (data.success && data.submissions) {
    submissions.value = data.submissions
  }
}

async function fetchCategories() {
  const response = await fetch('/api/categories', {
    headers: privacyStore.privacyHeaders()
  })
  const data = await response.json() as { success: boolean; categories?: Category[] }
  if (data.success && data.categories) {
    categories.value = data.categories
  }
}

function getIconUrl(icon: string) {
  if (icon.startsWith('/api/icon-proxy') || icon.includes('google.com/s2/favicons')) return icon
  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return `/api/icon-proxy?url=${encodeURIComponent(icon)}`
  }
  return icon
}

async function reviewSubmission(submission: Submission, action: 'approve' | 'reject') {
  const response = await fetch(`/api/submissions/${submission.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authStore.token}`,
      ...privacyStore.privacyHeaders()
    },
    body: JSON.stringify({
      action,
      name: submission.name,
      url: submission.url,
      icon: submission.icon || '',
      category: submission.category || '其他',
      description: submission.description || ''
    })
  })
  const data = await response.json() as { success: boolean; error?: string }

  if (!data.success) {
    window.alert(data.error || '审核失败')
    return
  }

  submissions.value = submissions.value.filter((item) => item.id !== submission.id)
  emit('changed')
}
</script>

<style scoped>
.review-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.5);
}

.review-dialog {
  width: min(100%, 900px);
  max-height: 88vh;
  overflow-y: auto;
  padding: var(--spacing-lg);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}

.review-header {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.review-header h2 {
  font-size: 22px;
  font-weight: 700;
}

.review-header p {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.62;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 24px;
}

.submission-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.submission-card {
  padding: var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.submission-main {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.submission-icon {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  font-weight: 800;
}

.submission-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.submission-info {
  min-width: 0;
}

.title-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  outline: none;
}

.submission-info a {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--primary-color);
  white-space: nowrap;
}

.submission-info p,
.submission-info small {
  display: block;
  margin-top: 4px;
  color: #4b5563;
}

.review-fields {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: var(--spacing-sm);
}

.review-fields label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}

.review-fields label:last-child {
  grid-column: 1 / -1;
}

.review-fields input,
.review-fields select,
.review-fields textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  background: white;
  color: #111827;
  font: inherit;
  font-weight: 400;
}

.review-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.btn-reject,
.btn-approve {
  height: 36px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  font-weight: 700;
}

.btn-reject {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.btn-approve {
  background: var(--primary-color);
  color: white;
}

.empty-state {
  padding: var(--spacing-xl);
  text-align: center;
  opacity: 0.62;
}
</style>
