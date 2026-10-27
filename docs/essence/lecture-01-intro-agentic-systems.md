---
title: "1 · 导论：什么是 Agentic 系统？"
description: "5 分钟掌握第 1 讲：agent 的五个部件、推理与行动的三种组合、工作流与 agent 的分界，以及五类工程挑战。"
pageClass: essence-page
outline: [2, 3]
---

# 1 · 导论：什么是 Agentic 系统？

<div class="essence-deck">
<p class="essence-deck__thesis">Agent 不是「更聪明的模型」，而是模型、推理、记忆、工具与环境组成的系统。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>4 个概念</span><span>对应详细讲义 <a href="../notes/lecture-01-intro-agentic-systems">全文</a></span></p>
</div>

## 先记住

- **定义四十年没变**：通过传感器感知环境、通过执行器作用于环境。今天传感器是文件、网页、截图，执行器是 shell、编辑器与鼠标键盘。
- **五个部件**：LLM core 做决策，planning & reasoning 更新内部状态，memory 保存经验，tools 扩展动作空间，environment 提供观测与反馈。
- **三层结构**：system（架构）、data（演示与轨迹）、evals（任务与打分器）。多数项目只做第一层，所以讲不清为什么失败。

## 核心机制

一次决策的输入只有四块：**instructions**（系统提示）、**task**（用户请求）、**tools**（schema）、**history**（此前的动作与观测）。模型输出推理与动作，环境执行后返回观测：

$$
\tau_t = (o_1, a_1, \dots, o_t), \qquad a_t \sim \pi_\theta(\cdot \mid \tau_t), \qquad \tau_{t+1} = \tau_t \oplus (o_{t+1})
$$

推理之所以有用，是因为它把「观测 → 动作」这个很难的映射拆成若干可执行的中间步骤；ReAct 把「思考」也当作动作，于是推理与行动共享同一个接口。

<div class="flow">
  <div class="flow__step"><strong>Observe</strong><small>工具返回、文件、网页</small></div>
  <div class="flow__step"><strong>Think</strong><small>推理是内部动作</small></div>
  <div class="flow__step"><strong>Act</strong><small>选择工具、填参数</small></div>
  <div class="flow__step"><strong>Execute</strong><small>harness 校验并执行</small></div>
  <div class="flow__step"><strong>Update</strong><small>观测写回历史</small></div>
</div>

## 最容易错的地方

- **把 agent 等同于模型。** 同一模型换工具集、上下文策略与评测，表现能差一个量级。
- **默认就上 agent。** 步骤可以预先枚举时，workflow 更便宜、更可预测；agent 应留给「步骤依输入而变」的任务。
- **只看任务成功率。** 一致性、稳健性与安全合规是另外三个指标，HarnessAudit 的对比显示它们可以差很远。

## 30 秒自测

**1. 为什么说「推理是 agent 的内部动作」？**

<details>
<summary>答案</summary>

因为它不改变环境，只更新 agent 自己的状态（上下文）。把思考建模成动作，能让它与工具调用共享同一套接口、训练目标与轨迹格式，这也是 ReAct 的设计选择。

</details>

**2. workflow 与 agent 的分界线在哪里？**

<details>
<summary>答案</summary>

谁决定下一步：代码固定步骤是 workflow，模型决定步骤是 agent。两者都是 compound AI system，选择依据是任务步骤能否预先枚举、失败代价与可验证性。

</details>
