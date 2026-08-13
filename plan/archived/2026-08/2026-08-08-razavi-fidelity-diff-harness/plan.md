---
status: completed
experience: none
---

# Razavi 视觉保真度比较夹具

## 目标

建一个确定性的、可迭代的比较函数：在固定放缩比例下，把**渲染出的单个器件 SVG 栅格图**与**从 `razavi-six-panel.png` 裁出的同一器件参考图**做二值 IoU 比对，产出分数 + 像素差图 + 误差分解报告。工具只产出报告，不自动改源文件——人在环里根据报告调整 `mos-geometry.json` / `peripheral-geometry.json` / `style-profile.ts`，再重新生成 + 比较，形成闭环。

## 为什么之前失败、这次能成

`plan/2026-08-08-razavi-ui-mos-raster-diff` 之前用**浏览器 UI 截图**和参考图比，失败原因：浏览器 DPR/viewport/scale 不可控，UI 30px MOS 和参考图 70px MOS 不可比。

这次的关键区别：**两边都用 resvg 在固定 `pixelsPerLogical = 1.72` 下栅格化**，彻底绕开浏览器。参考侧是已有的栅格 PNG（固定 1204×794），渲染侧用 `@resvg/resvg-js` 把 symbol SVG 栅格化到和参考侧**完全相同的像素窗口**。两边像素尺寸逐位一致，可直接 diff。

## 配准方式（已确认）

用 `originPx` + symbol logical 范围裁剪。链路：

1. 从 `mos-geometry.json` 读出器件的 `originPx`（如 NMOS `161.8, 217.5`）和 `pixelsPerLogical = 1.72`。
2. symbol 的 logical 坐标已知（pin D 在 `10,-20`，viewBox `-24,-24,48,48`）。取一个逻辑包围盒（用 symbol 的 viewBox 或 pin 外接框 + padding），乘以 `pixelsPerLogical` 得到像素窗口尺寸。
3. 参考侧：以 `originPx` 为中心，按该像素窗口从 `razavi-six-panel.png` 裁出 `refCrop`。
4. 渲染侧：构造完整 SVG，`viewBox` 设为该 logical 包围盒，`width/height` 设为像素窗口尺寸（整数），用 `rasterizeSvgBytes` 栅格化得到 `renderedCrop`。两者像素尺寸严格一致。
5. 逐像素 diff。

注意 `scaleFormalStrokes: true`（Razavi）→ 不用 `non-scaling-stroke`，stroke 随 viewBox 缩放。所以渲染 SVG 的 viewBox 必须正好等于 logical 包围盒，width = `ceil(logicalWidth * 1.72)`，让 1 logical unit = 1.72 px 成立，线宽才和 profile 里写的 `1.6`/`2.16` 在像素层面正确呈现。

## 比较指标（已确认）

二值 IoU + 像素差图：

1. 两边灰度化（参考图本就是灰度；渲染 PNG 转灰度）。
2. 用 manifest 的 `pixelThreshold = 160` 二值化成 ink/no-ink 掩膜（`< 160` = ink）。
3. IoU = `|ref ∩ rendered| / |ref ∪ rendered|`，0~1。
4. 产出三张 diff PNG：
   - 红通道：参考有 ink、渲染无（漏绘）
   - 绿通道：渲染有 ink、参考无（多绘）
   - 重叠部分灰度显示
5. 误差分解：把 diff 像素按 symbol 部件区域（gate-bar / channel / source-arrow / bulk-lead）归类统计，报告"哪个部件偏移了多少像素"。

## 迭代闭环（已确认）

工具只产出报告。流程：

```
改源配置 (mos-geometry.json / style-profile.ts / peripheral-geometry.json)
  → node scripts/generate-razavi-mos-assets.mjs        (重新生成 .symbol.json)
  → node scripts/razavi-fidelity-diff.mjs              (本工具)
  → 看报告 + diff PNG → 人工判断怎么改 → 回到顶
```

工具不碰源文件，保证人在环里、可控、不会过拟合栅格噪声。

## 实现方案

### 新增文件

| 文件                               | 作用                                       |
| ---------------------------------- | ------------------------------------------ |
| `scripts/razavi-fidelity-diff.mjs` | 主脚本，CLI 入口                           |
| `scripts/lib/razavi-fidelity.mjs`  | 比较核心库（可被未来测试/vitest 复用）     |
| `scripts/lib/png-io.mjs`           | PNG 编解码 + 像素读写（纯 JS，不引新依赖） |

不新增 npm 依赖——`@resvg/resvg-js` 已在 `@icm/exporters`；PNG 解码用现有能力或最小自包含实现。需确认 PNG 解码方案（见下"待确认"）。

### 依赖来源

- `rasterizeSvgBytes` / `exportFormalArtifacts` ← 从 `@icm/exporters`（workspace 依赖）import。resvg 在该包。
- `renderSymbolDefinitionBody` + `razaviTextbookProfile` ← 从 `@icm/render-svg` / `@icm/derived` import。
- symbol 定义 ← `@icm/symbols` 的 `InMemorySymbolResolver` + `packages/symbols/assets/razavi-v1/*.symbol.json`。
- `mos-geometry.json` / `peripheral-geometry.json` / `razavi-six-panel.png` ← `fixtures/visual-reference/razavi-reference-v1/`。

脚本在 root 执行，通过 workspace 协议 import 各 package（和 `scripts/phase-7-export-golden.mjs` 等已有脚本的 import 方式一致——需参照其 import 写法）。

### CLI 设计

```powershell
node scripts/razavi-fidelity-diff.mjs [target...] [--threshold 160] [--out dir]
```

- `target`：可选，器件名（`nmos` / `pmos` / `nmos3` / `pmos3` / `voltage-source` / `current-source` / `ground`）。缺省跑全部 raster-owned 器件。
- `--threshold`：二值化阈值，默认读 manifest 的 `pixelThreshold`。
- `--out`：报告输出目录，默认 `fixtures/visual-reference/razavi-reference-v1/diff/`。

### 输出

每个器件产出：

- `diff-{device}.png`：三通道差图（红=漏，绿=多，灰=重叠）
- `ref-{device}.png` / `rendered-{device}.png`：两边栅格图（便于肉眼对照）
- 控制台表格：`device | refPixels | renderedPixels | IoU | 漏绘% | 多绘% | 最大偏移部件`

### 核心流程（razavi-fidelity.mjs）

```
for each device:
  1. 读 geometry JSON 取 originPx + pixelsPerLogical + symbol 的 logical bbox
  2. refCrop = cropFromReferencePng(sixPanel, originPx, logicalBbox, ppl)
  3. svg = wrapSymbolInSvg(definition, logicalBbox, pixelWidth, profile)
  4. renderedPng = rasterizeSvgBytes(svg, pixelWidth)
  5. refMask = binarize(refCrop, threshold)
  6. renderedMask = binarize(renderedPng, threshold)
  7. iou = intersectionOverUnion(refMask, renderedMask)
  8. diffPng = composeDiff(refMask, renderedMask)
  9. breakdown = attributeByPart(refMask xor renderedMask, partRegions)
  report(device, iou, diffPng, breakdown)
```

`wrapSymbolInSvg` 是关键：把 `renderSymbolDefinitionBody` 的输出包进 `<svg viewBox="lx ly lw lh" width="W" height="H">` + 前景/背景填充 + 必要的 `<style>`（和 `renderDocumentSvg` 一致），让 resvg 能独立栅格化单个 symbol。

## 配准的精确数学

NMOS 为例：

- `originPx = (161.8, 217.5)`，`ppl = 1.72`
- symbol viewBox = `{x:-24, y:-24, w:48, h:48}`（logical）
- 像素窗口：以 `originPx` 为 logical 原点，覆盖 `[-24,-24]→[24,24]`
  - 左上像素 = `originPx + (-24,-24)*ppl = (161.8-41.28, 217.5-41.28) = (120.52, 176.22)`
  - 像素宽高 = `48*1.72 = 82.56` → 取整 83
- 参考裁剪：从 `(120, 176)` 起 83×83 窗口
- 渲染 SVG：`viewBox="-24 -24 48 48" width="83" height="83"`，stroke 按 profile（`normal=1.6` logical → `1.6*1.72=2.752px`）

亚像素取整会引入 ≤1px 配准误差——这是栅格方法固有极限，报告里标注"配准不确定度 ±1px"。

## 待确认 / 风险

1. **PNG 解码**：resvg 产出 PNG，参考图也是 PNG。需要读 PNG 像素做二值化。仓库无 pngjs/jpegjs。选项：(a) 引 `pngjs` 一个轻依赖；(b) 复用 resvg 的 `RenderedImage.pixels`（渲染侧可直接拿 RGBA，无需解码）；(c) 参考侧用 Node 自带能力？——Node 无内置 PNG 解码。倾向 (a) 引 `pngjs`，或用 sharp（重）。**需在实现时定。**
2. **resvg 字体**：symbol body 本身无文字（pin name/label 在 `renderSymbolDefinitionBody` 之外），所以栅格化 symbol 不触发字体。✓ 无字体问题。
3. **stroke 在 resvg 的渲染**：resvg 对 `stroke-width` + `lineCap=butt` 的渲染需验证是否和浏览器一致。这是比较的前提，实现后需先做一次 stroke-width 基准校验（画一根已知宽度的线，量像素宽）。
4. **peripheral 器件**（voltage-source / current-source / ground）的 logical bbox 和 originPx 来自 `peripheral-geometry.json`，配准逻辑相同但 symbol 定义结构不同，需分别处理。

## 验收

- `node scripts/razavi-fidelity-diff.mjs nmos` 产出 `diff-nmos.png` + 控制台报告，IoU 是一个 0~1 的数字。
- 报告能区分"漏绘"和"多绘"，并按部件归类。
- 故意把 `mos-geometry.json` 某坐标偏移 2px 后重跑，IoU 应明显下降、diff 图对应位置变红——证明信号有效。
- 不引入新的栅格化/图像依赖到 `render-svg` 包（只在 scripts 层用 exporters）。

## 不做

- 不自动改源配置文件（工具只读 + 报告）。
- 不做灰度 SSIM（先二值 IoU，简单清晰；后续需要再加）。
- 不做 UI 浏览器截图（吸取上次教训）。
- 不碰 Visio-owned 器件（R/C/L/Diode/BJT/Port）——它们没有 raster 参考对应的 `originPx` 体系，本次只覆盖 raster-owned：MOS / voltage-source / current-source / ground。
