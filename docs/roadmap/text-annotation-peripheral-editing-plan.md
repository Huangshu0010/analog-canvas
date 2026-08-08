# 文本、标注与外围绘图系统实施方案

状态：`proposed`  
建议实施位置：Phase 8/9 之后的独立横切工作包  
主责模块：`packages/model`、`packages/edit-engine`、`packages/derived`、`packages/render-svg`、`apps/editor`、`packages/agent-adapter`

## 目标

把目前零散的“添加文本”“电流箭头”“图注”等功能，收敛为一套适合模拟电路教材绘图的**文本与外围绘图系统**。它应让人工和 Agent 都能稳定地创建、编辑、吸附、移动、复制、导出下列内容：

- 富文本：下标、上标、斜体、粗体、分数、换行与字号；
- 电气语义标注：器件名、网名、电源名、贴在线路上的电流/电压标记；
- 纯视觉的箭头、引线、说明文字、框选与构造线；
- 不参与连通性的外围浮动符号；
- 只服务编辑辅助、不会导出的参考线和对齐线。

这不是通用矢量绘图软件。范围始终服务于 Razavi/教材式原理图的表达、审阅与人工微调。

## 现状审计与问题定性

当前 `SchematicDocument.annotations` 将以下异质对象放进一个结构：

```text
instance-label | net-label | power-label | plain-text |
current | voltage | figure-caption
```

每个对象只有一个字符串、位置、旋转、粗粒度 `sizeScale`，并且只有 `current` 能使用 `routeAttachment`。渲染器已能把 `M_{1}`、`V_{DD}`、`\\it{...}` 解析为有限的数学样式；编辑器也已有“添加文本”“添加电流箭头”“改字号/文本”的入口。问题是这些能力并不构成可扩展系统：

| 已有能力 | 当前限制 | 产品后果 |
| --- | --- | --- |
| 单行字符串文字 | 以正则识别少数下标/斜体，不能表达嵌套样式、上标、分数、可控换行 | 文本输入看似可编辑，实际无法写教材公式 |
| `current` route attachment | 其他文本、箭头、引线均不能贴 Route；attachment 是 `current` 专属 | “贴在线上”的表达只能特例实现 |
| `Annotation` upsert/remove | 没有通用图形、辅助线、外围符号或层级 | 每增加一种视觉元素都要继续膨胀 `AnnotationKind` |
| 自由位置 annotation | 缺少对象/Route 吸附语义、失效诊断及拖动把手 | 拉伸线路或移动器件后，说明性图形不稳定 |
| 画布选择 | 器件、Route、annotation 的命中优先级和小把手未统一 | 文字/箭头容易被器件遮挡，精调困难 |

结论：这是**模型边界和交互体系不完整**，不是再添几个按钮能解决的问题。

## 必须冻结的边界

### 1. 电气层与绘图层严格分离

| 层 | 内容 | 是否改变 SPICE/连通性 | 是否进入 formal SVG/PDF/PNG |
| --- | --- | ---: | ---: |
| Electrical | instance、port、net、route、junction | 是 | 是 |
| Schematic annotation | 器件名、网名、电源名、贴 Route 的电流/电压标记 | 仅网名等已定义的语义动作 | 是 |
| Drafting overlay | 自由文本、箭头、引线、callout、构造线、外围浮动符号 | 否 | 是 |
| Editor guide | 水平/垂直参考线、临时对齐辅助 | 否 | 否 |

外围箭头、说明线、浮动符号**绝不能**伪装成有引脚的 `Instance`，也不能创建 Net、flightline、Junction 或 SPICE 实例。相反，网名依然是电气语义：给 Route 命名仍使用既有 `set_net_name`，不是一个普通的文字覆盖层。

### 2. 两种“辅助线”必须分开

- **Guide（编辑参考线）**：蓝/灰色、可锁定/隐藏、用于吸附和对齐，不导出，也不在 Agent 的默认视觉审阅中出现。
- **Construction line（构造线）**：黑色或风格化的永久视觉对象，可导出，可作为教材图中的边界、反馈环路或说明连接线，但不导电。

这一区分消除“辅助线是否应当导出、是否会电气连接”的歧义。

### 3. `Annotation` 不再无限扩充

保留并收窄 `annotations` 为 **SchematicAnnotation**：

```text
instance-label | net-label | power-label | route-marker
```

其中 `route-marker` 的 `markerKind` 为 `current` 或 `voltage`。`plain-text`、`figure-caption` 和将来的纯视觉图形迁入新 `drafting` 容器。旧文件通过一次 schema migration 映射，不保留两套可写真相。

## 推荐的数据协议

### 根对象

在 `SchematicDocument` 中增加一个单一、受限的绘图容器，而不是给每种工具各开一个顶层数组：

```ts
interface DraftingLayer {
  objects: DraftingObject[];
  guides: Guide[];
}
```

`objects` 是持久化并参与正式导出的视觉对象；`guides` 是可持久化的协作辅助状态，但始终 `export: false`。默认 Snapshot 只报告 guide 的数量和可见性；只有 Agent 明确请求 `includeEditorGuides: true` 才返回坐标，避免把编辑噪声误当电路内容。

### 锚点：所有可吸附对象共享一个契约

```ts
type VisualAnchor =
  | { kind: "free"; position: Point }
  | { kind: "object"; objectId: StableId; localOffset: Point }
  | {
      kind: "route";
      routeId: StableId;
      segmentIndex: number;
      t: number;              // 0..1，随该 segment 拉伸而保持比例
      normalOffset: number;
      direction: "forward" | "reverse";
      orientation: "follow" | "horizontal";
    };
```

现有 `RouteAnnotationAttachment` 的有效语义进入这里。锚点解析只读取派生 Route 几何，不会改动 Route 或 Net。若目标 Route/对象不存在、segment 被删除或不再正交，系统不静默改挂到别的导体：保留最后已解析的 `fallbackPosition`，渲染为可见警告状态，并给出“重新吸附/转为自由对象/删除”三个明确操作。

### 富文本是结构化内容，不是可执行公式

```ts
type RichTextDocument = { runs: RichTextRun[] };
type RichTextRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | { kind: "span"; style: "italic" | "bold" | "subscript" | "superscript";
      children: RichTextRun[] }
  | { kind: "fraction"; numerator: RichTextDocument; denominator: RichTextDocument };
```

初版只支持上述六种节点；不支持任意 LaTeX、宏、脚本、SVG/HTML 注入或任意字体。渲染器把 AST 转成安全 SVG `tspan`/路径组合，导出和画布共用同一实现。

为降低输入摩擦，编辑器和 Agent 接受受限的**导入快捷语法**，在提交时解析为 AST：

```text
M_{1}                 -> M₁
V_{DD}                -> V_DD
V_{in}^{+}            -> V_in 上标 +
\\it{I_x}              -> 斜体 I_x
\\frac{g_m}{r_o}       -> 分数
```

快捷语法不是持久化真相；无法解析时以普通文本保存并给出可见提示，绝不丢字。现有单字符串 annotation 通过 migration 转为一个 `text` run，兼容已有项目。

### 绘图对象联合类型

```ts
type DraftingObject =
  | DraftText
  | DraftArrow
  | DraftLeader
  | DraftCallout
  | DraftConstructionLine
  | DraftFloatingSymbol;
```

所有成员共用 `id`、`locked`、`zIndex`、`styleOverride?` 和有限的 `VisualAnchor`。初版的具体范围如下：

| 类型 | 最小字段 | 初版用途 | 明确不做 |
| --- | --- | --- | --- |
| `text` | `content`、`anchor`、对齐、框宽、字号 token/scale | 公式、图注、自由说明 | 任意富文本文档排版 |
| `arrow` | 起点/终点或 Route anchor、头部样式 | `I_x` 以外的方向标记 | 贝塞尔曲线、任意箭头图库 |
| `leader` | 起点、终点、可选文本目标 | 从说明文字指向器件/节点 | 自动避障 |
| `callout` | `RichTextDocument` + 一个 leader | 一次选择、一次移动的带箭头说明 | 多框/多 leader 流程图 |
| `construction-line` | 正交两点或折线、线型 | 非电气反馈框、分区线、外部说明线 | 参与 Route 拓扑 |
| `floating-symbol` | catalog `symbolId`、transform、anchor | 非电气的教材图标/装饰 | 有 Pin、可接线、SPICE 映射 |

`floating-symbol.symbolId` 只能引用 Symbol Catalog 中显式标为 `decorative: true` 的白名单条目；其渲染定义不得含 terminal。若用户需要电源、地或端口参与连通性，必须使用真正的 Component/Port，而不是浮动符号。

### Guide

```ts
interface Guide {
  id: StableId;
  axis: "horizontal" | "vertical";
  coordinate: number;
  locked: boolean;
  visible: boolean;
}
```

Guide 不需要复杂 shape、颜色或自由角度。水平/垂直两类已经满足原理图对齐需求，并能保持协议和命中逻辑简洁。

### 样式、层级与命中

- 样式优先从 `styleProfileId` 的 typography/stroke token 读取；对象只允许有限覆盖：`sizeScale`、`weight`、`italic`、`lineStyle`、`arrowHead`。不允许逐对象填任意 SVG/CSS。
- 视觉堆叠固定为：Guide（仅编辑器）→ 电气 Route/Junction → Symbol → SchematicAnnotation → Draft line/arrow → Draft text/callout → 选择把手。`zIndex` 只在同类 DraftingObject 内排序。
- 命中采用屏幕像素容差（而非巨大的文档坐标圆）：先选文字框/把手，再选 DraftingObject，再选 Symbol/Route；`Alt` 在同一点循环候选项。这样既能点击被器件遮住的文字，也不会扩大器件引脚的选择圈。

## 用户交互方案

### 工具与命令面

Header 不增加一排永久按钮。在既有 `More` 内加入三个折叠分组，并提供命令面板：

| 分组 | 内容 | 快捷键 |
| --- | --- | --- |
| Text | 文本、图注、格式工具 | `T` 进入文本放置 |
| Markup | 线路箭头、自由箭头、引线、callout、构造线、浮动符号 | `A` 为上次使用的 Markup 工具 |
| Guides | 添加水平/垂直参考线、显示/隐藏、锁定/清除未锁定 | `G` 进入 Guide 工具 |
| Command palette | 搜索全部低频命令 | `Ctrl+K` |

`R`、`W`、撤销/重做和现有键盘契约保持不变。只要富文本编辑器、输入框、搜索框拥有焦点，画布快捷键不得触发。

### 文本编辑

1. 选 `Text` 后单击画布、Route 或对象；悬停目标显示自由/Route/对象锚点预览。
2. 创建一个直接就地编辑的文本框；`Enter` 新行，`Ctrl+Enter` 提交，`Escape` 取消新对象或退出编辑。
3. 小型浮动格式条采用选择范围操作：斜体 `Ctrl+I`、粗体 `Ctrl+B`、下标 `Ctrl+=`、上标 `Ctrl+Shift+=`、分数按钮。字号通过 token 下拉（caption/body/label）加 ± 级，而不是暴露失控的 0.1–10 数字输入框。
4. 属性面板显示“锚点、对齐、旋转、字号、锁定”，并在每次合法修改时立即提交一个原子事务；失败必须保留草稿和报错，不得出现“面板看起来改了、模型没有改”的状态。

### 箭头、引线与贴线标记

- **Current marker**：选 Route 后可创建 `route-marker/current`；拖动沿同一 Route 更新 `segmentIndex/t`，拖动法向更新 `normalOffset`，反向按钮切换 `direction`。
- **Voltage marker**：以同样的 Route/对象锚点机制表达，而非自由漂浮的特例；显示 `+/-` 或文字由 marker variant 决定。
- **Arrow**：拖拽两点建立，按住 Shift 限制水平/垂直；起点或终点靠近 Route/对象时显示吸附预览。它只是视觉图形，不生成 Junction。
- **Leader/Callout**：先点被说明对象/节点，再拖到说明位置；leader 与富文本作为一个 callout 共同选择、移动、复制、删除。
- **Construction line**：与 Wire 外观和鼠标反馈明确区分（虚线/淡色预览）；端点可对齐但绝不显示电气 snap/junction 预览。

### Guide 与选择

- 从标尺拖出 Guide；无标尺的触摸环境可用 `G` 后单击。拖动 Guide 改位置，双击锁定，`Delete` 删除未锁 Guide。
- 吸附优先级：Pin/Junction/Route 只属于 Wire 会话；普通对象编辑只吸附 Grid、Guide、对象边界/锚点和已选择 DraftingObject 的端点。
- 框选包含 DraftingObject；移动一个被选 callout 时，其文字、leader、锚点偏移作为一个对象移动。复制/粘贴使用新 ID，并在同一 Document 内尽可能重映射内部 object/Route anchors；外部目标锚点变为 free anchor 并给出提示。

## Agent API 与事务协议

继续沿用非 MCP 的 `capabilities/snapshot/transact/render` API；不开放图形脚本或 SVG 注入。新增的 Edit Engine edit kinds：

```text
upsert_schematic_annotation | remove_schematic_annotation
upsert_drafting_object     | remove_drafting_object
set_guide                  | remove_guide
```

每一个 edit 都接受严格 JSON Schema 的对象联合类型。`transact` dry-run 必须返回：已解析锚点、失效 attachment、可能与电气对象重叠的诊断以及实际变更 IDs。Snapshot 增加：

- 完整 schematic annotations、drafting objects（含 canonical RichText AST）；
- resolved anchor、bounds、锁定状态、z-index 和失效诊断；
- 默认不含 Guide 坐标，显式选项才返回。

Agent 可以请求“创建 Razavi 风格的电流箭头并贴在 Route X 第 2 segment 的 60% 处”，但不能直接提交路径、SVG、CSS、HTML 或完整 Document。布局指南可建议文本/箭头位置，最终仍是上述类型化 transaction。

## 迁移与兼容性

此工作是持久化协议调整，须先更新 `Schematic Model`、`Edit Engine`、`Agent API`、`Editor Interaction` 四份规范；若决定 schema major version，增加 ADR。

迁移规则：

| 旧 annotation | 新位置 | 迁移方式 |
| --- | --- | --- |
| `instance-label`、`net-label`、`power-label` | `annotations` / SchematicAnnotation | 保留语义和附件 |
| `current` | `route-marker/current` | 现有 Route attachment 原样迁移 |
| `voltage` | `route-marker/voltage` 或 `drafting.text` | 有可靠附件时前者，否则保留为自由文本并提示审阅 |
| `plain-text` | `drafting.objects[text]` | string 变为单一 `text` run |
| `figure-caption` | `drafting.objects[text]` | 保留 caption typography token 和对齐 |

迁移必须幂等、可测试、不会改变 Net/Route/Junction/instance，也不得重写原始 SPICE。旧项目读取后自动升级到唯一的新真相；写回不得重新生成旧 `plain-text` 结构。

## 分阶段执行

### WP-A0：冻结合同与基线

- 更新上述四份规范，新增本方案采用的数据类型、层级、迁移和非目标。
- 新建三个 fixture：富文本、Route marker、外围 callout/guide；记录 Razavi formal SVG golden。
- 冻结 V1 语法范围：文本/斜体/粗体/上下标/分数/换行，直线箭头/引线/callout/构造线，水平/垂直 Guide。
- **验收**：评审能在不看实现的情况下区分 Wire、construction line、Guide、floating symbol 与 semantic label。

### WP-A1：模型、迁移、Edit Engine、派生锚点

- 引入 `drafting` 容器、RichText AST、共享 `VisualAnchor`、DraftingObject/Guide schemas。
- 将 annotation 收窄为 SchematicAnnotation，编写 versioned migration。
- 增加类型化事务、undo/redo、锁定检查、删除级联和稳定排序。
- 推广现有 `routeAttachmentPlacement()` 成通用 anchor resolver，产出 unresolved-anchor diagnostics。
- **验收**：旧 Project migration、事务原子性、锚点随 Route stretch、删除目标后的 fallback、复制 ID 重映射全部单测通过；电气拓扑哈希不变。

### WP-A2：统一渲染与导出

- 为 RichText AST 建立唯一 SVG renderer；画布、formal SVG、PNG/PDF export 共用。
- 实现 arrow/leader/callout/construction-line/floating-symbol 渲染和 Razavi style tokens。
- Guide 仅存在于 editor/diagnostic overlay，不得出现在 formal SVG 或导出字节。
- **验收**：富文本、箭头比例、锚点旋转、堆叠、导出与截图 golden；验证 Guide 不导出、DraftingObject 不影响 connectivity/flightline。

### WP-A3：文本编辑与选择体验

- 将当前单字符串文本面板替换为就地富文本编辑器和小格式条；导入快捷语法只作为输入便利。
- 重做 annotation/drafting hit-test、拖动、把手、选中顺序、Alt 循环选择与框选。
- 统一字号 token/scale 提交路径，删除“显示改动但未事务化”的并行 UI state。
- **验收**：Playwright 覆盖输入 `V_{in}^{+}`、`\\frac{g_m}{r_o}`、选择格式、拖动文字、被器件遮挡的 annotation 选择、撤销/重做、复制/粘贴。

### WP-A4：外围绘图与 Guide

- 实现 Arrow、Leader、Callout、Construction line、Floating symbol、Guide 的工具、菜单和属性面板。
- 添加 Route/Object/free attachment 的预览、重新吸附和失效处理。
- 增加 catalog 的 decorative capability，避免浮动符号混入电气实例。
- **验收**：创建贴在线的 `I_x`，Route 拉伸后箭头/文字正确跟随；创建说明 callout 并移动；创建 Guide 对齐两个 MOS；formal export 不含 Guide；浮动符号不会出现 Pin/Net/flightline。

### WP-A5：Agent API、可观察性与完整回归

- 扩充 capabilities、Snapshot、strict transaction schemas 与 API 文档。
- Agent dry-run/commit 和 GUI 进行同对象、同锚点、同 SVG 的 parity fixture。
- 审阅可访问性、性能、复制边界和旧项目升级报告。
- **验收**：API 拒绝 SVG/HTML/任意 LaTeX；Agent 与 GUI 可得到同一有效 Document；现有 Phase 7/8/9 的连接性、导出、快照和编辑回归仍通过。

## 端到端验收场景

```text
创建文本
-> 在差分对旁单击 Text
-> 输入 V_{in}^{+} = \\frac{V_{DD}}{2}，局部设置斜体
-> SVG、PNG、PDF 和画布显示相同的上下标、分数和字号
-> Ctrl+Z / Ctrl+Y 完整恢复
```

```text
创建电流标记
-> 选择一条水平 Route，添加 I_x
-> 箭头和文字贴在线上方，反向按钮有效
-> 拖动或拉伸该 Route
-> marker 仍位于相同 segment 的比例位置，电气 Net 完全不变
```

```text
说明与辅助
-> 创建指向 MOS gate 的 callout，并加入一个垂直 Guide
-> 用 Guide 对齐另一 MOS 后隐藏 Guide
-> formal 导出包含 callout，不包含 Guide
-> 删除 callout 的目标器件后显示失效锚点而不静默跳到其他器件
```

```text
人机一致性
-> GUI 与 Agent 分别创建相同的 Route marker 和 RichText callout
-> 读取 Snapshot 并正式渲染
-> 两者的 canonical JSON、resolved anchor、诊断和 SVG golden 一致
```

## 非目标与后续候选

本轮不实现：通用路径编辑、Bezier/自由手绘、任意 SVG 导入、图层树编辑器、数学排版完整 LaTeX、自动避障、注释协同评论、带 pin 的浮动“假器件”、或视觉对象到 SPICE 的反向转换。若教材绘图实际需要框、圆、括号等，先以一个独立的 `DraftShape` 扩展提案进入同一 `DraftingObject` 联合，而不是绕过该系统另开 JSON 结构。

## 实施顺序与风险控制

先 A0/A1，再 A2，最后才接 UI 和 Agent。不能先在 `App.tsx` 加按钮；那会再次制造只在浏览器可用、模型/API/导出不一致的功能。每个工作包须单独建立 `plan/<date>-.../plan.md`，在 dirty worktree 中声明所有权；模型和 schema 是共享合同，必须在其实现前协调其他并行修改。

最关键的审阅点是：富文本 AST 的最小范围、`drafting` 与 `annotations` 的迁移、Guide 是否进入协作持久化，以及 floating symbol 白名单。四项冻结后，其余工作可按上述顺序独立、可测试地推进。

## Drafting Runtime Completion status (2026-08-08 revision)

After the WP-A0..A6 implementation, a review found the drafting system was
"runtime-incomplete": the schema, Edit Engine, and a basic renderer existed,
but the editor and exporters did not consume a single derived-geometry source
of truth, and several claimed-complete items were not. This revision records
the actual state after the Drafting Runtime Completion fixes (P0-1..P0-2,
P1-rotation/bounds/typed-snapshot/tools/hit/scenarios/smoke, P2).

### Now true

- Reversible rich-text markup: `parseMarkup(serializeMarkup(ast))` equals ast
  for any valid AST (literal `V_{in}` text survives), moved to `packages/model`.
- Single derived geometry entry `resolveDraftingObjectGeometry`; the renderer,
  export bounds, and Agent Snapshot consume it (no per-consumer anchor math).
- Rotation semantics frozen: `geometry.rotation` is the single truth
  (`anchor.orientation === "follow"` composes anchor + object rotation).
- Drafting bounds accurate for rotated/mirrored floating symbols and
  multi-line text; export viewBox includes them; Guides never export.
- Drafting drags commit exactly one transaction (preview + pointerup), so one
  undo undoes a whole drag; a click without movement does not commit.
- Canvas drag-create tools for construction lines and arrows; shape-based hit
  targets (stroke polyline/line) instead of blocking bounding rects.
- Agent Snapshot exposes strict typed `ResolvedDraftingGeometrySchema` /
  `DraftingDiagnosticSchema` (no `z.unknown`), and distinct
  `DRAFTING_ROUTE_SEGMENT_INVALID` diagnostics.
- Real production-preview smoke (build -> vite preview -> browser, 0 console
  errors, no node:crypto externalization), plus E2E for rich-text AST,
  unedited-Apply no-revision, atomic drag, anchor persistence, drag-create, and
  shape hit.

### Remaining (explicitly not complete)

- Leader/Callout creation commands and per-object endpoint handles; detach-to-
  free and object-anchor offset adjustment in the GUI are not implemented.
- Selection of non-text drafting kinds is click-select/delete only; no box
  select, copy/paste, or drag for arrow/leader/callout yet.
- These are tracked as follow-up interaction work, not claimed complete.

### Final runtime repair (2026-08-08)

The second audit found that several statements above were supported only by
shallow or mislabeled tests. The final repair closes those gaps:

- Rich-text markup now uses a bounded recursive parser through the full model
  depth; nested spans/fractions, literal command-like text, and empty malformed
  commands are covered by schema-valid round-trip tests.
- Style profiles and rich-text measurement live at the derived presentation
  boundary. Bounds use the active profile, typography token, size override,
  longest line, and actual fraction operands; SVG line breaks reset to the
  text object's real x origin.
- Existing free-text drag is verified as one transaction, one undo, with a
  shared Escape/pointer-cancel path that removes listeners and drops preview
  state. Callout hit testing includes both its leader and text box.
- Persistence coverage performs a real Save Project -> Open Project cycle and
  compares the reopened canonical AST and anchor instead of conditionally
  inspecting recovery storage.
- Production smoke uses Vite's preview server, guarantees browser/server
  cleanup, and `--check` reads the committed report without rewriting it. It is
  part of `release:verify`.
- The visual example command now migrates its checked-in legacy fixture through
  `parseProject`; browser PNG/PDF exporters are bound at build time, avoiding a
  stale runtime module fetch in the GUI.

The interaction items listed under **Remaining** are still deliberate future
scope; this repair does not relabel them as completed.
