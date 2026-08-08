import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = resolve(root, "packages/symbols/assets/razavi-v1");
const evidencePath = resolve(
  root,
  "fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json",
);
const reviewPath = resolve(root, "fixtures/symbols/circuit-vss-review.json");
const referenceRoot = resolve(root, "fixtures/visual-reference/visio-mos");
const comparisonPath = resolve(
  root,
  "fixtures/visual-golden/visio-mos-fidelity.svg",
);
const check = process.argv.includes("--check");

const POINTS_PER_INCH = 72;
const CONNECTION_GRID = 10;
const EPSILON = 1e-6;
const GATE_BAR_THICKNESS = 3.24;
const MOS_SOURCE_ARROW_LENGTH_SCALE = 0.8;
const MOS_SOURCE_ARROW_HALF_WIDTH_SCALE = 1.65;
const MOS_SOURCE_ARROW_HOST_OVERLAP_IN_STROKES = 0.5;

const configs = [
  {
    symbolId: "nmos",
    name: "NMOS",
    masterNameU: "NMOS4",
    reference: "nmos4.svg",
    aliases: ["mos-n"],
    pins: [
      ["D", "drain", "north", 12, "end"],
      ["G", "gate", "west", 11, "end"],
      ["S", "source", "south", 10, "end"],
      ["B", "bulk", "east", 13, "end"],
    ],
    bulkShapeId: 13,
    variantSourceId: "nmos3",
    variantHostShapeId: 7,
    gateBarShapeIds: [8, 9],
    gateAxisScale: 1.15,
    sourceDrainAxisScale: 0.765,
  },
  {
    symbolId: "nmos3",
    name: "NMOS (3-terminal)",
    masterNameU: "Nmos3.a",
    reference: "nmos3-a.svg",
    aliases: ["mos-n-3"],
    pins: [
      ["D", "drain", "north", 11, "end"],
      ["G", "gate", "west", 12, "end"],
      ["S", "source", "south", 6, "end"],
    ],
    gateBarShapeIds: [9, 10],
    gateAxisScale: 1.15,
    sourceDrainAxisScale: 0.765,
  },
  {
    symbolId: "pmos",
    name: "PMOS",
    masterNameU: "PMOS4",
    reference: "pmos4.svg",
    aliases: ["mos-p"],
    pins: [
      ["D", "drain", "north", 12, "end"],
      ["G", "gate", "west", 11, "end"],
      ["S", "source", "south", 10, "end"],
      ["B", "bulk", "east", 13, "end"],
    ],
    bulkShapeId: 13,
    variantSourceId: "pmos3",
    variantHostShapeId: 6,
    gateBarShapeIds: [8, 9],
    gateAxisScale: 1.15,
    sourceDrainAxisScale: 0.765,
    sourceArrowMetricScale: 25 / 22,
  },
  {
    symbolId: "pmos3",
    name: "PMOS (3-terminal)",
    masterNameU: "Pmos3.a",
    reference: "pmos3-a.svg",
    aliases: ["mos-p-3"],
    pins: [
      ["D", "drain", "north", 11, "end"],
      ["G", "gate", "west", 12, "end"],
      ["S", "source", "south", 6, "end"],
    ],
    gateBarShapeIds: [9, 10],
    gateAxisScale: 1.15,
    sourceDrainAxisScale: 0.765,
    sourceArrowMetricScale: 25 / 22,
  },
];

function fail(message) {
  throw new Error(`Visio MOS generation: ${message}`);
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

function centeredPoint(masterShape, parentPoint) {
  const width = number(
    masterShape.transform.Width,
    `${masterShape.nameU}.Width`,
  );
  const height = number(
    masterShape.transform.Height,
    `${masterShape.nameU}.Height`,
  );
  return roundedPoint({
    x: parentPoint.x - width / 2,
    y: height / 2 - parentPoint.y,
  });
}

function sectionSegments(shape, masterShape) {
  const result = [];
  for (const section of shape.geometry) {
    const component = section.rows.find((row) => row.kind === "component");
    if (
      rawNumber(component?.cells?.noShow) !== 0 ||
      rawNumber(component?.cells?.noLine) !== 0
    ) {
      continue;
    }
    let current;
    for (const row of section.rows) {
      if (row.kind === "component") continue;
      if (row.kind !== "moveTo" && row.kind !== "lineTo") {
        fail(
          `${masterShape.nameU}/${shape.nameU} uses unsupported ${row.kind}`,
        );
      }
      const localPoint = {
        x: number(row.cells.x, `${shape.nameU}.${row.kind}.x`),
        y: number(row.cells.y, `${shape.nameU}.${row.kind}.y`),
      };
      const point = centeredPoint(
        masterShape,
        transformLocalPoint(shape, localPoint),
      );
      if (row.kind === "moveTo") {
        current = point;
      } else {
        if (!current)
          fail(`${masterShape.nameU}/${shape.nameU} lineTo has no moveTo`);
        result.push({ from: current, to: point });
        current = point;
      }
    }
  }
  return result;
}

function shapeStrokeStyle(shape) {
  const weight = number(shape.line.LineWeight, `${shape.nameU}.LineWeight`);
  let strokeRole;
  if (Math.abs(weight - 1.2) < EPSILON) strokeRole = "normal";
  else if (Math.abs(weight - 2.16) < EPSILON) strokeRole = "emphasis";
  else fail(`${shape.nameU} has unsupported line weight ${weight}`);
  if (rawNumber(shape.line.LineCap) !== 0) {
    fail(`${shape.nameU} has unsupported Visio line cap`);
  }
  return { strokeRole, lineCap: "round", lineJoin: "round" };
}

function parseMarkerReference(source, masterNameU) {
  const marker = source.match(
    /<marker[^>]*v:arrowType="(\d+)"[^>]*v:arrowSize="(\d+)"[^>]*v:setback="([\d.]+)"\s+refX="(-?[\d.]+)"[^>]*>/u,
  );
  const scale = source.match(
    /<use[^>]*xlink:href="#lend13"[^>]*transform="scale\((-?[\d.]+)(?:,-?[\d.]+)?\)\s*"\/>/u,
  );
  const arrowPath = source.match(
    /<g id="lend13">\s*<path d="([^"]+)" style="stroke:none"\/>/u,
  );
  if (!marker || !scale || !arrowPath) {
    fail(`cannot decode isolated Visio marker for ${masterNameU}`);
  }
  if (Number(marker[1]) !== 13) fail(`${masterNameU} is not Arrow Type 13`);
  if (
    arrowPath[1].replaceAll(/\s+/gu, " ").trim() !== "M 3 1 L 0 0 L 3 -1 L 3 1"
  ) {
    fail(`${masterNameU} Arrow Type 13 path changed`);
  }
  return {
    arrowType: Number(marker[1]),
    arrowSize: Number(marker[2]),
    setback: Number(marker[3]),
    refX: Number(marker[4]),
    scale: Math.abs(Number(scale[1])),
  };
}

function arrowPrimitives(config, shape, segment, style, marker, part) {
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
  // Preserve the decoded direction and electrical anchors. PMOS VSS masters
  // use a 22/25 smaller native marker, so compensate only its arrow metrics
  // to share the NMOS-calibrated Razavi length and width.
  const metricScale = config.sourceArrowMetricScale ?? 1;
  const arrowLength =
    3 *
    marker.scale *
    strokeWidth *
    MOS_SOURCE_ARROW_LENGTH_SCALE *
    metricScale;
  const halfWidth =
    marker.scale *
    strokeWidth *
    MOS_SOURCE_ARROW_HALF_WIDTH_SCALE *
    metricScale;
  const hostOverlap = strokeWidth * MOS_SOURCE_ARROW_HOST_OVERLAP_IN_STROKES;
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
  const usesRazaviSourceArrow = part === "source-arrow";
  const line = {
    kind: "line",
    // Overlap the support conductor under the filled triangle by half a stroke.
    // An exact butt-to-polygon join can leave a one-pixel anti-alias seam even
    // when their logical coordinates agree; the later polygon fully hides the
    // overlap without changing the visible triangle or electrical anchors.
    from: beginArrow
      ? usesRazaviSourceArrow
        ? roundedPoint({
            x: baseCenter.x - direction.x * hostOverlap,
            y: baseCenter.y - direction.y * hostOverlap,
          })
        : roundedPoint({
            x: segment.from.x + direction.x * setback,
            y: segment.from.y + direction.y * setback,
          })
      : segment.from,
    to: endArrow
      ? usesRazaviSourceArrow
        ? roundedPoint({
            x: baseCenter.x + direction.x * hostOverlap,
            y: baseCenter.y + direction.y * hostOverlap,
          })
        : roundedPoint({
            x: segment.to.x - direction.x * setback,
            y: segment.to.y - direction.y * setback,
          })
      : segment.to,
    ...(part ? { part } : {}),
    style: usesRazaviSourceArrow ? { ...style, lineCap: "butt" } : style,
  };
  const polygon = {
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
    ...(part ? { part } : {}),
  };
  return [line, polygon];
}

function snapPoint(point) {
  return {
    x: Math.round(point.x / CONNECTION_GRID) * CONNECTION_GRID,
    y: Math.round(point.y / CONNECTION_GRID) * CONNECTION_GRID,
  };
}

function pinAnchor(point, direction) {
  if (direction === "north" || direction === "south") {
    return { x: point.x, y: snapPoint(point).y };
  }
  return { x: snapPoint(point).x, y: point.y };
}

function translatePrimitive(primitive, delta) {
  const move = (point) =>
    roundedPoint({ x: point.x + delta.x, y: point.y + delta.y });
  switch (primitive.kind) {
    case "line":
      return {
        ...structuredClone(primitive),
        from: move(primitive.from),
        to: move(primitive.to),
      };
    case "polygon":
    case "polyline":
      return {
        ...structuredClone(primitive),
        points: primitive.points.map(move),
      };
    case "circle":
      return { ...structuredClone(primitive), center: move(primitive.center) };
    case "path":
      fail("path translation is not implemented for MOS generation");
  }
}

function scalePrimitiveAlongGateAxis(primitive, pins, scale) {
  if (scale === undefined) return primitive;
  const drain = pins.find((pin) => pin.name === "D");
  if (!drain) fail("gate-axis calibration requires a drain pin");
  const transform = (point) => {
    if (
      pins.some(
        (pin) =>
          Math.abs(pin.at.x - point.x) < EPSILON &&
          Math.abs(pin.at.y - point.y) < EPSILON,
      )
    ) {
      return point;
    }
    return roundedPoint({
      x: drain.at.x + (point.x - drain.at.x) * scale,
      y: point.y,
    });
  };
  switch (primitive.kind) {
    case "line":
      return {
        ...primitive,
        from: transform(primitive.from),
        to: transform(primitive.to),
      };
    case "polygon":
    case "polyline":
      return { ...primitive, points: primitive.points.map(transform) };
    case "circle":
    case "path":
      fail(`gate-axis calibration does not support ${primitive.kind}`);
  }
}

function scalePrimitiveAlongSourceDrainAxis(primitive, pins, scale) {
  if (scale === undefined) return primitive;
  const drain = pins.find((pin) => pin.name === "D");
  const source = pins.find((pin) => pin.name === "S");
  if (!drain || !source) fail("S/D-axis calibration requires D and S pins");
  const centerY = (drain.at.y + source.at.y) / 2;
  const transform = (point) => {
    if (
      pins.some(
        (pin) =>
          Math.abs(pin.at.x - point.x) < EPSILON &&
          Math.abs(pin.at.y - point.y) < EPSILON,
      )
    ) {
      return point;
    }
    return roundedPoint({
      x: point.x,
      y: centerY + (point.y - centerY) * scale,
    });
  };
  switch (primitive.kind) {
    case "line":
      return {
        ...primitive,
        from: transform(primitive.from),
        to: transform(primitive.to),
      };
    case "polygon":
    case "polyline":
      return { ...primitive, points: primitive.points.map(transform) };
    case "circle":
    case "path":
      fail(`S/D-axis calibration does not support ${primitive.kind}`);
  }
}

function gateBarPrimitive(primitive) {
  if (primitive.kind !== "line" || primitive.part !== "gate-bar") {
    return primitive;
  }
  const dx = primitive.to.x - primitive.from.x;
  const dy = primitive.to.y - primitive.from.y;
  const length = Math.hypot(dx, dy);
  if (length < EPSILON) fail("gate-bar conversion requires a non-zero line");
  const halfThickness = GATE_BAR_THICKNESS / 2;
  const normal = {
    x: (-dy / length) * halfThickness,
    y: (dx / length) * halfThickness,
  };
  return {
    kind: "polygon",
    points: [
      { x: primitive.from.x + normal.x, y: primitive.from.y + normal.y },
      { x: primitive.to.x + normal.x, y: primitive.to.y + normal.y },
      { x: primitive.to.x - normal.x, y: primitive.to.y - normal.y },
      { x: primitive.from.x - normal.x, y: primitive.from.y - normal.y },
    ].map(roundedPoint),
    fill: "foreground",
    stroke: "none",
    part: "gate-bar",
  };
}

function primitivePoints(primitive) {
  switch (primitive.kind) {
    case "line":
      return [primitive.from, primitive.to];
    case "polygon":
    case "polyline":
      return primitive.points;
    case "circle":
      return [
        {
          x: primitive.center.x - primitive.radius,
          y: primitive.center.y - primitive.radius,
        },
        {
          x: primitive.center.x + primitive.radius,
          y: primitive.center.y + primitive.radius,
        },
      ];
    case "path":
      fail("path bounds are not implemented for MOS generation");
  }
}

function viewBoxFor(symbol) {
  const points = [
    ...symbol.pins.map((pin) => pin.at),
    ...symbol.primitives.flatMap(primitivePoints),
    ...symbol.variants.flatMap((variant) =>
      (variant.additionalPrimitives ?? []).flatMap(primitivePoints),
    ),
  ];
  const minX = Math.min(...points.map((point) => point.x)) - 4;
  const minY = Math.min(...points.map((point) => point.y)) - 4;
  const maxX = Math.max(...points.map((point) => point.x)) + 4;
  const maxY = Math.max(...points.map((point) => point.y)) + 4;
  return {
    x: rounded(minX),
    y: rounded(minY),
    width: rounded(maxX - minX),
    height: rounded(maxY - minY),
  };
}

function reviewMapping(review, config) {
  return (
    review.mappings.find((mapping) => mapping.symbolId === config.symbolId) ??
    review.migrationCandidates.find(
      (mapping) => mapping.symbolId === config.symbolId,
    )
  );
}

function expectedPinOrder(mapping) {
  return mapping.pins ?? mapping.provisionalPins;
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
  if (primitive.kind === "polygon") {
    return `<polygon points="${primitive.points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${primitive.fill === "foreground" ? "#000" : "none"}"${primitive.stroke === "none" ? ' stroke="none"' : ""}${styleAttributes}/>`;
  }
  fail(`unexpected MOS comparison primitive ${primitive.kind}`);
}

function comparisonSvg(generated, references) {
  const rowHeight = 115;
  const width = 420;
  const height = configs.length * rowHeight + 35;
  const rows = configs
    .map((config, index) => {
      const generatedSymbol = generated.get(config.symbolId);
      const symbol = generatedSymbol.symbol;
      const reference = references.get(config.symbolId);
      const y = 30 + index * rowHeight;
      const sourceX = 45;
      const runtimeX = 180;
      const overlayX = 315;
      const viewportWidth = reference.viewBox.width;
      const viewportHeight = reference.viewBox.height;
      const runtimeBody = symbol.primitives.map(renderPrimitive).join("");
      const runtimeViewBox = `${generatedSymbol.masterDelta.x - reference.sourceCenter.x} ${generatedSymbol.masterDelta.y - reference.sourceCenter.y} ${viewportWidth} ${viewportHeight}`;
      const runtime = `<svg width="${viewportWidth}" height="${viewportHeight}" viewBox="${runtimeViewBox}" overflow="visible"><g fill="none" stroke="#000">${runtimeBody}</g></svg>`;
      return `<g data-symbol-id="${config.symbolId}"><text x="10" y="${y + 46}">${config.symbolId}</text><image href="${reference.dataHref}" x="${sourceX}" y="${y}" width="${viewportWidth}" height="${viewportHeight}"/><g transform="translate(${runtimeX} ${y})">${runtime}</g><g transform="translate(${overlayX} ${y})" opacity="0.5"><image href="${reference.dataHref}" width="${viewportWidth}" height="${viewportHeight}"/>${runtime}</g></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/><style>text{font:12px Arial,sans-serif;fill:#000}line,polygon{vector-effect:non-scaling-stroke}</style><text x="45" y="18">Visio export</text><text x="180" y="18">generated runtime</text><text x="315" y="18">50% overlay</text>${rows}</svg>\n`;
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
  if (!viewBoxMatch)
    fail(`missing reference viewBox for ${config.masterNameU}`);
  if (!groupTranslateMatch)
    fail(`missing isolated group transform for ${config.masterNameU}`);
  const masterShape = masters.get(config.masterNameU)?.shapes[0];
  if (!masterShape) fail(`missing evidence master for ${config.masterNameU}`);
  const viewportWidth = Number(viewBoxMatch[1]);
  const viewportHeight = Number(viewBoxMatch[2]);
  const groupX = Number(groupTranslateMatch[1]);
  const groupY = Number(groupTranslateMatch[2]);
  references.set(config.symbolId, {
    marker: parseMarkerReference(source, config.masterNameU),
    dataHref: `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`,
    viewBox: {
      width: viewportWidth,
      height: viewportHeight,
    },
    sourceCenter: {
      x: groupX + number(masterShape.transform.Width, "master width") / 2,
      y:
        viewportHeight +
        groupY -
        number(masterShape.transform.Height, "master height") / 2,
    },
  });
}

const generated = new Map();
for (const config of configs) {
  const master = masters.get(config.masterNameU);
  if (!master || master.shapes.length !== 1) {
    fail(`expected one top-level Shape for ${config.masterNameU}`);
  }
  const masterShape = master.shapes[0];
  if (masterShape.kind !== "group")
    fail(`${config.masterNameU} is not a group`);
  const mapping = reviewMapping(review, config);
  if (!mapping || mapping.masterNameU !== config.masterNameU) {
    fail(`missing review mapping for ${config.symbolId}`);
  }
  const pinOrder = expectedPinOrder(mapping);
  if (pinOrder.join("\0") !== config.pins.map((pin) => pin[0]).join("\0")) {
    fail(
      `pin order config disagrees with review manifest for ${config.symbolId}`,
    );
  }

  const shapesById = new Map(
    masterShape.children.map((shape) => [shape.id, shape]),
  );
  const rawPinPoints = new Map(
    config.pins.map(([name, , , shapeId, endpoint]) => {
      const shape = shapesById.get(shapeId);
      if (!shape) fail(`${config.masterNameU} is missing pin Shape ${shapeId}`);
      const segments = sectionSegments(shape, masterShape);
      if (segments.length !== 1)
        fail(`${config.masterNameU}/${shapeId} is not one line`);
      return [name, segments[0][endpoint === "start" ? "from" : "to"]];
    }),
  );
  const verticalReference = config.pins.find((pin) =>
    ["north", "south"].includes(pin[2]),
  );
  const horizontalReference = config.pins.find((pin) =>
    ["east", "west"].includes(pin[2]),
  );
  if (!verticalReference || !horizontalReference) {
    fail(`${config.masterNameU} needs vertical and horizontal pin references`);
  }
  const verticalPoint = rawPinPoints.get(verticalReference[0]);
  const horizontalPoint = rawPinPoints.get(horizontalReference[0]);
  const masterDelta = {
    x: snapPoint(verticalPoint).x - verticalPoint.x,
    y: snapPoint(horizontalPoint).y - horizontalPoint.y,
  };
  const sourcePinPoints = new Map();
  const pins = config.pins.map(([name, role, direction, shapeId, endpoint]) => {
    const sourcePoint = roundedPoint({
      x: rawPinPoints.get(name).x + masterDelta.x,
      y: rawPinPoints.get(name).y + masterDelta.y,
    });
    sourcePinPoints.set(name, sourcePoint);
    return {
      name,
      role,
      at: pinAnchor(sourcePoint, direction),
      direction,
      presentation: { visibility: "visible", leadLength: 10 },
    };
  });
  const pinEndpointByShape = new Map(
    config.pins.map(([name, , , shapeId, endpoint]) => [
      shapeId,
      { endpoint, at: pins.find((pin) => pin.name === name).at },
    ]),
  );

  const primitives = [];
  for (const shape of [...masterShape.children].sort(
    (left, right) => left.id - right.id,
  )) {
    const segments = sectionSegments(shape, masterShape);
    const pinEndpoint = pinEndpointByShape.get(shape.id);
    const beginArrow = rawNumber(shape.line.BeginArrow);
    const endArrow = rawNumber(shape.line.EndArrow);
    const hasArrow = beginArrow !== 0 || endArrow !== 0;
    if (hasArrow && segments.length !== 1) {
      fail(`${config.masterNameU}/${shape.nameU} arrow Shape is not one line`);
    }
    let part;
    if (shape.id === config.bulkShapeId) part = "bulk-lead";
    else if (config.gateBarShapeIds?.includes(shape.id)) part = "gate-bar";
    else if (shape.id === config.variantHostShapeId) part = "source-arrow-host";
    else if (hasArrow) part = "source-arrow";
    const style = shapeStrokeStyle(shape);
    for (const sourceSegment of segments) {
      const segment = {
        from: roundedPoint({
          x: sourceSegment.from.x + masterDelta.x,
          y: sourceSegment.from.y + masterDelta.y,
        }),
        to: roundedPoint({
          x: sourceSegment.to.x + masterDelta.x,
          y: sourceSegment.to.y + masterDelta.y,
        }),
      };
      if (pinEndpoint) {
        segment[pinEndpoint.endpoint === "start" ? "from" : "to"] =
          pinEndpoint.at;
      }
      if (hasArrow) {
        primitives.push(
          ...arrowPrimitives(
            config,
            shape,
            segment,
            style,
            references.get(config.symbolId).marker,
            part,
          ),
        );
      } else {
        primitives.push({
          kind: "line",
          from: segment.from,
          to: segment.to,
          ...(part ? { part } : {}),
          style,
        });
      }
    }
  }

  const calibratedPrimitives = primitives.map((primitive) =>
    gateBarPrimitive(
      scalePrimitiveAlongSourceDrainAxis(
        scalePrimitiveAlongGateAxis(primitive, pins, config.gateAxisScale),
        pins,
        config.sourceDrainAxisScale,
      ),
    ),
  );
  const symbol = {
    schemaVersion: 1,
    id: config.symbolId,
    name: config.name,
    viewBox: { x: 0, y: 0, width: 1, height: 1 },
    pins,
    primitives: calibratedPrimitives,
    variants: [],
    aliases: config.aliases,
  };
  generated.set(config.symbolId, {
    config,
    symbol,
    sourcePinPoints,
    masterDelta,
  });
}

for (const config of configs.filter((candidate) => candidate.variantSourceId)) {
  const canonical = generated.get(config.symbolId);
  const source = generated.get(config.variantSourceId);
  const canonicalGate = canonical.sourcePinPoints.get("G");
  const sourceGate = source.sourcePinPoints.get("G");
  const delta = {
    x: canonicalGate.x - sourceGate.x,
    y: canonicalGate.y - sourceGate.y,
  };
  const additionalPrimitives = source.symbol.primitives
    .filter((primitive) => primitive.part === "source-arrow")
    .map((primitive) => translatePrimitive(primitive, delta));
  if (additionalPrimitives.length !== 2) {
    fail(
      `${config.symbolId} variant source must contain one arrow line and head`,
    );
  }
  canonical.symbol.variants = [
    {
      id: "textbook-3terminal",
      hiddenPinNames: ["B"],
      hiddenPrimitiveParts: ["bulk-lead", "source-arrow-host"],
      additionalPrimitives,
    },
  ];
}

for (const { symbol } of generated.values()) {
  symbol.viewBox = viewBoxFor(symbol);
  const source = await format(JSON.stringify(symbol, null, 2), {
    parser: "json",
  });
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

const comparison = await format(comparisonSvg(generated, references), {
  parser: "html",
});
if (check) {
  const existing = await readFile(comparisonPath, "utf8");
  if (existing.replaceAll("\r\n", "\n") !== comparison) {
    fail(`${relative(root, comparisonPath)} is stale`);
  }
  console.log("Validated 4 Visio-derived MOS assets and fidelity board");
} else {
  await writeFile(comparisonPath, comparison, "utf8");
  console.log("Generated 4 Visio-derived MOS assets and fidelity board");
}
