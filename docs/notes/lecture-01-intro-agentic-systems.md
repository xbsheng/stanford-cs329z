---
title: "1 · 导论：什么是 Agentic 系统？"
description: "Stanford CS329Z 第一讲：agent 的历史与定义、五个部件（LLM core、推理、记忆、工具、环境）、ReAct 与 Reflexion 的机制、工作流与 agent 的分界，以及可靠性、训练、长程、安全与评测五类挑战。"
outline: [2, 3]
---

# 1 · 导论：什么是 Agentic 系统？

<div class="meta-card">
<p><strong>2026-09-23 · Diyi Yang、Michael Ryan、John Yang · 71 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture01.pdf" target="_blank" rel="noreferrer">lecture01.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 1 周 · 基础与全景；本讲交代定义、部件与整门课的地图。</p>
</div>

<SlideFigure lecture="01" page="1" caption="Slide 1 · 课程标题页：Intro to Agentic Systems"></SlideFigure>

## 本讲速览

- **课程定位是「工程」而不是「炼丹」。** CS329Z 站在 LLM 栈的最上层，讲模型之上的系统：检索、工具、记忆、编排、评测与优化。
- **Agent 的定义几十年没变，变的是执行器。** Russell & Norvig 的「通过传感器感知、通过执行器行动」今天依然成立，只是观测变成了文件、网页与工具返回，动作变成了 shell、编辑器和鼠标键盘。
- **一个 agent 有五个部件。** LLM core 负责决策，planning & reasoning 维护内部状态，memory 保存经验，tools 扩展动作空间，environment 提供观测与反馈。
- **推理的价值在于「把观测到动作的映射变简单」。** CoT 只推理不行动，ReAct 把推理与动作交替，Reflexion 把失败轨迹压缩成经验。
- **Agent 工程分三层：system、data、evals。** 三者缺一不可，而多数项目只做第一层，所以分数上不去、也讲不清为什么失败。
- **工作流与 agent 的分界是「谁决定下一步」。** 代码决定步骤就是 workflow，模型决定步骤就是 agent；两者都是 compound AI system。
- **五类挑战决定了这门课的后续章节。** 可靠性、训练、长程上下文、安全、评测——每一类都在后面的讲次里单独展开。

## 1. 这门课为什么存在

课件在第 5 页给了这门课的存在理由，只有两行：

> Both modeling and systems perspectives in the age of LLM agents.

做模型的人熟悉训练、提示、对齐与评测；做系统的人熟悉工具、API、环境与基础设施。而 2026 年真正能用的 agent，恰好要求两套知识同时在场：你得知道模型为什么会漏掉一条指令（这是模型问题），也得知道 harness 为什么没有在删除邮件前弹一个确认框（这是系统问题）。

课程因此把期望写得很明确：**基础讲座 + 动手构建与评测**。它不教你训练基座模型（那是 CS336 的地盘），而是教你如何在一个已有模型之上，把系统搭起来、把数据管起来、把评测做扎实。

<SlideFigure lecture="01" page="15" caption="Slide 15 · 一项针对 52 名工程师的随机对照实验：使用 AI 辅助的组在后测中低 17%，差距在调试环节最大"></SlideFigure>

第 15 页插进来的这项研究值得单独说一句。Shen & Tamkin（Anthropic, 2026）让 52 名工程师学习一个新的 Python 库，一组用 AI 辅助、一组不用，结果使用 AI 的一组在后续测验中得分低约 17%——差不多两个字母等级，而差距最明显的地方是 debugging。课件把这一页放在「怎么用 AI 学习」的语境里，态度很克制：**AI 可以加速产出，但会侵蚀你亲手调试的能力**。对一门以「造系统」为目标的课来说，这条警告尤其相关：如果 agent 帮你写完代码，你就失去了理解 harness 内部状态的机会。

## 2. 历史：从 ACTOR 到 AutoGPT

课件用 8 页讲完 agent 的四十年，节奏很快，但每一页都对应一种今天仍在使用的观念。

| 时间 | 事件 | 留下的观念 |
|---|---|---|
| 15 世纪 | 拉丁语 *agens*，「行动者」 | agent 的语义核心是「做」 |
| 1973 | Hewitt、Bishop、Steiger 的 ACTOR 形式化 | 并发实体通过消息协作 |
| 1980 | Contract Net Protocol | 任务可以被招标、分配、协商 |
| 1986 | Minsky《Society of Mind》 | 智能可以由多个简单部件涌现 |
| 1990s | Maes、Wooldridge & Jennings、Russell & Norvig | 自主性、社会性、反应性、主动性；感知–行动定义 |
| 1998–2015 | Sutton & Barto 的 RL 框架、DQN | 策略学习、奖励、探索 |
| 2020s | GPT-3 的 in-context learning | 不更新权重也能改变行为 |
| 2022 | MRKL、ReAct | 推理 + 工具调用的循环 |
| 2022–2023 | ChatGPT、GPT-4、BabyAGI、AutoGPT | 「agent」成为产品叙事 |

<SlideFigure lecture="01" page="21" caption="Slide 21 · 1990 年代的三条定义线：Maes 的自主 agent、Wooldridge & Jennings 的四性质、Russell & Norvig 的感知–行动定义"></SlideFigure>

有三点值得停下来看。

第一，**Wooldridge & Jennings（1995）的四性质**——autonomy、social ability、reactivity、proactivity——今天依然是评价 agent 的好框架。自主性对应「能不能自己决定下一步」，社会性对应「能不能和人或别的 agent 交换信息」，反应性对应「环境变了能不能改计划」，主动性对应「会不会在没人要求时发起行动」。后面讲多智能体与主动 agent 时，这四个词会反复出现。

第二，**Russell & Norvig（1995）的定义**把所有实现细节都抽象掉了：

> An agent is anything that can be viewed as perceiving its environment through sensors and acting upon that environment through actuators.

这个定义的好处是它不承诺 agent 是程序、是模型还是机器人；坏处是它太宽，宽到任何有反馈回路的系统都算。所以课件在 2022 年之后给它补了一个现代版本：**agent = LLM 在循环里**。模型负责在每一步决定动作，环境负责执行并返回观测，循环直到某个终止条件满足。

第三，**ReAct 出现的时间点**（2022 年 10 月）比 ChatGPT（11 月 30 日）还早，但直到 ChatGPT 之后 AutoGPT 才把「agent」变成大众词汇。这条时间线说明：一个研究想法要变成工程实践，需要底座模型的能力先跨过某个门槛。

<SlideFigure lecture="01" page="25" caption="Slide 25 · 「Agent」的爆发：ReAct（2022-10）、ChatGPT（2022-11-30）、GPT-4（2023-03-14）、BabyAGI（2023-03-28）、AutoGPT（2023-03-30）"></SlideFigure>

## 3. 解剖一个 Agent：五个部件

课件第 29 页用 ReAct 的一条轨迹做了最简洁的映射：

| ReAct 中的记号 | 对应的部件 |
|---|---|
| `the model` | LLM Core |
| `Think[…]` | Planning & Reasoning |
| `traces so far` | Memory |
| `Act:` | Tools |
| `Obs:` | Environment |

<SlideFigure lecture="01" page="30" caption="Slide 30 · Agent 的关键部件：LLM core 在中间，planning & reasoning、memory、tools 环绕，environment 通过 act/observe 交互"></SlideFigure>

把这张图拆开看：

- **LLM Core**：唯一真正「会思考」的部件。它把当前上下文映射成下一步动作的概率分布。注意它并不执行动作，只生成动作的表示。
- **Planning & Reasoning**：不是独立模块，而是模型产生的中间 token。它的作用是**更新 agent 自己的状态**——把「我看到什么」改写成「我打算怎么做」。
- **Memory**：此前的轨迹、检索到的知识、写下来的技能。它的边界由上下文窗口和外部存储共同决定。
- **Tools**：动作空间。检索、计算器、代码执行、搜索、文件读写——工具清单决定了 agent 能做什么，也决定了它能不能验证自己。
- **Environment**：真实世界的一侧。桌面、浏览器、数据库、游戏；它执行动作并返回观测，同时定义了「什么算成功」。

这里有个容易忽略的细节：图中 environment 是双向箭头（act / observe），而 tools 与 LLM core 之间是单向的（agent actions 向下）。这意味着**工具是环境的适配层**，不是环境本身；同一个环境可以通过不同的工具集暴露给模型，而工具集的选择会显著改变任务难度。这一点在第 4 讲会展开。

## 4. 推理：从内部状态到可执行的动作

课件给了推理的三层定义，值得逐字读：

- 对人类：演绎、类比、规划等心理过程；
- 对 LLM：模仿这些心理过程的中间生成；
- 对 agent：**更新 agent 自身状态的内部动作**。

第三层定义是关键。推理不是「想给用户看」，而是**把观测到动作的映射拆成可执行的中间步骤**。课件用一个做饭的例子说明为什么需要它：

> The dish should be savory, and since salt is out, I should find the soy sauce instead. It is in the cabinet to my right…

如果没有这段推理，模型要从「看到盐没了」直接映射到「打开右边柜子」——这是一个很难从数据里学到的跳跃。有了推理，这个跳跃被拆成「菜需要咸味 → 盐没了 → 找替代品 → 酱油在右边柜子」四步，每一步都更容易从语言模型的先验里得到支持。课件把好处总结为两点：**generalization**（把见过的模式迁移到新情境）与 **alignment**（让动作与目标一致）。

### 4.1 只推理不行动：CoT 与 Self-Consistency

<SlideFigure lecture="01" page="33" caption="Slide 33 · 推理与规划：对人类、对 LLM、对 agent 的三种定义"></SlideFigure>

CoT（chain-of-thought）让模型在给出答案前先生成一段推理。对 HotpotQA 这类多跳问题，CoT 能显著提升准确率，因为中间步骤把「多跳」变成了「多步」。但它有一个结构性缺陷：**推理过程完全依赖模型内部知识**，一旦记忆里的事实错了，再漂亮的推理也救不回来。

Self-Consistency（Wang et al., 2023）在此基础上做集成：用 CoT 采样多条不同的推理路径，再对最终答案投票。它的假设是「正确的推理路径会收敛到同一个答案」，代价是 token 成本线性增长。

### 4.2 推理并行动：ReAct

<SlideFigure lecture="01" page="36" caption="Slide 36 · ReAct 在 HotpotQA 上的轨迹：Thought → Act(Search) → Obs → 修正查询 → 再行动，最后 Finish"></SlideFigure>

ReAct 把动作插进推理链。第 36 页的轨迹值得逐步读：

1. `Thought 1`：我需要搜索 Apple Remote，找到它最初设计来控制的程序。
2. `Act 1: Search[Apple Remote]` → `Obs 1`：它是 2005 年发布的遥控器，最初用于 Front Row 媒体中心。
3. `Thought 2`：接下来要搜 Front Row，找还有什么设备能控制它。
4. `Act 2: Search[Front Row]` → `Obs 2`：没找到，返回了相似词条。
5. `Thought 3`：拼写或词条不对，改搜 `Front Row (software)`。
6. `Act 3` → `Obs 3`：Front Row 是一个已停止维护的媒体中心软件。
7. `Thought 4`：它由 Apple Remote 或键盘功能键控制，所以答案是功能键。
8. `Act 4: Finish[keyboard function keys]`。

注意第 4–5 步：**检索失败不是终止，而是新的观测**。模型看到「没找到」之后修改了查询，这是纯 CoT 做不到的。课件在下一页给出对比结论：ReAct 稳定优于只行动的 Act，而 CoT 的幻觉问题在 ReAct 中被外部证据部分缓解——但并没有被消除，只是把「编造事实」换成了「检索到错误事实」。

用形式化的语言写，ReAct 的轨迹是

$$
\tau_t = (o_1, a_1, o_2, a_2, \dots, o_t), \qquad a_t \sim \pi_\theta(\cdot \mid \tau_t),
$$

其中动作 $a_t$ 可以是 `Thought`（不改变环境）、`Act`（改变环境）或 `Finish`（结束循环）。**把「思考」也建模成动作**，是 ReAct 最重要的设计选择：它让推理和行动共享同一个接口，从而可以被同一套训练和评测流程处理。

### 4.3 反思：Reflexion

<SlideFigure lecture="01" page="39" caption="Slide 39 · Reflexion：agent 用自然语言反思任务反馈，把反思文本存进记忆，指导下一次尝试"></SlideFigure>

Reflexion（Shinn et al., 2023）在 ReAct 之外加了一个循环：任务失败后，agent 用自然语言总结「为什么失败」，把这段反思写进记忆，然后在下一轮尝试中读出来。课件强调它的作用是 **reduce error cases by distilling long, failed trajectories into relevant experiences**——把一条很长的失败轨迹压缩成几句可复用的「self-hints」。

这带来一个工程上的好处：反思文本是**可检查的**。你可以读它、改它、把它放进 prompt，而不必重新训练模型。第 7 讲会把这种「把经验写成外部工件」的思路扩展成完整的记忆架构。

### 4.4 多 agent 的两种用法

课件还提了两个多 agent 的早期用法：**multi-agent debate**（Du et al., 2023）让多个模型实例互相质疑，用分歧逼出更可靠的答案；**orchestrator** 模式（Magentic-One）让一个调度者把任务拆给专职 agent。这两种模式在第 8 讲会被系统化，这里只需要记住它们的动机：**用额外的计算换推理的稳健性**。

## 5. 记忆：三种内容，三种读写方式

<SlideFigure lecture="01" page="46" caption="Slide 46 · 按内容划分的三类记忆：episodic（经历）、semantic（知识）、procedural（技能）"></SlideFigure>

为什么需要记忆？课件给了两条理由，都很朴素：

1. **上下文窗口装不下所有事件流**。一个运行几天的 agent，轨迹长度远超任何窗口。
2. **即使装得下，也未必attend 得到**。无关历史会稀释注意力，让模型抓不住重点。

课件按**内容**把记忆分成三类（明确说明这是受人类长时记忆启发的一种分类，不是唯一分法）：

| 类型 | 存什么 | 怎么写 | 怎么读 | 代表工作 |
|---|---|---|---|---|
| Episodic | 经历、事件流 | 只追加的事件流 | 基于启发式分数检索 | Generative Agents |
| Semantic | 知识、结论 | LLM 对事件做推理后写入 | 检索 | — |
| Procedural | 技能、做法 | 写成代码 | 向量检索 | Voyager |

三类记忆的差别不只在内容，更在**写入成本**：episodic 几乎零成本（append-only），semantic 要跑一次 LLM 总结，procedural 要生成并验证代码。写入越贵，读的时候越省心——这是记忆系统设计的核心权衡，第 7 讲会展开。

## 6. 工具：让模型学会调用

<SlideFigure lecture="01" page="51" caption="Slide 51 · Toolformer：让模型自学「调哪个 API、什么时候调、传什么参数、怎么用结果」"></SlideFigure>

工具部分的两个代表工作：

- **Toolformer**（Schick et al., 2023）：给模型一批 API（计算器、问答、搜索、翻译、日历），让模型自己标注「在哪里插入调用、参数是什么」，再用这些自标注数据微调。它证明了**工具调用可以被学出来**，而不只是靠提示词。
- **Gorilla**（Patil et al., 2023）：把工具数量放大到数千个 API，训练模型检索并调用正确的 API。它面对的是 Toolformer 没解决的问题：**工具太多时，选择本身就成了检索问题**。

这两个工作共同指向第 4 讲的核心：工具调用不是一个魔法接口，而是**模型输出的一段结构化 token**，它的可靠性取决于训练数据、schema 设计与解码约束。

## 7. 三层结构：system、data、evals

课件第 55 页给了一个贯穿全课的划分：

> Despite many components, agent engineering can be divided into: the system (architecture design), the data (training examples, demonstrations, context), the evals (+ the metric).

这个划分值得当作整门课的索引：

| 层 | 关心什么 | 对应讲次 |
|---|---|---|
| System | 架构、循环、工具、记忆、编排 | 3–8 |
| Data | 演示、轨迹、合成数据、数据飞轮 | 第 6 周之后 |
| Evals | 任务、环境、停止条件、打分器 | 第 7–8 周 |

它同时解释了一个常见困惑：为什么很多 agent demo 很惊艳，做成产品却不行？因为 demo 只验证了 system 层，而产品需要 data 层（覆盖长尾）与 evals 层（知道什么时候算成功）。

## 8. 工作流与 Agent：谁决定步骤

<SlideFigure lecture="01" page="56" caption="Slide 56 · 工作流与 agent 都是 compound AI system，区别在于控制流由代码还是由模型决定"></SlideFigure>

课件用 Zaharia et al.（2024）的框架区分两者：

- **Workflow**：代码固定步骤。Agentless 把「定位 → 修复 → 验证」写死；AlphaCode 2 采样上百万个程序，再用执行结果过滤打分。
- **Agent**：模型决定步骤。SWE-agent 让模型自己决定看哪个文件、跑哪条命令、什么时候停。

两者都是 **compound AI system**（LLM + 其他部件），区别只在控制流的归属。这个区分很重要，因为它把「要不要用 agent」从信仰问题变成了设计问题：

| 维度 | 倾向 workflow | 倾向 agent |
|---|---|---|
| 任务步骤 | 可预先枚举 | 依输入而变 |
| 失败代价 | 高，需要可预测 | 可承受，允许重试 |
| 评测 | 可以逐步验证 | 只能端到端验证 |
| 调试 | 看代码 | 看 trace |

课件的态度是：**默认先用 workflow，只有在步骤确实无法预先确定时才引入 agent**。这条建议在后面讲 coding agent、多 agent 时会反复以不同形式出现。

## 9. 复合系统的三块积木

第 57–59 页用三张图把「LLM 之外的东西」串了起来。

### 9.1 RAG：把外部知识接进来

<SlideFigure lecture="01" page="57" caption="Slide 57 · RAG 三步：retrieve 检索、augment 增强、generate 生成"></SlideFigure>

RAG 三步：**retrieve**（在文档库中检索相关片段）、**augment**（把片段拼进用户问题）、**generate**（模型基于检索到的事实作答）。它的价值是把「模型记住什么」变成「模型能查到什么」，代价是检索质量成为新的瓶颈。

### 9.2 工具调用：一次调用的四个阶段

<SlideFigure lecture="01" page="58" caption="Slide 58 · 一次工具调用的解剖：Select → Arguments → Validate → Execute，结果回到上下文"></SlideFigure>

第 58 页把工具调用拆成四步，值得记住：

1. **Select**：从上下文里的工具 schema 中选一个（`read_file`）；
2. **Arguments**：从任务里填出参数（`{"path": "test.py"}`）；
3. **Validate**：按 schema 校验，可用约束解码保证格式合法；
4. **Execute**：在沙箱里执行，把结果（`def add(a, b): …`）放回上下文。

这四步里，模型只负责前两步；后两步是 harness 的职责。**把责任边界划清楚**，是后面所有工程讨论的前提。

### 9.3 MCP：把工具接口标准化

<SlideFigure lecture="01" page="59" caption="Slide 59 · Model Context Protocol：host（聊天界面、IDE、其他 AI 应用）与 server（数据、开发工具、生产力工具）之间的标准协议"></SlideFigure>

MCP（Model Context Protocol）解决的是「每个 host 都要为每个工具写一遍适配器」的问题：把工具暴露成标准 server，任何支持 MCP 的 host 都能直接接入。它的架构是 **host ↔ protocol ↔ server**，并且支持双向数据流——server 可以主动推送资源与通知。

对 agent 工程来说，MCP 的意义不只是省事：**它把工具从「某个应用的内部实现」变成了「可复用的基础设施」**，也因此把工具的安全边界推到了协议层（第 11 讲会讲这个代价）。

## 10. 五类挑战

<SlideFigure lecture="01" page="61" caption="Slide 61 · 构建 agent 的五类挑战：可靠性、训练、长程、安全、评测"></SlideFigure>

课件最后用一页把整门课的动机收拢：

| 挑战 | 一句话描述 | 为什么难 |
|---|---|---|
| Reliability | 错误在 agent 设置中会复合 | 单步 95% 正确，二十步后只剩 36% |
| Training | 奖励稀疏、horizon 长、rollout 昂贵 | 一次失败可能发生在几百步之后 |
| Long-horizon | 上下文增长且漂移 | 该记的忘了，该忘的还在 |
| Safety | 任务成功 ≠ 行为安全 | 完成任务的路径可能违规 |
| Evaluation | 评什么、怎么评 | 终态、过程、成本都要看 |

### 10.1 可靠性的三个维度

<SlideFigure lecture="01" page="62" caption="Slide 62 · 可靠性的三个维度：跨运行一致性、对扰动的稳健性、失败模式是否可预测"></SlideFigure>

HAL 的工作把可靠性拆成三问：

1. **Consistency**：同一个任务跑两次，结果一样吗？
2. **Robustness**：提示、工具、环境有小改动时，行为会不会崩？
3. **Predictable failure modes**：失败时是「可读、可恢复」的失败，还是不可预测的崩溃？

第 63 页的 capability–reliability 矩阵显示，**能力分数高的 agent 未必可靠性高**——这两件事需要分开测量。这是后面评测讲次的核心论点之一。

### 10.2 任务成功不等于安全

<SlideFigure lecture="01" page="64" caption="Slide 64 · HarnessAudit：任务完成率（灰）与安全合规率（彩色）并排比较，二者并不一致"></SlideFigure>

第 64 页的对比很刺眼：一些 agent 的任务完成率不低，但安全合规率只有一半左右。也就是说，**它把事情做成了，但用了不该用的方式**。如果只看任务成功率，这类问题完全不可见。

### 10.3 对抗与隐私

<SlideFigure lecture="01" page="66" caption="Slide 66 · 弹窗攻击：在 OSWorld / VisualWebArena 中注入弹窗，攻击成功率达 87%，agent 被带偏、完不成原任务"></SlideFigure>

第 66 页的弹窗攻击（Zhang, Yu & Yang, 2024）值得单独记住：在网页里放一个「点我」的弹窗，攻击成功率高达 87%。原因不是模型不会拒绝，而是 **agent 的观测里混进了不该被当作指令的内容**。这是 prompt injection 在 GUI 场景下的具体形态，第 11 讲会系统讲防御。

同类的还有：隐私规范（PrivacyLens）、谄媚与奖励篡改（sycophancy / reward tampering）、多 agent 串谋（METR 2026 的事件复盘）。它们的共同点是——**能力越强，越需要显式的边界设计**。

## 11. 课程安排

<SlideFigure lecture="01" page="71" caption="Slide 71 · 本讲小结：课程安排、历史、架构、复合系统与关键挑战"></SlideFigure>

- **成绩构成**：项目 40%（proposal 5% + midway report 5% + midpoint demo 5% + final submission 15% + final demo 10%）、作业 15%、基于作业的口试 15%、论文视频 10%、互评 20%。
- **口试**：15 分钟，围绕你提交的任意部分提问，目的是确认你真的理解自己写的东西。
- **论文视频**：选一篇课上没讲的 agent 论文，录 10 分钟讲解。
- **互评**：评论文视频、中期 demo、agent 评测与最终 demo；评分看反馈是否有用、作者是否采纳。
- **政策**：遵守荣誉准则；鼓励用 AI 学习；课上不建议开笔记本；每人 3 天免费迟交，互评与最终报告不接受迟交。
- **算力**：Laude Institute 提供 $200，Thinking Machines 提供 $250。

## 延伸阅读

- Russell & Norvig, *Artificial Intelligence: A Modern Approach*（agent 的经典定义）。
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), ICLR 2023。
- Shinn et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366), NeurIPS 2023。
- Schick et al., [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761), NeurIPS 2023。
- Zaharia et al., [The Shift from Models to Compound AI Systems](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/), BAIR 2024。
- [Model Context Protocol 规范](https://modelcontextprotocol.io/specification/2025-06-18)。

## 自测

**1. 为什么说「agent 工程分三层」，而多数项目只做了第一层？**

<details>
<summary>答案</summary>

三层是 system（架构与循环）、data（演示、轨迹、上下文）、evals（任务、环境、打分器）。多数项目把精力放在搭循环和接工具上，既没有系统收集轨迹，也没有可复现的评测，于是无法回答「为什么失败」和「改了之后有没有变好」。第 6 周之后的数据与评测讲次，补的就是这两层。

</details>

**2. ReAct 与 CoT 的本质区别是什么？**

<details>
<summary>答案</summary>

CoT 只在模型内部生成推理，不改变环境；ReAct 把动作插入推理链，让环境返回的观测参与后续决策。因此 ReAct 能纠正检索错误、获得外部事实，而 CoT 只能依赖模型已有知识。代价是 ReAct 需要工具、环境和更长的轨迹。

</details>

**3. 任务成功率 80% 的 agent，为什么可能不可用？**

<details>
<summary>答案</summary>

因为成功率不包含一致性、稳健性与安全合规。同一个任务两次运行结果可能不同；小的提示扰动可能让它崩溃；它可能用违规路径完成任务（HarnessAudit 的对比显示安全合规率可以远低于完成率）。要判断可用性，需要把这三类指标分开测。

</details>
