---
title: "3 · RAG：把证据放进上下文"
description: "5 分钟掌握第 3 讲：RAG 的概率形式、切块与上下文化索引、稀疏与稠密检索的互补、重排的成本阶梯，以及 agentic RAG 的三个决策。"
pageClass: essence-page
outline: [2, 3]
---

# 3 · RAG：把证据放进上下文

<div class="essence-deck">
<p class="essence-deck__thesis">RAG 不提升模型能力，它只决定模型能看到什么；上限在索引，代价在延迟。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>5 个概念</span><span>对应详细讲义 <a href="../notes/lecture-03-rag">全文</a></span></p>
</div>

## 先记住

- **一个向量只能代表一件事。** 切块因此不是预处理细节，而是召回的上限；块里缺的上下文，检索时补不回来。
- **稀疏与稠密错在不同地方。** BM25 丢改写，DPR 丢稀有字面量；混合加 RRF 是默认值，不是折中。
- **便宜的在前，贵的在后。** 召回 62 ms，重排按候选数付费，agentic 循环按轮数付费；预算是倒着推出来的。

## 核心机制

一次 RAG 的输出，是 top-K 段落答案的加权和：

$$
p(y\mid x)\approx\sum_{z\in\text{top-}K}p(z\mid x)\,p(y\mid x,z)
$$

top-K 之外概率为 0——召回没进来，生成器再强也无解。所以流水线被切成可独立评测的几段：

<div class="flow">
  <div class="flow__step"><strong>Index</strong><small>切块 · 上下文化 · 向量化</small></div>
  <div class="flow__step"><strong>Retrieve</strong><small>BM25 + 稠密，取 top-100</small></div>
  <div class="flow__step"><strong>Fuse</strong><small>RRF 合并排名</small></div>
  <div class="flow__step"><strong>Rerank</strong><small>cross-encoder 取 top-10</small></div>
  <div class="flow__step"><strong>Generate</strong><small>证据进上下文</small></div>
</div>

## 最容易错的地方

- **换更大的模型去修检索问题。** 先看 top-K 里有没有正确段落（Hit@k）；没有就该改索引与 query，改 reader 是白花钱。
- **把 K 当成「越多越好」。** K 买召回，付延迟与 lost in the middle；块大小与 K 一起决定上下文预算。
- **把检索文本当可信输入。** 检索结果是外部数据，一样能注入指令；权限过滤要放在检索层，不能靠提示词。

## 30 秒自测

**1. 为什么说 RAG 的瓶颈通常不在生成？**

<details>
<summary>答案</summary>

因为生成只能用进入 top-K 的证据，top-K 之外的概率是 0。多数失败出在召回缺口、索引陈旧或证据被淹没，换生成器改变不了这些。

</details>

**2. BM25 与 DPR 分别在哪类查询上失手？**

<details>
<summary>答案</summary>

BM25 漏同义改写与跨语言表述；DPR 对错误码、产品 ID 这类稀有字面量不敏感。两者失败方向不同，所以用 RRF 融合排名而不是分数。

</details>
