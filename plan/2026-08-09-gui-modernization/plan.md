# GUI 现代化：Chrome 令牌与可靠的 Recovery 持久化

## Goal

在不改变电气语义、白色画布、formal SVG/export 渲染的前提下，完成两项可独立
验证的编辑器优化：

1. 将编辑器 **chrome**（面板、控件、选中态、诊断）的颜色集中为 CSS
   自定义属性；不修改画布和 formal 图形颜色。
2. 将 recovery 写入变成“合并短时间连续提交、在离开页面前可靠落盘、在清空或
   切换项目后绝不复活旧数据”的持久化流程。
3. 统一 GUI 写操作的结果、错误、状态与 recovery 生命周期，减少 handler 各自
   拼装的分支；不新增第二套命令/请求协议。

本计划不以“删除 try/catch”为目标。交互层的异常边界只做审计；已经确认会调用
领域 helper 的 catch 必须保留。

## Dirty-state decision

开始前的工作树包含：

```text
M  apps/editor/src/App.tsx
?? apps/editor/src/visual-selection.ts
?? apps/editor/src/visual-selection.test.ts
?? plan/2026-08-09-visual-selection-normalization/
```

它们显然属于并行的 visual-selection 目标，且与本计划的 recovery 实现会共同
编辑 `App.tsx`。因此在该目标提交、交接，或明确允许整合前，**不得开始修改
`App.tsx`**。本计划文件本身可以先维护；CSS 工作只在确认 `styles.css` 无冲突后
独立开始。

其他 `netlists/` 生成物、旧计划目录与 `probe-conflicts.mjs` 不属于本目标，保持
不动。实现开始时必须重新运行 `git status --short --branch`，不复用这里的快照。

## Ownership

### 工作包 A：Chrome 颜色令牌

- `apps/editor/src/styles.css`

### 工作包 B：Recovery 调度

- `apps/editor/src/App.tsx`
- `apps/editor/src/recovery-scheduler.ts`（新增，纯函数/小状态对象）
- `apps/editor/src/recovery-scheduler.test.ts`（新增）
- `apps/editor/e2e/manual-editor.spec.ts`（recovery 生命周期浏览器回归）
- `docs/specs/editor-interaction.md`（仅补充编辑器 mutation lifecycle 合同）

### 只读依赖

- `packages/model/`：`CircuitProject`、`serializeProject`、`parseProject`
- `packages/edit-engine/`：事务和 revision 合同
- `packages/derived/src/stretch.ts`、`packages/derived/src/routes.ts`
- `apps/editor/src/delete-selection.ts`
- `packages/render-svg/`、`packages/exporters/`

## Invariants

1. `.schematic-canvas` 保持 `background: #fff`；SVG grid dot 的
   `fill="#d8d8d2"` 和 `scene.formalBody` 都不被 CSS token 化。
2. CSS token 只影响编辑器 chrome，不改变 formal SVG、PNG、PDF 的视觉输出。
3. Recovery key 保持 `icm.recovery.v1`，文件格式和迁移不变。
4. 每个已提交的 Project 最终可恢复；页面隐藏或卸载前，最后一个 pending Project
   必须同步写入。
5. Save、Discard、Open、Import、Restore 或替换 Project 后，旧 Project 的 pending
   recovery 绝不能重新写入 localStorage。
6. 错误处理不以“少写 catch”为质量目标：领域 helper 抛出的可预期错误必须继续
   转化为可见状态信息。
7. `transact()` 是 GUI 对当前 Document 的唯一 typed-edit 执行边界；不得为
   recovery、选择、快捷键或某一工具另造并行的 command engine、事件总线或 JSON
   patch 协议。

## Expected work

### A. Chrome 颜色令牌

1. 在 `styles.css :root` 添加一组有限 token：

   ```css
   --icm-chrome-bg;
   --icm-surface;
   --icm-surface-muted;
   --icm-border;
   --icm-border-strong;
   --icm-text;
   --icm-text-muted;
   --icm-accent;
   --icm-accent-soft;
   --icm-accent-selection;
   --icm-error;
   --icm-warning;
   ```

2. 将 `styles.css` 中实际存在的硬编码 chrome 色替换为 token；实施前重新统计，
   不把“13 处”当作合同。
3. 保留画布、grid、formal scene 和 exporter 的颜色定义不变。
4. 不引入 Tailwind、CSS-in-JS、主题切换或暗色画布。

### B. Recovery 调度

新增一个可注入 `setTimeout` / `clearTimeout` 与写入函数的轻量 scheduler。它只
维护最新 Project，不拥有 React state：

```text
schedule(project)  → 覆盖 latest，重置约 400 ms timer
flush()            → 若有 latest，serialize + write；清空 timer/latest
cancel()           → 清空 timer/latest；不写入
dispose()          → 清理 timer；按调用方指定 flush 或 cancel
```

`App.tsx` 负责：

1. 事务成功后调用 `schedule(nextProject)`，不再同步 `serializeProject` +
   `localStorage.setItem`。
2. 在 `visibilitychange` 变为 `hidden` 与 `pagehide` 时调用 `flush()`。
3. 在 Save、Discard、Open Project、Import SPICE、Restore recovery、以及任何
   `replaceActiveProject()` 前，先 `cancel()`，再执行相应的 remove/replace。
4. 在组件卸载时清理 scheduler；不得留下 timer 写入已离开的 React session。
5. 保持现有 recovery 读取/解析的 catch，因为它处理不可信持久化数据。

400 ms 是初始常量，不是产品合同；若真实大项目测量表明不够，再单独调整。

### C. 交互错误边界审计（无预设代码删改）

以下 catch 已确认需要保留，不得因“最终会 transact”而删除：

| 调用点                   | 原因                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `finishRouteStretch`     | `moveRouteSegment()` 会抛保护段、非法 index、非正交等领域错误。   |
| `finishMove`             | `proposeGroupMove()` 会抛锁定 route、缺失实例和非统一位移等错误。 |
| 删除 instance / 混合选择 | `proposeConnectedInstanceDeletion()` 会在未解析 endpoint 时抛错。 |

如发现某个 catch 内部严格只调用 `transact()`，且没有任何可抛 helper、解析或浏览器
边界，才可删除；删除前必须加入或更新回归测试，证明失败状态仍可见且 preview 被清理。

#### 审计结论（2026-08-09 实施时复核，行号为当前快照）

`App.tsx` 现存 8 处 `try {`，逐处复核——**全部保留，零删改**：

| 行号 | 包裹内容                                      | 抛出来源                                      | 结论         |
| ---- | --------------------------------------------- | --------------------------------------------- | ------------ |
| 1123 | `parseProject` recovery 读                    | 不可信持久化数据                              | 保留（边界） |
| 1715 | `moveRouteSegment` + transact                 | 领域 helper（保护段/非法 index/非正交）       | 保留         |
| 2172 | `proposeGroupMove` + transact                 | 领域 helper（锁定 route/缺失实例/非统一位移） | 保留         |
| 2302 | `parseProject(await file.text())`             | 不可信文件数据                                | 保留（边界） |
| 3054 | `rasterize`/`exportFormal`                    | 浏览器导出异步                                | 保留（边界） |
| 3101 | `importSpiceSources`                          | 外部 SPICE 解析                               | 保留（边界） |
| 3458 | `proposeConnectedInstanceDeletion` + transact | 领域 helper（未解析 endpoint）                | 保留         |
| 3537 | `proposeConnectedInstanceDeletion` + transact | 领域 helper（未解析 endpoint）                | 保留         |

没有任何 catch 内部「严格只调用 `transact()`」——每一处要么守外部边界
（不可信解析/文件/导出/SPICE），要么守一个会在抵达 `transact()` 之前抛
可预期错误的领域 helper。结论与计划不变量 #6 一致。C 因此只产出本审计表，
不产生代码提交。

### D. GUI mutation lifecycle 归一化（去臃肿）

本工作包只规范现有边界，不创建新的通用命令框架。合同为：

```text
gesture / menu / shortcut
  → proposal（可选；领域 helper 可抛错）
  → transact(typed edits)
  → applyResult(result)
  → Project 更新 + recovery schedule + 默认状态
  → 成功后的局部 UI 收束（selection / preview / tool）
```

具体约束：

1. 对当前 Document 的持久化电路编辑只能通过 `transact(edits)`；handler 不直接
   patch Project JSON，也不直接写 recovery。
2. `applyResult()` 是唯一从成功 transaction 调度 recovery 的位置；它仍负责把
   `EditTransactionResult` 的失败显示为结构化 status。
3. `proposal` 层（例如 group move、route stretch、connected deletion）可以抛错，
   由最接近 gesture 的 catch 转成 status，并始终收束临时 preview。
4. Open / Import / Restore 等 whole-project 替换不伪装成 transaction；它们必须走
   `replaceActiveProject()`，并先取消旧 recovery schedule。
5. 选择、viewport、tool、drag preview 都是 editor-local transient state，不进入
   Project、Agent API 或 recovery 文件。
6. 不新增 `CommandEngine`、`executeCommand` 大枚举、事件总线、第二份 request/
   response schema，也不扩张 Agent API。这里的“协议统一”是收敛既有调用链，
   不是再加一层。

实施前先列出所有 `transact()` 调用点；只有发现某个调用绕开 `applyResult()`、重复
写 recovery 或未收束临时状态时才修改它。这个清单与审计结论写入本 target plan，
而不是抽象成运行时元数据。

## Validation

### A

1. `git diff --check`
2. 针对改动文件运行 Prettier check。
3. `pnpm --filter @icm/editor build`
4. 人工检查：白色 canvas、grid dot、formal symbol/route 不变；chrome 选中态、
   warning/error、左栏和 Properties 使用一致 token。

### B

1. `recovery-scheduler.test.ts` 使用 fake timer 覆盖：合并写入、flush、cancel、
   flush 后幂等、dispose。
2. 编辑器集成测试覆盖 Open/Discard 后旧 timer 不复活 recovery。
3. `pnpm vitest run apps/editor/src/recovery-scheduler.test.ts`
4. `pnpm --filter @icm/editor build`
5. `pnpm typecheck`

### D

1. 静态审阅所有 `transact()` 调用点：没有直接 Project patch 或第二个 recovery 写入点。
2. 编辑器测试覆盖一个普通 typed edit、一个 proposal 抛错、一个 whole-project
   replacement，分别验证状态、recovery 与 preview 收束。
3. 更新 `docs/specs/editor-interaction.md`，只记录上述生命周期和非目标。

不默认运行完整 release/performance 套件；本计划不修改电气、model schema、formal
renderer 或 exporter。若 CSS 审阅发现误触 `.schematic-canvas` 或 formal 输出，再升级
为相关 visual golden 验证。

## Commit intent

优先拆为两个独立提交：

```text
style(editor): tokenize chrome colors
perf(editor): schedule recovery persistence safely
refactor(editor): normalize mutation lifecycle
```

工作包 C 若仅产生审计结论，不伪装成重构提交；D 若只确认现状已满足，也只更新
本计划和规范，不制造无效代码提交。完成后更新 `plan/log.md`；若并行
visual-selection 目标仍未交接，记录协调状态，不混入对方文件。

## E. 固定左侧 Inspector：消除右侧 Properties 跳变

### 决策

将右侧、随选择出现和消失的 `Properties` 面板替换为左侧固定 dock 内的两个显式
标签：

```text
Symbols & Tools | Inspect
```

这是编辑器 chrome 的结构调整，不是 Project schema、Edit Engine、Agent API 或新的
命令协议。画布始终占据右侧剩余空间；选择对象不得改变画布列数、宽度或 viewport。

默认标签为 `Symbols & Tools`。选中可检查对象时，只在 `Inspect` 标签上显示一个低干扰
的状态点或计数；**不得**自动切换到 `Inspect`，更不得因为对象切换而展开、关闭或移动
任何面板。用户显式点击 `Inspect` 后才看到属性。这样连续选择、拖动和框选时，视觉布局
保持稳定；需要精细属性时又无需到画布另一侧寻找浮窗。

`Inspect` 的空状态只提示“选择对象以检查”，不显示调试数据。双击文本仍直接进入已有的
canvas RichText 编辑会话，不以 Inspector 取代原位文本编辑。

Diagnostics 保持独立于属性 Inspector：它是状态/问题入口，不随普通选择自动弹出，也不
与选中对象的编辑表单混在一起。

### 前置协调

开始 E 的实现前，必须重新审计工作树。当前观察到以下重叠路径：

```text
M apps/editor/src/App.tsx
M apps/editor/src/rich-text-editor.tsx
?? plan/2026-08-09-text-entry-and-current-arrow-repair/
```

它们属于未交接的 text-entry/current-arrow target，而 E 也需要改动 `App.tsx`。因此 E
在该目标提交、交接或拥有者明确允许整合前不得修改 `App.tsx`；可先做只读审计和本计划
维护。`rich-text-editor.tsx` 不属于 E 的默认所有权，绝不搭车修改。

### E 的所有权与依赖

**计划拥有：**

- `apps/editor/src/App.tsx`（完成前置协调后）
- `apps/editor/src/styles.css`
- `apps/editor/e2e/` 中直接覆盖 dock/Inspector 的现有测试，或一个最小新增测试
- `docs/specs/editor-interaction.md`
- `plan/2026-08-09-gui-modernization/plan.md`
- `plan/log.md`（仅完成时）

**只读：**

- `apps/editor/src/rich-text-editor.tsx`
- `packages/model/`
- `packages/edit-engine/`
- `packages/render-svg/`
- `packages/agent-adapter/`

**共享依赖：** 当前选择状态、文本编辑会话和 `transact() → applyResult()` 生命周期。E
只能重组它们的呈现位置，不得改变 selection 的语义、事务结果处理或富文本持久化路径。

### 实施范围

1. 删除右侧 Properties 专用列、其自动可见性和“关闭”按钮；`app-shell` 固定为左 dock +
   canvas 两列，不能再以 `properties-open` 一类状态改变网格。
2. 在左 dock 顶部加入可访问的 tablist（或同等语义的互斥按钮）。保留现有 Components、
   Wire、Arrow、Draw 工具归于 `Symbols & Tools`，不重新在顶部 header 建立第二控制源。
3. 将现有对象属性表单迁入 `Inspect`；沿用现有选择对象、属性动作和错误显示，不复制一份
   编辑 handler。无选择时显示简洁空状态。
4. 选择实例、route、endpoint、annotation、drafting object 后更新 Inspector 的可用内容和
   标签提示，但不改变当前标签。删除或清空选择后安全回落到空状态。
5. 保持左 dock 的独立滚动和整体/分组折叠行为；Inspector 内容过长时也只在 dock 内滚动，
   不抢占浏览器页面滚动条。
6. 更新交互规范，明确“选择不触发布局跳变”“属性是按需 Inspect”“文本双击原位编辑”三条
   产品行为；不向 Agent API 或项目文件增加 GUI 偏好字段。

### E 的验收与验证

1. 自动化或浏览器交互测试验证：
   - 空画布默认显示 `Symbols & Tools`；
   - 选择元件后 canvas 的 `getBoundingClientRect().width` 不变，且不会自动跳转标签；
   - 用户点击 `Inspect` 后能编辑一个已有属性；
   - 清除选择后 Inspector 为稳定空状态；
   - dock 自身可滚动，画布不因属性内容而横向/纵向跳变。
2. 回归既有 component、wire/route、annotation/current-arrow 的选择与编辑测试；不覆盖
   text-entry target 正在拥有的修改，待交接后运行其聚焦测试。
3. `pnpm --filter @icm/editor build`
4. `pnpm typecheck`
5. `git diff --check` 与 `git status --short --branch`

### E 的提交意图

在确认没有与 text-entry/current-arrow 混合后，独立提交：

```text
feat(editor): move inspector into the left dock
```

此提交不包括 CSS token/recovery/mutation-lifecycle 的独立工作；若 E 需要其未完成内容，
先更新本计划的依赖和提交拆分，而不是把几个 GUI 目标合并成一个不可审查的提交。

## F. 审计修复：Recovery 实施闭环（2026-08-09）

### Dirty-state decision

本轮重新检查后，`App.tsx`、`styles.css`、`editor-interaction.md`、`plan/log.md` 与两个
新增 recovery 文件均属于本计划尚未提交的 A/B/D 实施；它们与 F 直接重叠，因此由当前
目标继续拥有。未跟踪的 `netlists/` 导出物、其他日期的 plan 目录和
`probe-conflicts.mjs` 不属于本目标，保持不动。先前阻塞 E 的 text-entry 目标已提交为
`9337c8d`，但 E 不包含在 F 的代码范围内。

### 审计发现与实施范围

1. 将 scheduler 注入的 timer 类型改为本模块定义的最小回调合同，不能泄漏 Node
   `typeof setTimeout` 的 `__promisify__` 结构类型；消除 implicit-any，并令 workspace
   typecheck 通过。
2. `visibilitychange` 只在 `document.visibilityState === "hidden"` 时 flush；`pagehide`
   始终 flush。组件卸载使用 scheduler 的明确 `dispose()`（本实现的 dispose 语义为
   cancel），防止悬挂 timer。
3. 避免 `useRef(createRecoveryScheduler(...))` 每次 render 都求值工厂；使用一次性惰性
   初始化，保留同一 scheduler 给所有 handler 和 lifecycle effect。
4. 纯函数测试覆盖 `dispose()`；浏览器回归覆盖 coalesced recovery 最终可恢复，以及在
   Save、Open、Discard 后 recovery slot 不会被旧 pending write 复活。
5. 在所有验证实际通过前，`plan/log.md` 不得声明 ready-to-commit 或“工具链不可用”。
   完成后以实际命令和结果替换临时记录。

### 非目标

- 不改 recovery key、Project 格式、迁移或 Agent API。
- 不实施 E 的左侧 Inspector/右侧 Properties 迁移。
- 不为此增加 command engine、事件总线或第二套 mutation 协议。

### F 的验证

1. `pnpm vitest run apps/editor/src/recovery-scheduler.test.ts`
2. `pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "automatic recovery|recovery"`
3. `pnpm typecheck`
4. `pnpm --filter @icm/editor build`
5. `pnpm prettier --check` 覆盖所有 F/A/B/D 改动文件
6. `git diff --check` 与 `git status --short --branch`

### F 的提交与记录

在验证均通过后，更新日志为事实记录，并将 scheduler、App 生命周期、回归测试、规范和
相关计划作为一个修复提交；CSS token 可按原计划单独提交，绝不把未完成的 E 混入。
