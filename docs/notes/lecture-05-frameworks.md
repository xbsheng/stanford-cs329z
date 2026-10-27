---
title: "5 · 框架与编排：抽象换来了什么"
description: "Stanford CS329Z 第五讲：用「数据、系统、评测」三根支柱界定 agent 工程，借手写反向传播与 PyTorch 的对比说明框架抽象的价格，再拆 DSPy 的签名、模块与优化器，LangGraph 的状态与图，四类开源 harness 的设计取舍，Temporal 的持久化执行，以及可观测性与选型原则。"
outline: [2, 3]
---

# 5 · 框架与编排：抽象换来了什么

<div class="meta-card">
<p><strong>2026-10-07 · Diyi Yang、Michael Ryan、John Yang · 132 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture05.pdf" target="_blank" rel="noreferrer">lecture05.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 3 周 · 框架与设计；本讲回答「这些库替我做了什么、又藏起了什么」。</p>
</div>

<SlideFigure lecture="05" page="1" caption="Slide 1 · 课程标题页：Frameworks & Orchestration，Diyi Yang、Michael Ryan、John Yang"></SlideFigure>

## 本讲速览

- **框架是抽象层，不是能力层。** 它把模型调用、状态、重试、日志包成 API；它不会让你手里的模型变强，只改变你写代码的姿势。
- **「工程化」agent 的判据是三根支柱。** Data、System/Model、Evaluation + Metric 同时在场才叫工程，只搭 system 那一根是 demo。
- **抽象的价格是「看不见」。** PyTorch 让你不写梯度，也让你不写梯度；DSPy 让你不写 prompt，也让你不知道最终 prompt 长什么样。
- **DSPy 优化的是程序，不是权重。** 签名定义契约、模块定义实现、优化器用数据和 metric 改写指令；这一讲的 GEPA 只改了 `instructions` 文本。
- **LangGraph 的抽象是显式的。** 状态是一个数据结构，控制流是一张图，分支是普通 Python 函数，所以调试时你能指出「哪条边走错了」。
- **harness 的差异可以超过模型差异。** 同一个模型换 harness，Terminal-Bench 2 上成功率从 31.1% 到 47.8%，成本也一起变。
- **可靠性来自软件工程的老办法。** 持久化执行、超时与重试预算、trace 与成本监控——这些不新，但正是「能跑」和「能运维」的分界。

## 1. 什么叫「工程化」一个 agent

课件在第 9 页把这一讲拆成四块：workflows、agent harnesses、orchestration、best practices。第 10 页先给判据——三根支柱。

<SlideFigure lecture="05" page="12" caption="Slide 12 · 三根支柱被整体框起来标为 AI System Engineering：Data、System or Model、Evaluation + Metric"></SlideFigure>

三根支柱的内容都很具体：Data 是训练数据、rollout、演示、人类反馈；System or Model 是语言模型、复合 AI 系统或工作流、agentic system；Evaluation + Metric 是 pass rate、exact match、LLM judge、成本与延迟。第 12 页只是把三块框成「AI System Engineering」，什么都没加，但这个框本身就是论点：**工程的对象是整个三角形，不是那个绿色的方块**。

第 13 页的课程地图把这句话展开成一张排期表：框架与编排、设计模式、记忆、多智能体都挂在 System 那一列；数据与评测各有两讲。也就是说，今天讲的都是 system 层的东西，而 system 层单独存在时，你无法回答「改了之后有没有变好」。

这一点在第 17 页被反过来问了一次：这些框架真的有人在用吗？课件给的证据是 GitHub star 数与招聘启事——DSPy 38.5k、LangGraph 42.8k、Temporal 23.5k，外加一条「Now Hiring: 2000 LangGraph Jobs」。这不是严谨的采用率调查，但它回答了一个更实际的问题：**你学的这套 API，明天还会有人维护**。

## 2. 框架抽象：手写反向传播，还是 PyTorch

第 4 页放了两段代码，左边手写、右边 PyTorch，做的是同一件事。

<SlideFigure lecture="05" page="4" caption="Slide 4 · 左：手写 forward、backprop、update；右：optimizer.zero_grad()、loss.backward()、optimizer.step()"></SlideFigure>

手写版本要自己算 `d_pred = 2 * (pred - y) / y.size`、`d_w = np.sum(d_pred * x)`、`d_b = np.sum(d_pred)`，再逐个更新参数。PyTorch 版本只剩三行：`optimizer.zero_grad()`、`loss.backward()`、`optimizer.step()`。梯度去哪了？进了 `autograd`。

课件紧接着给了一句很关键的话（第 5 页）：

> Frameworks abstract away some of the underlying system details. In the rest of the course you must implement/understand the system details. The goal for today is to learn the abstractions.

这句话确定了整讲的语气：**学框架的目的是认识抽象，而不是把抽象当成现实**。课程后面还要你自己实现 harness、自己写评测，因为只有掀开过一层，才知道抽象层在什么情况下会骗你。

抽象换来了什么，可以说得很具体：

| 换来的 | 代价 |
|---|---|
| 不用手写梯度 / 不用手写 prompt 模板 | 出错时不知道梯度 / prompt 长什么样 |
| 组件可替换（换模型、换存储） | 组件之间的隐含契约变成新的 bug 源 |
| 常见模式有默认实现（重试、并行、流式） | 默认值决定了行为，而你未必读过默认值 |
| 代码更短，评审更容易 | 依赖变多，升级与维护不再由你控制 |

第 6 页的学习目标正好对应这三件事：认出常见框架、把这些框架的抽象映射回课上讲过的系统设计、判断某个工具对编排与可靠性到底有没有用。第三条最难，因为它要求你在「能跑」之外还有一把尺子。

## 3. 框架地图：一条控制流光谱

第 14 页是整讲反复出现的那张图：一条从左到右的 **Spectrum of Control Flow (Agency)**。

<SlideFigure lecture="05" page="16" caption="Slide 16 · 框架地图的完整版：模型（OpenAI / Anthropic / LiteLLM）、工作流（DSPy / LangGraph）、agent（SWE-agent / OpenHands），外加 Reliability 与 Observability 两条横轴"></SlideFigure>

三个位置，三种「逻辑住在哪」：

- **Model**：逻辑在模型权重里，`OpenAI API`、`Anthropic API`、`LiteLLM` 只是访问层，控制流还在你的代码里，但每一步都是「一次模型调用」。
- **Workflow / Compound AI System**：*Logic and orchestration lies in the program*。DSPy 与 LangGraph 在这一段，流程由代码写死，模型只负责其中若干步。
- **Agent**：*Control flow is the role of the AI model*。SWE-agent、OpenHands 在这一段，下一步做什么由模型决定。

第 15 页在图上加了一条与光谱垂直的轴：Reliability（Temporal）与 Observability（Langfuse、MLflow）。这条轴的意义是——**可靠性与可观测性不是光谱上的某一格，而是每一格都要付的成本**。你在最左边也想知道调用花了多少钱，在最右边更想知道它为什么卡住。

第 16 页用 Part 1 / Part 2 / Part 3 标出了本讲的三段：工作流框架、agent harness、编排与遥测。看懂这张图，后面每一节都只是往某一格上填细节。

## 4. DSPy：把 prompt 变成可优化的程序

DSPy 的自我描述只有三行（第 22 页），但每一行都对应一个可以挑刺的设计决定。

<SlideFigure lecture="05" page="22" caption="Slide 22 · DSPy 的三个抽象：Signatures 定义输入输出（What），Modules 组合成可调用函数（How），Optimizers 用数据与 metric 改进 prompt 或权重"></SlideFigure>

### 4.1 Signatures：先把契约写死

最简单的签名是一个字符串（第 24 页）：

```python
signature = "message -> response"
chat = dspy.Predict(signature)
print(chat(message="Hello, how are you?").response)
```

它声明了「输入一个 message，输出一个 response」，但没有声明 response 长什么样。于是第 26 页出现了那个尴尬的输出：

<SlideFigure lecture="05" page="26" caption="Slide 26 · 同一个情感分类签名，三次调用返回 positive / Negative / negative 三种写法，课件批注「Not good that these are not following same format」"></SlideFigure>

三次调用，三种大小写。对人类来说这是同一个答案，对下游代码来说这是三个不同的字符串。这就是「只声明输入输出、不声明格式」的代价：**契约不完整，调用方就得写防御性解析**。

修法在第 27、28 页：给字段加类型与描述。

```python
class ExtractEvent(dspy.Signature):
    """Extract event details from an email."""
    email: str = dspy.InputField()
    event_name: str | None = dspy.OutputField()
    date: dt.date | None = dspy.OutputField()
    start: dt.time | None = dspy.OutputField(desc="24-hour clock")
    duration_minutes: int | None = dspy.OutputField(desc="duration of the event in minutes")
```

第 27 页用 `Literal['positive', 'negative', 'neutral']` 与 `confidence: float` 把输出限制成枚举加分数，返回的就是 `Prediction(sentiment='positive', confidence=0.98)`，可以直接当结构化数据用。签名从「一句话」升级成「类型 + 描述」，模型被约束在一个更小的空间里。

### 4.2 Modules：把签名接成程序

签名只说 What，模块说 How。`dspy.Predict` 是最朴素的实现，`dspy.ChainOfThought` 会在同一个签名前插一段推理（第 30 页），`dspy.BestOfN` 则采样多次再挑。

真正有意思的是模块可以互相嵌套（第 32 页）：两次模型调用、一段普通 Python 判断、一次外部写入，被装进一个 `forward` 里。

<SlideFigure lecture="05" page="32" caption="Slide 32 · UpdateCalendarFromEmail(dspy.Module)：两个 ChainOfThought 子模块加普通 Python 控制流，forward 返回 dspy.Prediction"></SlideFigure>

```python
class UpdateCalendarFromEmail(dspy.Module):
    def __init__(self):
        self.extract = dspy.ChainOfThought(ExtractEvent)   # LLM call 1
        self.pick_emoji = dspy.ChainOfThought(PickEmoji)   # LLM call 2

    def forward(self, email: str):
        details = self.extract(email=email)
        # Plain Python control flow: not every email contains an event.
        if details.event_name is None or details.date is None or details.start is None:
            return dspy.Prediction(event=None, status="no event found in email")
        emoji = self.pick_emoji(event_name=details.event_name).emoji
        event = tinycal.add_event(...)
        return dspy.Prediction(event=event, status="added to calendar")
```

注意 `forward` 里那句注释：**不是每封邮件都含事件**。这一句判断是普通 Python，不是模型判断。DSPy 的模块不要求你把控制流交给模型——这一点常被误解，仿佛用了 DSPy 就必须「让模型决定一切」。实际上它把「模型调用」与「程序逻辑」分得很清楚：模型调用是有契约的函数，剩下的仍然是代码。

### 4.3 Optimizers：用数据和 metric 改 prompt

优化器是 DSPy 与「手写 prompt」最不一样的地方。它需要两样东西：带标注的数据、可计算的 metric。

<SlideFigure lecture="05" page="43" caption="Slide 43 · 同一条签名、同一个 12B 小模型，GEPA 优化前后：55.0% → 100.0%（20 条测试样本）"></SlideFigure>

课件给的实验很小，但结构完整：

1. **数据**（第 37 页）：50 封带 gold label 的真实邮件，字段是 event_name、date、start、duration_minutes。
2. **metric**（第 39 页）：日期、开始时间、时长三者全对得 1，否则 0；同时返回 `feedback` 文本，注释写着「GEPA shows this to the reflection model」。
3. **基线**（第 40 页）：大模型 `gpt-5.4-nano` 20/20，100%——先确认任务本身可解、metric 没写错。
4. **目标**（第 41 页）：小模型 Gemma 3 12B，优化前 11/20，55.0%。
5. **优化**（第 42 页）：`dspy.GEPA(metric=event_metric, max_metric_calls=100, reflection_lm=dspy_llm, num_threads=8)`，`gepa.compile(extract_small, trainset=trainset)`。
6. **结果**：20/20，100%；打印出来是 `small model before: 55.0% after: 100.0%`。

<SlideFigure lecture="05" page="44" caption="Slide 44 · 优化器唯一改动的是 instructions 文本：输出格式、日期与时间的取值规则、缺失字段怎么处理，全写成自然语言段落"></SlideFigure>

第 44 页值得反复看：`print(extract_optimized.signature.instructions)` 打出来的是一大段自然语言——输入格式、输出格式（ISO 日期、带时区的 HH:MM:SS）、没有时区就用 UTC、缺失时长输出 null。**优化器没有改模型权重，也没有改你的 Python 代码，它重写了那段指令**。

这解释了两件事。第一，为什么 DSPy 强调「签名 + 模块」：只有契约固定，优化器才有稳定的搜索空间。第二，为什么优化器的效果高度依赖 metric——metric 只看三个字段，优化器就会把指令写成「保证这三个字段对」，别的地方（比如 event_name 的措辞）它不关心。**metric 是目标函数，写错了就是在优化错的东西**。

代价也是明确的：你需要 50 条标注、一个能自动判分的 metric、以及一次约 100 次 metric 调用的预算（课件标注 ~3 分钟）。没有这些，优化器无从下手。

### 4.4 Agents：一行 ReAct，一行 RLM

DSPy 也内置了 agent 模块。第 46 页把 ReAct 写成两行：

```python
agent = dspy.ReAct("request -> summary", tools=tinycal.TOOLS)
result = agent(request="Schedule a 30-minute coffee with John on Oct 7, 2026 ...")
```

第 48 页的 RLM 走另一条路：把长上下文当成可递归处理的对象，`max_iters=8`，对一个装着所有邮件的字符串做问答。

<SlideFigure lecture="05" page="46" caption="Slide 46 · dspy.ReAct 一行构造 agent，工具集是 tinycal.TOOLS；运行时 8.3 秒，结果自动写进日历"></SlideFigure>

第 51 页的总结把三者串起来：signatures 定义契约，modules 决定契约怎么被满足（`dspy.Predict`、`dspy.ChainOfThought`、`dspy.BestOfN`），optimizers 在给定数据与 metric 时改进 prompt 或权重，而 `dspy.ReAct`、`dspy.RLM` 让 agent 也能满足同一个签名。**同一个签名可以先用 Predict 实现，再换 ReAct 实现，最后换优化过的版本**——这是这套抽象真正的价值。

## 5. LangGraph：把控制流画成图

LangGraph 的抽象比 DSPy 更「显式」：它不隐藏控制流，而是要求你把它画出来。第 53 页开始，课件用五页逐步搭出这张图。

<SlideFigure lecture="05" page="58" caption="Slide 58 · LangGraph 版 agent：Start → LLM，LLM 与 Tools 之间双向边（条件边），LLM → End；状态就是 message history"></SlideFigure>

四个概念：

- **State**：图的共享工作区，一个会被节点修改的对象。第 58 页说它「可以是 message history」。
- **Node**：读写 state 的函数。签名是「收一个 state，返回要改的字段」。
- **Edge**：节点之间的控制流。普通边是固定跳转，条件边是「跑一个函数决定去哪」。
- **Start / End**：每张图都必须有。

代码大致是这样（第 62–64 页）：

```python
class State(TypedDict):
    email: str
    details: ExtractEvent | None

def extract(state: State):
    # 只返回改动的那部分，图的其余字段保持不变
    return {"details": extract_llm.invoke(state["email"])}

builder = StateGraph(State)
builder.add_node("extract", extract)
builder.add_edge(START, "extract")
builder.add_edge("extract", END)
graph = builder.compile()
```

注意节点只返回 `{"details": ...}` 而不是整份 state——**增量更新是 LangGraph 的默认语义**，它让多个节点可以各自负责一部分字段而不互相覆盖。第 62 页的 `CalendarState(State)` 又加了 `emoji` 与 `status` 两个字段，说明 state 是可以继承扩展的。

条件边（第 69 页）就是一个返回字符串的普通函数：

```python
def route(state: CalendarState) -> Literal["pick_emoji", "__end__"]:
    # plain Python decides where to go next
    d = state["details"]
    return "pick_emoji" if d.event_name and d.date and d.start else END
```

这是 LangGraph 与「让模型决定下一步」的分界：**分支条件写在代码里**，模型只在节点内部做它擅长的那一步。要真正的自主 agent，第 74 页给了一行 `create_agent(langchain_llm, tools=tinycal.TOOLS)`，等价于「LLM 节点 + 工具节点 + 条件边」的标准回路。

把它和 DSPy 放在一起比较，差别不在能力，在**你把不确定性放在哪一层**：

| | DSPy | LangGraph |
|---|---|---|
| 核心抽象 | signature（契约）+ module（实现） | state（数据）+ graph（控制流） |
| 控制流 | Python 代码，模块内部自由编排 | 图，显式声明节点与边 |
| 优化对象 | prompt / 指令（optimizer） | 图结构本身（人改） |
| 失败定位 | 看哪个 module 的输出不合契约 | 看哪条边走错、哪个节点没更新 state |
| 适合 | 输入输出明确、要反复调优的子任务 | 多步流程、需要分支与人工介入的系统 |

课件没有展开 checkpoint 与「中断后从哪继续」这一层：图的 state 在内存里，落盘与恢复要靠外部机制。这正是下一节 Temporal 要解决的问题，也是把 LangGraph 放进生产系统时最先撞到的墙。

## 6. 开源 harness：同一个模型，不同外壳

第 80 页把 harness 摆回第 1 讲的那张图：Planning & Reasoning、Memory、LLM Core、Tools 都在框内，Environment 在框外，通过 observe / act 交互。**harness 就是那个框**——模型之外、环境之内的全部工程。

<SlideFigure lecture="05" page="80" caption="Slide 80 · Agent harness 的边界：框内是 planning、memory、LLM core、tools 与动作；框外是桌面、浏览器、数据库等环境"></SlideFigure>

课件用四个真实 harness 说明「设计选择」是什么意思。

**Mini SWE-Agent**（第 82 页）：除了 bash 没有任何工具；历史完全线性，每一步只是往 messages 里追加；动作用 `subprocess.run` 执行，因此每条命令彼此独立——不保留一个有状态的 shell 会话。它的哲学是「最小可行」：少一个部件，少一处失败。

**OpenHands**（第 83 页）：每一步存成一个 event，磁盘上一步一个 JSON 文件，发给模型的消息每步都从这些 event 重建；保留一个持久的 tmux 终端，`cd`、环境变量、virtualenv 能跨命令延续；还有一个卡死检测器——同一个动作与结果重复 4 次就结束运行。

**Pi Agent**（第 84 页）：只有四个工具（read、write、edit、bash），system prompt 不到 1,000 token；没有权限系统，以启动时的权限运行；历史存成树而不是列表，可以回到早先的消息从那里分叉；刻意简单——没有 plan mode，也没有 sub-agent 工具。

**Open Claw**（第 85 页）：每 30 分钟自己醒来一次，心跳轮次里用 `NO_REPLY` 保持沉默；以一个长期存活的 Gateway 进程拥有所有聊天通道；身份由 `AGENTS.md`、`SOUL.md`、`IDENTITY.md`、`USER.md`、`MEMORY.md` 这些 Markdown 注入；每天凌晨 3 点跑一个后台任务，把当天笔记里值得留的部分搬进 `MEMORY.md`。

四种 harness 的差别不是「谁更先进」，而是**在任务成功率、成本、延迟、用户控制之间选了不同的平衡点**（第 81 页）。线性历史好调试但无法分叉；事件日志可重建但要写盘；持久终端方便但状态会泄漏；树状历史灵活但要处理合并。

<SlideFigure lecture="05" page="86" caption="Slide 86 · Terminal-Bench 2：同一模型换 harness，成功率与单次 rollout 成本同时变化（Claude Haiku 4.5 上 Pi 47.8%、Codex 31.1%、Claude Code 41.1%）"></SlideFigure>

第 86 页是这一节最硬的证据。同一个 Claude Haiku 4.5，Pi 47.8%、Codex 31.1%、Claude Code 41.1%；同一个 Fable 5，Pi 71.1%、Codex 72.2%、Claude Code 75.6%，但成本从 $0.98 到 $1.55。**harness 不是中立的容器**：它决定模型看到什么、能做什么、什么时候停。

第 87–88 页把这个观察推到极致：Meta-Harness 让 agent 读文件系统里所有历史 harness 代码、执行轨迹与分数，提出新的 harness 代码，评测后再把日志存回去，形成搜索循环。在 TerminalBench-2 上它拿到 37.4，高于 Google 的 35.5、Terminus-KIRA 的 33.7、Mini-SWE-Agent 的 29.8、SWE-Agent 的 28.3、Claude Code 的 27.5。这里要克制地读：**这些数字是特定 benchmark、特定模型下的 harness 对比**，不是「某个 harness 普遍更好」的结论。

## 7. 持久化编排：Temporal

为什么要编排与遥测？第 92 页给了一张 METR 的图：模型能以 50% 成功率完成的任务时长，随发布时间指数增长，从几秒到几小时。第 93 页把话说明白：agent 会跑很久，支撑它的基础设施必须可靠；调试需要日志与可观测性工具；这些是软件工程早就教过的课，只是现在要迁移到 agent 上。

<SlideFigure lecture="05" page="98" caption="Slide 98 · Temporal 执行模型：客户端代码、Activity / Workflow Workers、Task Queue（Activity Queue 与 Workflow Queue）、Execution History & State 与存储"></SlideFigure>

Temporal 的模型只有两个原语（第 95–98 页）：

- **Activity**：会失败的功能单元。一次 LLM 调用、一次日历写入、一次 HTTP 请求，都是 activity。
- **Workflow**：把 activity 串起来的函数。它是确定性的编排逻辑，本身不做 I/O。

运行时，workflow 与 activity 分别由 workflow worker 和 activity worker 执行，通过 task queue 分发；服务端保存 **execution history & state**。这份 history 是整个模型的关键：进程崩了，workflow 可以从 history 重放到崩溃前的位置，已经完成的 activity 不会重跑。

代价写在第 102 页的注释里：

```python
# The workflow: UpdateCalendarFromEmail.forward, with execute_activity around every call that can fail.
# It must be deterministic (no LLM calls, no I/O of its own), because Temporal re-runs it from the record.
```

**workflow 里不能直接调 LLM**。原因很实在：重放时会重新执行 workflow 代码，如果里面有模型调用，就会重复调用、重复计费、结果还可能不同。所以正确的写法是把 LLM 调用包成 activity（第 101 页正是这样复用 DSPy 模块的），workflow 只负责顺序、条件与重试策略：

```python
@workflow.defn(sandboxed=False)
class CalendarWorkflow:
    @workflow.run
    async def run(self, email: str) -> str:
        details = await workflow.execute_activity(
            extract_event, email,
            start_to_close_timeout=timedelta(minutes=1), retry_policy=RETRY)
        ...
```

`RETRY = RetryPolicy(initial_interval=timedelta(seconds=1), maximum_attempts=5)`——重试次数与超时都是显式参数，而不是散落在代码里的 `try/except`。第 104 页的客户端调用带 `id="calendar-1"` 与 `task_queue="calendar"`：id 让同一次工作流可以被查询与去重，队列决定它跑在哪个 worker 池上。

<SlideFigure lecture="05" page="113" caption="Slide 113 · 用子工作流加 sleep 实现提醒：execute_child_workflow 启动日历写入，然后 workflow.sleep(seconds) 一直等到提醒时刻"></SlideFigure>

第 113 页展示了这套模型最不像「普通代码」的地方：`await workflow.sleep(seconds)` 可以睡几个月甚至几年，因为睡眠期间没有进程占用——状态在服务端，醒来时按 history 继续。代码注释写得很直白：「A workflow can sleep for a month or even years in one line」。**这行代码在普通 Python 里是不可想象的**，它要求把「等待」从进程内存搬到持久化状态里。

## 8. 可观测性：trace、日志、成本

第 118–121 页给了三个工具的具体形态，它们回答的是三个不同的问题。

<SlideFigure lecture="05" page="125" caption="Slide 125 · 让失败可见且可恢复：trace 模型调用、工具调用、状态变化与错误；设超时、重试上限与执行预算；把错误抛回给 agent 重试"></SlideFigure>

- **MLflow**（第 119 页）：一次 `LM.__call__` 的输入输出——prompt、messages、输出文本，按 trace 展开。它回答「这一次调用到底发了什么、回了什么」。
- **LangSmith**（第 120 页）：一列 run 的 token 数、延迟、人工反馈分数，可以按 feedback 过滤。它回答「哪一类请求又贵又慢又不讨喜」。
- **Langfuse**（第 121 页）：延迟分位数、按模型拆的成本、按类型拆的 observation、以及 12.3K 条 score 的分布。它回答「这个系统的钱和时间花在哪」。

三者的共同点是把 agent 的一次运行切成可检索的单元，并且**把成本当成一等公民**。对 agent 来说这不是锦上添花：一次任务几十次模型调用，成本与延迟的方差比单次调用大得多，没有按 trace 聚合的成本视图，你根本不知道钱花在哪个循环上。

第 125 页把「可观测」与「可恢复」放在一起讲，这是很重要的一步：trace 不只用于事后分析，它还是恢复的输入。设超时、重试上限、执行预算；把错误信息原样抛回给 agent 让它再试一次。课件截的那段终端里，agent 收到了 `Error: Blocked: sleep 30 followed by ...`，并在下一条命令里改正——**错误是观测的一种，只要它回到上下文里**。

## 9. 最佳实践与选型

第 124 页的四条建议，语气都很保守，值得按顺序读。

**先简单。**「You might not always need to build an agent. Sometimes a workflow is right for the task.」——这句话在第 1 讲出现过，这里再说一次，因为框架的存在本身就在诱导你把流程交给模型。接着是「想清楚该给哪些工具」和「数据足够多时，也许可以直接端到端优化模型」。

**让失败可见且可恢复。** 对应上一节：trace、超时、重试预算、把错误抛回 agent。第 126 页的 Shepherd 把这件事做成系统：一个 meta-agent 观察主 agent 的执行轨迹，可以回滚（revert）、可以分叉（fork），在运行时介入、做反事实优化、或用树搜索训练。它的数字（CooperBench 28.8 → 54.7）说明**干预轨迹本身就能提升成功率**，不必改模型。

**跑评测。** 第 127 页的措辞很重：「Building a proper eval is one of the most important steps」。指标要选对（准确率、成本、延迟），任务要覆盖代表性场景、边界情况与失败场景。

<SlideFigure lecture="05" page="129" caption="Slide 129 · 框架的三个限制：抽象让你离系统细节更远、复杂系统里难以定位失败来源、依赖外部库的维护风险"></SlideFigure>

第 128 页是全场最容易被忽略的一页：Terminal-Bench、SWE-bench、DeepSWE 被打了红叉，旁边是「Your Custom Domain Eval!」。注解是——除非你在做通用 coding harness 或通用 agent 系统改进，**标准 coding benchmark 不是你该爬的山**。原因不难推：通用 benchmark 的分布与你的业务不同，分数涨了也不代表你的任务变好。

第 129 页把框架的成本收拢成三条：抽象让你离底层更远，所以要确保知道下面发生了什么；复杂系统里失败来源难以定位，所以要去看 trace；搭在框架上意味着依赖外部库的维护节奏，升级、弃用、破坏性变更都不由你决定。

第 130 页的收尾是一个循环：**Build → Run → Evaluate → Improve**，工程过程是环，不是线。四条原则对应四个环节：从简单开始并为增加的复杂度给出理由；为失败与恢复设计；用证据与评测判断质量、成本、延迟；彻底理解你的系统如何工作。

回到标题的问题——抽象换来了什么？换来了更短的代码和更快的起点，也换来了「你必须主动下探」的义务。**框架决定你写多快，理解决定你能修多深**。

| 你的处境 | 更合适的选择 | 理由 |
|---|---|---|
| 步骤可枚举、要可预测 | 手写 workflow 或 LangGraph 固定图 | 控制流在代码里，失败可复现 |
| 子任务契约清晰、要反复调优 | DSPy（签名 + 优化器） | 用数据和 metric 换 prompt 质量 |
| 任务路径依输入而变 | agent harness（SWE-agent 类） | 让模型决定下一步，代价是评测更难 |
| 运行时间长、要跨进程恢复 | Temporal 类持久化执行 | history 重放，而不是进程内 state |
| 要解释成本与失败 | trace + 成本监控（LangSmith / Langfuse / MLflow） | 没有 trace 的调试是猜 |

## 延伸阅读

- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)（第 49 页引用的原始轨迹图）。
- [DSPy 文档](https://dspy.ai/)：signatures、modules 与 optimizers 的完整 API。
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)：StateGraph、条件边与 `create_agent`。
- [Temporal 文档](https://docs.temporal.io/)：workflow、activity、retry policy 与持久化定时器。
- Arena, [Coding agents and the harness tax](https://arena.ai/blog/coding-agents-harness-tax)（第 86 页的数据来源）。
- Meta-Harness, [arXiv:2603.28052](https://arxiv.org/pdf/2603.28052)（第 87–88 页的搜索循环）。
- METR, [Measuring AI Ability to Complete Long Tasks](https://metr.org/time-horizons/)（第 92 页的时间跨度曲线）。
- Shepherd, [arXiv:2605.10913](https://arxiv.org/pdf/2605.10913)（第 126 页的 meta-agent 干预）。
- Hamel Husain, [Your AI product needs evals](https://hamel.dev/blog/posts/prompt/)（第 129 页的插图出处）。

## 自测

**1. DSPy 的优化器改了什么？为什么它要求先写好签名和 metric？**

<details>
<summary>答案</summary>

这一讲的 GEPA 只改写了签名的 `instructions` 文本——把输入格式、日期与时间的取值规则、缺失字段的处理方式写成自然语言，模型权重和 Python 代码都没变。签名固定了输入输出契约，优化器才有稳定的搜索空间（改的是「怎么满足契约」，不是「契约是什么」）；metric 是目标函数，优化器只会朝它指的方向改，metric 漏掉的字段就不会被优化。

</details>

**2. LangGraph 里，分支由谁决定？这和「agent」有什么区别？**

<details>
<summary>答案</summary>

普通边与条件边都由代码决定：条件边是一个返回目标节点名的普通 Python 函数（如 `route` 返回 `"pick_emoji"` 或 `END`）。这与「控制流由模型决定」的 agent 正相反——图的结构把不确定性限制在节点内部。要 agent 行为时用 `create_agent`，它本质上就是 LLM 节点、工具节点与条件边的标准回路。

</details>

**3. 为什么 Temporal 的 workflow 里不能直接调用 LLM？**

<details>
<summary>答案</summary>

因为 workflow 会在恢复时被重放：服务端按 execution history 重新执行 workflow 代码到崩溃点。若 workflow 里有 LLM 调用或 I/O，重放就会重复调用、重复计费，且结果可能不同，history 与实际状态就对不上。所以所有可能失败的外部调用都要包成 activity，由 `execute_activity` 记录结果；workflow 只保留确定性的编排逻辑。

</details>
