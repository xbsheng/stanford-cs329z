---
title: "5 · 框架与编排：抽象换来了什么"
description: "5 分钟掌握第 5 讲：三根支柱、DSPy 的签名与优化器、LangGraph 的状态图、harness 的设计取舍，以及持久化执行与可观测性。"
pageClass: essence-page
outline: [2, 3]
---

# 5 · 框架与编排：抽象换来了什么

<div class="essence-deck">
<p class="essence-deck__thesis">框架不会让你的模型变强，它只改变你写代码的姿势——以及出错时你还能看见什么。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>4 个概念</span><span>对应详细讲义 <a href="../notes/lecture-05-frameworks">全文</a></span></p>
</div>

## 先记住

- **三根支柱，框架只碰一根。** Data、System/Model、Evaluation + Metric 同时在场才叫工程；DSPy、LangGraph、harness 都在 System 这一根上，另外两根要你自己补。
- **抽象是拿「看不见」换「写得快」。** PyTorch 替你算梯度，DSPy 替你写指令，LangGraph 替你管状态；代价是出错时你得主动下探一层。
- **harness 的差异可以和模型差异同量级。** 同一个 Claude Haiku 4.5，在 Terminal-Bench 2 上换 harness，成功率从 31.1% 到 47.8%。

## 核心机制

框架都做同一件事：**把「模型调用」从散落的字符串，变成有契约、可替换、可记录的程序单元**。DSPy 把它写成签名与模块，LangGraph 把它写成状态与节点，harness 把它写成工具循环，Temporal 把它写成可重放的 activity。一旦调用有了契约，优化与运维才谈得上：

$$
\pi^* = \arg\max_{\pi \in \text{programs}} \; \mathbb{E}_{(x,y)\sim D}\big[\text{metric}(\pi(x), y)\big]
$$

DSPy 的优化器不改权重，只重写 `signature.instructions`；这一讲的 GEPA 用 50 条标注、约 100 次 metric 调用，把 12B 小模型从 55.0% 拉到 100.0%（20 条测试样本）。LangGraph 则相反：它不优化，它把控制流摊开成图，条件边就是一个返回节点名的 Python 函数。

<div class="flow">
  <div class="flow__step"><strong>Signature</strong><small>输入输出契约</small></div>
  <div class="flow__step"><strong>Module</strong><small>契约怎么被满足</small></div>
  <div class="flow__step"><strong>Optimizer</strong><small>数据 + metric 改指令</small></div>
  <div class="flow__step"><strong>Graph</strong><small>state / node / edge</small></div>
  <div class="flow__step"><strong>Durable run</strong><small>history 重放 + trace</small></div>
</div>

## 最容易错的地方

- **把框架当能力。** 换框架只是换写法；课件里的 31.1% / 47.8% 是特定 benchmark、特定模型下的对比，不是「某框架更好」的通行证。
- **以为用了 DSPy 就必须让模型决定一切。** `forward` 里照样可以写普通 Python 判断（比如「这封邮件没有事件就提前返回」），模型只负责有契约的那几步。
- **在 workflow 里直接调 LLM。** Temporal 会重放 workflow 代码，模型调用必须包成 activity，否则恢复时重复调用、history 与实际状态对不上。

## 30 秒自测

**1. DSPy 的优化器改了什么，为什么必须先写好 metric？**

<details>
<summary>答案</summary>

只改签名的 `instructions` 文本（格式、取值规则、缺失字段怎么处理），权重与代码都不动。签名固定搜索空间，metric 是目标函数——metric 没覆盖的字段，优化器不会去优化。

</details>

**2. LangGraph 的条件边由谁决定分支？这算不算 agent？**

<details>
<summary>答案</summary>

由代码决定：条件边是返回目标节点名的普通函数（`"pick_emoji"` 或 `END`）。这是把不确定性关进节点内部的 workflow；要 agent 行为就用 `create_agent`，它等价于 LLM 节点 + 工具节点 + 条件边的标准回路。

</details>
