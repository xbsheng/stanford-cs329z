# 斯坦福 CS329Z · Engineering AI Agents（2026 秋）中文讲义

来源：[cs329z.stanford.edu](https://cs329z.stanford.edu/) · Slides 已下载至 `slides/`

在线阅读：<https://xbsheng.github.io/stanford-cs329z/>

基于 VitePress 构建，参照 [xbsheng/cmu-agents](https://github.com/xbsheng/cmu-agents) 的组织方式：每讲一份详细讲义（`docs/notes/`）+ 一张 5 分钟速读卡（`docs/essence/`），关键页面以 2 倍分辨率渲染为 WebP 并标注页码。

## 课程笔记

已整理 10 讲（当前已发布 slides 的全部讲次）：

**基础与全景**

- [1 · 导论：什么是 Agentic 系统？](docs/notes/lecture-01-intro-agentic-systems.md)
- [2 · 给构建者的 LLM](docs/notes/lecture-02-llms-for-builders.md)

**构建模块**

- [3 · RAG：把证据放进上下文](docs/notes/lecture-03-rag.md)
- [4 · Tool Use：把语言变成动作](docs/notes/lecture-04-tool-use.md)

**框架与设计**

- [5 · 框架与编排：抽象换来了什么](docs/notes/lecture-05-frameworks.md)
- [6 · 设计模式与 Scaffold](docs/notes/lecture-06-design-patterns.md)
- [7 · Agent 记忆：跨会话的连续性](docs/notes/lecture-07-memory.md)

**系统与优化**

- [8 · 多智能体：协调的成本](docs/notes/lecture-08-multi-agent.md)
- [9 · 优化：用数据换行为](docs/notes/lecture-09-optimization.md)

**客座讲座**

- [10 · Terminal-Bench：在终端里考 agent](docs/notes/lecture-10-terminal-bench.md)

## 精华版

10 讲各有一张 5 分钟速读卡，另有 50 分钟学习路线、系统栈与跨讲对照表：[精华版总览](docs/essence/index.md)。

在线阅读时，顶部可在「详细讲义」与「精华版」之间切换；每一讲的两种版本页一一对应。

## 本地开发

需要 Node.js 22+。

```bash
npm install
npm run docs:dev          # 本地预览 http://localhost:5173/stanford-cs329z/
npm run docs:build        # 构建到 docs/.vitepress/dist
npm run docs:check        # 检查站内链接、图片引用、sitemap 与 KaTeX
npm run docs:preview      # 预览构建产物
```

`docs:check` 需要先 `docs:build`，CI 在构建后自动执行。

### 重新渲染某页 slide

```bash
python3 scripts/render_slides.py 03 5 12 18   # 第 3 讲第 5、12、18 页
```

输出到 `docs/public/images/lecture-03/p05.webp`、`p12.webp`、`p18.webp`，正文用 `<SlideFigure lecture="03" page="5" caption="…" />` 引用。

### 重新生成图标与 OG 图片

```bash
python3 scripts/make_assets.py
```

## 部署到 GitHub Pages

仓库已配置 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：推送到 `main` 后自动构建、执行链接检查并发布。

首次部署只需在 GitHub 上设置一次：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；
2. 推送到 `main`，或在 **Actions → Deploy docs to GitHub Pages** 里手动 `Run workflow`；
3. 等待 `build` 与 `deploy` 两个 job 变绿，站点发布在 `https://<user>.github.io/<repo>/`。

本项目是 project site，`base` 为 `/stanford-cs329z/`（见 `docs/.vitepress/config.mts`）。若要部署到用户主页或自定义域名，把 `base` 改成 `/`，同时把 `siteUrl` 改成实际域名即可；两个值都可以用环境变量 `DOCS_BASE` / `DOCS_URL` 覆盖。

## 课程安排

| 讲 | 日期 | 主题 | 材料 |
|---|---|---|---|
| 1 | Wed Sep 23 | Foundations & Landscape · Introduction — What Are Agentic Systems? | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture01.pdf) |
| 2 | Mon Sep 28 | LLMs for Builders | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture02.pdf) |
| 3 | Wed Sep 30 | Building Blocks · Retrieval-Augmented Generation (RAG) | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture03.pdf) |
| 4 | Mon Oct 5 | Tool Use & Function Calling | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture04.pdf) |
| 5 | Wed Oct 7 | Frameworks & Agent Design · Frameworks & Orchestration | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture05.pdf) |
| 6 | Mon Oct 12 | Agent Design Patterns & Scaffolds | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture06.pdf) |
| 7 | Wed Oct 14 | Memory & Multi-Agent Systems · Agent Memory Architectures | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture07.pdf) |
| 8 | Mon Oct 19 | Multi-Agent Systems | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture08.pdf) |
| 9 | Wed Oct 21 | Optimization | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture09.pdf) |
| 10 | Mon Oct 26 | 客座讲座 · Terminal-Bench | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture10.pdf) |

后续讲次（数据、评测、安全、coding agent、主动 agent）尚未发布 slides，见站内 [课程日程](docs/schedule.md)。

## 项目结构

```
.
├── docs/
│   ├── .vitepress/
│   │   ├── config.mts          # 站点配置（base、nav、搜索、KaTeX）
│   │   ├── course.ts           # 课程模块与讲次数据，驱动侧栏与表格
│   │   └── theme/              # 主题：品牌色、组件、样式
│   ├── notes/                  # 详细讲义
│   ├── essence/                # 5 分钟速读卡
│   ├── public/images/          # 渲染后的 slide WebP
│   ├── index.md                # 首页
│   └── schedule.md             # 课程日程与截止日期
├── slides/                     # 原始 PDF 课件
├── scripts/
│   ├── render_slides.py        # PDF → WebP
│   ├── make_assets.py          # logo / favicon / OG 图片
│   └── check-docs.mjs          # 构建产物检查
└── .github/workflows/deploy.yml
```

## 说明

- 本站是课程公开材料的中文二次整理，不替代原始课件；公式、数字与引用以 slides 为准。
- 课程材料版权归 Stanford University 与各位讲者所有，本站仅用于学习交流。
- 站点主题、讲义与速读卡由 AI 辅助整理，如有错误欢迎提 issue 或在 GitHub 上直接编辑。
