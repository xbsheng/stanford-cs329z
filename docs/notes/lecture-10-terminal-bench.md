---
title: "10 · Terminal-Bench：在终端里考 agent"
description: "Stanford CS329Z 第 10 讲客座讲座：从演绎到归纳的技术创造、Terminal-Bench 的任务结构与设计原则、验证器与 reward hacking、评测基础设施，以及「任务也是软件」的持续维护观。"
outline: [2, 3]
---

# 10 · Terminal-Bench：在终端里考 agent

<div class="meta-card">
<p><strong>2026-10-26 · Alex Shaw、Ryan Marten（Laude Institute）· 64 slides</strong></p>
<p>Slides：<a href="https://web.stanford.edu/class/cs329z/slides/lecture10.pdf" target="_blank" rel="noreferrer">lecture10.pdf</a> · 项目：<a href="https://www.tbench.ai/" target="_blank" rel="noreferrer">tbench.ai</a> · 课程位置：第 6 周 · 客座讲座。</p>
</div>

<SlideFigure lecture="10" page="1" caption="Slide 1 · 客座讲座：Evaluating Agents — Terminal-Bench and Harbor"></SlideFigure>

## 本讲速览

- **技术创造正在从演绎转向归纳。** 过去人写规则、程序套用输入；现在人给输入与输出，训练推出规则。Agent 把这件事推到第三层：模型自己生成软件。
- **规格让位给评测。** 当规则不再由人写，specifier 仍然是软件工程师，但 evaluator 变成了一个需要被设计、被验证、被版本化的东西。
- **Terminal-Bench 的核心判断是「bash 是唯一工具」。** 与其为每个任务发明工具接口，不如给 agent 一个 shell，让动作空间与真实世界对齐。
- **任务是软件，软件有 bug。** 任务会因依赖漂移、验证器过严、模型行为变化而失效，因此需要 CI、版本化与完整的 trial 记录。
- **评测的可信度来自四件事**：指令与验证器对齐、防止 reward hacking、环境接近生产、结果可复现。
- **Harbor 把「一个基准」变成「造基准的工具」**：前者由作者维护评测，后者让任何人定义并运行自己的评测。

## 1. 一条历史线：从机器码到 agent

讲座开场是一段软件工程史，节奏很轻，但落点很重：

| 年代 | 形态 | 例子 |
|---|---|---|
| 1940s | 直接写机器指令 | `48 83 C0 05`（x86 的 `add rax, 5`） |
| 1950s 初 | 汇编 | `add rax, 5` |
| 1950s 末 | 高级语言 | `x += 5` |
| 2020s | 自然语言 + 生成 | 「把 `/app/schematic.png` 里的零件导出成 STEP 文件」 |

<SlideFigure lecture="10" page="17" caption="Slide 17 · Software → ML → LLMs → Agents：技术创造的抽象层级一路抬高"></SlideFigure>

这条线的每一次跃迁都伴随一次「编码会消失」的预言。讲座引了 1954 年 IBM FORTRAN 报告里的话——**"FORTRAN should virtually eliminate coding and debugging"**——然后让听众自己体会这句话的结局：编码没有消失，只是换了一种形态。

1950 年代还有一句更刻薄的引语，来自 John Backus：程序员一度把自己看作「守护着凡人无法理解的技艺与秘密的祭司」。每一次抽象抬升，都会让一批人失去「只有我会」的位置，也让更多人获得入口。

## 2. 从演绎到归纳：谁来做 evaluator

<SlideFigure lecture="10" page="11" caption="Slide 11 · 演绎式技术创造：人写规则，程序把规则套用到新输入上"></SlideFigure>

课件把两种技术创造方式并排放：

<div class="flow">
  <div class="flow__step"><strong>Deductive</strong><small>Rules + Inputs → Outputs</small></div>
  <div class="flow__step"><strong>Inductive</strong><small>Inputs + Outputs → Rules</small></div>
  <div class="flow__step"><strong>Agentic</strong><small>Specification → Evaluation</small></div>
</div>

- **演绎**：人写规则（代码），程序把规则应用到新输入。正确性在写代码时就基本确定了，Hoare 那句「程序的所有性质都可以从程序文本本身推出来」是这种世界观的极致表达。
- **归纳**：人给例子（数据 + 标签），训练推出规则。正确性变成统计意义上的，需要 held-out 集与评测。
- **Agentic**：人给规格，模型生成软件。正确性既不在文本里，也不在训练集里，只能**在运行中测量**。

<SlideFigure lecture="10" page="15" caption="Slide 15 · 归纳式技术创造：人提供输入与输出，训练推出规则"></SlideFigure>

第 20 页把这条线收成一句话：**models（从数据学）、agents（通过评测开发）、software（由 agent 生成）**。三者叠在一起，产生了一个不太直观的推论：

> 如果 agent 生成的代码是「黑盒产物」，那么它的行为与泛化能力就只能像 ML 模型一样，用经验评测来管理。

<SlideFigure lecture="10" page="21" caption="Slide 21 · François Chollet：agentic coding 是机器学习的一种形式，生成的代码应当被当作黑盒产物，用经验评测管理其行为与泛化"></SlideFigure>

这句引语是整场讲座的枢纽。它解释了为什么一个做基准的团队要来讲「软件工程史」：**当软件变成归纳产物，评测就从「验收步骤」变成了「唯一的真值来源」**。

课件接下来用三页把这个推论推到底：

<SlideFigure lecture="10" page="26" caption="Slide 26 · Specification → Evaluation：规格让位给评测"></SlideFigure>

- **Specifier = Software Engineer**：写规格的人仍然是工程师，只是产出从代码变成了「任务 + 成功判据」。
- **Evaluator = ?**：那么谁来保证评测本身是对的？
- **What does training and test data look like for agents?**：如果 agent 是在评测上被开发的，评测集与训练集还分得开吗？

这三个问题没有标准答案，但第 3–12 节给出的工程回答是：**把评测当成一个需要被设计、验证、版本化的软件系统**。

## 3. Terminal-Bench 的起点：一个工具

<SlideFigure lecture="10" page="31" caption="Slide 31 · 一条洞察：与其为每个任务设计专用命令，不如给 agent 一个 shell——bash is the one tool to rule them all"></SlideFigure>

Terminal-Bench 的设计选择可以概括成一句话：**给 agent 一个 shell，而不是一堆专用工具**。

这个选择的理由在对比里：

- 专用工具路线：`aws ec2 run-instances --image-id ... --instance-type ...`，每个云服务、每个 CLI 都要包一层，工具数量爆炸，agent 还要学什么时候用哪个。
- Shell 路线：`bash` 一个工具，动作空间由环境里的可执行文件决定；agent 可以 `ls`、`grep`、`python`、`docker`、`git`，也可以调用任何已经装好的 CLI。

代价也很明显：**动作空间无界，权限与安全边界必须由容器承担**；而且 agent 必须会读文档、拼参数、处理错误——这恰好是真实终端工作的样子。

从 2025 年 1 月的第一个 commit 到现在，这个基准积累的规模在 slides 里用几页数字呈现：64 个 model cards、171 位贡献者、1k+ GitHub 参与者、5k+ Discord 成员、7M+ benchmark runs。这些数字的意义不在于「大」，而在于**一个基准要成为公共基础设施，需要社区、模型卡与运行记录共同支撑**。

## 4. 一个任务长什么样

<SlideFigure lecture="10" page="38" caption="Slide 38 · 一个任务的三个文件：instruction.md 描述目标，Dockerfile 提供环境，test_outputs.py 验证产物"></SlideFigure>

第 38 页的例子很具体：给一张 2D 示意图，要求导出 STEP 文件，验证器检查文件是否合法、是否水密、体积/表面积/惯性矩/凸包/拓扑/平均曲率是否正确。三件套的分工是：

| 文件 | 作用 | 关键问题 |
|---|---|---|
| `instruction.md` | 告诉 agent 要做什么 | 说清楚了没有？有没有暗示解法？ |
| `environment/Dockerfile` | 提供可复现的环境 | 依赖是否固定？是否接近真实？ |
| `tests/test_outputs.py` | 判断产物对不对 | 检查的是结果还是实现？会不会误判？ |

<SlideFigure lecture="10" page="43" caption="Slide 43 · 任务目录结构：instruction、task.toml、environment、solution、tests 五个部分"></SlideFigure>

完整目录还多两样：`task.toml`（元数据）与 `solution/solve.sh`（参考解）。参考解不是给 agent 看的，而是给**验证器**看的：如果参考解都过不了测试，说明测试写错了；如果参考解能过而 agent 过不了，才说明是能力问题。

课件用五个词概括任务的属性：**agent-agnostic**（不绑定某个 harness）、**easy to define**（作者能快速写）、**portable**（本地与云端都能跑）、**expressive**（能表达足够复杂的任务）、**independent**（任务之间互不依赖）。这五条其实互相拉扯：越 expressive 越难 portable，越 agent-agnostic 越难表达细粒度的能力差异。

## 5. 写任务：先问「你在测什么」

<SlideFigure lecture="10" page="44" caption="Slide 44 · 写任务的三个问题：你在测什么、测得对不对、怎么防止 reward hacking"></SlideFigure>

第 44 页把任务写作拆成三件事：

1. **Aligning instruction and verifier**：指令里要求的每一项，验证器都要检查；验证器检查的每一项，指令里都要写清楚。二者不一致，就会出现「做对了但被判错」或「钻空子被判对」。
2. **Preventing reward hacking**：agent 会找到通过测试的捷径，而不是完成任务。比如直接改测试文件、写死输出、伪造产物。
3. **Realistic and fair and interesting**：任务要像真实工作，难度要公平（不依赖冷门知识），还要有区分度（不能所有模型都 0% 或 100%）。

### 5.1 Instruction 的三种写法

<SlideFigure lecture="10" page="45" caption="Slide 45 · 指令的三种风格：fully specified、as concise as possible、as natural as possible，取决于你想测什么"></SlideFigure>

课件明确说「取决于目标」：

| 风格 | 适合测什么 | 代价 |
|---|---|---|
| Fully specified | 执行能力：给定完整规格能否做对 | 提示太长，接近「照着做」 |
| As concise as possible | 规格理解与推断能力 | 容易 underspecified，产生歧义 |
| As natural as possible | 真实用户会怎么说话 | 自然语言模糊，验证器难对齐 |

第 46 页给了一个修改前后的对照：原始指令信息不全，反馈后补上了路径、格式与验收条件，但**没有补上解法**。这个平衡是任务写作的核心手艺——**把「做什么」说满，把「怎么做」留空**。

### 5.2 环境：尽量接近生产

<SlideFigure lecture="10" page="47" caption="Slide 47 · 环境设计的四条原则：补充输入、真实软件优先于 mock、尽量开放、把网络依赖烤进镜像"></SlideFigure>

- **Additional input**：文档、代码、状态，让任务有真实的信息密度。
- **Actual software / services > mocks**：能跑真服务就不要 mock；多容器是常态。
- **As open world as possible**：允许联网更真实，但会引入不可复现性，需要权衡。
- **Reduce flakiness**：把网络依赖提前固化进镜像，避免评测时因网络波动而随机失败。

第 48 页同样给了「原始环境 vs 反馈后环境」的对照：把缺失的依赖、错误的端口、不稳定的下载都修掉，任务才可复现。

## 6. 验证器：一个分类器

<SlideFigure lecture="10" page="49" caption="Slide 49 · 验证器是基于环境终态的分类器：混淆矩阵、与指令一一对应、程序化检查与 LLM judge"></SlideFigure>

课件给了一个很工程的定义：**验证器是对环境终态做判断的分类器**。既然是分类器，就要用混淆矩阵思考：

| | 实际通过 | 实际未通过 |
|---|---|---|
| 判为通过 | TP | FP（放过了错误产物） |
| 判为未通过 | FN（误杀了正确产物） | TN |

两个方向都有代价：FP 让模型学会钻空子，FN 让强模型被低估。任务作者需要不断问：**我的验证器在哪个方向上更保守？**

设计原则有四条：

- **1-1 mapping to requirements**：指令里的每条要求都有对应检查，不重不漏。
- **Programmatic checks**：能用代码检查的，不要用 judge。
- **Agent / LLM judges**：只在无法程序化判断时使用（如「解释是否清楚」），并且要校准、要抽检。
- **Outcome-based**：检查环境终态，而不是 agent 的轨迹。否则会惩罚合法的不同解法。

## 7. Reward hacking 与隔离

<SlideFigure lecture="10" page="51" caption="Slide 51 · 防 reward hacking：锁住 agent 环境、隔离验证器环境与代码执行环境"></SlideFigure>

第 51 页的图值得仔细看：agent env 与 verifier env 是两个隔离的空间，中间只传 **artifact**。

- **Locked down agent environment**：agent 不能改测试、不能改验证器、不能访问评分逻辑。
- **Verifier environment isolation**：验证器在干净环境里跑，不受 agent 留下的副作用影响。
- **Agent code execution isolation**：agent 执行的代码不能污染宿主机或评分进程。

如果没有这层隔离，agent 最快的「解法」永远是 `rm tests/` 或把测试改成 `assert True`。这不是模型坏，而是**激励结构错了**——它被训练成通过测试，而不是完成任务。

第 53 页补了验证器的调试方法：**用参考解跑一遍，再用 agent 可能采取的动作跑一遍**。如果参考解过不了，是验证器太严；如果明显错误的产物能过，是验证器太松；如果只有某种特定写法能过，是验证器在测实现而不是测结果。

## 8. 评测基础设施

<SlideFigure lecture="10" page="56" caption="Slide 56 · 评测基础设施的四个要求：可靠、可复现、快、可移植"></SlideFigure>

- **Reliable / fault tolerant**：容器会挂、网络会断、模型会超时；单点失败不能拖垮整批。
- **Reproducible**：固定镜像、固定依赖、固定随机种子；同一 trial 重跑应得到同一结论。
- **Fast**：trial 之间独立，必须能并行；串行跑一个基准要几天，就没有迭代空间。
- **Portable**：本地沙箱与云沙箱都能跑，团队与 CI 用同一套接口。

第 57 页把 rollout 基础设施分成 **test / train / prod** 三种用途：test 追求可复现与隔离，train 追求吞吐与轨迹采集，prod 追求延迟与可观测。三者对同一个 agent 的要求并不相同。

## 9. 任务 QA：tasks are software

<SlideFigure lecture="10" page="59" caption="Slide 59 · 任务 QA：静态检查、agent judge、oracle agent、前沿 agent 与作弊 agent 交叉验证"></SlideFigure>

课件把任务质量问题归成一句话：**tasks break in subtle ways**。常见的隐蔽故障包括依赖漂移、验证器过严、指令歧义、环境不稳定。

QA 的方法是多层交叉：

- **Static checks**：文件是否存在、schema 是否合法、测试能否跑通。
- **Agent judge**：用模型读指令与测试，判断二者是否一致。
- **Oracle agent**：用参考解跑，确认任务可解。
- **Frontier agents**：用强模型跑，确认任务不是「不可能」。
- **Cheat agents**：用专门作弊的 agent 跑，确认 reward hacking 被堵住。

<SlideFigure lecture="10" page="60" caption="Slide 60 · 持续基准：CI/CD 接入后，新任务、bug 报告、模型更新都会让基准漂移"></SlideFigure>

第 60 页的结论很朴素，也很重要：

> Tasks are software. Software has bugs.

所以基准需要 CI/CD：新任务进来自动跑一遍，模型更新后自动重跑，用户报告 issue 后能定位到具体 trial。没有这套流程，一个基准会在半年内悄悄失效——分数还在涨，但测的东西已经变了。

## 10. 版本化与 receipts

<SlideFigure lecture="10" page="61" caption="Slide 61 · 版本化的三件事：regrade、rerun、reuse；每一次改动都要能追溯到任务、环境、验证器与元数据"></SlideFigure>

任务会变，分数就会变。课件把版本化拆成三种动作：

| 动作 | 场景 | 例子 |
|---|---|---|
| Regrade | 验证器改了，用旧产物重新打分 | 修过严的测试、调 judge、堵 reward hack |
| Rerun | 环境或 agent 资源变了，重新跑 | 固定依赖、调整资源、改数据与工具 |
| Reuse | 任务本身更新，旧结果作废 | 新任务、修指令、改元数据 |

无论哪种，都要保留 **full receipts for every row**：每个 trial 的轨迹、日志、产物与奖励。第 62 页的图显示了结果表与单条 trial 的对应关系——**没有轨迹的分数不可审计**。

## 11. Harbor：把评测变成开发流程

<SlideFigure lecture="10" page="40" caption="Slide 40 · Harbor：面向 eval-driven development 的工具；代码不再是唯一真值来源，评测才是"></SlideFigure>

讲座最后介绍了 Harbor，定位是「评测驱动开发」的工具层：

| | 传统软件 | Agent 世界 |
|---|---|---|
| 真值来源 | Code as source of truth | Evals as source of truth |
| 性质 | Deterministic, deductive | Stochastic, empirical |
| 软件来源 | Handcrafted | Learned |
| 目标 | 理解并改进代码 | 理解并改进 agent |

课件用一句话概括产品逻辑：**「一个基准，我们来做评测」→「百万个基准，你来做评测」**。Terminal-Bench 是前者，Harbor 是后者——把写任务、跑容器、收集轨迹、打分、版本化这些事做成可复用的工具，让每个团队能定义自己的评测。

<SlideFigure lecture="10" page="39" caption="Slide 39 · 从 TBENCH 到 harbor：前者是一个基准，后者是让所有人都能造基准的工具"></SlideFigure>

## 12. 回扣前九讲

这场讲座看起来在讲基准，实际上把前九讲的判断都落到了工程上：

- **第 1 讲的「任务成功 ≠ 安全」**：验证器只测终态，不测过程；安全需要额外的检查层。
- **第 3、4 讲的 RAG 与工具**：环境里装什么软件，直接决定了 agent 的动作空间与失败模式。
- **第 6 讲的设计模式**：任务目录结构本身就是一种模式——instruction / environment / solution / tests 四件套。
- **第 7 讲的记忆**：跨 trial 的经验不能复用，除非你把轨迹变成可检索的工件。
- **第 9 讲的优化**：如果评测不可信，优化只会更快地过拟合到错误目标。

一句话收束：**能做评测，才谈得上工程**。

## 延伸阅读

- [Terminal-Bench 项目主页](https://www.tbench.ai/)：排行榜、任务与 harness。
- Merrill et al., [Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces](https://arxiv.org/abs/2601.11868), ICLR 2026。
- Anthropic, [Demystifying Evals for AI Agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)。
- [Harbor 框架](https://harborframework.com/)。
- Zhu et al., [Establishing Best Practices for Building Rigorous Agentic Benchmarks](https://arxiv.org/abs/2507.02825), 2025。

## 自测

**1. 为什么「bash 是唯一工具」既降低了设计成本，又提高了安全要求？**

<details>
<summary>答案</summary>

降低设计成本：不需要为每个任务发明工具接口，环境里已安装的 CLI 就是动作空间。提高安全要求：动作空间无界，agent 可以读写任意文件、访问网络、执行任意命令，因此必须用容器隔离、锁定测试与验证器，并在执行前做权限检查。

</details>

**2. 验证器的 FP 与 FN，哪个更危险？**

<details>
<summary>答案</summary>

FP（放过了错误产物）更危险，因为它直接制造 reward hacking 的空间：agent 会学到「只要骗过测试就行」。FN 会低估强模型，但至少不会训练出错误行为。实践中应优先消除 FP，再用参考解与前沿 agent 校准 FN。

</details>

**3. 为什么说「没有轨迹的分数不可审计」？**

<details>
<summary>答案</summary>

因为 agent 是随机的，同一个任务两次运行的路径可能完全不同。只保留最终分数，无法判断失败是模型能力、环境问题、验证器 bug 还是 reward hacking。保留每个 trial 的轨迹、日志与产物，才能复现、归因并版本化。

</details>
