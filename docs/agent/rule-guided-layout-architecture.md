# Snapshot 驱动的 Agent 原理图推理与编辑架构

Status: `accepted; API v2 and the core Phase 9 path are implemented`

本文记录 Phase 9 的最终架构。它不替代
[`Agent API`](../specs/agent-api.md)、[`Edit Engine`](../specs/edit-engine.md)
或 [`Schematic Model`](../specs/schematic-model.md)；发生冲突时，以已接受规范和硬校验
为准。

## 1. 结论

Agent 不应该先学习怎样查询我们的系统，再开始理解电路。系统应在任务开始时直接提供
当前 Document 的完整、结构化、只读 Snapshot；Agent 在 Skill 和按需知识文档指导下
自由推理，再通过 typed transactions 修改，通过 render/diagnostics 收敛。

最终 Agent 路径只有：

```text
Capabilities + Project Index + Complete Document Snapshot
                         ↓
             SKILL.md + 按需知识文档
                         ↓
                   Agent 自由推理
                         ↓
                    typed transact
                         ↓
                 render / diagnostics
                         ↓
              必要时刷新完整 Snapshot
```

产品不增加：

- 正式 `LayoutIntent` schema；
- `Layout Compiler` 或 `packages/layout`；
- `summary/region/topology/select/expand/include` 查询流水线；
- 电路类型专用 endpoint；
- topology、placement、route 等必需中间文件；
- 自动分类器给出的最终电路语义。

## 2. 责任边界

| 责任                                 | 所属层                |
| ------------------------------------ | --------------------- |
| SPICE、pin、Net、Junction 电气真值   | Model/Edit Engine     |
| PDK model 到产品符号映射             | Symbol registry       |
| 完整 Agent Snapshot                  | Agent adapter/derived |
| revision、权限、锁、原子事务         | Agent API/Edit Engine |
| SVG 和结构化视觉诊断                 | Renderer/derived      |
| 调用流程、安全行为、完成门槛         | `SKILL.md`            |
| 电路阅读、模式证据、布局布线知识     | 按需知识文档          |
| 当前电路的含义、取舍、坐标和折点判断 | Agent 内部推理        |
| 重复结构、路线等机械候选             | 可选 helper，后期按需 |

硬规则仍由代码判断“能不能提交”。Skill 约束 Agent 的行为与完成声明；知识文档帮助它
理解“为什么”和“怎样表达更清楚”。Agent 的具体思考过程不进入 API 或项目文件。

## 3. AgentDocumentSnapshot

### 3.1 定义

`AgentDocumentSnapshot` 是从有效 Project/Document 派生的只读 Agent 视图。它不是原始
`.icproj`，也不是新的持久化格式。

它必须对电路理解和当前画面编辑信息完整，包括：

- Project/Document 索引与层次引用；
- Document id、revision、bounds 和 presentation profile；
- ports 及其方向、位置和 Net；
- instances 的名称、symbol/model、参数、placement 和逐 pin Net 映射；
- Nets 的名称、scope、terminals 和 ports；
- Routes 的 endpoints、waypoints 和 segment modes；
- Junctions、annotations；
- layout groups、constraints、locks 及其完整成员；
- 当前电气和视觉 diagnostics；
- 未放置、未解析符号等状态。

候选形态：

```typescript
interface AgentSessionSnapshot {
  snapshotVersion: "1.0";
  apiVersion: string;
  capabilities: AgentCapabilities;
  project: {
    id: string;
    name: string;
    topDocumentId: string;
    documents: Array<{
      id: string;
      name: string;
      instanceCount: number;
      references: Array<{
        instanceId: string;
        targetDocumentId: string | null;
      }>;
    }>;
  };
  document: AgentDocumentSnapshot;
}

interface AgentDocumentSnapshot {
  id: string;
  name: string;
  revision: number;
  topologyHash: string;
  bounds: Rect | null;
  presentation: PresentationSummary;
  ports: AgentPort[];
  instances: AgentInstance[];
  nets: AgentNet[];
  routes: AgentRoute[];
  junctions: AgentJunction[];
  annotations: AgentAnnotation[];
  layoutGroups: AgentLayoutGroup[];
  constraints: AgentConstraint[];
  diagnostics: AgentDiagnostic[];
}
```

关键连接同时提供两个方向：

```json
{
  "instances": [
    {
      "id": "M1",
      "model": "sky130_fd_pr__nfet_01v8",
      "parameters": { "w": "2u", "l": "0.15u" },
      "pins": [
        { "name": "G", "netId": "VINP" },
        { "name": "D", "netId": "VOP" },
        { "name": "S", "netId": "TAIL" },
        { "name": "B", "netId": "VSS" }
      ]
    }
  ],
  "nets": [
    {
      "id": "TAIL",
      "terminals": [
        { "instanceId": "M1", "pinName": "S" },
        { "instanceId": "M2", "pinName": "S" },
        { "instanceId": "MTAIL", "pinName": "D" }
      ]
    }
  ]
}
```

这种冗余是同一已验证 Document 的派生索引，便于 Agent 从器件或 Net 两个方向阅读；
生成器必须测试两者一致。Snapshot 不允许由 Agent 回传后整体替换 Document。

### 3.2 与 `.icproj` 的区别

Snapshot：

- 展开 Agent 真正需要的 pin-Net 和 hierarchy 映射；
- 可以包含派生 bounds、diagnostics 和 convenience indexes；
- 排除 SVG、空间索引、缓存、session state 和无关源文本；
- source span/raw source 仍受权限控制；
- 有独立 snapshot version 和 topology hash；
- 只读，不能作为保存输入。

`.icproj` 继续是唯一持久化 Project 文件和电气/几何真值。

### 3.3 大小和完整性

默认单位是一个完整 Document，而不是整个 Project，也不是 Agent 猜测的 region。

- Project Index 很小，只用于选择 Document；
- 进入某个 Document 后一次提供其完整 Snapshot；
- 100～500 个晶体管先通过真实 JSON/token/latency 测量，不预先拆分；
- 不包含原始 SPICE 文本和 SVG，避免无关体积；
- 如果真实超大扁平 Document 超过 host/context 上限，只允许确定性的 transport chunk
  或压缩；chunk 不带 region/topology 语义，重组后仍是同一个完整 Snapshot；
- 不因 payload 预算重新引入 `connectedDepth`、模式分类或查询语言。

## 4. Agent API

Phase 9 的规范 Agent 面保持四个概念：

```text
capabilities
snapshot
transact
render
```

Host 可以在会话开始时自动注入 capabilities、Project Index 和首个 Snapshot，使 Agent
不需要显式调用前两个概念。切换 Document 或刷新过期状态时再请求 `snapshot`。

### 4.1 兼容策略

当前 v1 API 的 `query` scopes 保留在兼容适配器中，不继续扩展成
`select/expand/include`。已接受的 API v2 用 `snapshot` 取代 `query`；不在 v1 中增加
`scope: { kind: "snapshot" }`，也不让新版 Skill 依赖 v1 query。

对 Agent 的规范工作流只有“读取/刷新完整 Snapshot”，没有查询规划。

### 4.2 Transact

所有修改继续经过一个 `transact`，包含 `documentId`、`expectedRevision`、
`transactionId` 和通用 typed edits。至少补齐已确认缺口：

- `set_instance_symbol`；
- `place_port` / `move_port`；
- 通用 Route/Junction/annotation/constraint/lock 操作；
- 与当前自由布线一致的 Route points 编辑。

事务保持原子性、权限、锁、dry-run 和完整模型校验。成功返回 revision、diff、changed
object ids 和 diagnostics，不返回可作为整体写入的 Project。

### 4.3 Refresh

Agent 不必每次 transact 后重新读取完整 Snapshot。以下情况必须或建议刷新：

- `STALE_REVISION`；
- 切换 Document；
- 人工或其他 Agent 修改了相关对象；
- 多轮局部编辑后准备做全局检查；
- Agent 无法确认其上下文仍与当前 revision 一致。

Host/SDK 可以缓存并按成功 diff 更新本地视图，但 cache 不是产品真值。只要出现不一致，
重新取得完整 Snapshot，而不是设计复杂 changes query。

### 4.4 Render 与 diagnostics

Render 继续支持整张 Document 或明确 bounds。Diagnostics 既随 Snapshot 提供当前状态，
也随 transact/render 返回最新相关结果，并至少包含：

- 稳定 code 和 severity；
- object ids；
- bounds/point；
- typed parameters，例如 overlap、crossing、悬空端点；
- revision；
- 若存在确定修复，返回候选但不自动执行。

Agent 可以先读结构化 diagnostics，再查看图像；图像判断不替代电气校验。

## 5. Agent 文档层：两部分

Agent 运行时只面对两部分文档。

### 5.1 第一部分：统领全流程的 `SKILL.md`

Skill 负责：

- 接收并检查 capabilities、Project Index 和 Snapshot；
- 选择工作 Document；
- 判断需要读取哪些知识文档；
- 指导从理解、编辑、dry-run 到 render/diagnostics 的循环；
- 按 limits 分批 typed edits；
- 处理 stale revision、lock、unknown symbol 和 transaction rejection；
- 定义完成前的硬检查和软质量检查；
- 明确何时保留原状或请求人工判断。

Skill 不包含完整电路教材，不要求输出 Layout Intent，也不规定 Agent 的内部思维格式。

### 5.2 第二部分：按需知识文档

知识库负责：

- 怎样从完整 pin-Net JSON 阅读电路；
- signal、bias、power、clock、feedback 和高阻 Net 的证据；
- differential pair、mirror、cascode、array、sampling 等模式的证据、反证和变体；
- 怎样将电路理解转成教材/Razavi 式表达；
- 路由、标签、层次和人工协同判断；
- diagnostics 对应的局部修复方法。

Skill 根据任务按需读取，启动时不加载全部知识。产品 specs 是代码与 Skill 引用的硬
合同，examples/evaluation 是开发材料；它们不是第三、第四个 Agent 运行层。

详细计划见
[`Agent 知识文档与 Skill 构建计划`](knowledge-and-skill-plan.md)。

## 6. Evidence-first 电路理解

知识文档不先要求 Agent 给整张电路分类，而是教它从 Snapshot 寻找：

1. ports、global Nets 和 hierarchy boundaries；
2. primitive/model、pin order、参数、bulk 和开关控制；
3. power、ground、bias、clock、differential、feedback、高阻和高扇出 Net；
4. shared source/emitter、共 gate/base、stack、bridge 和重复支路；
5. 主信号路径、偏置供给、共模/差模路径和反馈回路；
6. 参数不匹配、附加负载、断开支路和不同控制信号等反证；
7. 已证实判断、布局假设和仍需人工确认的不确定性。

Pattern card 是可选知识，不是产品 taxonomy。它必须同时包含最小证据、反证、变体、
表达目标和失败模式，不能用模式名替代当前电路推理。

## 7. 大规模电路

大电路的默认策略是“先选 Document，再完整读取”，不是语义 region 查询：

1. Agent 从 Project Index 选择 top 或 child Document；
2. 获取该 Document 的完整 Snapshot；
3. 在内部理解功能区域和表达重点；
4. 先提交局部、可回滚 edits，用 locks 保护人工确认部分；
5. 每轮用 diagnostics/render 收敛；
6. 最后刷新完整 Snapshot 并做全局信号流、跨区线、标签和留白检查。

如果电路是一个没有可用层次的超大扁平 Document，仍先测量完整 Snapshot。只有超过
明确 host 限制时才做无语义 transport chunk。Agent 可以在内部自行只关注一部分对象，
产品不替它预先划 region。

这里的“内部关注”不是把旧的 region query 换一个名字。Agent 可以临时建立任意图、
区域、模式假设、坐标草案或布线方案，也可以完全不用这些形式；这些状态不跨越 API
边界、不写入项目，并且不成为下一步 transact 的前置协议。只有用户明确保留的布局组、
约束和锁才写回现有 Document 字段。

## 8. PDK、层次与人工协同

PDK mapping 属于产品事实层，优先级为：Project override、精确 model/subckt、受 PDK
namespace 约束的规则、标准 primitive、generic fallback。映射必须保留原 model 和参数；
pin order 或 bulk 不明确时不得静默猜测。

Project Index/Snapshot 应表达 Document nodes 和 instance-reference edges，而不是简单
child tree。编辑器需要补齐进入实例、返回 parent/top、Document 搜索/切换、共享 child
引用上下文、诊断跳转、Agent 修改通知和 locks。编辑器 current Document 只是 session
state；Agent transact 始终显式指定 `documentId`。

## 9. Optional helper

完整 Snapshot + Skill + 核心知识跑通前，不实现新的 topology/routing helper。

只有 A/B trace 证明某项重复机械工作显著消耗 query/edit/token/time，才考虑：

- 重复子图或对称候选；
- signal/feedback path 候选；
- 阵列、等距、镜像等 edit generators；
- route corridor 或 mirrored route 候选。

Helper 必须是纯函数，返回成员、证据、冲突和版本；Agent 可忽略或推翻。它不能修改
Project，不能成为 Skill 必经步骤，也不新增电路类型 endpoint。

## 10. 文件流和项目结构

正式文件流仍是：

```text
SPICE / netlist
  -> import
  -> Project + Documents (.icproj)
  -> derive Agent Snapshot
  -> Agent/GUI 通过同一 Edit Engine 修改
  -> 同一个 .icproj
  -> SVG / PNG / PDF
```

Snapshot 是运行时消息。默认不写入 `snapshot.json`，除非用户明确要求保存 trace；即使
导出，它也不是重新打开 Project 的依赖。

最小结构调整：

```text
packages/agent-adapter/src/
  snapshot/              完整只读 Agent 视图与一致性校验
  transact/              既有 typed transaction adapter
  render/                既有 bounded render adapter

packages/symbols/src/
  pdk/                   PDK model -> symbol registry

packages/derived/src/
  visual/                空间化 diagnostics
  helpers/               后期、仅按实测增加

apps/editor/src/
  hierarchy/             Document 导航与引用上下文
  diagnostics/           问题定位、选择和跳转

skills/circuit-layout/
  SKILL.md                全流程统领
  references/manifest.md  知识路由和兼容版本

docs/agent/knowledge/
  ...                     电路理解与表达知识
```

不新增 `packages/layout` 或 query-planner package。

## 11. Phase 9 执行顺序

1. 用当前能力记录无 Skill baseline，并冻结 Snapshot + Skill 合同；
2. 实现完整 `AgentDocumentSnapshot` 生成、传输和一致性测试；
3. 同步完成薄 Skill 与三份核心知识文档；
4. 运行 RLC、CDAC 和一个未见电路的第一次垂直闭环；
5. 根据失败补齐 PDK/symbol/port edits、空间 diagnostics 和层次事实；
6. 补齐人类 Document 导航、诊断跳转、locks 和接管流程；
7. 从真实理解困难中扩展 pattern knowledge；
8. 只有测量证明需要时才增加 helper/generator；
9. 用重命名、乱序、不对称、未知 PDK 和 100+ 晶体管完成泛化/消融验收。

Skill 从第一轮垂直测试开始统领流程，不再等所有产品能力完成后才编写。

## 12. 验收标准

- Agent 在不调用 region/topology/query DSL 的情况下取得完整 pin-Net 电路事实；
- Snapshot 中 instance→pins→Net 与 Net→terminals 双向一致；
- RLC 可以从一次 Snapshot 开始完成编辑和视觉收敛；
- CDAC 通过 Project Index 选择 Document，不增加 CDAC endpoint；
- 100+ 晶体管 Document 默认完整读取，并有真实 payload/token/latency 记录；
- stale revision 后刷新 Snapshot 可继续工作，不盲目重试旧事务；
- unknown PDK/pin mapping 保留原事实并明确诊断；
- diagnostics 能定位具体 object ids 和 bounds；
- GUI 与 Agent 对相同 typed edits 得到相同 Document；
- locks 和人工已有布局不会被隐式改写；
- 关闭所有 optional helpers 后，核心流程仍完整；
- Skill/知识相对无 Skill baseline 不增加电气错误，并提高预先声明的完成率、效率或盲审
  可读性指标；
- `.icproj` 仍是唯一必需项目文件。

## 13. 已冻结的实现合同

1. Snapshot schema、version、稳定排序和 topology hash；
2. v1 `query` 的兼容期与 v2 `snapshot` 迁移方式；
3. Snapshot 的权限裁剪边界，尤其 source spans/raw parameters；
4. 单 Document payload/context budget 和 transport chunk 触发阈值；
5. transact 成功后由 SDK 应用 diff 还是按需刷新 Snapshot；
6. diagnostics code、bounds 和 revision 兼容规则；
7. Skill 与知识文档的兼容 API/snapshot version；
8. A/B 主指标、硬非回归指标和 optional helper 准入阈值。

这些问题由 WP-9.1 的 spec/ADR 冻结；后续变更必须走兼容版本或新的 ADR，避免实现
重新分叉。

## 14. 相关文档

- [`Agent Knowledge and Skill Plan`](knowledge-and-skill-plan.md)
- [`Agent API`](../specs/agent-api.md)
- [`Edit Engine`](../specs/edit-engine.md)
- [`Schematic Model`](../specs/schematic-model.md)
- [`Connectivity and Routing`](../specs/connectivity-and-routing.md)
- [`Symbol DSL`](../specs/symbol-dsl.md)
- [`Project File Format`](../specs/project-file-format.md)
- [`Visual Language`](../specs/visual-language.md)
- [`Phase 9`](../roadmap/phase-9-agent-reasoning-and-observability.md)
