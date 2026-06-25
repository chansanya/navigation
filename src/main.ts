import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import './styles/variables.css'
import './styles/themes/glass.css'
import './styles/themes/cyberpunk.css'

// Pinia 和 Router 在根应用挂载前注册，所有视图都能共享全局状态和路由。
const pinia = createPinia()

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
