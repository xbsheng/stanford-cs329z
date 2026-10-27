---
title: "4 · Tool Use：把语言变成动作"
description: "5 分钟掌握第 4 讲：工具补的三类缺口、schema 作为契约、Toolformer 的自监督标注、REST 到 MCP 的接口演进，以及按粒度分层的评测。"
pageClass: essence-page
outline: [2, 3]
---

# 4 · Tool Use：把语言变成动作

<div class="essence-deck">
<p class="essence-deck__thesis">工具调用不是魔法接口，而是模型在正确位置生成的一段结构化 token；schema、接口与评测共同决定它靠不靠得住。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>5 个概念</span><span>对应详细讲义 <a href="../notes/lecture-04-tool-use">全文</a></span></p>
</div>

## 先记住

- **工具补的是三类缺口**：算不出（算术、精确运算）、没见过（长尾事实、截止后事件、私有数据）、够不到（API、物理世界、实时状态）。不落进这三类的任务，接工具只是增加失败面。
- **模型只负责选与填，harness 负责校验与执行。** 模型输出的是意图的表示，不是动作本身；这条边界一模糊，prompt injection 就有了执行通道。
- **接口每标准化一次，复用多一层，信任边界外移一层。** REST 给人看，function calling 给模型看，MCP 给生态用；代价是鉴权从一段变成两段。

## 核心机制

工具调用的输入是上下文里的工具清单，输出是一个名字加一组参数。清单里的每一项只有三样东西：**name、description、JSON schema**。这三样就是 prompt——描述决定模型在两个相似工具间怎么选，参数类型与枚举决定它填得对不对。

<div class="flow">
  <div class="flow__step"><strong>Schema</strong><small>名字、描述、参数</small></div>
  <div class="flow__step"><strong>Select</strong><small>选工具或拒绝</small></div>
  <div class="flow__step"><strong>Arguments</strong><small>按 schema 填</small></div>
  <div class="flow__step"><strong>Validate</strong><small>harness 校验</small></div>
  <div class="flow__step"><strong>Execute</strong><small>结果与错误写回</small></div>
</div>

Toolformer 把「何时调」变成可标注的问题：在位置 $i$ 采样调用，执行后只保留让后续 token 损失下降超过阈值 $\tau_f$ 的那些。它衡量的是「对下文有没有帮助」，不是「这次调用对不对」——所以错误的检索只要让文本更通顺，也会被保留。

## 最容易错的地方

- **把 schema 当文档写。** 模型看不到你的内部约定，只看到名字、描述和参数。省掉的单位、枚举、必填项，都会以参数错误的形式回来。
- **用单次调用的分数推断多轮可靠性。** BFCL 的 AST 匹配、τ-bench 的 pass^k 测的不是同一种能力；pass@1 高而 pass^5 低的系统，演示好看、重试就崩。
- **以为工具越多越好。** 每多一个工具就多一份选择成本，误选率随之上升；能判断「这次不该调」比多接十个 API 更有价值。

## 30 秒自测

**1. 为什么说「工具调用是一次结构化生成」？**

<details>
<summary>答案</summary>

因为模型做的仍然是下一个 token 的预测，只是输出被约束成 name + arguments 的结构。真正改变世界的是 harness 的校验与执行。理解这一点，才会把调试重点放在 schema、描述与错误信息上，而不是指望换一个更大的模型。

</details>

**2. pass@k 与 pass^k 差在哪里，为什么生产环境更该看后者？**

<details>
<summary>答案</summary>

pass@k 是 k 次里至少成功一次的概率，衡量能力上限；pass^k 是 k 次全部成功的概率，衡量一致性。生产系统会被重试、会被并发调用，单次能过不代表重跑能过，所以要看「每次都成」的概率。

</details>
