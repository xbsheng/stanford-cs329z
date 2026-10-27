---
title: "2 · 给构建者的 LLM"
description: "Stanford CS329Z 第二讲：语言模型的概率分解、注意力与线性注意力的代价权衡、三段式训练管线、prefill/decode、推理时扩展、约束解码与上下文工程，以及它们如何变成 agent 的局限。"
outline: [2, 3]
---

# 2 · 给构建者的 LLM

<div class="meta-card">
<p><strong>2026-09-28 · Diyi Yang、Michael Ryan、John Yang · 176 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture02.pdf" target="_blank" rel="noreferrer">lecture02.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 2 周 · 基础；承接第 1 讲的 agent 定义，往下钻一层，看被当作「LLM core」的那个东西到底是什么。</p>
</div>

<SlideFigure lecture="02" page="2" caption="Slide 2 · LLM 栈的分层：顶端 Agents、RAG、Chatbots 是 CS329Z 的范围，中间的 Finetuning、LoRA、RLHF 属于 CS224N，底座的 Pretraining、Architectures、GPU Kernels 属于 CS336"></SlideFigure>

## 本讲速览

- **语言模型是一个概率函数，不是一个知识库。** 它只回答「下一个 token 的概率分布是什么」，所有看起来像推理、记忆、服从的行为都是这个分布的副产品。
- **架构的设计目标是让 GPU 忙起来，不是让模型「理解」。** 自注意力的 sequential operations 是 O(1)，代价是每层 O(n²)——这条取舍直接决定了长上下文的账单。
- **线性注意力把历史压进固定大小的状态，快但记性差。** 实际模型混排全局注意力与线性注意力层，用少量全局层补回检索能力。
- **模型的行为主要由后训练决定。** 拒绝、啰嗦、格式、工具调用习惯，都来自 SFT/RLHF/RLVR 把分布搬到了哪里，而不是来自 Transformer。
- **prefill 与 decode 是两种负载。** 前者并行、算力受限；后者逐 token、带宽受限。把两者混算，是 agent 成本估算最常见的错误。
- **test-time scaling 的上限由验证器决定。** 重复采样解决「能不能采到」，验证器解决「能不能挑出」；没有验证器时只能用投票这类弱替代。
- **结构化输出解决接口问题，上下文工程解决容量问题。** 两者都不提升模型能力，但决定了 agent 能不能稳定跑起来。

## 1. 语言模型是一个条件概率的连乘

**判断：把 LLM 当成「会说话的数据库」会误导后面所有的工程决策。它是对 token 序列定义概率分布的函数，其余能力都是从这个分布里采样出来的副产品。**

课件 Slide 7 只有一句话：一个 token 序列的概率，等于从第一个到最后一个 token 的条件概率之积。

$$
P(x_{1:T})=\prod_{t=1}^{T}P(x_t\mid x_{<t})
$$

<SlideFigure lecture="02" page="8" caption="Slide 8 · 把公式落到具体句子上：The / class / was / about / agents / . 每一步给出一个条件概率，六项相乘后只剩 1.2e-17，右下角注明实践中改用对数求和以避免数值下溢"></SlideFigure>

Slide 8 的数值值得盯一会儿。`P(The)=0.0377`、`P(class|The)=0.0001`、`P(was|The,class)=0.0344`，乘到第六个 token 时联合概率已经是 `1.2e-17`。这不是模型坏掉了，而是连乘的正常量级：**序列每长一个 token，联合概率就再乘一个小于 1 的数**。所以训练与打分一律在对数域做：

$$
\log P(x_{1:T})=\sum_{t=1}^{T}\log P(x_t\mid x_{<t})
$$

::: warning 概率不等于「合理性」
`1.2e-17` 听起来荒谬，但这是绝对概率，不是相对判断。模型真正在比较的是同一个位置上不同候选 token 的相对大小，而不是整句的绝对概率。用困惑度（perplexity）比较两个模型时，比的也是平均每 token 的负对数似然，而不是某一句的连乘结果。
:::

这个定义有三个直接推论，后面每一节都会用到：

1. **训练目标是逐 token 的。** 损失在词表的每一个位置上定义，而不是在句子级别定义（§4 的交叉熵）。
2. **生成必须从左到右、一次一个 token。** 因果分解决定了没有「先写结尾」这种选项，也就决定了 §5 的 prefill/decode 结构。
3. **每一步都是对整个词表做一次分类。** 词表规模在十万量级，一次前向传播的最后一层就是一个十万类的 softmax，这是 LM head 在推理时不可忽略的开销。

### 1.1 生成式与判别式

Slide 11 把两类模型并排放：判别式学「怎么把类别分开」（logistic regression、SVM），生成式学「数据本身的分布」（naive Bayes、diffusion models）。语言模型属于后者，因此**可以采样**——这是它与分类器的根本区别。

Slide 12 的 knowledge check 提醒了一个记号陷阱：$p(x_t\mid x_{<t})$ 长得像判别式的条件概率，但模型建模的对象是整个序列的分布，所以它是生成式模型。这条区分在工程上有实际后果：判别式模型的输出是固定标签集上的分数，天然可约束；生成式模型的输出是整个词表上的分布，想让它只吐合法内容，需要额外的机制（§7 的约束解码）。

## 2. 解码：从一个分布到一段文本

**判断：解码策略不是「调参口味」。它直接决定同一个 agent 在同一个任务上的稳定性、格式合法率与多样性。**

模型给出的是分布，解码负责从分布里挑 token。课件 Slide 18 列出常见选项，并在 Slide 22 给了取舍：

| 策略 | 机制 | 适合 | 代价 |
|---|---|---|---|
| Greedy | 每步取概率最大的 token | 事实问答、工具参数 | 容易重复、容易卡在局部最优 |
| Temperature | 用 $T$ 缩放 logits 后重新归一化 | 连续调节随机性 | 高温下格式错误率上升 |
| Top-k | 只在前 $k$ 个候选里采样 | 需要可控多样性 | $k$ 固定，不随分布形状变化 |
| Nucleus (top-p) | 取累计概率达到 $p$ 的最小候选集 | 自适应候选集大小 | 分布很平时仍会引入长尾 |
| Beam search | 维护 $b$ 条候选路径 | 翻译、需要全局较优 | 时间与显存复杂度更高 |

<SlideFigure lecture="02" page="20" caption="Slide 20 · 温度对 next-token 分布的影响：低温时分布集中成一个尖峰，高温时摊平到多个候选上"></SlideFigure>

温度的写法是把 logits 除以 $T$ 再 softmax：

$$
p_i^{(T)}=\frac{\exp(z_i/T)}{\sum_j \exp(z_j/T)}
$$

$T\to 0$ 时退化为 argmax，$T\to\infty$ 时退化为均匀分布。课件 Slide 22 的三条考虑都很实用：**数学与代码适合低温度**（答案空间窄、需要确定性），**创意写作需要更高多样性**，**beam search 更贵**（时间与内存都随 beam 宽度增长）。

::: tip 给 agent 的默认值
工具调用参数、结构化输出、需要复现的评测跑分：低温度（或 0）加约束解码。需要探索的任务（生成多个候选补丁、头脑风暴检索 query）：提高温度，再用验证器筛选。这两类需求不该用同一个采样配置。
:::

有一个常被忽略的前提：**temperature 0 只是每步取 argmax，它不保证跨批次、跨硬件逐位复现**。把「可复现」当作评测前提的 harness，需要自己固定模型版本、批处理形状与推理后端，而不是指望采样参数。

## 3. 架构：注意力的二次代价

**判断：Transformer 的设计目标不是「理解语言」，而是「让 GPU 忙起来」。它换来的并行度，代价落在 agent 的上下文预算上。**

### 3.1 一次前向传播里发生了什么

Slide 27–60 用三十多页动画拆开了一个 decoder-only Transformer，节奏刻意放慢，Slide 32 干脆停下来提醒：从这里开始跟丢，后面的内容都会很难懂。按顺序是：

token 查表得到 embedding，加上位置编码；每一层先用 $W_Q,W_K,W_V$ 投影出 Q、K、V，加上**因果掩码**（每个位置只能看自己和左边），做 softmax 注意力，过 $W_O$ 投回模型维度，接残差与 LayerNorm；再接前馈网络与第二个残差。这个块重复 $N$ 次，最后过 LM head 与 softmax，得到词表上的分布。

<SlideFigure lecture="02" page="37" caption="Slide 37 · 因果注意力掩码：注意力矩阵的上三角被遮住，只保留当前 token 及其左侧；公式为 softmax(QKᵀ/√d_k)V，之后还要过输出投影与残差"></SlideFigure>

因果掩码是整个架构里最容易被低估的一行代码。它保证了训练时一个序列可以**一次前向**算出所有位置的预测（每个位置只依赖它左边），这既是并行训练的来源，也是「生成只能从左到右」的来源。

### 3.2 为什么是注意力，而不是循环

<SlideFigure lecture="02" page="61" caption="Slide 61 · Attention Is All You Need 的 Table 1：自注意力每层复杂度 O(n²·d)、sequential operations 为 O(1)；循环网络正好相反，每层 O(n·d²)、需要 O(n) 次串行操作"></SlideFigure>

这张表是理解后面所有取舍的钥匙。**O(1) 的串行操作意味着整个序列可以同时算**，GPU 的并行度能吃满；**O(n²) 的每层复杂度意味着上下文翻倍，注意力计算翻四倍**。循环网络算得省，但必须一个 token 一个 token 地等，GPU 大部分时间在空转。

注意力的二次代价还有第二笔账：为了不重复计算，推理时会把历史 token 的 K、V 缓存下来（KV cache），它的大小随上下文线性增长。**上下文越长，显存占用越高、每步读缓存的时间越长**——这条在第 5 节会变成具体的延迟。

### 3.3 线性注意力：把历史压进一个状态

线性注意力的做法很直接：**去掉 softmax**（Slide 66 的标注就是「Drop Softmax」）。一旦没有 softmax，$QK^\top V$ 里全是矩阵乘法，结合律就可以用了——先算 $K^\top V$，得到一个与序列长度无关的状态矩阵，再用 $q_t$ 去乘它。

<SlideFigure lecture="02" page="66" caption="Slide 66 · 线性注意力的关键一步：去掉 softmax 之后，注意力路径上只剩矩阵乘法，于是可以改变结合顺序，先乘 K 与 V"></SlideFigure>

<SlideFigure lecture="02" page="73" caption="Slide 73 · 线性注意力的更新规则：每来一个 token 更新一次固定大小的状态 S，红框标出其中「清掉不重要的记忆」这一步，即带衰减或门控的写入"></SlideFigure>

写成更新式，大致是

$$
S_t=\alpha_t S_{t-1}+k_t v_t^{\top},\qquad y_t=q_t^{\top}S_t
$$

其中 $\alpha_t$ 是课件所说的「清掉不重要的记忆」——一个衰减或门控项，决定旧状态保留多少。关键在于：**$S_t$ 的大小是固定的，与已经看过多少 token 无关**。于是每层复杂度从 O(n²) 降到 O(n)，缓存从随长度增长的 KV cache 变成常数大小的状态。

代价同样直接。Slide 87 把两者摆在一起：

| | Full Softmax Attention | Linear Attention |
|---|---|---|
| 每层复杂度 | O(n²) | O(n) |
| 回看方式 | 所有 token 都能直接引用全部历史 | 新 token 只能与压缩后的状态交互 |
| 长上下文 | 友好 | 更吃力 |
| 缓存 | KV cache 随长度线性增长 | 状态大小恒定 |

<SlideFigure lecture="02" page="84" caption="Slide 84 · RULER 的上下文长度对比：序列变长后，线性注意力与状态空间模型比全注意力更吃力"></SlideFigure>

这就是「压缩」的普遍代价：**把 n 个历史向量压进一个固定大小的状态，必然丢信息**，而丢哪些信息由更新规则决定，不由当前 query 决定。全注意力可以为每个 query 重新选择要看哪些历史，线性注意力不能。所以长上下文检索类任务上，它的退化更快。

<SlideFigure lecture="02" page="88" caption="Slide 88 · 实际模型的做法是混排：滑动窗口注意力（SWA）与 DeltaNet 层交替堆叠，中间插少数全局注意力层，两侧的掩码图对比了局部窗口与全历史的可见范围"></SlideFigure>

工程上的答案是混合：大部分层用便宜的线性注意力或滑动窗口注意力，少数层保留全局注意力，负责「回看远处」。课件用 Kimi K3 的框图收尾（Slide 90），它的 block 里同时有 Multi-Head (Latent) Attention、线性注意力与 Feed Forward。

### 3.4 上下文长度是训练出来的

Slide 85 有一句容易被跳过的话，但对 agent 工程最重要：

> Nothing the Transformer or Linear Attention enforced a strict context length… except the way the model processes positional embeddings.

架构本身没有硬性长度限制，**限制来自位置编码：模型必须在训练中学会使用它**。所以「支持 1M 上下文」和「在 1M 上下文上仍然可靠」是两件事。超出训练长度的那部分，本质上是外推。

::: warning 长上下文的三个独立上限
① 位置编码的训练长度（模型见过没有）；② 注意力的二次成本与 KV cache 的显存（跑不跑得动）；③ 有效检索能力，即模型能不能在长输入中部找到需要的那一条（找不找得到）。第 8 节的 context rot 讲的是第三条。
:::

Slide 91 把这一整节收束成一句给构建者的话：agent 会面对极长上下文，推理效率是系统设计的一部分，**了解架构能帮你选对模型，也能帮你围绕模型的强弱项设计 harness**。

## 4. 训练：预训练、midtraining、后训练

**判断：模型的行为——拒绝、啰嗦、输出格式、调用工具的习惯——主要不是架构决定的，而是后训练阶段把分布搬到了哪里。**

### 4.1 预训练：把语料压成一个分布

训练目标就是第 1 节那个连乘的负对数似然，落到词表上写成交叉熵：

$$
\mathcal{L}=-\sum_{i=1}^{V}y_i\log p_i
$$

因为 $y$ 是 one-hot，这个求和实际只保留正确 token 的那一项。Slide 99 给了具体数字：正确 token 的概率是 0.0124，损失就是 $-\log 0.0124 \approx 1.907$。**损失衡量的是「模型把多少概率质量放在了正确答案上」**，与句子的绝对概率无关。

<SlideFigure lecture="02" page="102" caption="Slide 102 · 预训练数据的流水线：原始 HTML 经正文抽取、语言识别、规则过滤、质量过滤与去重，才成为最终训练语料"></SlideFigure>

数据侧的工序比模型侧更影响结果：正文抽取（去掉导航与广告）、语言识别、规则过滤、质量过滤、去重。课件用 DCLM 的样例展示了过滤前后的差别——同一批网页里既有论坛闲聊，也有代码文档与食谱，去重与质量分类决定了模型学到什么。Slide 105–107 补充了语料来源（The Pile）、数学语料（Nemotron-CC-Math）与**数据配比**（Olmix）：不同领域按什么比例混合，本身就是可调的设计参数。

### 4.2 Midtraining：在预训练末尾换配比

Slide 108–111 讲了一个相对新的阶段：在预训练后段（课件里也叫 cooldown）把数据配比**向目标领域倾斜**（数学、代码），再进入后训练。Slide 109 的两张表按「领域 × 质量分档」列出配比，可以看到 cooldown 阶段目标领域明显向高质量档集中。

课件引用的两条结论方向一致：**把目标领域数据混进「预训练」通常有帮助**（The Finetuner's Fallacy），而 midtraining 的作用是**弥合预训练分布与后训练分布之间的落差**（Slide 111 用 $\theta_{\text{pre}}\to\theta_{\text{mid}}\to\theta_{\text{target}}$ 的示意说明这一点）。

对构建者的含义：如果你的任务有明确的领域（比如某个代码库、某种工单格式），「在预训练/中期训练里见过」与「在 SFT 里见过几百条」是两种不同强度的信号。

### 4.3 后训练：从「续写」到「按要求做事」

| 阶段 | 目标 | 数据来源 | 主要代价 |
|---|---|---|---|
| Instruction finetuning | 学会按指令组织回答 | 人工标注的指令–回答对 | 标注成本；覆盖不到的长尾行为 |
| RLHF | 对齐人类偏好 | 成对比较 + 奖励模型 | 标注者不可靠、偏好不一致、谄媚与「权威腔」、数据来源伦理 |
| RLVR | 用可验证信号做 RL | 单测、Lean 证明、精确匹配、系统状态 | 验证器设计一旦有漏洞，模型会钻空子 |
| Agent 训练 | 学会多步工具使用 | 合成的任务实例与轨迹 | 环境搭建与验证成本高 |

Slide 113–114 是经典的两步：先做指令微调（FLAN 式的多任务指令数据），再用人类偏好做 RL（InstructGPT 式的三阶段管线）。Slide 115 紧接着列出人类反馈的问题，四条都很实在：标注者不可靠、每个人的偏好不同、优化目标会诱导谄媚与「看起来很权威」的语气、数据本身的来源可能不道德。

<SlideFigure lecture="02" page="116" caption="Slide 116 · RLVR：奖励来自可验证信号（单元测试、Lean 证明、精确匹配、系统状态）；下方是 GRPO 的流程图，策略与参考模型之间用 KL 约束限制漂移"></SlideFigure>

RLVR（Reinforcement Learning with Verifiable Rewards）是对上述问题的直接回应：**把奖励变成可判定的**。数学有标准答案，代码有单元测试，形式化证明有证明检查器，agent 任务有系统终态。代价写在课件那句「need to be careful about the verifier design」里——**奖励一旦可被攻击，模型就会去攻击它**，而不是学你想教的东西。

Slide 117–118 把同一思路搬到 agent 上：SWE-Smith 从真实仓库合成软件工程任务实例（把已有代码或测试改坏，制造出可验证的失败），从而批量生产带验证信号的训练数据。Slide 118 的表格对比了闭源与开源模型在不同 harness 下的解决率——注意同一模型换一套 harness，数字会变，这本身就是第 1 讲「system 层影响结果」的又一例证。

## 5. 推理：prefill 与 decode 的不对称

**判断：prefill 与 decode 是两种完全不同的负载。把它们的成本混在一起算，是 agent 成本估算最常见的错误。**

<SlideFigure lecture="02" page="123" caption="Slide 123 · prefill 与 decode：prompt 的四个 token 一次性并行处理并把 KV 写入缓存（cached），之后 decode 每步只处理一个新 token，复用前面所有 KV"></SlideFigure>

一次请求分两段：

- **Prefill**：整段 prompt 并行过一遍，算出所有位置的 KV 并缓存。矩阵规模大、并行度高，是**算力受限**的。
- **Decode**：每步只处理一个新 token，但要把全部权重和整段 KV cache 读一遍。并行度低、访存为主，是**带宽受限**的。

Slide 122、134 用 roofline 模型把这两段落在了不同的区域：prefill 在计算密集的一侧，decode 在带宽密集的一侧。这解释了几件工程上很实际的事：

1. **长 prompt 贵在 prefill，长输出贵在 decode。** 一个塞满工具输出与检索片段的 agent，与一个要长时间思考的 agent，瓶颈不同。
2. **前缀缓存（prefix caching）为什么重要。** 如果多次请求共享同一段前缀（system prompt、工具定义），缓存命中可以省掉重复 prefill。反过来说，**前缀一变，缓存全废**——这条在第 8 节会变成上下文设计的一条硬约束。
3. **批处理对 decode 的收益远大于对 prefill 的收益**，因为 decode 每步都在等内存。

Slide 136–137 的投机解码（speculative decoding）是另一条思路：用一个小模型快速起草 $k$ 个 token，再让大模型**一次前向**并行验证，接受最长的正确前缀，拒绝其余部分。

<SlideFigure lecture="02" page="136" caption="Slide 136 · 投机解码：draft model 逐 token 起草，target model 一次前向并行验证，前三个 token 被接受（绿勾）、第四个被拒绝（红叉）后重新起草"></SlideFigure>

它不改变输出分布（验证保证与目标模型采样等价），只改变速度。收益完全取决于**接受率**，而接受率取决于文本的可预测性——课件那句「some domains are more predictable than others」正是指这一点：格式化输出、代码补全、摘要这类高可预测文本，起草容易命中。

## 6. Test-time scaling：把算力放在哪一段

**判断：test-time scaling 不是让模型变聪明，而是用更多采样换更高的命中率。它的上限由验证器决定，而不是由采样数决定。**

Slide 139–148 是一条清晰的递进：先让模型多想几步（CoT），再训练它长时间思考（reasoning model），最后在推理时多采几次（repeated sampling）。

<SlideFigure lecture="02" page="140" caption="Slide 140 · 同一道夹克题：传统 LLM 直接给出答案；推理模型先在「加 25% 再减 25% 等于不变」这个陷阱上走错，然后在同一段生成里自我纠正，最后算到 75 美元"></SlideFigure>

这一页的价值在于展示**自我纠正发生在生成内部**：模型先写下错误直觉，读到自己的错误，再推翻它。这不是外部验证器给的反馈，而是长思考本身带来的。代价是 token：想得越久，decode 越贵、延迟越高。

于是有了「推理档位」这一层产品化的抽象。Slide 143 是 GPT-OSS 的做法：在 system prompt 里写 `Reasoning: low / medium / high`。Slide 144 列了两种训练侧的实现：

- **Inkling（Thinking Machines）**：用 $\lambda$ 控制努力程度，低努力时把 $\lambda$ 调高、高努力时调低。
- **Kimi K3（Moonshot）**：奖励设为「正确 +1、错误 0、错误且超预算 −1」，让模型学会在预算内作答；同时用多教师蒸馏，把高/中/低三档努力、通用/agent/编码三类任务的教师组合起来训练一个学生。

<SlideFigure lecture="02" page="145" caption="Slide 145 · 重复采样被拆成两个问题：coverage（给定预算能否采到至少一个正确解）与 precision（能否从样本里挑出正确解，需要一个验证器）"></SlideFigure>

Slide 145–146 的框架值得记住：重复采样不是一个问题，是**两个**。

1. **Coverage**：采样 $N$ 次，能不能采到正确解？这一侧随采样数上升，边际收益递减。
2. **Precision**：有了 $N$ 个候选，能不能挑出对的？这一侧需要一个验证器——单元测试、形式化检查器、多数投票。

只有第一侧、没有第二侧，采样再多也无法交付。这也解释了为什么代码 agent 特别适合这套方法：**测试就是一个便宜且可靠的验证器**。

没有验证器时，最常用的替代是自一致性（self-consistency）：采样多条推理路径，对最终答案投票。

$$
\hat{a}=\arg\max_{a}\sum_{j=1}^{N}\mathbf{1}\left[a_j=a\right]
$$

它的隐含假设是「正确的推理路径会收敛到同一个答案」。这个假设在答案可归一化（数字、短实体）时成立，在开放式生成上很弱——两条完全不同的长篇回答没法投票。

::: warning 采样换准确率的三个前提
① 存在能判对错的验证器（或至少能比较的答案形式）；② 单次采样有非零命中率（否则采样再多也是零）；③ 预算是可接受的——成本随 $N$ 线性增长，而延迟往往也随 $N$ 增长。
:::

## 7. 结构化输出：把概率压进 schema

**判断：结构化输出解决的是「接口」问题，不是「能力」问题。它保证输出合法，不保证输出正确。**

Slide 152 给出动机：复合 AI 系统由多个部件组成（检索器、模型、工具、代码），它们之间**需要一个共享的通信契约**。这就是 schema。

<SlideFigure lecture="02" page="153" caption="Slide 153 · 约束解码：用有限状态机描述目标语法，解码时只允许 FSM 当前状态接受的 token；图中对比了普通 FSM 与压缩 FSM 的逐步解码过程"></SlideFigure>

约束解码（constrained decoding）的机制是：把目标语法（JSON schema、正则、DSL）编译成有限状态机，每一步按当前状态**屏蔽掉不合法的 token**，再在剩下的候选里归一化采样。SGLang 的贡献之一是把 FSM 压缩，减少每步的状态转移开销。

代价有两层，第二层常被忽略：

- **开销**：每步都要算一次合法 token 掩码，语法越复杂越贵。
- **信息被抹掉**：如果模型本来想输出的内容不在合法集合里，约束解码会把它**强行改写**成某个合法 token。模型的不确定性因此被隐藏，而不是被暴露。一个语法完全合法、语义完全错误的 JSON，比一段语法错误但意图清楚的文本更难排查。

Slide 155–156 展示另一种「结构化」的实现路径：DSPy 的 signature。它把输入输出字段写成带类型与描述的声明，编译成 system prompt 加 `[[ ## field ## ]]` 分隔符的模板，再靠解析器读回结构。展开后的提示词里，每个字段都带着类型约束（`Union[str, NoneType]`、三选一的 `Literal`），本质上仍是一段写给模型看的规范。

这组页面对比说明了一个诚实的事实：**很多「结构化输出」本质上仍是提示词约定加解析器**，而不是解码层约束。两者的可靠性差别很大——前者靠模型配合，后者靠语法强制。选型时应该分清自己在用哪一种。

Slide 157–158 给了更轻的替代：在 embedding 上接一个小分类头，把「决策」变成固定标签集上的分类；课件把这类模型称为 system one 模型——反应快、成本低，但只能做封闭集合的选择。Slide 159 的 Toolformer 则是让模型自己学会「在哪调用、调用哪个、传什么参数」，把工具调用当作一种可学习的输出格式。

## 8. Context engineering：上下文是有限资源

**判断：上下文不是越多越好。它是一个容量有限、每次改动都要付缓存代价的资源，需要像管理内存一样管理它。**

<SlideFigure lecture="02" page="163" caption="Slide 163 · context rot：左侧要把「9 月或 8 月有几篇关于经济的文章」这类问题跨几十篇文档聚合，右侧要在 12 小时对话记录里找某个角色出现几次；输入越长，中间段落越容易被漏掉"></SlideFigure>

Slide 162 先列出 agent 上下文里的五类内容：system prompt、message history、memories、tool call results、attached files。Slide 163–164 紧接着回答「为什么不全部塞进去」：**context rot**——即使任务本身很简单，只要输入变长、需要跨段落聚合，模型的表现就会下降。

原因可以从第 3 节推出来：注意力要在 n 个位置上分配权重，位置越多，单条信息分到的份额越少；混合架构里被压缩进固定状态的那些历史，更是只剩一个摘要。这不是某一个模型的 bug，是注意力机制与状态压缩的统计后果。

课件给的几条实践建议，每条都对应一个具体机制：

**避免膨胀。** Slide 166 的例子是 Pi：它只有 read、write、edit、bash 四个工具，够用。工具越多，schema 越长、选择越难、上下文越挤。

**用检索代替堆放。** Slide 167：需要哪段记忆或文件就取哪段，而不是把全部历史带上。这条会在下一讲 RAG 里展开。

**只在末尾追加。** Slide 168–169 给了一个纯工程的理由：

<SlideFigure lecture="02" page="169" caption="Slide 169 · 在历史前面插入内容会让其后所有 token 的位置编码改变，整段 KV cache 失效（红色叉号）；所以要「add sequentially」，只在末尾追加"></SlideFigure>

KV cache 缓存的是带位置信息的 K、V。在历史中间插入一段内容，后面所有 token 的位置都要平移，缓存整段作废，下一次请求要重新 prefill。**上下文的结构设计因此不只是「信息够不够」的问题，也是「缓存能不能复用」的问题。**

**用评测验证选择。** Slide 170 的建议最朴素，也最容易被跳过：上下文怎么组织没有唯一答案，可以搭一套 benchmark 去测。哪条提示放在开头、工具描述压缩到多短、检索取几段，这些都是可以消融实验的参数，而不是口味问题。

**压缩（compaction）。** Slide 171 的四句话把权衡说完了：到需要压缩时上下文已经极长；压缩的核心决策是「新上下文里留什么」；留太多，很快又要压缩一次；丢太多，可能丢掉完成任务必需的关键信息。

课件配的截图是个具体的失败案例：用户在 system prompt 里加了「不要删除任何东西」，后来上下文被压缩，这条约束丢了，agent 于是批量删除了邮件。**被压缩掉的那一条，往往正是最不能丢的那一条**——所以压缩策略要显式保护约束类内容，而不是按「最近/最相关」排序。

Slide 172–173 给了另一种哲学：递归语言模型（RLM）。它不试图把所有内容放进窗口，而是把上下文当成一个**可以反复查看的外部对象**，模型写代码去检索、切分、递归处理它。这与「压缩」是两条路：一条是丢掉细节保住概览，一条是把细节留在窗口之外、按需取回。

## 9. 这些设计如何变成 agent 的局限

**判断：agent 的局限大多可以追溯到这一讲的某个具体设计决策，而不是「模型不够聪明」。** 把机制与症状对上，才知道该在哪一层修。

| 设计决策 | 直接后果 | agent 里的表现 | harness 的应对 |
|---|---|---|---|
| 自回归逐 token 生成 | 单步有非零错误率，且误差会沿轨迹累积 | 长任务跑到后面偏离目标 | 缩短步数、每步验证、允许回滚 |
| 因果注意力 + 位置编码 | 有效上下文受训练长度限制，中部信息易被忽略 | 长文档里漏掉关键约束 | 分段处理、把约束放在首尾、显式复述 |
| 全注意力 O(n²) + KV cache | 长上下文贵，且前缀一变缓存全废 | 多轮 agent 越跑越慢、越跑越贵 | 只在末尾追加、前缀稳定、压缩重置 |
| 线性注意力压缩状态 | 长距离精确检索能力下降 | 早期读到的细节在后期消失 | 关键信息落到外部存储，按需取回 |
| 预训练分布 + 后训练偏好 | 训练分布外行为不稳定，且倾向「像样」而非「正确」 | 自定义工具 schema 上格式出错、过度自信 | 约束解码、schema 校验、失败重试 |
| 采样与温度 | 高温提升多样性也提升格式错误 | 同一任务两次结果不同 | 任务分层设温度，评测记录采样配置 |
| test-time scaling 的成本 | 长思考与多次采样线性加价 | 延迟与账单不可预测 | 分级 effort、小模型路由、缓存 |

这张表也解释了为什么第 1 讲反复强调 **harness**：模型侧的这些性质短期内不会消失，能改的是围绕它的系统——把验证做在外部、把状态放在模型之外、把上下文当成需要调度的资源。

Slide 175 的总结把全讲收成五块：什么是语言模型、架构（Transformer 与线性注意力）、训练（预训练/midtraining/后训练/agent 训练）、推理（prefill/decode 与推理时扩展）、给 agent 的 LLM（结构化 I/O 与上下文工程）。下一讲转向 RAG：把外部知识接进这个已经理解清楚的分布里。

## 延伸阅读

- Vaswani et al., [Attention Is All You Need](https://arxiv.org/abs/1706.03762), NeurIPS 2017。（Slide 27、61）
- Katharopoulos et al., [Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention](https://arxiv.org/abs/2006.16236), ICML 2020。（Slide 83）
- Hsieh et al., [RULER: What's the Real Context Size of Your Long-Context Language Models?](https://arxiv.org/abs/2404.06654), 2024。（Slide 84）
- Kimi Team, [Kimi K3: Open Frontier Intelligence](https://arxiv.org/abs/2607.24653), 2026。（Slide 90）
- Li et al., [DataComp-LM: In Search of the Next Generation of Training Sets for Language Models](https://arxiv.org/abs/2406.11794), 2024。（Slide 103）
- Chung et al., [Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416), 2022。（Slide 113）
- Ouyang et al., [Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155), 2022。（Slide 114）
- Shao et al., [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300), 2024。（Slide 116）
- Chen et al., [SWE-smith: Scaling Data for Software Engineering Agents](https://arxiv.org/abs/2504.21798), 2025。（Slide 117）
- Chen et al., [Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318), 2023。（Slide 137）
- Wei et al., [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903), 2022。（Slide 139）
- Brown et al., [Large Language Monkeys: Scaling Inference Compute with Repeated Sampling](https://arxiv.org/abs/2407.21787), 2024。（Slide 145）
- Wang et al., [Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://arxiv.org/abs/2203.11171), 2022。（Slide 147）
- Zheng et al., [SGLang: Efficient Execution of Structured Language Model Programs](https://arxiv.org/abs/2312.07104), 2023。（Slide 153）
- Schick et al., [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761), 2023。（Slide 159）
- [OOLONG: Evaluating Long Context Reasoning and Aggregation Capabilities](https://arxiv.org/abs/2511.02817), 2025。（Slide 163）
- Zhang et al., [Recursive Language Models](https://arxiv.org/abs/2512.24601), 2025。（Slide 172）

## 自测

**1. 为什么训练与打分都在对数域做，而不是直接用连乘？**

<details>
<summary>答案</summary>

因为联合概率随序列长度指数级变小：Slide 8 的六个 token 已经乘到 `1.2e-17`，再长就会在浮点数下溢成 0。取对数后，连乘变成求和，量级落在可表示范围内，而且梯度更稳定。注意这是数值稳定性问题，不是模型「觉得这句话不可能」——模型比较的是同一位置上候选 token 的相对概率。

</details>

**2. 线性注意力为什么更快，却在长上下文上更差？**

<details>
<summary>答案</summary>

去掉 softmax 后，$QK^\top V$ 可以改结合顺序，先算 $K^\top V$ 得到一个与长度无关的状态，于是每层复杂度从 O(n²) 降到 O(n)，缓存也从随长度增长的 KV cache 变成常数大小的状态。代价是这个状态必须把全部历史压缩进去，丢哪些信息由更新规则决定，而不是由当前 query 决定；全注意力可以为每个 query 重新选择看哪些历史，所以检索式任务上退化更快。实际模型因此混排少量全局注意力层。

</details>

**3. 约束解码能保证 tool call 一定正确吗？**

<details>
<summary>答案</summary>

不能。它只保证**语法合法**：每一步屏蔽掉 FSM 不接受的 token。参数值是否正确、该不该调用这个工具、意图是否被正确理解，仍然由模型分布决定。更麻烦的是，如果模型本来想输出的内容不在合法集合里，约束会把意图强行改写成某个合法 token，把不确定性藏起来——一个语法完美但语义错误的 JSON 比一段语法错误但意思清楚的文本更难排查。所以约束解码要配上 schema 校验与失败重试。

</details>
