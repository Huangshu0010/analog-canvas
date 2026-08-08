#!/usr/bin/env python3
"""Measure the accepted six-panel Razavi raster reference.

This is a developer calibration tool, not a runtime dependency. It converts
the reference's anti-aliased ink into a small set of geometry ratios that can
be compared with the Symbol DSL and the Razavi style profile. The coordinate
template is intentionally tied to the reviewed 1204x794 reference image; a
different crop must be aligned explicitly instead of silently producing false
"pixel exact" numbers.

Requires: Python 3.11+, OpenCV, NumPy.
Usage:
  python scripts/measure-razavi-reference.py <reference.png>
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np

EXPECTED_SIZE = (1204, 794)  # width, height
INK_THRESHOLD = 200


def bounds(mask: np.ndarray, left: int, top: int, right: int, bottom: int) -> dict[str, int]:
    """Return the inclusive dark-ink bounds in one known semantic ROI."""
    ys, xs = np.where(mask[top:bottom, left:right])
    if len(xs) == 0:
        raise ValueError(f"no ink in ROI {(left, top, right, bottom)}")
    x0, x1 = left + int(xs.min()), left + int(xs.max())
    y0, y1 = top + int(ys.min()), top + int(ys.max())
    return {
        "left": x0,
        "top": y0,
        "right": x1,
        "bottom": y1,
        "width": x1 - x0 + 1,
        "height": y1 - y0 + 1,
    }


def run_at(mask: np.ndarray, x: int, top: int, bottom: int) -> int:
    """Largest dark run on a vertical cross section, in pixels."""
    values = mask[top:bottom, x]
    runs: list[int] = []
    start: int | None = None
    for index, value in enumerate(values):
        if value and start is None:
            start = index
        elif not value and start is not None:
            runs.append(index - start)
            start = None
    if start is not None:
        runs.append(len(values) - start)
    return max(runs, default=0)


def horizontal_run_at(mask: np.ndarray, y: int, left: int, right: int) -> int:
    """Largest dark run on a horizontal cross section, in pixels."""
    values = mask[y, left:right]
    runs: list[int] = []
    start: int | None = None
    for index, value in enumerate(values):
        if value and start is None:
            start = index
        elif not value and start is not None:
            runs.append(index - start)
            start = None
    if start is not None:
        runs.append(len(values) - start)
    return max(runs, default=0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path)
    args = parser.parse_args()
    raw = args.reference.read_bytes()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise SystemExit(f"cannot decode {args.reference}")
    height, width = image.shape
    if (width, height) != EXPECTED_SIZE:
        raise SystemExit(
            f"reference must be {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]} pixels; got {width}x{height}"
        )
    ink = image < INK_THRESHOLD

    # Panel (a) has the cleanest MOS, VDD, wire, and route-marker examples.
    vdd_bar = {
        "length": horizontal_run_at(ink, 26, 155, 205),
        "thickness": run_at(ink, 165, 20, 36),
    }
    vdd_stem = {
        "length": run_at(ink, 179, 32, 76),
        "thickness": horizontal_run_at(ink, 50, 173, 186),
    }
    mos_gate = {
        "length": run_at(ink, 154, 55, 110),
        "thickness": horizontal_run_at(ink, 80, 151, 162),
    }
    instance_label = bounds(ink, 183, 68, 236, 110)
    power_label = bounds(ink, 202, 4, 275, 44)

    # The triangle shares its tip with the channel. Its base, gate span, and
    # channel endpoint are therefore measured separately, not with a fragile
    # connected-component heuristic.
    mos_arrow_base = bounds(ink, 163, 87, 167, 104)
    mos_arrow_pixels = {"length": 14, "width": mos_arrow_base["height"]}

    # Panel (c) gives an unobscured independent source. The head dimensions
    # include the anti-aliased outer edge used by the SVG rasterizer.
    source_circle = bounds(ink, 790, 94, 837, 141)
    source_head_pixels = {"length": 20, "width": 20}

    # The left-pointing current marker in panel (a) has a 23px tip-to-base
    # span and a 15px base. Gate length supplies the common px/logical scale.
    marker_pixels = {"length": 23, "width": 15}
    gate_length_logical = 24.39567
    px_per_logical = mos_gate["length"] / gate_length_logical
    source_circle_diameter_logical = 2 * 10.629922
    source_px_per_logical = source_circle["width"] / source_circle_diameter_logical

    report = {
        "reference": {
            "path": str(args.reference),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "pixels": {"width": width, "height": height},
            "inkThreshold": INK_THRESHOLD,
        },
        "pixels": {
            "vddBar": vdd_bar,
            "vddStem": vdd_stem,
            "mosGateBar": mos_gate,
            "mosArrow": mos_arrow_pixels,
            "sourceCircle": source_circle,
            "sourceHead": source_head_pixels,
            "routeMarkerHead": marker_pixels,
            "instanceLabel": instance_label,
            "powerLabel": power_label,
            "wireCore": run_at(ink, 120, 75, 91),
        },
        "normalized": {
            "mosPixelsPerLogical": round(px_per_logical, 4),
            "mosArrowLength": round(mos_arrow_pixels["length"] / px_per_logical, 4),
            "mosArrowWidth": round(mos_arrow_pixels["width"] / px_per_logical, 4),
            "sourcePixelsPerLogical": round(source_px_per_logical, 4),
            "sourceHeadLength": round(source_head_pixels["length"] / source_px_per_logical, 4),
            "sourceHeadWidth": round(source_head_pixels["width"] / source_px_per_logical, 4),
            "routeMarkerHeadLength": round(marker_pixels["length"] / px_per_logical, 4),
            "routeMarkerHeadWidth": round(marker_pixels["width"] / px_per_logical, 4),
        },
        "recommendedRuntimeParameters": {
            "mosSourceArrowLengthScale": 0.8,
            "mosSourceArrowHalfWidthScale": 1.65,
            "independentCurrentHeadLengthScale": 1.65,
            "independentCurrentHeadHalfWidthScale": 1.15,
            "routeMarkerHeadLength": 14,
            "routeMarkerHeadWidth": 9,
            "unchanged": [
                "wire/symbol normal stroke ratio",
                "gate-bar emphasis ratio",
                "ground 1:0.5:0.25 bars",
                "port origin dot ratio",
                "Arial bold-italic 16px text with 0.68 subscript scale",
            ],
        },
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
