import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  base: '/navigation/',
  lang: 'zh-CN',
  title: 'Navigation',
  description: '个人导航站文档 — 基于 Vue 3 + Cloudflare Pages + D1',
  head: [
    ['link', { rel: 'icon', href: '/navigation/favicon.svg' }]
  ],

  bundler: viteBundler(),

  theme: defaultTheme({
    logo: '/logo.svg',
    repo: 'chansanya/navigation',
    docsDir: 'vuepress-docs/src',

    navbar: [
      { text: '首页', link: '/' },
      { text: '快速上手', link: '/guide/quickstart' },
      { text: '部署指南', link: '/guide/deploy' },
      { text: 'MCP 接入', link: '/guide/mcp' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          children: [
            '/guide/quickstart',
            '/guide/deploy',
            '/guide/mcp'
          ]
        }
      ]
    }
  })
})
