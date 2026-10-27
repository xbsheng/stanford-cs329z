---
title: "6 · 设计模式与 Scaffold"
description: "Stanford CS329Z 第六讲：从 Fowler 的「模式是半成品」出发，梳理五种 workflow 模式、ReAct 与 Reflexion 等推理行动模式、事件日志与压缩等上下文管理模式，以及 Pi 的设计取舍。"
outline: [2, 3]
---

# 6 · 设计模式与 Scaffold

<div class="meta-card">
<p><strong>2026-10-12 · Diyi Yang、Michael Ryan、John Yang · 86 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture06.pdf" target="_blank" rel="noreferrer">lecture06.pdf</a></p>
<p>课程位置：第 4 周 · 框架与设计；承接上一讲的框架与编排，这一讲给出一套可以互相拼装的部件。</p>
</div>

<SlideFigure lecture="06" page="1" caption="Slide 1 · 课程标题页：Agent Design Patterns and Scaffolds"></SlideFigure>

## 本讲速览

- **模式是半成品，不是模板。** 它给的是结构名称与适用条件，落地时必须按自己的环境改写，这一点决定了本讲的性质。
- **控制流归属决定架构。** 步骤能预先枚举就用 workflow，随观测变化才交给 agent；真实系统多数是两者的混合。
- **五种 workflow 模式是积木。** prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer 可以互相嵌套，STORM 就是四层拼装。
- **推理模式的价值在「先想再动」。** ReAct 的收益来自动作前的思考；Reflexion 的收益来自把外部反馈写成记忆，而不是让模型自评。
- **动作的形式会影响效率。** CodeAct 把动作写成代码，成功率更高、轮次更少；ReWOO 与 LLMCompiler 把计划提前，用更少的 token 换更稳的执行。
- **上下文管理只有两条原则。** 保持聚焦、保持连续；event log、memory offloading、compaction、observation masking、context isolation 是这两条原则的不同折中。
- **Pi 把「少」当成设计决策。** 四个工具、树状上下文、没有权限检查——每一处省略都换来可组合性，也换来风险。

## 1. 模式是半成品

这一讲的题眼在第 4 页，只有一句话：

> Patterns are half-baked—meaning you always have to finish them yourself and adapt them to your own environment.
>
> —— Martin Fowler，《Patterns of Enterprise Application Architecture》

<SlideFigure lecture="06" page="4" caption="Slide 4 · Martin Fowler 的引语：模式是「半成品」，必须由使用者补完并适配自己的环境"></SlideFigure>

这句话解释了为什么这一讲不讲「最佳实践」。设计模式源自 GoF 的《Design Patterns》（第 3 页放了封面和 Singleton 的例子），它把反复出现的结构命名，让工程师用一个词交换一段设计讨论。命名的好处是沟通成本下降；代价是**名字容易被当成答案**。Singleton 在课件里只是个示例：代码只有几行，真正难的是判断「这个全局状态该不该存在」。

对 agent 系统，这层落差更大。传统模式描述类与对象的关系，关系在编译期就固定；agent 的模式描述的是**模型、程序与上下文之间的责任分配**，而模型的行为每次调用都可能不同。所以同一个 orchestrator-workers，在一个团队里是三个写死的 worker，在另一个团队里是动态生成的子 agent，两者都叫这个名字。

照搬模式通常有两种失败方式。一种是抄拓扑：看到 orchestrator-workers 就搭一个调度器，却没检查自己的子任务是否真的无法预判；另一种是只抄名词：把「evaluator-optimizer」写进设计文档，但评估者给出的反馈是「请改进」，生成者无从下手。两种失败都不是理解错了定义，而是跳过了「这个结构的成立条件在我这里是否满足」。

本讲的目标也因此写得很克制（第 6 页）：定义 workflow 与 agent 的常见模式、比较上下文管理策略、分析一个生产 harness（Pi）里的设计决策。三条都是「辨认与分析」，没有一条是「照做」。

## 2. 回顾：控制流在哪里

第 9 页把系统排成一条光谱：一端是「模型只占系统一小部分」，中间是「逻辑与编排都在程序里」，另一端是「控制流由模型决定」。

<SlideFigure lecture="06" page="10" caption="Slide 10 · 横轴 agency、纵轴 predictability：workflow 可预测，agent 更灵活，代价与收益都来自控制流的归属"></SlideFigure>

第 10 页给这张图配了两句判断：workflow 可预测，因为分支、路由与循环都写在代码里；agent 更灵活，因为下一步由模型看着观测决定。课件没有说哪一端更好，只说两者适用于不同的任务形状。

<SlideFigure lecture="06" page="12" caption="Slide 12 · Workflows vs Agents 对照表：控制流、适配方式、最佳适用与示例四行，末句提醒真实系统常常混用两者"></SlideFigure>

第 12 页把差异落到四个维度：

| 维度 | Workflow | Agent |
|---|---|---|
| Control flow | 代码 | LLM |
| Adaptation | 预先写好的分支、路由与循环 | 依据观测选择下一步 |
| Best fit | 结构清晰、可重复的任务 | 需要探索与灵活判断的任务 |
| Example | 分类工单 → 检索政策 → 起草回复 | 用工具调查并解决工单 |

值得注意的是最后一行：两个例子的业务目标相同，差别只在「谁来拆步骤」。这句话反过来也成立——**当步骤可以被枚举时，用 agent 就是为一个已知流程支付不确定性成本**。第 12 页底部那句 "Real systems often combine workflows and agents" 是这一讲后面所有案例的伏笔。

第 11 页用两张图把这个差别画得更具体：左边是 graph 形式的 workflow——`__start__` → `extract` → `pick_emoji` → `add_to_calendar` → `__end__`，每个节点是一个函数，边的走向在部署前就确定；右边是 agent——`__start__` → `model`，模型再从 `tools` 与 `__end__` 之间选一个。

这两张图放在一起，能看出三处工程差异：

- **可测试性。** 左边每个节点可以单独跑单测，右边只能对整条轨迹做端到端评测。
- **失败恢复。** 左边失败时知道停在哪一步，右边失败时要读 trace 才能定位。
- **适配范围。** 左边换个日历服务只改一个节点，右边换个工具可能要重写提示与工具描述。

这三条差异解释了 workflow 在工程上的位置：它的价值不是更强，而是失败更便宜。

## 3. 五种 workflow 模式

第 15 页一次列完五种，定义都很短。把它们和代价放在一起看，比单看定义有用：

| 模式 | 机制 | 主要代价 |
|---|---|---|
| Prompt Chaining | 拆成串行小步，前一步输出是后一步输入 | 延迟线性增长，错误沿链条传递 |
| Routing | 先分类，再交给合适的模型或提示 | 分类器会错，错路由比多调一次更贵 |
| Parallelization | 同一输入分多路（sectioning）或重复多次（voting），再聚合 | token 成倍，聚合逻辑成为新的失败点 |
| Orchestrator-Workers | 一个 LLM 动态拆解任务并派发给 worker | 拆解质量不可控，子任务依赖容易漏 |
| Evaluator-Optimizer | 生成者产出，评估者反馈，循环迭代 | 需要可表达的标准与能改进的生成者 |

**Prompt Chaining**（第 16 页）的链条上有一个 Gate：输出不合格就走 Exit，而不是硬着头皮往下传。这说明 chaining 的准确率收益来自「每步只做一件小事」，前提是**每一步都能被检查**。代价课件写得很直接：trades off latency for accuracy。

<SlideFigure lecture="06" page="16" caption="Slide 16 · Prompt Chaining：LLM Call 1 → Gate（Pass 继续、Fail 退出）→ LLM Call 2 → LLM Call 3，用延迟换准确率"></SlideFigure>

**Routing**（第 17 页）的分类依据可以是主题、难度或风险。课件特意点了省钱用法：简单请求走弱模型。这条用法的隐含成本是**分类错误的非对称性**——把难题误判成简单题，比反过来贵得多。

**Parallelization**（第 18 页）有两种形态，要分清。Sectioning 把独立子任务拆开并行（一边判断 query 是否安全、一边处理 query）；Voting 是同一输入跑多次，由 aggregator 汇总。前者省时间，后者买稳健性，代价都是 token 翻倍。

**Orchestrator-Workers**（第 19 页）与 parallelization 的差别只在「子任务何时确定」：前者的分支由 LLM 现场生成，后者写死在代码里。课件说它适用于「难以预判子任务的性质与数量」的场景——这正好是 agent 的适用条件，所以这个模式已经站在两者的边界上。

**Evaluator-Optimizer**（第 20 页）给了两个必要条件：反馈必须清晰可表达，且 LLM 有能力给出这种反馈；此外生成者要能根据反馈改进。三条缺一条，循环就退化成重复采样。

<SlideFigure lecture="06" page="20" caption="Slide 20 · Evaluator-Optimizer：Generator 产出 Solution，Evaluator 给 Rejected + Feedback 或 Accepted，形成回路"></SlideFigure>

第 30 页的小结只有一句判断值得记住：**workflow 比 agent 更容易复现和调试**。原因不是 workflow 更聪明，而是每个分支都能被单独测试。

这句话还有一层工程含义。workflow 的模式名描述的是**拓扑**（串行、分支、扇出、回路），所以换模型不会改变拓扑；agent 的模式名描述的是**职责分配**（谁决定下一步、谁提供反馈），换模型可能改变行为。前者可以画成静态图，后者只能画成状态转移的草图。课件把五种模式画成同一套视觉语言（绿框是 LLM 调用，紫框是程序逻辑），正是为了让拓扑一眼可读。

嵌套时还有一条顺序经验：**便宜的分支放在前面，贵的回路放在后面**。典型的组合是入口先 routing（省掉大部分昂贵调用），再用 chaining 把剩下的任务拆细，末端用 evaluator-optimizer 只处理「质量可判定」的那一小段。反过来先跑回路、再路由，等于把最贵的计算花在了还没分类的请求上。

## 4. 组合：STORM 与 Archon

第 21 页只有一句话：真实系统是这些基本模式的组合。

<SlideFigure lecture="06" page="24" caption="Slide 24 · STORM 的流程被同时标注为 Orchestrator-Workers、约等于 Evaluator-Optimizer、Prompt Chaining 与 Parallelization，说明模式是阅读系统的分层视角"></SlideFigure>

第 24 页的 STORM 把这句话画了出来。用户给一个主题，系统先做多视角调研（orchestrator-workers，课件注明「在这个例子里接近 parallelization」），再对每个视角做「读与问」的迭代（约等于 evaluator-optimizer），然后拆查询、检索、综合（parallelization），末端生成大纲与全文（prompt chaining）。四类标注叠在同一张图上——**模式是阅读系统时的分层视角，不是系统本身的边界**。

第 25 页给了这套组合的效果：ROUGE-1 45.82、ROUGE-L 16.70、Entity Recall 14.10，逐项高于 Direct Gen、RAG 与 oRAG 三个基线；去掉大纲阶段（w/o Outline Stage）后各项明显回落。这组数字支撑的判断很有限但很重要——**组合的收益来自某个具体阶段，而不是「模式越多越好」**，去掉哪一层要能被实验指认出来。

Archon（第 26–29 页）走得更远：它把 inference-time technique 当成可搜索的算子——generator、fuser、critic、ranker、verifier、unit test generator、unit test evaluator——每个算子标注输入、输出与推理成本，再在 benchmark、调用预算与可用模型的约束下搜出一套架构。第 27 页的表格值得看一眼：光「验证」一件事就有 ranker、verifier、unit test 三种做法，成本各不相同。

这条路线说明模式库的另一种用法：**当模式足够多时，选模式本身可以变成一个优化问题**。代价是搜索需要 benchmark 和调用预算，而且搜出来的架构只对那一类任务成立。

组合的难点不在拼装，而在接口。两个模式接在一起时，前一段的输出必须正好是后一段能吃的输入：STORM 里「视角」要能被后续检索直接使用，Archon 里每个算子的输出类型必须与下一个算子的输入声明匹配。接口不匹配时，团队通常会加一段「胶水提示」把格式转过去，这段胶水既不进入任何模式的描述，也很少被测到，却经常是错误最集中的地方。所以读一个复合系统时，除了认出模式，还要问一句：**模式之间的接缝在哪里，接缝由谁负责**。

## 5. 推理与行动：ReAct 与 Reflexion

第 32 页把这一节的问题说清楚了：除了工具本身，还要设计 **LLM 如何推理、如何与环境交互**。

<SlideFigure lecture="06" page="36" caption="Slide 36 · ReAct 的推理收益：PaLM-540B 上 HotpotQA EM 25.7 → 27.4，Fever 准确率 58.9 → 60.9，思考写在动作之前"></SlideFigure>

ReAct（第 33 页）的核心只有一句：reason before taking actions。第 36 页用 PaLM-540B 的对比说明这不是风格问题：HotpotQA 上 Act 的 EM 是 25.7、ReAct 是 27.4；Fever 上准确率 58.9 对 60.9。差距不大，但方向一致——**把思考写进轨迹，动作的质量会提高**。

第 35 页补了一个常被忽略的事实：原论文为了最好效果做了微调；而今天「把模型微调成 agent」已经是 post-training 的常规做法。这句话把 ReAct 从「提示技巧」挪到了「训练目标」的位置，也解释了为什么「先想再动」现在看起来像模型的默认行为。

<SlideFigure lecture="06" page="38" caption="Slide 38 · Reflexion 的算法骨架：Actor 产生轨迹，Evaluator 打分，Self-Reflection 写出反思文本并存入 memory，下一轮读回"></SlideFigure>

Reflexion（第 37–40 页）在循环外再加一层：actor 产生轨迹，evaluator 打分，self-reflection 模型把失败轨迹写成文字，存进 memory，下一轮读回来。第 38 页的伪代码里，memory 是唯一的跨轮状态；第 40 页的结论是「提升来自反思文本，而不只是重放过去的轨迹」。

但第 41 页给这条路线泼了冷水，引用的是「LLM 还不能自我纠正推理」那篇工作：**让 LLM 评估自己的回答，表现反而下降**。Reflexion 能成立，是因为它的反馈来自外部环境（任务是否通过、测试是否报错），而不是模型对自己的印象。课件还补了两句时间线：这个发现早于 reasoning 模型；今天自我反思多半内建在模型的推理过程里，不再显式外挂。

<SlideFigure lecture="06" page="41" caption="Slide 41 · 自我反思的局限：GPT-4 Turbo 上多种自评提示反而低于标准提示；Reflexion 靠外部环境反馈绕开这一点"></SlideFigure>

顺着这个逻辑，第 42 页的 CRITIC 做的事就顺理成章：给 verifier 接上外部工具（知识库、代码解释器、搜索），把「自评」换成「查证」。课件的一句话总结是 make an agentic verifier——**验证本身也可以是一个 agent**。

把三种设计并排看，差别在「反馈从哪来」：

| 设计 | 状态载体 | 反馈来源 | 失效方式 |
|---|---|---|---|
| ReAct | 轨迹本身（单次尝试内） | 环境观测 | 观测到了错误的证据 |
| Reflexion | 反思文本（memory） | 任务结果 / 外部评价 | 反思过度概括，下一轮照错 |
| CRITIC | 无（单轮内迭代） | 外部工具查证 | 工具本身查不到或查错 |

这张表解释了第 41 页为什么强调「外部」：三者里只有 Reflexion 的反馈可能退化成自评，而它一旦退化成自评，就落回被那篇论文批评的模式。工程上的推论是——**要么让反馈来自环境，要么给 verifier 接工具，不要只让模型看自己的答案**。

ReAct 的代价也要说清楚。思考写在轨迹里，意味着每一步都要多生成一段 token，延迟与成本都上升；思考本身也可能错，错的思考会把后续动作带偏，而且比错的动作更难发现——动作错了会被环境拒绝，思考错了不会。第 36 页那 1.7 个点的 EM 提升，换来的是更长的轨迹与更贵的推理，这条账要在自己的任务上重新算一遍。

## 6. 行动的形式与执行顺序

ReAct 只规定了「想—做」交替，没规定动作长什么样，也没规定何时执行。后面三个工作各补了一块。

<SlideFigure lecture="06" page="46" caption="Slide 46 · CodeAct 的对比实验：同一个模型下 code action 的成功率高于 JSON action，平均交互轮次更少"></SlideFigure>

**CodeAct**（第 43–46 页）让动作不再是 JSON 参数，而是一段可执行的 Python。第 44–45 页用同一个比价任务对照两种写法：JSON 动作要把查汇率、换算、比价拆成多次调用；代码动作可以写一个循环，把控制流放进代码里。第 46 页的结果是双重的——成功率更高，平均轮次更少。课件给的理由是 code as action 让控制流与数据流复用已有的软件基础设施。

代价不在幻灯片上，但很现实：代码动作要求执行环境可信、可回滚，并且错误信息要能被模型读懂；否则「少几轮」会变成「多几次重试」。

**ReWOO**（第 47–49 页）先规划出完整的「计划—变量」结构，再一次性执行，执行时不把观测回灌给规划器。第 47 页的关键判断是：**planning 让 agent 的动作执行重新变回 workflow**。计划一旦固定，执行阶段就可以并行、可以缓存，第 49 页的收益是更高的准确率与更少的 token。

**LLMCompiler**（第 50–52 页）在 ReWOO 的基础上加了两件事：并行执行与动态重规划。

<SlideFigure lecture="06" page="50" caption="Slide 50 · LLMCompiler：Function Calling Planner 产出 DAG of Tasks，Task Fetching Unit 按依赖派发，Executor 并行执行；相对 ReWOO 多了并行与动态重规划"></SlideFigure>

第 50 页的图里，planner 产出 DAG，task fetching unit 按依赖派发，executor 并行执行。这与 ReWOO 的差别正好对应真实系统的需求：计划赶不上变化时要能改。

第 54 页的回顾把这些线索收在一起：ReAct 的「先想再做」已成默认；Reflexion 的自我反思被吸收进模型的推理能力；CodeAct 说明代码是好动作格式；ReWOO 与 LLMCompiler 的「编译」思路今天主要以**并行工具调用**的形式存在，规划仍然重要；workflow 有时仍被用来编排 sub-agent。

四种设计放在同一张表里，差异会更清楚：

| 设计 | 动作形式 | 执行顺序 | 观测是否回灌 |
|---|---|---|---|
| ReAct | 工具调用（JSON 或文本） | 一次一步 | 是，逐步决定下一步 |
| CodeAct | 代码 | 一次一段，段内可循环 | 是，但段内自洽 |
| ReWOO | 计划里的变量引用 | 先计划、后批量执行 | 否，执行期不回灌 |
| LLMCompiler | DAG 节点 | 按依赖并行 | 部分，可动态重规划 |

从右往左看这张表，是一条**用前置规划换执行效率**的谱系：ReAct 最灵活、最贵；LLMCompiler 把并行与重规划都交给调度器，模型只负责出计划。第 54 页说「规划仍然重要」，指的正是这条谱系没有消失，只是被压缩进了并行工具调用里。

## 7. 上下文：两条原则

第 56 页在 agent 图里加了一个 Context Manager。第 57 页用一张对照图区分 prompt engineering 与 context engineering：前者优化一次请求的措辞，后者决定**每次调用时上下文窗口里放什么**。

这个部件的位置很关键：它夹在 agent 循环与模型调用之间，每次调用前决定「这一次给模型看什么」，调用后再把新事件写回存储。把它做成独立部件而不是散落在循环里，好处是上下文策略可以单独替换与单测；代价是多一层间接，调试时要同时看「真实历史」和「模型看到的历史」两份状态。

<SlideFigure lecture="06" page="59" caption="Slide 59 · 上下文工程的两条原则：Focus the Context（只留当前任务需要的）与 Preserve Continuity（保住目标、约束与进度）"></SlideFigure>

第 59 页只给了两条原则：

- **Focus the Context**：只保留当前任务需要的东西。完整历史不必都在窗口里；过多的信息就是 context bloat。
- **Preserve Continuity**：通过操纵上下文保住需求、目标、约束与进度。课件补了一句很工程的话——实践中这也意味着保住 KV Cache。

两条原则经常冲突：删得多就聚焦，但可能丢掉约束；留得多就连续，但注意力被稀释。第 61 页列出的五种模式，本质上是五种不同的折中方式。

「保住 KV Cache」这句附注值得单独解释。前缀缓存命中的前提是**前缀逐字节不变**，所以任何在上下文开头插入、删除或改写内容的操作，都会让缓存失效、整段重新预填充。这给上下文策略加了一条隐藏约束：

- 把易变信息放在末尾（新的观测），稳定信息放在开头（系统提示、工具 schema）；
- compaction 尽量发生在「一次任务结束」而不是每一步之间；
- observation masking 尽量只替换尾部、保留前缀，否则删改位置之后的缓存全部作废。

这条约束不是课件展开的重点，但它决定了「理论上更省的策略」在真实系统里是否真的更省。

<SlideFigure lecture="06" page="63" caption="Slide 63 · OpenHands 的事件日志：Event List → 过滤 → 按 response id 分组 → 转成 message → 重建 LLM 输入；日志只追加、不可变"></SlideFigure>

**Persistent Event Log**（第 62–63 页，OpenHands）：所有事件按发生顺序原样保存，日志只追加、不可变；每次调用 LLM 时从日志重建输入。好处有两个：真实历史不会被改写，外部观察者可以挂 hook 监控状态。代价是重建逻辑本身成为系统的一部分——过滤、分组、转换，每一步都可能出错，而错误只有在模型行为异常时才暴露。

**Memory Offloading**（第 64 页，MemGPT）：把知识写进 memory 或文件，从而允许把上下文里的对应部分裁掉。它把「记不住」换成「查得到」，代价是一次写入与一次检索，以及两者之间可能的不一致。

## 8. 压缩与隔离

<SlideFigure lecture="06" page="67" caption="Slide 67 · Observation Masking 与 LLM 摘要的对照：把旧观测换成 Mask 占位而不是改写内容，三种策略并排比较"></SlideFigure>

**Compaction**（第 65 页）让 LLM 把此前的 reasoning、action、observation 总结成更短的描述。它保留语义、牺牲细节；课件提到「压缩本身也可以是 agentic 的」——让模型决定压什么、留什么。

**Observation Masking**（第 66–68 页）不总结，直接截断旧观测。第 67 页把三种策略并排：raw agent、observation masking、LLM summary。它的优势是便宜且不引入总结误差，特别适合 coding agent——工具输出往往很长，而旧输出很少再被用到。代价是**截断不可逆**：某个细节后来需要，只能重新执行。

**Context Isolation**（第 69–70 页）用 subagent 处理特定子任务，只把结果放回主上下文。第 69 页的说法是 parallelize computation with isolated context windows；第 70 页的 progressive disclosure 是它的轻量版本——初始 prompt 里不必放全部工具与文档，需要时再披露（例如 skill files）。

第 71 页提醒这些策略全部兼容：可以先 offload 再 compact，可以既用 event log 又截断观测。第 73 页的 taxonomy 把它们归成四类动作——write、select、compress、isolate——这四类动作构成了后面记忆讲次的骨架。

把五种模式按代价排一下，选择就不再靠直觉：

| 模式 | 保真度 | 每次调用的额外成本 | 是否可逆 |
|---|---|---|---|
| Event log | 完整（日志层） | 重建与转换 | 是 |
| Memory offloading | 取决于写入内容 | 一次写、一次检索 | 部分（写漏就找不回） |
| Compaction | 语义保留、细节丢失 | 一次总结调用 | 否 |
| Observation masking | 只保留占位 | 几乎为零 | 否 |
| Context isolation | 子任务内完整、主上下文只剩结论 | 一次子 agent 调用 | 是 |

「是否可逆」这一列最容易被忽略。event log 与 isolation 可以反悔：需要细节时回到日志或子 agent 的轨迹；compaction 与 masking 不能，它们把信息换成了空间。所以稳妥的顺序是**先用可逆的手段压，压不下去再用不可逆的**。

压缩的对象也需要区分。推理文本通常可以大幅压缩，因为它服务的是「当前决策」，决策做完就过期；工具观测则要谨慎，因为它可能包含后续要引用的原文、行号或报错。Observation masking 之所以在 coding agent 上有效，恰恰因为旧观测里**可复用的部分很少**；换到需要反复引用同一份文档的任务上，同样的策略会把证据删掉，让 agent 只能重新读一遍。

## 9. 案例：Pi

<SlideFigure lecture="06" page="78" caption="Slide 78 · Pi 的设计哲学：极简 harness，按你的 workflow 改造它；同时列出它缺的五件事——sub-agents、权限检查、plan mode、todo list、后台 bash"></SlideFigure>

第 78 页先给立场：

> Pi is a minimal agent harness. Adapt Pi to your workflows, not the other way around.

然后是「缺什么」的清单：没有 sub-agents、没有权限检查、没有 plan mode、没有 agent to-do list、没有后台 bash。这份清单比功能列表更有信息量——它说明 Pi 把哪些职责留给了使用者。

四个设计决策值得逐条看。

先看这次选择背后的顺序：Pi 先定「不做什么」（第 78 页的清单），再定工具（第 79 页），再定循环与控制流（第 80 页），接着定上下文（第 81 页）。这个顺序和这一讲的展开顺序相反，但它符合工程直觉——**约束先定，实现后定**；先砍功能，剩下的部分才有可能做到极小。

**工具只留四个**（第 79 页）：read、bash、edit、write 默认启用，其余工具都是 bash 的子集。这是典型的最小动作空间选择：工具越少，模型选错的概率越低，schema 也越短。代价是 bash 成了万能入口，风险集中在一个工具上。

<SlideFigure lecture="06" page="80" caption="Slide 80 · Pi 的 agent loop：ReAct 风格的「先推理再发 JSON 工具调用」，上下文组织成树，可以回到之前的分支继续另一条线"></SlideFigure>

**循环是 ReAct 风格，上下文是树**（第 80 页）：推理后再发 JSON 工具调用；上下文组织成树，可以回到之前的分支继续另一条对话线。树状结构解决的是「试错后想回到岔路口」的问题，代价是分支管理、压缩与重建都要按树来做，比线性日志复杂。

**上下文靠三件事**（第 81 页）：event log 转 LLM 输入、skill files 做渐进披露、compaction 压缩。第 81 页的小图画出「LLM 看到什么」：system、summary 与若干 message，其中 summary 来自 compaction，其余从 firstKeptEntryId 之后取。

<SlideFigure lecture="06" page="82" caption="Slide 82 · Pi 的安全边界：以进程自身权限运行，没有权限弹窗，课件建议视其为「永远 auto 模式、没有任何保护」"></SlideFigure>

**没有安全边界**（第 82 页）：Pi 以进程自身的权限运行，没有弹窗确认，课件建议把它当作「永远在 auto 模式、没有任何保护」。这是一个明确取舍：权限交给外层（容器、沙箱、人类监督），harness 本身不承担这个职责。它成立的前提是使用者知道自己在跑什么。

第 83 页的回顾与上面一致：极简、社区扩展、四个默认工具、ReAct 风格、三种上下文手段、没有内建防护。

把「缺什么」和这一讲的模式对上，会发现每一项省略都能找到替代位置：

| Pi 缺少的 | 对应的模式 | 实际由谁承担 |
|---|---|---|
| No sub-agents | Context isolation | 外层编排，或社区扩展 |
| No permission checks | —（安全边界不在 harness 内） | 容器、沙箱、人类监督 |
| No plan mode | ReWOO 式的前置规划 | 使用者写进提示或 skill |
| No agent to-do lists | 计划作为外部工件 | 外部文件或扩展 |
| No bash in the background | 长任务执行 | 外层进程管理 |

这张表说明 Pi 的「缺」不是疏漏，而是**把责任推到 harness 之外**。代价很具体：默认配置下没有一层会替使用者兜底，误操作的半径等于进程权限；收益同样具体：核心小到可以读完，任何团队都能按自己的 workflow 加一层，而不必和框架的设计假设对抗。

## 10. 把模式当词汇表

这一讲没有给出「该用哪个」的答案，但留了几个可以反复使用的判断。

**控制流**。步骤能否在写代码时枚举？能，就把分支写进程序；不能，才让模型决定。第 12 页的两个例子说明，同一个业务目标可以有两种实现，选哪种取决于任务形状而不是团队偏好。

**失败代价**。workflow 的错误在代码里，可以单测；agent 的错误在轨迹里，只能看 trace。失败代价高的环节适合放在 workflow 里，探索性强的环节才交给 agent。

**上下文预算**。event log 保真但贵，compaction 省 token 但丢细节，masking 最便宜但不可逆，isolation 最干净但要多一次调用。这些手段可以叠加，叠加顺序决定了系统的行为。

这三个问题有一个共同点：**答案都不在模式里，而在你的任务、你的失败代价与你的预算里**。模式能做的只是把选项列全，让你知道自己放弃了什么。

标题里的 Scaffold 与正文里的 harness 指的是同一件事：模型之外、为了让任务跑完而搭起来的那层结构。这一讲给的是这层结构的词汇表——五种 workflow 拓扑、四种推理与行动设计、五种上下文策略；下一讲把这层结构里最容易膨胀的部分单独拿出来讲，也就是记忆。

Fowler 的那句话在这里重新变得具体：模式给的是「这里有一个结构性选择」，而不是「这样选是对的」。Pi 的极简、OpenHands 的日志、STORM 的四层组合，都是同一批模式在不同约束下的半成品。

## 延伸阅读

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)（五种 workflow 模式的出处，课件多张图引自这里）。
- Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。
- Anthropic, [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)（progressive disclosure 与 skill files）。
- LangChain, [Context engineering for agents](https://www.langchain.com/blog/context-engineering-for-agents)（write / select / compress / isolate 的分类）。
- LangChain, [How to think about agent frameworks](https://www.langchain.com/blog/how-to-think-about-agent-frameworks)（控制流与可预测性的讨论）。
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)。
- Shinn et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)。
- Huang et al., [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798)。
- Wang et al., [Executable Code Actions Elicit Better LLM Agents](https://arxiv.org/abs/2402.01030)（CodeAct）。
- Xu et al., [ReWOO: Decoupling Reasoning from Observations for Efficient Augmented Language Models](https://arxiv.org/abs/2305.18323)。
- Kim et al., [An LLM Compiler for Parallel Function Calling](https://arxiv.org/abs/2312.04511)。
- Shao et al., [Assisting in Writing Wikipedia-like Articles From Scratch with Large Language Models](https://arxiv.org/abs/2402.14207)（STORM）。
- [Archon: An Architecture Search Framework for Inference-Time Techniques](https://arxiv.org/abs/2409.15254)。
- [OpenHands: An Open Platform for AI Software Developers as Generalist Agents](https://arxiv.org/abs/2407.16741)。
- Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)。
- [arXiv:2508.21433](https://arxiv.org/abs/2508.21433)（observation masking 的对比实验）。
- [Pi 文档：compaction](https://pi.dev/docs/latest/compaction) 与 [CLI tools](https://pi.dev/docs/latest/cli#tools)。

## 自测

**1. Evaluator-Optimizer 为什么要求「反馈可表达」？如果反馈只有一句「不够好」会发生什么？**

<details>
<summary>答案</summary>

因为生成者必须能从反馈里推断下一步改什么。反馈不可表达时，模型只能重采样，循环退化为多次独立生成再加上挑选，成本上升而多样性下降。第 20 页把「清晰可表达的反馈」和「LLM 有能力给出这种反馈」列为两个必要条件，第 41 页的结论还补了第三条隐含条件：反馈最好来自外部环境，而不是模型自己。

</details>

**2. Reflexion 与「让模型评价自己」差在哪里？**

<details>
<summary>答案</summary>

差在反馈来源。Reflexion 的评价来自任务环境（是否通过、测试是否报错），反思文本只是把这份外部信号压缩成可复用的经验；而让模型直接评估自己的答案，第 41 页引用的工作显示表现反而下降。所以 Reflexion 的收益不能归给「自我反思」这个动作，要归给「外部反馈 + 记忆」。

</details>

**3. 事件日志让上下文可以「逐次重建」，相比直接维护一个 message 列表，多付出了什么？**

<details>
<summary>答案</summary>

多付出了一层转换逻辑：过滤、分组、格式转换都要在每次调用前跑一遍，任何一步出错都会让模型看到与真实历史不一致的输入。换来的是真实历史不可变、可按需裁剪、可挂外部观察者（第 63 页）。Pi 的第 81 页正是这个结构的实例：summary 加 firstKeptEntryId 之后的 message 一起构成「LLM 看到的世界」。

</details>
