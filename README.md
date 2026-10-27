# 斯坦福 CS329Z · Engineering AI Agents（2026 秋）中文讲义

来源：[cs329z.stanford.edu](https://cs329z.stanford.edu/) · Slides 已下载至 `slides/`

在线阅读：<https://xbsheng.github.io/stanford-cs329z/>

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
