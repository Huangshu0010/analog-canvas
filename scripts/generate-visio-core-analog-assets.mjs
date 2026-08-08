import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = resolve(root, "packages/symbols/assets/razavi-v1");
const catalogPath = resolve(assetRoot, "catalog.json");
const catalogGeneratorPath = resolve(
  root,
  "scripts/generate-razavi-symbol-catalog.mjs",
);
const evidencePath = resolve(
  root,
  "fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json",
);
const reviewPath = resolve(root, "fixtures/symbols/circuit-vss-review.json");
const referenceRoot = resolve(
  root,
  "fixtures/visual-reference/visio-core-analog",
);
const comparisonPath = resolve(
  root,
  "fixtures/visual-golden/visio-core-analog-fidelity.svg",
);
const check = process.argv.includes("--check");
const execFileAsync = promisify(execFile);

const POINTS_PER_INCH = 72;
const CONNECTION_GRID = 10;
const EPSILON = 1e-6;
const normalize = (value) => `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

const configs = [
  {
    symbolId: "resistor",
    name: "Resistor",
    masterNameU: "R",
    reference: "resistor.svg",
    aliases: [],
    pins: [
      ["1", "passive", "north", 8, "end"],
      ["2", "passive", "south", 9, "end"],
    ],
  },
  {
    symbolId: "capacitor",
    name: "Capacitor",
    masterNameU: "C",
    reference: "capacitor.svg",
    aliases: [],
    pins: [
      ["1", "passive", "north", 8, "end"],
      ["2", "passive", "south", 9, "end"],
    ],
  },
  {
    symbolId: "inductor",
    name: "Inductor",
    masterNameU: "L",
    reference: "inductor.svg",
    aliases: [],
    pins: [
      ["1", "passive", "north", 8, "end"],
      ["2", "passive", "south", 7, "end"],
    ],
  },
  {
    symbolId: "diode",
    name: "Diode",
    masterNameU: "Diode1",
    reference: "diode.svg",
    aliases: ["rectifier-diode"],
    pins: [
      ["A", "anode", "west", 9, "end"],
      ["K", "cathode", "east", 8, "end"],
    ],
  },
  {
    symbolId: "ground",
    name: "Ground",
    masterNameU: "GND",
    reference: "ground.svg",
    aliases: ["gnd"],
    labelVisibility: "hidden",
    leadAxisScale: 1.18,
    pins: [["0", "ground", "north", 6, "start"]],
  },
  {
    symbolId: "port",
    name: "Port",
    masterNameU: "I/O",
    reference: "port.svg",
    aliases: [],
    referenceOrigin: { x: 283.464567, y: 430.866142 },
    circlePresentation: { fill: "foreground", stroke: "none" },
    pins: [["P", "port", "east", 7, "start"]],
  },
  {
    symbolId: "voltage-source",
    name: "Independent Voltage Source",
    masterNameU: "DC-V",
    reference: "voltage-source.svg",
    aliases: ["dc-voltage"],
    pins: [
      ["+", "positive", "north", 11, "end"],
      ["-", "negative", "south", 12, "end"],
    ],
    sourcePresentation: "outside-polarity",
  },
  {
    symbolId: "current-source",
    name: "Independent Current Source",
    masterNameU: "DC-I",
    reference: "current-source.svg",
    aliases: ["dc-current"],
    pins: [
      ["+", "positive", "north", 9, "end"],
      ["-", "negative", "south", 10, "end"],
    ],
    sourcePresentation: "wide-arrow",
  },
];

function fail(message) {
  throw new Error(`Visio core-analog generation: ${message}`);
}

function number(cell, label) {
  if (cell?.resultIU === undefined) fail(`missing numeric cell ${label}`);
  return cell.resultIU * POINTS_PER_INCH;
}

function rawNumber(cell, fallback = 0) {
  return cell?.resultIU ?? fallback;
}

function rounded(value) {
  const result = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(result, -0) ? 0 : result;
}

function roundedPoint(point) {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function samePoint(left, right) {
  return (
    Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON
  );
}

function transformLocalPoint(shape, localPoint) {
  const transform = shape.transform;
  const pinX = number(transform.PinX, `${shape.nameU}.PinX`);
  const pinY = number(transform.PinY, `${shape.nameU}.PinY`);
  const locPinX = number(transform.LocPinX, `${shape.nameU}.LocPinX`);
  const locPinY = number(transform.LocPinY, `${shape.nameU}.LocPinY`);
  const angle = rawNumber(transform.Angle);
  let dx = localPoint.x - locPinX;
  let dy = localPoint.y - locPinY;
  if (rawNumber(transform.FlipX) !== 0) dx = -dx;
  if (rawNumber(transform.FlipY) !== 0) dy = -dy;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: pinX + dx * cosine - dy * sine,
    y: pinY + dx * sine + dy * cosine,
  };
}

function sourceShapes(master) {
  return master.shapes.flatMap((shape) =>
    shape.kind === "group" ? shape.children : [shape],
  );
}

function sectionIsVisible(section) {
  const component = section.rows.find((row) => row.kind === "component");
  return (
    rawNumber(component?.cells?.noShow) === 0 &&
    rawNumber(component?.cells?.noLine) === 0
  );
}

function localPoint(row, label) {
  return {
    x: number(row.cells.x, `${label}.${row.kind}.x`),
    y: number(row.cells.y, `${label}.${row.kind}.y`),
  };
}

function visibleWorldPoints(shape) {
  const result = [];
  for (const section of shape.geometry) {
    if (!sectionIsVisible(section)) continue;
    for (const row of section.rows) {
      if (row.kind === "moveTo" || row.kind === "lineTo") {
        result.push(transformLocalPoint(shape, localPoint(row, shape.nameU)));
      } else if (row.kind === "ellipse") {
        for (const [x, y] of [
          ["x", "y"],
          ["a", "b"],
          ["c", "d"],
        ]) {
          result.push(
            transformLocalPoint(shape, {
              x: number(row.cells[x], `${shape.nameU}.ellipse.${x}`),
              y: number(row.cells[y], `${shape.nameU}.ellipse.${y}`),
            }),
          );
        }
      } else if (row.kind === "ellipticalArcTo") {
        result.push(transformLocalPoint(shape, localPoint(row, shape.nameU)));
      } else if (row.kind !== "component") {
        fail(`${shape.nameU} uses unsupported ${row.kind}`);
      }
    }
  }
  return result;
}

function masterFrame(master) {
  const group = master.shapes.find((shape) => shape.kind === "group");
  if (group) {
    return {
      center: {
        x: number(group.transform.Width, `${group.nameU}.Width`) / 2,
        y: number(group.transform.Height, `${group.nameU}.Height`) / 2,
      },
    };
  }
  const points = sourceShapes(master).flatMap(visibleWorldPoints);
  if (points.length === 0) fail(`${master.nameU} has no visible geometry`);
  return {
    center: {
      x:
        (Math.min(...points.map((point) => point.x)) +
          Math.max(...points.map((point) => point.x))) /
        2,
      y:
        (Math.min(...points.map((point) => point.y)) +
          Math.max(...points.map((point) => point.y))) /
        2,
    },
  };
}

function centeredPoint(frame, worldPoint) {
  return roundedPoint({
    x: worldPoint.x - frame.center.x,
    y: frame.center.y - worldPoint.y,
  });
}

function sectionSegments(shape, frame) {
  const result = [];
  for (const section of shape.geometry) {
    if (!sectionIsVisible(section)) continue;
    let current;
    const segments = [];
    for (const row of section.rows) {
      if (row.kind === "component") continue;
      if (row.kind !== "moveTo" && row.kind !== "lineTo") continue;
      const point = centeredPoint(
        frame,
        transformLocalPoint(shape, localPoint(row, shape.nameU)),
      );
      if (row.kind === "moveTo") current = point;
      else {
        if (!current) fail(`${shape.nameU} lineTo has no moveTo`);
        segments.push({ from: current, to: point });
        current = point;
      }
    }
    if (segments.length > 0) result.push(segments);
  }
  return result;
}

function shapeStrokeStyle(shape) {
  const weight = number(shape.line.LineWeight, `${shape.nameU}.LineWeight`);
  let strokeRole;
  if (Math.abs(weight - 1.2) < EPSILON) strokeRole = "normal";
  else if (Math.abs(weight - 2.16) < EPSILON) strokeRole = "emphasis";
  else fail(`${shape.nameU} has unsupported visible line weight ${weight}`);
  const lineCap = rawNumber(shape.line.LineCap);
  if (lineCap === 0) {
    return { strokeRole, lineCap: "round", lineJoin: "round" };
  }
  if (lineCap === 1) {
    return { strokeRole, lineCap: "butt", lineJoin: "miter" };
  }
  fail(`${shape.nameU} has unsupported Visio line cap ${lineCap}`);
}

function snap(value) {
  return Math.round(value / CONNECTION_GRID) * CONNECTION_GRID;
}

function applyDelta(point, delta) {
  return roundedPoint({ x: point.x + delta.x, y: point.y + delta.y });
}

function pinAnchor(point) {
  return { x: snap(point.x), y: snap(point.y) };
}

function positiveAngle(from, to) {
  const turn = (to - from) % (Math.PI * 2);
  return turn < 0 ? turn + Math.PI * 2 : turn;
}

function ellipticalArcPoints(start, row, label) {
  const end = localPoint(row, label);
  const control = {
    x: number(row.cells.a, `${label}.ellipticalArcTo.a`),
    y: number(row.cells.b, `${label}.ellipticalArcTo.b`),
  };
  const angle = rawNumber(row.cells.c);
  const ratio = rawNumber(row.cells.d);
  if (!(ratio > 0 && ratio <= 1000)) {
    fail(`${label} has invalid elliptical arc aspect ratio ${ratio}`);
  }
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotate = (point) => ({
    x: point.x * cosine + point.y * sine,
    y: -point.x * sine + point.y * cosine,
  });
  const points = [start, end, control].map(rotate);
  const [first, last, middle] = points;
  const scale = ratio * ratio;
  const determinant =
    (first.x - last.x) * scale * (first.y - middle.y) -
    (first.x - middle.x) * scale * (first.y - last.y);
  if (Math.abs(determinant) < EPSILON) {
    fail(`${label} has degenerate elliptical arc`);
  }
  const difference = (left, right) =>
    left.x * left.x -
    right.x * right.x +
    scale * (left.y * left.y - right.y * right.y);
  const rightLast = difference(first, last) / 2;
  const rightMiddle = difference(first, middle) / 2;
  const centerX =
    (rightLast * scale * (first.y - middle.y) -
      rightMiddle * scale * (first.y - last.y)) /
    determinant;
  const centerY =
    ((first.x - last.x) * rightMiddle - (first.x - middle.x) * rightLast) /
    determinant;
  const radiusSquared =
    (first.x - centerX) * (first.x - centerX) +
    scale * (first.y - centerY) * (first.y - centerY);
  if (!(radiusSquared > EPSILON)) fail(`${label} has invalid arc radius`);
  const radius = Math.sqrt(radiusSquared);
  const theta = (point) =>
    Math.atan2(ratio * (point.y - centerY), point.x - centerX);
  const startTheta = theta(first);
  const endTheta = theta(last);
  const controlTheta = theta(middle);
  const ccw = positiveAngle(startTheta, endTheta);
  const passesControlCounterClockwise =
    positiveAngle(startTheta, controlTheta) <= ccw + EPSILON;
  const travel = passesControlCounterClockwise
    ? ccw
    : -positiveAngle(endTheta, startTheta);
  const steps = Math.max(2, Math.ceil(Math.abs(travel) / (Math.PI / 16)));
  return Array.from({ length: steps }, (_, index) => {
    const thetaAt = startTheta + (travel * (index + 1)) / steps;
    const local = {
      x: centerX + radius * Math.cos(thetaAt),
      y: centerY + (radius / ratio) * Math.sin(thetaAt),
    };
    return {
      x: local.x * cosine - local.y * sine,
      y: local.x * sine + local.y * cosine,
    };
  });
}

function markerFromReference(source, masterNameU) {
  const marker = source.match(
    /<marker[^>]*v:arrowType="(\d+)"[^>]*v:arrowSize="(\d+)"[^>]*refX="(-?[\d.]+)"[^>]*>/u,
  );
  const scale = source.match(
    /<use[^>]*xlink:href="#lend13"[^>]*transform="scale\((-?[\d.]+)(?:,-?[\d.]+)?\)\s*"\/>/u,
  );
  if (!marker || !scale) fail(`cannot decode Arrow Type 13 for ${masterNameU}`);
  if (Number(marker[1]) !== 13) fail(`${masterNameU} is not Arrow Type 13`);
  return {
    arrowType: Number(marker[1]),
    arrowSize: Number(marker[2]),
    refX: Number(marker[3]),
    scale: Math.abs(Number(scale[1])),
  };
}

function arrowPrimitives(shape, segment, style, marker) {
  const beginArrow = rawNumber(shape.line.BeginArrow);
  const endArrow = rawNumber(shape.line.EndArrow);
  if ((beginArrow === 0) === (endArrow === 0)) {
    fail(`${shape.nameU} must have exactly one arrow endpoint`);
  }
  const arrowType = beginArrow || endArrow;
  const arrowSize = beginArrow
    ? rawNumber(shape.line.BeginArrowSize)
    : rawNumber(shape.line.EndArrowSize);
  if (arrowType !== marker.arrowType || arrowSize !== marker.arrowSize) {
    fail(`${shape.nameU} marker reference does not match VssMasterIR`);
  }
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const distance = Math.hypot(dx, dy);
  const direction = { x: dx / distance, y: dy / distance };
  const perpendicular = { x: -direction.y, y: direction.x };
  const strokeWidth = number(
    shape.line.LineWeight,
    `${shape.nameU}.LineWeight`,
  );
  const arrowLength = 3 * marker.scale * strokeWidth;
  const halfWidth = marker.scale * strokeWidth;
  const setback = Math.abs(marker.refX) * strokeWidth;
  const tip = beginArrow ? segment.from : segment.to;
  const baseCenter = beginArrow
    ? {
        x: tip.x + direction.x * arrowLength,
        y: tip.y + direction.y * arrowLength,
      }
    : {
        x: tip.x - direction.x * arrowLength,
        y: tip.y - direction.y * arrowLength,
      };
  return [
    {
      kind: "line",
      from: beginArrow
        ? roundedPoint({
            x: segment.from.x + direction.x * setback,
            y: segment.from.y + direction.y * setback,
          })
        : segment.from,
      to: endArrow
        ? roundedPoint({
            x: segment.to.x - direction.x * setback,
            y: segment.to.y - direction.y * setback,
          })
        : segment.to,
      style,
    },
    {
      kind: "polygon",
      points: [
        roundedPoint(tip),
        roundedPoint({
          x: baseCenter.x + perpendicular.x * halfWidth,
          y: baseCenter.y + perpendicular.y * halfWidth,
        }),
        roundedPoint({
          x: baseCenter.x - perpendicular.x * halfWidth,
          y: baseCenter.y - perpendicular.y * halfWidth,
        }),
      ],
      fill: "foreground",
      stroke: "none",
    },
  ];
}

function sourceLeadPrimitives(primitives, pins) {
  return primitives.filter(
    (primitive) =>
      primitive.kind === "line" &&
      pins.some(
        (pin) =>
          samePoint(primitive.from, pin.at) || samePoint(primitive.to, pin.at),
      ),
  );
}

function presentIndependentSource(config, pins, primitives) {
  if (!config.sourcePresentation) {
    return { primitives, extraPoints: [] };
  }
  const circle = primitives.find((primitive) => primitive.kind === "circle");
  if (!circle || circle.kind !== "circle") {
    fail(`${config.symbolId} source presentation requires a circle`);
  }
  const leads = sourceLeadPrimitives(primitives, pins);
  const normalStyle = {
    strokeRole: "normal",
    lineCap: "butt",
    lineJoin: "miter",
  };
  if (config.sourcePresentation === "outside-polarity") {
    const markerX = circle.center.x - circle.radius - 4.5;
    const plusY = circle.center.y - circle.radius - 2.5;
    const minusY = circle.center.y + circle.radius + 2.5;
    const halfMark = 4;
    const polarity = [
      {
        kind: "line",
        from: { x: markerX - halfMark, y: plusY },
        to: { x: markerX + halfMark, y: plusY },
        style: normalStyle,
      },
      {
        kind: "line",
        from: { x: markerX, y: plusY - halfMark },
        to: { x: markerX, y: plusY + halfMark },
        style: normalStyle,
      },
      {
        kind: "line",
        from: { x: markerX - halfMark, y: minusY },
        to: { x: markerX + halfMark, y: minusY },
        style: normalStyle,
      },
    ].map((primitive) => ({
      ...primitive,
      from: roundedPoint(primitive.from),
      to: roundedPoint(primitive.to),
    }));
    return {
      primitives: [circle, ...polarity, ...leads],
      extraPoints: polarity.flatMap((primitive) => [
        primitive.from,
        primitive.to,
      ]),
    };
  }
  if (config.sourcePresentation === "wide-arrow") {
    const shaftStart = {
      x: circle.center.x,
      y: circle.center.y - circle.radius * 0.5,
    };
    const baseY = circle.center.y + 0.75;
    // The current-source shaft intentionally still ends on this base.  The
    // requested calibration affects only the filled arrowhead.
    const referenceHeadLength = circle.center.y + circle.radius * 0.66 - baseY;
    const tip = {
      x: circle.center.x,
      y: baseY + referenceHeadLength * 1.69,
    };
    const halfWidth = circle.radius * 0.42 * 1.15;
    const shaft = {
      kind: "line",
      from: roundedPoint(shaftStart),
      to: roundedPoint({ x: circle.center.x, y: baseY }),
      style: { ...normalStyle, lineCap: "round", lineJoin: "round" },
    };
    const head = {
      kind: "polygon",
      points: [
        roundedPoint(tip),
        roundedPoint({ x: circle.center.x - halfWidth, y: baseY }),
        roundedPoint({ x: circle.center.x + halfWidth, y: baseY }),
      ],
      fill: "foreground",
      stroke: "none",
    };
    return {
      primitives: [circle, shaft, head, ...leads],
      extraPoints: [shaft.from, shaft.to, ...head.points],
    };
  }
  fail(`${config.symbolId} has unknown source presentation`);
}

function viewBoxFor(symbol, points) {
  const allPoints = [...points, ...symbol.pins.map((pin) => pin.at)];
  const minX = Math.floor(Math.min(...allPoints.map((point) => point.x)) - 4);
  const minY = Math.floor(Math.min(...allPoints.map((point) => point.y)) - 4);
  const maxX = Math.ceil(Math.max(...allPoints.map((point) => point.x)) + 4);
  const maxY = Math.ceil(Math.max(...allPoints.map((point) => point.y)) + 4);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function reviewMapping(review, config) {
  return review.mappings.find(
    (mapping) => mapping.symbolId === config.symbolId,
  );
}

function renderPrimitive(primitive) {
  const style = primitive.style;
  const width = style?.strokeRole === "emphasis" ? 2.16 : 1.2;
  const styleAttributes = style
    ? ` stroke-width="${width}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}"`
    : "";
  if (primitive.kind === "line") {
    return `<line x1="${primitive.from.x}" y1="${primitive.from.y}" x2="${primitive.to.x}" y2="${primitive.to.y}"${styleAttributes}/>`;
  }
  if (primitive.kind === "circle") {
    return `<circle cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}" fill="${primitive.fill === "foreground" ? "#000" : "none"}"${primitive.stroke === undefined ? "" : ` stroke="${primitive.stroke === "foreground" ? "#000" : "none"}"`}${styleAttributes}/>`;
  }
  if (primitive.kind === "path")
    return `<path d="${primitive.data}" fill="none"${styleAttributes}/>`;
  if (primitive.kind === "polygon") {
    return `<polygon points="${primitive.points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="#000" stroke="none"/>`;
  }
  fail(`unexpected comparison primitive ${primitive.kind}`);
}

function comparisonSvg(generated, references) {
  const rowHeight = 120;
  const width = 510;
  const height = configs.length * rowHeight + 35;
  const rows = configs
    .map((config, index) => {
      const item = generated.get(config.symbolId);
      const reference = references.get(config.symbolId);
      const y = 30 + index * rowHeight;
      const sourceX = 95;
      const runtimeX = 240;
      const overlayX = 385;
      const source = `<image href="${reference.dataHref}" x="${sourceX}" y="${y}" width="${reference.viewBox.width}" height="${reference.viewBox.height}"/>`;
      const runtimeViewBox = `${item.masterDelta.x - reference.sourceCenter.x} ${-item.masterDelta.y - reference.sourceCenter.y} ${reference.viewBox.width} ${reference.viewBox.height}`;
      const runtimeBody = item.symbol.primitives.map(renderPrimitive).join("");
      const runtime = `<svg width="${reference.viewBox.width}" height="${reference.viewBox.height}" viewBox="${runtimeViewBox}" overflow="visible"><g fill="none" stroke="#000">${runtimeBody}</g></svg>`;
      return `<g data-symbol-id="${config.symbolId}"><text x="10" y="${y + 46}">${config.symbolId}</text>${source}<g transform="translate(${runtimeX} ${y})">${runtime}</g><g transform="translate(${overlayX} ${y})" opacity="0.5"><image href="${reference.dataHref}" width="${reference.viewBox.width}" height="${reference.viewBox.height}"/>${runtime}</g></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/><style>text{font:12px Arial,sans-serif;fill:#000}line,path,circle,polygon{vector-effect:non-scaling-stroke}</style><text x="95" y="18">Visio export</text><text x="240" y="18">generated runtime</text><text x="385" y="18">50% overlay</text>${rows}</svg>\n`;
}

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const review = JSON.parse(await readFile(reviewPath, "utf8"));
const masters = new Map(
  evidence.masters.map((master) => [master.nameU, master]),
);
const references = new Map();

for (const config of configs) {
  const source = await readFile(
    resolve(referenceRoot, config.reference),
    "utf8",
  );
  const viewBoxMatch = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/u);
  const groupTranslateMatch = source.match(
    /<g id="group1-1" transform="translate\(([-\d.]+),([-\d.]+)\)"/u,
  );
  if (!viewBoxMatch || !groupTranslateMatch) {
    fail(
      `missing reference viewport or group transform for ${config.masterNameU}`,
    );
  }
  const master = masters.get(config.masterNameU);
  if (!master) fail(`missing evidence master ${config.masterNameU}`);
  const frame = masterFrame(master);
  const viewport = {
    width: Number(viewBoxMatch[1]),
    height: Number(viewBoxMatch[2]),
  };
  const group = {
    x: Number(groupTranslateMatch[1]),
    y: Number(groupTranslateMatch[2]),
  };
  const origin = config.referenceOrigin ?? { x: 0, y: 0 };
  references.set(config.symbolId, {
    source,
    dataHref: `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`,
    viewBox: viewport,
    frame,
    marker: source.includes("v:arrowType=")
      ? markerFromReference(source, config.masterNameU)
      : undefined,
    sourceCenter: {
      x: group.x + frame.center.x - origin.x,
      y: viewport.height + group.y - frame.center.y + origin.y,
    },
  });
}

const generated = new Map();
for (const config of configs) {
  const master = masters.get(config.masterNameU);
  const mapping = reviewMapping(review, config);
  if (!master || !mapping || mapping.masterNameU !== config.masterNameU) {
    fail(`missing reviewed mapping for ${config.symbolId}`);
  }
  if (mapping.pins.join("\0") !== config.pins.map((pin) => pin[0]).join("\0")) {
    fail(
      `pin order config disagrees with review manifest for ${config.symbolId}`,
    );
  }
  const reference = references.get(config.symbolId);
  const frame = reference.frame;
  const shapes = sourceShapes(master).sort((left, right) => left.id - right.id);
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));
  const rawPinPoints = new Map(
    config.pins.map(([name, , , shapeId, endpoint]) => {
      const shape = shapesById.get(shapeId);
      if (!shape) fail(`${config.masterNameU} is missing pin Shape ${shapeId}`);
      const segments = sectionSegments(shape, frame).flat();
      if (segments.length !== 1) {
        fail(`${config.masterNameU}/${shapeId} is not one visible line`);
      }
      return [name, segments[0][endpoint === "start" ? "from" : "to"]];
    }),
  );
  const vertical = config.pins.find((pin) =>
    ["north", "south"].includes(pin[2]),
  );
  const horizontal = config.pins.find((pin) =>
    ["east", "west"].includes(pin[2]),
  );
  const masterDelta = {
    x: vertical
      ? snap(rawPinPoints.get(vertical[0]).x) - rawPinPoints.get(vertical[0]).x
      : 0,
    y: horizontal
      ? snap(rawPinPoints.get(horizontal[0]).y) -
        rawPinPoints.get(horizontal[0]).y
      : 0,
  };
  const pins = config.pins.map(([name, role, direction]) => ({
    name,
    role,
    at: pinAnchor(applyDelta(rawPinPoints.get(name), masterDelta)),
    direction,
    presentation: { visibility: "visible", leadLength: 10 },
  }));
  const pinEndpoints = new Map(
    config.pins.map(([name, , , shapeId, endpoint]) => [
      shapeId,
      { endpoint, at: pins.find((pin) => pin.name === name).at },
    ]),
  );
  const primitives = [];
  const primitivePoints = [];
  const calibratedPoint = (point) => {
    if (!config.leadAxisScale) return point;
    if (pins.some((pin) => samePoint(point, pin.at))) return point;
    const anchor = pins[0]?.at;
    if (!anchor) fail(`${config.symbolId} needs a pin for lead calibration`);
    return roundedPoint({
      x: point.x,
      y: anchor.y + (point.y - anchor.y) * config.leadAxisScale,
    });
  };
  const calibratePrimitive = (primitive) => {
    if (!config.leadAxisScale) return primitive;
    if (primitive.kind === "line") {
      return {
        ...primitive,
        from: calibratedPoint(primitive.from),
        to: calibratedPoint(primitive.to),
      };
    }
    if (primitive.kind === "polygon" || primitive.kind === "polyline") {
      return {
        ...primitive,
        points: primitive.points.map(calibratedPoint),
      };
    }
    fail(
      `${config.symbolId} lead calibration does not support ${primitive.kind}`,
    );
  };
  const pushPrimitive = (primitive, points) => {
    primitives.push(calibratePrimitive(primitive));
    primitivePoints.push(...points.map(calibratedPoint));
  };

  for (const shape of shapes) {
    const visibleSections =
      rawNumber(shape.line.LinePattern) === 0
        ? []
        : shape.geometry.filter(sectionIsVisible);
    if (visibleSections.length === 0) continue;
    const style = shapeStrokeStyle(shape);
    const pinEndpoint = pinEndpoints.get(shape.id);
    const beginArrow = rawNumber(shape.line.BeginArrow);
    const endArrow = rawNumber(shape.line.EndArrow);
    const hasArrow = beginArrow !== 0 || endArrow !== 0;
    for (const section of visibleSections) {
      const rows = section.rows.filter((row) => row.kind !== "component");
      const ellipse = rows.find((row) => row.kind === "ellipse");
      if (ellipse) {
        if (rows.length !== 1) fail(`${shape.nameU} ellipse has extra rows`);
        const center = centeredPoint(
          frame,
          transformLocalPoint(shape, {
            x: number(ellipse.cells.x, `${shape.nameU}.ellipse.x`),
            y: number(ellipse.cells.y, `${shape.nameU}.ellipse.y`),
          }),
        );
        const axisX = centeredPoint(
          frame,
          transformLocalPoint(shape, {
            x: number(ellipse.cells.a, `${shape.nameU}.ellipse.a`),
            y: number(ellipse.cells.b, `${shape.nameU}.ellipse.b`),
          }),
        );
        const axisY = centeredPoint(
          frame,
          transformLocalPoint(shape, {
            x: number(ellipse.cells.c, `${shape.nameU}.ellipse.c`),
            y: number(ellipse.cells.d, `${shape.nameU}.ellipse.d`),
          }),
        );
        const radiusX = Math.hypot(axisX.x - center.x, axisX.y - center.y);
        const radiusY = Math.hypot(axisY.x - center.x, axisY.y - center.y);
        if (Math.abs(radiusX - radiusY) > 1e-3) {
          fail(`${shape.nameU} uses an unsupported non-circular ellipse`);
        }
        const adjustedCenter = applyDelta(center, masterDelta);
        const radius = rounded((radiusX + radiusY) / 2);
        pushPrimitive(
          {
            kind: "circle",
            center: adjustedCenter,
            radius,
            ...(config.circlePresentation ?? {}),
            style,
          },
          [
            { x: adjustedCenter.x - radius, y: adjustedCenter.y - radius },
            { x: adjustedCenter.x + radius, y: adjustedCenter.y + radius },
          ],
        );
        continue;
      }
      let current;
      let commands = [];
      let pathPoints = [];
      const flushPath = () => {
        if (commands.length === 0) return;
        if (
          commands.length === 2 &&
          commands[0][0] === "M" &&
          commands[1][0] === "L"
        ) {
          const [from, to] = pathPoints;
          const segment = { from, to };
          if (hasArrow) {
            if (!reference.marker) fail(`${shape.nameU} lacks arrow reference`);
            const arrows = arrowPrimitives(
              shape,
              segment,
              style,
              reference.marker,
            );
            pushPrimitive(arrows[0], [arrows[0].from, arrows[0].to]);
            pushPrimitive(arrows[1], arrows[1].points);
          } else {
            pushPrimitive({ kind: "line", ...segment, style }, [from, to]);
          }
        } else {
          if (hasArrow) fail(`${shape.nameU} arrow geometry is not one line`);
          const closed = samePoint(pathPoints[0], pathPoints.at(-1));
          const data = `${commands.map((command) => `${command[0]} ${command[1].x} ${command[1].y}`).join(" ")}${closed ? " Z" : ""}`;
          pushPrimitive({ kind: "path", data, style }, pathPoints);
        }
        commands = [];
        pathPoints = [];
      };
      for (const row of rows) {
        if (row.kind === "moveTo") {
          flushPath();
          current = localPoint(row, shape.nameU);
          const point = applyDelta(
            centeredPoint(frame, transformLocalPoint(shape, current)),
            masterDelta,
          );
          commands.push(["M", point]);
          pathPoints.push(point);
        } else if (row.kind === "lineTo" || row.kind === "ellipticalArcTo") {
          if (!current) fail(`${shape.nameU} ${row.kind} has no moveTo`);
          const localPoints =
            row.kind === "lineTo"
              ? [localPoint(row, shape.nameU)]
              : ellipticalArcPoints(current, row, shape.nameU);
          for (const nextLocal of localPoints) {
            let point = applyDelta(
              centeredPoint(frame, transformLocalPoint(shape, nextLocal)),
              masterDelta,
            );
            if (
              pinEndpoint &&
              row.kind === "lineTo" &&
              localPoints.length === 1 &&
              pinEndpoint.endpoint === "end"
            ) {
              point = pinEndpoint.at;
            }
            commands.push(["L", point]);
            pathPoints.push(point);
          }
          current = localPoint(row, shape.nameU);
        } else {
          fail(`${shape.nameU} uses unsupported ${row.kind}`);
        }
      }
      if (
        pinEndpoint &&
        pinEndpoint.endpoint === "start" &&
        pathPoints.length > 0
      ) {
        pathPoints[0] = pinEndpoint.at;
        commands[0][1] = pinEndpoint.at;
      }
      flushPath();
    }
  }

  const presented = presentIndependentSource(config, pins, primitives);
  primitives.splice(0, primitives.length, ...presented.primitives);
  primitivePoints.push(...presented.extraPoints);

  const symbol = {
    schemaVersion: 1,
    id: config.symbolId,
    name: config.name,
    viewBox: { x: 0, y: 0, width: 1, height: 1 },
    pins,
    primitives,
    variants: [],
    aliases: config.aliases,
    ...(config.labelVisibility
      ? { labelVisibility: config.labelVisibility }
      : {}),
  };
  symbol.viewBox = viewBoxFor(symbol, primitivePoints);
  generated.set(config.symbolId, { symbol, masterDelta });
}

const assetSources = new Map();
for (const { symbol } of generated.values()) {
  const source = await format(JSON.stringify(symbol, null, 2), {
    parser: "json",
  });
  assetSources.set(symbol.id, normalize(source));
  const target = resolve(assetRoot, `${symbol.id}.symbol.json`);
  if (!target.startsWith(`${assetRoot}${sep}`))
    fail(`invalid output path ${target}`);
  if (check) {
    const existing = await readFile(target, "utf8");
    if (existing.replaceAll("\r\n", "\n") !== source) {
      fail(`${relative(root, target)} is stale`);
    }
  } else {
    await writeFile(target, source, "utf8");
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const entriesById = new Map(
  catalog.entries.map((entry) => [entry.symbolId, entry]),
);
for (const config of configs) {
  const entry = entriesById.get(config.symbolId);
  const source = assetSources.get(config.symbolId);
  if (!entry || !source) fail(`missing catalog entry for ${config.symbolId}`);
  if (entry.source.masterNameU !== config.masterNameU) {
    fail(`catalog Master mismatch for ${config.symbolId}`);
  }
  entry.assetHash = hash(source);
  entry.generation = {
    kind: "vss-master-ir",
    evidencePath:
      "fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json",
    referencePath: `fixtures/visual-reference/visio-core-analog/${config.reference}`,
    converterPath: "scripts/generate-visio-core-analog-assets.mjs",
    converterVersion: 1,
  };
}
const catalogSource = normalize(
  await format(JSON.stringify(catalog, null, 2), { parser: "json" }),
);
if (check) {
  const existing = normalize(await readFile(catalogPath, "utf8"));
  if (existing !== catalogSource) {
    fail(`${relative(root, catalogPath)} is stale`);
  }
} else {
  await writeFile(catalogPath, catalogSource, "utf8");
}

const comparison = await format(comparisonSvg(generated, references), {
  parser: "html",
});
if (check) {
  const existing = await readFile(comparisonPath, "utf8");
  if (existing.replaceAll("\r\n", "\n") !== comparison) {
    fail(`${relative(root, comparisonPath)} is stale`);
  }
  console.log(
    "Validated 8 Visio-derived core-analog assets and fidelity board",
  );
} else {
  await writeFile(comparisonPath, comparison, "utf8");
  console.log(
    "Generated 8 Visio-derived core-analog assets and fidelity board",
  );
}

await execFileAsync(
  process.execPath,
  [catalogGeneratorPath, ...(check ? ["--check"] : [])],
  { cwd: root },
);
