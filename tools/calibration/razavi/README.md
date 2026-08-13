# Razavi Calibration Tools

These tools support deliberate human review of the accepted Razavi visual
authority. They are not CI gates and never establish electrical correctness.

Build the workspace before running the JavaScript tools:

```powershell
pnpm build
node tools/calibration/razavi/fidelity-diff.mjs [device...] [--out output/calibration/razavi]
node tools/calibration/razavi/text-fidelity-diff.mjs --reference <reference.png>
```

The geometry measurement helper additionally requires Python 3.11+, OpenCV,
and NumPy:

```powershell
python tools/calibration/razavi/measure-reference.py <reference.png>
```

Generated reports belong under `output/calibration/` and remain untracked.
