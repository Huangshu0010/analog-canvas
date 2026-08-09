# 架构与端到端链路梳理：从网表到电路图

状态：`reference`（参考性梳理，非 normative spec）

本文记录三件事：

1. 仓库结构与模块边界；
2. 从 SPICE 网表到最终电路图的端到端执行链路（12 个阶段）；
3. 当前链路的真实瓶颈评估——特别是为什么 AI 不能很好地产出 Razavi 教材风格电路图，以及交给 AI 做初版时缺什么。

权威顺序遵循 `docs/README.md`：accepted ADR / normative spec > overall product plan > roadmap phase > 本参考文档 > 实现与测试。当本文与任一 normative spec 冲突时，以 spec 为准；本文用于理解，不用于改写契约。

所有 `file:line` 引用以代码仓库当前状态为准，可能随实现演进而漂移。

---

## 1. 仓库结构

这是一个 pnpm monorepo。对外只有五个部分（Import & Load / Circuit Project Model / Schematic Edit Engine / Derived Engine / Save & Export），但内部按模块边界拆成多个 package。

```
interactive-circuit-maker/
├── apps/
│   ├── editor/        # React 原生 SVG 画布 shell + 直接操作工具
│   └── local-host/    # loopback-only 生产 host（可安装 PWA）
├── packages/
│   ├── model/         # Project/Document schema、geometry、migrations、canonical 持久化
│   ├── spice/         # lossless 前端 + dialect + transient Circuit IR + importer
│   ├── symbols/       # Symbol DSL、resolver、内置库、Razavi catalog
│   ├── edit-engine/   # typed edits、history、validation、revision
│   ├── derived/       # 索引、可见连通图、flightline MST、diagnostics
│   ├── render-svg/    # 确定性 SVG 场景 + Razavi 排版/描边/节点
│   ├── agent-adapter/ # Agent API v2（capabilities/snapshot/transact/render）
│   ├── exporters/     # SVG/PNG/PDF 正式导出
│   └── platform-node/ # 原子存储 + recovery
├── tools/
│   ├── vss-import/    # 构建期 VSS 解码器
│   ├── symbol-review/ # 符号 review 工具
│   ├── agent-layout/  # Agent 布局 recipe runner
│   └── fixture-tools/
├── lib/circuit.vss    # 二进制 Visio 符号源（仅构建期，运行时不依赖）
├── netlists/          # SPICE fixtures，按电路分目录
├── fixtures/          # 产品拥有的 Project/connectivity/parser/visual fixtures
├── references/        # pinned 研究仓库元数据（fetch 后 ignored，非产品依赖）
├── skills/            # circuit-layout Skill
├── docs/              # 规范、roadmap、ADR、Agent 指导、经验
└── plan/              # bounded target 计划 + 事实维护日志
```

持久化只有两层：`CircuitProject → SchematicDocument[]`。一个 `.subckt` 对应一个 Document（第一版无 Page）。SPICE 的 CST/AST/Circuit IR 都是导入期内存对象，不落盘。

工作流是 plan-log-experience：每个 bounded target 走 `plan → 实现 → 验证 → log → commit`。

---

## 2. 端到端执行链路

从用户选一个 SPICE entry 到最终画出电路图，经过 12 个阶段。下面按执行顺序梳理，每段给出关键 `file:line`。

### 阶段 1 — SPICE 源束 + include 解析

入口 `packages/spice/src/source.ts` 的 `createSourceBundle(inputs, entryPath)`（source.ts:165-340）。

- 输入 `SpiceSourceInput[]`（`{ path, bytes }`）。**无文件系统访问**——必须预收集目录所有 `.cir/.inc/.lib/.sp/.spi`，Node 端 `loadSourceBundleFromFile`（node-source.ts:34）负责遍历。
- `normalizePath`（source.ts:18-39）：反斜杠→正斜杠，剥 `./`，折叠 `..`，拒绝绝对路径/盘符。
- `decode`（source.ts:84-110）：嗅探 BOM，否则 utf-8 `fatal:true`。
- `resolveInclude`（source.ts:46-72）：以入口目录为 root，逃出 root → `status:"denied"`。状态机 `resolved / duplicate / missing / cycle / denied`。`.lib` section 经 `dependency.section` 传递。
- DFS 每个文件 → `parseSpiceSource` 产 `SpiceSyntaxFile`，挂到 `SourceBundle.syntaxFiles`。
- 产物 `SourceBundle { entryPath, entryFileId, files[], syntaxFiles[], dependencies[], diagnostics[] }`。bundle 上**无 dialect 字段**，dialect 在编译期探测。

### 阶段 2 — 词法 / 逻辑行 / lossless

`packages/spice/src/syntax.ts`。设计意图（overall-product-plan.md:370）：不维护两棵重复 CST/AST。实现方式：**每个 typed 节点自带 `rawText` + `sourceRef`**，lossless 不靠独立 token 流，靠逻辑行级 verbatim 切片。

- `buildLogicalLines`（syntax.ts:236-330）：跳过空行和 `*` 整行注释；`+` 续行（:291-308）；`\\` 续行；flush 时 `text` = trim 后空格连接，`rawText` = verbatim 切片。
- `stripInlineComment`（syntax.ts:202-234）：剥 `$`/`;`/`//`，尊重引号和 `\` 转义。
- `splitSpiceFields`（syntax.ts:332-383）：引号/转义/括号/花括号感知的分词。
- `parseLogicalLine`（syntax.ts:774-1006）：按首字段关键字分派到 `SpiceStatement` union（:142-156）。
- `parseInstance`（syntax.ts:491-772）：按实例名首字母分派器件族。`fixedModeled` 表（:654-666）：`M`→`{family:"mosfet", nodes:4}`，`D`→diode，`Q`→BJT（带 substrate 启发式 :690-720），`X`→subcircuit call。未知前缀 → `opaque`（:459-481）。
- `parseSpiceSource`（syntax.ts:1008-1083）：首行非 `.` → title；`.control/.endc` 块 → `ControlCommandStatement`。

### 阶段 3 — Circuit IR 构造

`packages/spice/src/compiler.ts` + `ir.ts`。`compileSpiceSources`（compiler.ts:672）/ `compileSourceBundle`（:577）是 `SpiceFrontend.parse` 的实际实现。

- `collectDefinitions`（compiler.ts:80-381）：遍历每个 syntaxFile，跟踪 `current: CellDefinition`。`.subckt` 开定义（:221-251，从 formal param 播种局部符号表），`.ends` 闭合（:252-290）。顶层实例收集进 `topInstances`（:317），最后包成合成 cell `__flat__`（:361-372）。`.if/.elseif/.else/.endif` 用 `evaluateSpiceExpression` 求值门控（:155-216）。
- `buildCell`（compiler.ts:478-575）：
  - `targetFor`（:430-476）：X-call 查 `definitions`，命中 → `target:{kind:"subcircuit",cellName}`，`pinNames = statement.nodes.map((_,i) => definition.ports[i] ?? "P{i+1}")`——**pin 顺序纯位置制**，第 i 个 node token → terminal position i。未命中 → `opaque`。
  - `defaultPinNames`（:402-428）：mosfet `["D","G","S","B"]`；R/C `1,2`；V/I `+,-`；Q `C,B,E,S`。
  - terminal = `{ position, name: pinNames[position], netId }`（:554-558）。net 按 lowercased name 去重；在 `globalNames`（必含 `"0"`）→ `global`，否则 `local`。
  - `topCells` = 从未被调用的 cell（:612-624）；无根 → `SPICE_BIND_NO_ROOT`。
- IR 类型（ir.ts）：`CircuitIR { dialect, topCells, cells[], parameters[], models[], preservedStatements[], unresolvedStatements[] }`（:136-168）；`CircuitCellIR { id, name, ports[], nets[], instances[], parameters[], sourceRef }`（:47-117）。全 Zod schema + `superRefine` 不变量。
- `detectSpiceDialect`（dialect.ts:22-81）：ngspice 是结构基线——无标记 → 回退 `spice3f5-core`（视为 ngspice 兼容）。
- round-trip：`printer.ts` 仅 12 行，`printSpiceSource` 返回 `source.text` verbatim。无损靠每节点 `rawText`，**无 AST→source pretty-printer**。

### 阶段 4 — 导入：IR → CircuitProject / SchematicDocument

`packages/spice/src/importer.ts`。`importCircuitIR`（:260）/ `importSpiceSources`（:351）。编辑器在 App.tsx:1837 调用。

- `importDocument`（importer.ts:178-253）对每个 `CircuitCellIR`：
  - instances：过滤无 terminal 的结构性实例（:184-196），每个经 `importInstance`（:133-176）。关键：**`placement: null`**（:173）——所有导入实例未放置。**`symbolVariantId` 不在导入期设置**（留 undefined，即默认四端形态）。
  - `importInstance` 调 `symbolFor`（:37-109）拿 mapping，失败回退 `generic-block-${terminals.length}`。`properties` 塞 `spice.name/target/param.*/pin.P1..Pn`。
  - nets（:213-232）：`Net.terminals` 是 `TerminalRef[] = { instanceId, pinName }`，`pinName` 从 `spice.pin.P{n}` 读回（用解析后符号 pin 名，非裸 SPICE 位置）。
  - document：`revision:0`，`sourceBinding:{cellName,sourceRef}`，**`sourceStatus:"in-sync"`**（:238），空 routes/junctions/annotations，`presentation` 默认 `{ styleProfileId:"textbook-monochrome-v1", grid:10, compactness:"normal" }`（:245-249）。
- `importCircuitIR`（:260-315）：`CircuitProjectSchema.parse` 组装持久 Project。

### 阶段 5 — 符号解析

`packages/symbols/src/`。

- `SymbolResolver.resolve(symbolId, variantId?) → { definition, variant? } | undefined`（resolver.ts:15）。`InMemorySymbolResolver`（:19-65）回退链：① alias（:44）② built-in/catalog 定义（:45）③ generated generic block（:48-53，`generic-block-N` 按需合成）④ variant（:57-63）。
- `createProjectSymbolResolver`（:67-75）叠加 `createProjectHierarchicalSymbols(project)`（hierarchical-block.ts:34）——把有 `sourceBinding.cellName`+ports 的 document 变成 `hierarchical-symbol`，pin 用 formal port 名。
- `builtins.ts`：`mosSymbol("nmos"|"pmos")`（:92-189）四端 D/G/S/B，带 `textbook-3terminal` variant（:179-186，`hiddenPinNames:["B"]` + `hiddenPrimitiveParts:["bulk-lead"]` + `additionalPrimitives` 加 source arrow）。独立 `nmos3`/`pmos3`（:191-209，物理无 B pin）。
- Razavi catalog（razavi-catalog.ts + razavi-catalog.generated.ts）：`nmos`/`pmos3`/`resistor`/`voltage-source` reviewed，带 semantic stroke role 和 `textbook-3terminal` variant（generated.ts:329-356）。`builtInSymbols`（:682-710）现是对 catalog 的 compatibility 视图。
- SPICE 设备名 → symbolId 映射（`symbolFor`，importer.ts:37-109）：subcircuit→hierarchical-symbol；model→先 PDK registry（pdk-registry.ts:41，sky130 `nfet_*`/`pfet_*` 四端 → `nmos`/`pmos`）再 model-type 启发；opaque→仅 PDK；primitive→静态表。
- **关键**：四端 D/G/S/B 是导入默认；`textbook-3terminal` variant **从不由导入期选**，由后续 layout recipe / typed edit 应用。

### 阶段 6 — Schematic Edit Engine

`packages/edit-engine/src/transaction.ts` + `history.ts`。

- `EditTransaction`（transaction.ts:215-222）：`{ transactionId, documentId, expectedRevision, actor:{kind:"human"|"agent",id}, dryRun?, edits[1..256] }`。
- typed edit union（:184-213）：28 种——instance（add/remove/set_instance_symbol/place/move/rotate/mirror）、port（place/move_port）、routing（set_route_points/add_junction/remove_junction/move_junction/make_flightline/connect_endpoints/merge_nets/set_net_name/disconnect_endpoint）、presentation（upsert_annotation/remove_annotation/set_layout_group/set_layout_constraint/align_instances）、control（noop/undo/redo）。
- 执行顺序（`executeTransaction`，:534-1637）：① schema 校验 ② documentId 匹配 ③ **revision 检查**（:557，`STALE_REVISION`，乐观并发锁）④ undo/redo 守卫 ⑤ **原子 apply**（`structuredClone` → draft，单循环，:578-1589，任一失败 `return rejectTransaction` 丢弃 draft，全有或全无）⑥ 结果 schema 校验（`INVALID_RESULT`）；sourceStatus 重算（:1591）⑦ revision+1 ⑧ diff + diagnostics。`dryRun:true` → `applied:false` 返回原文档。
- rollback 隐式：拒绝路径返回原始 document，draft 丢弃。
- undo/redo（history.ts:48-169）：整文档快照栈，**产生新 revision**（:130-134），不回退计数器。
- `set_instance_symbol`（:49-55）：`{ kind, instanceId, symbolId, symbolVariantId?, pinMap? }`。apply（:658-776）解析 variant、校验 pinMap、重写 `net.terminals`/`route.from,to`/`spice.pin.*`。variant 的 `hiddenPinNames` 让 bulk 视觉消失但电气仍在 net 上。

### 阶段 7 — Agent Adapter（四操作）

`packages/agent-adapter/src/`。

- v2：`capabilities | snapshot | transact | render`（service.ts:36-42）。
- transact 门控（service.ts:712-786）：① size/budget（`edits.length > maxTransactionEdits`，默认 64）② capability/permission（`editCategory` 分 geometry/connectivity/presentation/unsupported，:417-454，undo/redo → `UNSUPPORTED_EDIT`）③ 桥到 `executeTransaction`，`actor:{kind:"agent",id}`。成功 → `store.commitDocument` + in-memory history ring（默认 32）。
- snapshot（snapshot.ts:389-403）：`buildAgentSessionSnapshot` 产 `{ snapshotVersion, topologyHash, byteLength, project, document }`。topologyHash = canonical JSON 的 SHA-256。**双向 pin↔Net map**（:203-215，`terminalNetByKey`/`portNetById`）；每个 pin 带 `role/direction/visibility/localPosition/pagePosition`（pagePosition 经 `transformPoint`，:278-285）；variant 隐藏 pin 报 `visibility:"conditional"`（:237）；routes 带 resolved `polyline`；diagnostics 来自 `diagnoseVisualQuality`。
- loopback HTTP（http.ts:95-213）：仅绑 `127.0.0.1`/`::1`；`Bearer <token>`（≥32 字符，`timingSafeEqual`）；只 `POST /v1/circuit` 和 `/v2/circuit`。无 OAuth/session/rate-limit。

### 阶段 8 — Derived Engine

`packages/derived/src/`。纯函数，不渲染。

- pin 坐标：`resolveEndpointPoint`（endpoint.ts:52-89）唯一真值源——terminal→`transformPoint(pin.at, placement.position, placement)`（geometry.ts:24-37：先 mirror 再 rotate 再 translate）。**pin 坐标永远派生**。
- 可见连通图（connectivity.ts:66-118）：`netEndpoints(...).filter(isVisibleEndpoint)` 先过滤隐式/隐藏端点（endpoint.ts:30-50：variant `hiddenPinNames` 或 base `visibility:"implicit"` → 不可见；`conditional` 保持可见 fail-safe）。`DisjointSet`（:39-64）并查集，root 按 `localeCompare("en")` 确定性择优。只有匹配 net id 且两端都可见的 route 才加边（:89-95）。
- flightline MST（connectivity.ts:156-206）：`componentAnchor` 选到其他定位节点 Manhattan 总距离最小的节点（:133-154）；<2 anchor 跳过；全对 Manhattan 距离完全图；边按 distance→fromKey→toKey 排序；Kruskal。overlay，不进正式导出。
- routes（routes.ts）：`routePolyline`（:33-47）= `[fromPoint, ...waypoints, toPoint]`；`normalizeRouteGeometry`（:71-110）去重/合并共线；`moveRouteSegment`（:112-194）段拖拽保正交；`deriveCrossings`（:250-303）分类 crossing/overlap。
- stretch（stretch.ts）：`proposeLocalStretch`（:75-146）单实例移动重布线；`proposeGroupMove`（:156-292）组移动，内部 route/junction 整体平移。
- diagnostics（visual.ts:167-336）：`VISUAL_UNPLACED_INSTANCE`/`UNRESOLVED_SYMBOL`/`SYMBOL_OVERLAP`/`LABEL_OVERLAP`/`SHORT_SEGMENT`/`AMBIGUOUS_JUNCTION`/`CONSTRAINT_VIOLATION`/`OUTSIDE_PAGE`。

### 阶段 9 — SVG 渲染

`packages/render-svg/src/`。

- `buildSvgScene`（render.ts:319-497）：parse → `resolveSchematicStyleProfile(document.presentation.styleProfileId)`（:325，未知 id **抛错不静默回退**）→ viewBox → 四层 `<g data-layer="formal">`（:493）：routes / ports（仅无 power-label 的画 origin dot）/ junctions（实心圆）/ symbols（:384-421，`renderSymbolDefinitionBody` 过滤 `hiddenPrimitiveParts` + 加 `additionalPrimitives`，:91-101）/ annotations。
- Razavi profile（style-profile.ts:94-136）：`foreground:"#202020"`；strokes wire/symbol/normal 1.6、emphasis 2.4、supply 1.8、annotation 1.6；`lineCap:"butt"`/`lineJoin:"miter"`；`scaleFormalStrokes:true`（无 non-scaling-stroke，缩放线宽跟着变）；junction/port radius 3；supplyBarWidth 20；currentArrowLength 24。
- 排版（schematic-text.ts:94-111）：`parseSchematicMath`（:32-69）把 `VIN+` → base `V` + subscript `IN` + suffix `+`；三 `<tspan>`：base（italic bold）、subscript（68% size，baseline-shift -0.3em）、suffix（upright，`baseline-shift:baseline; dy=0.3em`）。下划线优先。
- 语义节点：signal port = 实心圆 r=3；power port + power-label = 20 单位 supply bar；explicit junction = 实心圆 r=3；两线拐角不画 dot；未连接交叉不画 dot。**度数本身不产生 dot，连接性和显式对象类型才是权威**。
- profile 选择：per-document `document.presentation.styleProfileId`。legacy `textbook-monochrome-v1` 保留字面数值、non-scaling stroke、byte-identical goldens。

### 阶段 10 — 编辑器画布 + overlay

`apps/editor/src/App.tsx`。单 `<svg>`：grid pattern → 背景 rect → `<g dangerouslySetInnerHTML={{__html: scene.formalBody}}>`（:2768）→ `<g data-layer="editor-overlay">`（:2769-2996，flightline/wire-preview/route hit-target/segment handle/instance hit-target/endpoint hit-target/annotation hit-target/drag preview）。Wire tool（:787-916）：首点设 source，次点 `commitWire` 组装 edits。Move（:1362-1491）调 `proposeGroupMove`。`transact`（:746-757）包 `history.current.transact`，actor=human。

### 阶段 11 — 导出

`packages/exporters/src/`。`createFormalExportSource`（index.ts:20-34）调 `renderDocumentSvg`——**导出 SVG 与屏幕 formal body 完全一致（无 overlay）**。PNG（browser.ts:23，canvas 3x）/ PDF（pdf.ts:8，pdf-lib，固定日期 2000-01-01 求确定性）/ Node（node.ts:45，resvg + DejaVu Serif，把 `Georgia`→`DejaVu Serif`）。

### 阶段 12 — Agent 布局回路（Razavi 风格的实际生产路径）

三层：

1. **governing Skill**（`skills/circuit-layout/SKILL.md`）：管「怎么工作」——要求 API 2.0/Snapshot 1.0，读 capabilities，取完整 Snapshot，选 document，推理边界/Net 角色/信号路径，选一个局部改进，表达成 typed edits（每 transaction ≤ maxTransactionEdits），dry-run 后 commit，查 diagnostics + render，refresh。硬边界：保电气拓扑、用当前 revision、保 locked 对象、不靠 crossing 当连接、不猜 pin order/bulk/PDK。**Skill 里零 Razavi 视觉内容**——无线宽、无排版规则、无节点处理、无构图 canon。
2. **knowledge docs**（`docs/agent/knowledge/`）：`schematic-expression.md`（最接近 Razavi 构图指导，但全是软散文：「主信号左到右」「正电源在上负在下」「差分/匹配局部对称」）、`circuit-reading.md`、`routing-and-diagnostics.md`、`patterns/{differential-pair,current-mirror,arrays-and-ladders,switching-and-sampling}.md`、`pdk-and-symbols.md`、`hierarchy-and-large-circuits.md`。**所有坐标/折点/镜像/拐角选择全部留给 Agent 自由推理，无任何公式**（rule-guided-layout-architecture.md:52 明确）。
3. **recipe + runner**：`netlists/.../razavi-layout.mjs` 是**人手写的确定性坐标脚本**，被 `tools/agent-layout/generate.mjs` 消费。它**不走 capabilities/snapshot**，在 `prepareModel` 直接改 port 坐标，`buildEditPhases` 返回固定 place_instance/set_route_points/upsert_annotation。`agentId` 只是个标签，不是真 AI 调用。

---

## 3. 评估：为什么 AI 画不好 Razavi 风格

### 3.0 先拆分「风格」与「走线」

Razavi 风格体现在四个方面：**器件**（component geometry）、**线宽**（stroke profile）、**文本**（typography / schematic-math）、**走线**（routing）。

前三者**可以**硬性定义，并且仓库一直在做：`razavi-textbook-style.md` 已把 token 定死，RV-3/4/5 实现了 stroke/typography/nodes。完成 RV-6/7/8 后，对这三个方面「像不像 Razavi」是可机械判定的。

**走线无法硬性定义**——电路千变万化，不存在「所有电路都这样走」的规则。`razavi-textbook-style.md` 也明确把 routing topology、automatic layout、elbow choice、obstacle avoidance 排除在 fixed-style 之外。唯一有效的走线硬约束是**结构性的**：正交、显式 junction vs crossing、不重叠——这些已由 Edit Engine 和 `diagnoseVisualQuality` 强制。走线**策略**（trunk、elbow、路径选择）本质软，按电路而异，留给人或 AI 判断。

因此「AI 画不好 Razavi」其实是两个被混在一起的问题：

- **风格保真度**（器件/线宽/文本）——可硬性定义，**可机械达成**：完成 RV + 把 spec 暴露给 Agent 即可。
- **走线质量**——本质软，结构规则已强制，策略按电路而异，**不是 Razavi 特有缺口**。

下面按这两个桶归类 Gap。

### 3.1 风格保真度桶（器件 / 线宽 / 文本，可硬性定义）

#### Gap A — Agent 根本不知道 Razavi 长什么样

`razavi-textbook-style.md` 归 `packages/symbols`/`render-svg`/`tools/vss-import` 所有，**不在 Agent 的 knowledge manifest 里**（manifest 只路由到 circuit-reading/schematic-expression/routing/hierarchy/pdk/human-collaboration + 4 张 pattern 卡）。AI 有契约（typed edits/Snapshot）却没有风格目标——不知道线宽层级、math-label 规则、节点处理、supply-bar 约定。

#### Gap D — Razavi profile 还没对新 Project 生效

RV-7 未完成，新 Project/导入默认仍是 `textbook-monochrome-v1`（legacy 数值线宽、无 schematic-math、无语义节点）。**即使 AI 布局完美，输出也不会「看起来像 Razavi」**，除非有人显式设 profile。

#### Gap E — 符号 catalog 大部分没迁移

RV-6（完整）未完成。只有 nmos/pmos3/resistor/voltage-source + provisional Pmos3.a 是 reviewed Razavi 资产。二极管/BJT/op-amp/开关/数字门（Batch B/C）回退到 generic-block 或 legacy built-in。spec 把「零未解释 generic fallback」当完成标准——现在远没达到。

#### Gap I — caption/glyph 渲染脆弱

Run 1（D tier）和 recipe 本身都撞到「corrupted caption glyphs」/ UTF-8 minus 问题。`schematic-expression.md:51-53` 警告「generated explanatory captions 用纯 ASCII，除非最终 render 确认每个非 ASCII glyph」。而 Razavi 排版 spec 想用 Unicode minus。AI 跟 spec 会发非 ASCII；renderer/font 路径不校验就 corrupt。

### 3.2 走线质量桶（本质软，结构规则已强制，策略按电路而异）

#### Gap C — 没有走线辅助暴露给 Agent

唯一 derived route 协助是 `stretch.ts`（移动时的局部端点 stretch）。**无 path-finding、无 obstacle avoidance、无 trunk proposal、无 elbow chooser**。AI 要手写每个 waypoint 的 `set_route_points`。注意：这**不是**「缺少走线硬约束」（结构规则已强制），而是缺少**可选的软辅助**来减轻自由推理负担。

#### Gap G — port-label 完整性规则机械套用反噬

Run 2 发现「每个 port 和每个断开的 label-based Net 分支必须在用点可见」规则被机械套用，产「重复 local label、过高单列 parent、密集共享 rail」。补救是 outcome-based（「选最不杂乱的；移除冗余文本；允许紧凑矩阵包裹；忽略任何让当前 render 变差的卡片建议」）。这印证：走线/构图层面，硬规则过度标注变杂乱，软规则靠 AI 判断——后者才是正道，问题在 AI 判断本身。

#### Gap J — 层次表达偏弱

知识文档说「稳定重复 cell 保持层次」，但 Run 1 D-tier 恰在层次上失败：「left common hierarchy pins as unexplained stubs」。`hierarchy-and-large-circuits.md` 说「parent render 里每个 child port 必须可见连接或本地可识别」，但不给具体约定（trunk vs. boundary vs. labels）——留给 Agent 判。层次 port 表达方式本质属于走线策略，无法硬定义。

#### Gap H — 仓库里唯一「好的 Razavi 输出」是人手写脚本

`razavi-ota-5t-live.svg/png/pdf` 由 `razavi-layout.mjs` 产出——固定坐标、绕过 Agent 回路、直接改 model。它甚至有 correctness bug（无条件 3-terminal 覆盖、UTF-8 minus、power-label 未 attach），在当前 `hidden-mos-terminal-correctness` target 才修。**没有任何证据显示 AI 通过 Snapshot→Skill→transact→render 回路在未见电路上产出过好的 Razavi 布局**。first-vertical-trials 显示 AI 连放 port、remap symbol 都做不到直到产品 gap 被补；之后只有 RLC+CDAC 被**确定性 replay**，不是自由推理。

### 3.3 知识层的经验证据

两次 held-out 外部质量研究（Flash ADC、chopper AFE）：

| Tier                | Flash ADC | chopper AFE |
| ------------------- | --------- | ----------- |
| A（无 Skill）       | 4.0       | 4.2         |
| B（thin Skill）     | 3.8       | 4.0         |
| C（Skill + core）   | 4.8       | 2.8         |
| D（Skill + 全知识） | **2.6**   | 3.2         |

Tier D 反而更差：「left common hierarchy pins as unexplained stubs, relied on prose for hidden connections, used distracting tap detours, and emitted corrupted caption glyphs」。gate 自己的结论（`phase-9-external-quality-gate.md:8-13`）：更大的指导未稳定提升可读性，支持扁平架构。

关键解读：失败集中在走线/构图层面（走线 detour、label 密度、层次 stub、glyph corrupt）——正是无法硬定义的那一桶。**软知识本身没错，错在机械套用**。正确做法是让知识真正 advisory、允许 AI 判（架构本意），而非堆更多 prose 或转成硬规则。

### 链路瓶颈汇总

按桶归类：

| 桶   | 链路位置       | 现状                         | 缺口                                                                         |
| ---- | -------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| 风格 | 阶段 4 导入    | `styleProfileId` 默认 legacy | RV-7：新 Project 默认切 `razavi-textbook-v1`                                 |
| 风格 | 阶段 5 符号    | 仅 4-5 个 reviewed 资产      | RV-6/8：Batch A/B/C catalog 迁移 + SPICE/PDK 自动映射                        |
| 风格 | 阶段 12 Skill  | 零 Razavi 视觉内容           | 把 `razavi-textbook-style.md` 的线宽/排版/节点 canon 放进 knowledge manifest |
| 风格 | 阶段 9 渲染    | glyph/font 校验弱            | 非字符 glyph 在导出路径确认渲染                                              |
| 走线 | 阶段 8 derived | 无走线软辅助                 | 可选、可关闭的 route proposal（trunk/escape/elbow），按实测瓶颈决定          |
| 走线 | 阶段 12 知识   | 软散文机械套用               | outcome-based，允许 AI 判，移除冗余标注                                      |
| 走线 | 阶段 12 评估   | 硬规则过度标注变杂乱         | outcome-based + 可测量指标，而非更多 prose                                   |

---

## 4. 交给 AI 做初版：缺什么

按桶分开看，路径清晰度差异很大。

### 4.1 风格保真度（可达成）

这是「AI 画出来像不像 Razavi」的**可机械达成**部分，全部围绕三个硬性方面：

1. **把风格目标放进 Agent 视野**（Gap A）：`razavi-textbook-style.md` 接进 knowledge manifest，让 AI 知道线宽层级、math-label 规则、节点处理、supply-bar 约定。
2. **让 Razavi profile 对新 Project 生效**（Gap D）：完成 RV-7，新 Project 默认 `razavi-textbook-v1`，否则器件/线宽/文本再对也不像 Razavi。
3. **补全符号 catalog**（Gap E）：完成 RV-6/8，让大多数器件能选 reviewed Razavi 几何而非 generic 回退。
4. **glyph 渲染校验**（Gap I）：非 ASCII glyph（如 polarity minus）在导出路径确认渲染。

这一步做完，「Razavi 风格」对器件/线宽/文本三方面是可判定、可达成的——本质是**完成已规划的 RV 工作 + 把既有 spec 暴露给 Agent**，不需要发明新机制。

### 4.2 走线质量（本质软，独立于 Razavi 风格）

走线策略无法硬性定义。**不要试图把走线升级成可诊断硬约束**——这是死路，因为电路千变万化。唯一可考虑的机械手段是**可选、可关闭的软走线辅助**（trunk/escape/elbow proposal），架构门控为「只有实测瓶颈才加」——两次外部研究的负结果正是瓶颈已出现的证据。但这是帮助走线质量**一般性**提升，**不是** Razavi 风格保真度的特有缺口。

走线/构图层面，知识层应保持 advisory、允许 AI 判（架构本意），并用 outcome-based 评估而非堆 prose 或转硬规则。

### 4.3 核心结论

「AI 画不好 Razavi」是两个问题的混合：

- **风格保真度**（器件/线宽/文本）——可硬性定义、可机械达成，路径是「完成 RV-6/7/8 + 把 spec 暴露给 Agent」。这部分**完全可做**，是已规划工作的收尾，不需要发明新机制。
- **走线质量**——本质软，结构规则已强制，策略按电路而异。**不能**靠硬约束解决（死路），只能靠 AI 推理 + 可选软辅助。这是独立于 Razavi 的一般难题，不应混进「Razavi 风格」评估。

因此「交给 AI 做初版」要真正可行，**风格保真度这条线先打通**（它可达成、可判定）：完成 RV + 暴露 spec。走线质量则视 AI 推理是否足够，不足时再补可选软辅助——但那是走线问题，不是 Razavi 问题。

---

## 附录：关键文件:行号索引

- 阶段 1：`createSourceBundle` `packages/spice/src/source.ts:165`；`resolveInclude` `:46`
- 阶段 2：`buildLogicalLines` `packages/spice/src/syntax.ts:236`；`parseInstance` `:491`；`parseSpiceSource` `:1008`
- 阶段 3：`compileSourceBundle` `packages/spice/src/compiler.ts:577`；`buildCell` `:478`；`defaultPinNames` `:402`；IR 类型 `packages/spice/src/ir.ts:47,136`
- 阶段 4：`importCircuitIR` `packages/spice/src/importer.ts:260`；`importInstance` `:133`（`placement:null` `:173`，`sourceStatus:"in-sync"` `:238`）；`symbolFor` `:37`
- 阶段 5：`SymbolResolver` `packages/symbols/src/resolver.ts:15`；`mosSymbol` `builtins.ts:92`；Razavi catalog `razavi-catalog.generated.ts:329`；PDK `pdk-registry.ts:41`
- 阶段 6：`executeTransaction` `packages/edit-engine/src/transaction.ts:534`；edit union `:184`；`set_instance_symbol` `:49`；`STALE_REVISION` `:557`；history `packages/edit-engine/src/history.ts:48`
- 阶段 7：v2 操作 `packages/agent-adapter/src/service.ts:36`；transact 门控 `:712`；snapshot `packages/agent-adapter/src/snapshot.ts:389`（pin↔Net `:203`）；loopback HTTP `http.ts:95`
- 阶段 8：pin 坐标 `packages/derived/src/endpoint.ts:52`（`isVisibleEndpoint` `:30`）；可见连通 `connectivity.ts:66`；flightline MST `:156`；routes `routes.ts:33`；diagnostics `visual.ts:167`
- 阶段 9：`buildSvgScene` `packages/render-svg/src/render.ts:319`；Razavi profile `style-profile.ts:94`；排版 `schematic-text.ts:94`
- 阶段 10：编辑器画布 `apps/editor/src/App.tsx:2685`；wire tool `:787`；transact `:746`
- 阶段 11：`createFormalExportSource` `packages/exporters/src/index.ts:20`
- 阶段 12：Skill `skills/circuit-layout/SKILL.md`；knowledge `docs/agent/knowledge/`；recipe `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-layout.mjs`；runner `tools/agent-layout/generate.mjs`；外部 gate `docs/agent/examples/phase-9-external-quality-gate.md`
