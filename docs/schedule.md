---
title: 课程日程
pageClass: schedule-page
description: Stanford CS329Z Engineering AI Agents（2026 秋）完整课程安排、作业与项目截止日期，以及每讲 slides 与中文讲义入口。
outline: [2, 3]
---

# 课程日程

Stanford CS329Z《Engineering AI Agents》，2026 年秋季。每周一、周三 13:30–14:50，Skilling Auditorium。下表按官方 [课程主页](https://cs329z.stanford.edu/) 的 schedule 整理，并标注中文讲义与 slides 的对应关系。

> 课程仍在进行中；第 1–10 讲已发布 slides，因此已整理为详细讲义。其余讲次发布后会陆续补齐。

## 讲次总览 {#lectures}

| 讲 | 周次 | 日期 | 主题 | 材料 |
|---|---|---|---|---|
| [1](notes/lecture-01-intro-agentic-systems) | 1 | Wed Sep 23 | Foundations & Landscape · Introduction — What Are Agentic Systems? | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture01.pdf) |
| [2](notes/lecture-02-llms-for-builders) | 2 | Mon Sep 28 | LLMs for Builders | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture02.pdf) |
| [3](notes/lecture-03-rag) | 2 | Wed Sep 30 | Building Blocks · Retrieval-Augmented Generation (RAG) | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture03.pdf) |
| [4](notes/lecture-04-tool-use) | 3 | Mon Oct 5 | Tool Use & Function Calling | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture04.pdf) |
| [5](notes/lecture-05-frameworks) | 3 | Wed Oct 7 | Frameworks & Agent Design · Frameworks & Orchestration | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture05.pdf) |
| [6](notes/lecture-06-design-patterns) | 4 | Mon Oct 12 | Agent Design Patterns & Scaffolds | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture06.pdf) |
| [7](notes/lecture-07-memory) | 4 | Wed Oct 14 | Memory & Multi-Agent Systems · Agent Memory Architectures | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture07.pdf) |
| [8](notes/lecture-08-multi-agent) | 5 | Mon Oct 19 | Multi-Agent Systems | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture08.pdf) |
| [9](notes/lecture-09-optimization) | 5 | Wed Oct 21 | Optimization · Optimization | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture09.pdf) |
| [10](notes/lecture-10-terminal-bench) | 6 | Mon Oct 26 | 客座讲座 · Terminal-Bench（Ryan Marten、Alex Shaw） | [Slides](https://web.stanford.edu/class/cs329z/slides/lecture10.pdf) |
| — | 6 | Wed Oct 28 | Data for Agentic Systems · What Data Do Agents Need? | 待发布 |
| — | 7 | Mon Nov 2 | Data Selection & Quality | 待发布 |
| — | 7 | Wed Nov 4 | Evaluation · Evaluation Fundamentals & Benchmark Design | 待发布 |
| — | 8 | Mon Nov 9 | LLM-as-Judge & Evaluation Infrastructure | 待发布 |
| — | 8 | Wed Nov 11 | Safety · Agent Safety & Guardrails | 待发布 |
| — | 9 | Mon Nov 16 | 客座讲座（TBA） | 待发布 |
| — | 9 | Wed Nov 18 | Coding & Software Agents | 待发布 |
| — | 10 | Mon Nov 23 | 停课 · Thanksgiving Recess | — |
| — | 10 | Wed Nov 25 | 停课 · Thanksgiving Recess | — |
| — | 11 | Mon Nov 30 | Proactive Agents | 待发布 |
| — | 11 | Wed Dec 2 | Open Problems & Final Demos · Frontiers & Open Problems | 待发布 |
| — | Finals | Dec 7–11 | Final Project Demo Day | — |

## 截止日期 {#deadlines}

| 周次 | 事项 | 日期 | 时间 |
|---|---|---|---|
| 3 | HW1 发布 | Mon Oct 5 | — |
| 3 | 项目 Proposal 截止 | Fri Oct 9 | 23:59 |
| 6 | HW2 发布 | Mon Oct 26 | — |
| 6 | HW1 截止 | Fri Oct 30 | 23:59 |
| 7 | 中期 Demo 视频截止 | Wed Nov 4 | 23:59 |
| 7 | 中期报告截止 | Fri Nov 6 | 23:59 |
| 8 | Paper Video 截止（10–15 分钟） | Fri Nov 13 | 23:59 |
| 9 | HW2 截止 | Fri Nov 20 | 23:59 |
| 11 | Paper Video 互评（2 份） | Mon Nov 30 | 23:59 |
| Finals | 最终报告与系统 Demo | Dec 7–11 | TBA |

## 课程结构 {#structure}

课程的主线可以概括为「先造出来，再量出来，最后训出来」：

- **基础与全景**（第 1–2 讲）：Agent 的定义、复合 AI 系统、LLM 的架构与训练/推理决策。
- **构建模块**（第 3–4 讲）：RAG 与工具调用——把外部知识和外部动作接进模型。
- **框架与设计**（第 5–7 讲）：DSPy/LangGraph 等框架、工作流与 Agent 设计模式、记忆架构。
- **系统与优化**（第 8–9 讲）：多智能体协调，以及上下文/权重优化。
- **评测、数据与安全**（第 6 周之后）：数据飞轮、基准设计、LLM-as-judge、护栏与 coding agent。
- **项目**：一个季度长的自选系统，要求严谨的评测、基线对比与失败分析。

## 学习资源 {#resources}

- [课程主页](https://cs329z.stanford.edu/) · [Logistics](https://cs329z.stanford.edu/logistics.html) · [Project](https://cs329z.stanford.edu/project.html)
- [HW1: Harness](https://github.com/cs329z/assignment1-harness) · [第 5 讲代码](https://github.com/cs329z/lecture5-frameworks)
- 课程讨论区：[Ed Discussion](https://edstem.org/us/courses/106723/discussion)
- 本讲义：[详细讲义](notes/) · [精华版](essence/)
