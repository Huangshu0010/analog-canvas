# Agent Skill 与知识文档构建计划

Status: `implemented; external quality comparison is optional research`

本文定义 Agent 运行时的两部分文档：一个统领完整工作流的 `SKILL.md`，以及由 Skill
按需加载的电路知识文档。它们以完整 `AgentDocumentSnapshot` 为输入，不要求 Agent
先构造查询，也不要求输出固定 Layout Intent。

这两部分不是新的产品协议层。Skill 决定“何时读、何时改、何时检查、何时停止”；知识
文档帮助 Agent 从连接与参数证据理解“电路是什么、怎样表达更清楚”。当前任务的区域、
模式组合、相对位置、坐标与折点仍由 Agent 自由推理，不要求序列化成统一计划对象。

## 1. 目标

文档层解决：

1. **流程约束**：怎样接收 Snapshot、选择 Document、编辑、处理失败、检查并完成；
2. **电路理解**：怎样从完整 pin-Net JSON、参数和层次证据理解电路；
3. **表达质量**：怎样把理解转成教材/Razavi 式布局、布线、标签和层次表达；
4. **泛化**：怎样检查反证和不确定性，而不是依赖器件名或固定拓扑分类。

文档不替代产品硬校验，也不规定 Agent 的内部思维格式。

## 2. Agent 运行时只有两部分

```text
skills/circuit-layout/SKILL.md
  负责全流程、行为约束、知识路由和完成门槛

docs/agent/knowledge/
  负责电路理解、表达规则、pattern evidence 和修复知识
```

产品 specs/schema 是代码和 Skill 引用的硬合同；examples、traces、fixtures 和 evaluation
属于开发验证材料。它们不成为 Agent 运行时的第三、第四层。

## 3. 输入：完整 Snapshot

Skill 开始工作时应得到：

- capabilities 和权限；
- Project Index：Document 列表、top 和 instance-reference edges；
- 当前完整 `AgentDocumentSnapshot`；
- 用户目标、人工 locks 和当前 selection（若有）。

Snapshot 必须包含完整 pin-Net 双向映射、model/parameters、placement、Route geometry、
Junctions、annotations、groups/constraints、bounds 和 diagnostics。文档不能教 Agent
“猜回”系统没有提供的连接事实。

Host 可在任务开始时自动注入 Snapshot。只有切换 Document、stale revision、外部修改
或全局复查时才刷新；不发展 region/topology/select/expand 查询语言。

## 4. 第一部分：统领全流程的 Skill

### 4.1 Skill 的职责

`SKILL.md` 负责：

- 校验 snapshot/api version、revision、permissions 和 limits；
- 判断当前 Snapshot 是否完整、过期或有 blocking diagnostics；
- 选择工作 Document；
- 决定本轮需要加载哪些知识文档；
- 指导 Agent 建立有证据的内部理解；
- 将修改拆成通用 typed transactions；
- 使用 dry-run、提交、render 和 diagnostics；
- 处理 stale revision、limit、lock、unknown symbol 和 rejected edit；
- 在局部收敛后刷新 Snapshot 并完成全局检查；
- 定义可以向用户宣称完成的门槛。

### 4.2 Skill 不负责

- 不复制 API schema、Edit Engine 或连接规范；
- 不包含完整模拟电路教材；
- 不要求 `regions/groups/netPolicies` 等规划对象；
- 不要求每次识别或调用 topology pattern；
- 不包含 RLC/CDAC 的固定坐标；
- 不允许回传整个 Snapshot 或 `.icproj` 作为修改；
- 不在 helper 缺失时停止核心工作流。

### 4.3 主流程

```text
接收 Capabilities + Project Index + Snapshot
  -> 校验 revision/完整性/blockers
  -> 读取最小必要知识
  -> 从连接与参数证据理解电路
  -> 选择本轮局部目标
  -> dry-run / typed transact
  -> render + structured diagnostics
  -> 修复或继续下一局部
  -> 刷新完整 Snapshot
  -> 全局检查并交付
```

小电路可以在一次 Snapshot 后直接完成。大电路以完整 Document 为单位读取，Agent 在
内部选择关注对象；Skill 不要求产品预先划 region。

### 4.4 规则强度

Skill 和知识文档中的规则必须标注：

| 强度       | 含义                                 | 示例                                         |
| ---------- | ------------------------------------ | -------------------------------------------- |
| `MUST`     | 不满足不得提交或宣称完成             | 使用当前 revision；检查 blocking diagnostics |
| `MUST NOT` | 明确禁止                             | 不猜 pin mapping；不静默 merge Net           |
| `SHOULD`   | 默认采用，冲突时可解释偏离           | signal flow 左到右；VDD 上、VSS 下           |
| `MAY`      | 可选技巧                             | 使用对称候选或阵列 generator                 |
| `CHECK`    | 完成前必须观察，但结果取决于当前电路 | unresolved symbols、flightlines、crossings   |

可由程序确定的规则应进入 validator。文档中的 `MUST` 主要约束 Agent 调用过程和完成声明。

### 4.5 失败与刷新

- `STALE_REVISION`：丢弃旧提交假设，刷新完整 Snapshot 后重新判断；
- `LIMIT_EXCEEDED`：只分批 edits，不改变电路解释；
- `LOCKED`：保留人工结果，改变局部方案或请求人工选择；
- `UNKNOWN_SYMBOL/PIN_MAPPING`：不猜，读取 PDK 知识或请求映射；
- `EDIT_PRECONDITION`：检查 Snapshot 与假设，不通过旁路修改；
- `RENDER_TOO_LARGE`：缩小 render bounds，不缩减电路事实；
- 多轮 edits 后上下文不确定：刷新 Snapshot，再做下一轮。

## 5. 第二部分：按需知识文档

建议初始结构：

```text
docs/agent/knowledge/
  circuit-reading.md
  schematic-expression.md
  routing-and-diagnostics.md
  hierarchy-and-large-circuits.md
  pdk-and-symbols.md
  human-collaboration.md
  patterns/
    differential-pair.md
    current-mirror.md
    cascode-and-stacks.md
    arrays-and-ladders.md
    switching-and-sampling.md
    feedback-paths.md
```

第一轮只创建前三份核心文档和三张最常用 pattern card。只有触发条件、维护者或内容量
确实不同，才继续拆分文件。

### 5.1 Evidence-first 阅读

`circuit-reading.md` 指导 Agent 从 Snapshot 依次寻找：

1. ports、global Nets、Document references 和电路边界；
2. primitive/model、pin order、参数、bulk 和控制端；
3. power、ground、bias、clock、differential、feedback、高阻和高扇出 Net；
4. shared source/emitter、共 gate/base、stack、bridge 和重复支路；
5. 主信号路径、偏置路径、共模/差模路径和反馈回路；
6. 尺寸不匹配、额外负载、断开支路和不同控制等反证；
7. 已证实事实、表达假设和需要人工确认的不确定性。

判断必须能追溯到 Snapshot 的连接、参数、层次或视觉证据，不能只依赖 `M1/M2`、
`VINP/VINN` 等名字。

### 5.2 Pattern card

每张 card 包含：

- 结构通常解决什么问题；
- 最小连接与参数证据；
- 会推翻判断的反证；
- 常见变体和组合结构；
- 希望在原理图上突出什么；
- 推荐相对位置和 Net 表达；
- 容易造成误画的规则；
- 一个正例和一个近似但错误的反例。

Card 是 Agent 自愿读取的知识，不是产品 taxonomy 或 API 参数。

### 5.3 从理解到表达

知识文档给出软目标，不给坐标公式：

- 优先表达主 signal path，再表达 bias/control，最后整理 power；
- 局部对称服务于真实对应关系，不追求整页镜像；
- 高阻和敏感节点优先短而清晰；
- 重复阵列突出规律、bit 和 weight 顺序；
- feedback path 必须可追踪；
- 长线、label 和 port 根据可读性选择；
- 例外器件靠近其作用对象，不为模板整齐而隐藏。

## 6. 知识路由

Skill 根据任务信号按需读取：

| Snapshot/任务信号                   | 读取知识                                   |
| ----------------------------------- | ------------------------------------------ |
| 未布局或未知小电路                  | circuit reading + expression               |
| SPICE/PDK/generic symbol/pin 问题   | PDK and symbols                            |
| 多 Document 或 100+ 晶体管          | hierarchy/large circuits + circuit reading |
| 差分、mirror、cascode、array 等证据 | 对应 pattern card                          |
| overlap/crossing/flightline 未收敛  | routing and diagnostics                    |
| 人工 locks、已有布局或局部接管      | human collaboration                        |

路由只决定“读什么”，不决定“电路是什么”。看到反证后，Agent 可忽略、切换或组合 cards。

## 7. 开发验证材料

Examples/traces 应记录：

- Snapshot 中哪些事实支持或推翻判断；
- 为什么读取某份知识；
- 每批 edits 和 revision；
- render/diagnostics 暴露的问题；
- 软规则为什么被偏离；
- 最终仍存在的不确定性。

Evaluation 至少比较：

1. 无 Skill；
2. 只有薄 Skill；
3. Skill + 核心知识；
4. Skill + 完整按需知识。

硬非回归指标：电气错误、锁违规、静默 Net 变化为零。主指标是未知电路完成率和盲审
可读性不得下降；效率指标在 queries/refreshes、edits/rollbacks、token、时间中预先选择。
不能只因某一个指标偶然改善就宣布知识层有效。

## 8. 构建顺序

### KD-1 - Baseline 与合同

- 用当前 Agent 能力记录 RLC、CDAC 和一个未知电路的无 Skill trace；
- 与 Snapshot schema 同时冻结 Skill 输入、版本和完成门槛；
- 记录当前错误、返工、token、时间和盲审结果。

### KD-2 - 薄 Skill v0

- 创建 `skills/circuit-layout/SKILL.md`；
- 只包含 Snapshot 校验、知识路由、typed transaction 循环、失败恢复和完成门槛；
- 在 optional helpers 全部关闭时验证。

### KD-3 - 核心知识 v0

- 完成 circuit reading、schematic expression、routing/diagnostics；
- 完成 differential pair、current mirror、arrays/ladders 三张 card；
- 每份文档都包含反证、停止条件和需要的 Snapshot 字段。

KD-2 与 KD-3 在 Snapshot contract 冻结后可并行。

### KD-4 - 第一次垂直运行

- 使用完整 Snapshot + Skill v0 + 核心知识重复三类任务；
- 根据 trace 区分事实缺失、知识缺失、动作缺失和纯机械成本；
- 事实缺失优先回到 Snapshot，确定性错误优先回到 validator。

### KD-5 - 知识扩展

- 只从跨电路重复出现的理解困难中增加文档和 cards；
- 一次性例外保留为案例，不立即泛化；
- helper 只有在知识与 Snapshot 已充分但机械成本仍显著时才提出。

### KD-6 - 消融、版本和发布

- 运行四档 A/B/ablation；
- Skill manifest 记录兼容 API/snapshot version；
- CI 检查本地链接、重复规则 owner、失效 capability/edit kind 和 examples；
- 发布包可复制自包含 references，但 canonical knowledge 仍在 `docs/agent/knowledge/`。

## 9. 第一批产物

1. Snapshot/Skill 输入合同；
2. 无 Skill baseline；
3. 最小 `SKILL.md`；
4. `circuit-reading.md`；
5. `schematic-expression.md`；
6. `routing-and-diagnostics.md`；
7. differential pair、current mirror、arrays/ladders cards；
8. RLC、CDAC、未知电路的第一次 A/B trace。

第一批先证明 Agent 得到更稳定结果且没有被模板钳制，再扩大知识库。

## 10. 相关文档

- [`Snapshot-driven Agent Architecture`](rule-guided-layout-architecture.md)
- [`Agent API`](../specs/agent-api.md)
- [`Connectivity and Routing`](../specs/connectivity-and-routing.md)
- [`Visual Language`](../specs/visual-language.md)
- [`Phase 9`](../roadmap/phase-9-agent-reasoning-and-observability.md)
