---
title: 精华版 · 50 分钟串起 AI Agent 工程
description: Stanford CS329Z 精华版：10 讲压缩成 10 张速读卡，用 50 分钟建立 Agent 工程的核心知识骨架。
pageClass: essence-page essence-home
outline: [2, 3]
---

# 用 50 分钟，搭起 AI Agent 工程的骨架

<p class="brief-lead">10 讲详细讲义，压缩成 10 张速读卡。每讲保留一个核心判断、一条机制链、两三个易错点；先建立骨架，再按需回到详细讲义填细节。</p>

<div class="brief-actions">
  <a class="brief-btn" href="./lecture-01-intro-agentic-systems">从第 1 讲开始</a>
  <a class="brief-btn brief-btn--ghost" href="#lectures">先看 10 讲目录</a>
</div>

## 三条学习路径 {#paths}

| 路径 | 时间 | 读什么 |
|---|---|---|
| 面试速通 | 12 分钟 | 只读下面的六个判断与每讲的一句话，先建立索引。 |
| 主线通读 | 50 分钟 | 按模块顺序读完 10 张速读卡，每张 4–6 分钟。 |
| 深入补齐 | 3 小时 | 速读卡 → 对应详细讲义 → 自测题，重点补推导、实验数字与论文出处。 |

## 一张图：Agent 是系统 {#system}

<div class="stack-map">
  <div class="stack-map__row">
    <span class="stack-map__label">模型与推理</span>
    <div class="stack-map__body"><strong>这一次能生成什么</strong><p>解码策略、注意力结构、后训练配方与推理预算，共同决定了 Agent 的能力上限与单步成本。</p><em>decoding · attention · post-training · test-time scaling</em></div>
  </div>
  <div class="stack-map__row">
    <span class="stack-map__label">上下文</span>
    <div class="stack-map__body"><strong>模型这一次能看见什么</strong><p>系统提示、任务、工具描述、检索证据与历史观测。长了要压，压了可能忘。</p><em>context engineering · KV cache · compaction · RAG</em></div>
  </div>
  <div class="stack-map__row">
    <span class="stack-map__label">工具与接口</span>
    <div class="stack-map__body"><strong>把 token 变成真实动作</strong><p>名字、描述与 JSON Schema 进入 prompt；harness 解析、校验、执行、回填，并处理错误与权限。</p><em>function calling · MCP · REST · τ-bench</em></div>
  </div>
  <div class="stack-map__row">
    <span class="stack-map__label">编排与记忆</span>
    <div class="stack-map__body"><strong>谁来决策，经验放在哪里</strong><p>工作流把控制流写进代码，Agent 把决策交给模型；记忆让跨会话的连续性成为可能。</p><em>DSPy · LangGraph · MemGPT · skill library</em></div>
  </div>
  <div class="stack-map__row">
    <span class="stack-map__label">数据与评测</span>
    <div class="stack-map__body"><strong>怎么知道它行，怎么让它更行</strong><p>任务、环境、停止条件与打分器；trace、验证器、judge 与 rubric；优化则把评测信号写回上下文或权重。</p><em>benchmark · verifier · LLM-as-judge · SFT/RL</em></div>
  </div>
</div>

## 六个判断 {#claims}

<div class="claims">
  <div class="claim"><strong>Agent 是复合系统，不是单个模型。</strong><p>同一模型换提示、检索、工具、沙箱与评测，表现能差一个量级；长程失败几乎总是多层同时失效。</p></div>
  <div class="claim"><strong>上下文是工程对象，成本由循环决定。</strong><p>每轮都要重新处理历史，累计输入随轮数增长。把什么放进去、留多久、怎么压，是 Agent 工程的主战场。</p></div>
  <div class="claim"><strong>检索决定上限，阅读决定下限。</strong><p>召回不到的 evidence，模型再强也答不出；塞进上下文却读不懂，等于没检索。索引、检索、重排、生成四段各有短板。</p></div>
  <div class="claim"><strong>工具调用是 token，接口是契约。</strong><p>模型生成“工具名 + 参数”的 token 序列，harness 负责执行。schema、描述与错误返回的设计，直接决定调用成功率。</p></div>
  <div class="claim"><strong>框架给抽象，也把故障藏起来。</strong><p>DSPy 优化的是声明式模块，LangGraph 编排的是状态图；抽象层越厚，出错时越需要能下探到循环、状态与日志。</p></div>
  <div class="claim"><strong>评测是系统设计，不是跑分。</strong><p>任务、环境、停止条件与打分器四件事写清楚，分数才有意义；容器化终端任务与可执行验证器，是可信度的来源。</p></div>
</div>

## 10 讲速读 {#lectures}

<CourseCards module="foundations" />

<CourseCards module="building" />

<CourseCards module="frameworks" />

<CourseCards module="systems" />

<CourseCards module="guests" />

## 一张对照表 {#contrast}

| 容易混淆 | 关键区别 |
|---|---|
| 复合 AI 系统 / Agent | 前者把控制流写进代码，后者把下一步交给模型；可靠性与自主性是这条轴的两端。 |
| 预训练 / 后训练 / 推理时计算 | 能力底座、行为塑形、单次多想；三者花钱的位置不同，能换来的东西也不同。 |
| 检索 / 长上下文 | 检索解决“装不下”，长上下文解决“找不到”；两者都在和注意力与成本博弈。 |
| 工作流 / 多 Agent | 前者用代码固定流程，后者用通信换取并行与隔离；协调成本随 agent 数量非线性上升。 |
| 上下文优化 / 权重优化 | 前者改提示与示例，便宜、可回滚；后者改参数，昂贵、但更彻底。 |
| 结果评测 / 过程评测 | 前者看终态对不对，后者看有没有违规、绕路或不可逆操作。 |

## 怎么继续 {#next}

- 每张速读卡末尾有两道自测；先答，再展开对照。
- 需要推导、实验数字和论文出处，点每页顶部的「详细讲义」。
- 顶部导航随时在「详细讲义」与「精华版」之间切换；读某一讲时，两边的页面一一对应。
