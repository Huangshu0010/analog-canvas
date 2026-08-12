# Archived Target Plans

`plan/archived/` contains completed target plans that no longer belong in the
active planning surface. Archiving changes discoverability, not history:
`plan/log.md` remains the factual summary and Git remains the implementation
record.

## Eligibility

Archive a current-format plan only when it has `status: completed`, its work is
represented by Git, its outcome and validation are recorded, no decision or
coordination remains open, its experience signal is resolved, and no active
target depends on its root-level path. Equivalent explicit completion/outcome
text and Git evidence may establish eligibility for legacy plans.

Keep failed, blocked, unresolved, proposed-only, superseded-before-
implementation, pending, and active plans in `plan/`. A plan with a possible
experience signal remains visible until a human accepts, rejects, or defers it.

## Layout and Retention

Archived plans are grouped by completion month:

```text
plan/archived/YYYY-MM/<original-target-directory>/plan.md
```

Do not rewrite archived plan bodies merely to update terminology or paths.
Current rules live in `AGENTS.md`, `plan/README.md`, accepted specs, and ADRs.
The directory tree and Git history are the detailed index; this README does not
duplicate a per-plan commit table.

## 2026-08 lifecycle sweep

On 2026-08-13, 136 current-format completed targets with resolved experience,
recorded outcomes, and Git history were moved from the root into `2026-08/`
without changing their bodies. The root retention queue and records needing a
human experience decision are in [`../root-audit.md`](../root-audit.md).

That day, 34 independently reconstructible routine plan bodies were deleted:
visual calibration, narrow geometry, UI, shortcut, symbol, fixture, and
typecheck records. Every deletion had Git history and a corresponding factual
log entry. The remaining foundation and legacy plans are retained where they
carry enduring architecture, migration, recovery, integration, or experience
context. Retention policy—not plan length—governs these decisions.
