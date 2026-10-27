---
title: "8 · 多智能体：协调的成本"
description: "5 分钟掌握第 8 讲：多 agent 的四个收益与五类代价、四种编排拓扑的成本顺序、通信与协调的区别，以及为什么协调本身会让多 agent 输给单 agent。"
pageClass: essence-page
outline: [2, 3]
---

# 8 · 多智能体：协调的成本

<div class="essence-deck">
<p class="essence-deck__thesis">多 agent 不是更强的模型，而是更贵的组织：收益来自把工作分开，代价也来自把工作分开。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>4 个概念</span><span>对应详细讲义 <a href="../notes/lecture-08-multi-agent">全文</a></span></p>
</div>

## 先记住

- **默认答案是单 agent。** 先做强单 agent baseline，为某个具体目的加 agent，再测量它的边际收益是否大于协调成本（Slide 14 的建议）。
- **收益与代价同源。** 并行、专精、聚焦上下文、更广探索，对应的是协调开销、信息丢失、动作冲突、错误传播——拆得越彻底，两边同时放大。
- **失败多是组织问题。** 系统设计 44.2%、agent 间错位 32.3%、任务验证 23.5%；协商失败时，agent 甚至会「用强」收场。

## 核心机制

MAS 是「多个 agent 指向同一个 shared task」。设计空间只有三根轴：**orchestration**（谁调度谁）、**communication**（谁收到什么、走哪个通道）、**coordination**（谁拥有哪个任务、什么必须先做）。成本顺序在课件里只有一条：single agent < orchestrated < swarms——通信开销从 0 涨到 `d·n`、`r·n`；而性能并不跟着涨：同一个底座模型，MAS 在 GPT-5 上高出 12.3%，在 Sonnet 4.5 上低 7.2%。所以决策顺序只能从测量开始：

<div class="flow">
  <div class="flow__step"><strong>Baseline</strong><small>单 agent 是否已达标</small></div>
  <div class="flow__step"><strong>Bottleneck</strong><small>并行、专精还是复核</small></div>
  <div class="flow__step"><strong>Topology</strong><small>independent / orchestrator / swarm / hybrid</small></div>
  <div class="flow__step"><strong>Coordination</strong><small>ledger、memory、worktree</small></div>
  <div class="flow__step"><strong>Measure</strong><small>收益是否超过成本</small></div>
</div>

| 拓扑 | 谁决定下一步 | 主要代价 |
|---|---|---|
| Independent | 无（末尾聚合） | 无法利用彼此的中间发现 |
| Centralized | orchestrator | 它成为瓶颈，且不掌握细节 |
| Decentralized | 无（全连 + 共享板） | 全连通信、没有停止条件 |
| Hybrid | orchestrator + 同级 | 责任与信息共享规则必须写清 |

通信与协调要分开看：handoff 转移控制权、上下文跟着走；agent-as-tool 保留调用方控制、只发选定上下文。协调基础设施则各管一件事——task ledger 让进度可读，shared memory 让经验跨会话复用，worktree 隔离把冲突从「执行时」推到「合并时」。

## 最容易错的地方

- **把「加一个群聊频道」当成「解决了协调」。** 通道只让信息流动，不决定谁拥有任务、谁先做、冲突怎么收场。
- **用「多 agent 提升 X%」当结论。** 不交代基线、拓扑与模型，这个数字没有意义：换一个骨架，符号就会翻。
- **让多个 agent 共享同一个工作目录。** 并行不会减少总工作量，只会把覆盖与冲突藏进 trace 里；要么隔离工作区，要么划分资源。

## 30 秒自测

**1. 什么信号出现时，才值得把单 agent 换成多 agent？**

<details>
<summary>答案</summary>

出现一个**被测量过**的瓶颈，且该瓶颈能由可分离的子任务、可按职责切分的上下文、或独立可集成的贡献解决。反过来，步骤高度依赖、状态高度重叠、单 agent 已达标时，拆开是负收益——CooperBench 上单 agent 同时做两个任务就优于两个 agent 协作。

</details>

**2. handoff 与 agent-as-tool 该选哪个？**

<details>
<summary>答案</summary>

看谁对最终结果负责。专家需要直接面对用户并拥有下一步，用 handoff（控制权与上下文一起转移）；需要由一个 agent 汇总多方贡献并统一交付，用 agent-as-tool（保留控制权，只发有边界的请求）。

</details>
