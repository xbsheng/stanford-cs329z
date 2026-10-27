---
title: "4 · Tool Use：把语言变成动作"
description: "Stanford CS329Z 第四讲：RAG 的三类遗留失败、工具的 schema 契约、Toolformer 的自监督标注、Gorilla 与 ToolLLM 的规模化、REST 到 MCP 的接口演进，以及三类工具评测与常见失败模式。"
outline: [2, 3]
---

# 4 · Tool Use：把语言变成动作

<div class="meta-card">
<p><strong>2026-10-05 · Diyi Yang · 68 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture04.pdf" target="_blank" rel="noreferrer">lecture04.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 3 周 · 构建模块；接在第 3 讲 RAG 之后，把「取回证据」推进到「改变世界状态」。</p>
</div>

<SlideFigure lecture="04" page="1" caption="Slide 1 · 课程标题页：CS 329Z Engineering AI Agents，本讲主题 Tool Use，讲者 Diyi Yang"></SlideFigure>

## 本讲速览

- **工具补的是三类缺口，不是一种能力。** 算不准、没学过、碰不到——只有落进这三类的任务才值得接工具。
- **一次调用是一次结构化生成。** 模型只负责选工具与填参数，校验和执行归 harness；责任边界划不清，后面所有讨论都会跑偏。
- **调用可以被学出来，也可以被描述出来。** Toolformer 教模型「什么时候调」，schema 与标准接口让任何模型「不训练也能调」。
- **工具一多，选择就变成检索问题。** ToolLLM 与 Gorilla 的难点不在调用格式，而在上千个相似 API 里挑对一个。
- **接口每标准化一次，信任边界就外移一次。** 工具从应用内部实现变成可复用基础设施，同时变成新的攻击面。
- **评测要按粒度分层。** 单次调用看 AST 匹配，多步链看状态，多轮对话看 pass^k——三者测的不是同一种能力。
- **多数工具失败源自接口设计。** 名字含糊、描述缺失、错误信息不可读，换更大的模型也救不回来。

## 1. RAG 留下的三类失败

第 3 讲的 RAG 把「模型记住什么」换成了「模型能查到什么」。这一讲开场先花十页把它的欠账结清：检索增强并没有消灭幻觉，只是把失败挪到了别处。

<SlideFigure lecture="04" page="4" caption="Slide 4 · RAG 的三类问题：retrieval-side（蓝色）、reader-side（粉色）、loop-side（绿色），每类三条具体失败"></SlideFigure>

课件把失败分成三层，每层的修法完全不同：

| 层 | 具体失败 | 本质 |
|---|---|---|
| Retrieval-side | recall ceiling、stale index、permission leak | 该拿到的没拿到，或拿到了不该拿的 |
| Reader-side | lost in the middle、distraction、evidence conflict | 拿到了，但读不对 |
| Loop-side | compounding error、no stopping rule、prompt injection | 读对了，但收不住 |

**retrieval-side 的三种失败里，最容易被忽略的是 permission leak。** 召回不足和索引过期是质量问题，可以靠更好的 embedding、更勤的更新来缓解；权限泄漏是边界问题，一旦检索器把用户无权访问的文档拼进上下文，模型会毫不犹豫地把它当成事实说出来——它没有「我不该看这个」的概念。

**reader-side 的失败有一个共同的物理原因：上下文不是均匀读取的。** Liu et al.（2023）的 lost-in-the-middle 实验说明，关键信息落在长上下文中间时最容易被跳过。课件在 Slide 6 引了同一组数字：闭卷时最好的模型约 56%，只喂进相关文档时约 88.5%。差距不在模型，在「读多少」。

<SlideFigure lecture="04" page="7" caption="Slide 7 · 检索器召回率（黄线）缓慢升到 90%，而 RAG 的端到端表现（其余曲线）在 10–20 篇文档后就饱和"></SlideFigure>

Slide 7 的曲线值得记住形状而不是数值：**召回率还在涨，端到端分数已经平了。** 这意味着继续往上下文里塞文档，收益是负的——多出来的 token 不提供证据，只提供干扰。工程上的推论很直接：检索的优化目标不是「召回尽可能多」，而是「把最该看的三五篇放在对的位置」。

**loop-side 才是这一讲的入口。** 复合误差、缺少停止条件、检索文本反过来操纵 agent，这三件事都不是「换个更好的检索器」能解决的。它们要求 agent 具备两类东西：能改变外部状态的动作（工具），以及能判断「什么时候算做完」的反馈（执行结果）。RAG 只能在语言里打转，工具才能让语言落到世界上。

还有一类失败属于 RAG 自己：**引用也可能是编的。** RAG 常被当作「可溯源」的方案，这是它相对闭卷生成的硬优势。但引用本身也是模型生成的 token（Slide 8），于是它同样受幻觉支配。Slide 9 的表里，回答的「有用性」评分普遍偏高，引用的精确率与召回率却明显落后——输出读起来像有据可查，实际引用对不上原文。这个反差的工程含义是：「看起来有用」与「确实有据」是两个指标，而人类评审很容易被前者骗过。

三类失败加上引用的幻觉，合起来说明一件事：**RAG 改善的是「模型知道什么」，没有改善「模型能做什么」。** 前者靠更好的检索与更长的上下文，后者需要动作与反馈——也就是这一讲的主题。

## 2. 为什么需要工具

课件用一页把「模型做不到的事」列成三列，再把「agent 能做什么」逐条对上。这张表是整讲的骨架。

<SlideFigure lecture="04" page="17" caption="Slide 17 · Why Tools?：左侧三组缺口——算不出的、训练里没见过的、够不到的，右侧逐条给出 agent 的做法"></SlideFigure>

| 缺口 | 具体表现 | 对应工具 |
|---|---|---|
| 算不出 | 大规模算术、多步逻辑推演、需要精确可验证的运算 | 计算器、代码解释器、符号求解器、验证器 |
| 没见过 | 长尾事实、训练截止之后的事件、私有数据 | 搜索、检索、内部语料上的 RAG |
| 够不到 | 非语言接口（API、数据库）、物理世界、实时状态 | function calling、MCP、浏览器、机器人、传感器 |

这三类的共同点是：**它们都不是「再多训一点」能补齐的。** 算术的失败是架构性的，长尾事实的失败是分布性的，实时状态的失败是物理性的。工具之所以有效，是因为它把这三种失败从「模型的能力问题」转换成了「系统的接口问题」——后者可以被测试、被约束、被替换。

代价也随之转移。模型自己算错时，你至少知道错在推理；接上工具之后，错误会分散到选择、参数、顺序、返回值解读这四个环节，而且大多数环节的失败在最终输出里看不出来。Slide 67 的失败模式清单，本质上就是这张代价表。

课件在 Slide 16 放了一张「任务复杂度上升、零样本准确率下降」的曲线（Dziri et al., 2023）：乘法位数、谜题规模、序列长度增加时，准确率不是缓慢下滑，而是断崖。这解释了为什么工具不是「锦上添花的增强」，而是「复杂任务的前置条件」。

## 3. 工具是什么：名字、描述、schema

课件给了工具一个可以逐字引用的定义：

> An LM-used tool is a function interface to a computer program that runs externally to the LM, where the LM generates the function calls and input arguments in order to use the tool.

三个限定词都重要：**function interface**（有明确签名）、**runs externally**（不在模型内部执行）、**LM generates the calls and arguments**（模型只生成，不执行）。

<SlideFigure lecture="04" page="18" caption="Slide 18 · 工具的定义与示意图：大脑向外伸出手，调用 get_time()、calculator 等外部程序，结果回到推理"></SlideFigure>

一次调用可以拆成四步，模型只占前两步：

1. **Select**：从上下文里的工具清单中选一个。
2. **Arguments**：从任务描述里填出参数。
3. **Validate**：按 schema 校验类型、必填项、取值范围。
4. **Execute**：在受控环境里执行，把结果放回上下文。

第 3、4 步是 harness 的职责，这个分工不是实现细节，而是可靠性的来源。模型输出的是**意图的表示**（一段 JSON），harness 决定这段表示能不能变成真实动作。把校验放在模型之外，才有可能在参数非法时拒绝执行、在工具报错时把错误当成观测喂回去。

用 Slide 20 的算式走一遍，整条轨迹只有一次往返：用户问 `17,423 × 892`，模型输出 `calculate(17423 * 892)`，计算器返回 `15,541,316`，模型把它写进答案。**模型并没有学会乘法，它学会的是「在乘法面前停下来，把式子交出去」。** 这个区别决定了工具设计的方向：与其教模型算得更准，不如教它更早承认自己算不准。

工具的「说明书」只有三样东西：名字、描述、参数 schema。Slide 50 的例子足够说明问题：

```json
{
  "name": "get_weather",
  "description": "Current weather",
  "parameters": {
    "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"]
  }
}
```

模型看到这段 schema 后输出：

```json
{ "tool_call": { "name": "get_weather", "arguments": { "city": "Stanford" } } }
```

**这段 schema 就是 prompt。** 名字决定模型能不能一眼分辨用途，描述决定它在两个相似工具之间怎么选，参数名和类型决定它填得对不对。实践中大量「模型不会用工具」的抱怨，实际原因是描述写得像给人看的 API 文档：省略了单位、枚举值、前置条件，而模型没有任何渠道知道这些。

代价在这里第一次显形：工具不是免费的。每多一个工具，上下文就多一段 schema；工具越多，选择越难，误选率越高。Slide 45 的四项工作总结里，scale 一列从 5 个工具一路涨到 16k 个 API，而每一代的解法都在回答同一个问题——**怎么让选择不随数量线性变难**。

## 4. Toolformer：把「该不该调用」变成可计算的标注

Toolformer（Schick et al., 2023）的出发点是：工具调用的知识不该只靠人写提示词，模型可以自己标注出「在哪里调、调什么、传什么参数」。

<SlideFigure lecture="04" page="26" caption="Slide 26 · Toolformer 第一步：在文本的每个位置采样 API 调用候选，示例把 QA 调用插进「Pittsburgh is known as …」，下方为采样判据 p_i"></SlideFigure>

它只用了五个工具：问答系统、计算器、搜索引擎、翻译系统、日历。流程分三步：

1. **采样调用位置。** 对输入 $\mathbf{x}$，在位置 $i$ 上按模型给 `<API>` 的概率决定是否采样：
$$
p_i = p_M(\langle\text{API}\rangle \mid P(\mathbf{x}), x_{1:i-1}) > \tau_s
$$
每个位置再采样若干候选调用 $c_i^1, \dots, c_i^m$。

2. **执行调用。** 把候选调用真的发出去，拿到结果 $r_i$。这一步会产生大量无意义的调用，下一步负责筛掉。

3. **按损失过滤。** 只保留「插进去之后，后续 token 的损失确实下降」的调用。判据是加权交叉熵的差值：
$$
\Delta L_i = L_i(\varepsilon) - L_i\big(e(c_i, r_i)\big) \ \ge\ \tau_f
$$
其中 $L_i(\varepsilon)$ 是不插调用时的损失，$L_i(e(c_i,r_i))$ 是插入了调用与执行结果之后的损失。

<SlideFigure lecture="04" page="27" caption="Slide 27 · 过滤规则：比较「调用 + 输出」与「不调用 / 调用但无输出」两种基线，差值超过阈值才保留；左为加权交叉熵定义"></SlideFigure>

Slide 28 给了一个具体例子：同一段文本，不调用时损失 2.5，调用但没拿到输出时 2.1，调用并拿到结果时 0.8，于是 usefulness = min(2.5, 2.1) − 0.8 = 1.3，超过阈值才保留。这个设计的关键在于**基线取的是两者中较小的那个**——调用本身带来的格式开销会被抵消，剩下的才是「结果真的有用」。

这套标注有两个含义。好的一面是它完全自监督：不需要人工标「这里该调计算器」，只需要能执行 API、能算 loss。坏的一面是它**衡量的是「对下一段 token 有没有帮助」，不是「这次调用是否正确」**。一次错误的检索如果恰好让文本更流畅，也会被保留；一次正确的调用如果结果只是复述原文，反而会被丢掉。

课件把方法压成两句（Slide 24）：先用 API 调用增强出一个新数据集，再用它微调 GPT-J 6B。**「增强数据集」这个说法比「训练模型」更准确**——工具调用的知识被写进了数据，模型只是把它压缩进权重。这同时解释了它的维护成本：换一批 API 就要重做一遍标注，而标注本身需要真的把每次调用发出去。

课件的结论放在 Slide 30：6B 的 GPT-J 加上 Toolformer 之后，在事实补全、问答、数学、时序、多语言这几类任务上与 175B 的 GPT-3 并排比较，说明增益不是靠规模换来的。这个对比的说服力在于控制变量，而不在于具体分数。

<SlideFigure lecture="04" page="30" caption="Slide 30 · Toolformer 在五类任务上的结果：三组柱分别为 GPT-J 6B、Toolformer 6B、GPT-3 175B"></SlideFigure>

Toolformer 的局限也很清楚：工具只有五个，训练是离线的，标注成本随工具数量线性增长，而且它学不会多步依赖——一次调用看不出「先查 A 再查 B」的必要性。

## 5. ToolkenGPT：把工具当成词表里的一个 token

如果工具调用的本质是「在正确的位置生成正确的符号」，那么工具本身也可以被塞进词表。ToolkenGPT（Hao et al., 2024）做的就是这件事：给每个工具一个 token（toolken）和一个对应的 embedding。

<SlideFigure lecture="04" page="33" caption="Slide 33 · ToolkenGPT 框架：预测到 toolken 后暂停生成、切到 tool-mode prompt、由 ICL 补全参数、执行后回到推理模式"></SlideFigure>

它的预测仍然是下一个 token 的分类，只是候选集合里多了工具：

$$
P(t_i \mid t_{<i}) = \mathrm{softmax}\big([W_v; W_\tau] \cdot h_{i-1}\big)
$$

$W_v$ 是原词表的输出矩阵，$W_\tau$ 是工具 embedding 拼上去的部分。训练时只在 toolken 出现的位置算损失，工具返回的结果 token 被标成 `[N/A]` 跳过——因为那些 token 不是模型生成的，不该让模型为它们负责。

这个设计的取舍很值得对照 Toolformer 看：

- **扩展成本低。** 加一个新工具只需要学一个 embedding，不动主干权重。课件 Slide 35 比较了不同工具数量下的表现，工具从几个加到上百个，曲线没有崩。
- **参数填写退回 ICL。** toolken 只负责「选哪个」，参数靠 tool-mode prompt 里的示例现学。工具越复杂、参数越多，这一段越不可靠。
- **描述不进入上下文。** 模型对工具的理解来自 embedding，而不是可读的文字说明；这省了 token，也失去了「改一句描述就能修好」的调试手段。

## 6. 规模化：ToolLLM 与 Gorilla

工具数量从 5 涨到上千，第一个撑不住的不是模型，是选择。

<SlideFigure lecture="04" page="38" caption="Slide 38 · ToolLLM 流程：从 RapidAPI 收集 API、生成指令与解法路径、微调 LLaMA 得到 ToolLLaMA，推理时用神经 API 检索器挑出相关 API"></SlideFigure>

ToolLLM（Qin et al., 2023）的做法是把「选工具」显式拆成一个检索问题：先用 API retriever 从 16k+ 真实 API 里召回一小撮候选，再让微调过的 ToolLLaMA 在候选里做决策。训练数据来自 ChatGPT 生成的解法路径，评测用 ToolEval。

数据管线值得单独看一眼（Slide 38）：收集 API、为每个 API 生成指令、采样并标注解法路径、再微调。之所以要「采样多条路径」而不是一条，是因为同一个任务可以有多种合法的调用顺序，只给一条会把其他正确解法标成错误。代价也在这里：路径的质量上限由生成模型决定，生成模型没见过的调用模式，微调后的模型也学不到。

Gorilla（Patil et al., 2023）走的是另一条路：不改推理流程，改训练数据。它从 HuggingFace、PyTorch Hub、TensorFlow Hub 收集了 1645 个 API 调用，每条以 JSON 记录 `{domain, framework, functionality, api_name, api_call, api_arguments, environment_requirements, example_code, performance, description}`，再用 GPT-4 合成指令数据做微调。

两个工作各自贡献了一个可以复用的机制：

**Retrieval Aware Training（RAT）。** Gorilla 在指令微调时故意混入正确和错误的检索上下文，让模型学会「有检索就参考，检索不对就忽略」。这样推理时可以零样本，也可以接检索，两种模式都不至于被低质量召回带偏（Slide 42）。

<SlideFigure lecture="04" page="43" caption="Slide 43 · AST 子树匹配：把模型生成的 api_call 解析成语法树，检查它是否是参考调用树的子树，用来判定是否幻觉"></SlideFigure>

**用 AST 子树匹配度量幻觉。** 判断一次 API 调用对不对，不能只比字符串：参数顺序可以不同，默认值可以省略。Gorilla 把调用解析成抽象语法树，只要模型生成的树是参考树的子树，就算合法。这个指标比精确匹配宽容，比人工评审便宜。

代价同样明显。检索器一旦漏掉正确的 API，后面的模型再强也无解——错误被前置到了召回环节。GPT-4 合成的指令会带来分布偏置：合成数据里常见的调用模式被过度代表，长尾 API 反而更少被练到。AST 匹配只验证结构，不验证语义——`torch.hub.load('pytorch/vision', 'resnet50')` 和 `'resnet101'` 的树形完全一致，但做的是两件事。

<SlideFigure lecture="04" page="45" caption="Slide 45 · 四项工作总结表：Toolformer、ToolkenGPT、ToolLLM、Gorilla 在「工具调用是什么、训练什么、标签来源、何时调、调什么、规模」六个维度上的对比"></SlideFigure>

这张表值得当作本章的索引来读。它说的其实是一件事：**「学会调用」有两半，一半是「什么时候调」（learns when），一半是「调哪个、怎么填」（learns what）。** 四项工作在这两半上各有偏重，没有一项把两半都做满。

回到那四种表示：文本（Toolformer）、一个新 token（ToolkenGPT）、ReAct 式轨迹（ToolLLM）、API 调用代码（Gorilla）。它们的差别不在模型大小，而在**工具以什么形式进入模型的计算**，以及**规模上来之后，谁来负责「选」这一步**。

## 7. 标准接口：从 REST 到 function calling 到 MCP

前面所有方法都有一个共同的成本：**每加一个 API，就要再训一次。** Slide 47 把这个矛盾摆得很直白——要么改模型去适配工具，要么改工具的描述方式，让任何模型都能用。

<SlideFigure lecture="04" page="48" caption="Slide 48 · 三代标准接口：REST（human-facing，端点加文档）、function calling（model-facing，每个工具一份 JSON schema）、MCP（ecosystem-facing，一个协议服务所有客户端）"></SlideFigure>

| 代 | 面向谁 | 形态 | 遗留问题 |
|---|---|---|---|
| REST | 人 | 端点 + 文档 + 每个服务一套鉴权 | 模型必须知道 URL、参数名与响应结构 |
| Function calling | 模型 | 每个工具一份 JSON schema，模型输出 name + args | 为某个 API 写的工具，换一个 API 要重写 |
| MCP | 生态 | 一个协议，server 暴露 tools/resources/prompts，运行时发现 | 信任边界前移到协议层 |

**REST 的问题不是不能用，而是没有机器可读的契约。** 模型可以读文档、手写请求，但文档是给人写的：它不会告诉你哪个字段可空、哪个枚举值在什么版本被废弃。Slide 49 的 `GET /v1/weather?city=SF` 就是一个典型——路径、参数名、响应形状全靠外部知识。

**Function calling 补上了契约，但没补上复用。** 工具变成一段 JSON schema，harness 负责校验与分发，模型只输出结构化调用。这是一次真正的解耦：模型不需要知道 HTTP，只需要知道 schema。但 schema 住在代码库里，换个 host 就要重新实现一遍。

**MCP 补上了复用。** 架构是 host（AI 应用）→ 多个 client → 多个 server，每个 client 与一个 server 保持专用连接，server 可以是本地的（文件系统、数据库），也可以是远程的（第三方服务）。

<SlideFigure lecture="04" page="52" caption="Slide 52 · MCP 架构：一个 host 里跑多个 client，各自通过专用连接连到本地或远程的 MCP server"></SlideFigure>

协议只定义两个动作，就够用了。第一个是发现：

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": { "_meta": {} } }
```

server 回一份列表，每个工具有 `name`、`title`、`description` 与 JSON `inputSchema`，列表还带 `ttlMs` 表示缓存多久（Slide 53）。第二个是执行：`name` 从列表里挑一个，`arguments` 按 inputSchema 填，返回值是一个 content 数组，由 host 交回给模型。

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "weather_current",
              "arguments": { "location": "Stanford", "units": "imperial" } } }
```

这套设计带来的好处是「写一次，到处能用」。课件用课程 LMS 举例：一个 `FastMCP.from_openapi(openapi_spec=..., client=...)` 就把 `GET /assignments`、`GET /submissions`、`POST /grade` 三条 REST 路由变成了 `list_assignments`、`get_submissions`、`post_grade` 三个工具，不用手写适配层。

代价在 Slide 56 出现：**鉴权分成两段。** agent 到 MCP server 是 inbound，用 `AGENT_TOKEN` 验证「谁可以调」；server 到 LMS 是 outbound，用 `LMS_TOKEN` 代表「以什么身份调」。两个 token 意味着两个失效点，也意味着权限必须被显式设计——server 成了新的信任边界，一旦它持有过宽的 outbound 凭证，任何能连上它的 agent 都继承了这份权限。

MCP 的 server 不只暴露工具：它还可以暴露 resources（可读的数据）与 prompts（预置的模板）（Slide 48）。三者共用一条连接，这也是它比 function calling 更接近「基础设施」的地方——读一份文件、取一段提示词，不需要各写一个适配器。

代价是「发现」从编译期挪到了运行时。工具清单会变，缓存需要过期策略（`ttlMs` 就是为这个问题准备的），版本不一致时还要决定是沿用被告知的旧 schema，还是重新拉一份。**静态 schema 换来确定性，动态发现换来复用，两者不能同时最大化。**

## 8. 评测：单次调用、多步链、人机对话

三种评测对应三种能力，混着看会得出错误结论。

<SlideFigure lecture="04" page="60" caption="Slide 60 · BFCL 的三类调用示例：多函数选择、并行调用、相关性检测（只提供 add 时，乘法请求应当被拒绝）；右侧是任务分类饼图"></SlideFigure>

**BFCL（Berkeley Function Calling Leaderboard）** 测的是单次调用的正确性，用三种方式打分：AST 离线匹配（结构对不对）、真实执行（结果对不对）、状态检查（多步多轮之后世界状态对不对）。它的数据来自真实用例，覆盖 Python、C++、Java、SQL 等多种语言，并且**专门测「不相关」**：给出的函数里没有一个适合当前请求时，模型应当拒绝而不是硬选一个。这条设计针对的正是第 3 节说的「工具是 prompt」——工具多的时候，最大的风险不是选错，而是非要选一个。

**ToolBench** 把规模推到 16k 真实 API（从 RapidAPI 爬取的 6000+ 个 API 加上人工整理的真实指令），配套 ToolEval 判断任务是否完成。它测的是「在真实 API 噪声下还能不能规划出多步调用链」。

<SlideFigure lecture="04" page="63" caption="Slide 63 · τ-bench 的设置：工具、领域策略作为 system prompt、用户模拟器，以及一条 τ-airline 的轨迹——agent 读数据库、按策略拒绝改签、提出取消重订"></SlideFigure>

**τ-bench** 换了评测对象：不是单次调用，也不是多步链，而是**agent 与用户的多轮交互**。它的环境有三样东西：一组工具、一份领域策略（写进 system prompt，例如「basic economy 不可改签、24 小时内可取消」）、一个用户模拟器。打分看最终数据库状态是否符合策略，而不是看对话是否流畅。Slide 63 的轨迹很典型：agent 查到票是 basic economy、仍在可取消窗口内，于是拒绝直接改签，转而提出取消重订——**正确行为是「不做用户要求的那件事」**，这类能力只有交互式评测能测出来。

多轮评测还必须处理随机性。同一个任务跑 k 次，通过率不是线性的，τ-bench 因此引入 pass^k：

<SlideFigure lecture="04" page="64" caption="Slide 64 · pass^k 的定义：k 次采样全部成功的期望概率；右侧为 τ-retail 与 τ-airline 的数据库、工具与任务规模"></SlideFigure>

$$
\mathrm{pass}^k = \mathbb{E}_{\text{task}}\left[\binom{c}{k} \Big/ \binom{n}{k}\right],
\qquad
\mathrm{pass@}k = 1 - \mathbb{E}_{\text{task}}\left[\binom{n-c}{k} \Big/ \binom{n}{k}\right]
$$

$n$ 是采样次数，$c$ 是成功次数。pass@k 回答「给 k 次机会能不能成」，pass^k 回答「k 次是不是每次都成」。前者适合衡量能力上限，后者适合衡量可靠性——**对一个要写进生产流程的 agent，后者才是相关指标**。两个公式的分母相同，差别只在分子取的是成功组合还是失败组合，但结论可以差得很远：pass@1 高而 pass^5 低的系统，在演示里很好看，在重试时不可用。

三个基准的边界也值得说清。BFCL 用 AST 匹配，能测结构、测不了「这个调用在业务上是否合适」；ToolBench 的 ToolEval 依赖另一个模型打分，打分器的偏好会渗进结论；τ-bench 依赖用户模拟器，而模拟器不会像真人那样临时改主意或给出矛盾信息。**看到任何榜单分数，先问它用的是哪种判据**——用 AST 分数推断多轮可靠性，是最常见的一种错读。

## 9. 常见失败模式

Slide 67 把失败按调用粒度分成三组，这是整讲最实用的一页。

<SlideFigure lecture="04" page="67" caption="Slide 67 · 失败模式三栏：single call（选择、参数、幻觉工具）、multi-step chain（顺序、恢复）、conversation（策略、交互、非确定性）"></SlideFigure>

| 粒度 | 失败 | 具体形态 | 该在哪里修 |
|---|---|---|---|
| 单次调用 | Selection | 选错工具，或在不需要工具时硬调 | 描述、候选集、相关性检测 |
| 单次调用 | Arguments | 编造字段、类型或单位错 | schema 约束、枚举、校验 |
| 单次调用 | Hallucinated tool | 调用一个不存在的 API | 白名单、执行前校验 |
| 多步链 | Sequencing | 跳过前置调用、顺序颠倒 | 依赖声明、状态机 |
| 多步链 | Recovery | 同一条失败调用反复重试 | 错误分类、退避策略 |
| 多轮对话 | Policy | 在规则禁止的地方动手 | 策略进 system prompt、外部检查 |
| 多轮对话 | Interaction | 该问用户时自己假设 | 澄清动作、确认门槛 |
| 多轮对话 | Non-determinism | 一次过、重跑挂 | pass^k、温度与种子控制 |

三组失败对应三种不同的修法，这一点比清单本身更重要。

**单次调用的失败大多是接口问题。** 选错工具往往是因为两个工具的描述几乎一样；参数错往往是因为 schema 没写单位；幻觉工具往往是因为 harness 没有做白名单校验。这一类失败的修复成本最低，收益也最直接——改描述、加枚举、加校验，不需要重训模型。

**多步链的失败是状态问题。** 跳过前置调用说明模型不知道工具之间的依赖；反复重试同一条失败调用说明它没有把错误当成信息。修法不在模型内部，而在 harness：把依赖写成显式约束，把错误分成「可重试」「需换参数」「需放弃」三类。

**多轮对话的失败是边界问题。** 策略违规、该问不问、重跑不一致——这三件事都无法从单条轨迹里看出来，必须用交互式评测和多次采样才能暴露。Slide 64 的 pass^k 就是为这一类设计的。

实际归因时，三组失败的区分方式是看轨迹停在哪一步：单次调用失败在第一个 `tool_call` 上就暴露；多步链失败往往要到第 n 步才发现前一步漏了；对话失败只有在完整 transcript 里才看得出「它当时该问而没问」。**trace 的完整度比日志的详细度更重要**——缺一条观测，归因就会落到错误的层，修的地方也就错了。

有一个跨组的共性值得单独提：**工具返回的错误信息也是观测。** 如果 API 报错只返回 `500 Internal Server Error`，模型唯一能学到的就是「重试」；如果返回 `city not found, did you mean San Francisco?`，它就有机会改参数。错误信息的可读性，直接决定了 Recovery 这一类失败能不能被修好。

## 10. 把工具设计当成接口设计

这一讲的方法论可以压缩成几条判断，它们都指向同一个方向：**工具的可靠性主要由接口决定，而不是由模型决定。**

- **先问「这件事该不该由模型做」。** 算术、精确匹配、状态查询交给工具；需要理解意图、权衡取舍的留给模型。把可验证的操作留在模型内部，是最常见的浪费。
- **工具数量要控制，描述质量要投资。** 每多一个工具就多一份选择成本；而当候选集里有两个用途相近的工具时，改描述比换模型有效得多。
- **schema 是契约，不是装饰。** 类型、枚举、单位、必填项、示例值，每一样都在替模型消除歧义。省掉的每一个约束，都会以参数错误的形式回来。
- **把校验和执行放在模型之外。** 模型输出意图，harness 决定是否执行。这个边界一旦模糊，prompt injection 就有了执行通道。
- **终止条件要写进设计。** RAG 的 loop-side 失败里，「没有停止规则」是最难在事后发现的一种；工具调用给了你天然的检查点——每次执行都可以判断「目标是否已经达成」。
- **评测按粒度选。** 单次调用用 AST 与执行，多步链用状态，多轮用 pass^k。用单次调用的分数去推断多轮可靠性，是最常见的评测错误。

课件在 Slide 68 用六行收尾：为什么需要工具、Toolformer 的自监督、Gorilla 的 1.6k API 与 AST 度量、REST 到 MCP 的三代接口、BFCL/ToolBench/τ-bench 的三种粒度、以及失败模式的三个层次。这六行其实就是这一讲的目录，也是后面讲框架、编排与安全时的共同语言。

## 延伸阅读

- Schick et al., [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761), NeurIPS 2023。
- Hao et al., [ToolkenGPT: Augmenting Frozen Language Models with Massive Tools via Tool Embeddings](https://arxiv.org/abs/2305.11554), NeurIPS 2023。
- Qin et al., [ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs](https://arxiv.org/abs/2307.16789), ICLR 2024。
- Patil et al., [Gorilla: Large Language Model Connected with Massive APIs](https://arxiv.org/abs/2305.15334), NeurIPS 2024。
- Yao et al., [τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045), 2024。
- Liu et al., [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172), TACL 2024。
- Wang et al., [What Are Tools Anyway? A Survey from the Language Model Perspective](https://arxiv.org/abs/2403.15452), 2024。
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) · [ToolBench](https://github.com/OpenBMB/ToolBench) · [Model Context Protocol 规范](https://modelcontextprotocol.io/specification/2025-06-18)。

## 自测

**1. Toolformer 的损失过滤在衡量什么？它漏掉了什么？**

<details>
<summary>答案</summary>

它衡量的是「在这个位置插入调用与返回结果之后，后续 token 的加权交叉熵是否下降」，下降幅度超过阈值 $\tau_f$ 才保留。它没有衡量调用本身是否正确：一次错误的检索如果让文本更通顺，损失也会下降，标注就会被保留。此外它只看一步的局部收益，学不到多步依赖。

</details>

**2. 为什么说 function calling 解决了契约问题，但没有解决复用问题？**

<details>
<summary>答案</summary>

function calling 用 JSON schema 把「工具怎么调」变成机器可读的契约，模型只输出 name 和 arguments，不再需要理解 HTTP。但 schema 仍然住在某个 host 的代码库里，换一个应用就要重新实现一遍。MCP 把工具挪到独立的 server 后面，用统一协议在运行时发现和调用，才解决复用。

</details>

**3. pass@k 与 pass^k 的分母一样，为什么结论会差很远？**

<details>
<summary>答案</summary>

两者都从 n 次采样里取 k 次组合。pass@k 取的是「至少一次成功」的概率，衡量能力上限，适合看模型能否做到；pass^k 取的是「k 次全部成功」的概率，衡量可靠性，适合判断能不能上生产。一个 pass@1 高但 pass^5 低的系统，重试时表现会明显退化，而这在单次评测里看不出来。

</details>
