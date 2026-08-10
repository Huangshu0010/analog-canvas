#!/usr/bin/env python3
"""Extract and normalize the remaining common Razavi symbol families.

This tool is deliberately separate from the raster fidelity harness. It pins
the textbook PDF, fingerprints native vector objects in a tight source region,
and emits one normalized SymbolDefinition plus an isolated raster witness per
asset. Electrical pin extensions that are not present in the source figure are
recorded as semantic normalization rather than presented as extracted art.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import pdfplumber
from PIL import Image
from reportlab.pdfgen import canvas


EXPECTED_PDF_SHA256 = "a6031d1149c2c6191a1f0e541065165b72dafc4bc4ab4b0ea37af41b7cb0f739"
TITLE = "Design of Analog CMOS Integrated Circuits, Second Edition"
RASTER_DPI = 300.0
PIXELS_PER_LOGICAL = 2.4

NORMAL = {"strokeRole": "normal", "lineCap": "butt", "lineJoin": "miter"}
EMPHASIS = {"strokeRole": "emphasis", "lineCap": "butt", "lineJoin": "miter"}


def pin(name: str, role: str, x: int, y: int, direction: str, lead: int = 10) -> dict[str, Any]:
    return {
        "name": name,
        "role": role,
        "at": {"x": x, "y": y},
        "direction": direction,
        "presentation": {"visibility": "visible", "leadLength": lead},
    }


def line(x1: float, y1: float, x2: float, y2: float, style: dict[str, Any] = NORMAL) -> dict[str, Any]:
    return {"kind": "line", "from": {"x": x1, "y": y1}, "to": {"x": x2, "y": y2}, "style": style}


def circle(x: float, y: float, radius: float, fill: str = "none") -> dict[str, Any]:
    return {"kind": "circle", "center": {"x": x, "y": y}, "radius": radius, "fill": fill, "stroke": "foreground", "style": NORMAL}


def polygon(points: list[tuple[float, float]]) -> dict[str, Any]:
    return {"kind": "polygon", "points": [{"x": x, "y": y} for x, y in points], "fill": "foreground", "stroke": "none"}


def outline_polygon(points: list[tuple[float, float]], style: dict[str, Any] = NORMAL) -> dict[str, Any]:
    return {"kind": "polygon", "points": [{"x": x, "y": y} for x, y in points], "fill": "none", "stroke": "foreground", "style": style}


def symbol(symbol_id: str, name: str, view_box: tuple[float, float, float, float], pins: list[dict[str, Any]], primitives: list[dict[str, Any]], aliases: list[str]) -> dict[str, Any]:
    x, y, width, height = view_box
    return {
        "schemaVersion": 1,
        "id": symbol_id,
        "name": name,
        "viewBox": {"x": x, "y": y, "width": width, "height": height},
        "pins": pins,
        "primitives": primitives,
        "variants": [],
        "aliases": aliases,
    }


def npn_bjt() -> dict[str, Any]:
    # Figure 12.6 Q1, normalized from its native PDF objects around
    # (216.54, 233.936).  The filled arrow is deliberately emitted after the
    # emitter branch so it masks the centerline exactly as in the source.
    primitives = [
        line(-30, 0, -13.42, 0),
        line(-13.42, -9.96, -13.42, 9.96, EMPHASIS),
        line(-13.42, -4.47, 0, -10.06),
        line(0, -10.06, 0, -30),
        line(-13.42, 4.47, 0, 10.06),
        line(0, 10.06, 0, 30),
        polygon([(-4.47, 5.59), (-6.71, 10.06), (0, 10.06)]),
    ]
    return symbol(
        "npn",
        "NPN Bipolar Transistor",
        (-34, -34, 42, 68),
        [pin("C", "collector", 0, -30, "north"), pin("B", "base", -30, 0, "west", 20), pin("E", "emitter", 0, 30, "south")],
        primitives,
        ["bjt-npn", "bipolar-npn"],
    )


def pnp_bjt() -> dict[str, Any]:
    # Figure 12.11 Q1, normalized from its own native PDF objects around
    # (198.383, 592.511).  Unlike the NPN, the directly observed emitter and
    # its inward arrow are on the upper branch.
    primitives = [
        line(-30, 0, -13.42, 0),
        line(-13.42, -9.96, -13.42, 9.96, EMPHASIS),
        line(-13.42, -4.47, 0, -10.06),
        line(0, -10.06, 0, -30),
        line(-13.42, 4.47, 0, 10.06),
        line(0, 10.06, 0, 30),
        polygon([(-7.69, -9.51), (-5.45, -5.03), (-12.16, -5.03)]),
    ]
    return symbol(
        "pnp",
        "PNP Bipolar Transistor",
        (-34, -34, 42, 68),
        [pin("C", "collector", 0, 30, "south"), pin("B", "base", -30, 0, "west", 20), pin("E", "emitter", 0, -30, "north")],
        primitives,
        ["bjt-pnp", "bipolar-pnp"],
    )


SPECS: dict[str, dict[str, Any]] = {
    "pnp": {
        "pdfPage": 537, "printedPage": 518, "figure": "12.11",
        "crop": (178.0, 578.0, 202.0, 607.0), "method": "direct-device-vector-normalization",
        "definition": pnp_bjt(),
    },
    "npn": {
        "pdfPage": 533, "printedPage": 514, "figure": "12.6",
        "crop": (198.0, 220.0, 222.0, 250.0), "method": "direct-device-vector-normalization",
        "definition": npn_bjt(),
    },
    "vccs": {
        "pdfPage": 51, "printedPage": 32, "figure": "2.37",
        "crop": (155.0, 30.0, 315.0, 105.0), "method": "direct-plus-explicit-control-terminals",
        "definition": symbol(
            "vccs", "Voltage-Controlled Current Source", (-34, -34, 64, 68),
            [pin("OUT+", "output-positive", 20, -30, "north"), pin("OUT-", "output-negative", 20, 30, "south"), pin("CTRL+", "control-positive", -30, -10, "west", 20), pin("CTRL-", "control-negative", -30, 10, "west", 20)],
            [line(20, -30, 20, -12), circle(20, 0, 12), line(20, 12, 20, 30), line(-30, -10, -12, -10), line(-30, 10, -12, 10), line(-9, -13, -9, -7), line(-12, -10, -6, -10), line(-12, 10, -6, 10), line(20, -7.4, 20, -1.4), polygon([(20, 7.6), (15.5, -1.4), (24.5, -1.4)])],
            ["dependent-current-source", "transconductance-source"],
        ),
        "derivation": "Figure 2.37 directly supplies the dependent-current-source circle and arrow. OUT+/OUT- and CTRL+/CTRL- are explicit 10-unit-grid electrical extensions of the labeled D/S and VGS terminals required by the four-node SPICE G contract.",
    },
    "diode": {
        "pdfPage": 661, "printedPage": 642, "figure": "15.54",
        "crop": (180.0, 95.0, 455.0, 125.0), "method": "direct-family-observation",
        "definition": symbol(
            "diode", "Diode", (-34, -14, 68, 28),
            [pin("A", "anode", -30, 0, "west", 15), pin("K", "cathode", 30, 0, "east", 15)],
            [line(-30, 0, -10, 0), outline_polygon([(-10, -8.1), (-10, 8.1), (7, 0)]), line(8, -8.8, 8, 8.8, EMPHASIS), line(8, 0, 30, 0)],
            ["pn-diode", "rectifier-diode"],
        ),
    },
    "voltage-amplifier": {
        "pdfPage": 307, "printedPage": 288, "figure": "8.24",
        "crop": (220.0, 25.0, 390.0, 95.0), "method": "direct-family-observation",
        "definition": symbol(
            "voltage-amplifier", "Voltage Amplifier", (-44, -28, 88, 56),
            [pin("IN", "input", -40, 0, "west", 20), pin("OUT", "output", 40, 0, "east", 20)],
            [line(-40, 0, -22, 0), {"kind": "path", "data": "M -22 -24 L -22 24 L 22 0 Z", "style": EMPHASIS}, line(22, 0, 40, 0)],
            ["gain-block", "voltage-gain", "a0"],
        ),
    },
    "ideal-switch": {
        "pdfPage": 560, "printedPage": 541, "figure": "13.4",
        "crop": (225.0, 420.0, 280.0, 455.0), "method": "direct-family-observation",
        "definition": symbol(
            "ideal-switch", "Ideal Switch", (-34, -18, 68, 36),
            [pin("1", "passive", -30, 0, "west", 15), pin("2", "passive", 30, 0, "east", 15)],
            [line(-30, 0, -11, 0), circle(-9, 0, 2), circle(9, 0, 2), line(11, 0, 30, 0), line(-7.5, -1.5, 7.5, -12, EMPHASIS)],
            ["switch-open", "two-terminal-switch"],
        ),
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rounded(value: float) -> float:
    return round(float(value), 6)


def object_fingerprint(obj: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {"objectType": obj.get("object_type"), "linewidth": rounded(obj.get("linewidth", 0) or 0)}
    for key in ("x0", "top", "x1", "bottom"):
        if key in obj:
            result[key] = rounded(obj[key])
    path = obj.get("path")
    if path:
        result["path"] = path
    return result


def compact_fingerprint(value: dict[str, Any]) -> dict[str, Any]:
    result = {key: item for key, item in value.items() if key != "path"}
    if "path" in value:
        encoded = json.dumps(value["path"], sort_keys=True, separators=(",", ":"), default=str).encode()
        result["pathCommandCount"] = len(value["path"])
        result["pathSha256"] = hashlib.sha256(encoded).hexdigest()
    return result


def overlaps(obj: dict[str, Any], crop: tuple[float, float, float, float]) -> bool:
    left, top, right, bottom = crop
    return not (float(obj.get("x1", -math.inf)) < left or float(obj.get("x0", math.inf)) > right or float(obj.get("bottom", -math.inf)) < top or float(obj.get("top", math.inf)) > bottom)


def render_witness(definition: dict[str, Any], output: Path, pdftoppm: str) -> dict[str, Any]:
    view = definition["viewBox"]
    width_pt = view["width"] * 72 / RASTER_DPI * PIXELS_PER_LOGICAL
    height_pt = view["height"] * 72 / RASTER_DPI * PIXELS_PER_LOGICAL
    scale = width_pt / view["width"]
    with tempfile.TemporaryDirectory(prefix="razavi-common-") as temp_dir:
        vector_path = Path(temp_dir) / "symbol.pdf"
        drawing = canvas.Canvas(str(vector_path), pagesize=(width_pt, height_pt), pageCompression=0)
        drawing.setStrokeColorRGB(0, 0, 0)
        drawing.setFillColorRGB(0, 0, 0)

        def xy(point_value: dict[str, float]) -> tuple[float, float]:
            return ((point_value["x"] - view["x"]) * scale, height_pt - (point_value["y"] - view["y"]) * scale)

        for primitive in definition["primitives"]:
            role = primitive.get("style", {}).get("strokeRole", "normal")
            drawing.setLineWidth((1.35 if role == "emphasis" else 0.9) * scale)
            drawing.setLineCap(1 if primitive.get("style", {}).get("lineCap") == "round" else 0)
            drawing.setLineJoin(1 if primitive.get("style", {}).get("lineJoin") == "round" else 0)
            kind = primitive["kind"]
            if kind == "line":
                start, end = xy(primitive["from"]), xy(primitive["to"])
                drawing.line(start[0], start[1], end[0], end[1])
            elif kind == "circle":
                center = xy(primitive["center"])
                drawing.circle(center[0], center[1], primitive["radius"] * scale, stroke=primitive.get("stroke") != "none", fill=primitive.get("fill") == "foreground")
            elif kind == "polygon":
                path = drawing.beginPath()
                points = primitive["points"]
                path.moveTo(*xy(points[0]))
                for value in points[1:]:
                    path.lineTo(*xy(value))
                path.close()
                drawing.drawPath(path, stroke=primitive.get("stroke") == "foreground", fill=primitive.get("fill") == "foreground")
            elif kind == "path":
                # The normalized paths use only M/L/C/Z tokens.
                tokens = primitive["data"].split()
                path = drawing.beginPath()
                index = 0
                while index < len(tokens):
                    command = tokens[index]
                    index += 1
                    if command == "M" or command == "L":
                        point_value = {"x": float(tokens[index]), "y": float(tokens[index + 1])}
                        index += 2
                        (path.moveTo if command == "M" else path.lineTo)(*xy(point_value))
                    elif command == "C":
                        values = [float(value) for value in tokens[index:index + 6]]
                        index += 6
                        p1, p2, p3 = xy({"x": values[0], "y": values[1]}), xy({"x": values[2], "y": values[3]}), xy({"x": values[4], "y": values[5]})
                        path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                    elif command == "Z":
                        path.close()
                    else:
                        raise RuntimeError(f"Unsupported path token {command}")
                drawing.drawPath(path, stroke=1, fill=0)
        drawing.showPage()
        drawing.save()

        raster_base = Path(temp_dir) / "symbol"
        executable = shutil.which(pdftoppm) or pdftoppm
        subprocess.run([executable, "-f", "1", "-l", "1", "-r", f"{RASTER_DPI:g}", "-png", "-singlefile", str(vector_path), str(raster_base)], check=True, capture_output=True)
        rendered = raster_base.with_suffix(".png")
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(rendered) as image:
            rgba = image.convert("RGBA")
            rgba.save(output, format="PNG", optimize=False)
            pixels = {"width": rgba.width, "height": rgba.height}
    origin = {"x": rounded(-view["x"] * PIXELS_PER_LOGICAL), "y": rounded(-view["y"] * PIXELS_PER_LOGICAL)}
    return {"kind": "isolated-normalized-pdf-family", "dpi": RASTER_DPI, "pixels": pixels, "pixelsPerLogical": PIXELS_PER_LOGICAL, "originPx": origin, "assetPath": output.name, "threshold": 160}


def extract_one(pdf_path: Path, output_root: Path, asset_id: str, pdftoppm: str, source_hash: str, pdf: Any) -> None:
    spec = SPECS[asset_id]
    page = pdf.pages[spec["pdfPage"] - 1]
    objects = [*page.lines, *page.curves, *page.rects]
    selected = [object_fingerprint(obj) for obj in objects if overlaps(obj, spec["crop"])]
    if not selected:
        raise RuntimeError(f"Razavi common extraction: no native vector objects found for {asset_id}")
    selected_hash = hashlib.sha256(json.dumps(selected, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    png_path = output_root / f"{asset_id}-reference.png"
    raster = render_witness(spec["definition"], png_path, pdftoppm)
    evidence = {
        "schemaVersion": 1,
        "id": f"razavi-textbook-{asset_id}",
        "kind": "pdf-vector-extract",
        "source": {"title": TITLE, "sha256": source_hash, "pdfPage": spec["pdfPage"], "printedPage": spec["printedPage"], "figure": spec["figure"]},
        "selection": {"method": spec["method"], "boundsPdf": {"left": spec["crop"][0], "top": spec["crop"][1], "right": spec["crop"][2], "bottom": spec["crop"][3]}, "nativeObjectCount": len(selected), "nativeObjectSha256": selected_hash, "nativeObjectSample": [compact_fingerprint(value) for value in selected[:12]]},
        "normalization": {"pinAnchorsLogical": [{"name": value["name"], **value["at"]} for value in spec["definition"]["pins"]], "strokeMapping": {"normal": {"targetRole": "normal"}, "emphasis": {"targetRole": "emphasis"}}, "symbolDefinition": spec["definition"]},
        "rasterWitness": raster,
    }
    if "derivation" in spec:
        evidence["derivation"] = spec["derivation"]
    json_path = output_root / f"{asset_id}-vector-source.json"
    json_path.write_text(
        json.dumps(evidence, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_geometry_registry(output_root: Path) -> None:
    symbols: dict[str, Any] = {}
    for asset_id in SPECS:
        evidence = json.loads((output_root / f"{asset_id}-vector-source.json").read_text(encoding="utf-8"))
        witness = evidence["rasterWitness"]
        symbols[asset_id] = {
            "assetPath": witness["assetPath"],
            "pixelsPerLogical": witness["pixelsPerLogical"],
            "originPx": witness["originPx"],
            "window": {
                "width": witness["pixels"]["width"],
                "height": witness["pixels"]["height"],
                "minX": SPECS[asset_id]["definition"]["viewBox"]["x"],
                "minY": SPECS[asset_id]["definition"]["viewBox"]["y"],
            },
        }
    registry = {"schemaVersion": 1, "referenceId": "razavi-reference-v1", "symbols": symbols}
    (output_root / "common-symbol-geometry.json").write_text(
        json.dumps(registry, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--output-root", required=True, type=Path)
    parser.add_argument("--asset", choices=[*SPECS, "all"], default="all")
    parser.add_argument("--pdftoppm", default="pdftoppm")
    args = parser.parse_args()
    pdf_path = args.pdf.resolve()
    source_hash = sha256(pdf_path)
    if source_hash != EXPECTED_PDF_SHA256:
        raise RuntimeError(f"Razavi common extraction: source PDF SHA-256 mismatch: {source_hash}")
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    assets = SPECS.keys() if args.asset == "all" else [args.asset]
    with pdfplumber.open(pdf_path) as pdf:
        for asset_id in assets:
            extract_one(pdf_path, output_root, asset_id, args.pdftoppm, source_hash, pdf)
            print(f"Extracted razavi-textbook-{asset_id}")
    if args.asset == "all":
        write_geometry_registry(output_root)


if __name__ == "__main__":
    main()
