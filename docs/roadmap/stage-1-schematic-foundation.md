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
- `Instance.netlist` 中的 reference、binding、parameters 和可选 imported
  source-position mapping；
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
| Device/interface pin order | built-in Device Descriptor、internal child formal interface，或 S6 external black-box interface | Symbol 绘制顺序、import source-position mapping |
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

### S1. 权威数据模型与统一 Properties 协议

目标：在扩展 Properties UI 前消除旧 `Instance.properties`、typed netlist facts、编辑器
硬编码参数和 Device Descriptor 之间的并行协议。阶段完成后，每项 Instance 工程事实
只有一个持久化权威，所有编辑入口通过一个 Property Sheet 协议生成 typed edits；统一
协议不等于把异构事实重新压平为自由字符串 property bag。

#### S1.1 权威规则

1. `Instance.id` 是内部稳定对象 ID；连接、locator 和 history 继续引用它。它不参与网表
   编号，不随重编号变化，也不作为普通工程属性暴露给用户。
2. `Instance.netlist.reference` 是用户可见、可编辑、最终进入网表的 Instance name /
   Reference。系统在插入时自动分配；唯一性范围是每个 Cell，而不是整个 Project。
3. `Instance.netlist.binding` 唯一拥有 primitive、model、internal Cell 或 external
   subcircuit target。Device class 来自 reviewed Device Descriptor；binding 中的 class
   是需要验证的 target assertion，不是第二个器件类型权威。
4. `Instance.netlist.parameters` 唯一保存全部显式电气参数，value 均为未求值 raw string。
5. Device Descriptor 唯一拥有 built-in device class、Reference prefix、canonical pin
   order、target policy、已知参数定义、dialect capability 与 Value display policy。
6. built-in primitive/model 器件的 pin order 只读并来自 Descriptor；internal Cell order
   只读并来自 child formal interface。external-subcircuit interface authoring 由 S6
   明确定义，不把普通 Instance 的 source terminal mapping 当作任意 pin-order override。
7. `Instance.importProvenance` 只解释导入来源，永远只读，也不参与 target、parameters、
   connectivity 或 hierarchy resolution。

#### S1.2 终止双重参数协议

Stage 1 从当前 Project 模型移除通用 `Instance.properties` 电气分支；不保留双写、fallback
读取或长期 compatibility alias。若删除该持久化字段需要 Project schema 前进，S1 负责
一次 current-schema 决策和直接 N-1 adapter，而不是让两个运行时形状并存。

直接迁移规则：

- `w`、`l`、`m`、`value` 和 `dc` 等已知电气值在 typed 参数缺失时迁入
  `netlist.parameters`；
- 两边值相同则保留 typed 值并删除旧 property；
- 两边值冲突时报告结构化迁移错误，不静默选择、不覆盖；
- `symbol.mapping.registry` 等导入映射证据迁入 typed provenance；
- 未知旧 property 必须由明确 adapter 归类或报告，不能继续成为任意电气后门。

Insert dialog、Properties、clipboard、search、import、Instance Table、Project save 和内部
adapter 随后只消费 typed facts。当前不发布公共 Agent 版本不构成保留旧 snapshot/property
分支的理由。

#### S1.3 Descriptor 参数协议

Device Descriptor 新增 ordered parameter definitions，至少表达：

```text
name, label, required, editor, unit hint, placeholder, help, display role
```

`placeholder` 只是示例，不是自动写入的电气默认值。`requiredParameters`、Insert dialog、
Properties 表单、Preflight 和 Value projection 从同一参数定义派生，不再各自维护名单。

第一批内置 known parameters 只覆盖无 PDK 也能稳定解释的常用面：

- resistor/capacitor/inductor：required `value`；
- NMOS/PMOS：required `w`、`l`，optional `m`；
- voltage/current source：required `dc`；
- diode/BJT：required model target，模型相关参数通过 arbitrary parameters author；
- internal/external subcircuit formal parameters 与 defaults 留给 S6。

`nf`、`ad/as/pd/ps`、`nrd/nrs`、`area`、`temp` 等模型或方言相关字段可以作为 Additional
Parameters 保存，但 Stage 1 不为其发明 PDK 范围、数值类型、默认值或跨方言等价声明。

#### S1.4 单一编辑与展示协议

保留 `set_instance_netlist` 给 import、migration 和 object initialization；普通产品编辑
增加并复用字段级 typed intents：

```text
set_instance_reference
set_instance_binding
patch_instance_netlist_parameters
```

统一 Property Sheet adapter 把 typed facts、Descriptor metadata 和 diagnostics 投影为字段，
再生成这些 edits。不得通过 JSON path、自由 property key 或 UI-local object 直接写 Project。

Reference annotation 的文字严格投影 `netlist.reference`；直接编辑画布 Reference 等价于
编辑该 typed fact。Value annotation 的文字严格由 Descriptor + parameters 生成。用户可
移动、隐藏和调整展示，但不能维护一份与工程事实分叉的 Reference/Value 文本；事实变化
刷新文字时必须保留用户移动的 anchor。

初始编号系统不新增持久化 Reference lock。planner preview 明确列出 preserved 与
reassigned 对象；只有实际工作流证明长期 lock 必不可少时，才通过独立 schema/ADR 目标
引入。

验收：同一 Instance 经 Insert、Properties、画布 Reference、clipboard、search、
save/reopen、Preflight 和 IR extraction 观察到同一个 reference、target 与参数集合；
canonical Project 不再包含可与 `netlist.parameters` 竞争的 `Instance.properties` 数据。

### S2. Descriptor 驱动的通用 Component Properties

目标：在 S1 单一协议上交付一个接近成熟 EDA 的 Component Properties 工作面。Reference
默认自动分配但不隐藏；常用参数获得结构化表单，所有模型特有参数仍能通过同一 typed
record author，而不是再出现 Netlist Properties 与普通 Properties 两套界面。

Properties 分为：

- **Identity**：可编辑 Instance name / Reference、只读 Symbol/device class、Cell path
  与 export readiness；内部稳定 `Instance.id` 不作为普通字段展示；
- **Netlist target**：primitive class 只读；model-backed 器件编辑 model name；internal
  Cell 显示 target 并可导航；external subcircuit 编辑 target name；改变器件类型使用
  Replace Symbol，不通过修改 device class 实现；
- **Parameters**：Descriptor-known 参数按统一顺序和 metadata 展示；Additional Parameters
  使用 name/raw-value 表格，支持新增、重命名、赋值和删除；
- **Display**：Reference/Value 可见性与位置属于 presentation，内容继续由 S1 权威事实投影；
- **Advanced / Source evidence**：canonical pin/interface order 只读；import provenance 与
  source span 只读；external-subcircuit terminal authoring 导航到 S6 的明确工作流。

编辑规则：

- known 与 arbitrary 参数只使用同一个 `netlist.parameters` record，并按 case folding
  检查重复 name；
- 单字段输入使用本地 editing session：Enter 或 blur 提交一次，Esc 放弃；
- binding 和 Additional Parameters 表格使用明确 Apply/Cancel；一次 Apply 是一个
  Project transaction、一个 revision 和一个 Undo step；
- 不再每次键入字符就提交 Project，也不以“再写回旧值”的 transaction 冒充 Cancel；
- empty required parameter、非法 Reference、prefix/重复冲突、非法 target 或重复参数名
  不产生部分提交，并在字段旁显示与 Preflight 同源的诊断；
- Reference 可手动修改，也可保持系统自动值；rename 只改变 `netlist.reference` 和展示
  投影，不改变 `Instance.id`、Net membership 或 locator identity；
- Undo/Redo、clipboard、history、recovery、canonical save、search 和后续 Instance Table
  必须复用同一个 field definition 与 typed edit service；
- imported source evidence 不成为第二套 editable properties。

验收：用户能从空 Project 人工 author primitive passive、model-backed MOS、model-backed
diode/BJT 和 source，查看并修改自动 Reference、target、known 与 arbitrary parameters；
一次 Apply 可撤销，save/reopen 后无旧 property 分支，画布投影、Properties、Preflight 与
IR 对全部事实解释一致。internal Cell 和 external black-box 的完整接口验收仍由 S6 完成。

### S3. Reference Policy、Index 与 Planner

目标：把 insertion、clipboard、hierarchy、Properties、批量编号和 Preflight 当前分散的
Reference 分配/校验逻辑收敛为一个协议；内部 ID 和 netlist Reference 完全分离，但不改变
用户当前看到的默认编号、复制粘贴结果、层次实例命名、标签显示或 Undo 行为。

#### S3.1 唯一 Reference 协议

Device Descriptor 或 hierarchy kind 产生唯一 `ReferencePolicy`：

```text
required(prefix, per-Cell case-folded uniqueness)
or
none(non-emitting marker/interface object)
```

- R/C/L/M/Q/D/V/I 等输出器件需要其 reviewed prefix；
- internal/external subcircuit instance 使用 `X`；
- Port、ground、VDD/net-marker 不为满足内部实现而制造假的输出 Reference；其现有画布
  Port/ground/VDD 名称和符号外观保持不变；
- `Instance.id` 只由内部 stable-ID allocator 产生。已有 ID 不必迁移为新字符串，但所有
  新 producer 不得依赖 `id === netlist.reference`，也不得把 ID collision 当 Reference policy。

一个 derived `ReferenceIndex` 按 Cell 提供 reference-to-instance、occupied suffix、invalid、
duplicate 和 prefix evidence。S2 Properties、Project search、clipboard、hierarchy creation、
S3 planner、S4 table 与 S7 Preflight 都消费这一 Index/Policy；不得再次扫描数组并实现本地
规则。Validator 与 allocator 使用同一 policy，但 validator 永不自动修复用户事实。

#### S3.2 单一 Planner

Planner 统一支持：

- allocate for insertion；
- allocate for paste/copy；
- allocate hierarchy `X` reference；
- rename one；
- scope：selection、active Cell、whole Project；
- policy：fill gaps 或 continuous renumber；
- start index；
- 本次 proposal 中显式 preserve/exclude 的对象集合。

whole Project 是对每个 definition-level Cell 独立规划，不是 elaborated occurrence 的全局
counter。稳定顺序为：

```text
stable Cell order
→ within each Cell: placement y
→ placement x
→ stable instance id
```

每个 Cell/prefix 独立重置 counter；同一个 reusable child Cell 不因多个 caller path 被重复
编号。Planner 输出 assignments、preserved、reassigned、skipped、invalid、conflicts 和
typed edits。应用是一个 Project transaction、一个 revision 和一个 Undo step。

#### S3.3 GUI 行为兼容边界

- 新插入器件继续获得当前最低可用的 prefix + numeric suffix，删除后释放的编号继续可复用；
- copy/paste 继续确定性取得下一个可用 Reference，并让可见 Reference 标签显示该结果；
- rectangle-to-Cell 等 hierarchy authoring 继续产生用户熟悉的 `Xn`；
- GND/VDD/Port 当前可见名称不因移除假 netlist Reference 而变化；
- Properties 手动 rename、批量 renumber、Cancel、Undo、save/reopen 的可见结果保持一致。

这组现有行为先成为 characterization tests，再逐 producer 迁移到 Planner；迁移期间不得
保留两套 allocator 供新功能选择。初始协议不新增持久化 Reference lock。

验收：所有 Reference producer 通过同一个 planner；多 Cell Project 重复运行同一 policy
产生同一计划；取消无修改；每个 Cell 内无重复 reference；Undo 精确恢复原编号与可见投影，
而既有插入、paste 和 hierarchy GUI 场景的用户可见结果不变。

### S4. Project Instance Index 与批量属性 Planner

目标：Instance Table 是 S1/S2 统一 Property Sheet 的 Project 级 read/edit view，不拥有
table-specific column truth、string-key patch payload 或第二套搜索/批量协议。引入新表格不得
改变当前单对象 Properties、多选 display toggle、selection、navigation 或快捷键行为。

#### S4.1 定义级 Instance Index

建立 derived `ProjectInstanceIndex`。每行身份固定为：

```text
documentId + instanceId
```

每个 definition-level Instance 只出现一次。reusable child Cell 的 caller paths 是导航上下文，
不是重复可编辑行；表格必须说明修改 child definition 会影响所有 occurrences。Index 从 S1
ReferenceIndex、S1/S2 Property Field definitions、Device Descriptor、binding、typed parameters
和 ObjectLocator 派生，不持久化，也不从 annotation 或旧 property bag 建行。

Project Search 与 Instance Table 使用同一 Index，统一索引：

- Cell/document identity 与可用 caller paths；
- Reference；
- Symbol/device class；
- binding/model/target；
- descriptor-known 与 arbitrary parameters；
- local property diagnostics 与 locator。

S4 第一版的 readiness 只表示 S1/S2 已知的 Reference、binding、required parameter 和
Descriptor compatibility。完整 export readiness 与关联 Preflight 数量在 S7 接入，避免 S4
提前发明另一套 exporter 判断。

#### S4.2 列与批量编辑协议

列、filter、sort、mixed-value 和 editor 均消费同一个 `PropertyFieldId`/
`PropertyFieldDefinition`；Insert、Properties 和 Table 不得分别硬编码 `W`、`L`、model 或
Reference。多选值只有 `same(value)`、`mixed`、`unavailable` 和 `invalid` view state；`mixed`
不是可写入 Project 的空值或 sentinel。

统一 `BatchPropertyPlanner` 接收 targets、field ID 和 raw input，输出：

```text
applicable, unchanged, incompatible, blocked, preview, typed edits
```

它逐行调用 S1/S2 同一个 field writer；表格不能直接拼 `set_instance_netlist` 或按字符串
JSON path patch。批量 target/model 修改必须明确显示不兼容器件和 skipped reason。默认提交
为一个原子 Project transaction、一个 revision 和一个 Undo step，而不是每个 Cell 一次。

#### S4.3 产品面

- scope：active Cell 与 whole Project；
- 按 reference、symbol、model/target、parameter 和 local validity 过滤；
- 多行批量赋值、清除参数或更换 target；
- 跳到 definition，并在需要时选择一个真实 caller path；
- 调用 S3 的同一编号 preview；
- 不改变当前 canvas selection 与 Properties 的既有交互，表格选择同步作为新增显式功能。

第一版不提供公式、任意脚本或 Excel 级填充规则。批量编辑使用 raw strings，不做数值求值、
单位换算、PDK 范围判断或 table-local coercion。

验收：选择全部兼容 NMOS 后统一 L 与 model target、预览并提交；不兼容对象有确定原因；
Project、Properties、可见 Value、Search、S7 Preflight 和 IR 使用同一事实；Undo 作为一个
步骤恢复，当前非 Table GUI workflows 的可见行为不变。

### S5. Connectivity Intent 与 Wire/Net 编辑闭环

目标：保留当前 `Net/NoConnect = logical facts`、`Route/Junction = visible geometry` 的必要
分层，在其上统一所有 GUI producer 的 Connectivity Intent/Proposal 协议。协议迁移不得
改变现有 Wire、移动吸附、Net Label、普通 Wire 删除、explicit bulk 删除、Disconnect、
NoConnect、Crossing、preview 或 Undo 的用户可见行为；新增 corner/Net inspector 能力才是
显式产品扩展。

#### S5.1 权威与统一 read model

- `Net.id` 与 `Net.terminals` 继续拥有 logical identity/membership；
- `Net.name/scope/powerDomain` 继续拥有 typed Net engineering semantics；
- `NoConnect` 继续拥有显式 open-terminal intent；
- Route/Junction 只拥有 visible routing geometry 和 attachment；Route terminal endpoint 是
  对 logical membership 的受校验引用，不是第二套 connectivity authority；
- Project Connectivity Index 是 highlight、ERC、Search、fit、Flightline、hierarchy trace
  和 Net inspection 的统一 read model；
- Resolved Routing Geometry 是 render、hit、marquee、segment/vertex edit 和 route-anchored
  annotation 的统一几何 read model。

完成现有 R10-style consumer cleanup：旧 `derive*` helper 可以作为 Index 内部纯函数保留，
但不再是 production consumer 可选择的平行公共协议。新增 consumer 必须从 Index/Geometry
读取，不得从 Route overlap、SVG、annotation text 或局部 UI cache 推断 connectivity。

Net Label 文字严格投影 `Net.name`。现有直接编辑 Net Label 的用户手势仍保留，但提交进入
同一个 named-Net intent，按当前规则 rename 或 merge typed Nets；virtual-edge evidence 从
typed Net/label binding 派生，不让自由 annotation 文本成为持续 connectivity authority。

#### S5.2 单一 Connectivity Intent Planner

GUI、keyboard、context menu、Properties 和内部 adapter 只提交高层 intent：

```text
draw_wire
connect_without_wire
attach_endpoint_to_wire
rename_or_merge_named_net
disconnect_endpoint
remove_wire_geometry
delete_connection_intent
remove_bulk_override
edit_route_geometry
move_connected_selection
add_or_remove_no_connect
```

Planner 将 intent 解析为一个 `ConnectivityProposal`：

```text
source revision
logical delta
geometry delta
affected Net/object IDs
preview geometry
diagnostics
typed low-level edits
```

`merge_nets`、`connect_endpoints`、`set_route_points`、`cut_connection`、`make_flightline` 和
`disconnect_endpoint` 等继续作为 Edit Engine building blocks，但产品 UI 不再直接拼装它们。
Preview 与 pointer-up/command commit 消费同一 proposal；revision 改变使 proposal 失效，不能
在 commit 时走另一条算法重算。

#### S5.3 当前 GUI 行为的兼容映射

| 当前用户动作 | 统一后的显式 intent | 必须保持的可见结果 |
| --- | --- | --- |
| terminal/Junction/Route contact 之间画 Wire | `draw_wire` / `attach_endpoint_to_wire` | 当前 Net merge、Route、Junction、NoConnect 清除和 preview 结果不变 |
| 移动器件让两个 Pin 吸附接触 | `connect_without_wire` | 继续无 Wire 建立连接，移动和连接仍为一次 Undo |
| 删除普通选中 Wire/Junction geometry | `remove_wire_geometry` | 继续保留 logical Net membership，并在需要时显示 Flightline |
| 删除当前 explicit `bulk-dashed` connection | GUI adapter 显式提交 `remove_bulk_override` | 继续断开 B override 并恢复当前 configured/default bulk policy |
| Disconnect Endpoint，选择是否移除相邻 Route | `disconnect_endpoint` 及显式 geometry option | 当前两种命令结果和状态提示不变 |
| 编辑/新增 Net Label | `rename_or_merge_named_net` | 当前命名、同名 Net merge、anchor、selection 和 Undo 结果不变 |
| 移动 selection | `move_connected_selection` | 内部 Routes/Junctions/annotations 平移，只有边界 Wire stretch |
| 几何 Crossing | 无 connect intent | 继续永不因相交自动连接 |

explicit bulk 的既有删除结果因此保留，但 electrical side effect 由 GUI adapter 选择的明确
`remove_bulk_override` intent 表达，不再由低层 `Route.presentation` 在通用删除 edit 中隐式
改变语义。普通 Delete Wire、Disconnect Endpoint 和 Delete Connection Intent 仍是三个
清楚、可测试的命令。

#### S5.4 新增编辑能力

在统一 intent 上增加：

- select、highlight、fit、rename、inspect entire Net；
- 查看 logical endpoints、visible routed components、typed label evidence 与 Flightlines；
- 选择、增加、删除和拖动 corner；
- 拖动连续可见 segment，不暴露内部 Route 分区差异；
- 删除零长度或冗余共线点；
- 显式 Normalize orthogonal geometry preview；
- 创建、复用、移动和安全删除 Junction；
- 保持二度 route-anchor、route marker 与 Net-label attachment 的物理连续性；
- 删除或断开后只在拓扑结果确定时 partition Net，否则拒绝或按当前命令保留 membership。

locked/trunk 或 constraint 冲突继续原子拒绝。每次 producer 迁移前先冻结当前 browser/unit
characterization；迁移后同一 gesture 的 Project delta、connectivity hash、resolved geometry、
selection/status、diagnostics 和 Undo 必须等价。

验收：所有既有 connectivity GUI producers 通过一个 intent planner，且既有行为兼容矩阵
逐项通过；用户还能在此基础上创建、扩展、分支、局部整形、移动、拆分和删除 Net。所有
操作的 logical/geometry delta、source status、diagnostics、save/reopen 和 Undo 与其显式
command semantics 一致。

### S6. Cell 与 Subcircuit 网表 authoring

目标：在现有 typed hierarchy 上补齐 IR 所需的可编辑 Cell/subcircuit 事实。

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
S1 authority and unified property protocol
 ├─→ S2 descriptor-driven Component Properties
 │    └─→ S3 Reference Policy / Index / Planner
 │         └─→ S4 Project Instance Index / batch planner
 ├─→ S5 Connectivity Intent / Wire-Net closure
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
| 编号依赖 DOM、ID/Reference 偶合或当前数组顺序 | 单一 ReferencePolicy/Index、per-Cell placement/stable-ID 排序与 preview |
| 协议统一意外改变当前 GUI 行为 | producer-by-producer characterization；gesture adapter 保持相同 Project delta、状态与 Undo |
| Wire 改造破坏已经稳定的 connectivity | 复用 canonical index/geometry，由显式 intent adapter 对照迁移每个 producer |
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
- 既有 Reference、paste、hierarchy、Wire、move-contact、Net Label、bulk、Disconnect、
  NoConnect 与 Crossing GUI characterization 在协议迁移前后保持用户可见等价；
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
