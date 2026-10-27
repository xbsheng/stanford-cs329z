---
title: "7 · Agent 记忆：跨会话的连续性"
description: "5 分钟掌握第 7 讲：四种记忆类型、四类架构模式（流程复用、分层记忆、反思式合并、记忆维护）、存储选型与评测基准，以及遗忘与隐私的取舍。"
pageClass: essence-page
outline: [2, 3]
---

# 7 · Agent 记忆：跨会话的连续性

<div class="essence-deck">
<p class="essence-deck__thesis">记忆不是「存得更多」，而是知道什么该写、什么该改、什么该忘；先坏掉的通常是约束，不是偏好。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>5 个概念</span><span>对应详细讲义 <a href="../notes/lecture-07-memory">全文</a></span></p>
</div>

## 先记住

- **两起开场事故都不是「忘了偏好」。** 一个是手册规则没和这一次迟到对上，一个是「先别动手」的约束没进任何持久结构。
- **四类记忆按写入成本分层**：working（上下文窗口）→ episodic（原始日志，append-only）→ semantic（抽取事实，要冲突检测）→ procedural（写成代码，要验证）。
- **四类架构是四个问题，不是四个选项**：学流程（Voyager、AWM）、分层（MemGPT、MemoryOS）、反思（Reflexion、Generative Agents）、维护（sleep-time、A-Mem、Mem0）。

## 核心机制

记忆系统的全部设计可以压缩成 Slide 24 的三问：**What**（存事实、流程还是对话进展）、**When**（按需、后台还是事件驱动）、**How**（文件系统、数据库还是知识图谱）。三者的耦合方式决定形态——「按需 + 文件系统」得到一个模型自己 grep 的目录，「后台 + 向量库」得到一条用户看不见的抽取管线。

写入越贵，读的时候越省心：episodic 几乎零成本但检索时全是噪声，procedural 要生成与验证，但读进来就能直接执行。所有架构都在这个轴上选位置。

<div class="flow">
  <div class="flow__step"><strong>Write</strong><small>追加还是改写：冲突要不要就地替换</small></div>
  <div class="flow__step"><strong>Organize</strong><small>目录、向量、实体关系，或笔记之间的链</small></div>
  <div class="flow__step"><strong>Retrieve</strong><small>相似、关键词、时间衰减、重要性加权</small></div>
  <div class="flow__step"><strong>Maintain</strong><small>离线整理、冲突检测、ADD/UPDATE/DELETE/NOOP</small></div>
</div>

四类模式各自的代价，比它们的能力更值得先记：

| 模式 | 代表工作 | 主要代价 |
|---|---|---|
| 学流程 | Voyager、AWM、skill files | 环境接口一变就静默失效 |
| 分层 | MemGPT、MemoryOS | 换出策略由模型决定，判断错了读不回来 |
| 反思 | Reflexion、Generative Agents | 判断被固化，错误的归因会扩散 |
| 维护 | sleep-time compute、A-Mem、Mem0 | 后台延迟、误删不可逆、写放大 |

分层与维护这两类尤其容易在上线后出问题，因为它们把成本从「模型能力」转移到「工程参数」：页大小、热度阈值、摘要频率、冲突判定的严格度，都没有通用最优值。调错时的表现不是报错，而是记忆里悄悄少了一条，或者同时留下两个矛盾的版本。

## 最容易错的地方

- **只做 semantic 记忆。** 偏好画像最便宜也最安全，但它救不了「这次不要动」这类带作用域的约束；约束没落盘，上下文一滚就没了。
- **把「记住了」当成「用得上」。** LoCoMo 上召回可以到 82.7，回答 F1 只有 43 上下；MemoryArena 上专门的 memory controller 平均成功率 0.12，低于长上下文 0.16 与 RAG 0.17。
- **默认技能库会一直有效。** procedural memory 对动态环境不鲁棒（Slide 41）：环境接口一变，技能不报错，只是继续给出错误结果。

## 30 秒自测

**1. 为什么说 MemGPT 的 replace 比 write 更难做对？**

<details>
<summary>答案</summary>

write 是追加新事实，错了只是多一条；replace 是就地改写冲突事实（「男朋友叫 James」→「前男友叫 James」），错了会丢掉仍然有效的信息，或者留下过期版本。它要求模型在写入那一刻判断「这是新事实还是对旧事实的修正」，而这个判断本身可能错，且改写不可逆。

</details>

**2. 四类架构模式分别解决什么问题，能只选一个吗？**

<details>
<summary>答案</summary>

学流程解决「重复的子任务不要重新探索」，分层解决「窗口有限而记忆无限」，反思解决「原始日志太浅、噪声太多」，维护解决「存太多会涨成本、会冲突」。四者可以叠加：一个系统完全可以在文件系统上放技能（流程）、用分层做上下文管理、把失败反思写回、再用后台工作流做冲突消解。选一个只在演示里成立。

</details>
