---
title: "6 · 设计模式与 Scaffold"
description: "5 分钟掌握第 6 讲：五种 workflow 模式、ReAct 与 Reflexion 等推理行动设计、五种上下文管理模式，以及 Pi 的极简取舍。"
pageClass: essence-page
outline: [2, 3]
---

# 6 · 设计模式与 Scaffold

<div class="essence-deck">
<p class="essence-deck__thesis">模式是半成品：它给的是结构性选择与适用条件，能不能用取决于你的控制流、失败代价与上下文预算。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>4 个概念</span><span>对应详细讲义 <a href="../notes/lecture-06-design-patterns">全文</a></span></p>
</div>

## 先记住

- **模式不是模板。** Fowler 的说法是「half-baked」：名字只负责把讨论缩短，补完与适配仍然是你的事。
- **第一个决定是控制流。** 步骤能预先枚举就写进代码（workflow），随观测变化才交给模型（agent）；真实系统多为混合。
- **上下文只有两条原则。** 保持聚焦、保持连续；event log、offload、compaction、masking、isolation 都是这两条原则的折中。

## 核心机制

一个 agent 架构可以拆成三个决定：控制流在谁手里、动作以什么形式发出、每次调用给模型看什么。三者的组合决定了系统的可预测性、成本与可调试性，模式名只是这些组合的简称。

| 轴 | 要回答的问题 | 常见模式 | 主要代价 |
|---|---|---|---|
| 控制流 | 步骤能否在写代码时枚举 | prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer | 拓扑写死就不适应变化 |
| 行动 | 动作是什么形状、何时执行 | ReAct、CodeAct、ReWOO、LLMCompiler | 轨迹更长，或计划与现实脱节 |
| 上下文 | 每次调用给模型看什么 | event log、memory offloading、compaction、observation masking、context isolation | 保真、成本、可逆三者不可兼得 |

上下文这一轴的常见流水线是：

<div class="flow">
  <div class="flow__step"><strong>Event log</strong><small>原样保留，只追加</small></div>
  <div class="flow__step"><strong>Select</strong><small>选出本次要用的</small></div>
  <div class="flow__step"><strong>Compress</strong><small>摘要或截断旧观测</small></div>
  <div class="flow__step"><strong>Isolate</strong><small>子任务放进独立窗口</small></div>
</div>

## 最容易错的地方

- **把模式名当答案。** 看到 orchestrator-workers 就搭调度器，却没检查子任务是否真的无法预判；模式给的是「这里有个选择」，不是「这样选是对的」。
- **让模型自评当成反馈。** 让 LLM 评估自己的回答会掉点；Reflexion 能成立，靠的是外部环境反馈，而不是反思这个动作本身。
- **先用不可逆的压缩。** compaction 与 masking 把信息换成空间，换不回来；event log 与 isolation 可以反悔，应该先用可逆手段。

## 30 秒自测

**1. workflow 与 agent 的分界线在哪里？**

<details>
<summary>答案</summary>

谁决定下一步：代码固定分支是 workflow，模型依观测选择是 agent。选择依据是步骤能否预先枚举、失败代价有多高——不是哪个更先进。

</details>

**2. 为什么 Reflexion 的反思有效，而「让模型评价自己」往往无效？**

<details>
<summary>答案</summary>

反馈来源不同。Reflexion 的评价来自任务环境（是否通过、测试是否报错），反思只是把外部信号压缩成可复用经验；模型自评没有新信息，还会被自己的错误前提带着走。

</details>
