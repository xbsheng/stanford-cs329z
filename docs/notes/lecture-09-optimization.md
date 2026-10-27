---
title: "9 · 优化：用数据换行为"
description: "Stanford CS329Z 第九讲：优化前提、上下文优化（MIPROv2、OPRO、TextGrad、GEPA）、权重优化（agent SFT、PPO/GRPO、on-policy distillation）与 agent 作为优化器。"
outline: [2, 3]
---

# 9 · 优化：用数据换行为

<div class="meta-card">
<p><strong>2026-10-21 · Diyi Yang、Michael Ryan、John Yang · 125 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture09.pdf" target="_blank" rel="noreferrer">lecture09.pdf</a> · 课程主页：<a href="https://cs329z.stanford.edu/" target="_blank" rel="noreferrer">cs329z.stanford.edu</a></p>
<p>课程位置：第 5 周 · 系统与优化；前八讲搭系统、管数据、做评测，这一讲把它们变成行为改变。</p>
</div>

## 本讲速览

- **优化的定义是「用数据与评测表达意图」。** 提示词说不清的需求，示例和打分器能说清；优化的本质是把这些示例与分数编译进上下文或权重。
- **优化的前提是三件套齐全：数据、系统、评测。** 缺任何一件，你只是在调参而不是在优化——因为你无法判断改动是否真的变好。
- **上下文优化便宜、快、可逆，但会消耗上下文。** few-shot 自举、指令搜索、文本梯度、Pareto 进化都属于这一类，它们不碰权重，只改 prompt 里放什么。
- **权重优化贵、慢、不可逆，但能改变模型本身的行为分布。** SFT 模仿 teacher 的轨迹，PPO/GRPO 用可验证奖励做强化，on-policy distillation 在 student 自己的轨迹上对齐 teacher。
- **GRPO 相对 PPO 的核心减法是不训练 value model。** 用同一 prompt 的一组输出做组内标准化得到优势，把四个模型减到三个，把每 token 的评论家换成序列级的比较。
- **agent 本身可以当优化器。** Darwin Gödel Machine 让 agent 改自己的代码并在 archive 里保留分支，Meta-Harness 与 autoresearch 让 meta agent 反复改 harness、跑实验、记日志。
- **选择策略看约束而不是看潮流。** 只能调 API、要快速迭代、环境交互昂贵时选上下文；小模型听不懂指令、有强 teacher 要蒸馏、prompt 已经膨胀时选权重。

## 1. 什么时候值得优化

课件在第 8 页给出优化的门槛，三根柱子必须同时在场：

<SlideFigure lecture="09" page="8" caption="Slide 8 · AI 系统的三根柱子：Data（训练数据、rollout、演示、人类反馈）、System or Model（模型、复合系统、agent）、Evaluation + Metric（pass rate、exact match、LLM judge、成本与延迟）"></SlideFigure>

**数据**提供「你想要什么」的样本，**系统**是被改动的对象，**评测**提供「改得对不对」的信号。课件在这页底部写得很直接：*To optimize an AI System you need all three!* 这句话解释了为什么很多团队优化做不动——他们有系统，没有数据，或者有数据但没有能复现的评测，于是每次改动都只能靠肉眼判断。

第 10 页把「什么时候优化」写成了四条可操作的判据：

- 你有适配特定领域的数据与评测；
- 示例与反馈能表达 prompt 里难以写全的要求；
- 评测本身比 prompt 更能传达意图，于是你可以直接对着评测调系统；
- 系统有太多复杂部件，手工调不动。

第 11 页列出优化的收益，五条都指向同一个方向：**可靠性、领域适配、更低的成本与延迟、从经验中学习、随模型与工具变化而保持适应**。其中「用更小的模型、更短的 prompt、更少的工具调用维持质量」这一条最容易被忽略——优化不总是为了涨点，也为了降价。

### 1.1 为什么提示词仍然值得改

课件第 3 页用一个投票开场：同一个数学题，三种提示词在 PaLM 2-L-IT 上的准确率分别是 71.8%、80.2%、74.5%。

<SlideFigure lecture="09" page="9" caption="Slide 9 · 最后一公里：模型给出通用的好答案，优化负责把它适配到你的具体设定"></SlideFigure>

最好的是 B，「Take a deep breath and work on this problem step-by-step.」，80.2%；最朴素的 A「Let's think step by step.」只有 71.8%。同一模型、同一道题，只改了措辞，差 8.4 个百分点。

这页的意义不在于记住哪句话好，而在于承认两件事：**第一，提示词确实是一个可优化的参数空间**；**第二，这个空间没有可解释的结构**——你没法从「深呼吸」推导出它为什么有用，只能测。所以第 9 页把优化定位成 **last mile adaptation**：模型提供通用解，优化负责最后一段适配。

代价也要说清楚：这类收益是分布内的、任务特定的，换模型、换数据分布就可能失效。它便宜，但不牢靠。

## 2. 上下文优化（一）：few-shot 的顺序与自举

上下文优化的对象是「prompt 里放什么」：放哪些示例、按什么顺序放、写什么指令。它不改变权重，所以可以在一夜之间重跑一遍。

### 2.1 顺序本身就是一个参数

Lu et al.（2022）的 *Fantastically Ordered Prompts* 指出了一个反直觉的现象：**同一批 few-shot 示例，只改变排列顺序，模型的输出会系统性翻转**。

<SlideFigure lecture="09" page="15" caption="Slide 15 · 在训练集上枚举示例顺序，用 probing set 上的标签变化来衡量顺序的好坏；注意 probing set 的真标签被刻意忽略"></SlideFigure>

课件把方法写得比论文更简洁：在训练集上试一批顺序，观察这些顺序如何改变 probing set 上的预测标签，而**故意不看 probing set 的 ground truth**。原因很实际——如果优化过程能看到 probing set 的答案，你测的就不是「顺序好不好」，而是「有没有过拟合 probing set」。

于是需要一个不需要标签的代理指标：熵。

$$
\mathrm{GlobalE}_m = \sum_{v \in V} -p_m^v \log p_m^v
\qquad
\mathrm{LocalE}_m = \frac{\sum_i \sum_{v \in V} -p_{i,m}^v \log p_{i,m}^v}{|D|}
$$

Global 熵看的是模型在整个标签集合上的边缘分布有多平坦，Local 熵看的是逐样本预测分布的平均尖锐程度。

第 16、17 页用几句电影评论演示这件事：高全局熵意味着模型对四个样本给出了分散的预测，低全局熵意味着它把所有样本压到同一个标签上——后者看起来「自信」，其实是没有区分度。第 18 页给出结论：**用 probing set 上的熵做选择，准确率能逼近「枚举所有顺序、在 dev set 上挑最好」的 oracle 排序**。

这条结论的工程含义是：当标注很贵、但模型输出概率可读时，熵是一个可用的排序信号。代价是它只适用于分类式输出，且需要能拿到 logprobs——闭源 API 往往不给。

### 2.2 自举推理：把模型自己的成功轨迹变成示例

few-shot 的另一个瓶颈是：示例里通常只有答案，没有推理过程。而 CoT 的价值恰恰在推理过程。

DSPy（Khattab et al., 2023）的做法是**拒绝采样**：让模型对训练输入跑一遍，用 metric 打分，高分的「推理 + 输出」留下当示例，低分的丢掉；然后在 dev set 上尝试不同示例组合，选出最好的一组。

<SlideFigure lecture="09" page="21" caption="Slide 21 · DSPy 的自举：完整推理加输出被 metric 判定通过则保留、否则丢弃，再在 dev set 上搜索组合"></SlideFigure>

课件强调 *We don't even need to fine-tune*——同一套拒绝采样，既可以用来构造 prompt，也可以用来构造微调数据（STaR 走的是后者）。

第 22 页的对比结论值得单独记住：**自举出来的推理，配上在训练集上的随机搜索，可以优于人工写的推理或 gold label 示例**。这个结论有点刺人——它说明「示例的质量」不等于「人的专家判断」，而等于「与当前模型分布匹配的程度」。人写的推理是给读者看的，自举的推理是给同一个模型看的。

代价有三条：自举只能采到模型已经会的任务，做不对的任务永远没有正样本；metric 决定了留下什么，metric 有偏就会自举出有偏的示例；每次换模型都要重新自举，示例不可跨模型复用。

## 3. 上下文优化（二）：反思式优化

自举解决的是「示例从哪来」，反思式优化解决的是「指令怎么写」。后者的共同假设是：**模型可以读懂自己失败在哪里，并据此写出更好的指令**。

### 3.1 OPRO：把优化过程写成一段 prompt

Yang et al.（2024）的 OPRO 把「过去试过哪些指令、各自得分多少」一起塞进 meta-prompt，让模型写一条新的指令。

细节在 meta-prompt 本身里：示例按分数**升序**排列，并明确告诉模型「分数越高越好」「你的输出要和已有答案不同」。这是一个很省事的技巧——不需要梯度，只需要排序和一个能打分的评估器。

第 25 页展示它找到的策略之一就是「Take a deep breath...」，正好呼应第 3 页的投票。这说明 OPRO 找回的是人类凭直觉也能摸到、但说不清理由的那类指令。

**判断：OPRO 适合「有稳定打分器、候选空间是自然语言」的场景。** 代价是它把搜索预算全部花在 LLM 调用上，且历史窗口有限——候选一多，meta-prompt 就装不下，只能做局部爬山。

### 3.2 MIPROv2：把「接地」做进指令提案

MIPROv2（Opsahl-Ong et al., 2024）把上下文优化拆成三个可分别检查的步骤：

1. **Bootstrap demonstrations**：反复运行程序，收集指标高的 trace 作为演示。
2. **Propose instructions**：用「接地」过的上下文让提案模型写指令。
3. **Search combinations**：联合搜索指令与演示的组合。

<SlideFigure lecture="09" page="26" caption="Slide 26 · MIPROv2 的三个阶段：① 自举演示 ② 基于反思提出指令候选 ③ 搜索指令与演示的组合"></SlideFigure>

第二步是这套方法的核心。课件在第 36–44 页逐个展示接地的四种来源：**程序摘要**（这段代码要解决什么问题）、**数据摘要**（字段分布、类别有哪些、哪些字段没信息量）、**成功的自举轨迹**、以及一组**提示技巧**。

值得注意的是第 44 页那句 *We only show one of these at a time*：提示技巧一次只给一条——「要大胆创意」「设定高风险情境」「给模型一个人设」「保持简洁」。一次给全部会让提案模型无法归因，也就无法判断哪条技巧真的有用。

第三步的搜索（第 48–62 页）用贝叶斯代理模型维护「某条指令 / 某组演示有多好」的信念，按信念采样组合，在小批量上跑、每隔若干迭代做一次全量评估，重复 `num_batches` 次。

**代价：指令与演示是耦合的**，单独优化任一方都会得到次优解，所以必须联合搜索；而联合搜索的空间是乘积，只能用代理模型 + 小批量近似。全量评估很贵，课件也只能「每隔几次迭代做一次」。

## 4. 上下文优化（三）：文本梯度与 Pareto 进化

### 4.1 TextGrad：把梯度换成一句话

TextGrad（Yuksekgonul et al., 2024）的类比很干净：反向传播传的是数值梯度，这里传的是**自然语言反馈**。

<SlideFigure lecture="09" page="64" caption="Slide 64 · TextGrad：LLM 对输出写自然语言反馈（“this prompt can be improved by…”），把反馈当作梯度反传回各个 prompt；右侧的对比把 prompt 优化从 77.8% 提到 91.9%"></SlideFigure>

一条计算图里，LLM 调用、搜索、工具调用都是节点；损失节点让 LLM 写「这个输出哪里可以改进」，这段文本沿着边回传，每个 prompt 节点据此改写自己。课件给的例子是一次问答任务的 prompt 优化：77.8% → 91.9%。

为什么这有用？因为**文本反馈携带的是方向，而不是步长**。它不像数值梯度那样需要可微，也不要求模型开放 logprobs，所以能用在纯 API 的黑盒系统上。代价同样来自这一点：没有步长就没有收敛保证，反馈质量完全取决于那个「写评语」的 LLM，而且一次只能改一点点，迭代次数多。

### 4.2 GEPA：在 Pareto 前沿上做遗传

GEPA（Agrawal et al., 2026）把 prompt 优化写成遗传算法，两个设计值得记住：

- **Pareto-based candidate filtering**：候选池不是按平均分排序，而是按「在每个任务上是否最优」保留。一个只在某个任务上强、其余任务平庸的 prompt 也能活下来，因为它守在 Pareto 前沿上。
- **Reflective prompt mutation + system-aware merge**：变异时给模型看失败轨迹和反馈，让它有针对性地改；合并时按模块选择性继承——某个模块在候选 A 里更好就取 A 的，另一个模块在 B 里更好就取 B 的。

<SlideFigure lecture="09" page="65" caption="Slide 65 · 左：候选池与逐任务得分矩阵；右：Reflective Prompt Mutation 与 System Aware Merge 两条产生新候选的路径"></SlideFigure>

Pareto 过滤解决的是 prompt 优化的一个真实故障：**平均分会把专家淘汰掉**。多任务系统里，能让所有任务都及格但都不突出的 prompt，往往打不过「三个任务极强、一个任务崩掉」的 prompt——而后者一旦遇到那个崩掉的任务就是事故。按前沿保留，等于保留了多样性。

第 68 页的结论只有一句：reflective prompt evolution 在各任务上优于 baseline。课件没有给具体数字，笔记也不替它补。

## 5. 权重优化（一）：在 agent rollout 上做 SFT

上下文优化改的是「模型看到什么」，权重优化改的是「模型倾向做什么」。前者是外挂，后者是内化。

### 5.1 从交叉熵说起

SFT 的目标函数没有变化，还是逐 token 的交叉熵：

$$
L = -\sum_{i=1}^{V} y_i \log p_i
$$

$y_i$ 是 one-hot：数据里出现的 token 为 1，其余为 0；$p_i$ 是模型给该 token 的概率，$\log p_i$ 是它的对数概率。课件在第 72 页把三个部件逐一圈出来，提醒的是最容易被糊弄过去的一点：**这个损失对词汇表里每个 token 都算，只是只有一个位置有非零权重**。

<SlideFigure lecture="09" page="72" caption="Slide 72 · 交叉熵损失的分解：对词汇表中每个 token 求和、one-hot 标签、该 token 的对数概率"></SlideFigure>

### 5.2 agent 场景的 SFT 长什么样

第 74 页把 agent SFT 的流程写成四步：

- 让 teacher 在 agent 任务上 rollout；
- 用 teacher 完成的任务对 student 做后训练；
- 重视任务与环境的**多样性**；
- student 学到的是任务执行，而不是某个任务的答案。

第 75 页补了一个工程细节：teacher 跑完任务后直接训是可行的，但如果输出**可以被验证**（测试通过、命令成功、文件内容正确），就可以用拒绝采样只留成功的轨迹。这条比「全量模仿」稳得多，因为它把 teacher 的失败也过滤掉了。

<SlideFigure lecture="09" page="78" caption="Slide 78 · FireAct：用 CoT / ReAct / Reflexion 三种推理模式采 GPT-4 轨迹，微调 Llama2；推理时不指定模式，让模型自己选"></SlideFigure>

FireAct（Chen et al., 2023）给了一个具体的对照：**用 GPT-4 的 rollout 微调 Llama2-13B，得到的 agent 强于直接 prompt 的 GPT-3.5**。它的另一个设计是训练时混合 CoT、ReAct、Reflexion 三种模式，推理时不告诉模型用哪种，让它自己选——相当于把「该用哪种推理」也当成一项可学的技能。

OpenThoughts-Agent（Raoof et al., 2026）把这条流水线拆成六个阶段：source tasks → mix tasks → filter tasks → generate rollouts → filter rollouts → final recipe。课件在这里插了一句 *Stay tuned for the Agent Data lectures*——数据配方本身就是后面讲次的主题。

**代价：SFT 的上限是 teacher。** 它只能模仿，不能超越；teacher 的系统性错误会被原样学走；而且它是 off-policy 的——训练数据来自 teacher 的分布，student 部署时遇到的却是自己分布里的状态，误差会累积。这一点在第 98 页的表格里被形式化成「off-policy + dense reward」。

## 6. 权重优化（二）：PPO 与 GRPO

当奖励可以被验证（单元测试、答案匹配、任务完成），强化学习就不需要人类偏好模型，直接用规则打分即可。

### 6.1 PPO 的账

<SlideFigure lecture="09" page="84" caption="Slide 84 · PPO 的四个模型：policy（训练）、value（训练）、reference（冻结，算 token 级 KL）、reward（冻结，给整条输出一个奖励），再由 GAE 折成逐 token 优势"></SlideFigure>

第 84 页的图信息密度最高，值得逐个读：

- policy model 生成输出 $o$；
- reference model 算 **per-token KL**，防止策略跑太远；
- reward model 给**整条输出一个奖励**；
- value model 给**每个 token 一个价值**；
- 两者经 GAE 折成逐 token 的优势 $A$：*how useful is this token compared to other possible tokens?*

第 85–87 页把成本摊开：**四个模型常驻显存，每步训练两个，而且要做若干次昂贵的逐 token 计算**。对 agent 这种 rollout 动辄几千 token 的场景，这个账很难算平。

### 6.2 GRPO 的减法

<SlideFigure lecture="09" page="88" caption="Slide 88 · GRPO：同一 prompt 采一组输出、各自打分，用组内标准化得到优势，取消 value model；三个模型常驻，一个训练"></SlideFigure>

GRPO 的改动只有一处，但影响很大：**不再训练 value model，改用同一 prompt 的一组输出之间的相对好坏来定义优势**。

$$
\hat{A}_{i,t} = \frac{R_i - \operatorname{mean}(\{R_1, \dots, R_G\})}{\operatorname{std}(\{R_1, \dots, R_G\})}
$$

就是组内 z-score。一条输出比同组的其他输出好，它的所有 token 都得到正优势；差就得到负优势。省掉的是「这个 token 本身有多好」的绝对估计，换来的是三个模型、一个训练、只有 KL 是 token 级的。

目标函数（第 93 页）：

$$
J_{\mathrm{GRPO}}(\theta) = \mathbb{E}_{q \sim P(Q),\, \{o_i\} \sim \pi_{\theta_{old}}} \left[ \frac{1}{G} \sum_{i=1}^{G} \frac{1}{|o_i|} \sum_{t=1}^{|o_i|} \left( \min\left( r_{i,t}\hat{A}_{i,t},\ \operatorname{clip}(r_{i,t}, 1-\epsilon, 1+\epsilon)\hat{A}_{i,t} \right) - \beta\, D_{\mathrm{KL}}[\pi_\theta \,\|\, \pi_{ref}] \right) \right]
$$

其中重要性比率

$$
r_{i,t} = \frac{\pi_\theta(o_{i,t} \mid q, o_{i,<t})}{\pi_{\theta_{old}}(o_{i,t} \mid q, o_{i,<t})}
$$

逐项翻译课件的标注：外层期望是对数据集里的 prompt 与该 prompt 的一组采样输出求的；$\frac{1}{G}\sum$ 是组内平均，$\frac{1}{|o_i|}\sum_t$ 是输出内逐 token 平均；$r_{i,t}$ 衡量「新策略相对旧策略有多看重这个 token」；$\min$ 与 $\operatorname{clip}$ 一起构成 PPO 式的信赖域，避免在单个 token 上更新过猛；$\beta D_{\mathrm{KL}}$ 把策略拉在 reference 附近。

<SlideFigure lecture="09" page="93" caption="Slide 93 · GRPO 目标函数的逐项标注：组内平均、token 平均、重要性比率、clip、优势、KL 正则"></SlideFigure>

DeepSeek-R1 的报告（第 94–95 页）给了 GRPO 与 PPO 在 MATH 上的对照：相同步数下 GRPO 的准确率曲线高于 PPO（λ=0.95 与 λ=1.0 两条）。课件只放曲线，不解释差异来源；从机制上看，省掉 value model 既省显存也省掉一个「估计不准会污染优势」的误差源。

**代价：组内奖励全同的时候优势为 0。** 一个 prompt 如果一组输出全对或全错，z-score 的分母为 0，这一组不产生梯度——所以题目难度必须落在「有时对、有时错」的区间，这也是为什么课件反复强调 verifiability 与任务难度分布。

## 7. 权重优化（三）：on-policy distillation

SFT 的问题在分布：你训的是 teacher 走过的状态，student 部署时会走到自己走出来的状态。RL 的问题在信号：奖励只有一个标量，稀疏且噪声大。on-policy distillation 想同时避开这两个问题。

<SlideFigure lecture="09" page="99" caption="Slide 99 · 三种方法的坐标：SFT 是 off-policy + dense reward，RL 是 on-policy + sparse reward，on-policy distillation 是 on-policy + dense reward"></SlideFigure>

课件的类比很传神：**下棋时，你希望教练点评的是你真正下过的那盘棋，而不是你旁观过的一盘棋**。student 自己采样轨迹（on-policy，状态分布对得上），teacher 对这条轨迹的每个 token 给出完整分布（dense，信号不只是对错）。

损失函数（第 100 页）：

$$
\mathrm{KL}\left(\pi_\theta \,\|\, \pi_{teacher}\right) = \mathbb{E}_{x \sim \pi_\theta} \left[ \log \pi_\theta(x_{t+1} \mid x_{1..t}) - \log \pi_{teacher}(x_{t+1} \mid x_{1..t}) \right]
$$

期望的下标是 $x \sim \pi_\theta$，这是「on-policy」的全部含义；括号里逐 token 的差是「dense」的全部含义。

第 103 页给了一张来自 Qwen3 技术报告的表：

| 方法 | AIME'24 | GPQA-Diamond | GPU Hours |
|---|---|---|---|
| Off-policy distillation | 55.0% | 55.6% | 未报告 |
| + Reinforcement learning | 67.6% | 61.3% | 17,920 |
| + On-policy distillation | 74.4% | 63.3% | 1,800 |

课件的结论是：**on-policy distillation 比 RL 更高效，得到的模型也更好**。用十分之一的 GPU 时数换更高的分数，这个对比是这一节最有说服力的地方。

**代价：你需要一个强 teacher，而且能拿到它的 logprobs。** 只在 API 上开放采样、不开放分布的 teacher，做不了这个方法——这时只能退回拒绝采样式的 SFT。

## 8. Agent 作为优化器：Darwin Gödel Machine

前面几节里，优化器是人写的算法。这一节把优化器换成 agent 自己。

<SlideFigure lecture="09" page="107" caption="Slide 107 · Darwin Gödel Machine：archive 里保存多个 agent 版本，按性能成正比、按子代数量成反比选择父代；父代自我修改后在 benchmark 上评估，通过就加入 archive"></SlideFigure>

DGM（Zhang et al., 2026）的循环只有四个动作：**select → self-modify → evaluate → add**。两个设计选择是它的全部要点：

- **父代选择按性能成正比、按子代数量成反比。** 前者是 exploitation，后者防止某个强个体被反复复制、把 archive 变成它的克隆场。
- **archive 保留所有历史版本，而不是只保留最新的。** 这样可以从更早的父代重新出发。

第 109 页明确说：**自我改进（父代改自己，而不是由一个 meta agent 改它）与开放式探索（回到早先的父代，而不是永远在最新版本上迭代）两者都关键**。消融曲线里，「DGM w/o open-ended exploration」与「DGM w/o self-improve」都明显低于完整的 DGM。

同一页的曲线能看到这种探索的收益：完整 DGM 在 80 次迭代内把 SWE-bench 分数从 0.20 推到 0.50 附近，Polyglot 从 0.15 推到 0.35 附近，而且中途有几次阶跃——那些阶跃对应「找到了一个新的、可复用的自我修改」。

**代价：这是一台会自我改代码的机器。** 它需要沙箱、需要可回滚的版本控制、需要防止它改评测而不是改能力。archive 里的每个版本都是一次真实的训练与评估开销，迭代 80 次意味着 80 次完整评测。

## 9. Agent 作为优化器：Meta-Harness 与 autoresearch

DGM 优化的是 agent 自己的代码；Meta-Harness 与 autoresearch 把优化对象放宽到「任何跑在软件上的东西」。

<SlideFigure lecture="09" page="110" caption="Slide 110 · Meta-Harness：文件系统保存全部历史（提议的代码、推理轨迹、评测分数），meta agent 读取后提议新的 harness 代码，评测结果再写回文件系统"></SlideFigure>

Meta-Harness（第 110–111 页）的关键在于**上下文就是经验库**：所有历史提议、轨迹、分数都写在文件系统里，meta agent 每次都能看到全部，再决定改哪里。它优化的是 harness——也就是包在模型外面的那层脚手架。

第 111 页给出 TerminalBench-2 的结果：Meta-Harness 的 pass rate 是 37.6，高于 Goose（35.5）、Terminus-KIRA（33.7）、Mini-SWE-Agent（29.8）、Terminus-2（28.3）与 Claude Code（27.5）。

这个结果的含义比数字本身更重要：**在同一个模型上，harness 的差别可以抵得上换一个模型**，而 harness 是可以被自动搜索的。

<SlideFigure lecture="09" page="113" caption="Slide 113 · Auto-Research 的循环：读上下文 → 提议改动 → commit 并训练 → 指标变好则保留，否则 git reset → 把结论写进 results.tsv"></SlideFigure>

autoresearch 的循环更朴素：给 agent 一个代码库，让它 brainstorm、写一个改动、跑实验看指标有没有变好，好就留下继续叠，不好就 `git reset`，并把这次尝试写进 `results.tsv`。

第 116 页把这一节收成三句：**agent 是相当有能力的优化器**；**给它一个能记录结果、能构思、能执行的环境，它就能优化任何跑在软件上的东西**；**指标与评测因此成为最需要控制的部分**。

最后一句是这一讲的暗线。课件第 113 页引用的那篇文章，标题就叫 *How to stop your autoresearch loop from cheating*——当优化器足够强，它会去找评测的漏洞，而不是去解决问题。**能被优化的指标，一定会被优化到失真**，这是把 agent 当优化器时必须先接受的前提。

## 10. 提示优化 vs 权重优化：怎么选

### 10.1 它们不是互斥的

<SlideFigure lecture="09" page="118" caption="Slide 118 · BetterTogether 的交替策略：先在 prompt 上优化，再把结果拿去微调权重，然后在新的权重上再优化 prompt"></SlideFigure>

BetterTogether（Soylu et al., 2024）的结论只有一句：**有时候最好的做法是先优化 prompt，再优化权重，然后再优化 prompt**。第 118 页的表格给了三种交替顺序的对比（II→Θ、Θ→II、II→Θ→II）；在课件展示的表格里，从权重回到 prompt 再搜一次通常还能再涨一点。

机制上不难理解：prompt 优化会找到「当前权重下」的好指令，权重被这批数据改变后，最优指令的位置也移动了，所以要再搜一次。代价是两套基础设施都要有，而且总预算被切成三段。

### 10.2 样本效率的不对称

<SlideFigure lecture="09" page="119" caption="Slide 119 · GEPA 与 MIPROv2、GRPO、baseline 在 HotpotQA 与 IFBench 上的对比：横轴是 rollout 次数，prompt 优化在极少的 rollout 内就到顶"></SlideFigure>

第 119 页把这种不对称画得很清楚：横轴是 rollout 次数，纵轴是分数。prompt 优化方法在几百到几千次 rollout 内就接近平台，而 GRPO 要两万多次才爬到相近的水平。

第 120 页给了另一半：**权重优化更吃数据，但能随着成千上万的样本继续增长**。也就是说，上下文优化的曲线早早饱和，权重优化的曲线起得慢但天花板更高。

### 10.3 一张决策表

| 约束 | 选上下文优化 | 选权重优化 |
|---|---|---|
| 模型访问 | 只有 API，不能微调 | 能拿到权重与训练基础设施 |
| 迭代速度 | 需要频繁、快速重跑 | 可以接受一次长周期训练 |
| 数据量 | 几十到几百条，环境交互昂贵 | 数千条以上，且能持续产出 |
| 模型能力 | 指令遵循已经够用 | 小模型指令遵循很差 |
| 上下文长度 | prompt 还有空间 | prompt 已经膨胀到影响效果 |
| teacher | 无 | 有强 teacher，想要更便宜的 student |

课件的两张理由页（第 121、122 页）就是这张表的文字版。左边三条：API 模型不给微调权限；需要快速重跑，上下文优化跑得更快、基础设施更简单；环境交互昂贵，上下文优化样本效率更高。右边三条：上下文优化会失败，小模型的指令遵循能力可能接近于零；你有强 teacher 且想要更便宜的模型，直接蒸馏进 student 往往有效；上下文已经太长，prompt 优化会继续加复杂度，这时用权重优化来避免上下文膨胀。

最后一条最容易被低估：**上下文优化是有成本的，它把成本从训练转移到了推理**。每加一段指令、每多一组示例，每次调用都要付一遍 token 费，而且长上下文本身会稀释注意力。权重优化把这些知识压进参数，推理时零成本——这就是为什么在长跑里，权重优化往往更划算。

## 延伸阅读

- Lu et al., [Fantastically Ordered Prompts and Where to Find Them](https://aclanthology.org/2022.acl-long.556/), ACL 2022。
- Zelikman et al., [STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465), NeurIPS 2022。
- Khattab et al., [DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines](https://arxiv.org/abs/2310.03714), ICLR 2024。
- Yang et al., [Large Language Models as Optimizers](https://arxiv.org/abs/2309.03409), ICLR 2024（OPRO）。
- Opsahl-Ong et al., [Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs](https://aclanthology.org/2024.emnlp-main.525/), EMNLP 2024（MIPROv2）。
- Yuksekgonul et al., [TextGrad: Automatic Differentiation via Text](https://arxiv.org/abs/2406.07496), 2024。
- Agrawal et al., [GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457), 2026。
- Chen et al., [FireAct: Toward Language Agent Fine-tuning](https://arxiv.org/abs/2310.05915), 2023。
- Raoof et al., [OpenThoughts-Agent](https://arxiv.org/abs/2606.24855), 2026。
- DeepSeek-AI, [DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948), 2025。
- Thinking Machines, [On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/)。
- Zhang et al., [Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents](https://arxiv.org/abs/2505.22954), 2026。
- [Meta-Harness](https://arxiv.org/abs/2603.28052), 2026。
- Soylu et al., [BetterTogether: Leveraging Prompt Optimization for Better Fine-Tuning](https://aclanthology.org/2024.emnlp-main.597/), EMNLP 2024。
- Karpathy, [autoresearch](https://github.com/karpathy/autoresearch)。
- Cerebras, [How to stop your autoresearch loop from cheating](https://www.cerebras.ai/blog/how-to-stop-your-autoresearch-loop-from-cheating)。

## 自测

**1. 为什么说「没有评测就不叫优化」？**

<details>
<summary>答案</summary>

优化的定义是用数据与评测表达意图，并据此改进系统。没有可复现的评测，你无法判断一次改动是变好还是变差，只能凭肉眼挑几个例子看——这既无法排除过拟合，也无法在多次改动之间比较。课件第 8 页把 data、system、eval 三者并列为前提，缺一件就退化成调参。反过来说，评测本身也是一种意图表达：能写出打分器，往往比能写出 prompt 更清楚自己要什么。

</details>

**2. GRPO 相比 PPO 省掉了什么，代价是什么？**

<details>
<summary>答案</summary>

省掉的是 value model：PPO 需要四个模型（policy、value、reference、reward）、每步训练两个，并对每个 token 做价值估计；GRPO 用同一 prompt 的一组输出做组内 z-score 当优势，只剩三个模型、每步训练一个，只有 KL 是 token 级的。代价是优势变成序列级、组内相对量：如果一组输出全对或全错，标准差为零，这一组不产生梯度；因此任务难度必须落在「有时对、有时错」的区间，奖励也必须可验证。

</details>

**3. 什么时候应该放弃 prompt 优化去做权重优化？**

<details>
<summary>答案</summary>

三种典型情形：小模型的指令遵循能力太弱，prompt 优化没有可优化的基础；你有一个强 teacher 且想要更便宜的 student，直接蒸馏更划算；prompt 已经膨胀到影响效果与成本，继续加指令只会稀释注意力、把成本转到推理。另外当数据量到数千条以上时，权重优化的曲线还能继续涨，而 prompt 优化早已饱和。反过来，只能调 API、需要快速迭代、环境交互昂贵时，应当留在上下文优化。

</details>
