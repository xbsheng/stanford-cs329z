---
title: "2 · 给构建者的 LLM"
description: "5 分钟掌握第 2 讲：概率分解与采样、注意力的二次代价、三段式训练管线、prefill/decode 的不对称，以及约束解码与上下文工程如何决定 agent 的上限。"
pageClass: essence-page
outline: [2, 3]
---

# 2 · 给构建者的 LLM

<div class="essence-deck">
<p class="essence-deck__thesis">LLM 是对 token 序列定义概率的函数；agent 的所有局限，几乎都能从这个定义与它的实现代价里推出来。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>5 个概念</span><span>对应详细讲义 <a href="../notes/lecture-02-llms-for-builders">全文</a></span></p>
</div>

## 先记住

- **概率函数，不是知识库。** 模型只回答「下一个 token 的分布是什么」；推理、记忆、服从都是采样出来的副产品，不是独立模块。
- **架构用并行度换成本。** 自注意力让整个序列一次算完（O(1) 串行操作），代价是每层 O(n²) 与随长度线性增长的 KV cache。
- **行为由后训练决定。** 拒绝、啰嗦、输出格式、工具调用习惯，来自 SFT/RLHF/RLVR 把分布搬到了哪里，而不是来自 Transformer。

## 核心机制

一次生成可以拆成四步：模型对词表输出分布，解码策略从中挑一个 token，把它接回序列，重复到停止。训练就是把这条链上的每一步都往真实语料上推：

$$
P(x_{1:T})=\prod_{t=1}^{T}P(x_t\mid x_{<t}),\qquad \mathcal{L}=-\sum_{i=1}^{V}y_i\log p_i
$$

工程上真正决定成本的是两段不对称的负载：**prefill** 并行处理整段 prompt、算力受限；**decode** 每步只加一个 token、带宽受限。所以长 prompt 贵在前者，长思考贵在后者，而前缀一变、KV cache 全废。

<div class="flow">
  <div class="flow__step"><strong>Context</strong><small>system、history、tools、检索</small></div>
  <div class="flow__step"><strong>Prefill</strong><small>并行算 KV，算力受限</small></div>
  <div class="flow__step"><strong>Decode</strong><small>逐 token，带宽受限</small></div>
  <div class="flow__step"><strong>Parse</strong><small>约束解码、schema 校验</small></div>
  <div class="flow__step"><strong>Append</strong><small>只在末尾追加，保住缓存</small></div>
</div>

## 最容易错的地方

- **以为 temperature 0 就能复现。** 它只是每步取 argmax；跨批次、跨硬件、换推理后端都可能不同。要复现得固定版本与批处理形状。
- **以为「支持长上下文」等于「用得好长上下文」。** 位置编码的训练长度、二次成本、有效检索能力是三个独立上限，超过训练长度的那部分是外推。
- **以为约束解码能保证正确。** 它只保证语法合法；模型本来想说的内容若不在合法集合里，会被强行改写，不确定性被藏起来而不是被暴露。

## 30 秒自测

**1. 线性注意力为什么更快，却在长上下文上更差？**

<details>
<summary>答案</summary>

去掉 softmax 后可以先算 $K^\top V$，得到一个与长度无关的固定状态，于是每层从 O(n²) 降到 O(n)，缓存也不再随长度增长。代价是全部历史被压进这个状态，丢什么由更新规则决定，而不是由当前 query 决定；全注意力可以为每个 query 重新选择看哪些历史。实际模型因此混排少量全局注意力层。

</details>

**2. 为什么 agent 的历史应该只在末尾追加？**

<details>
<summary>答案</summary>

KV cache 缓存的是带位置信息的 K、V。在中间插入内容会让其后所有 token 的位置平移，缓存整段失效，下次请求要重新 prefill。所以上下文结构不只是信息够不够的问题，也是缓存能不能复用的问题——这也是压缩策略必须显式保留约束类内容的原因。

</details>
