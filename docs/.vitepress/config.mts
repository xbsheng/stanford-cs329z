import { defineConfig, type HeadConfig } from 'vitepress'
import markdownItKatex from '@vscode/markdown-it-katex'
import katex from 'katex'
import { essenceSidebar, notesSidebar } from './course'

const katexPlugin = (markdownItKatex as unknown as { default?: unknown }).default ?? markdownItKatex

const siteUrl = process.env.DOCS_URL || 'https://xbsheng.github.io/stanford-cs329z/'
const base = process.env.DOCS_BASE || '/stanford-cs329z/'
const siteTitle = 'Stanford CS329Z 中文讲义'
const siteDescription = '斯坦福 CS329Z Engineering AI Agents（2026 秋）中文讲义与速读卡'
const canonicalBase = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`

export default defineConfig({
  lang: 'zh-CN',
  title: siteTitle,
  description: siteDescription,
  // Project site on GitHub Pages: https://xbsheng.github.io/stanford-cs329z/
  // Override with DOCS_BASE=/ when deploying to a custom domain.
  base,
  cleanUrls: true,
  router: { prefetchLinks: false },
  lastUpdated: true,
  sitemap: {
    hostname: siteUrl,
    transformItems: (items) => items.filter((item) => !item.url.endsWith('404'))
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '64x64', href: `${base}favicon.png` }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: `${base}apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#8c1515' }],
    ['meta', { name: 'theme-color', content: '#121212', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'format-detection', content: 'telephone=no' }],
    ['meta', { property: 'og:site_name', content: 'Stanford CS329Z · Engineering AI Agents' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:image', content: `${canonicalBase}og-image.png` }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'Stanford CS329Z 中文讲义' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${canonicalBase}og-image.png` }]
  ],
  transformHead({ pageData }): HeadConfig[] {
    if (pageData.relativePath === '404.md') return []

    const rel = pageData.relativePath
      .replace(/\.md$/, '')
      .replace(/(^|\/)index$/, '$1')
    const canonical = new URL(rel, canonicalBase).href
    const title = pageData.title && pageData.title !== siteTitle
      ? `${pageData.title} | ${siteTitle}`
      : siteTitle
    const description = pageData.frontmatter.description || siteDescription
    const isArticle = /^(notes|essence)\/lecture-/.test(pageData.relativePath)

    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:type', content: isArticle ? 'article' : 'website' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }]
    ]
  },
  themeConfig: {
    logo: { src: '/logo-nav.png', alt: 'Stanford CS329Z' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xbsheng/stanford-cs329z', ariaLabel: 'GitHub' }
    ],
    editLink: {
      pattern: 'https://github.com/xbsheng/stanford-cs329z/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清除查询',
            backButtonTitle: '返回',
            noResultsText: '没有找到结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    nav: [
      { text: '课程日程', link: '/schedule', activeMatch: '/schedule' },
      { text: '详细讲义', link: '/notes/', activeMatch: '/notes/' },
      { text: '精华版', link: '/essence/', activeMatch: '/essence/' },
      { text: '原课程', link: 'https://cs329z.stanford.edu/' }
    ],
    sidebar: {
      '/notes/': notesSidebar,
      '/essence/': essenceSidebar
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    skipToContentLabel: '跳转到正文',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    footer: {
      message: '基于 Stanford CS329Z 公开课件整理，仅供学习使用',
      copyright: 'Course materials © Stanford University'
    }
  },
  markdown: {
    lineNumbers: true,
    math: false,
    config: (md) => md.use(katexPlugin as Parameters<typeof md.use>[0], { katex, throwOnError: true, strict: 'ignore' })
  }
})
