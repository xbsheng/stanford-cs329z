export interface Lecture {
  code: string
  slug: string
  sidebar: string
  topic: string
  title: string
  oneLiner: string
  slides: boolean
  minutes: number
}

export interface CourseModule {
  id: string
  title: string
  lectures: Lecture[]
}

export const courseModules: CourseModule[] = [
  {
    id: 'foundations',
    title: '基础与全景',
    lectures: [
      {
        code: '1',
        slug: 'lecture-01-intro-agentic-systems',
        sidebar: '1 · 什么是 Agentic 系统',
        topic: 'Introduction: What Are Agentic Systems?',
        title: '导论：什么是 Agentic 系统？',
        oneLiner: 'Agent 是模型、循环、工具与环境组成的系统；复合系统与自主 agent 是一条连续谱。',
        slides: true,
        minutes: 5
      },
      {
        code: '2',
        slug: 'lecture-02-llms-for-builders',
        sidebar: '2 · 给构建者的 LLM',
        topic: 'LLMs for Builders',
        title: '给构建者的 LLM',
        oneLiner: '解码、注意力、后训练与推理共同决定了 agent 能做什么、贵在哪里、错在哪里。',
        slides: true,
        minutes: 5
      }
    ]
  },
  {
    id: 'building',
    title: '构建模块',
    lectures: [
      {
        code: '3',
        slug: 'lecture-03-rag',
        sidebar: '3 · RAG',
        topic: 'Retrieval-Augmented Generation (RAG)',
        title: 'RAG：把证据放进上下文',
        oneLiner: 'RAG 是一条索引、检索、重排、生成的流水线；召回上限与阅读方式是两条独立的短板。',
        slides: true,
        minutes: 5
      },
      {
        code: '4',
        slug: 'lecture-04-tool-use',
        sidebar: '4 · Tool Use',
        topic: 'Tool Use & Function Calling',
        title: 'Tool Use：把语言变成动作',
        oneLiner: '工具调用是训练出来的 token 序列；schema、接口与评测共同决定它靠不靠得住。',
        slides: true,
        minutes: 5
      }
    ]
  },
  {
    id: 'frameworks',
    title: '框架与设计',
    lectures: [
      {
        code: '5',
        slug: 'lecture-05-frameworks',
        sidebar: '5 · 框架与编排',
        topic: 'Frameworks & Orchestration',
        title: '框架与编排：抽象换来了什么',
        oneLiner: '框架把循环、状态与优化写成抽象；代价是隐藏了出错时最需要看的那一层。',
        slides: true,
        minutes: 5
      },
      {
        code: '6',
        slug: 'lecture-06-design-patterns',
        sidebar: '6 · 设计模式与 Scaffold',
        topic: 'Agent Design Patterns & Scaffolds',
        title: '设计模式与 Scaffold',
        oneLiner: '工作流把决策写进代码，agent 把决策交给模型；模式是这两者之间的可复用折中。',
        slides: true,
        minutes: 5
      },
      {
        code: '7',
        slug: 'lecture-07-memory',
        sidebar: '7 · 记忆架构',
        topic: 'Agent Memory Architectures',
        title: 'Agent 记忆：跨会话的连续性',
        oneLiner: '记忆是写入、组织、检索、维护四件事；难的不是存下来，而是知道什么时候该忘。',
        slides: true,
        minutes: 5
      }
    ]
  },
  {
    id: 'systems',
    title: '系统与优化',
    lectures: [
      {
        code: '8',
        slug: 'lecture-08-multi-agent',
        sidebar: '8 · 多智能体',
        topic: 'Multi-Agent Systems',
        title: '多智能体：协调的成本',
        oneLiner: '多 agent 的收益来自并行与隔离，代价是通信、一致性与难以归因的失败。',
        slides: true,
        minutes: 5
      },
      {
        code: '9',
        slug: 'lecture-09-optimization',
        sidebar: '9 · 优化',
        topic: 'Optimization',
        title: '优化：用数据换行为',
        oneLiner: '优化把意图写进数据与评测；上下文优化便宜可逆，权重优化昂贵但更彻底。',
        slides: true,
        minutes: 5
      }
    ]
  },
  {
    id: 'guests',
    title: '客座讲座',
    lectures: [
      {
        code: '10',
        slug: 'lecture-10-terminal-bench',
        sidebar: '10 · Terminal-Bench',
        topic: 'Guest Lecture: Terminal-Bench',
        title: 'Terminal-Bench：在终端里考 agent',
        oneLiner: '基准的可信度来自任务、环境与验证器；容器化的真实终端任务把评测拉回地面。',
        slides: true,
        minutes: 5
      }
    ]
  }
]

export const allLectures = courseModules.flatMap((module) => module.lectures)

export const notesSidebar = courseModules.map((module) => ({
  text: module.title,
  items: module.lectures.map((lecture) => ({
    text: lecture.sidebar,
    link: `/notes/${lecture.slug}`
  }))
}))

export const essenceSidebar = [
  {
    text: '开始',
    items: [{ text: '总览 · 50 分钟路线', link: '/essence/' }]
  },
  ...courseModules.map((module) => ({
    text: module.title,
    items: module.lectures.map((lecture) => ({
      text: lecture.sidebar,
      link: `/essence/${lecture.slug}`
    }))
  }))
]
