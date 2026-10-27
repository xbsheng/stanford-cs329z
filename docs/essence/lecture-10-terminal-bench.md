---
title: "10 · Terminal-Bench：在终端里考 agent"
description: "5 分钟掌握第 10 讲：从演绎到归纳的技术创造、任务四件套、验证器与 reward hacking、评测基础设施，以及「任务也是软件」。"
pageClass: essence-page
outline: [2, 3]
---

# 10 · Terminal-Bench：在终端里考 agent

<div class="essence-deck">
<p class="essence-deck__thesis">当软件变成归纳产物，评测就从「验收步骤」变成了唯一的真值来源。</p>
<p class="essence-deck__meta"><span>5 分钟</span><span>4 个概念</span><span>对应详细讲义 <a href="../notes/lecture-10-terminal-bench">全文</a></span></p>
</div>

## 先记住

- **抽象抬升三次**：机器码 → 高级语言 → 生成代码。每一次都说「编码会消失」，每一次都只是换了形态。
- **Terminal-Bench 押注 shell**：与其为每个任务发明工具，不如给 agent 一个 bash，让动作空间与真实世界对齐，安全交给容器。
- **任务是软件**：依赖会漂移、验证器会过严、模型会更新，所以基准需要 CI、版本化与每条 trial 的完整记录。
- **评测的四根支柱**：指令与验证器对齐、防 reward hacking、环境接近生产、结果可复现。

## 核心机制

一个任务就是五个文件：`instruction.md`（做什么）、`environment/Dockerfile`（在哪做）、`solution/solve.sh`（参考解）、`tests/`（怎么判）、`task.toml`（元数据）。验证器是对**环境终态**做判断的分类器，因此要用混淆矩阵思考 FP 与 FN 的代价。

<div class="flow">
  <div class="flow__step"><strong>Instruction</strong><small>做什么，留空怎么做</small></div>
  <div class="flow__step"><strong>Environment</strong><small>真实软件、固定依赖</small></div>
  <div class="flow__step"><strong>Agent</strong><small>在容器里跑 bash</small></div>
  <div class="flow__step"><strong>Artifact</strong><small>只把产物交给验证器</small></div>
  <div class="flow__step"><strong>Verifier</strong><small>终态检查 + 隔离</small></div>
</div>

## 最容易错的地方

- **验证器测实现而不是测结果。** 只有一种写法能过，等于惩罚合法的不同解法。
- **不隔离 agent 与验证器。** agent 会改测试；最快的「解法」永远是把断言改成 `assert True`。
- **只存分数不存轨迹。** 分数不可审计，失败无法归因，模型一更新就再也解释不清。

## 30 秒自测

**1. 为什么说 evaluator 变成了「需要被设计的软件」？**

<details>
<summary>答案</summary>

因为规则不再由人写死，正确性只能在运行中测量。评测者要定义任务、环境与判据，还要防作弊、做版本化、维护基准，这些工作本身就是软件工程。

</details>

**2. FP 与 FN，优先修哪个？**

<details>
<summary>答案</summary>

FP。放过错误产物会直接制造 reward hacking 的空间，模型会学到「骗过测试」而不是「完成任务」。FN 会低估强模型，但不会训练出错误行为。

</details>
