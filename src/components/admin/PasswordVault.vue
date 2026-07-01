<template>
  <div class="vault-modal" @click.self="$emit('close')">
    <section class="vault-dialog" aria-label="随身记录">
      <header class="vault-header">
        <div>
          <h2>随身记录</h2>
          <p v-if="vaultStore.unlocked">{{ vaultStore.records.length }} 条记录</p>
          <p v-else>{{ vaultStore.hasEntries ? '已锁定' : '未初始化' }}</p>
        </div>
        <button class="vault-close" type="button" title="关闭" @click="$emit('close')">×</button>
      </header>

      <form v-if="!vaultStore.unlocked" class="vault-unlock" @submit.prevent="handleUnlock">
        <div class="vault-mark">
          <AppIcon name="records" :size="30" />
        </div>
        <label class="vault-field">
          <span>主密码</span>
          <div class="vault-password-input">
            <input
              ref="passwordInputEl"
              v-model="masterPasswordInput"
              :type="masterPasswordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="输入主密码"
            />
            <button
              class="vault-eye-button"
              type="button"
              :title="masterPasswordVisible ? '隐藏' : '显示'"
              :aria-label="masterPasswordVisible ? '隐藏' : '显示'"
              @click="masterPasswordVisible = !masterPasswordVisible"
            >
              <AppIcon :name="masterPasswordVisible ? 'eyeOff' : 'eye'" :size="17" />
            </button>
          </div>
        </label>
        <p v-if="!vaultStore.hasEntries" class="vault-muted">首次保存记录时会使用当前主密码加密</p>
        <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
        <button class="vault-primary" type="submit" :disabled="vaultStore.loading || !masterPasswordInput.trim()">
          {{ vaultStore.hasEntries ? '解锁' : '进入' }}
        </button>
      </form>

      <div v-else class="vault-workspace">
        <aside class="vault-list-panel">
          <div class="vault-toolbar">
            <div class="vault-search">
              <AppIcon name="search" :size="16" />
              <input v-model="searchQuery" type="search" placeholder="搜索记录" autocomplete="off" />
            </div>
            <div class="vault-actions">
            <button
              class="vault-icon-button"
              type="button"
              title="刷新列表"
              aria-label="刷新列表"
              :disabled="refreshing"
              @click="handleRefresh"
            >
              <AppIcon name="refresh" :size="18" :class="{ spinning: refreshing }" />
            </button>
            <button class="vault-icon-button" type="button" title="Tab 显示设置" @click="showTabSettings = !showTabSettings">
              <AppIcon name="filter" :size="18" />
            </button>
            <button class="vault-icon-button" type="button" title="新增" @click="startCreate(activeTab)">
              <AppIcon name="addSite" :size="18" />
            </button>
            <button class="vault-icon-button" type="button" title="同步 MyApp" aria-label="同步 MyApp" @click="startSync">
              <AppIcon name="cloudSync" :size="18" />
            </button>
            <button class="vault-icon-button" type="button" title="锁定" @click="vaultStore.lock">
              <AppIcon name="auth" :size="17" />
            </button>
            </div>
          </div>

          <div class="vault-tabs">
            <button
              v-for="tab in visibleTabOptions"
              :key="tab.value"
              type="button"
              class="vault-tab"
              :class="{ active: activeTab === tab.value }"
              @click="switchTab(tab.value)"
            >
              {{ tab.label }}
              <small>{{ countByType(tab.value) }}</small>
            </button>
          </div>

          <div v-if="showTabSettings" class="vault-tab-settings">
            <label v-for="tab in tabOptions" :key="tab.value">
              <input
                type="checkbox"
                :checked="draftVisibleTabs.includes(tab.value)"
                :disabled="draftVisibleTabs.length === 1 && draftVisibleTabs.includes(tab.value)"
                @change="toggleVisibleTab(tab.value)"
              />
              <span>{{ tab.label }}</span>
            </label>
          </div>

          <div v-if="activeTab === 'account'" class="vault-account-kinds">
            <button
              v-for="option in accountKindOptions"
              :key="option.value"
              type="button"
              class="vault-category-chip"
              :class="{ active: accountKindFilter === option.value }"
              @click="setAccountKindFilter(option.value)"
            >
              {{ option.label }}
              <small>{{ countAccountsByKind(option.value) }}</small>
            </button>
          </div>

          <div v-if="activeTab === 'account' && accountKindFilter === 'normal'" class="vault-account-categories">
            <button
              v-for="category in accountCategoryOptions"
              :key="category"
              type="button"
              class="vault-category-chip"
              :class="{ active: accountCategoryFilter === category }"
              @click="accountCategoryFilter = category"
            >
              {{ category === 'all' ? '全部' : category }}
              <small>{{ countAccountsByCategory(category) }}</small>
            </button>
            <form v-if="addingAccountCategory" class="vault-category-editor" @submit.prevent="handleAddAccountCategory">
              <input
                ref="accountCategoryInputEl"
                v-model="newAccountCategory"
                type="text"
                autocomplete="off"
                placeholder="分类"
                @keydown.esc.prevent="cancelAddAccountCategory"
              />
              <button type="submit" title="保存分类" :disabled="vaultStore.saving || !newAccountCategory.trim()">
                <AppIcon name="addSite" :size="15" />
              </button>
              <button type="button" title="取消" :disabled="vaultStore.saving" @click="cancelAddAccountCategory">
                <AppIcon name="close" :size="15" />
              </button>
            </form>
            <button
              v-else
              type="button"
              class="vault-category-add"
              title="添加分类"
              aria-label="添加分类"
              @click="startAddAccountCategory"
            >
              <AppIcon name="addSite" :size="15" />
            </button>
          </div>

          <div ref="listRef" class="vault-list">
            <button
              v-for="item in visibleItems"
              :key="item.id"
              class="vault-item"
              :class="{ active: item.id === selectedItemId }"
              type="button"
              @click="selectItem(item)"
            >
              <span class="vault-item-icon">{{ getInitial(getRecordTitle(item)) }}</span>
              <span class="vault-item-main">
                <strong>{{ getRecordTitle(item) || '未命名' }}</strong>
                <small v-if="getListRecordSubtitle(item)">{{ getListRecordSubtitle(item) }}</small>
              </span>
            </button>

            <div v-if="filteredItems.length === 0" class="vault-empty">
              {{ searchQuery.trim() ? '无匹配记录' : `暂无${activeTabLabel}` }}
            </div>
            <div v-else-if="hasMore" ref="sentinelRef" class="vault-list-sentinel">加载中…</div>
            <div v-else class="vault-list-end">共 {{ filteredItems.length }} 条记录</div>
          </div>
        </aside>

        <section class="vault-detail">
          <div v-if="selectedItem && !showSyncPanel" class="vault-preview">
            <div class="vault-preview-title">
              <span class="vault-item-icon large">{{ getInitial(getRecordTitle(selectedItem)) }}</span>
              <div>
                <h3>{{ getRecordTitle(selectedItem) || '未命名' }}</h3>
                <a
                  v-if="selectedItem.type === 'account' && selectedItem.url"
                  :href="normalizedUrl(selectedItem.url)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ selectedItem.url }}
                </a>
                <small v-else>{{ getRecordTypeLabel(selectedItem.type) }}</small>
              </div>
            </div>

            <div v-if="selectedItem.type === 'account'" class="vault-data-grid">
              <div class="vault-data-row vault-data-row-meta">
                <span>类型</span>
                <strong>{{ getAccountDisplayType(selectedItem) }}</strong>
              </div>
              <div class="vault-data-row">
                <span>账号</span>
                <strong>{{ selectedItem.username || '-' }}</strong>
                <button type="button" @click="copyText(selectedItem.username, '账号')">复制</button>
              </div>
              <div class="vault-data-row">
                <span>密码</span>
                <strong>{{ passwordVisible ? selectedItem.password : maskPassword(selectedItem.password) }}</strong>
                <button
                  class="vault-eye-button"
                  type="button"
                  :title="passwordVisible ? '隐藏' : '显示'"
                  :aria-label="passwordVisible ? '隐藏' : '显示'"
                  @click="passwordVisible = !passwordVisible"
                >
                  <AppIcon :name="passwordVisible ? 'eyeOff' : 'eye'" :size="17" />
                </button>
                <button type="button" @click="copyText(selectedItem.password, '密码')">复制</button>
              </div>
              <div v-if="selectedItem.note" class="vault-note">
                {{ selectedItem.note }}
              </div>
            </div>

            <div v-else class="vault-data-grid">
              <div class="vault-note">
                {{ selectedItem.detail || '-' }}
              </div>
            </div>

            <div class="vault-detail-actions">
              <button class="vault-secondary" type="button" @click="startEdit(selectedItem)">编辑</button>
              <button class="vault-danger" type="button" @click="handleDelete(selectedItem)">删除</button>
            </div>
          </div>

          <form v-else-if="showSyncPanel" class="vault-form vault-sync-form" @submit.prevent>
            <h3>同步 MyApp</h3>
            <div class="vault-sync-mode">
              <button
                type="button"
                class="vault-tab compact"
                :class="{ active: syncDirection === 'pull' }"
                @click="setSyncDirection('pull')"
              >
                从 MyApp 拉取
              </button>
              <button
                type="button"
                class="vault-tab compact"
                :class="{ active: syncDirection === 'push' }"
                @click="setSyncDirection('push')"
              >
                同步到 MyApp
              </button>
            </div>
            <div class="vault-import-summary">
              <template v-if="syncDirection === 'pull'">
                <span v-if="!syncPreviewLoaded">先获取预览，确认后只会写入选中的记录</span>
                <span v-else>共 {{ syncFilteredTotal }} 条，已选择 {{ selectedSyncRecords.length }} 条</span>
              </template>
              <template v-else>
                <span v-if="!passivePreviewLoaded">先预检本地随身记录，确认后写入 MyApp</span>
                <span v-else>共 {{ passiveChanges.length }} 条变更，已选择 {{ selectedPassiveChanges.length }} 条</span>
              </template>
            </div>

            <template v-if="syncDirection === 'pull'">
              <div v-if="syncPreviewLoaded" class="vault-sync-tools">
                <div class="vault-sync-filter">
                  <button
                    v-for="option in syncFilterOptions"
                    :key="option.value"
                    type="button"
                    class="vault-tab compact"
                    :class="{ active: syncTypeFilter === option.value }"
                    @click="setSyncTypeFilter(option.value)"
                  >
                    {{ option.label }}
                    <small>{{ countSyncByType(option.value) }}</small>
                  </button>
                </div>
                <div
                  v-if="syncTypeFilter === 'account' && syncAccountCategoryOptions.length > 1"
                  class="vault-sync-categories"
                >
                  <button
                    v-for="category in syncAccountCategoryOptions"
                    :key="category"
                    type="button"
                    class="vault-category-chip"
                    :class="{ active: syncAccountCategoryFilter === category }"
                    @click="setSyncAccountCategoryFilter(category)"
                  >
                    {{ category === 'all' ? '全部普通分类' : category }}
                    <small>{{ countSyncAccountsByCategory(category) }}</small>
                  </button>
                </div>
                <div class="vault-sync-actions">
                  <button
                    class="vault-secondary"
                    type="button"
                    title="勾选当前筛选条件下所有分页记录"
                    :disabled="syncing || selectingAllSync"
                    @click="selectAllFilteredSyncRecords"
                  >
                    {{ selectingAllSync ? '全选中...' : '全选全部' }}
                  </button>
                  <button
                    class="vault-secondary"
                    type="button"
                    :disabled="syncing || selectingAllSync || selectedSyncRecords.length === 0"
                    @click="clearAllSyncRecords"
                  >
                    清空全部
                  </button>
                </div>
              </div>

              <div v-if="syncPreviewLoaded" class="vault-sync-list">
                <label
                  v-for="item in pagedSyncPreviewItems"
                  :key="item.key"
                  class="vault-sync-item"
                >
                  <input
                    type="checkbox"
                    :checked="selectedSyncKeys.includes(item.key)"
                    @change="toggleSyncRecord(item)"
                  />
                  <span class="vault-item-icon">{{ getInitial(getRecordTitle(item.record)) }}</span>
                  <span class="vault-item-main">
                    <strong>{{ getRecordTitle(item.record) || '未命名' }}</strong>
                    <small>{{ getRecordSubtitle(item.record) }}</small>
                  </span>
                  <span class="vault-sync-badge" :class="{ gpt: item.record.type === 'account' && getAccountKind(item.record) === 'gpt' }">
                    {{ item.record.type === 'account' ? getAccountKindLabel(item.record) : getRecordTypeLabel(item.record.type) }}
                  </span>
                  <span
                    v-if="item.record.type === 'account' && getAccountKind(item.record) === 'normal'"
                    class="vault-sync-badge category"
                  >
                    {{ getAccountCategoryLabel(item.record) }}
                  </span>
                  <span class="vault-sync-badge" :class="{ update: isExistingSyncRecord(item.record) }">
                    {{ isExistingSyncRecord(item.record) ? '更新' : '新增' }}
                  </span>
                </label>

                <div v-if="filteredSyncPreviewItems.length === 0" class="vault-empty">
                  当前类型暂无可同步记录
                </div>
              </div>

              <div v-if="syncPreviewLoaded && filteredSyncPreviewItems.length > 0" class="vault-sync-pagination">
                <button class="vault-secondary" type="button" :disabled="syncPage <= 1 || syncing || selectingAllSync" @click="goSyncPage(syncPage - 1)">
                  上一页
                </button>
                <span>第 {{ syncPage }} / {{ syncPageCount }} 页，每页 {{ syncPageSize }} 条</span>
                <label class="vault-sync-page-jump">
                  <span>跳至</span>
                  <input
                    type="number"
                    min="1"
                    :max="syncPageCount"
                    :value="syncPage"
                    @change="handleSyncPageInput"
                    @keyup.enter="handleSyncPageInput"
                  />
                </label>
                <button class="vault-secondary" type="button" :disabled="syncPage >= syncPageCount || syncing || selectingAllSync" @click="goSyncPage(syncPage + 1)">
                  下一页
                </button>
              </div>
            </template>

            <template v-else>
              <div v-if="passivePreviewLoaded" class="vault-sync-tools">
                <div class="vault-sync-filter">
                  <button
                    v-for="option in passiveActionOptions"
                    :key="option.value"
                    type="button"
                    class="vault-tab compact"
                    :class="{ active: passiveActionFilter === option.value }"
                    @click="passiveActionFilter = option.value"
                  >
                    {{ option.label }}
                    <small>{{ countPassiveByAction(option.value) }}</small>
                  </button>
                </div>
                <div class="vault-sync-actions">
                  <button
                    class="vault-secondary"
                    type="button"
                    :disabled="syncing || selectableFilteredPassiveChanges.length === 0"
                    @click="selectAllPassiveChanges"
                  >
                    全选当前
                  </button>
                  <button
                    class="vault-secondary"
                    type="button"
                    :disabled="syncing || selectedPassiveChanges.length === 0"
                    @click="clearPassiveChanges"
                  >
                    清空全部
                  </button>
                </div>
              </div>

              <div v-if="passivePreviewLoaded" class="vault-sync-list">
                <label
                  v-for="item in filteredPassiveChanges"
                  :key="item.key"
                  class="vault-sync-item passive"
                  :class="{ disabled: !isPassiveSelectable(item.change) }"
                >
                  <input
                    type="checkbox"
                    :disabled="!isPassiveSelectable(item.change)"
                    :checked="selectedPassiveKeys.includes(item.key)"
                    @change="togglePassiveChange(item)"
                  />
                  <span class="vault-item-icon">{{ getInitial(getPassiveChangeTitle(item.change)) }}</span>
                  <span class="vault-item-main">
                    <strong>{{ getPassiveChangeTitle(item.change) }}</strong>
                    <small>{{ getPassiveChangeSubtitle(item.change) }}</small>
                  </span>
                  <span class="vault-sync-badge" :class="{ gpt: getPassiveAccountKind(item.change) === 'gpt' }">
                    {{ item.change.type === 'ACCOUNT' ? getPassiveAccountKindLabel(item.change) : getPassiveTypeLabel(item.change.type) }}
                  </span>
                  <span v-if="getPassiveAccountCategory(item.change)" class="vault-sync-badge category">
                    {{ getPassiveAccountCategory(item.change) }}
                  </span>
                  <span class="vault-sync-badge" :class="getPassiveActionClass(item.change.action)">
                    {{ getPassiveActionLabel(item.change.action) }}
                  </span>
                </label>

                <div v-if="filteredPassiveChanges.length === 0" class="vault-empty">
                  当前筛选暂无变更
                </div>
              </div>
            </template>

            <p v-if="syncMessage" class="vault-success">{{ syncMessage }}</p>
            <p v-if="syncError" class="vault-error">{{ syncError }}</p>
            <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
            <div class="vault-form-actions">
              <button class="vault-secondary" type="button" @click="cancelSync">取消</button>
              <button class="vault-secondary" type="button" :disabled="syncing || selectingAllSync || vaultStore.saving" @click="handleSyncPreviewAction">
                {{ syncPreviewButtonText }}
              </button>
              <button
                class="vault-primary"
                type="button"
                :disabled="!canConfirmSync || syncing || selectingAllSync || vaultStore.saving"
                @click="openSyncConfirm"
              >
                {{ syncConfirmButtonText }}
              </button>
            </div>
          </form>

          <div v-else class="vault-empty vault-detail-empty">
            {{ searchQuery.trim() ? '无匹配记录' : '选择左侧记录或点击新增' }}
          </div>
        </section>

        <div v-if="editing" class="vault-drawer-backdrop" @click.self="cancelEdit">
          <form class="vault-form vault-edit-drawer" @submit.prevent="handleSave">
            <h3>{{ editingId ? `编辑${activeTabLabel}` : `新增${activeTabLabel}` }}</h3>

            <template v-if="form.type === 'account'">
              <label class="vault-field">
                <span>类型</span>
                <div class="vault-kind-toggle">
                  <button
                    type="button"
                    class="vault-tab compact"
                    :class="{ active: form.accountKind === 'normal' }"
                    @click="setFormAccountKind('normal')"
                  >
                    普通账户
                  </button>
                  <button
                    type="button"
                    class="vault-tab compact"
                    :class="{ active: form.accountKind === 'gpt' }"
                    @click="setFormAccountKind('gpt')"
                  >
                    GPT 账户
                  </button>
                </div>
              </label>
              <label class="vault-field">
                <span>名称</span>
                <input v-model="form.title" type="text" autocomplete="off" placeholder="例如 GitHub" />
              </label>
              <label class="vault-field">
                <span>网址</span>
                <input v-model="form.url" type="url" autocomplete="off" placeholder="https://" />
              </label>
              <label class="vault-field">
                <span>账号</span>
                <input v-model="form.username" type="text" autocomplete="username" />
              </label>
              <label v-if="form.accountKind === 'normal'" class="vault-field">
                <span>分类</span>
                <input
                  v-model="form.category"
                  type="text"
                  list="vault-account-category-options"
                  autocomplete="off"
                  placeholder="例如 邮箱 / 社交 / 其他"
                />
                <datalist id="vault-account-category-options">
                  <option v-for="category in accountCategoryChoices" :key="category" :value="category"></option>
                </datalist>
              </label>
              <label class="vault-field">
                <span>密码</span>
                <div class="vault-password-input">
                  <input
                    v-model="form.password"
                    :type="formPasswordVisible ? 'text' : 'password'"
                    autocomplete="new-password"
                  />
                  <button
                    class="vault-eye-button"
                    type="button"
                    :title="formPasswordVisible ? '隐藏' : '显示'"
                    :aria-label="formPasswordVisible ? '隐藏' : '显示'"
                    @click="formPasswordVisible = !formPasswordVisible"
                  >
                    <AppIcon :name="formPasswordVisible ? 'eyeOff' : 'eye'" :size="17" />
                  </button>
                </div>
              </label>
              <label class="vault-field">
                <span>备注</span>
                <textarea v-model="form.note" rows="4"></textarea>
              </label>
            </template>

            <template v-else>
              <label class="vault-field">
                <span>描述</span>
                <input v-model="form.description" type="text" autocomplete="off" placeholder="例如 服务器信息" />
              </label>
              <label class="vault-field">
                <span>详情</span>
                <textarea v-model="form.detail" rows="10"></textarea>
              </label>
            </template>

            <p v-if="vaultStore.error" class="vault-error">{{ vaultStore.error }}</p>
            <div class="vault-form-actions">
              <button class="vault-secondary" type="button" @click="cancelEdit">取消</button>
              <button v-if="form.type === 'account'" class="vault-secondary" type="button" @click="generatePassword">生成密码</button>
              <button class="vault-primary" type="submit" :disabled="vaultStore.saving || !canSave">
                保存
              </button>
            </div>
          </form>
        </div>

        <div v-if="syncConfirmVisible" class="vault-confirm-backdrop" @click.self="closeSyncConfirm">
          <section class="vault-confirm-card" role="dialog" aria-modal="true" aria-label="确认同步">
            <div class="vault-confirm-icon">
              <AppIcon name="cloudSync" :size="22" />
            </div>
            <div class="vault-confirm-content">
              <h3>确认同步</h3>
              <p>{{ syncConfirmDescription }}</p>
              <div class="vault-confirm-summary">
                <span v-for="item in syncConfirmSummaryItems" :key="item.label">
                  <small>{{ item.label }}</small>
                  <strong>{{ item.count }}</strong>
                </span>
              </div>
            </div>
            <div class="vault-confirm-actions">
              <button class="vault-secondary" type="button" :disabled="vaultStore.saving || syncing" @click="closeSyncConfirm">
                取消
              </button>
              <button class="vault-primary" type="button" :disabled="vaultStore.saving || syncing" @click="executeMyAppSync">
                {{ vaultStore.saving || syncing ? '同步中...' : '确认同步' }}
              </button>
            </div>
          </section>
        </div>

        <Transition name="vault-toast">
          <div
            v-if="copyFeedback"
            class="vault-copy-toast"
            :class="{ error: copyFeedbackType === 'error' }"
            role="status"
          >
            <AppIcon :name="copyFeedbackType === 'error' ? 'close' : 'check'" :size="16" />
            <span>{{ copyFeedback }}</span>
          </div>
        </Transition>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import {
  useVaultStore,
  type VaultAccountKind,
  type VaultRecord,
  type VaultRecordType
} from '@/stores/vault'

defineEmits<{
  close: []
}>()

interface RecordForm {
  type: VaultRecordType
  accountKind: VaultAccountKind
  title: string
  username: string
  password: string
  url: string
  note: string
  category: string
  description: string
  detail: string
}

interface SyncAccountCategoryCount {
  category: string
  count: number
}

interface SyncPreviewResponse {
  success: boolean
  records?: VaultRecord[]
  counts?: {
    records: number
    types?: Record<VaultRecordType | 'all', number>
    accountCategories?: SyncAccountCategoryCount[]
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

type SyncDirection = 'pull' | 'push'
type PassiveActionFilter = 'all' | 'CREATE' | 'UPDATE' | 'CONFLICT' | 'UNSUPPORTED'
type AccountKindFilter = 'all' | VaultAccountKind

interface PassiveSyncChange {
  action: PassiveActionFilter | string
  type: 'NOTE' | 'ACCOUNT' | string
  sourceId: string
  matchReason?: string
  changedFields?: string[]
  incoming?: unknown
  current?: unknown
  message?: string
  error?: string
}

interface PassivePreviewResponse {
  success: boolean
  summary?: Record<string, number>
  changes?: PassiveSyncChange[]
  notes?: PassiveSyncChange[]
  accounts?: PassiveSyncChange[]
  upload?: {
    schemaVersion?: number
    notes?: number
    accounts?: number
  }
  error?: string
}

const tabOptions: Array<{ value: VaultRecordType; label: string }> = [
  { value: 'account', label: '账号' },
  { value: 'note', label: '记录' }
]

const vaultStore = useVaultStore()
const masterPasswordInput = ref('')
const passwordInputEl = ref<HTMLInputElement | null>(null)
const accountCategoryInputEl = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const selectedItemId = ref<number | null>(null)
const activeTab = ref<VaultRecordType>('account')
const accountKindFilter = ref<AccountKindFilter>('all')
const accountCategoryFilter = ref('all')
const addingAccountCategory = ref(false)
const newAccountCategory = ref('')
const draftVisibleTabs = ref<VaultRecordType[]>(['account', 'note'])
const showTabSettings = ref(false)
const editing = ref(false)
const showSyncPanel = ref(false)
const editingId = ref<number | null>(null)
const passwordVisible = ref(false)
const formPasswordVisible = ref(false)
const masterPasswordVisible = ref(false)
const copyFeedback = ref('')
const copyFeedbackType = ref<'success' | 'error'>('success')
const syncing = ref(false)
const selectingAllSync = ref(false)
const syncDirection = ref<SyncDirection>('pull')
const syncConfirmVisible = ref(false)
const syncMessage = ref('')
const syncError = ref('')
const syncPreviewLoaded = ref(false)
const syncPreviewRecords = ref<VaultRecord[]>([])
const selectedSyncKeys = ref<string[]>([])
const selectedSyncRecordsByKey = ref<Record<string, VaultRecord>>({})
const syncTypeFilter = ref<VaultRecordType | 'all'>('all')
const syncAccountCategoryFilter = ref('all')
const syncPage = ref(1)
const syncPageSize = 10
const syncFilteredTotal = ref(0)
const syncTypeCounts = ref<Record<VaultRecordType | 'all', number>>({
  all: 0,
  account: 0,
  note: 0
})
const syncAccountCategoryCounts = ref<SyncAccountCategoryCount[]>([])
const syncCurrentPageExistingCount = ref(0)
const passivePreviewLoaded = ref(false)
const passiveChanges = ref<PassiveSyncChange[]>([])
const passiveSummary = ref<Record<string, number>>({})
const passiveActionFilter = ref<PassiveActionFilter>('all')
const selectedPassiveKeys = ref<string[]>([])
const selectedPassiveChangesByKey = ref<Record<string, PassiveSyncChange>>({})
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive<RecordForm>({
  type: 'account',
  accountKind: 'normal',
  title: '',
  username: '',
  password: '',
  url: '',
  note: '',
  category: '',
  description: '',
  detail: ''
})

const visibleTabOptions = computed(() => {
  return tabOptions.filter((tab) => vaultStore.visibleTabs.includes(tab.value))
})

const activeTabLabel = computed(() => getRecordTypeLabel(activeTab.value))

const accountKindOptions = computed<Array<{ value: AccountKindFilter; label: string }>>(() => [
  { value: 'all', label: '全部账号' },
  { value: 'normal', label: '普通账户' },
  { value: 'gpt', label: 'GPT 账户' }
])

const accountCategoryOptions = computed(() => {
  const categories = [
    ...vaultStore.accountCategories,
    ...vaultStore.records
      .filter(isNormalAccountRecord)
      .map((item) => getAccountCategoryLabel(item))
  ]
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))

  return ['all', ...categories]
})

const accountCategoryChoices = computed(() => {
  return accountCategoryOptions.value.filter((category) => category !== 'all')
})

const filteredItems = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  const records = vaultStore.records.filter((item) => {
    if (item.type !== activeTab.value) return false
    if (activeTab.value !== 'account') return true
    if (item.type !== 'account') return true

    const accountKind = getAccountKind(item)
    if (accountKindFilter.value !== 'all' && accountKind !== accountKindFilter.value) return false
    if (accountKindFilter.value !== 'normal' || accountCategoryFilter.value === 'all') return true
    return getAccountCategoryLabel(item) === accountCategoryFilter.value
  })

  if (!keyword) return records

  return records.filter((item) => searchRecord(item, keyword))
})

// 列表前端分页 + 手动刷新（数据全量在内存，仅切片渲染）
const PAGE_SIZE = 50
const visibleCount = ref(PAGE_SIZE)
const refreshing = ref(false)
const listRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let listObserver: IntersectionObserver | null = null

const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredItems.value.length)

// 过滤/搜索/切换条件变化时回到首页
watch(filteredItems, () => {
  visibleCount.value = PAGE_SIZE
})

async function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await vaultStore.refresh()
    visibleCount.value = PAGE_SIZE
  } finally {
    refreshing.value = false
  }
}

function bindListObserver() {
  if (!listRef.value) return
  listObserver?.disconnect()
  listObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && hasMore.value) {
      visibleCount.value += PAGE_SIZE
    }
  }, { root: listRef.value, rootMargin: '120px' })
  if (sentinelRef.value) listObserver.observe(sentinelRef.value)
}

watch([listRef, sentinelRef], bindListObserver, { flush: 'post' })

onUnmounted(() => {
  listObserver?.disconnect()
  listObserver = null
})

const selectedItem = computed(() => {
  return filteredItems.value.find((item) => item.id === selectedItemId.value) || filteredItems.value[0] || null
})

const canSave = computed(() => {
  if (form.type === 'note') {
    return Boolean(form.description.trim() && form.detail.trim())
  }

  return Boolean(form.title.trim() && (form.username.trim() || form.password.trim() || form.url.trim()))
})

const syncFilterOptions = computed<Array<{ value: VaultRecordType | 'all'; label: string }>>(() => [
  { value: 'all', label: '全部' },
  ...tabOptions
])

const syncPreviewItems = computed(() => {
  return syncPreviewRecords.value.map((record, index) => ({
    record,
    index,
    key: getSyncRecordKey(record, index)
  }))
})

const syncAccountCategoryOptions = computed(() => {
  return ['all', ...syncAccountCategoryCounts.value.map((item) => item.category)]
})

const filteredSyncPreviewItems = computed(() => {
  return syncPreviewItems.value
})

const syncPageCount = computed(() => {
  return Math.max(1, Math.ceil(syncFilteredTotal.value / syncPageSize))
})

const pagedSyncPreviewItems = computed(() => {
  return filteredSyncPreviewItems.value
})

const selectedSyncRecords = computed(() => {
  return selectedSyncKeys.value
    .map((key) => selectedSyncRecordsByKey.value[key])
    .filter((record): record is VaultRecord => Boolean(record))
})

const passiveItems = computed(() => {
  return passiveChanges.value.map((change, index) => ({
    change,
    index,
    key: getPassiveChangeKey(change, index)
  }))
})

const filteredPassiveChanges = computed(() => {
  if (passiveActionFilter.value === 'all') return passiveItems.value
  return passiveItems.value.filter((item) => item.change.action === passiveActionFilter.value)
})

const selectableFilteredPassiveChanges = computed(() => {
  return filteredPassiveChanges.value.filter((item) => isPassiveSelectable(item.change))
})

const selectedPassiveChanges = computed(() => {
  return selectedPassiveKeys.value
    .map((key) => selectedPassiveChangesByKey.value[key])
    .filter((change): change is PassiveSyncChange => Boolean(change))
})

const passiveActionOptions = computed<Array<{ value: PassiveActionFilter; label: string }>>(() => [
  { value: 'all', label: '全部' },
  { value: 'CREATE', label: '新增' },
  { value: 'UPDATE', label: '更新' },
  { value: 'CONFLICT', label: '冲突' },
  { value: 'UNSUPPORTED', label: '不可写' }
])

const syncConfirmStats = computed(() => {
  const records = syncDirection.value === 'pull' ? selectedSyncRecords.value : []
  const createCount = records.filter((record) => !isExistingSyncRecord(record)).length

  return {
    total: records.length,
    createCount,
    updateCount: records.length - createCount
  }
})

const passiveConfirmStats = computed(() => ({
  total: selectedPassiveChanges.value.length,
  createCount: selectedPassiveChanges.value.filter((change) => change.action === 'CREATE').length,
  updateCount: selectedPassiveChanges.value.filter((change) => change.action === 'UPDATE').length,
  conflictCount: selectedPassiveChanges.value.filter((change) => change.action === 'CONFLICT').length
}))

const canConfirmSync = computed(() => {
  if (syncDirection.value === 'pull') return syncPreviewLoaded.value && selectedSyncRecords.value.length > 0
  return passivePreviewLoaded.value && selectedPassiveChanges.value.length > 0
})

const syncPreviewButtonText = computed(() => {
  if (syncing.value) return syncDirection.value === 'pull' ? '读取中...' : '预检中...'
  if (syncDirection.value === 'pull') return syncPreviewLoaded.value ? '重新获取预览' : '获取预览'
  return passivePreviewLoaded.value ? '重新预检' : '获取预检'
})

const syncConfirmButtonText = computed(() => {
  if (vaultStore.saving || syncing.value) return '写入中...'
  if (syncDirection.value === 'pull') return `同步选中 ${selectedSyncRecords.value.length} 条`
  return `确认选中 ${selectedPassiveChanges.value.length} 条`
})

const syncConfirmDescription = computed(() => {
  if (syncDirection.value === 'pull') {
    return `将写入选中的 ${syncConfirmStats.value.total} 条记录。`
  }

  return `将向 MyApp 确认选中的 ${passiveConfirmStats.value.total} 条变更。`
})

const syncConfirmSummaryItems = computed(() => {
  if (syncDirection.value === 'pull') {
    return [
      { label: '新增', count: syncConfirmStats.value.createCount },
      { label: '更新', count: syncConfirmStats.value.updateCount }
    ]
  }

  return [
    { label: '新增', count: passiveConfirmStats.value.createCount },
    { label: '更新', count: passiveConfirmStats.value.updateCount },
    { label: '冲突', count: passiveConfirmStats.value.conflictCount }
  ]
})

onMounted(async () => {
  await vaultStore.fetchEntries()
  await nextTick()
  passwordInputEl.value?.focus()
})

watch(() => vaultStore.visibleTabs, (tabs) => {
  draftVisibleTabs.value = [...tabs]
  ensureVisibleActiveTab()
}, { deep: true })

function ensureVisibleActiveTab() {
  if (!vaultStore.visibleTabs.includes(activeTab.value)) {
    activeTab.value = vaultStore.visibleTabs[0] || 'account'
    selectedItemId.value = null
    cancelEdit()
  }
}

async function handleUnlock() {
  // 只把主密码交给 vault store 派生密钥，解锁成功后立即清空输入框。
  const success = await vaultStore.unlock(masterPasswordInput.value)
  if (!success) return

  masterPasswordInput.value = ''
  draftVisibleTabs.value = [...vaultStore.visibleTabs]
  ensureVisibleActiveTab()
  selectedItemId.value = filteredItems.value[0]?.id || null
}

function getRecordTypeLabel(type: VaultRecordType) {
  return tabOptions.find((tab) => tab.value === type)?.label || '记录'
}

function countByType(type: VaultRecordType) {
  return vaultStore.records.filter((item) => item.type === type).length
}

function countAccountsByKind(kind: AccountKindFilter) {
  const accounts = vaultStore.records.filter(isAccountRecord)
  if (kind === 'all') return accounts.length
  return accounts.filter((item) => getAccountKind(item) === kind).length
}

function countAccountsByCategory(category: string) {
  const accounts = vaultStore.records.filter(isNormalAccountRecord)
  if (category === 'all') return accounts.length
  return accounts.filter((item) => getAccountCategoryLabel(item) === category).length
}

function countSyncByType(type: VaultRecordType | 'all') {
  return syncTypeCounts.value[type] || 0
}

function countSyncAccountsByCategory(category: string) {
  if (category === 'all') {
    return syncAccountCategoryCounts.value.reduce((total, item) => total + item.count, 0)
  }
  return syncAccountCategoryCounts.value.find((item) => item.category === category)?.count || 0
}

function switchTab(type: VaultRecordType) {
  activeTab.value = type
  selectedItemId.value = null
  passwordVisible.value = false
  editingId.value = null
  editing.value = false
  showSyncPanel.value = false
  accountKindFilter.value = 'all'
  accountCategoryFilter.value = 'all'
  resetForm(type)
}

function setAccountKindFilter(kind: AccountKindFilter) {
  accountKindFilter.value = kind
  accountCategoryFilter.value = 'all'
  addingAccountCategory.value = false
  newAccountCategory.value = ''
  selectedItemId.value = null
}

function setFormAccountKind(kind: VaultAccountKind) {
  form.accountKind = kind
  if (kind === 'gpt') {
    form.category = ''
  } else if (!form.category) {
    form.category = accountCategoryFilter.value !== 'all' ? accountCategoryFilter.value : ''
  }
}

async function toggleVisibleTab(type: VaultRecordType) {
  const exists = draftVisibleTabs.value.includes(type)
  const nextTabs = exists
    ? draftVisibleTabs.value.filter((tab) => tab !== type)
    : [...draftVisibleTabs.value, type]

  if (nextTabs.length === 0) return

  draftVisibleTabs.value = tabOptions
    .map((tab) => tab.value)
    .filter((tab) => nextTabs.includes(tab))
  await vaultStore.saveVisibleTabs(draftVisibleTabs.value)
}

async function startAddAccountCategory() {
  accountKindFilter.value = 'normal'
  addingAccountCategory.value = true
  newAccountCategory.value = ''
  await nextTick()
  accountCategoryInputEl.value?.focus()
}

function cancelAddAccountCategory() {
  if (vaultStore.saving) return
  addingAccountCategory.value = false
  newAccountCategory.value = ''
}

async function handleAddAccountCategory() {
  const category = newAccountCategory.value.trim()
  if (!category) return

  if (category === 'all' || category === '全部') {
    vaultStore.error = '分类名称不可用'
    return
  }

  if (accountCategoryOptions.value.includes(category)) {
    accountKindFilter.value = 'normal'
    accountCategoryFilter.value = category
    cancelAddAccountCategory()
    return
  }

  const success = await vaultStore.saveAccountCategories([
    ...vaultStore.accountCategories,
    category
  ])
  if (!success) return

  accountKindFilter.value = 'normal'
  accountCategoryFilter.value = category
  cancelAddAccountCategory()
}

async function ensureAccountCategorySaved(category: string) {
  const normalizedCategory = category.trim()
  if (!normalizedCategory || normalizedCategory === 'all') return true
  if (vaultStore.accountCategories.includes(normalizedCategory)) return true

  return vaultStore.saveAccountCategories([
    ...vaultStore.accountCategories,
    normalizedCategory
  ])
}

function getInitial(title: string) {
  const trimmed = title.trim()
  return (trimmed[0] || '#').toUpperCase()
}

function getRecordTitle(item: VaultRecord) {
  if (item.type === 'note') return item.description || item.summary || `记录 ${item.id || ''}`.trim()
  return item.title
}

function isAccountRecord(item: VaultRecord): item is Extract<VaultRecord, { type: 'account' }> {
  return item.type === 'account'
}

function isNormalAccountRecord(item: VaultRecord): item is Extract<VaultRecord, { type: 'account' }> {
  return isAccountRecord(item) && getAccountKind(item) === 'normal'
}

function getAccountKind(item: Extract<VaultRecord, { type: 'account' }>): VaultAccountKind {
  return item.accountKind || 'normal'
}

function getAccountKindLabel(item: Extract<VaultRecord, { type: 'account' }>) {
  return getAccountKind(item) === 'gpt' ? 'GPT 账户' : '普通账户'
}

function getAccountCategoryLabel(item: Extract<VaultRecord, { type: 'account' }>) {
  return getAccountKind(item) === 'normal' ? item.category || '其他' : ''
}

function getAccountDisplayType(item: Extract<VaultRecord, { type: 'account' }>) {
  if (getAccountKind(item) === 'gpt') return getAccountKindLabel(item)
  return `${getAccountKindLabel(item)} · ${getAccountCategoryLabel(item)}`
}

function getRecordSubtitle(item: VaultRecord) {
  if (item.type === 'account') {
    return [getAccountDisplayType(item), item.username || item.url || '无账号'].filter(Boolean).join(' · ')
  }
  return item.detail || item.summary || '无详情'
}

function getListRecordSubtitle(item: VaultRecord) {
  // 账户显示类型描述（普通/GPT + 分类），便于区分同一邮箱的多条账户
  if (item.type === 'account') return getAccountDisplayType(item)
  return item.detail || item.summary || ''
}

function searchRecord(item: VaultRecord, keyword: string) {
  if (item.type === 'account') {
    return [
      item.title,
      item.username,
      item.url,
      item.note,
      getAccountKindLabel(item),
      getAccountCategoryLabel(item)
    ].some((value) => value.toLowerCase().includes(keyword))
  }

  return [item.description, item.detail, item.summary || ''].some((value) => value.toLowerCase().includes(keyword))
}

function normalizedUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function maskPassword(password: string) {
  if (!password) return '-'
  return '•'.repeat(Math.min(Math.max(password.length, 6), 16))
}

function showCopyFeedback(message: string, type: 'success' | 'error' = 'success') {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }

  copyFeedback.value = message
  copyFeedbackType.value = type
  copyFeedbackTimer = setTimeout(() => {
    copyFeedback.value = ''
    copyFeedbackTimer = null
  }, 1800)
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

async function copyText(value: string, label = '内容') {
  if (!value) {
    showCopyFeedback(`没有可复制的${label}`, 'error')
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else if (!fallbackCopyText(value)) {
      throw new Error('copy failed')
    }
    showCopyFeedback(`已复制${label}`)
  } catch {
    showCopyFeedback(`${label}复制失败`, 'error')
  }
}

function resetForm(type: VaultRecordType = activeTab.value) {
  form.type = type
  form.accountKind = 'normal'
  form.title = ''
  form.username = ''
  form.password = ''
  form.url = ''
  form.note = ''
  form.category = ''
  form.description = ''
  form.detail = ''
  formPasswordVisible.value = false
}

function fillForm(item: VaultRecord) {
  resetForm(item.type)

  if (item.type === 'note') {
    form.description = item.description
    form.detail = item.detail
  } else {
    form.accountKind = getAccountKind(item)
    form.title = item.title
    form.username = item.username
    form.password = item.password
    form.url = item.url
    form.note = item.note
    form.category = item.category || ''
  }

  formPasswordVisible.value = false
}

function startCreate(type: VaultRecordType) {
  resetForm(type)
  if (type === 'account') {
    form.accountKind = accountKindFilter.value === 'gpt' ? 'gpt' : 'normal'
    if (form.accountKind === 'normal' && accountCategoryFilter.value !== 'all') {
      form.category = accountCategoryFilter.value
    }
  }
  showSyncPanel.value = false
  editingId.value = null
  editing.value = true
}

function startEdit(item: VaultRecord) {
  fillForm(item)
  activeTab.value = item.type
  showSyncPanel.value = false
  editingId.value = item.id || null
  editing.value = true
}

function selectItem(item: VaultRecord) {
  selectedItemId.value = item.id || null
  editing.value = false
  showSyncPanel.value = false
  passwordVisible.value = false
}

function cancelEdit() {
  editing.value = false
  editingId.value = null
  resetForm(activeTab.value)
}

function startSync() {
  editing.value = false
  editingId.value = null
  passwordVisible.value = false
  showSyncPanel.value = true
  syncMessage.value = ''
  syncError.value = ''
}

function cancelSync() {
  showSyncPanel.value = false
  syncConfirmVisible.value = false
  syncMessage.value = ''
  syncError.value = ''
  resetSyncPreview()
  resetPassivePreview()
}

function setSyncDirection(direction: SyncDirection) {
  if (syncDirection.value === direction) return

  syncDirection.value = direction
  syncConfirmVisible.value = false
  syncMessage.value = ''
  syncError.value = ''
}

function getEditingRecord() {
  if (!editingId.value) return undefined
  return vaultStore.records.find((item) => item.id === editingId.value)
}

function buildRecordFromForm(): VaultRecord {
  const editingRecord = getEditingRecord()
  const source = editingRecord?.source
  const editingAccount = editingRecord?.type === 'account' ? editingRecord : null

  if (form.type === 'note') {
    const editingNote = editingRecord?.type === 'note' ? editingRecord : null
    return {
      id: editingId.value || undefined,
      type: 'note',
      source,
      description: form.description,
      detail: form.detail,
      summary: editingNote?.summary,
      contentFormat: editingNote?.contentFormat,
      importance: editingNote?.importance,
      privateNote: editingNote?.privateNote
    }
  }

  return {
    id: editingId.value || undefined,
    type: 'account',
    accountKind: form.accountKind,
    source,
    title: form.title,
    username: form.username,
    password: form.password,
    url: form.url,
    note: form.note,
    category: form.accountKind === 'normal' ? form.category : '',
    status: form.accountKind === 'gpt' ? editingAccount?.status : undefined
  }
}

function resetSyncPreview() {
  selectingAllSync.value = false
  syncConfirmVisible.value = false
  syncPreviewLoaded.value = false
  syncPreviewRecords.value = []
  selectedSyncKeys.value = []
  selectedSyncRecordsByKey.value = {}
  syncTypeFilter.value = 'all'
  syncAccountCategoryFilter.value = 'all'
  syncPage.value = 1
  syncFilteredTotal.value = 0
  syncTypeCounts.value = {
    all: 0,
    account: 0,
    note: 0
  }
  syncAccountCategoryCounts.value = []
  syncCurrentPageExistingCount.value = 0
}

function resetPassivePreview() {
  passivePreviewLoaded.value = false
  passiveChanges.value = []
  passiveSummary.value = {}
  passiveActionFilter.value = 'all'
  selectedPassiveKeys.value = []
  selectedPassiveChangesByKey.value = {}
}

function getSyncRecordKey(record: VaultRecord, index = 0) {
  if (record.source?.system && record.source.type && record.source.id) {
    return `${record.source.system}:${record.source.type}:${record.source.id}`
  }

  return `${record.type}:${getRecordTitle(record)}:${index}`
}

function getMyAppSourceIdVariants(source: VaultRecord['source']) {
  if (source?.system !== 'myapp' || !source.id) return []

  const variants = new Set([source.id])
  if (source.id.startsWith('CODE_ACCOUNT:')) {
    variants.add(source.id.slice('CODE_ACCOUNT:'.length))
  }
  if (source.id.startsWith('PERSONAL_ACCOUNT:')) {
    variants.add(source.id.slice('PERSONAL_ACCOUNT:'.length))
  }
  const hasKnownAccountPrefix = source.id.startsWith('CODE_ACCOUNT:') || source.id.startsWith('PERSONAL_ACCOUNT:')
  if (source.type === 'CODE_ACCOUNT' && !hasKnownAccountPrefix) {
    variants.add(`CODE_ACCOUNT:${source.id}`)
  }
  if ((source.type === 'PERSONAL_ACCOUNT' || source.type === 'ACCOUNT') && !hasKnownAccountPrefix) {
    variants.add(`PERSONAL_ACCOUNT:${source.id}`)
  }

  return Array.from(variants)
}

function myAppSourceTypesCompatible(left: VaultRecord['source'], right: VaultRecord['source']) {
  if (!left || !right) return false
  if (left.type === right.type) return true

  const accountTypes = ['ACCOUNT', 'CODE_ACCOUNT', 'PERSONAL_ACCOUNT']
  return accountTypes.includes(left.type)
    && accountTypes.includes(right.type)
    && (left.type === 'ACCOUNT' || right.type === 'ACCOUNT')
}

function syncSourcesMatch(left: VaultRecord['source'], right: VaultRecord['source']) {
  if (!left || !right) return false
  if (left.system !== right.system || !myAppSourceTypesCompatible(left, right)) return false

  const leftIds = getMyAppSourceIdVariants(left)
  const rightIds = getMyAppSourceIdVariants(right)
  return leftIds.some((id) => rightIds.includes(id))
}

function findExistingSyncRecord(record: VaultRecord) {
  if (!record.source) return null
  return vaultStore.records.find((item) => syncSourcesMatch(item.source, record.source)) || null
}

function isExistingSyncRecord(record: VaultRecord) {
  return Boolean(findExistingSyncRecord(record))
}

function getExistingSyncRecordKeys(records: VaultRecord[]) {
  const keys = records
    .map((record, index) => (isExistingSyncRecord(record) ? getSyncRecordKey(record, index) : ''))
    .filter((key) => key)

  return Array.from(new Set(keys))
}

function syncPreviewRequestBody(overrides: Partial<{ page: number; pageSize: number }> = {}) {
  return {
    type: syncTypeFilter.value,
    accountCategory: syncTypeFilter.value === 'account' ? syncAccountCategoryFilter.value : 'all',
    page: overrides.page ?? syncPage.value,
    pageSize: overrides.pageSize ?? syncPageSize
  }
}

function addSelectedSyncRecord(item: { key: string; record: VaultRecord }) {
  if (!selectedSyncKeys.value.includes(item.key)) {
    selectedSyncKeys.value = [...selectedSyncKeys.value, item.key]
  }

  selectedSyncRecordsByKey.value = {
    ...selectedSyncRecordsByKey.value,
    [item.key]: item.record
  }
}

function removeSelectedSyncRecord(key: string) {
  const nextRecords = { ...selectedSyncRecordsByKey.value }
  delete nextRecords[key]
  selectedSyncRecordsByKey.value = nextRecords
  selectedSyncKeys.value = selectedSyncKeys.value.filter((item) => item !== key)
}

function toggleSyncRecord(item: { key: string; record: VaultRecord }) {
  if (selectedSyncKeys.value.includes(item.key)) {
    removeSelectedSyncRecord(item.key)
    return
  }

  addSelectedSyncRecord(item)
}

function clearAllSyncRecords() {
  syncConfirmVisible.value = false
  selectedSyncKeys.value = []
  selectedSyncRecordsByKey.value = {}
}

function getPassiveChangeKey(change: PassiveSyncChange, index: number) {
  return `${change.type}:${change.sourceId}:${change.action}:${index}`
}

function isPassiveSelectable(change: PassiveSyncChange) {
  return change.action === 'CREATE' || change.action === 'UPDATE' || change.action === 'CONFLICT'
}

function addSelectedPassiveChange(item: { key: string; change: PassiveSyncChange }) {
  if (!selectedPassiveKeys.value.includes(item.key)) {
    selectedPassiveKeys.value = [...selectedPassiveKeys.value, item.key]
  }

  selectedPassiveChangesByKey.value = {
    ...selectedPassiveChangesByKey.value,
    [item.key]: item.change
  }
}

function removeSelectedPassiveChange(key: string) {
  const nextChanges = { ...selectedPassiveChangesByKey.value }
  delete nextChanges[key]
  selectedPassiveChangesByKey.value = nextChanges
  selectedPassiveKeys.value = selectedPassiveKeys.value.filter((item) => item !== key)
}

function togglePassiveChange(item: { key: string; change: PassiveSyncChange }) {
  if (!isPassiveSelectable(item.change)) return

  if (selectedPassiveKeys.value.includes(item.key)) {
    removeSelectedPassiveChange(item.key)
    return
  }

  addSelectedPassiveChange(item)
}

function selectAllPassiveChanges() {
  selectableFilteredPassiveChanges.value.forEach((item) => addSelectedPassiveChange(item))
}

function clearPassiveChanges() {
  syncConfirmVisible.value = false
  selectedPassiveKeys.value = []
  selectedPassiveChangesByKey.value = {}
}

function countPassiveByAction(action: PassiveActionFilter) {
  if (action === 'all') return passiveChanges.value.length
  return passiveChanges.value.filter((change) => change.action === action).length
}

function getPassiveActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '更新',
    CONFLICT: '冲突',
    UNSUPPORTED: '不可写'
  }
  return labels[action] || action
}

function getPassiveActionClass(action: string) {
  return {
    update: action === 'UPDATE',
    conflict: action === 'CONFLICT',
    disabled: action === 'UNSUPPORTED'
  }
}

function getPassiveTypeLabel(type: string) {
  if (type === 'ACCOUNT') return '账号'
  if (type === 'NOTE') return '记录'
  return type
}

function getPassiveIncomingFields(change: PassiveSyncChange) {
  const incoming = change.incoming && typeof change.incoming === 'object'
    ? change.incoming as Record<string, unknown>
    : {}
  const fields = incoming.fields && typeof incoming.fields === 'object'
    ? incoming.fields as Record<string, unknown>
    : {}
  return fields
}

function getPassiveAccountKind(change: PassiveSyncChange): VaultAccountKind | '' {
  if (change.type !== 'ACCOUNT') return ''
  const fields = getPassiveIncomingFields(change)
  return String(fields.accountSource || '').toUpperCase() === 'CODE_ACCOUNT' ? 'gpt' : 'normal'
}

function getPassiveAccountKindLabel(change: PassiveSyncChange) {
  return getPassiveAccountKind(change) === 'gpt' ? 'GPT 账户' : '普通账户'
}

function getPassiveAccountCategory(change: PassiveSyncChange) {
  if (getPassiveAccountKind(change) !== 'normal') return ''
  const fields = getPassiveIncomingFields(change)
  return String(fields.accountType || '其他')
}

function getPassiveChangeTitle(change: PassiveSyncChange) {
  const fields = getPassiveIncomingFields(change)
  if (change.type === 'ACCOUNT') {
    return String(fields.account || change.sourceId || '未命名账号')
  }
  return String(fields.title || fields.summary || change.sourceId || '未命名记录')
}

function getPassiveChangeSubtitle(change: PassiveSyncChange) {
  const changedFields = Array.isArray(change.changedFields) && change.changedFields.length > 0
    ? change.changedFields.join(', ')
    : ''
  return [
    change.matchReason || '',
    changedFields,
    change.message || change.error || ''
  ].filter(Boolean).join(' · ') || change.sourceId
}

function setSyncTypeFilter(type: VaultRecordType | 'all') {
  if (syncTypeFilter.value === type) return

  syncTypeFilter.value = type
  syncAccountCategoryFilter.value = 'all'
  syncPage.value = 1

  if (syncPreviewLoaded.value) {
    void handleMyAppPreview(false)
  }
}

function setSyncAccountCategoryFilter(category: string) {
  if (syncAccountCategoryFilter.value === category) return

  syncAccountCategoryFilter.value = category
  syncPage.value = 1

  if (syncPreviewLoaded.value) {
    void handleMyAppPreview(false)
  }
}

function goSyncPage(page: number) {
  const nextPage = Math.min(Math.max(Math.trunc(page), 1), syncPageCount.value)
  if (nextPage === syncPage.value) return

  syncPage.value = nextPage
  if (syncPreviewLoaded.value) {
    void handleMyAppPreview(false)
  }
}

function handleSyncPageInput(event: Event) {
  const input = event.target as HTMLInputElement
  const nextPage = Number(input.value)
  if (!Number.isFinite(nextPage)) {
    input.value = String(syncPage.value)
    return
  }

  goSyncPage(nextPage)
  input.value = String(syncPage.value)
}

function applySyncPreviewData(data: SyncPreviewResponse, resetSelection: boolean) {
  const previewRecords = data.records || []
  const existingKeys = getExistingSyncRecordKeys(previewRecords)

  if (resetSelection) {
    selectedSyncKeys.value = []
    selectedSyncRecordsByKey.value = {}
  }

  syncPreviewRecords.value = previewRecords
  syncPreviewLoaded.value = true
  syncTypeCounts.value = data.counts?.types || {
    all: data.counts?.records || previewRecords.length,
    account: 0,
    note: 0
  }
  syncAccountCategoryCounts.value = data.counts?.accountCategories || []
  syncFilteredTotal.value = data.pagination?.total ?? previewRecords.length
  syncPage.value = data.pagination?.page || syncPage.value
  syncCurrentPageExistingCount.value = existingKeys.length

  syncPreviewItems.value.forEach((item) => {
    if (existingKeys.includes(item.key)) {
      addSelectedSyncRecord(item)
    }
  })
}

async function fetchMyAppPreviewPage(body = syncPreviewRequestBody()) {
  const response = await fetch('/api/integrations/myapp/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const data = await response.json() as SyncPreviewResponse

  if (!response.ok || !data.success || !data.records) {
    throw new Error(data.error || 'MyApp 同步失败')
  }

  return data
}

function addSyncPreviewRecords(records: VaultRecord[]) {
  records.forEach((record) => {
    addSelectedSyncRecord({
      record,
      key: getSyncRecordKey(record)
    })
  })
}

async function selectAllFilteredSyncRecords() {
  if (!syncPreviewLoaded.value || selectingAllSync.value) return

  selectingAllSync.value = true
  syncMessage.value = ''
  syncError.value = ''

  try {
    const firstPage = await fetchMyAppPreviewPage(syncPreviewRequestBody({ page: 1, pageSize: syncPageSize }))
    addSyncPreviewRecords(firstPage.records || [])

    const totalPages = firstPage.pagination?.totalPages || 1
    for (let page = 2; page <= totalPages; page += 1) {
      const data = await fetchMyAppPreviewPage(syncPreviewRequestBody({ page, pageSize: syncPageSize }))
      addSyncPreviewRecords(data.records || [])
    }

    syncMessage.value = `已全选当前筛选条件下 ${firstPage.pagination?.total || selectedSyncRecords.value.length} 条记录`
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'MyApp 同步失败'
  } finally {
    selectingAllSync.value = false
  }
}

async function handleMyAppPreview(resetSelection = true) {
  syncing.value = true
  syncConfirmVisible.value = false
  syncMessage.value = ''
  syncError.value = ''

  try {
    const data = await fetchMyAppPreviewPage()
    applySyncPreviewData(data, resetSelection)

    syncMessage.value = syncFilteredTotal.value > 0
      ? `已获取 ${syncFilteredTotal.value} 条记录，本页自动选中 ${syncCurrentPageExistingCount.value} 条已有记录`
      : 'MyApp 暂无可同步记录'
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'MyApp 同步失败'
  } finally {
    syncing.value = false
  }
}

function normalizePassiveChanges(data: PassivePreviewResponse) {
  if (Array.isArray(data.changes)) return data.changes
  return [
    ...(Array.isArray(data.notes) ? data.notes : []),
    ...(Array.isArray(data.accounts) ? data.accounts : [])
  ]
}

async function handlePassivePreview() {
  syncing.value = true
  syncConfirmVisible.value = false
  syncMessage.value = ''
  syncError.value = ''

  try {
    const response = await fetch('/api/integrations/myapp/passive/preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: vaultStore.records
      })
    })
    const data = await response.json() as PassivePreviewResponse

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'MyApp 被动同步预检失败')
    }

    passiveChanges.value = normalizePassiveChanges(data)
    passiveSummary.value = data.summary || {}
    passivePreviewLoaded.value = true
    passiveActionFilter.value = 'all'
    clearPassiveChanges()
    syncMessage.value = passiveChanges.value.length > 0
      ? `预检完成：发现 ${passiveChanges.value.length} 条变更`
      : '预检完成：暂无需要同步的变更'
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'MyApp 被动同步预检失败'
  } finally {
    syncing.value = false
  }
}

function handleSyncPreviewAction() {
  if (syncDirection.value === 'pull') {
    void handleMyAppPreview(true)
    return
  }

  void handlePassivePreview()
}

function openSyncConfirm() {
  if (syncDirection.value === 'pull') {
    if (selectedSyncRecords.value.length === 0) {
      syncError.value = '请选择要同步的记录'
      return
    }
  } else if (selectedPassiveChanges.value.length === 0) {
    syncError.value = '请选择要确认的变更'
    return
  }

  syncConfirmVisible.value = true
}

function closeSyncConfirm() {
  if (vaultStore.saving || syncing.value) return
  syncConfirmVisible.value = false
}

async function executeMyAppSync() {
  if (syncDirection.value === 'push') {
    await executePassiveSync()
    return
  }

  const records = selectedSyncRecords.value
  if (records.length === 0) {
    syncConfirmVisible.value = false
    syncError.value = '请选择要同步的记录'
    return
  }

  syncMessage.value = ''
  syncError.value = ''

  const result = await vaultStore.syncRecords(records)
  syncConfirmVisible.value = false
  syncMessage.value = `同步完成：新增 ${result.created} 条，更新 ${result.updated} 条，失败 ${result.failed} 条`
  selectedSyncKeys.value = []
  selectedSyncRecordsByKey.value = {}
  activeTab.value = vaultStore.visibleTabs[0] || 'account'
  selectedItemId.value = filteredItems.value[0]?.id || null
}

async function executePassiveSync() {
  const changes = selectedPassiveChanges.value
  if (changes.length === 0) {
    syncConfirmVisible.value = false
    syncError.value = '请选择要确认的变更'
    return
  }

  syncing.value = true
  syncMessage.value = ''
  syncError.value = ''

  try {
    const response = await fetch('/api/integrations/myapp/passive/confirm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changes
      })
    })
    const data = await response.json() as PassivePreviewResponse

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'MyApp 被动同步确认失败')
    }

    passiveChanges.value = normalizePassiveChanges(data)
    passiveSummary.value = data.summary || passiveSummary.value
    selectedPassiveKeys.value = []
    selectedPassiveChangesByKey.value = {}
    syncConfirmVisible.value = false
    syncMessage.value = `确认完成：已提交 ${changes.length} 条变更`
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'MyApp 被动同步确认失败'
  } finally {
    syncing.value = false
  }
}

async function handleSave() {
  const data = buildRecordFromForm()
  const success = editingId.value
    ? await vaultStore.updateItem(editingId.value, data)
    : await vaultStore.createItem(data)

  if (!success) return
  if (data.type === 'account' && data.accountKind === 'normal') {
    await ensureAccountCategorySaved(data.category || '')
  }

  activeTab.value = data.type
  if (data.type === 'account') {
    accountKindFilter.value = data.accountKind
    accountCategoryFilter.value = data.accountKind === 'normal' && data.category ? data.category : 'all'
  }
  selectedItemId.value = editingId.value || vaultStore.records.find((item) => item.type === data.type)?.id || null
  cancelEdit()
}

async function handleDelete(item: VaultRecord) {
  if (!item.id) return
  if (!confirm(`确定要删除"${getRecordTitle(item) || '未命名'}"吗？`)) return

  const success = await vaultStore.deleteItem(item.id)
  if (!success) return

  selectedItemId.value = filteredItems.value[0]?.id || null
  editing.value = false
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=?'
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  form.password = Array.from(bytes)
    .map((byte) => chars[byte % chars.length])
    .join('')
  formPasswordVisible.value = true
}

</script>

<style scoped>
.vault-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: var(--spacing-lg);
  background: rgba(0, 0, 0, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vault-dialog {
  --vault-scrollbar-track: rgba(15, 23, 42, 0.04);
  --vault-scrollbar-thumb: rgba(37, 99, 235, 0.28);
  --vault-scrollbar-thumb-hover: rgba(37, 99, 235, 0.48);
  width: min(1160px, 96vw);
  height: min(820px, 94vh);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(245, 247, 251, 0.92));
  color: #111827;
  border: 1px solid rgba(255, 255, 255, 0.44);
  border-radius: var(--radius-lg);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-header {
  min-height: 74px;
  padding: 0 var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.vault-header h2 {
  font-size: 20px;
  font-weight: 700;
}

.vault-header p,
.vault-muted {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.vault-close {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  color: #4b5563;
  font-size: 22px;
}

.vault-close:hover,
.vault-icon-button:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.08);
}

.vault-unlock {
  width: min(380px, 88vw);
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.vault-mark {
  width: 62px;
  height: 62px;
  margin: 0 auto var(--spacing-sm);
  border-radius: 20px;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);
}

.vault-workspace {
  position: relative;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 350px minmax(0, 1fr);
  overflow: hidden;
}

.vault-list-panel {
  min-height: 0;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
}

.vault-toolbar {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.vault-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.vault-search {
  min-width: 0;
  flex: 1;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.vault-search input,
.vault-field input,
.vault-field textarea {
  width: 100%;
  min-width: 0;
  background: transparent;
  color: #111827;
  font-size: 14px;
}

.vault-icon-button {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vault-icon-button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.vault-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xs);
  padding: 0 var(--spacing-md) var(--spacing-sm);
}

.vault-tab {
  min-width: 0;
  height: 38px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.06);
  color: #374151;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.vault-tab small {
  opacity: 0.6;
}

.vault-tab.active {
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.vault-tab-settings {
  margin: 0 var(--spacing-md) var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.vault-tab-settings label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 700;
}

.vault-account-categories {
  padding: 0 var(--spacing-md) var(--spacing-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  max-height: 88px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}

.vault-account-kinds {
  padding: 0 var(--spacing-md) var(--spacing-xs);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-xs);
}

.vault-account-categories::-webkit-scrollbar {
  display: none;
}

.vault-category-chip,
.vault-category-add,
.vault-category-editor {
  min-width: 0;
  max-width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #374151;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.vault-category-add {
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  padding: 0;
  justify-content: center;
}

.vault-category-editor {
  width: min(220px, 100%);
  padding-right: 4px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.vault-category-editor input {
  min-width: 0;
  flex: 1;
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 800;
}

.vault-category-editor button {
  width: 26px;
  min-width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 999px;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vault-category-editor button:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.12);
}

.vault-category-editor button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.vault-category-chip small {
  flex-shrink: 0;
  opacity: 0.62;
}

.vault-category-chip.active {
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.vault-eye-button {
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vault-eye-button:hover {
  background: rgba(15, 23, 42, 0.1);
}

.vault-list {
  min-height: 0;
  flex: 1;
  padding: 0 var(--spacing-md) var(--spacing-md);
  overflow-y: auto;
}

.vault-list-sentinel,
.vault-list-end {
  padding: var(--spacing-sm) 0;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
}

.spinning {
  animation: vault-spin 0.8s linear infinite;
}

@keyframes vault-spin {
  to {
    transform: rotate(360deg);
  }
}

.vault-item {
  width: 100%;
  min-height: 62px;
  padding: 10px;
  border-radius: var(--radius-md);
  color: #111827;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.vault-item:hover,
.vault-item.active {
  background: rgba(37, 99, 235, 0.1);
}

.vault-item-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(124, 58, 237, 0.18));
  color: #1d4ed8;
  font-size: 15px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vault-item-icon.large {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  font-size: 20px;
}

.vault-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vault-item-main strong,
.vault-preview-title h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-item-main small,
.vault-preview-title small {
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-detail {
  min-width: 0;
  min-height: 0;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.vault-preview,
.vault-form {
  max-width: 680px;
  margin: 0 auto;
}

.vault-sync-form {
  width: min(760px, 100%);
  height: 100%;
  min-height: 0;
}

.vault-sync-form > h3,
.vault-sync-form .vault-import-summary {
  flex-shrink: 0;
}

.vault-preview-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.vault-preview-title h3,
.vault-form h3 {
  font-size: 24px;
  font-weight: 750;
}

.vault-preview-title a {
  display: inline-block;
  max-width: 100%;
  margin-top: 6px;
  color: #2563eb;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-data-grid,
.vault-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.vault-data-row {
  min-height: 52px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.vault-data-row-meta {
  grid-template-columns: 64px minmax(0, 1fr);
}

.vault-data-row span,
.vault-field span {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.vault-data-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.vault-data-row button,
.vault-secondary,
.vault-danger,
.vault-primary,
.vault-password-input button {
  height: 36px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 700;
}

.vault-data-row .vault-eye-button,
.vault-password-input .vault-eye-button {
  padding: 0;
}

.vault-data-row button,
.vault-secondary,
.vault-password-input button {
  background: rgba(15, 23, 42, 0.07);
  color: #374151;
}

.vault-primary {
  background: #2563eb;
  color: #ffffff;
}

.vault-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vault-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #b91c1c;
}

.vault-note {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  color: #374151;
  line-height: 1.5;
}

.vault-detail-actions,
.vault-form-actions {
  margin-top: var(--spacing-lg);
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.vault-sync-form .vault-form-actions {
  flex-shrink: 0;
  margin-top: 0;
  padding-top: var(--spacing-sm);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.vault-drawer-backdrop {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.18));
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.vault-edit-drawer {
  width: min(480px, 100%);
  height: 100%;
  max-width: none;
  min-height: 0;
  margin: 0;
  padding: var(--spacing-lg);
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--vault-scrollbar-thumb) transparent;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.94));
  border-left: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: -24px 0 52px rgba(15, 23, 42, 0.18);
}

.vault-edit-drawer::-webkit-scrollbar {
  width: 8px;
}

.vault-edit-drawer::-webkit-scrollbar-track {
  margin: 8px 0;
  border-radius: 999px;
  background: var(--vault-scrollbar-track);
}

.vault-edit-drawer::-webkit-scrollbar-thumb {
  min-height: 44px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--vault-scrollbar-thumb);
  background-clip: padding-box;
}

.vault-edit-drawer::-webkit-scrollbar-thumb:hover {
  background: var(--vault-scrollbar-thumb-hover);
  background-clip: padding-box;
}

.vault-edit-drawer > h3 {
  flex-shrink: 0;
}

.vault-edit-drawer .vault-form-actions {
  position: sticky;
  bottom: calc(var(--spacing-lg) * -1);
  margin: var(--spacing-sm) calc(var(--spacing-lg) * -1) calc(var(--spacing-lg) * -1);
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.78), rgba(248, 250, 252, 0.98) 34%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.vault-confirm-backdrop {
  position: absolute;
  inset: 0;
  z-index: 8;
  padding: var(--spacing-lg);
  background: rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vault-confirm-card {
  width: min(430px, 100%);
  padding: var(--spacing-lg);
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94));
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.vault-confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.28);
}

.vault-confirm-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.vault-confirm-content h3 {
  color: #111827;
  font-size: 22px;
  font-weight: 780;
}

.vault-confirm-content p {
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
}

.vault-confirm-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing-sm);
}

.vault-confirm-summary span {
  min-height: 74px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.vault-confirm-summary small {
  color: #6b7280;
  font-size: 12px;
  font-weight: 800;
}

.vault-confirm-summary strong {
  color: #1d4ed8;
  font-size: 24px;
  font-weight: 850;
}

.vault-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.vault-copy-toast {
  position: absolute;
  right: var(--spacing-lg);
  top: var(--spacing-lg);
  z-index: 12;
  min-height: 42px;
  max-width: min(320px, calc(100% - var(--spacing-lg) * 2));
  padding: 0 14px;
  border: 1px solid rgba(5, 150, 105, 0.18);
  border-radius: var(--radius-md);
  background: rgba(236, 253, 245, 0.94);
  color: #047857;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 850;
}

.vault-copy-toast.error {
  border-color: rgba(220, 38, 38, 0.18);
  background: rgba(254, 242, 242, 0.94);
  color: #b91c1c;
}

.vault-toast-enter-active,
.vault-toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.vault-toast-enter-from,
.vault-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.vault-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vault-field input,
.vault-field textarea,
.vault-password-input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.04);
}

.vault-password-input input {
  min-height: 0;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.vault-field textarea {
  min-height: 96px;
  padding: 12px;
  resize: vertical;
}

.vault-password-input {
  padding-right: 6px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.vault-kind-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xs);
}

.vault-password-input .vault-eye-button {
  background: transparent;
}

.vault-import-summary {
  min-height: 38px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.05);
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  font-size: 13px;
  font-weight: 700;
}

.vault-import-summary strong {
  color: #dc2626;
  font-weight: 700;
}

.vault-sync-mode {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xs);
}

.vault-sync-tools {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.vault-sync-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-xs);
}

.vault-sync-categories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  max-height: 88px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.vault-sync-categories::-webkit-scrollbar {
  display: none;
}

.vault-tab.compact {
  height: 34px;
  font-size: 12px;
}

.vault-sync-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.vault-sync-list {
  flex: 1 1 220px;
  min-height: 160px;
  max-height: none;
  padding: 4px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.04);
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--vault-scrollbar-thumb) transparent;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vault-sync-list::-webkit-scrollbar {
  width: 8px;
}

.vault-sync-list::-webkit-scrollbar-track {
  margin: 8px 0;
  border-radius: 999px;
  background: var(--vault-scrollbar-track);
}

.vault-sync-list::-webkit-scrollbar-thumb {
  min-height: 44px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--vault-scrollbar-thumb);
  background-clip: padding-box;
}

.vault-sync-list::-webkit-scrollbar-thumb:hover {
  background: var(--vault-scrollbar-thumb-hover);
  background-clip: padding-box;
}

.vault-sync-item {
  min-height: 62px;
  padding: 10px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.54);
  display: grid;
  grid-template-columns: 18px 38px minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.vault-sync-item:hover {
  background: rgba(37, 99, 235, 0.08);
}

.vault-sync-item.passive {
  grid-template-columns: 18px 38px minmax(0, 1fr) auto auto auto;
}

.vault-sync-item.disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.vault-sync-item.disabled:hover {
  background: rgba(255, 255, 255, 0.54);
}

.vault-sync-item input {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.vault-sync-badge {
  min-width: 42px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.vault-sync-badge.update {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.vault-sync-badge.conflict {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.vault-sync-badge.gpt {
  background: rgba(124, 58, 237, 0.12);
  color: #6d28d9;
}

.vault-sync-badge.disabled {
  background: rgba(107, 114, 128, 0.12);
  color: #6b7280;
}

.vault-sync-badge.category {
  background: rgba(15, 23, 42, 0.08);
  color: #374151;
}

.vault-sync-pagination {
  flex-shrink: 0;
  min-height: 38px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.vault-sync-pagination span {
  color: #6b7280;
  font-size: 13px;
  font-weight: 700;
}

.vault-sync-page-jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.vault-sync-page-jump input {
  width: 68px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.66);
  color: #111827;
  font-weight: 800;
  text-align: center;
}

.vault-error {
  flex-shrink: 0;
  margin: 0;
  color: #dc2626;
  font-size: 13px;
}

.vault-success {
  flex-shrink: 0;
  margin: 0;
  color: #059669;
  font-size: 13px;
  font-weight: 700;
}

.vault-empty {
  padding: var(--spacing-lg);
  color: #6b7280;
  text-align: center;
}

:global(.theme-cyberpunk) .vault-dialog {
  --vault-scrollbar-track: rgba(0, 255, 255, 0.08);
  --vault-scrollbar-thumb: rgba(0, 255, 255, 0.34);
  --vault-scrollbar-thumb-hover: rgba(255, 0, 255, 0.52);
  background: rgba(10, 14, 39, 0.96);
  color: #00ffff;
  border: 2px solid rgba(0, 255, 255, 0.86);
  box-shadow: 0 0 34px rgba(0, 255, 255, 0.34);
}

:global(.theme-cyberpunk) .vault-header,
:global(.theme-cyberpunk) .vault-list-panel,
:global(.theme-cyberpunk) .vault-edit-drawer,
:global(.theme-cyberpunk) .vault-edit-drawer .vault-form-actions {
  border-color: rgba(0, 255, 255, 0.26);
}

:global(.theme-cyberpunk) .vault-drawer-backdrop {
  background:
    linear-gradient(90deg, rgba(10, 14, 39, 0.24), rgba(255, 0, 255, 0.12));
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

:global(.theme-cyberpunk) .vault-confirm-backdrop {
  background: rgba(10, 14, 39, 0.48);
}

:global(.theme-cyberpunk) .vault-edit-drawer {
  background:
    linear-gradient(180deg, rgba(10, 14, 39, 0.98), rgba(16, 20, 52, 0.96));
  box-shadow:
    -24px 0 48px rgba(0, 0, 0, 0.36),
    -1px 0 18px rgba(0, 255, 255, 0.22);
}

:global(.theme-cyberpunk) .vault-edit-drawer .vault-form-actions {
  background:
    linear-gradient(180deg, rgba(10, 14, 39, 0.74), rgba(10, 14, 39, 0.98) 34%);
}

:global(.theme-cyberpunk) .vault-confirm-card {
  border-color: rgba(0, 255, 255, 0.32);
  background:
    linear-gradient(180deg, rgba(10, 14, 39, 0.98), rgba(16, 20, 52, 0.96));
  box-shadow:
    0 24px 58px rgba(0, 0, 0, 0.42),
    0 0 22px rgba(0, 255, 255, 0.18);
}

:global(.theme-cyberpunk) .vault-confirm-content h3,
:global(.theme-cyberpunk) .vault-confirm-summary strong {
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-confirm-content p,
:global(.theme-cyberpunk) .vault-confirm-summary small {
  color: rgba(0, 255, 255, 0.72);
}

:global(.theme-cyberpunk) .vault-confirm-summary span {
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.22);
}

:global(.theme-cyberpunk) .vault-copy-toast {
  border-color: rgba(0, 255, 255, 0.26);
  background: rgba(10, 14, 39, 0.9);
  color: #00ffff;
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.36),
    0 0 18px rgba(0, 255, 255, 0.16);
}

:global(.theme-cyberpunk) .vault-copy-toast.error {
  border-color: rgba(255, 0, 255, 0.28);
  background: rgba(31, 18, 52, 0.92);
  color: #ff9df5;
}

:global(.theme-cyberpunk) .vault-search,
:global(.theme-cyberpunk) .vault-tab,
:global(.theme-cyberpunk) .vault-tab-settings,
:global(.theme-cyberpunk) .vault-category-chip,
:global(.theme-cyberpunk) .vault-category-add,
:global(.theme-cyberpunk) .vault-category-editor,
:global(.theme-cyberpunk) .vault-data-row,
:global(.theme-cyberpunk) .vault-note,
:global(.theme-cyberpunk) .vault-import-summary,
:global(.theme-cyberpunk) .vault-sync-list,
:global(.theme-cyberpunk) .vault-sync-item,
:global(.theme-cyberpunk) .vault-field input,
:global(.theme-cyberpunk) .vault-field textarea,
:global(.theme-cyberpunk) .vault-password-input,
:global(.theme-cyberpunk) .vault-sync-page-jump input {
  background: rgba(0, 255, 255, 0.08);
  border-color: rgba(0, 255, 255, 0.32);
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-item,
:global(.theme-cyberpunk) .vault-close,
:global(.theme-cyberpunk) .vault-icon-button,
:global(.theme-cyberpunk) .vault-tab,
:global(.theme-cyberpunk) .vault-category-chip,
:global(.theme-cyberpunk) .vault-category-add,
:global(.theme-cyberpunk) .vault-category-editor,
:global(.theme-cyberpunk) .vault-category-editor input,
:global(.theme-cyberpunk) .vault-category-editor button,
:global(.theme-cyberpunk) .vault-eye-button,
:global(.theme-cyberpunk) .vault-field input,
:global(.theme-cyberpunk) .vault-field textarea,
:global(.theme-cyberpunk) .vault-search input,
:global(.theme-cyberpunk) .vault-sync-page-jump input {
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-tab.active,
:global(.theme-cyberpunk) .vault-category-chip.active,
:global(.theme-cyberpunk) .vault-category-editor button:hover:not(:disabled),
:global(.theme-cyberpunk) .vault-item:hover,
:global(.theme-cyberpunk) .vault-item.active,
:global(.theme-cyberpunk) .vault-sync-item:hover {
  background: rgba(255, 0, 255, 0.14);
}

:global(.theme-cyberpunk) .vault-sync-item.disabled:hover {
  background: rgba(0, 255, 255, 0.08);
}

:global(.theme-cyberpunk) .vault-sync-badge {
  background: rgba(0, 255, 255, 0.14);
  color: #00ffff;
}

:global(.theme-cyberpunk) .vault-sync-badge.update {
  background: rgba(250, 204, 21, 0.18);
  color: #fde68a;
}

:global(.theme-cyberpunk) .vault-sync-badge.conflict {
  background: rgba(255, 0, 255, 0.18);
  color: #ff9df5;
}

:global(.theme-cyberpunk) .vault-sync-badge.gpt {
  background: rgba(255, 0, 255, 0.16);
  color: #ff9df5;
}

:global(.theme-cyberpunk) .vault-sync-badge.category,
:global(.theme-cyberpunk) .vault-sync-badge.disabled {
  background: rgba(0, 255, 255, 0.08);
  color: rgba(0, 255, 255, 0.72);
}

:global(.theme-cyberpunk) .vault-header p,
:global(.theme-cyberpunk) .vault-muted,
:global(.theme-cyberpunk) .vault-field span,
:global(.theme-cyberpunk) .vault-sync-pagination span,
:global(.theme-cyberpunk) .vault-item-main small,
:global(.theme-cyberpunk) .vault-preview-title small,
:global(.theme-cyberpunk) .vault-data-row span,
:global(.theme-cyberpunk) .vault-import-summary,
:global(.theme-cyberpunk) .vault-empty,
:global(.theme-cyberpunk) .vault-tab-settings label {
  color: rgba(0, 255, 255, 0.72);
}

:global(.theme-cyberpunk) .vault-primary {
  background: rgba(255, 0, 255, 0.32);
  box-shadow: 0 0 18px rgba(255, 0, 255, 0.36);
}

@media (max-width: 820px) {
  .vault-modal {
    padding: var(--spacing-sm);
  }

  .vault-dialog {
    height: 94vh;
  }

  .vault-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: 288px minmax(0, 1fr);
  }

  .vault-drawer-backdrop {
    justify-content: flex-end;
    background: rgba(15, 23, 42, 0.2);
  }

  .vault-edit-drawer {
    width: min(440px, 94vw);
    padding: var(--spacing-md);
  }

  .vault-edit-drawer .vault-form-actions {
    bottom: calc(var(--spacing-md) * -1);
    margin: var(--spacing-sm) calc(var(--spacing-md) * -1) calc(var(--spacing-md) * -1);
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  }

  .vault-confirm-backdrop {
    padding: var(--spacing-md);
  }

  .vault-confirm-card {
    padding: var(--spacing-md);
  }

  .vault-list-panel {
    border-right: 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  .vault-toolbar {
    flex-wrap: wrap;
  }

  .vault-data-row {
    grid-template-columns: 1fr auto auto;
  }

  .vault-data-row span {
    grid-column: 1 / -1;
  }

  .vault-sync-list {
    min-height: 120px;
  }

  .vault-sync-item,
  .vault-sync-item.passive {
    grid-template-columns: 18px 38px minmax(0, 1fr);
  }

  .vault-sync-badge {
    justify-self: start;
  }
}
</style>
