---
title: "3 · RAG：把证据放进上下文"
description: "Stanford CS329Z 第三讲：RAG 的概率形式、切块与上下文化索引、BM25 与 DPR 的互补、ColBERT 的 late interaction，以及 Self-RAG 与检索评测、三层失败模式。"
outline: [2, 3]
---

# 3 · RAG：把证据放进上下文

<div class="meta-card">
<p><strong>2026-09-30 · Diyi Yang · 63 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture03.pdf" target="_blank" rel="noreferrer">lecture03.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 2 周 · 构建模块；本讲把 RAG 拆成索引、检索、重排与 agentic 循环四段，并逐段说明它在哪失效。</p>
</div>

<SlideFigure lecture="03" page="10" caption="Slide 10 · 同一个问题两种回答：只靠参数时给出「周三下午人少」的合理猜测，接入检索后能报出上周的真实排队数字"></SlideFigure>

## 本讲速览

- **RAG 换的是知识的位置，不是模型的能力。** 把「记住」换成「查到」，代价是索引成为新的瓶颈；瓶颈在哪里，决定了你能修什么。
- **概率写法已经说明了上限。** top-K 之外的概率是 0，生成器再强也补不回没有进来的证据。
- **切块决定一个向量代表什么。** 一个向量只能表达一件事，块的大小、边界与上下文，比换一个更强的 encoder 更影响召回。
- **稀疏与稠密是互补的失败模式。** BM25 丢掉改写，DPR 丢掉稀有字面量；混合检索加 RRF 是工程默认值，不是折中。
- **重排是一条精度换延迟的阶梯。** cross-encoder 无法扫全库，ColBERT 用 token 级索引与 MaxSim 站在中间。
- **Agentic RAG 的增量在三个决策权。** 要不要查、查什么、够不够；代价是轮数不可预测、成本不可预估。
- **失败要分层归因。** 检索侧、阅读侧、循环侧各有三种典型故障，端到端分数不会告诉你哪一种正在发生。

## 1. 为什么需要 RAG

先看一个判断：**RAG 要解决的不是「模型不够聪明」，而是「知识不在参数里」与「知识变了」这两件事。** 前者是覆盖问题，后者是时效问题，微调只能缓解第一个，且每次更新都要重训。

Slide 10 把差别摆得很直白。问「这周哪个 office hour 人最少」，只靠参数的回答是「试试周三下午，周中人通常最少」——这句话语法正确、语气可信、依据是常识统计，但它没有看过本周的队列日志。接入检索后，回答变成「周四 9 点，前面大约 3 个人」，因为上下文里放进了「Tue 4pm: 14 waiting avg; Thu 9am: 3」。

两个回答的差别不在措辞，而在**可验证性**。课件在 Slide 11 给了两条理由，都值得当作设计目标：

- **Dynamic**：增删文档只改索引，不改权重。知识更新从「一次训练」变成「一次写入」。
- **Interpretable**：模型可以给出指向被检索文档的引用，让人去核对。这句话在工程上的含义是——**RAG 把「信不信」变成了「查不查」**。

这条路线不是新东西。Slide 12 的 DrQA（Chen et al., 2017）在 83 万篇维基文档上做 retriever-reader；Slide 14 的 RAG（Lewis et al., 2021）把它端到端化，那一页还标出 REALM、DPR 这条谱系。从 DrQA 到今天的差别不在架构，而在 reader 从「在段落里抽 span」变成了「拿着段落写答案」。

那为什么不用微调？三个理由在工程上都很硬。**更新成本**：微调要重训、要验证、要回滚，而改索引只是写一次；**可引用**：参数里的知识指不出出处，检索到的段落可以；**可授权**：不同用户能看不同文档，权限可以加在检索层，加不到权重里。

代价也要说清楚。检索把错误从「编造」换成了「引用了一个错误来源」，后者更难被发现，因为它自带出处。同时，索引成了新的运维对象：要更新、要重建、要做权限过滤。本讲末尾的失败清单里，一半都出在这一层。

## 2. RAG 流水线：从 retriever-reader 到边缘化

这一节的判断是：**RAG 的概率形式本身就标出了瓶颈位置。** 公式写得越清楚，越容易看出哪一项在拖后腿。

最早的形式是两段式的（Slide 13）。给定文档集合 $\mathcal{D}=\{D_1,\dots,D_N\}$ 与问题 $Q$：

$$
\text{Retriever: } f(\mathcal{D},Q)\rightarrow P_1,\dots,P_K,\qquad
\text{Reader: } g\big(Q,\{P_1,\dots,P_K\}\big)\rightarrow A
$$

$K$ 是预先定死的（课件举例 100）。原始设计里 retriever 是固定的 TF-IDF 稀疏模型，reader 是神经阅读理解模型，可以在 SQuAD 一类数据上训练，也可以直接换成零样本 LLM。这个划分的好处是**两段可以分开评测**：检索没召回到，reader 再强也无解。

RAG 把两段合成一个概率模型（Slide 16）：

$$
p(y\mid x)\approx\sum_{z\in\text{top-}K}p(z\mid x)\,p(y\mid x,z)
$$

读法很关键：**每个候选段落的答案，按 retriever 给这个段落的概率加权。** 这就分出两种生成方式：

| 变体 | 做法 | 代价 |
|---|---|---|
| RAG-Sequence | 选一个段落，用它生成整个答案 | 长答案会漂移，因为后半段可能已经不属于这个段落 |
| RAG-Token | 每生成一个 token 重新选段落 | 每步都要边缘化，计算与实现都更重 |

Slide 17 补了训练目标：联合训练 retriever 与 generator，最小化负边缘对数似然 $-\sum_j \log p(y_j\mid x_j)$。注意这个目标对 retriever 是**弱监督**的——它只知道最终答案对不对，不知道哪个段落该负责，这正是后面 DPR 要用对比学习单独训练 retriever 的原因。

具体部件在 Slide 18–19：retriever 用双塔，$p(z\mid x)\propto\exp\big(\mathbf d(z)^\top\mathbf q(x)\big)$，其中 $\mathbf d(z)=\mathrm{BERT}_d(z)$、$\mathbf q(x)=\mathrm{BERT}_q(x)$，top-$k$ 用最大内积搜索（MIPS）解；generator 用 BART，把 $x$ 与 $z$ 拼在一起送进 encoder-decoder。

<SlideFigure lecture="03" page="16" caption="Slide 16 · RAG 的边缘化写法：对 top-K 段落按检索概率加权求和，并区分 RAG-Sequence 与 RAG-Token"></SlideFigure>

为什么这个形式重要？因为它把「RAG 好不好」拆成了两个可测的量：$p(z\mid x)$ 的质量（检索）与 $p(y\mid x,z)$ 的质量（阅读）。工程上最常见的误判是把阅读问题当成检索问题修——答案不对就换更大的模型，而真正的问题是正确段落压根没进 top-K。

代价同样在这里显形。$K$ 是超参：调大能提高召回，但上下文变长、延迟上升，而且中间位置的证据会被忽略（Slide 63 的 lost in the middle）；调小则直接压低召回上限。**$K$ 不是「越多越好」的参数，它是一次显式的预算分配。**

Slide 20 给了这套流水线最早的评测方式，也值得当作范式：在 NQ、TriviaQA、WebQuestions、CuratedTrec 上用 Exact Match 打分，同时对 Jeopardy 式的问题生成做人工评估。**自动指标管事实题，人工评估管生成质量**——这个双轨结构到今天仍然适用，因为 EM 只能判断字符串是否相等，判断不了答案是否被证据支持。

## 3. 索引（一）：chunking 是检索的基本单位

判断先行：**切块不是预处理细节，它决定了「一个向量代表什么」。** 一个向量只能代表一件事，所以块的边界就是语义的边界；边界切错，后面换任何模型都救不回来。

先看检索对表示的要求（Slide 23）。课件把 embedding 按「一个向量覆盖什么」分类：

| 类型 | 例子 | 一个向量覆盖 |
|---|---|---|
| Static word | word2vec、GloVe | 一个词型 |
| Contextual | BERT、RoBERTa | 上下文中的一个 token |
| Passage | Sentence-BERT、DPR、E5 | 一个 chunk |
| Multimodal | CLIP | 文本或图像，共享空间 |
| Graph | node2vec、GNN encoder | 一个节点或关系 |

RAG 用的是第三行：每个 chunk 一个定长向量，配一个相似度度量（余弦或内积）。于是所有问题都回到「chunk 怎么切」。

固定大小切分（Slide 24）按 token 数分段，课件给的区间是 100–500 token，重叠 10–20%。两个失败方向写得很干脆：**太小，向量没有上下文；太大，一个向量平均掉多个主题。** 除此之外还有语义切分（按句子、章节等逻辑边界）、上下文增强切分（每块带元数据或摘要）、以及用 LLM 找自然断点的动态切分。

Slide 25 用同一段文字做了三种切法，是整节课最实用的一个例子。原文说「项目里程碑在第 6 周周四 23:59 截止，迟交天数不适用于里程碑，最终报告在第 10 周」。50 token 的固定切法把「due Week 6, Thursday」和「11:59pm」切到了两个块里——检索能命中「里程碑在第 6 周」，但答不出具体时刻。加 overlap 的版本把两段都保留了，代价是同一句话被索引两次。按标题结构切分的版本把「Milestone: Week 6, Thu 11:59pm」留在一句里，答案完整。

<SlideFigure lecture="03" page="25" caption="Slide 25 · 同一段课程说明的三种切法：固定 50 token 把「Thursday」与「11:59pm」切开，加 overlap 后重复，按标题切分保留完整语义"></SlideFigure>

这里能看出取舍的本质：**固定大小把边界交给 token 计数器，结构切分把边界交给作者。** 前者对任何文档都能跑，后者要求文档本身有结构；PDF、扫描件、聊天记录往往没有。overlap 是廉价的补丁，它用存储和重复召回换「边界不丢句子」。

代价还有一层常被忽略：chunk 一旦改变，整个索引都要重建，embedding 也要重算。所以切块策略要在建库之前定，而不是在效果不好时随手改。

还有一笔账要和 $K$ 一起算。块越小，一条证据越容易被切碎，于是检索要多取几块才能拼回完整语义——**块大小与 $K$ 共同决定上下文预算**。500 token 的块取 10 条是 5000 token，200 token 的块取 25 条也是 5000 token，但后者带来更多边界噪声、更多重复（overlap）、更弱的单块连贯性。真正的约束不是「块多大」，而是「用多少 token 换来一条完整证据」。

## 4. 索引（二）：contextual retrieval 与 late chunking

判断：**上下文丢失是切块的必然代价，两种补法的成本结构完全不同——一种买 token，一种买窗口。**

Slide 26 把问题压缩成一个对比。块里只有一句「公司营收环比增长 3%」，问题是「ACME 2023 年 Q2 的营收增长是多少」。这个块没有主语、没有季度、没有单位，向量里也就没有这些信息。补上上下文后变成「摘自 ACME 2023 年 Q2 的 SEC 文件；2023 年 Q1 营收为 3.14 亿美元。公司营收环比增长 3%」——同一句话，现在能匹配到问题了。

Anthropic 的做法（Slide 27–28）是在索引前给每个 chunk 生成一段「定位上下文」：把整篇文档与该 chunk 一起塞进 prompt，要求模型只输出一句简短的情境说明，再把这段说明拼回 chunk 前面。课件特别标注了 pipeline 的两个出口：**embedding 负责语义，TF-IDF/BM25 负责精确词，两路结果合并。**

<SlideFigure lecture="03" page="26" caption="Slide 26 · 上下文缺失的典型例子：块内只有「营收增长 3%」，补上公司与季度后才能真正回答查询"></SlideFigure>

效果在 Slide 29，指标是 Failed Retrievals @20 的平均值：

| 配置 | 失败率 |
|---|---|
| Embedding | 5.7% |
| Embedding + BM25 | 5.0% |
| Contextual embedding | 3.7% |
| Contextual embedding + contextual BM25 | 2.9% |

四根柱子讲了两个独立的结论：**上下文化本身有效（5.7% → 3.7%），混合检索也有效（5.7% → 5.0%），两者叠加最好（2.9%）。** 失败率大约减半，而代价是索引时为每个 chunk 多跑一次 LLM 调用，且 prompt 里要带整篇文档。

<SlideFigure lecture="03" page="29" caption="Slide 29 · 四组配置的检索失败率：5.7%、5.0%、3.7%、2.9%，上下文化与混合检索各自独立生效"></SlideFigure>

late chunking 走的是另一条路（Slide 30）。先用长上下文 encoder 把整篇文档编码，再在每个 chunk 的 token 跨度上做 mean-pooling，得到该块的向量。课件把对比写得很清楚：**没有 LLM 调用，也不给每个 chunk 增加 token；上下文被带进了向量本身。**

<SlideFigure lecture="03" page="30" caption="Slide 30 · late chunking 与朴素切块的对比：先编码整篇文档、再按跨度池化，块向量天然携带全文语境"></SlideFigure>

两条路的代价要分开算。contextual retrieval 贵在**索引时的 token**：文档越多、块越细，LLM 调用越多，而且生成的上下文质量取决于模型。late chunking 贵在**编码器窗口与显存**：必须有一个能吞下整篇文档的长上下文 encoder，而且块边界要在编码之后才确定，改切块就要重新编码。两者都只解决「文档内」的上下文，跨文档的全局问题要靠下一节的树与图。

## 5. 索引（三）：RAPTOR、GraphRAG 与向量索引

判断：**层级与图解决的是「答案跨块、问题跨文档」，代价是索引从「切片」升级成一次 LLM 摘要工程。**

RAPTOR（Sarthi et al.）针对的是一类单块表示无能为力的问题：答案散落在整篇文档里。构建方式是自底向上的（Slide 32）：embedding 各 chunk → 聚类 → 用 LLM 为每个簇写摘要 → embedding 摘要 → 重复，直到形成一棵树。检索时跨层进行：**细节问题命中叶子，主题问题命中上层节点。**

Slide 33 用灰姑娘的两个问题说明这点：Q1 问「故事的中心主题」，Q2 问「她怎么得到圆满结局」。RAPTOR 选中的节点常常已经包含 DPR 选中的叶子——要么直接包含，要么被收进上层摘要。课件给的结论很克制：**RAPTOR 的上下文通常已经覆盖 DPR 的上下文。**

<SlideFigure lecture="03" page="32" caption="Slide 32 · RAPTOR 的树构建：叶子是文本块，向上依次聚类、LLM 摘要、再 embedding，检索可以在任意层命中"></SlideFigure>

GraphRAG（Edge et al., 2024）换了一个维度：先把文档抽成实体与关系，建成知识图谱，再做社区检测，为每个社区生成摘要。查询时对社区摘要做 query-focused summarization，逐层汇总成 global answer。它擅长的是「这批文档整体在讲什么」这类问题，而不是「原文里某句话怎么说」。

<SlideFigure lecture="03" page="34" caption="Slide 34 · GraphRAG 的两段式：索引期抽实体关系、建图、检测社区并摘要；查询期对社区摘要做聚焦汇总"></SlideFigure>

索引建好之后，还需要一个能快速找近邻的结构（Slide 36）。任务是：给定查询向量，返回 $N$ 个块向量中的 top-$k$。精确检索是暴力扫描，每次查询 $O(N\cdot d)$；近似最近邻（ANN）用一点召回换大量速度，三条常见路线是倒排文件（IVF，先聚类、只探测最近的质心）、乘积量化（PQ，把向量压成短码）、以及 HNSW。

HNSW 的结构值得记住（Slide 37–38）：**所有向量都在底层，越往上采样越稀；搜索从顶层开始，贪心地朝查询方向跳，跳不动就降一层。** 复杂度约为 $\log N$ 跳，召回高。构建时逐个插入，随机决定它能到达的最高层——多数节点只待在 layer 0，少数能上到顶层——然后在每一层连 $M$ 个最近邻，外加一条跨簇的启发式连边，避免贪心走进死胡同。

<SlideFigure lecture="03" page="37" caption="Slide 37 · HNSW 的三层结构：底层包含全部向量，上层是稀疏采样；搜索自顶向下贪心跳跃，跳不动就降层"></SlideFigure>

这一节的代价要说透。RAPTOR 与 GraphRAG 都把**索引期**变成主要成本：聚类、摘要、建图都要跑 LLM，文档更新还会牵动上层节点重算；摘要本身是有损的二手信息，检索到摘要时你拿不到原文措辞。HNSW 则是近似结构：recall 小于 1，$M$ 与搜索宽度要调，删除与更新比插入麻烦得多。索引不是「建一次就完」的静态资产。

所以先问一句：**你的问题真的需要树或图吗？** 如果查询多是「某条规定怎么说」这类局部事实，叶子检索足够，RAPTOR 的摘要层级只增加成本；如果查询多是「这批材料整体在讲什么」，纯叶子检索无论取多少条都拼不出全局，这时树或社区摘要才划算。GraphRAG 还多一层前提：文档里得真有实体与关系可抽，代码库与合同文本适合，诗歌与会议记录未必。

## 6. 检索（一）：BM25

判断：**BM25 至今仍是默认基线，不是因为它效果最好，而是因为它便宜、可解释、对精确字面量最强。**

打分函数在 Slide 41，逐项看比背公式有用：

$$
\mathrm{score}(D,Q)=\sum_{i=1}^{n}\mathrm{IDF}(q_i)\cdot
\frac{f(q_i,D)\,(k_1+1)}{f(q_i,D)+k_1\left(1-b+b\cdot\dfrac{|D|}{\mathrm{avgdl}}\right)}
$$

$$
\mathrm{IDF}(q_i)=\ln\frac{N-n(q_i)+0.5}{n(q_i)+0.5}
$$

三个部件各管一件事。$\mathrm{IDF}$ 衡量词有多稀有：出现在越少文档里的词权重越高，$N$ 是集合文档数，$n(q_i)$ 是包含该词的文档数。中间那一项是**词频饱和**：$f(q_i,D)$ 涨到一定程度，收益就被 $k_1$ 压住，避免一个词重复一百次就赢。分母里的长度归一化用 $b$ 控制：文档越长，同样词频的说服力越弱，$|D|/\mathrm{avgdl}$ 把长度折算成相对值。

Slide 42 的图把这两条曲线画了出来：IDF 随文档频率下降，词频则饱和。理解这两条曲线，就能预判 BM25 会在哪里失手——**它对「同一个意思换一种说法」完全没有办法**，因为词表里根本没有那个词；反过来，它对产品 ID、错误码、人名这类罕见字面量极其可靠，稠密检索恰恰在这里最弱。

代价还有几条工程性的：IDF 依赖全语料统计，索引更新要重算；中文需要分词，分词粒度直接影响召回；分数是相对的，**跨语料不可比**——这也是后面 RRF 要用排名而非分数的原因。

Slide 42 还提醒了一件事：这一页对比的是 IDF 的不同写法与词频饱和曲线。同一份语料，写法不同，词的相对权重就不同。**换一个 BM25 实现或分词器，分数就不再可比，排序也可能变。** 这解释了为什么把检索库从 A 换到 B 之后，同一批问题会给出不同的 top-K：变的不只是代码，是打分函数本身。

<SlideFigure lecture="03" page="41" caption="Slide 41 · BM25 打分：IDF 决定词的重要性，分子分母的词频项制造饱和，长度归一化按文档长度折算"></SlideFigure>

## 7. 检索（二）：DPR 与 hybrid

判断：**DPR 的贡献不是「语义更好」这种笼统说法，而是把检索变成一个可训练的双塔，从而允许你用标注对与负样本去定义「相关」。**

Slide 43 把 DPR 拆成离线与在线两半：离线用 passage encoder 把所有段落编码成向量，存进向量索引；在线用 query encoder 编码问题，做内积，取 top-$k$。因为两塔完全独立，段落向量可以预计算——这是它能扫全库的原因，也是它无法建模词级交互的原因。

训练在 Slide 47：对比学习，用 in-batch negatives 加 BM25 挖出的 hard negatives。结果标题写得很克制——**DPR 在 5 个数据集中的 4 个上超过 BM25。** 表里的数字值得看两处：NQ 上 Top-20 从 59.1 提到 78.4；SQuAD 上则是 68.8 降到 63.2。**稠密检索不是普遍更强，它在答案高度依赖原文措辞的数据集上会输。**

<SlideFigure lecture="03" page="47" caption="Slide 47 · DPR 与 BM25 的 Top-20 / Top-100 检索准确率对比：NQ、TriviaQA、WQ、TREC 上领先，SQuAD 上落后"></SlideFigure>

Slide 48 补了一个实用性结论：**1000 对 QA 就足以超过 BM25**，且不需要额外预训练就能端到端超过 ORQA 与 REALM。这句话的真正含义是——稠密检索的冷启动成本没有想象中高，难的是持续维护标注与负样本。

负样本的选择值得多说一句，因为它是双塔训练里最容易被做错的部分。in-batch negatives 几乎免费：同一个 batch 里其他问题的正确段落，天然就是「对这个 query 不相关」的样本。但它们往往太容易——话题差得远，模型学不到细节。BM25 挖出的 hard negatives 词面相近、语义不同（同一个产品的不同版本、同一份规范的不同条款），模型必须学会区分这些细微差别。课件把两者并列写在训练设置里，正是这个意思：**便宜的要，难的要，缺一不可。**

既然两种检索的失败模式不同（Slide 49）：**BM25 漏掉改写，稠密检索漏掉稀有字面量（错误码、产品 ID）**，那么混合检索就是自然的默认值：两路都跑，再融合两个排名列表。融合用倒数排名融合（RRF）：

$$
\mathrm{RRF}(d)=\sum_{r\in R}\frac{1}{k+\mathrm{rank}_r(d)},\qquad k=60
$$

它只合并位置，不合并原始分数，因此**不需要按语料调权重，也能接任意数量的检索器**。代价是丢掉了分数的绝对信息：一个「非常确信」的第一名和一个「勉强」的第一名，在 RRF 里得分一样。

<SlideFigure lecture="03" page="49" caption="Slide 49 · 混合检索与 RRF：两路检索各自排名，按 1/(k+rank) 融合，k 取 60，无需按语料调参"></SlideFigure>

## 8. 重排与 ColBERT：精度与延迟的阶梯

判断：**检索、重排、交叉编码器不是替代关系，而是一条精度换延迟的阶梯；每一级都在为上一级的候选付钱。**

Slide 50 给出基本区别：**bi-encoder 把 query 与 passage 分开编码，cross-encoder 把两者拼在一起过模型，允许全交叉注意力。** 后者更准，因为它能看到词与词的交互；但它不能预计算——每对 (query, passage) 都要前向一次，所以只能对一个小候选集重排。

ColBERT 站在两者之间，用 late interaction（Slide 51）：每个 token 保留一个向量，query 与 passage 仍然独立编码，只在打分时交互，打分方式是 MaxSim：

$$
S_{q,d}=\sum_{i\in q}\max_{j\in d}\mathbf q_i^\top\mathbf d_j
$$

读法：query 的每个 token，去 passage 里找最相似的那个 token，取最大值，再对所有 query token 求和。课件用四张图对比了四种架构——表示相似度、query-document 交互、全对全交互、late interaction——ColBERT 是唯一既保留 token 级证据、又能预计算索引的一档。

<SlideFigure lecture="03" page="51" caption="Slide 51 · 四种打分架构对比：ColBERT 的 late interaction 保留每 token 向量，打分时才做 MaxSim 交互"></SlideFigure>

成本在 Slide 54 的表格里最清楚：

| 检索器 | 离线预计算 | 查询延迟 | 强在 | 崩在 |
|---|---|---|---|---|
| BM25（稀疏） | 倒排索引 | 62 ms | 精确词：ID、人名、错误码 | 改写、同义词 |
| DPR（双塔） | 每段一个向量 | 数十 ms | 语料规模的语义匹配 | 稀有字面量；需要标注对 |
| ColBERT（late interaction） | 每 token 一个向量 | 458 ms 端到端 | 大规模下的 token 级证据 | 索引大小按 token 算 |
| Cross-encoder（BERT-base） | 无 | 每 1000 段 10,700 ms | 小候选集上的准确率 | 无法扫全库 |

（延迟数字来自 Khattab & Zaharia (2020) 的 MS MARCO 与 Karpukhin et al. (2020)，硬件不同，课件也标了这一点。）

<SlideFigure lecture="03" page="54" caption="Slide 54 · 四类检索器的成本表：BM25 62 ms、DPR 数十 ms、ColBERT 458 ms、cross-encoder 每千段 10.7 秒"></SlideFigure>

这张表的用法是倒推预算：如果端到端延迟要求 300 ms，cross-encoder 只能处理几十个候选；ColBERT 能用，但索引会膨胀到每 token 一个向量；BM25 几乎免费，可以作为兜底。**跨级替换通常不划算**——用 cross-encoder 替代 BM25 去扫全库，是把 62 ms 变成几十分钟。

重排为什么有效，用双塔的信息瓶颈就能解释：bi-encoder 必须把一段话压进一个定长向量，压缩时丢掉的东西再也找不回来；cross-encoder 让 query 与 passage 的每个 token 互相看见，判断「这段话是否回答了这个问题」时不需要先压缩。代价是它必须逐对计算，所以只能作用于**已经召回的候选集**。于是典型流水线是三段：召回要宽（BM25 + 稠密，取 top-100），重排要准（cross-encoder 或 ColBERT，取 top-10），生成要省（只把 10 条放进上下文）。每一段的 K 都可以单独调，也可以单独评测。

## 9. Agentic RAG：把检索变成动作

判断：**前面的流水线只回答「给定 query 怎么检索」，没有回答「要不要检索、检索什么、什么时候停」。Agentic RAG 的增量全在这三个决策上。**

Slide 56 把这层说得很直接：Everything so far answers one question well. None of it decides whether to retrieve, what to ask, or when to stop. 于是提出三件事——**检索应该是 agent 采取的一个动作**，并对应三个决策：(1) 直接回答还是先检索；(2) 检索的话 query 怎么写；(3) 结果够不够好，要不要再查。

<SlideFigure lecture="03" page="56" caption="Slide 56 · Agentic RAG 的三个决策：要不要检索、检索什么、结果是否足够；此前所有方法都只优化「给定 query 的检索」"></SlideFigure>

Self-RAG（Asai et al., 2024）的做法是把这三个决策学进模型（Slide 57）。轨迹分三步：按需触发检索（retrieve on demand），是否检索由模型自己判断；随后并行生成多个片段，每个片段配一个检索结果；再对每个片段做批判——相关性（Relevant / Irrelevant）与支持度（Supported / Partially），据此选出最好的片段，必要时重复。课件对它的总结是：**学习检索、批判与生成，以提升整体质量、事实性与可验证性。**

<SlideFigure lecture="03" page="57" caption="Slide 57 · Self-RAG 的三步：按需触发检索、并行生成带检索的片段、用相关性/支持度批判后选段并迭代"></SlideFigure>

CRAG（Yan et al., 2024）把批判放在检索之后（Slide 58）：一个 retrieval evaluator 判断检索文档与输入的相关性，给出置信度，据此触发三种动作——Correct 走知识精炼（拆条、过滤、重组），Ambiguous 同时用精炼结果与网络搜索，Incorrect 直接改写 query 去搜。它的价值在于**把「检索失败」变成一个可分支的状态**，而不是让错误的文档直接进上下文。

Search-R1（Jin et al., 2025）走的是训练路线（Slide 59–60）。轨迹里交替出现 `<think>`、`<search> query </search>`、`<information> … </information>` 与 `<answer>`，模型可以搜索任意多次。训练时把搜索引擎放进 rollout，用 PPO 或 GRPO 优化整条轨迹——课件画的框架里，value LLM、reward model、reference LLM 与 search engine 各就各位，policy 与 frozen 的 reference 之间还有 KL 约束。

<SlideFigure lecture="03" page="59" caption="Slide 59 · Search-R1 的一条多轮轨迹：think 里判断缺什么、search 发查询、information 返回文档、再判断、以 answer 收尾"></SlideFigure>

为什么这类方法难？三个原因都来自结构：检索是**离散动作**，不可微，只能靠 RL 或拒绝采样；奖励**稀疏**，只有最终答案对错，中间哪一步查错了没有信号；**轮数不可预测**，同一个问题可能查一次也可能查五次，延迟与成本因此无法预估。这也解释了为什么工业界更常用「提示词里写清停止条件 + 最多 N 轮」的工程版本，而不是直接上 RL。

三个代表方法的分工可以并排看：

| 方法 | 谁做决策 | 要训练吗 | 代价 |
|---|---|---|---|
| Self-RAG | 模型在生成中自己产出反思判断 | 要（课件：learns to retrieve / critique / generate） | 需要能产出反思信号的训练数据；每个片段都要批判 |
| CRAG | 外部 evaluator 先给检索结果分级，再分支 | 课件未展开 | 多一次评估调用；三条分支让 pipeline 变复杂 |
| Search-R1 | 策略模型在 RL 里学会何时搜、搜什么 | 要（PPO / GRPO） | rollout 里跑搜索引擎，训练很贵；轨迹长度不定 |

这张表也说明了选型逻辑：**如果只是想让系统别乱检索，提示词加一轮 critic 就够；如果检索行为本身要成为可优化的策略，才需要训练。** 训练换来的不是「更会检索」，而是「检索与推理的耦合方式被数据决定」，这既是它的价值，也是它难以调试的原因——出问题时你面对的是一个策略，而不是一段可读的代码。

## 10. 失败模式与工程建议

判断：**RAG 的失败可以按检索侧、阅读侧、循环侧三层归因；多数团队只监控端到端答案质量，所以定位不到层。**

Slide 63 把九种故障排成三列：

| 层 | 故障 | 表现 |
|---|---|---|
| 检索侧 | Recall ceiling | 缺了证据，agent 再聪明也受限 |
| 检索侧 | Stale index | embedding 不更新，索引停留在过去 |
| 检索侧 | Permission leak | 用到了不该访问的内容 |
| 阅读侧 | Lost in the middle | 位置偏置，中间的段落被忽略 |
| 阅读侧 | Distraction | 相似但不相关的内容挤占注意力 |
| 阅读侧 | Evidence conflict | 多个来源互相矛盾 |
| 循环侧 | Compounding error | 早期错误影响后续决策 |
| 循环侧 | No stopping rule | 没有明确的结束条件 |
| 循环侧 | Prompt injection | 检索到的文本反过来操纵 agent |

<SlideFigure lecture="03" page="63" caption="Slide 63 · RAG 的九种故障，按检索侧、阅读侧、循环侧三列排开"></SlideFigure>

这九条里有三条最容易被低估。**Recall ceiling** 是结构性的：top-K 之外的概率为 0，任何下游优化都改不了。**Stale index** 是运维问题，但表现成像模型问题：答案过时，往往是索引没重建。**Prompt injection** 最危险，因为检索文本通常被当作「事实」而不是「输入」——它和用户输入一样不可信，却常常没有同等的检查。

这九条也解释了为什么端到端评测不够用。课件给的四种指标都只测检索侧：Hit@k 问「有没有一条相关段落进了 top-K」，Failed@k 是它的补数，nDCG@k 关心排序位置（用 $\log_2(i+1)$ 折损），MRR@k 只看第一个命中排在第几。**它们能回答「证据进来了没有」，回答不了「进来之后有没有被用上」。** 后者要靠阅读侧的检查——答案是否引用了对应段落、多个来源冲突时选了哪个、中间的段落有没有被忽略。

落到工程上，几条务实的顺序：

1. **先建检索评测，再调生成。** 用 Hit@k 看召回是否存在、Failed@k 直接看漏检率、nDCG@k 看排序质量、MRR@k 看第一个命中的位置（Slide 45–46）。没有这组数，调 chunk 大小是盲调。
2. **默认开混合检索。** BM25 与稠密检索的失败模式互补，RRF 不需要调参，接第三路检索器也不用改融合逻辑。
3. **重排只对候选集做。** 定一个延迟预算，倒推 cross-encoder 能吃多少条；超过预算就退到 ColBERT 或纯向量。
4. **给索引加版本与新鲜度。** 文档更新要能触发重建，embedding 模型换版本也要重建——旧向量和新向量不在同一个空间里。
5. **权限过滤放在检索层。** 不要指望 prompt 说「不要用机密内容」；不该进上下文的文档，根本不该被召回。
6. **循环要有预算与停止条件。** 最大轮数、最大 token、无新信息即停——这三条比任何提示词技巧都可靠。

## 延伸阅读

- Chen et al., [Reading Wikipedia to Answer Open-Domain Questions](https://arxiv.org/abs/1704.00051), ACL 2017（DrQA，retriever-reader 的早期形态）。
- Lewis et al., [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401), NeurIPS 2020（RAG-Sequence / RAG-Token）。
- Karpukhin et al., [Dense Passage Retrieval for Open-Domain Question Answering](https://arxiv.org/abs/2004.04906), EMNLP 2020（DPR）。
- Khattab & Zaharia, [ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT](https://arxiv.org/abs/2004.05150), SIGIR 2020。
- Günther et al., [Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models](https://arxiv.org/abs/2409.04701), 2024。
- Sarthi et al., [RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval](https://arxiv.org/abs/2401.18059), ICLR 2024。
- Edge et al., [From Local to Global: A Graph RAG Approach to Query-Focused Summarization](https://arxiv.org/abs/2404.16130), 2024（GraphRAG）。
- Asai et al., [Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511), ICLR 2024。
- Yan et al., [Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884), 2024（CRAG）。
- Jin et al., [Search-R1: Training LLMs to Reason and Leverage Search Engines with Reinforcement Learning](https://arxiv.org/abs/2503.09516), 2025。
- Gao et al., [Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997), 2024（课件 Slide 21 的变体分类）。
- Anthropic, [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)（Slide 27–29 的工程报告）。

## 自测

**1. 为什么说「RAG 的上限由索引决定」？用 contextual retrieval 与 RAPTOR 各举一例。**

<details>
<summary>答案</summary>

因为生成只能使用进入 top-K 的证据，而 top-K 由索引决定。contextual retrieval 解决的是「块内缺少指代与前提」——同一句「营收增长 3%」，补上公司与季度后才可能被正确查询命中；RAPTOR 解决的是「答案跨块或散落全文」——主题类问题需要上层摘要节点，叶子节点再多也拼不出全局。两者都在索引期投入（LLM 调用、摘要、聚类），换的是召回上限，而不是生成质量。

</details>

**2. BM25 与 DPR 的失败模式分别是什么？为什么 RRF 用排名而不是分数？**

<details>
<summary>答案</summary>

BM25 依赖词表匹配，遇到同义改写、跨语言表述就漏；DPR 把整段压成一个向量，对稀有字面量（错误码、产品 ID、人名）不敏感，且需要标注对与负采样来训练。两者失败方向不同，所以混合检索有效。RRF 只用位置，因为 BM25 的分数是词频与 IDF 的组合、DPR 的分数是内积，二者量纲与分布都不可比；排名是可比的，且 RRF 不需要按语料调权重，也能扩展到任意数量的检索器。

</details>

**3. Agentic RAG 相比一次性 RAG 多了哪三个决策？代价是什么？**

<details>
<summary>答案</summary>

三个决策是：要不要检索（还是直接回答）、检索什么 query、检索结果是否足够好（要不要再查或改写）。Self-RAG 用自反思 token 学这三件事，CRAG 用 critic 给检索结果分级并分支，Search-R1 用 RL 直接优化多轮搜索轨迹。代价是轮数不可预测（延迟与成本无法预估）、需要额外的训练或提示工程、以及检索文本作为外部输入带来的注入面。

</details>
