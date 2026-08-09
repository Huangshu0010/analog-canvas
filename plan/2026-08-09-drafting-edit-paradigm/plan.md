# Drafting 图形对象编辑范式（阶段 1+2+3）

## Goal

把 Arrow / Construction line 从「拖拽即提交」的一次性动作，改成与 Wire 同一心智模型的
**两阶段绘制** + **统一命中/选择层** + **端点/顶点编辑**。解决三个核心体验问题：
生硬（无捕捉/预览）、难选（透明命中线、无固定屏幕容差）、不能调整（仅整体平移、
无端点/顶点/旋转编辑）。

**已确认范围决策（人确认，见对话）：**
- 本轮做**阶段 1+2+3**。阶段 4（styleOverride 扩展 strokeScale/arrowHeadScale）、
  5（route current marker）、6（回归全集）**推迟**为独立目标——它们触及
  schema/render/export/agent-api，跨包回归面大。
- 阶段 1 捕捉候选 = **网格 + pin/port/junction**（复用 `visibleEndpoints` +
  `pointFromClient` 网格 snap）。route 段捕捉、drafting 顶点捕捉推迟。

**四类对象边界不变**：Wire（电气）、Route current marker（绑 route）、
Draft arrow / Construction line（本轮）、Guide（编辑器辅助、不导出）。
本轮不触碰 Wire 电气逻辑、不把 route marker 变自由箭头。

## Dirty-State Note

开始前 `git status`（2026-08-09 实施前复核）：

```text
## feat/razavi-fidelity-diff-harness...origin/feat/razavi-fidelity-diff-harness [ahead 10]
 M apps/editor/src/App.test.tsx
 M apps/editor/src/App.tsx          ← command hierarchy / selection shelf / help tutorial 等并行目标
 M apps/editor/src/styles.css       ← 同上
?? .zcode/ fixtures/... netlists/... plan/2026-08-09-* 等
```

**Ownership 判定（与人协调后）：**

`App.tsx` / `styles.css` 的未提交 dirty 属于**多个并行 editor 目标**（command hierarchy、
selection shelf 持久化、help tutorial），**不属于本目标**。本目标同样要大改 `App.tsx`
（`beginCanvasGesture` :3263、`commitDraftingCreate` :3446、命中层 :4865-4980、
键盘 :3722、`onClick` :4556）与 `styles.css`（handle/预览视觉）。

**处理方式（人确认）：** 在本目标开始编辑 `App.tsx`/`styles.css` 前，由人先提交或 stash
当前未提交工作，给本目标一个 clean 的 `App.tsx`/`styles.css`，使两目标的 hunk 不交织、
各自可独立 stage/commit/review。**Agent 在 `App.tsx`/`styles.css` 仍 dirty 时不开始
触碰它们**，只可先做纯 derived/model 包的 geometry 扩展（不与 editor 工作重叠）。

实施开始时必须重新 `git status`，确认 `App.tsx`/`styles.css` clean（或 stash 后）。

## Owned Files

- `apps/editor/src/App.tsx`（状态机 + 命中层 + 编辑 handles + 键盘）
- `apps/editor/src/styles.css`（handle/捕捉/预览视觉）
- `packages/derived/src/drafting-geometry.ts`（geometry 加 center + 可编辑端点/顶点）
- `packages/model/src/drafting-geometry-schema.ts`（镜像 Zod，strictObject 同步加字段）
- `packages/derived/src/drafting-geometry.test.ts`（更新断言）
- `apps/editor/e2e/drafting.spec.ts`（重写创建手势 + 新增编辑回归）
- `plan/2026-08-09-drafting-edit-paradigm/plan.md`
- `plan/log.md`（完成时）

## Read-Only Files

- `packages/model/src/schema.ts`（**不改** styleOverride——阶段 4 推迟）
- `packages/render-svg/src/render.ts`（不改——正式 SVG 渲染不变）
- `packages/edit-engine/src/transaction.ts`（复用现有 `upsert_drafting_object`，不加新 edit kind）
- `apps/editor/src/App.test.tsx`（不改；SSR 测试，drafting 改动不应影响其字符串断言）
- `apps/editor/src/rich-text-editor.tsx`、`clipboard.ts`、`delete-selection.ts`
- Wire 电气逻辑、route marker 绑定语义
- `packages/agent-adapter`（geometry 字段加了后 snapshot 自动带，但本轮不改其 schema/快照逻辑）

## Shared Dependencies

- **`resolveDraftingObjectGeometry`** 契约（derived + model 镜像 schema）：本目标加几何
  字段（arrow `center`、construction-line `vertices`）。两处 `strictObject` 必须**同步**，
  否则 agent snapshot 的 `ResolvedDraftingGeometrySchema` 校验拒收。这是硬约束。
- **`upsert_drafting_object` edit kind**（edit-engine）：所有 drafting 几何变换（端点/顶点/
  旋转）走此 edit，full-object 替换。不加新 edit kind。
- **白底画布 + 正式渲染不变量**（A 包延续）：不改 `render.ts`、不改 `.schematic-canvas`
  背景。drafting 预览/handles 全在 `data-layer="editor-overlay"`，不导出。
- **e2e `drafting.spec.ts` test 8 硬约束**：construction-line hit 必须仍是 `<polyline>`
  且可点选。阶段 2 命中层重构不得改其标签。
- **selection 语义 + context-actions 不变量**（E 包延续）：阶段 2/3 不改 selection 语义
  与 Inspect context-actions；`manual-editor.spec.ts` 的 4 个选择/属性测试不破。

## Invariants

1. 创建期间不增 revision；结束仅一条 `upsert_drafting_object` 事务。
2. 捕捉仅视觉，绝不因接触 pin/port/junction 创 Net、junction 或短路。
3. drafting 几何变换不改变电气 Net（drafting 本无电气）。
4. construction-line hit 元素保持 `<polyline>`（e2e test 8）。
5. arrow head 永远附着 tip，不因端点编辑脱节。
6. 正式 SVG/PNG/PDF 渲染不变（不改 render.ts；预览/handles 仅 editor-overlay）。
7. geometry schema 双处（derived + model）同步加字段。
8. `R` 键扩展不得破坏 instance 旋转（manual-editor :188 选的是 instance，走 instance 分支）。

## Expected Work

### 实施顺序（依赖驱动）

geometry 扩展（阶段 3 基础）→ 阶段 1 状态机 → 阶段 2 命中层 → 阶段 3 handles/编辑。

### 阶段 0：geometry 扩展（可先做，不碰 App.tsx）

- `drafting-geometry.ts`：arrow 加 `center: Point`（from/to 中点）；
  construction-line 加 `vertices: Point[]`（直出 points）。
- `drafting-geometry-schema.ts`：镜像 strictObject **同步**加字段。
- `drafting-geometry.test.ts`：更新断言。

### 阶段 1：统一绘制状态机（App.tsx）

1. 新增状态（镜像 wire 三件套）：`draftingSource`/`draftingHover`/`draftingWaypoints`。
2. `beginCanvasGesture` 让 `tool==="arrow"|"construction-line"` 短路 return（镜像 wire）。
   删除 `draftingCreatePreview` 及其在 begin/continue/finish 的分支。
3. SVG `onClick` 加 drafting 分支：第一次 click→`setDraftingSource(snap)`；
   construction-line 每次追 waypoint；arrow 第二次→commit。`onDoubleClick`/Enter→
   以 hover 为终点 commit（镜像 wire `finishWireAtPoint`）。
4. `continueCanvasGesture` 加：drafting tool + draftingSource 时 `setDraftingHover(snap)`。
5. 新增 `snapDraftingPoint(point, altKey)`：Alt 关；否则查 `visibleEndpoints` 最近候选
   （复用 `DIRECT_PIN_SNAP_RADIUS` 口径），无则回落网格 snap。仅视觉。
6. 预览渲染（替换 `drafting-create-preview`）：起点实心点、终点空心点；
   construction-line polyline；箭头完整头部预览（editor-only，复用 render head 几何）；
   捕捉候选高亮；长度/角度浮动 text（editor-overlay，不导出）。
7. Shift 锁定水平/垂直/45°（snap 后、commit 前应用）。
8. Esc 逐级取消；右键取消当前绘制。

### 阶段 2：命中与选择层（App.tsx + styles.css）

1. drafting hit shape 保留 per-kind（**construction-line 仍是 `<polyline>`**），
   stroke-width 改 `vector-effect: non-scaling-stroke` + 固定屏幕像素（如 14px），
   不再用逻辑 `stroke-width:8`。arrow `<line>`、leader `<line>`、callout `<g>`、
   text `<rect>`——标签不变。
2. 命中优先级：handle 层 > drafting object > annotation > route > instance（SVG 渲染顺序
   + pointer-events，handle 最后渲染）。
3. 选中后画编辑框 + handles（阶段 3），容差按屏幕像素，各 zoom 一致。

### 阶段 3：端点与顶点编辑（App.tsx + styles.css）

1. handle 渲染（editor-overlay，选中时）：arrow start○/center●/end○+rotation○；
   construction-line 每顶点●（最少 2）。命中半径固定屏幕像素。
2. handle 拖动：扩展 `draftingDragSession`（:2508）或新增 sibling，pointerup 一条
   `upsert_drafting_object`（改 from/to/points，不动 anchor 语义）。
3. 顶点增删（construction-line）：双击线段插入（最近 segment）；选中顶点 Delete 删除
   （<2 拒绝，给 status）。均走事务。
4. `R` 旋转：扩展 `rotateSelected`（:2342）——drafting 选中时 emit `upsert_drafting_object`
   （arrow 绕 center 旋转改 from/to；construction-line 绕 bounds center 旋转 points）。
   `R` 键分支：有 drafting 选中走 drafting 旋转，否则 instance 旋转。加 `Shift+R` -90°。
5. `V`：construction-line 选中时进/出顶点编辑模式。
6. Esc 逐级：顶点编辑 → 当前绘制 → 当前选择。

### e2e（drafting.spec.ts）

- 重写 `dragCreate`→`clickCreate`（click→move→click），更新 test 6/7/8 创建步骤与菜单名
  （"Construction line tool (drag)" 去掉 "(drag)"）。
- 新增回归（阶段 1）：斜箭头两阶段创建、Shift 45° 锁定、Esc 取消不增 revision、
  pin 捕捉高亮。
- 新增回归（阶段 2）：50%/200% zoom 下选中细 construction-line。
- 新增回归（阶段 3）：arrow 端点拖动、construction-line 顶点增删、R 旋转、undo 精确恢复。

## Validation

须由人跑（本会话无 node/pnpm 工具链）：

```bash
pnpm exec prettier --check <改动的 ts/tsx/css>
pnpm --filter @icm/editor build
pnpm typecheck
pnpm exec vitest run packages/derived/src/drafting-geometry.test.ts
pnpm exec vitest run apps/editor/src/
pnpm test:e2e   # drafting.spec.ts（重写+新增）+ manual-editor.spec.ts 回归
git diff --check && git status --short --branch
```

为何这套匹配受影响面：本目标改动 = editor overlay 状态机/命中/handles（App.tsx）+
geometry 字段（derived + model 镜像，strictObject 同步）+ e2e。受影响行为层在编辑器 +
derived geometry；不改 schema styleOverride / render / edit-engine / export，故聚焦
drafting-geometry 测试 + 编辑器单测 + e2e。typecheck 跨 derived/model/editor 契约边界。

重点核对：
- drafting.spec.ts test 8 的 `<polyline>` 断言不破；
- manual-editor.spec.ts 的 4 个选择/属性测试不破（阶段 2/3 不改 selection 语义）；
- drafting-geometry.test.ts 加字段后断言更新；
- agent snapshot（若人愿跑 `agent-api:artifacts:check`）geometry 字段双处同步。

## Experience Signal (for human review)

- **信号（待人决定）**：drafting 创建手势从「拖拽即提交」改「两阶段 click」是行为契约
  变更，必然打破依赖旧手势的 e2e（`dragCreate`）。这类「交互范式变更 vs 测试耦合」的
  协调模式是否值得提取经验，由人决定。
- **信号**：geometry 镜像 schema（derived + model 两处 strictObject）是本仓一类易漏同步
  点，漏一处 agent snapshot 校验即拒收。是否值得提取经验，由人决定。

以上仅 flag，不在本目标自动产出经验文档。

## Commit Intent

按阶段拆 3 个 commit（各自可 review、可独立回退）：

```text
feat(editor): two-phase drafting creation with snapping
feat(editor): screen-tolerant hit layer and selection frame
feat(editor): drafting endpoint and vertex editing with rotation
```

geometry 扩展（阶段 0）并入阶段 3 commit（handles 依赖它），或合入阶段 1（若先做）。
不与本目标无关的 dirty 混合；只 stage 本目标文件。

## 实施状态（2026-08-09）

**全部 6 个阶段已完成并静态验证。**

- 阶段 0（geometry）：arrow `center` + construction-line `vertices`，derived + model
  镜像 schema 双处同步（strictObject），`drafting-geometry.test.ts` 断言更新。
- 阶段 1（两阶段绘制）：`draftingSource`/`draftingHover`/`draftingWaypoints`/
  `draftingSnapPoint`；`beginCanvasGesture` 短路；SVG onClick/onDoubleClick/onContextMenu；
  `snapDraftingPoint` 覆盖 pin/port/junction + **route 段最近点 + drafting 顶点**（网格回落，
  Alt 关、Shift 45° 锁）；`DraftingCreatePreview`（锚点、polyline、箭头头、捕捉标记、长度/角度）；
  Enter/Esc/右键 取消。
- 阶段 2（命中层）：`.annotation-hit` stroke-width 14（固定屏幕像素）；**修复选中态命中带塌缩
  缺陷**——`.annotation-hit.selected` 不再收窄 stroke-width（原 1px 让选中后细线难以再点），
  改半透明 accent 描边，与 route-hit.selected 一致。
- 阶段 3（端点/顶点编辑）：`rotateSelected(delta)` 扩展（R/Shift+R）；**handle 拖动**
  （`beginDraftingHandleDrag`：arrow from/to、construction-line 顶点，pointerup 一条
  `upsert_drafting_object`）；**顶点插入**（双击 construction-line 线段，最近 segment）+
  **顶点删除**（双击顶点 handle，<2 拒绝）；可视化 handles 选中时常驻可点（中心 handle 装饰）。
  `V` 模式以「handles 常驻」满足，未另设互斥模式（更顺滑）。
- 阶段 4（受控风格）：schema `styleOverride` 加 `strokeScale`(0.75/1/1.5/2) +
  `arrowHeadScale`(0.75/1/1.25/1.5)（optional，无需迁移）；render-svg 对 arrow shaft+head 与
  construction-line 应用 strokeScale/arrowHeadScale（正式 SVG 与 editor 共一套参数）；
  Drawing shelf（line-style/stroke-width/arrow-head/head-size select + Rotate/Reverse/Lock）；
  `[`/`]` strokeScale、`Shift+[`/`]` arrowHeadScale 快捷键（`stepScale` 有界步进）。
- 阶段 5（route current marker）：`stepCurrentArrowOffset`（法向偏移步进）；Current-arrow
  context section（Reverse(X)/Move closer/Move away/Delete）；marker 绑定 route 不变，route
  重画后跟随（既有 `routeAttachmentPlacement`），reverse 仍可在富文本浮窗触发。
- 阶段 6（回归）：新增 e2e——endpoint handle 拖动、construction-line 顶点插入、bracket
  stroke-width 快捷键、Drawing shelf line-style、arrow R 旋转；既有创建/命中测试重写为
  clickCreate（drag-once 已废）。

**静态验证全过**：App.tsx parens 2354/2354、braces 1446/1446；drafting.spec.ts 411/411、
96/96；CSS braces 平衡；`git diff --check` clean；geometry 双处同步；schema optional 字段
无需迁移（schemaVersion 不变）。

**工具链阻塞（同 A–E）**：本会话 Git Bash 无 node/pnpm/tsc/vitest/playwright。以下须由人跑：
```bash
pnpm exec prettier --check apps/editor/src/App.tsx apps/editor/src/styles.css \
  packages/derived/src/drafting-geometry.ts packages/derived/src/drafting-geometry.test.ts \
  packages/model/src/drafting-geometry-schema.ts packages/model/src/schema.ts \
  packages/render-svg/src/render.ts apps/editor/e2e/drafting.spec.ts
pnpm --filter @icm/editor build
pnpm typecheck
pnpm exec vitest run packages/derived/src/drafting-geometry.test.ts
pnpm exec vitest run apps/editor/src/ packages/render-svg packages/model
pnpm test:e2e
git diff --check && git status --short --branch
```
重点：drafting.spec.ts test 8（construction-line hit `<polyline>`）不破；geometry 测试断言过；
render-svg drafting-render.test.ts 不破（strokeScale 默认 1，既有 fixture 行为不变）；
manual-editor MOS 旋转（instance 分支）不破；agent-api fixtures 若有 `agent-api:artifacts:check`
需重生（styleOverride 新 optional 字段会进 OpenAPI）。

## 风险与协调

- **e2e 创建手势重写**是阶段 1 的必然成本（`dragCreate` 失效）。行为变更预期，非回归；
  commit message / log 说清。
- **geometry schema 双处同步**（derived + model）硬约束，漏一处 agent snapshot 拒收。
- **`R` 键语义扩展**（instance-only → drafting-or-instance）须不破 manual-editor :188
  （选 instance 走 instance 分支）；实施时复核。
- **与并行 editor 目标的文件冲突**：App.tsx/styles.css 当前 dirty，须人先提交/stash
  再开始。若实施中发现并行目标改动漂移了本目标的锚点行号，停下重新定位，不盲目应用。
- 若阶段 2/3 handle 层与现有 annotation-hit 命中冲突（z-order），停下记录，不强行改
  annotation 命中语义。
