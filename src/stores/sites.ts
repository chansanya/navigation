import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePrivacyStore, PRIVATE_CATEGORY_NAME } from './privacy'

export interface Site {
  id?: number
  name: string
  url: string
  icon?: string
  category?: string
  description?: string
  sort?: number
  created_at?: string
  updated_at?: string
}

export interface Category {
  id?: number
  name: string
  sort: number
  created_at?: string
  updated_at?: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

interface SitesResponse extends ApiResponse {
  sites?: Site[]
}

interface CategoriesResponse extends ApiResponse {
  categories?: Category[]
}

export const useSitesStore = defineStore('sites', () => {
  const sites = ref<Site[]>([])
  const categoryList = ref<Category[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  // 计算属性：按分类分组（基于数据库分类）
  const categories = computed(() => {
    // 先按 sort 排序分类
    const sortedCategories = [...categoryList.value].sort((a: Category, b: Category) => b.sort - a.sort)

    // 只展示数据库里存在的分类，避免书签导入等临时来源制造孤立分类面板。
    return sortedCategories.map((category: Category) => ({
      category: category.name,
      categoryId: category.id,
      sort: category.sort,
      sites: sites.value
        .filter((site: Site) => site.category === category.name)
        .sort((a: Site, b: Site) => (b.sort || 0) - (a.sort || 0))
    }))
  })

  // 获取所有站点
  async function fetchSites(category?: string) {
    const privacyStore = usePrivacyStore()
    // 只有首次加载（无数据）才显示 loading，避免组件卸载导致分类定位丢失
    const isFirstLoad = sites.value.length === 0
    if (isFirstLoad) {
      loading.value = true
    }
    error.value = ''

    try {
      const url = category ? `/api/sites?category=${encodeURIComponent(category)}` : '/api/sites'
      const response = await fetch(url, {
        headers: privacyStore.privacyHeaders()
      })
      const data = await response.json() as SitesResponse

      if (data.success && data.sites) {
        sites.value = data.sites
      } else {
        error.value = data.error || '获取站点失败'
      }
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to fetch sites:', err)
    } finally {
      if (isFirstLoad) {
        loading.value = false
      }
    }
  }

  // 获取所有分类
  async function fetchCategories() {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch('/api/categories', {
        headers: privacyStore.privacyHeaders()
      })
      const data = await response.json() as CategoriesResponse

      if (data.success && data.categories) {
        categoryList.value = data.categories
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  // 创建分类
  async function createCategory(name: string): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify({ name })
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchCategories()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to create category:', err)
      return false
    }
  }

  // 更新分类排序
  async function updateCategorySort(categoryId: number, sort: number): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify({ sort })
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchCategories()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update category sort:', err)
      return false
    }
  }

  // 更新分类名称
  async function updateCategoryName(categoryId: number, name: string): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify({ name })
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        // 分类改名会同步影响站点的 category 字段，所以分类和站点都需要刷新。
        await Promise.all([fetchCategories(), fetchSites()])
        return true
      }

      error.value = data.error || '更新分类失败'
      return false
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to update category name:', err)
      return false
    }
  }

  // 删除分类
  async function deleteCategory(categoryId: number): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          ...privacyStore.privacyHeaders()
        }
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchCategories()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to delete category:', err)
      return false
    }
  }

  // 创建站点
  async function createSite(siteData: Site): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    // 前端先做一次隐私空间门槛判断，后端仍会再次校验，形成双层保护。
    if (siteData.category === PRIVATE_CATEGORY_NAME && !privacyStore.isUnlocked) {
      error.value = '请先进入隐私模式'
      return false
    }

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify(siteData)
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchSites()
        return true
      } else {
        error.value = data.error || '创建站点失败'
        return false
      }
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to create site:', err)
      return false
    }
  }

  // 更新站点
  async function updateSite(id: number, siteData: Partial<Site>): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    // 移入隐私空间属于敏感操作，必须先进入隐私模式。
    if (siteData.category === PRIVATE_CATEGORY_NAME && !privacyStore.isUnlocked) {
      error.value = '请先进入隐私模式'
      return false
    }

    try {
      const response = await fetch(`/api/sites/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...privacyStore.privacyHeaders()
        },
        body: JSON.stringify(siteData)
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchSites()
        return true
      } else {
        error.value = data.error || '更新站点失败'
        return false
      }
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to update site:', err)
      return false
    }
  }

  // 删除站点
  async function deleteSite(id: number): Promise<boolean> {
    const privacyStore = usePrivacyStore()

    try {
      const response = await fetch(`/api/sites/${id}`, {
        method: 'DELETE',
        headers: {
          ...privacyStore.privacyHeaders()
        }
      })

      const data = await response.json() as ApiResponse

      if (data.success) {
        await fetchSites()
        return true
      } else {
        error.value = data.error || '删除站点失败'
        return false
      }
    } catch (err) {
      error.value = '网络错误'
      console.error('Failed to delete site:', err)
      return false
    }
  }

  return {
    sites,
    categoryList,
    loading,
    error,
    categories,
    fetchSites,
    fetchCategories,
    createCategory,
    updateCategorySort,
    updateCategoryName,
    deleteCategory,
    createSite,
    updateSite,
    deleteSite
  }
})
