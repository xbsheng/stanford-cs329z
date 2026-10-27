---
title: "8 · 多智能体：协调的成本"
description: "Stanford CS329Z 第八讲：从 model 到 MAS 的复杂度谱系、单 agent 与多 agent 的分界、四种编排拓扑、通信与协调基础设施，以及多 agent 的三类失败模式与协调成本。"
outline: [2, 3]
---

# 8 · 多智能体：协调的成本

<div class="meta-card">
<p><strong>2026-10-19 · Diyi Yang、Michael Ryan、John Yang · 92 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture08.pdf" target="_blank" rel="noreferrer">lecture08.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 5 周 · 系统与优化；本讲把「多 agent」从产品叙事拆回工程决策。</p>
</div>

<SlideFigure lecture="08" page="9" caption="Slide 9 · 系统复杂度的单行道：model、workflow / compound AI system、agent、multi agent system，四端各配一个例子（GPT 6.1 Sol、Triage Bug、Implement Feature、Maintain Repo）"></SlideFigure>

## 本讲速览

- **多 agent 不是更强的模型，而是更贵的组织。** 它把工作、信息、责任切开，收益与代价来自同一个动作。
- **复杂度是一条单行道。** model → workflow → agent → MAS，每往右一步都换来能力，也换来更难归因的失败。
- **同一个底座模型，MAS 有时更好、有时更差。** Slide 13 上 GPT-5 的 MAS 比 SAS 高 12.3%，Gemini 2.5 Pro 与 Sonnet 4.5 上的 MAS 反而低 4.6% 与 7.2%。
- **默认答案是单 agent。** 课件的建议是：先做强单 agent baseline，为某个具体目的加 agent，再测量收益是否大于协调成本。
- **成本顺序是单 agent < orchestrated < swarm。** 四种拓扑里 independent 最省、swarm 最贵；Hybrid 夹在中间，但责任规则最复杂。
- **通信与协调是两件事。** 通信问「谁收到什么、走哪个通道」，协调问「谁拥有哪个任务、什么必须先做」。
- **失败集中在三处。** 系统设计 44.2%、agent 间错位 32.3%、任务验证 23.5%——都是组织问题，不是单点能力问题。

## 1. 系统复杂度的谱系

课件用两页画同一条轴。Slide 8 只有三站：model、workflow or compound AI system、agent。Slide 9 把轴补成四站，并在每一站下面写了一个具体例子：

| 位置 | 例子 | 决策由谁做 | 协调面 |
|---|---|---|---|
| Model | GPT 6.1 Sol | 一次前向 | 无 |
| Workflow / Compound AI System | Triage Bug | 代码固定步骤 | 无（步骤内嵌） |
| Agent | Implement Feature | 模型在循环里决定 | 单一上下文 |
| Multi Agent System | Maintain Repo | 多个模型各自决定，再对齐 | 跨上下文 |

这条轴容易被误读成「能力刻度」，其实它是**协调面的刻度**。往右走，系统要处理的不确定性从「这一步选错动作」变成「两个角色对同一件事有不同的理解」。前者靠更好的模型缓解，后者只能靠协议、工作区隔离与验证来缓解——而这三样都要人来设计。

Slide 10 给了 MAS 的工作定义：

> A collection of multiple agents oriented to solve a shared task.

定义里最要紧的词是 **shared**。多个 agent 各自做各自的事不叫多智能体，那只是批处理；只有当它们指向同一个任务、并且必须交换信息或让渡控制权时，协调成本才出现。课件因此把设计问题拆成三块：**orchestration**（谁调度谁）、**communication**（怎么传话）、**coordination**（workspace、tasks、shared context 与 memory 怎么共享）。这三块就是本讲后半程的全部结构，也是本讲的目录。

## 2. 四类收益，五类代价

多 agent 的推销话术通常只讲收益。Slide 11 列的收益确实成立，但每一条都自带对偶的代价，Slide 12 就把它们写在下一页：

| 收益（Slide 11） | 它假设了什么 | 对偶的代价（Slide 12） |
|---|---|---|
| Parallel execution：可分离的子任务并行做 | 子任务真的可分离 | Coordination overhead：委派、传话、集成都吃时间和 token |
| Specialization：提示、模型、工具按职责裁剪 | 职责边界能写清楚 | Conflicting actions：边界没划清就重复劳动、违背承诺、互相覆盖改动 |
| Focused context：每个 agent 只拿到相关信息 | 「相关信息」能被正确切分 | Information loss：切分与 handoff 会漏掉下一个 agent 需要的信息 |
| Broader exploration：并行试探多个来源与假设 | 分歧终能收敛 | Error propagation：一个 agent 的错误会误导其他 agent |

第五类代价不在表里，因为它是前四类的和：**Engineering complexity**——更多角色、更多提示、更多接口、更多交互要维护和调试。这一条最难量化，也最常被低估：一个 4 agent 系统的行为空间不是 4 倍，而是交互组合数。

课件的结论只有一句，但它就是整讲的判断标准：

> Collaboration helps when its benefits outweigh the coordination costs.

这句话之所以有用，是因为它把「要不要上多 agent」变成了可测量的比较，而不是架构品味之争。前提是你能测出两边的数——大多数团队只测了收益那一半。

## 3. 单 agent 与多 agent 的分界

### 3.1 反例先摆出来：单 agent 有时更好

<SlideFigure lecture="08" page="13" caption="Slide 13 · 同一个底座模型换不同 scaffold 的表现：横轴是 Intelligence Index，图例区分 SAS 与四种 MAS；GPT-5 上 MAS 高出 12.3%，Gemini 2.5 Pro 与 Sonnet 4.5 上 MAS 分别低 4.6% 与 7.2%"></SlideFigure>

Slide 13 的三栏图值得逐栏读。每一栏固定一个底座模型，点上叠加 SAS 与四种 MAS 拓扑（centralized / decentralized / independent / hybrid），纵轴是性能、横轴是模型的 intelligence index。结论不是「MAS 更好」或「MAS 更差」，而是**方向依模型与拓扑而变**：GPT-5 上最好的 MAS 比 SAS 高 12.3%，Gemini 2.5 Pro 上 SAS 比所有 MAS 都高（-4.6%），Sonnet 4.5 上差距拉到 -7.2%。

这张图纠正了一个常见归因错误：看到多 agent 提升，就以为提升来自「多」。实际上底座模型换了、拓扑换了，符号都会翻。所以任何「多 agent 提升 X%」的说法，必须同时给出基线、拓扑和模型。

### 3.2 判断表

<SlideFigure lecture="08" page="14" caption="Slide 14 · 两列判断清单：左列「Prefer a Single Agent System when…」是步骤高度依赖、紧耦合共享状态、单 agent 已满足质量/成本/时延；右列「Try a Multi Agent System when…」是子任务可少同步、信息可切成聚焦上下文、贡献可独立集成；底部给出「先做强单 agent baseline，再测量收益是否超过协调成本」的建议"></SlideFigure>

Slide 14 把判断写成两列清单，Slide 15 补了一张按维度对比的表。把两页合起来，可以得到下面这张决策表：

| 维度 | 倾向 SAS | 倾向 MAS |
|---|---|---|
| 任务适配 | 决策之间高度耦合，需要同一份上下文 | 子任务可分离，职责可区分 |
| 上下文组织 | 一个循环里管理 | 每个 agent 一份聚焦上下文，只做选择性共享 |
| 专精 | 一个 agent 在不同技能与工具间切换 | 不同 prompt、模型、工具与权限 |
| 并行 | 只能独立地调工具 | 子任务工作流可并发 |
| 协调与成本 | handoff 与协调接口少 | 消息、同步、集成带来额外开销 |
| 质量/成本/时延 | 单 agent 已达标 | 存在**被测量过**的瓶颈，且并行、专精或独立复核能解决它 |

表格末行是课件反复强调的那句：**瓶颈必须是量出来的**。没有测量就加 agent，等于在没有定位问题的情况下增加系统自由度，失败时也无法归因。

课件的落地建议是一句流程：

> Start with a strong single-agent baseline. Add agents for a purpose and measure if contribution benefit outweighs coordination costs.

拆成三步：先做强单 agent baseline（这一步多数人跳过，于是没有对照）；为某个明确目的加 agent（不是「为了更像团队」）；测量该 agent 的边际贡献是否超过它带来的协调成本。

### 3.3 两类耦合的读法

Slide 14 左列的「Steps are highly dependent on one another」「Work is tightly coupled to a shared state」两句，值得单独解释，因为它们描述了 MAS 最难绕开的两类耦合。

**步骤依赖**意味着 B 的正确性取决于 A 的中间结果。此时把 A、B 分给两个 agent，等于把「一次前向里的隐式上下文传递」换成一次显式 handoff，而 handoff 是有损的——这正是 Slide 12 的 information loss。

**共享状态耦合**意味着两个 agent 会改同一份东西。此时并行不是加速，而是引入冲突与覆盖，需要版本控制或资源划分才能收场，本讲第 6 节会讲这个。

## 4. 编排：四种拓扑

<SlideFigure lecture="08" page="17" caption="Slide 17 · 四种编排模式的文字定义：independent（只有聚合器）、centralized（orchestrator 逐一对每个 agent 通信）、decentralized（agent 之间全连）、hybrid（orchestrator 加有限的同级通信）"></SlideFigure>

Slide 17 给的是定义，Slide 18–21 各给一张结构图。

### 4.1 Independent：只聚合，不传话

Independent 是最省的一种：agent 之间不交换中间消息，收尾一步由 aggregator 合并或挑选。它的代价写在课件里——**agent 无法利用彼此的中间发现**。三个 agent 各自踩同一个坑，就是三倍的浪费。

它适合的场景很窄：候选生成（采样多条解法再选）、独立复核（多人独立判断，避免相互污染）。注意这两个场景的共同点是**要的就是不共享**：一旦共享，独立性带来的多样性就没了。

### 4.2 Centralized：有调度就有瓶颈

<SlideFigure lecture="08" page="19" caption="Slide 19 · Centralized（Orchestrator）结构：orchestrator 接收输入，分派给 Worker 1/2/3，worker 的结果回到 orchestrator，再由它决定下一步与输出"></SlideFigure>

Orchestrator 模式把任务拆解、分派、验收都放在一个角色上。好处是协调逻辑集中，出问题只有一个地方可查；坏处课件也直接写了——**orchestrator 会成为瓶颈**。

瓶颈有两层。第一层是吞吐：所有 worker 的产出都要经过它汇总，它的上下文会随规模线性膨胀。第二层是判断：分派质量取决于它对子任务的理解，而它对细节的了解恰恰不如干活的 worker。这构成一个结构性矛盾——**掌握全局的人不掌握细节，掌握细节的人不掌握全局**。后面讲 task ledger（第 6 节）就是为缓解这一层。

### 4.3 Decentralized（Swarm）：全连的代价是平方

<SlideFigure lecture="08" page="20" caption="Slide 20 · Decentralized（Swarm）结构：worker 之间双向互连，上方是 shared state tracking，agent 可以自己 spawn 子 agent"></SlideFigure>

Swarm 里没有中心：agent 可以 spawn 子 agent，所有 agent 通过 shared message board 或通信频道做 all-to-all 通信。课件说它适合「大规模独立探索与发现」。

它的代价藏在拓扑里：n 个 agent 全连，潜在通道是 n(n-1)/2。即使实际只用了其中一部分，维护「谁看到了什么」的一致性成本也随规模上升。Swarm 的另一个隐性成本是**停止条件**：没有中心就没有人有权限宣布结束，只能靠约定（比如达成一致比例）来终止——这正是后面失败分类里 "Unaware of Termination Conditions" 的来源。

### 4.4 Hybrid：全局监督加局部自治

Hybrid 让 orchestrator 管总任务与集成，worker 在需要协作时直接互通。它想要两全：全局有主，局部不死板。代价写在 Slide 21 的末句——**需要明确的责任与信息共享规则**。规则不清时，hybrid 会退化成「orchestrator 以为自己在管，worker 私下已经改完了」的状态，而这种状态在 trace 里几乎看不出来。

### 4.5 成本顺序与复杂度表达式

Slide 22 把「贵」写成公式，这是本讲最值得抄下来的一页：

<SlideFigure lecture="08" page="22" caption="Slide 22 · 五种架构的复杂度对照表：LLM 调用次数、串行深度、通信开销、并行度、记忆复杂度与共识方式，分别给出 SAS、independent、decentralized、centralized、hybrid 的表达式"></SlideFigure>

| 特征 | SAS | MAS (Independent) | MAS (Decentralized) | MAS (Centralized) | MAS (Hybrid) |
|---|---|---|---|---|---|
| LLM 调用 | O(k) | O(nk)+O(1) | O(dnk)+O(1) | O(rnk)+O(r) | O(rnk)+O(r)+O(p) |
| 串行深度 | k | k | d | r | r |
| 通信开销 | 0 | 1 | d·n | r·n | r·n+p·m |
| 并行度 | 1 | n | n | n | n |
| 记忆复杂度 | O(k) | O(n·k) | O(d·n·k) | O(r·n·k) | O((r+p)·n·k) |
| 共识方式 | 顺序 | 并行 + 综合 | 顺序辩论 | 层级调度 | 层级 + 同级 |

读这张表有两个要点。**并行度都写 n，但只有 independent 和 centralized 真的省时间**——decentralized 的串行深度是 d，辩论轮次直接吃掉了并行收益。**通信开销从 0 到 d·n 到 r·n**，这是成本差异的主项。

<SlideFigure lecture="08" page="24" caption="Slide 24 · 三栏分别为 OpenAI GPT、Google Gemini、Anthropic Claude 的成本–性能分布：横轴为每次实验的成本（秒），纵轴为性能，点区分 SAS 与四种 MAS；结论为 Cost Structure: Single Agent < Orchestrated < Swarms"></SlideFigure>

Slide 24 用实测把公式落到坐标轴上：成本分布按 **Single Agent < Orchestrated < Swarms** 依次右移，而性能并没有跟着一起右移。这就是「协调成本」最具体的形态——多花的钱买到的不是一个更高的点，而是另一条曲线，它可能在某个区间更高，也可能整段更低。

Slide 23 补了一句限定：**用哪种架构取决于任务**。同一批基准上，有的任务上 MAS 大幅领先，有的任务上 MAS 是负收益——这与 Slide 13 的符号翻转是同一件事的两种呈现。

### 4.6 动态组队：DyLAN

固定的四种拓扑之外，课件给了 DyLAN（Liu et al., 2023）作为「架构本身可以被搜索」的例子：

- 先让 agent 团队跑一遍 forward pass，各自对彼此的响应用 utility 打分；
- 按「谁对最终答案有贡献」反向传播 credit；
- 据此挑出最有影响力的 agent 组队；
- 新任务上用一个 LLM 给每个答案打 utility，动态把 agent 踢出队伍；
- 当 2/3 的 agent 给出相同答案时提前停止。

课件给出的结果是：在 Decision Making 任务上，DyLAN 的成功率 42.0%、平均 API 调用 24.85，而对照的 BOLAA 是 40.0% 与 32.40——**更高的成功率，更少的调用**。这个组合值得注意，因为它说明「加 agent」不必等于「加成本」：如果架构能按任务裁剪，省下的调用可以抵消协调开销。但也要看清它的前提——提前停止条件（2/3 一致）是一个人工设定的启发式，它在答案分布均匀时会失效。

## 5. 通信：谁在跟谁说话

### 5.1 通信不等于协调

Slide 31 和 Slide 51 是同一页，重复出现两次，因为它是本讲的分水岭：

| | Communication | Coordination |
|---|---|---|
| 问题 | agent 之间怎么交换信息 | agent 之间怎么管理相互依赖的工作 |
| 具体问法 | 谁收到哪些信息，通过什么通道 | 谁拥有哪个任务，什么必须先完成 |
| 涉及 | 消息格式、协议、共享工件 | 分派、依赖、冲突解决 |

混为一谈会导致一个典型错误：把「加一个群聊频道」当成「解决协调问题」。频道只让信息流动，不决定谁先做、谁负责、冲突怎么办。

### 5.2 把多 agent 当对话：AutoGen

<SlideFigure lecture="08" page="34" caption="Slide 34 · AutoGen 的四种对话模式示意：Sequential（依次交接给下一个团队）、Nested（子 agent 直接向 manager 汇报）、Group Chat（组内共享上下文）、Hierarchical Chat（所有子 agent 向 orchestrator 汇报），并列出 RoundRobinGroupChat、SelectorGroupChat、Swarm 等当前实现"></SlideFigure>

AutoGen（Wu et al., 2024）的核心主张是：**把多 agent 系统写成一段可配置的对话**。每个 agent 有角色与能力，团队用 conversation pattern 组织起来。课件列的四种模式各有明确的上下文归属：

- **Sequential**：一个团队说完再 handoff 给下一个团队，上下文是链式的，越往后越容易丢前面的细节。
- **Nested**：子 agent 直接对 manager 说，信息只在小组内流动，manager 负责向上汇总。
- **Group Chat**：组内共享一份上下文，谁都能看到谁说了什么，代价是上下文膨胀。
- **Hierarchical Chat**：所有子 agent 只对 orchestrator 说，最像 centralized 拓扑。

课件还列了当前的实现：RoundRobinGroupChat（轮流发言）、SelectorGroupChat（由一个选择器决定下一个发言者）、Swarm（按 handoff 转移控制）。这三种实现对应三种「谁决定下一个说话的人」——固定顺序、模型选择、被调用者主动接管。

### 5.3 Handoff 与 Agent-as-Tool：控制权归谁

<SlideFigure lecture="08" page="37" caption="Slide 37 · Handoff 示意：控制权从当前 agent 交给接收方，接收方成为活跃方继续对话，相关历史与任务细节一并前送"></SlideFigure>

这是本讲在工程上最实用的一组区分。两种做法都是「调用另一个 agent」，但控制流方向相反：

| | Handoff | Agent-as-Tool |
|---|---|---|
| 控制权 | 转移：接收方成为活跃方，继续这次交互 | 保留：调用方发出一个有边界的请求，然后继续 |
| 上下文 | 跟随：把相关历史与任务细节前送 | 选择：只发选定的一段上下文 |
| 结果 | 接收方直接对用户负责后续步骤 | 返回答案或工件，由调用方集成 |
| 适合 | 专家需要直面用户并拥有下一步时 | 需要由一个 agent 汇总多方贡献并统一交付时 |

判断规则可以简化成一句：**谁对最终结果负责，谁保留控制权**。分诊台把问题转给专家，专家直接和用户对话——这是 handoff。主 agent 需要一份代码审查意见，拿回来自己整合——这是 agent-as-tool。

误用这两种模式会产生两种典型故障：该 handoff 时用了 agent-as-tool，专家看不到完整对话，只能凭一段摘要作答；该 agent-as-tool 时用了 handoff，控制权在多个 agent 间来回弹跳，没有人对整体交付负责。

### 5.4 Message board：共享状态本身就是通信

第三条通道是 message board：agent 不直接对话，而是往一个共享的板子上写，别人来读。课件的三个例子是 MetaGPT（Hong et al., 2024）的 shared message pool、OpenAI Swarm，以及 MoltBook——一个给 agent 用的「社交网络」式留言板。

Message board 的价值在于**解耦**：写的人不必知道谁会读，读的人不必在线。代价也在同一处——没有回执。写的人无法确认信息被理解，读的人无法确认信息是最新的，于是「信息是否被消费」只能靠约定或额外的状态跟踪来保证。

### 5.5 协议：A2A

<SlideFigure lecture="08" page="46" caption="Slide 46 · Agent2Agent（A2A）协议的位置：两个 agent 之间通过 A2A 通信，各自通过 MCP 连接工具与数据（数据库、Web API、文件系统、GitHub 等）"></SlideFigure>

A2A 是 Google 提出的 agent 间通信协议，课件把它类比成 MCP：MCP 标准化「agent 怎么用工具」，A2A 标准化「agent 怎么找 agent、怎么发消息、怎么交换工件」。它的几个机制值得记住：

- **Agent Card**：描述远端 agent 的能力、技能、输入输出与认证方式——本质是一份可机读的能力清单。
- **Task**：客户端把请求派发成可追踪的 task，而不是一次无状态调用。
- **进度通知**：server 主动向 client 推送任务进度，双方可以在执行过程中来回传消息。
- **Artifact**：任务完成后，server 把产出的工件交回 client。

这四件事合起来回答了「跨组织调用」的最小需求：先发现（card），再追踪（task），再反馈（notification），再交付（artifact）。缺任何一件，多 agent 就只能在同一进程里靠共享内存凑合。

## 6. 协调基础设施

Slide 52 把协调拆成两半：**infrastructure**（task ledger、shared memory、worktree isolation）与 **patterns**（role division、resource division、negotiation）。前者是工具，后者是约定。这一节讲工具。

### 6.1 Task ledger：让进度成为可读的对象

<SlideFigure lecture="08" page="54" caption="Slide 54 · Task Ledger 的四个作用：记录目标与当前计划及未决问题、记录分派与依赖进度与阻塞、用当前状态决定下一步跑什么、执行停滞时更新计划或重试"></SlideFigure>

Task ledger 是课件给的最朴素也最有效的机制：把「计划」和「执行状态」写成一份显式的、持续更新的账本。它做四件事——记录任务（目标、当前计划、未决问题）、记录执行（分派、依赖、进度、阻塞）、指导决策（用当前状态决定下一步）、支持恢复（停滞时改计划或重试）。

为什么它有效？因为 orchestrator 的上下文会被 worker 的产出淹没，而 ledger 是它的**压缩视图**：不必记住每条消息，只要读账本就知道哪里卡住了。Magentic-One（Fourney et al., 2024）正是这么做的——orchestrator 同时维护 task ledger 与 progress ledger，前者存事实与计划，后者存「已尝试什么、还差什么」。

代价是维护成本与失真风险：ledger 必须有人更新，而更新它的是模型；账本一旦和真实状态脱节，后面的所有决策都建立在错误前提上。这也是为什么好用的 ledger 往往配一个机械化的更新触发条件（每完成一步就写），而不是靠模型自觉。

### 6.2 Shared memory：经验要能被下一个会话读到

<SlideFigure lecture="08" page="58" caption="Slide 58 · G-Memory 的三层图结构：Insight Graph 从经验中抽象出可泛化的洞见、Query Graph 记录任务查询及其关系、Interaction Graph 保存 agent 之间的原始交互日志"></SlideFigure>

G-Memory（Zhang et al., 2025）把多 agent 的记忆拆成三层：**insight graph**（从经验抽象出的可泛化洞见）、**query graph**（任务查询与它们之间的关系）、**interaction graph**（agent 之间的原始日志）。三者读写路径不同：交互日志是原始证据，查询图是索引，洞见图是提炼后的可复用结论。

这正好对应第 7 讲讲过的记忆三问：写什么、怎么组织、怎么取。多 agent 场景多了一层麻烦——**记忆是共享的**，写的人与读的人不是同一个角色。于是「谁写的、针对什么任务、在什么前提下成立」必须一起存下来，否则下一个 agent 会把一次特例当成通用规律。

课件给的结果是：为多 agent 定制的记忆结构优于为单 agent 设计的基线。这句话的分量不在分数，而在方向——**多 agent 的记忆不是单 agent 记忆的放大版**，需要不同的组织方式。

### 6.3 Worktree isolation：先隔离，再合并

<SlideFigure lecture="08" page="63" caption="Slide 63 · Worktree 隔离：同一仓库分出 main、bugfix、feature 等独立工作树，每个 agent 在自己的签出与分支上改，再合并回主干"></SlideFigure>

问题陈述很直接：**多个 agent 编辑同一个工作目录**。于是改动互相覆盖、测试互相干扰、谁改坏了说不清。解法也是现成的工程手段：

- **Separate workspaces**：给每个 agent 自己的 checkout 与 branch；
- **Controlled integration**：合并已完成的贡献，解决冲突，测试合并后的结果。

课件明确写了代价：隔离减少执行期的相互干扰，但**改动会分叉，制造集成工作**。这是多 agent 工程里最古老的一课——并行把冲突从「执行时」推到了「合并时」，总量不一定减少，只是变得可控、可排期。

工程上还要补一句课件没写但隐含的：worktree 隔离只对「文件系统是共享资源」的任务有意义。对共享数据库、共享 API 配额、共享外部服务的任务，需要的是资源划分（下一节），而不是分支。

## 7. 协调模式：没有中心时的契约

三项模式都来自 CooperBench（Khatua et al., 2026）的观察，本质是「agent 在没有中心调度时自己达成的约定」：

| 模式 | 一句话 | 走偏时的表现（推论） |
|---|---|---|
| Role Division | agent 商定谁负责任务的哪一部分 | 两人都以为对方在做，或者都做了同一块 |
| Resource Division | 划分共享资源以避免碰撞 | 两边同时改同一段代码，后写的覆盖先写的 |
| Negotiation | 对冲突方案协商，收敛到一个计划 | 谁也说服不了谁，或以「谁先写完算谁的」收场 |

这三种模式的共同前提是**通信通道可用且可信**。角色划分需要读到对方的意图，资源划分需要看到对方的占用，协商需要来回若干轮。所以协调模式的成本不在模式本身，而在它依赖的通信量——这也是为什么第 4 节的成本表里，通信开销是主项。

第三列是本讲按第 8 节的失效分类做的推论，课件只给了三种模式的定义。还有第四种收场方式要到第 8 节才出现，但值得提前提一句：协商失败时，agent 未必停下。

## 8. 失败模式：为什么多 agent 会失败

### 8.1 三类根因

<SlideFigure lecture="08" page="72" caption="Slide 72 · MAST 失效分类：System Design Issues 44.2%、Inter-Agent Misalignment 32.3%、Task Verification 23.5%，共 14 种失效模式，横轴按 pre-execution / execution / post-execution 排布"></SlideFigure>

Cemri et al.（2025）的做法是先收集大量多 agent 轨迹，再把失败整理成分类学（MAST）。Slide 72 的结果是三类、14 种模式：

- **System Design Issues（44.2%）**：Disobey Task Specification、Disobey Role Specification、Step Repetition、Loss of Conversation History、Unaware of Termination Conditions。这些全是**设计问题**——角色没写清、终止条件没定义、历史被截断。
- **Inter-Agent Misalignment（32.3%）**：Conversation Reset、Fail to Ask for Clarification、Task Derailment、Information Withholding、Ignored Other Agent's Input、Reasoning-Action Mismatch。这些是**交互问题**——信息没传到位，或者传到了没被采信。
- **Task Verification（23.5%）**：Premature Termination、No or Incomplete Verification、Incorrect Verification。这些是**验收问题**——没人检查，或者检查错了。

这个分布最值得注意的地方是：**占比最高的两类都不是「模型不够聪明」**。Disobey Role Specification 是提示没写清，Step Repetition 是没有状态跟踪，Unaware of Termination Conditions 是没有停止条件。它们全都能靠工程手段修，而且修起来比换模型便宜。

### 8.2 协调的诅咒

<SlideFigure lecture="08" page="75" caption="Slide 75 · CooperBench 的对比：随着相对难度上升，单 agent 同时做两个任务（solo）与两个 agent 协作（coop）的成功率都下降，而协作曲线整体更低"></SlideFigure>

CooperBench（Khatua et al., 2026）的设定很干净：600 个协作式编码任务，覆盖 12 个库、4 种编程语言。每个任务被拆成两半，可以交给一个 agent 顺序做，也可以交给两个 agent 协作做——两者用的模型相同，区别只在是否分工。

结论写在 Slide 75 上：**单 agent 同时做两个任务，比协调两个 agent 更好**。两条曲线都随相对难度下降，但协作那条始终更低——也就是说，协调成本不是一个固定税，难度越高，税越重。

这个结果需要正确解读：它不证明「多 agent 永远更差」，而是证明**当两个子任务耦合到必须共享同一份状态时，拆开的收益是负的**。它正好是 Slide 14 左列条件（steps highly dependent、tightly coupled to shared state）的实验版。

### 8.3 行为问题：趋同与用强

<SlideFigure lecture="08" page="80" caption="Slide 80 · 不相容目标下的收场方式统计：灰为 not settled、红为 settled by force、黄为 settled by persuasion、蓝为 settled by truce；其中两个模型有 61% 与 60% 的回合以「用强」结束，另有 39% 与 40% 干脆没有解决"></SlideFigure>

Zou（2026）的报告记录了更棘手的一类现象，它们不是效率问题，而是行为问题：

- **Conformity（Slide 78）**：让一群 agent 各自独立做一个「令人印象深刻」的东西，超过一半的 agent 选择去做 ray tracer 或 self-hosting compiler。多样性在最需要它的地方消失了——这不是模仿，而是同一种先验在同一批模型上同时生效。
- **Incompatible Goals（Slide 79–81）**：给每个模型同一个迁移任务，但目标语言不同（Python 对 Rust）。结果如 Slide 80 所示，在部分模型上 60% 左右的回合以 **settled by force** 结束，另有近四成根本没有解决。

「用强」在这里的具体含义是：一方直接覆盖或销毁另一方的产物，让事实既成。它之所以值得单独记住，是因为它**在任务成功率上可能是被掩盖的**——如果只看「有没有部署成功」，一方用强也算成功。这与第 1 讲讲过的「任务成功不等于安全」是同一类盲区。

Slide 82 把失败收成三句：general failures（system design、inter-agent、verification）、coordination failures（expectation、commitment、communication）、behavioral failures（lack of diversity、hostile conflict resolution）。第三类最难修，因为它不是 bug，而是策略在特定激励下的合理反应。

## 9. 案例：用并行 Claude 造一个 C 编译器

<SlideFigure lecture="08" page="87" caption="Slide 87 · 案例中的协作循环：从 Git 同步的 task 目录里 claim task，本地实现并测试，pull/merge/push 后 release claim；claim 冲突时改选别的任务；新会话先读 README 与进度文件"></SlideFigure>

课件收尾给的是 Anthropic 的工程记录（Carlini, 2026）：用 agent team 造一个 C 编译器，人基本走开。它之所以适合收尾，是因为它把本讲的所有机制都落到了具体实现上。

**编排是无限循环的 swarm（Slide 85）**：一个 `while true` 的 bash 脚本反复起新的 Claude 进程，每个进程读同一份 `agent_PROMPT.md`，日志按 commit 命名。没有 orchestrator 做中心调度，编排靠脚本与文件系统。

**协调靠 Git 上的 task 目录（Slide 87）**：流程是 claim task → 本地实现与测试 → pull/merge/push → release claim；遇到 claim 冲突就换一个任务。进度写在 README 与 progress 文件里，新会话先读它——这就是上一节的 task ledger 与 shared memory，只不过存储介质是仓库。

**隔离靠 Git worktree 与容器（Slide 88）**：一个 shared bare repository 作为上游，每个容器里跑一个 agent，各自有本地 clone 与 `/workspace`，通过 pull/push 交换。这正是第 6.3 节的机制：先隔离，再合并。

Slide 89 的六条经验可以直接当作多 agent 系统的检查表：

| 经验 | 它在修哪个失效模式 |
|---|---|
| Strong tests guide autonomous work：可靠的正确性/回归测试让 agent 认出进展、抓住破坏 | No or Incomplete Verification（23.5%） |
| Design for parallelism：把可分离的失败或子任务暴露出来 | 让并行真的成立，而不是硬拆 |
| Make coordination explicit：claim 任务、独立 clone、通过 Git 集成 | Conflicting Actions、Step Repetition |
| Preserve knowledge across sessions：共享文档、进度笔记、失败方案的记录 | Loss of Conversation History |
| Make feedback efficient：精简的错误摘要、可搜索日志、快速测试子集、定期进度更新 | Context 膨胀与调试成本 |
| Assign complementary goals：给 agent 不同的职责 | Conformity（趋同） |

这六条没有一条在讲模型。它们讲的是**测试、拆分、契约、记录、反馈、分工**——本讲的全部结论可以压缩成一句：多 agent 的成败取决于你为协调搭了多少基础设施，而不取决于你有多少个 agent。

## 延伸阅读

- Kim et al., [Towards a Science of Scaling Agent Systems](https://arxiv.org/pdf/2512.08296), 2026（Slide 13/22/23/24 的复杂度对照与成本数据）。
- Liu et al., [DyLAN](https://arxiv.org/pdf/2310.02170), 2023（动态组队、agent importance score 与提前停止）。
- Wu et al., [AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversations](https://arxiv.org/pdf/2308.08155), 2024。
- Hong et al., [MetaGPT](https://openreview.net/pdf?id=VtmBAGCN7o), 2024（shared message pool、SOP 与结构化消息）。
- Fourney et al., [Magentic-One](https://arxiv.org/pdf/2411.04468), 2024（task ledger 与 progress ledger）。
- Zhang et al., [G-Memory](https://arxiv.org/pdf/2506.07398), 2025（insight / query / interaction 三张图）。
- Khatua et al., [CooperBench](https://arxiv.org/pdf/2601.13295), 2026（600 个协作任务、协调的诅咒、三种协调模式）。
- Cemri et al., [Why Do Multi-Agent Systems Fail?](https://arxiv.org/pdf/2503.13657), 2025（MAST 分类学）。
- Zou, [Patterns and Problems in Emerging Multi-Agent Systems](https://arxiv.org/pdf/2510.01171), 2026（趋同与不相容目标）。
- Anthropic, [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler), 2026-02-05。
- Anthropic, [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)（四种拓扑的图源）。
- [Agent2Agent (A2A) 协议](https://a2a-protocol.org)（agent card、task、artifact）。

## 自测

**1. 一个团队把单 agent 的成功率从 62% 提到 71%，方法是从 1 个 agent 换成 4 个 agent 的 swarm。你应该先问哪三个问题？**

<details>
<summary>答案</summary>

第一，基线与拓扑是什么：Slide 13 显示同一底座模型换拓扑，符号可以从 +12.3% 翻到 -7.2%，所以必须固定骨架再比。第二，成本变了多少：Slide 24 的顺序是 Single Agent < Orchestrated < Swarms，要给出每次任务的钱与时延，而不只是成功率。第三，瓶颈是否被测量过：只有「可分离的子任务、可切分的上下文、独立可集成的贡献」才支持拆成 4 个（Slide 14），否则提升可能来自多次采样而非协作，用 independent + 投票就能复现。

</details>

**2. Handoff 与 agent-as-tool 的选择依据是什么？各会出什么故障？**

<details>
<summary>答案</summary>

依据是控制权与上下文归属：handoff 把控制权交给接收方，上下文随之前送，接收方直接对用户负责；agent-as-tool 由调用方保留控制权，只发一个有边界的请求和选定上下文，接收方回一件工件。该 handoff 却用了 tool，专家拿不到完整对话；该 tool 却用了 handoff，控制权来回弹跳，没有人对整体交付负责。

</details>

**3. 为什么「加一个共享群聊频道」不能解决协调问题？**

<details>
<summary>答案</summary>

因为通信与协调是两件事（Slide 31/51）：通信解决「谁收到什么、走哪个通道」，协调解决「谁拥有哪个任务、什么必须先做、冲突怎么办」。频道只让信息流动，不产生所有权与依赖顺序，也不解决冲突。真正的协调要靠 task ledger（进度与依赖可见）、worktree 隔离（改动物理分开）与显式契约（role/resource division、negotiation），这些都不在消息通道里。

</details>
