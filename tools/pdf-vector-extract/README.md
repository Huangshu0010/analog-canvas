# PDF vector extraction

This directory contains source-PDF extraction tools. It is deliberately
separate from `scripts/razavi-fidelity-diff.mjs` and `scripts/lib/`, which own
the raster comparison workflow.

The family extractors currently cover:

- `extract-razavi-inductor.py`: continuous inductor path from Figure 15.21;
- `extract-razavi-opamp.py`: triangle, three leads, and polarity marks from
  Figure 8.26.

Each extractor writes:

- a normalized, provenance-bearing vector evidence JSON; and
- a small PDF-rendered PNG witness used by the existing raster diff harness.

The source PDF is not copied into the repository. Its SHA-256, PDF page,
printed page, figure, and selected path fingerprint are recorded in the JSON.
The authority manifest separately pins both generated files.

Example (PowerShell):

```powershell
$python = "C:\Users\90590\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $python tools/pdf-vector-extract/extract-razavi-inductor.py `
  --pdf "C:\Users\90590\Desktop\[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf" `
  --output-json fixtures/visual-reference/razavi-reference-v1/inductor-vector-source.json `
  --output-png fixtures/visual-reference/razavi-reference-v1/inductor-reference.png
```

The extractor depends on `pdfplumber`, Pillow, and Poppler's `pdftoppm`. It
does not import or modify the raster fidelity implementation.
