# 阶段一：Schematic 与网表语义基础

状态：`proposed`

## 1. 目标

阶段一把 Analog Canvas 的人工 schematic authoring 补齐为可靠的网表语义源，
为后续独立的网表导入/导出闭环建立稳定输入。阶段完成时，用户只通过 GUI
创建或编辑的 Project 已经包含提取确定性 `DesignNetlistIR` 所需的全部事实；
事实不完整时，Preflight 能解释缺少什么并导航到对应对象。

```text
Schematic GUI
→ typed edits
→ Project
→ validation / preflight
→ DesignNetlistIR
```

阶段一不以“生成一份看起来正确的 SPICE 文本”为验收。方言 parser、printer、
source preservation 和文本 round-trip 属于阶段二；阶段一只对其交付一个完整、
无歧义、方言中立的设计 IR。

## 2. 当前基线

以下能力已经存在，后续实施必须复用而不是平行重建：

- schema-13 Project、rolling previous-version migration 和 canonical save；
- `Instance.netlist` 中的 reference、binding、parameters 和可选 terminal order；
- `Document.netlist` 中的 Cell name 与 ordered formal terminals；
- 内置 Device Descriptor registry 与 SPICE/Spectre `DesignNetlistIR` extraction；
- typed Edit Engine、revision、atomic transaction、undo/redo 和 history；
- 人工 Cell 创建、Port authoring、自适应 Cell Symbol、caller-aware navigation；
- 显式 Net、Route、Junction、NoConnect、Crossing 和 Flightline；
- canonical resolved Route geometry、connectivity index、Net highlight 和 Project search；
- 基础 ERC、统一 diagnostic envelope 与 ObjectLocator navigation；
- 单对象 Properties 中的 Reference/Value 展示与有限常用参数编辑。

阶段一是对这些基础的产品化收口，不是第二次数据模型重写。

## 3. 权威边界

| Concern | 唯一权威 | 非权威投影或派生 |
| --- | --- | --- |
| Instance 网表身份 | `Instance.netlist.reference` | 可见 Reference annotation |
| 器件/模型/子电路目标 | `Instance.netlist.binding` | Properties 文本、导入 provenance |
| Instance 参数 | `Instance.netlist.parameters` | 可见 Value annotation、表格单元格 |
| Device pin order | Device Descriptor；需要时由 `netlist.terminals` 显式覆盖 | Symbol 绘制顺序 |
| Cell interface | `Document.netlist.terminals` | child Port marker 与 parent Cell Symbol |
| Net identity 与 membership | `Net.id` 及 terminal/port membership | Net label、Wire、Flightline |
| 可见 Wire | persisted Route + canonical resolved geometry | hit target、selection overlay、highlight |
| 网表可导出性 | Preflight + `DesignNetlistIR` extraction | UI 状态或成功下载提示 |

所有人工作用必须通过现有 typed Edit Engine。Properties、Instance Table、编号器、
Wire planner 和 Preflight 不得直接修改 Project JSON，也不得从 SVG、annotation 文本
或几何相交反推电气事实。

## 4. 范围

### 包含

- 通用 Instance 网表属性 authoring；
- Reference 规划、预览、批量编号和冲突修复；
- Project/Cell/selection 范围的 Instance Table 与批量参数编辑；
- Wire、Net、Route vertex、Junction、NoConnect 的人工编辑闭环；
- Cell parameter、internal/external subcircuit 与 terminal order authoring；
- Device Descriptor 驱动的属性、校验和 IR extraction；
- 可导航的 netlist Preflight；
- 人工 Project 到确定性 `DesignNetlistIR` 的阶段验收；
- schema migration、history、clipboard、recovery 和大项目性能保护。

### 不包含

- SPICE/Spectre 文本 printer 扩展或 source-aware regeneration；
- dialect round-trip、include graph、opaque statement merge 或 re-import reconciliation；
- simulation deck、analysis、waveform、corner、Monte Carlo 或 simulator execution；
- foundry PDK、CDF/callback、PCell、model validation 或工艺合法性判断；
- Layout、LVS、PEX、schematic-layout cross-probe 或 physical constraint signoff；
- Bus、bus tap、vector Net、arrayed instance 或 mixed-signal HDL；
- 全局 autorouter、A*、自动避障或无预览的 schematic beautification；
- Project-local Symbol Editor。Device Descriptor 的扩展边界要保持兼容，但库创作另行规划；
- 公共 Agent 版本。Stage 1 的人机语义仍可共享 typed edit，但不改变发布边界。

## 5. 工作包

### S1. 冻结网表事实与展示投影

目标：消除 Reference、Value、Properties、Device Descriptor 与 netlist extraction
之间潜在的多重权威。

工作：

1. 接受 Instance Reference、binding、parameters、terminal order 和 Cell interface 的
   单一权威关系。
2. 定义 Reference annotation 为 `netlist.reference` 的展示投影；值始终跟随权威，
   用户拖动只改变展示位置。
3. 定义 Value annotation 的 descriptor-owned projection；用户未手动编辑位置时，参数
   变化允许刷新文本但不得重置位置。
4. 冻结 known parameters 与 arbitrary parameters 的共存规则：descriptor 提供顺序、
   标签、帮助、required 和默认展示，Project 仍保存全部显式 name/value。
5. 冻结 binding kind、pin-order override 和 import provenance 的编辑/只读边界。

初始编号系统不新增持久化 Reference lock。每次 planner preview 明确列出 preserved
与 reassigned 对象；只有实际工作流证明长期 lock 必不可少时，才通过独立 schema/ADR
目标引入。

验收：同一 Instance 经 Properties、annotation、copy/paste、save/reopen 和 IR extraction
观察到同一个 reference、target 与参数集合。

### S2. 通用 Instance Netlist Properties

目标：让单个 Instance 的全部可编辑网表事实通过 GUI 完成，而不是只支持硬编码的
R/C/L Value、MOS W/L/M 和 source DC。

Properties 分为：

- **Identity**：Reference、Symbol/device class、Cell path、export readiness；
- **Common parameters**：descriptor-known 参数；
- **Advanced netlist**：binding kind、model/internal Cell/external subcircuit target、任意
  参数表和 terminal order；
- **Source evidence**：import provenance 与 source span，只读。

规则：

- known 与 arbitrary 参数使用同一 `netlist.parameters` record；
- 增删参数、切换 binding、修改 reference 和 pin order 都是 typed atomic edits；
- 非法或未完成输入不产生部分提交；
- Reference/Value 投影与权威事实同步，但不覆盖用户移动的 annotation anchor；
- Undo/Redo、clipboard、history、recovery 和 canonical Project save 完整保留；
- imported source evidence 不成为第二套 editable properties。

验收：用户能人工 author 一个 model-backed MOS、primitive passive、internal Cell Instance
和 external-subcircuit black box，并让每个对象通过 Preflight 所需的本地事实检查。

### S3. Reference planner 与批量编号

目标：建立确定性、可预览、可撤销的编号系统，而不是在 UI handler 中逐对象改名。

Planner 输入至少支持：

- scope：selection、active Cell、whole Project；
- policy：fill gaps 或 continuous renumber；
- prefix：来自 Device Descriptor；
- start index；
- 本次操作中显式 preserve/exclude 的对象集合。

默认稳定排序：

```text
hierarchy path
→ placement y
→ placement x
→ stable instance id
```

Planner 输出 preview、冲突和一组 typed edits。应用是一个 Project transaction、一个
revision 和一个 Undo step。预览必须显示 preserved、reassigned、invalid 与 conflict。

验收：多 Cell Project 重复运行同一 policy 产生同一计划；取消无修改；应用后没有重复
reference；Undo 精确恢复原编号与可见投影。

### S4. Instance Table 与批量编辑

目标：提供编号、查询和批量网表属性的共同工作面，而不是多个互不一致的对话框。

第一版列：

- Cell path；
- Reference；
- Symbol/device class；
- binding/model/target；
- descriptor-known parameters；
- export readiness 与关联诊断数量。

交互：

- active Cell 与 whole Project scope；
- 按 reference、symbol、model/target、parameter 和 readiness 过滤；
- 多行批量赋值、清除参数或更换 target；
- 跳到 schematic 对象并保留 hierarchy instance path；
- 调用 S3 编号 preview；
- 大批量变更作为一次原子 transaction，而不是每个 cell 一个 revision。

第一版不提供公式、任意脚本或 Excel 级填充规则。批量编辑使用原始参数字符串，不做
数值求值、单位换算或 PDK 范围判断。

验收：选择全部 NMOS 后统一 L 与 model target、预览并提交；Project 中的事实、可见
Value、搜索、Preflight 和 IR 同步更新；Undo 作为一个步骤恢复。

### S5. Wire 与 Net 人工编辑闭环

目标：复用当前显式 connectivity 和 canonical geometry，补齐用户对完整 Net、Route
vertex 和 Junction 的直接操作；不重写 routing model。

Net 级操作：

- select、highlight、fit、rename 和 inspect entire Net；
- 查看 logical endpoints、visible routed components、virtual edges 与 Flightlines；
- 区分 Delete Wire、Disconnect Endpoint 与删除整个 connection intent；
- 跨 hierarchy navigation 保留实际 caller path。

Route 几何操作：

- 选择、增加、删除和拖动 corner；
- 拖动连续可见 segment，不暴露内部 Route 分区差异；
- 删除零长度或冗余共线点；
- 显式 Normalize orthogonal geometry preview；
- 保持 route marker 与 Net-label attachment 的物理连续性。

Junction/NoConnect 操作：

- 创建、复用、移动和安全删除 Junction；
- 二度 route-anchor 在显示、选择和 segment move 中保持连续；
- Crossing 永不因几何相交自动连接；
- 连接带 NoConnect 的 terminal 时在同一 transaction 中清除声明；
- 删除或断开后只在拓扑结果确定时 partition Net，否则拒绝或保留 logical membership。

移动闭包继续使用现有 planner：内部 Route/Junction/annotation 平移，只有 selection
边界 Wire stretch；locked/trunk 或 constraint 冲突原子拒绝。Preview 和 pointer-up commit
消费同一 proposal。

验收：用户能创建、扩展、分支、局部整形、移动、拆分和删除 Net；每项操作的几何、
connectivity hash、source status、diagnostics 和 Undo 结果符合命令语义。

### S6. Cell 与 Subcircuit 网表 authoring

目标：在现有 schema-13 hierarchy 上补齐 IR 所需的可编辑 Cell/subcircuit 事实。

工作：

- Cell name 与 netlist name 的单一编辑入口；
- formal terminal order、name、direction 和 Net binding；
- caller impact preview 与已有 caller reconciliation；
- Cell parameter defaults 及 parent Instance raw-string override；
- internal Cell、external subcircuit 和 unresolved target 的明确区分；
- external black box 的 terminal order 与 parameter authoring；
- hierarchy cycle、duplicate Cell name、missing target 和 interface mismatch 检查；
- optional flatten preview 只用于检查，不写回为第二种 Project hierarchy。

Cell 参数在阶段一只保存和传递原始字符串，不建立表达式 evaluator 或设计变量依赖图。

验收：同一个 child Cell 被多次实例化时，每个 caller 保持独立 reference/parameter
override，共享同一 ordered interface；修改 interface 前显示影响，提交后 caller、Symbol、
connectivity 和 IR 一致。

### S7. Netlist Preflight 与阶段出口

目标：把所有人工 authoring 结果汇合为可导航的可导出性检查和确定性 IR，而不是把
缺失事实留给阶段二 printer 猜测。

Preflight 至少检查：

- missing、duplicate 或 illegal reference；
- missing/incompatible binding 或 target；
- missing required、duplicate-folded 或 illegal parameter name；
- required pin 未连接和 NoConnect conflict；
- unsupported electrical Symbol/device/dialect capability；
- external subcircuit 缺失 ordered terminals；
- internal Cell target、formal interface、caller mapping 或 hierarchy cycle 错误；
- duplicate/illegal Cell 与 Net names；
- IR resource limits。

所有 finding 使用统一 Diagnostic 和 ObjectLocator；点击后切 Cell、恢复 caller path、fit、
select，并在适用时 highlight Net。

Preflight 通过后，唯一阶段出口是现有 `Project → DesignNetlistIR` extraction。IR 必须
完整、稳定地包含 dependency-ordered Cells、formal terminals、Instances、references、
bindings/targets、ordered pins、raw parameters、Nets、globals 与 hierarchy。

验收：相同 canonical Project 重复 extraction 结构相同；save/reopen 后相同；任何阻塞
事实缺失都在 extraction 前成为可导航 finding，printer 无需推断。

## 6. 依赖与交付顺序

```text
S1 authority and projection contract
 ├─→ S2 instance netlist properties
 │    └─→ S3 reference planner
 │         └─→ S4 instance table and bulk editing
 ├─→ S5 Wire / Net editing closure
 └─→ S6 Cell / subcircuit authoring

S2 + S4 + S5 + S6
          ↓
S7 preflight and DesignNetlistIR exit gate
```

每个 S 包是一个跨模块 outcome，不是一个必须单提交完成的巨大 target。实施时应继续按
ownership 和 validation boundary 拆成小 target；共享 Schema、Edit union 或 Device
Descriptor 变更必须先更新 accepted spec/ADR，再让 UI 依赖它。

S5 的详细技术迁移继续由
[连通性、走线与电气调试统一实施方案](connectivity-routing-debugging-plan.md)
提供依据。本路线只定义 Stage 1 需要交付的用户结果，不复制 canonical geometry 或
connectivity index 的底层设计。

## 7. 阶段验收场景

### 人工 model-backed MOS

```text
empty Project
→ place NMOS
→ assign Reference, model, W/L/M and pin connectivity
→ Preflight passes for that Instance
→ IR contains the exact reference, target, ordered pins and raw parameters
```

### 批量参数和编号

```text
several MOS Instances across two Cells
→ filter in Instance Table
→ set common model and L
→ preview deterministic renumber
→ apply once
→ one revision and one Undo restore the full prior state
```

### Wire/Net 编辑

```text
routed selected subgraph with branches, labels and NoConnect endpoints
→ move Instances and edit Wire corners
→ connect one declared-open terminal and delete one visible branch
→ internal connectivity remains; boundary topology changes only as previewed
→ diagnostics, highlight, save/reopen and Undo agree
```

### Internal Cell

```text
author child Cell ports and defaults
→ place two callers with different raw parameter overrides
→ rename/reorder one interface terminal through caller-aware preview
→ parent Symbols, caller pins, connectivity and IR reconcile atomically
```

### External black box

```text
place external subcircuit block
→ define target, ordered terminals and parameters
→ connect all required pins
→ Preflight and IR succeed without inventing a Symbol, model or source file
```

### 可导航失败

```text
Project with duplicate Reference, missing model and stale Cell interface
→ run Preflight
→ each finding identifies its domain and primary/related locators
→ selecting it navigates to the correct Cell instance path and object
→ fixing facts removes the live finding without re-import
```

## 8. 性能与规模

阶段一不沿用 500-instance release ceiling 作为大型 schematic 声明。实施期间新增一个
层次化 5,000-instance representative workload，测量而不是先猜预算：

- Instance Table open/filter；
- reference planning；
- bulk transaction validation；
- Project search 与 Net highlight；
- live ERC/Preflight；
- `DesignNetlistIR` extraction；
- canonical save/reopen。

基线结果决定后续 accepted interaction budgets。若整体 Project validation 或 render 使
上述工作流失去交互性，应优先引入 memoized/incremental derived reads 或 worker boundary，
而不是降低正确性检查。

## 9. 风险与处理

| 风险 | 处理 |
| --- | --- |
| Properties、annotation 和 netlist facts 各自成权威 | S1 先冻结 authority/projection，再实施 UI |
| arbitrary parameters 绕过 descriptor required rules | 保存全部显式参数；descriptor 仅拥有 known/required/display policy |
| 大批量编辑产生数百 revisions | planner 输出一组 edits，一次 Project transaction 和 Undo |
| 编号依赖 DOM 或当前数组偶然顺序 | hierarchy/placement/stable-ID 确定性排序与 preview |
| Wire 改造破坏已经稳定的 connectivity | 复用 canonical index/geometry/planner，以对照合同迁移消费者 |
| external subcircuit 被错误解释为 PDK/model | 只保存 target、ordered pins 和 raw parameters，不判断物理模型 |
| Preflight 与 exporter 各自检查一遍 | Stage 1 Preflight 是 printer 前的唯一可导出性入口；printer 仍做防御校验 |
| Stage 2 方言需求反向污染 Project | 所有 text/source/dialect evidence 留在 parser/printer/provenance 边界 |
| Stage 1 范围膨胀到仿真或 Bus | 以本文件 Non-goals 和 IR exit gate 拒绝扩张，另立 roadmap |

## 10. 阶段一 Exit Gate

- 人工 schematic 所需的 reference、binding、parameter、terminal order、Net 和 Cell
  interface 事实全部可通过 GUI 创建和编辑；
- Properties、Instance Table、编号、annotation、search、ERC 和 extraction 对同一事实
  解释一致；
- Wire/Net 的创建、局部整形、移动、分支、拆分、断开和删除具有明确 preview、typed
  transaction 和 Undo；
- internal Cell 与 external subcircuit 均能无猜测地进入 IR；
- Preflight 的所有阻塞 finding 可导航、可修复，并在修复后实时消失；
- 受支持 Project 在 save/reopen 前后产生相同 `DesignNetlistIR`；
- migration、clipboard、history、recovery 和 representative workload 通过其接受检查；
- specs、user docs、test contract matrix、focused tests、branch verification 与 mainline gate
  随实际实现按仓库规则完成；
- 未加入 simulation、PDK、Layout、Bus 或 dialect-text round-trip 的隐式合同。

## 11. 向阶段二交付

阶段二接收：

1. schema-valid、网表事实完整的 Project；
2. Device Descriptor registry；
3. 可导航 Preflight 结果；
4. 确定性、方言中立的 `DesignNetlistIR`；
5. parser/import provenance 的现有只读证据。

阶段二负责：

```text
external netlist text
↔ parse / preserve / normalize
↔ Project and DesignNetlistIR
↔ dialect printers
↔ canonical and source-aware round-trip validation
```

阶段二不得为了某种方言向核心 Instance/Net/Route 塞入任意文本字段，不得从 annotation
或 SVG 推断 reference/connectivity，也不得要求 Stage 1 Project 保存 simulator analyses。
