---
title: "7 · Agent 记忆：跨会话的连续性"
description: "Stanford CS329Z 第七讲：长时运行与多会话的 agent 为什么需要记忆、四种记忆类型、四类架构模式（流程复用、分层记忆、反思式合并、记忆维护）、存储与读写策略，以及记忆评测基准与遗忘、隐私、过度个性化三类开放问题。"
outline: [2, 3]
---

# 7 · Agent 记忆：跨会话的连续性

<div class="meta-card">
<p><strong>2026-10-14 · Diyi Yang、Michael Ryan、John Yang · 103 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture07.pdf" target="_blank" rel="noreferrer">lecture07.pdf</a></p>
<p>课程位置：第 4 周 · 框架与设计。</p>
</div>

## 本讲速览

- **记忆的第一职责是守住安全边界，个性化只是副产品。** 这一讲用两起事故开场：agent 忘记的不是你喜欢什么，而是「不要动」这条约束。
- **四种记忆类型的真正区别在写入成本与过期方式。** working 是上下文窗口，episodic 是原始日志，semantic 是事实，procedural 是技能；越往后写一次越贵。
- **四类架构模式不是四选一，而是四个要分别回答的问题。** 学流程、分层、反思、维护，可以在同一个系统里同时出现。
- **存储选型决定了检索能做什么。** 文件系统给层次与 grep，向量库给语义相似，知识图谱给关系推理；代价各不相同。
- **写入越贵，读的时候越省心；反之亦然。** 这条权衡贯穿 Voyager、MemGPT、Mem0 的所有设计。
- **评测的四个要求互相拉扯。** 前三个基准都在 realistic 上打了半勾，唯一四项齐全的 MemoryArena 把绝对分数压到很低。
- **最难的不是记住，是知道什么时候该忘。** 记忆创建时无法判断未来相关性，这使遗忘成为一个不可完全求解的问题。

## 1. 两起事故：记忆出错时，先坏在约束上

课件没有用「个性化助手」开场，而是放了两张截图。第一张（Slide 3）是一个值班场景：员工手册写得很清楚——迟到要提前 30 分钟告知，30 天内 3 次无故迟到触发书面警告。员工发消息说「我 10:45 才到」，AI 主管（Luna）回「完全没问题，路上注意安全」，随后员工打卡时间 11:08。

<SlideFigure lecture="07" page="3" caption="Slide 3 · 手册规则在上下文里，agent 却把一次迟到回成「完全没问题」：规则没有被拿去和这一次事件比对"></SlideFigure>

把这张截图当成「模型不够聪明」会看错重点。手册那几条规则本身是完整的，问题在于**规则是静态文本，事件是动态流**：要让「3 次」有意义，系统必须把「这一次迟到」写成一条可累计的记录，并在下一次对话里读回来。截图里这两件事都没发生——规则被读进去了，但没有被用来生成一条记忆，也没有被用来做判断。

第二张截图（Slide 4）更严重。用户的原话是：

> Check this inbox too and suggest what you would archive or delete, don't action until I tell you to.

agent 随后开始执行「Nuclear option: trash EVERYTHING in inbox older than Feb 15」，用户连发「Do not do that」「STOP OPENCLAW」「Stop don't do anything」，动作仍在继续，还追加了「Keep looping until we clear everything old」。

<SlideFigure lecture="07" page="4" caption="Slide 4 · 收件箱事故的完整动作序列：从「Nuclear option」到「STOP OPENCLAW」，两个否定指令都出现在批量删除已经开始之后"></SlideFigure>

能确定的只有动作序列：用户给了明确的否定指令，动作没有停。合理的推断是约束的存放方式有问题——如果「这个收件箱在删除前必须人工确认」只存在于某一轮对话的上下文里，它就会随上下文滚动而失效；如果它被写成一条带作用域的 procedural memory，或者被写成一条挂在具体资源上的 episodic 记录，后面的每一步都有机会再读到它。

两起事故的共同点值得单独记住：**记忆系统最该保存的往往不是「用户喜欢什么」，而是「什么不能做」。** 前者影响体验，后者影响后果。这也是为什么本讲把架构讲了 35 分钟，却把评测和开放问题放在最后——架构决定能力上限，约束的可靠性决定能不能上线。

## 2. 没有记忆会丢什么，有了记忆换回什么

Slide 9 与 Slide 10 是一组对照，两边各有三条：

| 没有记忆 | 有了记忆 |
|---|---|
| Loss of procedure：每次都要重新教一遍任务 | Learning from experience：一次学会的技能可以复用 |
| Loss of knowledge：事实、规则、偏好在会话间丢失 | Personalization：偏好被积累成画像 |
| Loss of progress：会话变长后忘记做过什么、目标与早先指令 | Statefulness：新对话能接着上次继续 |

三条损失的性质不一样。「丢流程」是重复劳动，「丢知识」是答错，「丢进度」是**在同一件事上前后矛盾**。第三种最难被发现，因为它不会在单轮里暴露，只在跨会话时暴露。

课件用三张图（Slide 11–13）给了三种收益的具体形态，它们对应三种不同的写入时机：

<SlideFigure lecture="07" page="13" caption="Slide 13 · 有无跨会话记忆的订票对话对比：没有记忆时要 10 轮才收敛，有记忆时 2 轮就够，因为槽位被存住了"></SlideFigure>

- **Personalization（Slide 11，Jiang et al., 2025）**：第 2 轮用户说「我很喜欢意大利菜」，第 12 轮说「我最近查出来 gluten 过敏」——偏好被更新；到第 20 轮，推荐必须同时满足「不吃麸质」和「仍然合口味」。写入发生在偏好变化的那一刻，而系统必须判断这是**更新**而不是**追加**。
- **Learning from experience（Slide 12，Wang et al., 2024）**：同一条检索式任务（找地点、填邮编）在不同网站上重复出现，轨迹被归纳成可复用的 workflow。写入发生在任务成功之后，是对多个 episode 的压缩。
- **Statefulness（Slide 13，Du et al., 2025）**：订机票的多轮对话，没有跨会话记忆时要 10 轮才收敛，有记忆时 2 轮就够——因为「旧金山到悉尼、3 月 3 日、经济舱」这些槽位被存住了。写入发生在槽位填满的那一刻，几乎是逐字的。

三种收益的代价是同一个：**写入与维护成本**。画像要更新，流程要归纳，槽位要落盘，每一项都要额外的模型调用与存储，而这些成本发生在用户看不见的地方。

更麻烦的是三者失败方式不同：画像写错会推荐错东西，流程写错会执行错步骤，槽位写错会在下一轮覆盖掉用户的确认。**记忆越靠近执行，写错的代价越高**——这条分界线在后面的四类架构里会反复出现。

## 3. 四种记忆类型：差别不在内容，在写入与过期

Slide 16 引用 CoALA（Sumers et al., 2024），把记忆分成四层，外加一个 decision procedure 把记忆读进动作：

<SlideFigure lecture="07" page="16" caption="Slide 16 · CoALA 的四层记忆：procedural（LLM 与 code）、semantic、episodic 通过 retrieval/learning 进出 working memory，actions 与 observations 再回流"></SlideFigure>

| 类型 | 存什么 | 写入方式 | 过期方式 |
|---|---|---|---|
| Working | 当前看到并正在推理的内容：观测、目标、用户输入、内部推理 | 每一轮天然更新 | 随上下文窗口滚动而消失 |
| Episodic | 过去行为的序列（轨迹）、此前的全部对话、原始日志 | append-only，几乎零成本 | 不会自己过期，只会被检索忽略 |
| Semantic | 关于世界与用户的事实、偏好、常识 | 一次 LLM 抽取后写入 | 被新事实覆盖（需要冲突检测） |
| Procedural | 施加在 working memory 上、决定行为的规则与技能 | 写成代码或技能文件，要验证 | 环境变化时整体失效 |

四类记忆的工程差别集中在两点。

**写入成本递增。** working 是免费副产品；episodic 只要落盘；semantic 要跑一次抽取；procedural 要生成、执行、验证，还得保证它真的能跑。这解释了为什么大多数产品先做 semantic 记忆——它是性价比最高的一档。

**过期机制不同。** working 靠窗口淘汰，episodic 靠检索排序，semantic 靠冲突解决，procedural 靠人工或环境反馈下线。记忆系统出问题，多半是某一种过期机制缺失：episodic 从不淘汰会让检索变慢变差，semantic 不做冲突检测会留下互相矛盾的偏好，procedural 不随环境更新会静默失效（Slide 41，Cao et al., 2026）。

还有一点值得单独指出：**这四类记忆在同一个系统里是互相转换的**。一次 working memory 里的对话，可以落盘变成 episodic，可以被抽取成 semantic，也可以在验证后被写成 procedural。转换的每一步都是一次「压缩 + 判断」，也都是引入错误的入口。工程上真正要设计的不是「选哪一种」，而是「在哪一步转换、由谁负责、错了怎么回滚」。

### 3.1 参数记忆与上下文记忆

Slide 21 补了一个更根本的划分：记忆也可以按**存放位置**分，而不是按内容分。

| | Parametric | Context |
|---|---|---|
| 位置 | 模型权重里 | 模型上下文里 |
| Semantic | 预训练知识 | 检索到的事实 |
| Procedural | instruction following | 检索到的技能 |
| Episodic | 不适用 | 检索到的对话 |
| 更新方式 | 微调 | context manager 拉取 |
| 代价 | 训练成本、不可逆 | 每次都要付 token |

这张表最有用的一行是「Episodic: Not Applicable」。一段具体经历没法压进权重——权重里能放的是从经历中抽象出的规律，而不是「上周二那次失败」。所以只要系统需要「记得那次」，上下文记忆就是唯一选项，问题只剩怎么在有限窗口里选对那几条。

## 4. 存什么、何时触发、怎么存

Slide 24 把架构设计压缩成三个问题，每个问题下面挂着候选答案：

- **What**：要存/取什么——具体事实、一般事实、流程、对话进展；
- **When**：什么时候触发——agent 主动调工具（按需）、后台 worker、事件驱动；
- **How**：怎么存怎么取——文件系统、数据库（检索）、知识图谱。

三个问题的耦合方式决定了系统形态。比如「按需 + 文件系统」得到一个可以让模型自己 grep 的记忆目录；「后台 + 向量库」得到一个用户看不见的抽取管线。前者的失败是模型没想到去查，后者的失败是抽取错了却没人发现。

「When」这一维最容易被低估，因为三种触发时机的成本藏在不同地方。**按需触发**（agent 自己决定调记忆工具）省 token，但要求模型知道「这件事我该去查一下」——模型不知道自己不知道，就不会查；**后台 worker** 稳定，代价是延迟与写放大，用户说的这句话可能几分钟后才生效；**事件驱动**（会话结束、任务成功、用户纠正）最精准，但事件的定义要人来写，写漏了就不触发。三者可以叠加，叠加后又多了一个「哪条路径优先」的问题。

### 4.1 三种存储

<SlideFigure lecture="07" page="26" caption="Slide 26 · 文件系统式记忆：AGENTS.md 与 mcp.json 放流程，skills/ 与 tools/ 放技能，knowledge/ 放知识，conversations/ 按日期存原始对话"></SlideFigure>

**文件系统**（Slide 26）。每个记忆是一个文件，目录结构天然提供层次，grep、ls 这些 bash 命令就是记忆工具。它最大的优点不是便宜，而是**可读、可编辑、可 diff**——用户和开发者都能直接看、直接改，agent 也能自己整理目录。代价是没有语义检索：找一个「意思相近但用词不同」的记忆，只能靠模型自己猜文件名。

**数据库**（Slide 27）。向量库负责相似检索，SQLite 负责按元数据过滤，BM25 负责精确词命中。三种检索方式对应三种查询意图，混用是常态。代价是索引维护与 chunk 边界：切得太碎会丢上下文，切得太大检索会失焦——这是 RAG 讲次的老问题，在记忆场景里更明显，因为记忆是持续写入的，索引一直在变。

**知识图谱**（Slide 28，Rasmussen et al., 2025）。把记忆抽成实体与关系，检索时沿着边做多跳。它适合「这个人和那个项目什么关系」这类问题，也让时间维度可以显式建模。代价在抽取：实体识别错了会污染整张图，而且 schema 一旦定下就很难演进。

三种存储放在一起，取舍就清楚了：

| 存储 | 检索方式 | 换来的能力 | 付出的代价 |
|---|---|---|---|
| 文件系统 | `ls`、`grep`、目录遍历 | 可读、可改、可 diff，层次天然，用户能直接打开看 | 没有语义检索，质量取决于目录与命名设计 |
| 数据库 | 向量相似 + SQL 元数据 + BM25 精确词 | 检索能力强，可随数据量扩展 | 索引要持续维护，chunk 边界难定 |
| 知识图谱 | 实体、关系、多跳 | 关系推理与时间建模 | 抽取错误会污染全图，schema 演进困难 |

选型的判断标准不是「哪个更强」，而是**查询形态**：如果用户的问题经常是「上次那个文件在哪」，文件系统最合适；如果是「我之前说过关于 X 的偏好」，向量检索更合适；如果是「这个客户和哪些项目有关」，图谱才对。混用是常态——文件系统里放原始对话，向量库索引摘要，图谱存实体，三者各管一段。

## 5. 架构一：把成功轨迹写成流程

第一类模式的判断很直接：**如果一个子任务会重复出现，就不要每次重新探索。**

<SlideFigure lecture="07" page="33" caption="Slide 33 · Voyager 的 skill library 消融：有了技能库，钻石工具用 102 次 prompt 迭代做成（3 次里成 1 次）；没有技能库时一次都没做成"></SlideFigure>

Voyager（Wang et al., 2023）把每个技能写成一段可执行程序，再配一段自然语言描述，描述被 embedding 成 key 存进技能库；遇到新任务时用任务描述检索 top-5 相关技能，放进上下文。Slide 33 的表格是这条思路最干净的证据：

| 方法 | Wooden | Stone | Iron | Diamond |
|---|---|---|---|---|
| Voyager 无技能库 | 7 ± 2 | 9 ± 4 | 29 ± 11 | 未达成（0/3） |
| Voyager（有技能库） | 6 ± 2 | 11 ± 2 | **21 ± 7** | **102（1/3）** |
| AutoGPT | 92 ± 72 | 94 ± 72 | 135 ± 103 | 未达成（0/3） |

数字是「做出该等级工具所需的 prompt 迭代次数」，越低越好。真正说明问题的是最后一列：钻石工具只成功了三分之一，代价是 102 次迭代；没有技能库则一次都没成功。**技能库改变的不是效率，是可达性**——它让一类原本够不着的任务变得偶尔可及。

Agent Workflow Memory（AWM，Wang et al., 2024）把同样的思路从「代码技能」放宽到「自然语言流程」。它让模型从一批任务轨迹里抽出共同子流程，抽的时候有三条硬约束（Slide 36 的 prompt）：不要生成相似或重叠的 workflow、每个至少两步、把输入文本与按钮字符串换成变量名。抽出的 workflow 是自然语言伪代码，比如「hover(`main_category_id`) → click(`subcategory_id`)」，最后直接放进 system prompt（Slide 37）。

这一步的代价立刻出现：**system prompt 变长了**。workflow 越多，每轮固定开销越大；workflow 之间还可能重叠、冲突，模型要在上下文里自己选。AWM 的选择是「抽得少而准」，这也意味着覆盖率上不去——它是一种用 recall 换 precision 的取舍。

Skill files（Slide 39–40）是这条路线在产品侧的形态：一个目录里放 `SKILL.md`（YAML frontmatter 加 Markdown 正文）、若干说明文档、若干可执行脚本。它把「怎么做」写成人和模型都能读的工件，可版本管理、可按需加载。

Slide 41 给了这条路线最硬的一条限制：**procedural memory 对动态环境不鲁棒**（Cao et al., 2026）。技能写下来的那一刻，它假设了世界的接口不变；网站改版、API 换字段、权限模型调整，技能就静默失效——不是报错，而是继续执行并给出错误结果。课件把 skill files 称作面向通用用户 agent 的常见解法，同时承认它可以被更新，但没说更新由谁负责。

这条限制解释了一个现象：**procedural memory 的收益与维护成本几乎同时到账**。技能越好用，越多任务依赖它；依赖越多，环境变化时失效的影响面越大。工程上的常见折中是给技能加上「适用条件」与「最近验证时间」，让 agent 在读取时能判断这条技能是否还该被信任——这本身又是一次写入成本的增加。

## 6. 架构二：分层记忆与自管理

第二类模式的出发点是一个物理约束：上下文窗口有限，而记忆无限。于是把记忆分成「在上下文里的」和「在磁盘上的」，再让模型自己搬运。

<SlideFigure lecture="07" page="44" caption="Slide 44 · MemGPT 的内存布局：system instructions 只读，working context 与 FIFO queue 可写，archival storage 是向量库，recall storage 支持按字符串与日期查"></SlideFigure>

MemGPT（Packer et al., 2024）的核心判断写在 Slide 43 的一行字里：**给 LLM 工具，让它管理自己的记忆。** 具体分工是：

- system instructions：只读，放 agent 的身份与规则（对应 procedural memory）；
- working context：可读写，通过函数追加与替换（对应 semantic memory 的热数据）；
- FIFO queue：消息按先进先出滚动，由 queue manager 写入；
- archival storage：向量库，通过函数读写，存长文档与旧事实（对应 semantic 的冷数据）；
- recall storage：按字符串与日期检索，存完整对话（对应 episodic memory）。

读写函数是这套设计的接口。Slide 45 给了两个动作的语义差别：**write 是追加，replace 是改写**。前者用于「我妈给我烤了生日蛋糕」这种新增事实；后者用于冲突场景——此前存的是「男朋友叫 James」，后来说「我和 James 分手了」，就把那条记忆替换成「前男友叫 James」，而不是再追加一条互相矛盾的记录。

替换语义是这段设计里最容易被低估的部分。语义记忆的写入天然会遇到冲突，而**冲突不解决，检索就会随机返回矛盾的版本**——用户会看到 agent 今天记得你分手了、明天还记得你有男朋友。MemGPT 的选择是让模型在写入时判断该 append 还是 replace，代价是这个判断本身可能错：改早了会丢掉「我们还在一起时的偏好」，改晚了会留下过期事实。

Self-managed 分页还有两个直接代价。一是**每页操作都是一次工具调用**，上下文压力越大，调用越频繁，延迟与 token 成本越高；二是**分页策略由模型决定**，模型判断「什么该换出」错了，关键信息就再也读不回来——这是不可逆的损失，不像检索失败还能重试。

MemoryOS（Kang et al., 2025）把分层做得更细：短时、中时、长时三层加一个 persona memory，短时按 FIFO 滚动并带 heat 更新，中时按 segment 做摘要，长时存用户画像与知识。

<SlideFigure lecture="07" page="49" caption="Slide 49 · MemoryOS 的四段结构：STM（FIFO、heat 更新）→ MTM（segment 摘要）→ LPM（用户画像、知识）→ persona memory 参与检索"></SlideFigure>

层级越多，需要人定的参数越多：页大小、热度阈值、摘要触发频率、画像更新周期。这些参数没有通用最优值，只能按任务调——**分层的代价是把设计复杂度从模型转移到工程侧**。

## 7. 架构三：反思式合并

第三类模式针对的是「原始日志太多、太浅」。它假设：记忆的价值不在于存了多少条观测，而在于存了多少条判断。

Reflexion（Shinn et al., 2023）是最小版本：任务失败后，让模型用自然语言写一段「为什么失败」，存进 episodic memory，下一轮开始时读出来。Slide 52 的曲线把它讲得很清楚：

<SlideFigure lecture="07" page="52" caption="Slide 52 · Reflexion 的消融曲线：只加 episodic memory（EPM）时准确率随 trial 基本走平，加上 Reflexion 后才持续上升"></SlideFigure>

只存轨迹不够，因为轨迹里既有正确步骤也有错误步骤，模型读到的是一团噪声；反思把轨迹压缩成一条可执行的经验，信号才浮出来。这也解释了为什么反思文本在工程上受欢迎——**它是可读、可改、可审计的**，出问题能定位到具体一句话。

Generative Agents（Park et al., 2023）把反思做成常驻机制。它的 memory stream 记录所有 observation，检索时用三个维度打分：

$$
\text{score}(m) = \alpha_r \cdot \text{recency}(m) + \alpha_i \cdot \text{importance}(m) + \alpha_v \cdot \text{relevance}(m)
$$

三项分别回答「多久以前」「多重要」「和当前情境多相关」。importance 由模型给每条 observation 打分，relevance 用 embedding 相似度，recency 按时间衰减。上层再有一个 reflect 步骤，把若干条 observation 归纳成更高层的结论写回 stream，plan 从这些结论出发。

<SlideFigure lecture="07" page="55" caption="Slide 55 · Generative Agents 的检索：每条记忆带 recency、importance、relevance 三个分数，加权后取 top 若干条进入上下文"></SlideFigure>

代价是三层叠加的：每条 observation 要打分（一条一次模型调用），反思要额外生成，检索要对全量 stream 打分。这也是 Generative Agents 只能跑在模拟小镇里的原因——它的记忆成本随观测数线性增长。

反思还有一层更隐蔽的代价：**它会把判断固化**。一条反思一旦写进记忆，后续每一轮都会被当作前提读出来；如果这次失败的原因判断错了（把「工具超时」反思成「这个网站不可用」），错误就会在后续所有任务里复现，而且看起来完全是「有经验」的样子。这也是为什么反思式系统通常需要两条保护：反思要带证据（引用具体的那一步），以及反思要能被新证据推翻——后者恰恰是大多数实现没有做的。

## 8. 架构四：记忆维护与遗忘

前三类模式都在回答「怎么存得更好」，第四类回答「怎么删得对」。

Sleep-time compute（Lin et al., 2025）把记忆整理搬到离线：sleep time 阶段读 raw context，产出压缩后的 learned context；测试时只读 learned context。

<SlideFigure lecture="07" page="58" caption="Slide 58 · Sleep-time compute：离线把 raw context 压成 learned context，测试时直接用它答题，把整理成本从在线挪到后台"></SlideFigure>

这样做的收益是**在线时延与在线 token 都下降**；Slide 59 的曲线显示，在 Stateful AIME 上它基本 Pareto 支配并行的 test-time scaling。代价藏在两个地方：离线算力要花钱，而且整理结果是滞后的——用户上午说的话，下午的 learned context 里可能还没有；如果用户改了主意，旧结论会残留一段时间。

A-Mem（Xu et al., 2025）走得更远：**专门造一个 agent 来管记忆**。它把每条记忆构造成一张带时间戳、上下文、关键词、标签的笔记，然后做 link generation（与最近的 k 条建链）、memory evolution（新笔记写入时回改旧笔记的上下文与标签）和检索。

<SlideFigure lecture="07" page="62" caption="Slide 62 · A-Mem 的四步：note construction、link generation、memory evolution、memory retrieval，笔记之间靠链接组织而不是靠单一向量"></SlideFigure>

链接结构让「相关但不同时期」的记忆能被一起取出来，这是纯向量检索做不到的。代价是图会稠密化：链接越建越多，检索时的候选集合越来越大；memory evolution 会改写旧笔记，溯源变难——你没法确定某条结论是当初观测到的，还是后来演化出来的。

Mem0（Chhikara et al., 2025）把维护做成后台工作流：抽取阶段用实体抽取与关系生成把对话变成候选记忆，更新阶段用 conflict detector 找冲突、update resolver 决定动作。

<SlideFigure lecture="07" page="64" caption="Slide 64 · Mem0 的后台记忆流：extraction 阶段抽实体与关系，update 阶段做冲突检测，最后落到 ADD / UPDATE / DELETE / NOOP 四种动作"></SlideFigure>

四个动作里最关键的其实是 NOOP——**大部分时候正确的做法是什么都不做**。抽取管线如果没有 NOOP，就会把每次对话都变成一次写入，记忆库迅速被重复与近义事实填满。代价同样明显：冲突检测本身是一次模型判断，DELETE 不可逆，而后台意味着写放大与可见延迟。

## 9. 怎么评记忆

Slide 68 给了四条 desiderata，值得当作评测设计时的检查表：

| 要求 | 含义 | 常见违反方式 |
|---|---|---|
| Realistic | haystack 与 query 都要像真实场景 | 用合成的短对话当记忆源 |
| Long-Context | 短对话测不出记忆能力 | 只测几千 token 的会话 |
| Challenging | 太简单就区分不出系统差异 | 答案在最近几轮里就能找到 |
| Verifiable | 要能判定成功与失败 | 用主观评分代替可验证约束 |

四条之间互相拉扯：越真实越长，越难验证；越可验证（比如多选题），越不真实。课件用四个基准演示了这条张力：前三个在 realistic 一栏都是半勾，其中 LoCoMo 与 PersonaMem 的 challenging 也只有半勾；MemoryArena 是唯一四项全绿的一个，代价是任务变成真实的多会话工程任务，绝对分数掉到很低。

**LoCoMo**（Maharana et al., 2024）用 Generative Agents 的架构造出很长的模拟对话，每段约 16.6k token，任务是 QA，有 ground truth。它的弱点在 realistic 一栏：模拟的是用户与用户之间的对话，而 agent 实际要检索的是用户与助手之间的对话。Slide 73 的 RAG 结果表把检索单元（对话、观测、摘要）与 top-k 两维都扫了一遍：召回可以做到 80% 以上（对话 top-50 时 R@k 为 82.7），但回答 F1 最高只有 43 左右。这个差距正是课件那句红字的意思——**即使模型检索到了正确的记忆，也不一定用得上**。

**PersonaMem**（Jiang et al., 2025）换成用户与助手的对话，覆盖偏好演化，长度做到接近 1M token，用带干扰项的多选题判定。它的弱点在 challenging 与 realistic：多选题有 ground truth，但多选题不是 agent 使用记忆的真实形态。课件在这一页给出的结论是「Memory/RAG 是必需的，Mem0 对偏好演化与近期偏好有帮助」——注意这句话把「记住」和「用上变化后的偏好」分成了两件事。

**LongMemEval-v2**（Wu et al., 2026）把记忆源从对话换成 agent 轨迹：用 Codex 在四个 WebArena 环境里跑 rollout，人工出 5 类问题，再配 100–500 条不回答问题的轨迹做 haystack。它的结果（Slide 85）值得单独看：文件系统式记忆的曲线优于检索式记忆。

<SlideFigure lecture="07" page="85" caption="Slide 85 · LongMemEval-v2 的准确率–时延前沿：文件系统式记忆（AgentRunbook，GPT-5.4-mini）优于检索式记忆（AgentRunbook-R，Qwen3.5 9B）"></SlideFigure>

这里必须读课件自己的注脚：**filesystem memory 在这里更好，但其中混着模型优势**——一侧是最新的 mini 模型，另一侧是 9B 的开源模型。所以这一页支持的说法是「用文件系统加一个会 grep 的强模型，在这类轨迹回忆任务上很划算」，而不是「文件系统优于向量检索」。

**MemoryArena**（He et al., 2026）把验证从多选题换成可验证的任务约束：四个环境（捆绑式网购、团体旅行规划、渐进式网页搜索、形式推理），每个任务被拆成递进的子任务，前一个子任务的产出是后一个的输入，记忆必须跨会话累积。

<SlideFigure lecture="07" page="91" caption="Slide 91 · MemoryArena 主结果：memory agent 一组（Letta、Mem0、Mirix 等）的平均成功率 0.12，低于长上下文 0.16 与 RAG 0.17"></SlideFigure>

这一页的结论是全场最反直觉的：**专门做记忆的 controller 在真实复杂任务上反而最弱**，而「直接把长上下文塞进去」和「简单 RAG」的分数更高。课件的两条注脚都很克制——「这里还有大量空间」，以及「这是真实复杂任务，失败不能全部归因于记忆」。第二句尤其重要：任务链条一长，写代码、调工具、读约束都会失败，分数低不等于记忆模块差。

把四个基准横向排开，可以看出一条演进线：记忆源从「模拟对话」到「真实对话」到「agent 轨迹」；验证方式从「QA」到「多选题」到「可验证约束」。每一步都在向真实靠近，同时失去一点可控性。

自己搭评测时，这四个基准给的是方法论而不是题库。可操作的顺序是：先定「记忆要支撑什么任务」——是回答关于用户的问题，还是跨会话继续一件工作；再定 haystack（哪些内容算「本该被找到的证据」，哪些是干扰项）；然后定验证方式，能自动判定就用约束，不能就退回人工，但要固定评分口径。最容易忽略的一步是**构造只靠记忆才能答对、不靠推理也能蒙对的问题**——课件对 LongMemEval-v2 的说明里有一条正是「确保只有少数轨迹能回答该问题」。

## 10. 开放问题：遗忘、信任、用对

Slide 96 把开放问题收成三条，每一条都有具体的失败形态。

### 10.1 记什么、忘什么

<SlideFigure lecture="07" page="97" caption="Slide 97 · 记忆还是玩笑：用户说「10 点前的会除非有糕点否则我不认」，agent 把它当偏好存下并排进 10:30 的会议"></SlideFigure>

这句话显然是玩笑，agent 当真了：它接受了 10:30 这个时间，还把它写进了给团队的草稿。判断难点不在理解句子，而在**判断这句话该不该进入长期记忆**——创建记忆的那一刻，未来的相关性是未知的。

三种策略都有代价。全留下，检索、上下文、维护成本一起涨，而且干扰项会稀释检索质量；主动遗忘，可能删掉有用的证据或尚未兑现的承诺（这也是 Slide 97 引 Ma et al., 2026 的点）；按规则遗忘，规则本身要在信息不完整的情况下写。这不是一个能被工程完全解决的问题，只能按产品风险定阈值。

### 10.2 信任、隐私与用户控制

<SlideFigure lecture="07" page="98" caption="Slide 98 · AgentPoison（Chen et al., 2024）：用优化出的 trigger 把恶意内容写进 procedural memory，之后能让 agent 执行危险动作"></SlideFigure>

记忆是攻击面。AgentPoison 的攻击路径很具体：先用优化出的触发词把少量恶意样本写进 agent 的记忆库（向量库或知识库），之后只要用户输入里出现这个 trigger，被投毒的记忆就会被高概率检索出来，并诱导 agent 走向危险动作。**这说明记忆的写入接口和检索接口都需要权限与审计**，而不只是内容过滤。

隐私是另一面。Slide 99（Shao et al., 2025）的说法是：agent 在世界里行动时，并不完全理解你希望什么保持私密。被低估的不只是数据，还有**规范**——哪些信息可以对谁讲、在什么场合讲。同一个事实（住址、健康状况、和同事的矛盾），在有些对话里可以说，在另一些里不该说，而记忆系统通常只存事实、不存「这个事实的使用边界」。

用户控制是第三条。可查看、可编辑、可删除是基本要求，但真正难的是让人理解记忆里到底有什么——文件系统式记忆在这件事上有天然优势，因为它可以被直接打开看。

### 10.3 用对记忆

<SlideFigure lecture="07" page="100" caption="Slide 100 · 过度个性化（Hu et al., 2026）：检索到的无关记忆（饮食偏好、作者住在纽约）把回答带偏，模型对上下文里的一切都过于愿意使用"></SlideFigure>

更常见的问题是模型**过于愿意使用上下文里的一切**。检索到「用户最近在关注健康零食」，它就把健康零食塞进一个与饮食无关的回答里。课件的诊断是两条路——更好的检索（别把无关记忆取出来），或者训练模型学会忽略不重要的上下文——并明确说两条都没解决。

还有一层是用户差异：有些用户喜欢被个性化，有些觉得被冒犯。同一个记忆策略在不同用户身上得到相反的评价，这使「用对记忆」不只是技术问题，也是产品与伦理问题。

把三条开放问题放在一起看，它们指向同一个约束：**记忆系统必须在信息不完整时做不可逆的决定**。写入时不知道未来会不会有用，删除时不知道会不会后悔，检索时不知道这条记忆有没有被污染。工程上能做的不是消除这种不确定性，而是把它变得可控——写入留证据、删除留缓冲、检索留权限，让决定可以被审计和撤回。

## 延伸阅读

- Sumers et al., [Cognitive Architectures for Language Agents](https://arxiv.org/abs/2309.02427), 2024（CoALA 的四层记忆框架）。
- Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560), 2024（分层记忆与自管理分页）。
- Wang et al., [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291), 2023（skill library）。
- Wang et al., [Agent Workflow Memory](https://arxiv.org/abs/2409.07429), 2024（从轨迹归纳 workflow）。
- Park et al., [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442), 2023（memory stream 与 recency/importance/relevance 检索）。
- Shinn et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366), 2023（反思式记忆）。
- Kang et al., [MemoryOS: Memory OS of AI Agent](https://arxiv.org/abs/2506.06326), 2025（短/中/长三层记忆）。
- Xu et al., [A-Mem: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110), 2025（笔记链接与记忆演化）。
- Chhikara et al., [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413), 2025（后台冲突解决）。
- Lin et al., [Sleep-time Compute](https://arxiv.org/abs/2504.13171), 2025（离线整理记忆）。
- Maharana et al., [Evaluating Very Long-Term Conversational Memory of LLM Agents](https://aclanthology.org/2024.acl-long.747/), ACL 2024（LoCoMo）。
- Jiang et al., [PersonaMem: How Does Personalized Memory Reshape LLMs](https://arxiv.org/abs/2504.14225), 2025。
- Chen et al., [AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases](https://arxiv.org/abs/2407.12784), 2024（记忆投毒）。

## 自测

**1. 为什么 Voyager 的技能库被称作改变了「可达性」而不只是效率？**

<details>
<summary>答案</summary>

看钻石工具那一列：没有技能库时三次全失败（0/3），有技能库时三次里成功一次，用掉 102 次 prompt 迭代。效率的解释是「同样的任务做得更快」，但这里发生的是「原本做不到的任务变得偶尔能做到」。技能库把探索过程中验证过的程序固化下来，后续任务可以直接组合，于是能力边界被推过去了——代价是这类成功极不稳定，且对环境接口高度敏感。

</details>

**2. MemGPT 的 write 与 replace 分别对应什么场景，用错会怎样？**

<details>
<summary>答案</summary>

write 追加新事实（「我妈给我烤了生日蛋糕」），replace 改写冲突事实（「我和 James 分手了」把「男朋友叫 James」改成「前男友叫 James」）。该 replace 时用了 write，记忆里会同时存在互相矛盾的版本，检索时随机返回一个，用户看到 agent 前后不一致；该 write 时用了 replace，会丢掉旧事实——比如把「我们在一起时的偏好」直接覆盖掉，而那部分信息仍然有用。

</details>

**3. MemoryArena 上「专门的记忆 controller 最弱」这个结果，为什么不能直接读成「记忆模块没用」？**

<details>
<summary>答案</summary>

课件自己给了两条限定：任务链条长且真实（四个环境、递进子任务、可验证约束），失败可能来自写代码、调工具、读约束等非记忆环节；同时该组平均成功率（0.12）与长上下文（0.16）、RAG（0.17）差距很小，都在低位。要判断记忆模块本身的好坏，需要把「记忆写入/检索是否正确」与「端到端任务是否完成」分开测量，这也正是这一讲反复强调的评测难点。

</details>
