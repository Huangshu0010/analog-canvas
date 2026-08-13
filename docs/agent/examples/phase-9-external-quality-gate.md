# Optional Phase 9 external Agent quality study

This protocol compares guidance packages; it is not required by the product at
runtime and is no longer a Phase 9 exit gate. The product intentionally does
not bundle an LLM provider, and the authoring Agent cannot independently blind
itself to its own outputs.

Two completed held-out studies preserved electrical correctness but did not
show a stable readability improvement from progressively larger guidance. That
result supports the flat architecture: complete Snapshot facts plus generic
typed edits are the product contract, while Skill and knowledge are optional
reasoning aids. Run this study again only when comparing a materially new Skill,
knowledge set, model, or evaluation method.

## Inputs

Use the same held-out circuit and starting Project for four isolated Agent runs:

| Tier | Injected guidance                                         |
| ---- | --------------------------------------------------------- |
| A    | API schemas only; no `circuit-layout` Skill               |
| B    | thin `circuit-layout` Skill only                          |
| C    | Skill plus the three core knowledge documents             |
| D    | Skill plus core and manifest-selected on-demand knowledge |

The runner must use API v2, keep optional helpers disabled, start every run from
the same revision, and prevent outputs/traces from one tier entering another
tier's context. The held-out circuit must not have been used to author the
knowledge card being evaluated.

## Reproducible evaluation kit

[`external-quality-eval.mjs`](../../../tools/research/phase9/external-quality-eval.mjs)
prepares isolated contexts and validates, anonymizes, and scores the external
results.
Choose a genuinely held-out Project and write one task file, then run:

```powershell
node tools/research/phase9/external-quality-eval.mjs prepare `
  --project path/to/held-out.icproj.json `
  --task path/to/task.md `
  --targeted docs/agent/knowledge/patterns/current-mirror.md,docs/agent/knowledge/human-collaboration.md `
  --out output/phase9-external-eval/run-001
```

Earlier frozen inputs and their results are archived under
[`phase9-research-evidence`](../../archive/phase9-research-evidence/README.md)
and must not be reused as held-out pass/fail fixtures. The generic command above
is retained for genuinely new research inputs.

The output directory must be new; preparation refuses to merge a new trial with
stale results. Its manifest hashes the exact Project, task, tier contexts, and
starting copies.

The kit creates byte-hashed copies of the same starting Project plus a common
hard-contract bundle containing the Agent API/Edit Engine specifications,
generated request schema, and typed-transaction runner instructions. Every tier
receives this identical API material; only the Skill/knowledge guidance differs:

```text
tiers/A/context.md  # task + API-only boundary
tiers/B/context.md  # task + thin Skill
tiers/C/context.md  # task + Skill + core knowledge
tiers/D/context.md  # task + Skill + core + declared targeted pages
```

Each isolated runner writes `final.icproj.json`, refreshed Snapshots for every
Document in `final.snapshots.json`, one formal render per Document plus their
`renders.json` manifest, a combined `final.svg` review sheet, `trace.json`, and
`metrics.json` under its own `tiers/<tier>/result/`, following the generated
`result-contract.json`. All mutation and evidence output goes through
`tools/agent-layout/external-eval-runner.mjs`; the Agent authors typed edits, not
a replacement Project. After all four finish:

```powershell
node tools/research/phase9/external-quality-eval.mjs finalize `
  --root output/phase9-external-eval/run-001
```

Finalization rejects incomplete or modified tier inputs, changed electrical
signatures, changed locked state, mismatched model/settings, v1 query calls,
enabled helpers, invalid or unchanged Document revisions, unplaced objects, a
Snapshot/diagnostic that does not exactly derive from the final Project,
missing/contaminated per-Document renders, validation/lock errors, or a combined
review sheet that omits a Document. It writes anonymous review sheets and
`blind/review-form.json`; only the `blind/` directory is given to the reviewer.
Keep `private/tier-map.json` hidden.

After the reviewer fills every 1–5 score and saves a response:

```powershell
node tools/research/phase9/external-quality-eval.mjs score `
  --root output/phase9-external-eval/run-001 `
  --response output/phase9-external-eval/run-001/blind/review-response.json
```

The deterministic pipeline itself is checked with
`node tools/research/phase9/external-quality-eval.mjs self-test`. The self-test is not a model-quality
result; it proves the kit rejects missing/electrically changed results and can
complete anonymous scoring when valid external evidence exists. A scored run
ends with manifest status `quality-gate-passed` or `quality-gate-failed` and a
hash of `quality-gate-report.json`.

## Recorded metrics

For every tier record:

- model/provider/version and decoding settings;
- input/output/context token counts and elapsed time;
- Snapshot refresh, transaction, dry-run, rejected edit, rollback, and render
  counts;
- electrical topology signature before/after;
- lock/revision/validation failures;
- final diagnostics and unresolved mappings;
- formal SVG/PNG and final refreshed Snapshot hash.

Hard failure is any unintended Net change, model validation error, lock bypass,
silent rejected edit, or missing final refresh. Efficiency cannot compensate for
a hard failure. Runner-only time/token estimates are recorded for traceability
but cannot satisfy the improvement gate; only true end-to-end measurements or
blinded readability may do so.

## Blind readability review

Randomize the four final renders to labels unrelated to tier and hide traces,
token counts, and filenames from the reviewer. Ask at least one independent
reviewer to score 1–5 for:

- functional structure and main signal flow;
- power/bias/control separation;
- hierarchy/repetition clarity;
- crossing/Junction and label readability;
- overall textbook/Razavi-style usefulness.

Reveal tier labels only after scores and comments are frozen. A study supports
shipping a guidance revision only when all tiers preserve hard invariants, the
Skill/knowledge tiers do not reduce held-out completion or median readability
versus Tier A, and at least one predeclared context/transaction/time or
readability target improves without a severe regression elsewhere. Failure is
research evidence, not a reason to enlarge the product protocol.

Do not replace this gate with the deterministic package report in
[`skill-and-ablation-structure.json`](../../../fixtures/agent-layout-eval/skill-and-ablation-structure.json);
that report validates loading structure and context cost, not model judgment.
