import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import SearchEngine from './views/SearchEngine.vue'

// `/` 是搜索主页，`/sites` 是导航管理/浏览页；旧 `/admin` 统一重定向到 `/sites`。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'search',
      component: SearchEngine
    },
    {
      path: '/sites',
      name: 'sites',
      component: Home
    },
    {
      path: '/admin',
      redirect: '/sites'
    }
  ]
})

export default router
