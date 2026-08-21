# 阶段一：Schematic 与网表语义基础

状态：`completed`（2026-08-20）

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
- 当前 Properties 的 W/L/M/value、位置与旋转随输入即时生效，Reference/Value toggle 立即
  更新，Discard 恢复选择该对象时的基线；这些是已有 GUI 行为，不是旧数据协议的理由；
- 当前 `analyzeDesignNetlist(Project)` 返回 `{ ir: DesignNetlistIR | null, diagnostics }`，
  是 S7 唯一 analyzer 的现有实现基础，不需要并行重建。

阶段一是对这些基础的产品化收口，不是第二次数据模型重写。

## 3. 权威边界

| Concern                       | 唯一权威                                                                                        | 非权威投影或派生                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| emitting Instance 网表身份    | `Instance.netlist.reference`                                                                    | canonical Reference projection；其他 attached label 仅属 presentation |
| 器件/模型/子电路目标          | `Instance.netlist.binding`                                                                      | Properties 文本、导入 provenance                                      |
| Instance 参数                 | `Instance.netlist.parameters`                                                                   | canonical Value projection、hand-edited attached text、表格单元格     |
| Device/interface pin order    | built-in Device Descriptor、internal child formal interface，或 S6 external black-box interface | Symbol 绘制顺序、import source-position mapping                       |
| Cell engineering/netlist name | Cell Document 的 `Document.netlist.name`                                                        | Cell 的 `Document.name` 严格同步投影                                  |
| Cell interface                | `Document.netlist.terminals`                                                                    | child Port marker 与 parent Cell Symbol                               |
| Net identity 与 membership    | `Net.id` 及 terminal/port membership                                                            | Net label、Wire、Flightline                                           |
| 可见 Wire                     | persisted Route + canonical resolved geometry                                                   | hit target、selection overlay、highlight                              |
| 网表可导出性                  | `analyzeDesignNetlist(Project)` 返回的 IR + diagnostics                                         | Preflight UI、阶段二 exporter 与成功下载提示                          |

所有人工作用必须通过现有 typed Edit Engine。Properties、Instance Table、编号器、
Wire planner 和 Preflight 不得直接修改 Project JSON，也不得从 SVG、annotation 文本
或几何相交反推电气事实。

### 3.1 GUI 默认冻结原则

阶段一首先是协议收口，不是交互重设计。当前 gesture、可见结果、快捷键、selection、focus、
status/diagnostic、preview、Undo/Redo 和 save/reopen 行为共同构成兼容合同。底层权威迁移必须
通过 adapter 保持这些结果；“协议更统一”或“实现更干净”本身不是改变 GUI 的收益理由。

这里的兼容合同是 **Properties GUI 行为兼容边界**，不是保留持久化
`Instance.properties`。Stage 1 删除旧电气 property branch，但已有参数/位置/旋转仍即时生效，
Reference/Value toggle、selection/focus、Discard、Undo 和 save/reopen 的可见结果保持。新字段
可选择适合自己的提交 gesture；统一的是 Field definition、validator 和 typed writer，不要求
所有字段都使用同一种 Apply/blur 交互。

允许新增 Properties 区域、Instance Table、terminal-order editor 或 Preflight 面板，但旧入口
默认仍按原来的动作和可见语义工作。只有同时满足以下条件，才可改变既有 GUI 行为：

1. 有具体、显著且可验证的用户收益，足以抵消学习、迁移和回归成本；
2. 在独立 target/accepted decision 中记录 before/after、受影响用户、兼容或迁移方案及回退路径；
3. 先冻结旧行为测试，再为新行为定义独立验收，不把协议迁移顺带包装成产品变化；
4. 不能满足以上门槛时，保留现状，即使底层需要 presentation adapter 或兼容转换。

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
   order、target policy、已知参数定义与 Value display policy。方言 capability 属于阶段二
   printer，不进入阶段一 Project/property 协议。
6. built-in primitive/model 器件的 pin order 只读并来自 Descriptor；internal Cell order
   只读并来自 child formal interface。external-subcircuit interface authoring 由 S6
   明确定义，不把普通 Instance 的 source terminal mapping 当作任意 pin-order override。
7. 当前 `Instance.netlist.terminals` 的 imported source-position mapping 迁名/迁移到
   `Instance.importProvenance.terminalMapping`；它只解释导入来源，永远只读，也不参与
   target、parameters、connectivity、pin order 或 hierarchy resolution。

#### S1.2 终止双重参数协议

Stage 1 以 schema 14 从当前 Project 模型移除持久化 `Instance.properties`；不保留双写、
fallback 读取或长期 compatibility alias。S1 负责直接的 schema-13 → schema-14 adapter，
继续遵守滚动 N-1 窗口，而不是让两个运行时形状并存。

直接迁移规则：

- `w`、`l`、`m`、`value` 和 `dc` 等已知电气值在 typed 参数缺失时迁入
  `netlist.parameters`；
- 两边值相同则保留 typed 值并删除旧 property；
- 两边值冲突时报告结构化迁移错误，不静默选择、不覆盖；
- `symbol.mapping.registry` 等导入映射证据迁入 typed provenance；
- 未知旧 property 必须由明确 adapter 归类或报告，不能继续成为任意电气后门。

实现 adapter 前先扫描 compatibility corpus 和现有 fixtures 中非空 property keys。已知电气
参数及 import mapping 按上述规则迁移；若存在真实未知 key，必须在 schema target 中逐项决定
迁移或给出结构化 load diagnostic，不能为了“保险”新增通用 metadata/property bag，也不能
静默丢弃。当前 fixture 大量空 `properties: {}` 只需机械迁移，不构成保留字段的语义理由。

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
当前编辑器 `PARAMETERS_BY_SYMBOL` 与 Descriptor `requiredParameters` 是两份名单；S1 在同一
target 中把 metadata 迁入 Descriptor，并移除这两个旧入口，而不是长期保留 compatibility
fallback。Descriptor 现有 `dialects` 字段可暂留供阶段二使用，但 Stage 1 analyzer 不读取它
判断设计可导出性。

第一批内置 known parameters 只覆盖无 PDK 也能稳定解释的常用面：

- resistor/capacitor/inductor：required `value`；
- NMOS/PMOS：required `w`、`l`，optional `m`；
- voltage/current source：阶段一只承诺 DC source，required `dc`；pulse/sin 等波形留给后续
  明确 source capability，不塞入模糊的通用 source 参数；
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

当前 GUI 已允许用户把 instance label/value 改成任意可见文本，Value refresh 和 clipboard
也已通过“内容是否仍等于 canonical projection”隐式区分系统投影与 hand-edited 内容。S1
把这条规则收敛为唯一 derived classifier，不新增持久化 `managed/detached` flag：

```text
annotation content == current canonical slot projection  -> canonical projection
otherwise                                                -> presentation-only attached text
```

Canvas 双击文字编辑继续只编辑 presentation；即使结果看起来像合法 Reference，也不得偷偷
修改 `netlist.reference`。真正的 Reference 只通过 Insert、Properties Reference 和 S3 planner
编辑。参数变化只刷新仍匹配旧 canonical projection 的 Value；hand-edited text 保持当前文字、
style、anchor 和可见性。当前显式“Show Value”动作可以按既有行为重新投影 fresh Value。

所有语义 consumer 只读 typed facts，不从 annotation kind/content 反推 Reference 或参数。若未来
要禁止自由文本或增加显式 detach/relink UI，必须通过 3.1 的显著收益门槛与独立 schema/UX
目标；Stage 1 不为尚不存在的 UI 状态增加持久化字段。

初始编号系统不新增持久化 Reference lock。planner preview 明确列出 preserved 与
reassigned 对象；只有实际工作流证明长期 lock 必不可少时，才通过独立 schema/ADR 目标
引入。

验收：同一 Instance 经 Insert、Properties Reference、clipboard、search、
save/reopen、Preflight 和 IR extraction 观察到同一个 reference、target 与参数集合；
Canvas hand-edited label 保持 presentation-only，不能改变该事实；canonical Project 不再包含
可与 `netlist.parameters` 竞争的 `Instance.properties` 数据。

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
- 沿用当前 schema 边界：每个 Instance 至多 128 个参数，name 至多 128 字符，非空 raw value
  至多 1024 字符；Additional Parameters 的空 value 表示删除，不持久化空字符串；
- 现有 W/L/M/value、X/Y 和 rotation 保持当前即时生效；Reference 与 model target 是新增
  单字段，也采用字段级即时提交，但非法/冲突输入不产生部分工程事实并显示同源诊断；
- Reference/Value toggle、selection/focus、即时 Canvas 结果与 Discard 的可见恢复结果保持；
  Stage 1 允许在内部替换旧 property edit，但不顺带改变这些 gesture；
- Additional Parameters 多行表格使用明确 Apply/Cancel；一次 Apply 是一个 Document
  transaction、一个 Document history entry 和一次 Undo；跨 Cell 的 S4 操作才使用 Project
  transaction；
- 当前 per-keystroke history granularity 是否合并为 field-session Undo 是独立 UX target，须先
  证明收益并补 before/after 验收；S1/S2 协议迁移默认不改变它；
- empty required parameter、非法 Reference、prefix/重复冲突、非法 target 或重复参数名
  不产生部分提交，并在字段旁显示与 Preflight 同源的诊断；
- Reference 可手动修改，也可保持系统自动值；rename 只改变 `netlist.reference` 和展示
  投影，不改变 `Instance.id`、Net membership 或 locator identity；
- Undo/Redo、clipboard、history、recovery、canonical save、search 和后续 Instance Table
  必须复用同一个 field definition 与 typed edit service；
- imported source evidence 不成为第二套 editable properties。

验收：用户能从空 Project 人工 author primitive passive、model-backed MOS、model-backed
diode/BJT 和 source，查看并修改自动 Reference、target、known 与 arbitrary parameters；
现有单字段即时行为与 Additional Parameters 的一次 Apply 均可按各自现有/新增合同撤销；
save/reopen 后无旧 property 分支，画布投影、Properties、Preflight 与 IR 对全部事实解释一致。
internal Cell 和 external black-box 的完整接口验收仍由 S6 完成。

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
  Port/ground/VDD 名称和符号外观保持不变。最终协议选择最小形状：这些 non-emitting
  Instance 不携带 `Instance.netlist`，不新增 emitting/non-emitting union。analyzer 必须先按
  Descriptor 识别 marker 并校验其 Net 语义，不得为通过 required reference schema 制造假值；
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
→ within each Cell: 有 placement 的 Instance 按 placement y
→ placement x
→ stable instance id
→ placement 为 null 的 Instance 放入其后的 stable-instance-id bucket
```

每个 Cell/prefix 独立重置 counter；同一个 reusable child Cell 不因多个 caller path 被重复
编号。Planner 输出 assignments、preserved、reassigned、skipped、invalid、conflicts 和
typed edits。一次用户 Apply 是一个原子 Project transaction、一个 Project history entry 和
一次 Undo；Project 的 structure revision 与每个受影响 Document revision 按现有引擎语义分别
前进，不能笼统承诺“整个操作只有一个 revision”。

当前 `SchematicTransaction.edits`、每个 `transact_document.edits` 和 Project structural edits
均有 256 上限。S3 大范围编号实施前必须先交付一个引擎级 bounded
`bulk_patch_instance_netlist`（最终命名可在 Edit spec 中确定）。它按 Document 接收 bounded
assignments，每项以 `instanceId` 指定 reference、binding 或 parameter set/unset；引擎先整体
校验 uniqueness、field limits 与 compatibility，再原子应用。whole Project 每个受影响
Document 使用一个 bulk edit，而不是提高普通 edit-array 上限或展开每个 Instance。assignment
资源上限通过 5,000-instance benchmark 决定并写入 schema 常量。禁止把一次用户操作拆成多个
可见部分提交；在 bulk 能力到位前，GUI 必须阻止超限 proposal 并给出确定诊断。

#### S3.3 GUI 行为兼容边界

- 新插入器件继续获得当前最低可用的 prefix + numeric suffix，删除后释放的编号继续可复用；
- copy/paste 继续确定性取得下一个可用 Reference，并让可见 Reference 标签显示该结果；
- rectangle-to-Cell 等 hierarchy authoring 继续产生用户熟悉的 `Xn`；
- GND/VDD/Port 当前可见名称不因移除假 netlist Reference 而变化；
- Properties 手动 rename、批量 renumber、Cancel、Undo、save/reopen 的可见结果保持一致。
- Canvas instance-label 文字编辑继续只改变 presentation，不作为 S3 rename producer；合法
  Reference 的入口是 Insert、Properties 和明确 renumber/rename command。

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
不是重复可编辑行；表格必须说明修改 child definition 会影响所有 occurrences。Index 从
S3 ReferenceIndex、S1/S2 Property Field definitions、Device Descriptor、binding、typed parameters
和 ObjectLocator 派生，不持久化，也不从 annotation 或旧 property bag 建行。

现有 `ProjectSearchIndex` 同时索引 Instance 与 Net，因此不能由 `ProjectInstanceIndex` 接管全部
Search。Search 组合 Instance row candidates 与既有 Net candidates；Instance Table 只复用前者
及同一 locator/field 派生规则。Instance rows 索引：

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
为一个原子 Project transaction、一个 Project history entry 和一次 Undo，而不是每个 Cell
一次；每个受影响 Document revision 仍按现有语义前进。

S4 与 S3 共用上述 `bulk_patch_instance_netlist`。大批量不能展开为超过当前 256 上限的普通
edit arrays，也不能分批产生多个 history entry；能力尚未落地时以明确容量诊断拒绝 Apply。
参数数量与字符串长度继续遵守 S2/schema 边界。

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

### S5. Connectivity Proposal 与 Wire/Net 编辑闭环

目标：保留当前 `Net/NoConnect = logical facts`、`Route/Junction = visible geometry` 的必要
分层，在其上统一所有 GUI producer 的 Connectivity Proposal envelope。协议迁移不得
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

#### S5.2 共享 Proposal、专用 Planner

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

不建立一个掌握所有行为的巨大 `ConnectivityIntentPlanner`。wire drawing、contact/move、
named Net、route geometry、delete/disconnect/no-connect 使用各自边界清楚的专用 planner；它们
共享 canonical connectivity/geometry reads、typed low-level edits 和同一个
`ConnectivityProposal` envelope：

```text
source Document/Project revisions
logical delta
geometry delta
affected Net/object IDs
preview geometry
diagnostics
typed low-level edits
```

`merge_nets`、`connect_endpoints`、`set_route_points`、`cut_connection`、`remove_route_geometry` 和
`disconnect_endpoint` 等继续作为 Edit Engine building blocks，但产品 UI 不再直接拼装它们。
Preview 与 pointer-up/command commit 消费同一 proposal；相关 revision 改变使 proposal 失效，不能
在 commit 时走另一条算法重算。

#### S5.3 当前 GUI 行为的兼容映射

| 当前用户动作                                | 统一后的显式 intent                          | 必须保持的可见结果                                                 |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| terminal/Junction/Route contact 之间画 Wire | `draw_wire` / `attach_endpoint_to_wire`      | 当前 Net merge、Route、Junction、NoConnect 清除和 preview 结果不变 |
| 移动器件让两个 Pin 吸附接触                 | `connect_without_wire`                       | 继续无 Wire 建立连接，移动和连接仍为一次 Undo                      |
| 删除普通选中 Wire/Junction geometry         | `remove_wire_geometry`                       | 继续保留 logical Net membership，并在需要时显示 Flightline         |
| 删除当前 explicit `bulk-dashed` connection  | GUI adapter 显式提交 `remove_bulk_override`  | 继续断开 B override 并恢复当前 configured/default bulk policy      |
| Disconnect Endpoint，选择是否移除相邻 Route | `disconnect_endpoint` 及显式 geometry option | 当前两种命令结果和状态提示不变                                     |
| 编辑/新增 Net Label                         | `rename_or_merge_named_net`                  | 当前命名、同名 Net merge、anchor、selection 和 Undo 结果不变       |
| 移动 selection                              | `move_connected_selection`                   | 内部 Routes/Junctions/annotations 平移，只有边界 Wire stretch      |
| 几何 Crossing                               | 无 connect intent                            | 继续永不因相交自动连接                                             |

explicit bulk 的既有删除结果因此保留，但 electrical side effect 由 GUI adapter 选择的明确
`remove_bulk_override` intent 表达，不再由低层 `Route.presentation` 在通用删除 edit 中隐式
改变语义。普通 Delete Wire、Disconnect Endpoint 和 Delete Connection Intent 仍是三个
清楚、可测试的命令。

#### S5.4 Stage 1 必需闭环与可选增强

Stage 1 exit 必需：

- 把兼容矩阵中的当前 Wire/Net producer 收敛到共享 proposal envelope 与专用 planners；
- 支持完成常见局部整形所需的 corner/vertex 选择、增加、删除和拖动；
- 删除零长度或冗余共线点；
- 保证 logical/geometry delta、diagnostics、selection/status、save/reopen 与 Undo 一致；
- 冻结现有 partition 语义：explicit cut 才分割 local Net，global Net 和本来就逻辑断开的 Net
  保持现状；普通可见 Wire 删除继续保留 logical membership，不从几何自动推断 partition。

以下是有价值但不阻塞 Stage 1 的后续增强，需各自证明收益并遵守 3.1：entire-Net inspector、
跨内部 Route 分区的连续 segment dragging、Normalize orthogonal preview、advanced Junction
management，以及二阶 route-anchor/marker 连续性 polish。它们不应迫使核心协议预先容纳尚未
实施的参数或状态。

locked/trunk 或 constraint 冲突继续原子拒绝。每次 producer 迁移前先冻结当前 browser/unit
characterization；迁移后同一 gesture 的 Project delta、connectivity hash、resolved geometry、
selection/status、diagnostics 和 Undo 必须等价。

验收：所有既有 connectivity GUI producers 通过共享 proposal envelope 和对应专用 planner，
且既有行为兼容矩阵逐项通过；用户还能在此基础上创建、扩展、分支、局部整形、移动、拆分
和删除 Net。所有
操作的 logical/geometry delta、source status、diagnostics、save/reopen 和 Undo 与其显式
command semantics 一致。

### S6. Cell 与 Subcircuit 网表 authoring

目标：把 S6 限定为现有 typed hierarchy 的网表完备化，而不是重建层次编辑或 Cell Symbol
Layout。已有 Cell Manager、Port authoring、caller-aware navigation、derived Cell Symbol、typed
Project transaction，以及 definition-level body size、visual pin side/offset 和 caller Route follow
继续作为基础能力复用；S6 不复制这些 GUI 或 planner。

formal netlist terminal order 与 visual Cell Symbol layout 是两个正交事实：

- `Document.netlist.terminals[]` 的数组顺序继续是 internal Cell 的 canonical netlist order；
- Cell Symbol 的 body size、pin side 和 offset 只属于 definition-level presentation；
- 改变 visual side/offset 不改变网表 terminal order，重排网表 terminal 也不以画布坐标反推；
- 已有 Cell Symbol Layout 交互和可见结果不因 S6 改造而变化。

#### S6.1 单一 Subcircuit interface 协议

S6 新增一个共享的 formal-interface value protocol，统一解释 ordered terminal 和 formal
parameter；internal 与 external target 可以有不同的持久化 owner，但不得拥有不同的 terminal
或 parameter 语义。

internal Cell 继续以 `Document.netlist` 为权威：

- Cell netlist name；
- ordered formal terminals：stable terminal ID、name、direction、`netId` 与
  非空 `interfaceInstanceIds[]` marker 集合；多个 marker 仍只代表一个 formal terminal；
- `formalParameters[]`：ordered name 与 optional raw-string default。

schema-14 adapter 对现有 internal binding 校验 child ID 后删除重复 name；caller 上旧
`netlist.terminals` copy 直接由 child interface 取代。新 `formalParameters` 初始为空。

Project 增加 `externalSubcircuitDefinitions[]`，每个 stable-ID
`ExternalSubcircuitDefinition` 保存 name、ordered terminals 和同一套 `formalParameters[]`。
每个 external Instance 的 binding 只引用 definition ID；不得把某个 Instance 的 imported
terminal mapping 提升为共享接口，也不得为每个 caller 复制一份可独立漂移的 terminal
definition。

schema-14 adapter 把 Project `externalSubcircuitDefinitions` 初始化为空，并按 case-folded target
name 汇总现有 external callers：terminal mappings 一致时生成一个 shared definition（direction
按 passive），不完整或互相冲突时保留为 explicit unresolved target 并报告 migration diagnostic；
不得为每个 caller 各造 definition。原 source-position mapping 仍迁入 provenance。

当前 `Instance.netlist.terminals` 同时承载 import source-position evidence 和 internal caller
的 child-terminal copy。S1/S6 将 imported mapping 迁入只读
`importProvenance.terminalMapping`；internal caller 不再保存该数组，只从 child stable
Document/interface 派生。interface change planner 使用 child stable terminal ID 与修改前后
name 更新 parent Net/Route pin references，不依赖 caller copy。

当前每个 `Instance` 必须有 `symbolId`，因此 external black box 不能“没有 Symbol”存在；它
由 `ExternalSubcircuitDefinition` 的 ordered interface 派生 generic black-box Symbol。用户
无需创作、保存或进入一个独立 Symbol asset/editor，派生 Symbol 也不能反向成为接口权威。
external terminal direction 没有可靠 SPICE evidence 时允许缺省或按 passive 展示，不作为
Stage 1 导出阻塞项。

target 必须是互斥的三态，而不是依靠字符串或 provenance 猜测：

```text
internal Cell       -> { kind: subcircuit, childDocumentId }
external black box  -> { kind: external-subcircuit, definitionId }
unresolved target   -> { kind: unresolved-subcircuit, name }
```

binding 不再重复保存 internal/external definition name；name 从被引用 definition 派生。只有
unresolved state 保存尚未解析的用户/source name，避免 ID 与 name 两个 target authority。

`Instance.importProvenance` 继续只读。它可以解释 unresolved 的来源，但不参与 target
resolution。internal/external definition 的 shared derived adapter 向 Symbol、Properties、ERC、
Preflight 和 IR 提供同一种 ordered interface view。

Cell engineering/netlist name 的唯一可编辑权威固定为 Cell Document 的
`Document.netlist.name`；`Document.name` 是严格同步投影。当前 Rename Cell gesture、画布、
Cell Manager 和 caller 可见名称不改变，只由 adapter 原子维护投影；validation/canonical save
阻止分叉，不能形成 display name 与 netlist name 两个独立编辑入口。

#### S6.2 Formal parameter 与 Instance override

formal parameter definition 使用 ordered、case-folded-unique 的统一结构：

```text
name, optional raw default
```

internal Cell 与 external black box 使用同一结构。阶段一只保存和传递 raw strings，不建立
expression evaluator、设计变量依赖图、单位换算或 PDK 合法性判断。Instance override 已按
name keyed record 保存，因此不再为 formal parameter 引入第二个 stable-ID identity。Stage 1
明确采用“没有 default 的 formal 必须由 caller 提供”作为 Analog Canvas 的方言中立
authoring 规则，并在 UI/diagnostic 中说明；不宣称它是所有 SPICE 方言的固有语义。

parent Instance 的显式 override 继续只写 `Instance.netlist.parameters`：

- default 留在 target definition，不复制进每个 caller；
- caller 未写 override 时使用 definition default；
- 没有 default 的 formal parameter 在 caller 上 required；
- unknown、duplicate-folded 或空 required override 由同一 Property/Preflight 规则报告；
- 同一个 child 被多次实例化时，每个 caller 的 Reference 和 override 相互独立；
- Properties、S4 table、clipboard、IR 与后续 import/export 不新增 Cell-specific property bag。

#### S6.3 Interface Change Proposal 与产品面

不新增一个包办所有变化的巨大 `SubcircuitInterfaceChangePlanner`。Cell rename、terminal
add/remove/rename/reorder、formal parameter change、target resolve 分别使用 focused planner，
但共享一个 impact/proposal envelope：

```text
source structure/document revisions
target definition and requested semantic change
affected caller locators
pin/parameter reconciliation
preserved and broken connectivity
Symbol/Route presentation consequences
blocked/skipped reasons and diagnostics
typed Project edits
```

preview 与 commit 使用同一 proposal；stale revision 必须重新规划。一次用户命令提交为一个
原子 Project transaction、一个 Project history entry 和一次 Undo；structure revision 与所有
受影响 Document revisions 按现有引擎语义分别前进。现有 rename 自动 reconciliation、referenced
Port 删除保护、caller navigation 和 save/reopen 行为先成为 characterization，随后作为同一
proposal 协议的 gesture adapter 保持用户可见等价，不保留另一套直接修改 caller 的产品路径。

产品面补充一个统一的 Cell/Subcircuit Interface editor：internal Cell 可编辑 formal terminal
order、name、direction 与 formal parameters；external definition 可编辑 target、
ordered terminals 与 formal parameters；unresolved target 只能 resolve 为 internal/external 或
保持阻塞。Cell Symbol Layout 继续放在 presentation 区域，不与网表 order 表格合并为一个
隐含规则。

`CellNetlistTerminal.netId` 必须与对应 Port Instance 的真实 Net membership 一致，不能作为
普通 property 字段字符串 patch。Interface editor 默认只读显示 Net binding；若确有重绑需求，
只能通过显式 `rebind_cell_terminal` 高层命令组合 S5 connectivity proposal，同时更新两边并
展示 caller impact。terminal order 的底层数组与 `planReorderCellTerminal` 已存在；正常 GUI
editor 应集成新开发分支已经完成的上下移动/拖动/预览能力，不在 S6 另写第二套 order planner。

#### S6.4 校验与 IR 闭环

复用并收敛现有 hierarchy cycle、duplicate Cell name、missing target、unknown/mismatched pin、
stale caller interface 和 unresolved Symbol 检查。S6 负责提供同一 semantic validator 与
ObjectLocator evidence；S7 把这些 findings 汇总为完整 Preflight，不在 exporter 另建规则。

`DesignNetlistIR` 明确区分需要 emit body 的 internal `cells` 与仅引用、不生成空 subckt body
的 `externalMasters/interfaces`；两者都携带 ordered terminals、formal parameter/defaults，
每个 caller 携带 raw overrides。external black box 有完整 definition 时可以进入 IR；
unresolved target 必须阻塞。Stage 1 不加入 flatten preview；需要时另立 elaboration 目标，
不能制造第二种 Project hierarchy 或导出权威。

验收：同一个 child Cell 被多次实例化时，每个 caller 保持独立 Reference/parameter override，
共享同一 ordered interface；external black box 同样由一个 shared definition 驱动所有 caller；
修改 interface 前显示完整影响，提交后 caller、Symbol、connectivity、Properties、Preflight
和 IR 一致，Undo 原子恢复；已有 Cell Symbol Layout 与层次 GUI 行为保持不变。

### S7. Netlist Preflight 与阶段出口

目标：把所有人工 authoring 结果汇合为一个可导航 analyzer 和确定性 IR，而不是让
Preflight UI、IR extraction 与阶段二 printer 各自实现一套可导出性规则。

唯一入口定义为：

```text
analyzeDesignNetlist(Project) -> { ir, diagnostics }
```

它不是新建第二套实现：原有 extraction 在同一实现位置升级为
`DesignNetlistAnalysisResult { ir|null, diagnostics }` 的此入口，并迁移所有 callers/tests；
不保留两个可供 producer 选择的公共分析函数。

Preflight UI 展示同一次分析的 diagnostics，阶段出口与后续 exporter 消费同一次分析的 IR；
存在 blocking diagnostics 时不交付可导出 IR。printer 仍做边界防御校验，但不得维护第二份
业务规则或给缺失事实猜默认值。

Preflight 至少检查：

- missing、duplicate 或 illegal reference；
- missing、illegal 或 Descriptor-incompatible binding/target；在没有 PDK/model registry 的
  Stage 1，“missing model”只表示 model binding/name 缺失或非法，不声称验证模型定义存在；
- missing required、duplicate-folded 或 illegal parameter name；
- required pin 未连接和 NoConnect conflict；
- unsupported electrical Symbol/device/DesignNetlistIR capability；方言 capability 在阶段二选择
  printer 后检查，不阻塞方言中立的 Stage 1；
- external subcircuit 缺失 ordered terminals；
- internal Cell target、formal interface、caller mapping 或 hierarchy cycle 错误；
- duplicate/illegal Cell 与 Net names；
- IR resource limits。

当前 extraction diagnostic 的 `documentId + objectIds` 在该迁移中接入统一 Diagnostic 与
ObjectLocator；点击后切 Cell、恢复 caller path、fit、select，并在适用时 highlight Net。

analysis 通过后，唯一阶段出口是 analyzer 返回的 `DesignNetlistIR`。IR 必须完整、稳定地
包含 dependency-ordered internal Cells、non-emitted external masters/interfaces、formal
terminals、Instances、references、bindings/targets、ordered pins、raw parameters、Nets、
globals 与 hierarchy。

验收：相同 canonical Project 重复 extraction 结构相同；save/reopen 后相同；任何阻塞
事实缺失都在 extraction 前成为可导航 finding，printer 无需推断。

## 6. 依赖与交付顺序

### S0. 实施准备 Gate

S0 不是新的产品层，也不阻塞读取/characterization 工作；它在共享 schema/Edit/UI producer
修改前冻结以下合同：

1. **一个对外 schema-14 形状**：一次包含 `Instance.properties` removal、
   `importProvenance.terminalMapping`、internal `formalParameters[]`、Project
   `externalSubcircuitDefinitions[]` 和三态 subcircuit binding。Stage 1 分 target 实施，但不得
   连续公开 schema 14/15 导致上一发布版 schema 13 跌出滚动 N-1 窗口；
2. **迁移语料审计**：列出所有非空旧 property keys、冲突规则和 schema-13 → 14 结果；
3. **GUI characterization**：冻结现有 Properties 即时字段/Discard/display toggle、Canvas
   hand-edited label/value、Reference insertion/paste/hierarchy，以及 S5 兼容矩阵；
4. **bounded bulk Edit spec**：冻结 assignment shape、整体校验、atomic history 与资源限制的
   measurement 方法；实际 edit 在 S3/S4 依赖前交付；
5. **S6 集成边界**：在进入 terminal-order 产品面前，先合入并验证已有新分支 GUI，复用
   `planReorderCellTerminal`，不得重新实现第二套 reorder workflow。

这些决定完成后不再需要额外产品决策才能按 S1–S7 推进；每个 implementation target 仍按
其 ownership/validation boundary 拆分和验收。

```text
S0 accepted schema / GUI characterization / bulk spec
 ↓
S1 authority and unified property protocol
 ├─→ S2 descriptor-driven Component Properties
 │    └─→ S3 Reference Policy / Index / Planner
 │         └─→ S4 Project Instance Index / batch planner
 ├─→ S5 Connectivity Proposals / Wire-Net closure ─┐
 └─→ S6 Cell / subcircuit netlist authoring ←───┘

S2 + S4 + S5 + S6
          ↓
S7 preflight and DesignNetlistIR exit gate
```

每个 S 包是一个跨模块 outcome，不是一个必须单提交完成的巨大 target。实施时应继续按
ownership 和 validation boundary 拆成小 target；共享 Schema、Edit union 或 Device
Descriptor 变更必须先更新 accepted spec/ADR，再让 UI 依赖它。

S6 的 focused interface planner 在改变 terminal Net binding 或 caller connectivity 时必须组合 S5 的
canonical connectivity intent/edit service；在呈现 target、formal parameter 和 Instance
override 时必须组合 S1/S2 的 Property Field protocol。层次结构 transaction 可以继续作为
原子外壳，但不能在其内部另建一套 Net 或 parameter 修改语义。

S5 的详细技术迁移继续由
[连通性、走线与电气调试统一实施方案](connectivity-routing-debugging-plan.md)
提供依据。本路线只定义 Stage 1 需要交付的用户结果，不复制 canonical geometry 或
connectivity index 的底层设计。

## 7. 阶段验收场景

### Properties 与 Canvas text 兼容

```text
existing component with Reference R1
→ edit current Value/W/L/M or position/rotation fields
→ visible result continues updating with the current immediate gesture
→ Discard, selection/focus, Undo and save/reopen retain characterized results
→ double-click its Canvas label and author R_LOAD
→ R_LOAD remains visible presentation text while netlist.reference remains R1
→ change Reference through Properties
→ typed reference, canonical projection, Search, Preflight and IR agree
```

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
→ one atomic Project history entry and one Undo restore the full prior state
→ affected Project/Document revisions advance according to current engine semantics
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
→ a generic black-box Symbol is derived from the shared external definition
→ Preflight and IR succeed without a user-authored Symbol asset, model definition or source file
```

### 可导航失败

```text
Project with duplicate Reference, missing model binding/name and stale Cell interface
→ run Preflight
→ each finding identifies its domain and primary/related locators
→ selecting it navigates to the correct Cell instance path and object
→ fixing facts removes the live finding without re-import
```

## 8. 性能与规模

阶段一不沿用 500-instance release ceiling 作为大型 schematic 声明。实施期间新增一个
层次化 5,000-instance representative benchmark，测量而不是预先承诺所有交互都能把 5,000
个对象展开成普通 edits，也不在得到基线前把某个数值预算设为阻塞 Exit Gate：

- Instance Table open/filter；
- reference planning；
- bulk transaction validation（在 bounded bulk edit 能力落地后）；
- Project search 与 Net highlight；
- live ERC/Preflight；
- `DesignNetlistIR` extraction；
- canonical save/reopen。

基线结果决定后续 accepted interaction budgets。若整体 Project validation 或 render 使
上述工作流失去交互性，应优先引入 memoized/incremental derived reads 或 worker boundary，
而不是降低正确性检查。

## 9. 风险与处理

| 风险                                                           | 处理                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 删除旧 property branch 被误解为重做 Properties GUI             | 数据协议与 GUI 兼容边界分开；typed writer 替换但现有即时字段/Discard/toggle 保持                     |
| hand-edited annotation 被误当工程事实或为其过度建模            | derived canonical classifier；Canvas text 只属 presentation，Stage 1 不持久化 managed/detached flag  |
| arbitrary parameters 绕过 descriptor required rules            | 保存全部显式参数；descriptor 仅拥有 known/required/display policy                                    |
| 大批量超过 edit-array 上限或产生部分提交                       | 先交付 bounded bulk edit；一次用户命令对应原子 Project history entry 和 Undo，保留真实 revision 语义 |
| 多次 schema bump 使上一发布版跌出 N-1 窗口                     | S0 一次冻结并最终发布完整 schema-14；分 target 实施不形成多个公开 current versions                   |
| 编号依赖 DOM、ID/Reference 偶合或当前数组顺序                  | 单一 ReferencePolicy/Index、per-Cell placement/stable-ID 排序与 preview                              |
| 协议统一意外改变当前 GUI 行为                                  | producer-by-producer characterization；gesture adapter 保持相同 Project delta、状态与 Undo           |
| Wire 改造破坏已经稳定的 connectivity                           | 复用 canonical index/geometry，由显式 intent adapter 对照迁移每个 producer                           |
| visual pin layout 被误当作 netlist terminal order              | presentation 只保存 side/offset/body；formal array order 单独 author，双方不互相反推                 |
| imported Instance terminal mapping 被提升为 external interface | external definition 是共享权威；Instance mapping 继续只是只读 source evidence                        |
| hierarchy binding 同时保存 ID 与可漂移 name                    | resolved binding 只保存 definition ID；name 只由 definition 派生，unresolved 才保存 name             |
| external subcircuit 被错误解释为 PDK/model                     | 只保存 target、ordered pins 和 raw parameters，不判断物理模型                                        |
| Preflight、extraction 与 exporter 各自检查一遍                 | 单一 `analyzeDesignNetlist(Project)` 产出 IR + diagnostics；printer 只做边界防御校验                 |
| Stage 2 方言需求反向污染 Project                               | 所有 text/source/dialect evidence 留在 parser/printer/provenance 边界                                |
| Stage 1 范围膨胀到仿真或 Bus                                   | 以本文件 Non-goals 和 IR exit gate 拒绝扩张，另立 roadmap                                            |

## 10. 阶段一 Exit Gate

- 人工 schematic 所需的 reference、binding、parameter、terminal order、Net 和 Cell
  interface 事实全部可通过 GUI 创建和编辑；
- Properties、Instance Table、编号、annotation、search、ERC 和 extraction 对同一事实
  解释一致；
- 旧 `Instance.properties` 已移除，但已有 Properties 即时字段、Discard、display toggle、
  selection/focus 和 Canvas hand-edited text 通过 characterization；Canvas text 不修改 typed
  Reference/parameters；
- Wire/Net 的当前创建、移动、分支、断开和删除语义统一到共享 proposal envelope；完成
  Stage 1 所需的基本局部 corner/vertex 整形，optional S5 增强不阻塞出口；
- internal Cell 与 external subcircuit 均能无猜测地进入 IR；
- analyzer 的所有阻塞 finding 可由 Preflight 导航、修复，并在修复后实时消失；
- 受支持 Project 在 save/reopen 前后产生相同 `DesignNetlistIR`；
- migration、clipboard、history、recovery 和 representative workload 通过其接受检查；
- 既有 Reference、paste、hierarchy、Wire、move-contact、Net Label、bulk、Disconnect、
  NoConnect 与 Crossing GUI characterization 在协议迁移前后保持用户可见等价；
- 任何既有 GUI 行为变化均通过 3.1 显著收益门槛及独立验收；未获接受的协议迁移使用
  adapter 保持 gesture、可见结果、快捷键、selection/status、Undo 与 save 行为；
- specs、user docs、test contract matrix、focused tests、branch verification 与 mainline gate
  随实际实现按仓库规则完成；
- 未加入 simulation、PDK、Layout、Bus 或 dialect-text round-trip 的隐式合同。

## 11. 向阶段二交付

阶段二接收：

1. schema-valid、网表事实完整的 Project；
2. Device Descriptor registry；
3. 单一 analyzer 产生的可导航 diagnostics；
4. 同一 analyzer 产生的确定性、方言中立 `DesignNetlistIR`；
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
