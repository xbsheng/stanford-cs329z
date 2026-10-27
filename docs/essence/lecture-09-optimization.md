---
title: "9 · 优化：用数据换行为"
description: "5 分钟掌握第 9 讲：优化的三个前提、上下文优化的四条路线、权重优化的三种目标，以及 GRPO 为什么省掉 value model。"
pageClass: essence-page
outline: [2, 3]
---

# 9 · 优化：用数据换行为

<div class="essence-deck">
<p class="essence-deck__thesis">优化不是把提示词写得更好，而是把示例与分数编译进上下文或权重。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>5 个概念</span><span>对应详细讲义 <a href="../notes/lecture-09-optimization">全文</a></span></p>
</div>

## 先记住

- **前提是三件套**：数据、系统、评测。缺评测，你无法判断改动是否真的变好——那不是优化，是调参。
- **两条路**：上下文优化改「模型看到什么」，便宜、快、可逆，但吃上下文；权重优化改「模型倾向做什么」，贵、慢，但推理时零成本。
- **样本效率不对称**：prompt 优化几千次 rollout 就到顶，权重优化起步慢，却能随上万条样本继续涨。

## 核心机制

上下文优化把「搜索」交给模型：自举成功轨迹当示例（DSPy）、读历史分数写新指令（OPRO / MIPROv2）、把自然语言反馈当梯度（TextGrad）、在 Pareto 前沿上做遗传（GEPA）。权重优化把「信号」压进参数：SFT 模仿 teacher 的轨迹，RL 用可验证奖励，on-policy distillation 在 student 自己采的轨迹上逐 token 对齐 teacher。

GRPO 的关键减法是不训练 value model，改用同一 prompt 的一组输出做组内标准化：

$$
\hat{A}_{i,t} = \frac{R_i - \operatorname{mean}(\{R_1, \dots, R_G\})}{\operatorname{std}(\{R_1, \dots, R_G\})}
$$

| | 上下文优化 | 权重优化 |
|---|---|---|
| 改动对象 | prompt 里的指令与示例 | 模型参数 |
| 需要的条件 | 打分器、可调的模型接口 | 权重、训练设施、数千条样本 |
| 主要代价 | 上下文变长、推理变贵 | 训练周期、基础设施 |
| 失效场景 | 指令遵循本来就差的小模型 | 只能调 API、需要快速迭代 |

## 最容易错的地方

- **把优化当成涨点。** 它同时是降价手段：更短的 prompt、更小的模型、更少的工具调用，都是优化的合法目标。
- **以为组内奖励总能给出梯度。** 一组输出全对或全错时标准差为零、优势为零，这一组白跑；题目难度必须落在「有时对、有时错」的区间。
- **让 agent 优化却不锁评测。** agent 是相当强的优化器，它会去找指标的漏洞而不是去解决问题——能被优化的指标，一定会被优化到失真。

## 30 秒自测

**1. 为什么 prompt 优化在长跑里往往打不过权重优化？**

<details>
<summary>答案</summary>

prompt 优化把成本转移到推理：每多一段指令、一组示例，每次调用都要付一遍 token 费，长上下文还会稀释注意力；它的收益曲线在几千次 rollout 内就饱和。权重优化把这些知识压进参数，推理时零成本，且能随上万条样本继续涨。反过来，只能调 API、需要快速迭代时，上下文优化是唯一选择。

</details>

**2. GRPO 要维护哪三个模型？**

<details>
<summary>答案</summary>

policy（训练）、reference（冻结，算 token 级 KL）、reward（冻结，给每条输出打分；也可以是一条规则而不是模型）。相比 PPO 少了 value model：优势不再逐 token 估计，而是用同组输出的 z-score 广播到该输出的所有 token。

</details>
