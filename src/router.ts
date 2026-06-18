import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import SearchEngine from './views/SearchEngine.vue'

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
