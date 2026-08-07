# Human and Agent collaboration

Owner: shared Edit Engine for mutations; human for accepted locks and explicit
decisions; Agent for review and explanation. Strength: hard for revision/locks,
guidance for handoff. Trigger: existing layout, locks, concurrent revisions, or
a handoff request.

## Work with the current drawing

Treat placed geometry, labels, routing, groups, and constraints as evidence of
human intent. Preserve clear work outside the smallest responsible area. Use the
same typed edits as the GUI so undo, revision history, validation, and recovery
have one meaning.

Before a commit, use the exact Snapshot revision. On `STALE_REVISION`, discard
the old geometric assumptions and refresh. On a lock conflict, do not remove or
bypass the lock; choose another expression or ask the human to decide. Navigation
into a child changes only session state and must not replace `topDocumentId`.

## Handoff

Finish with a refreshed Snapshot and formal render. Report changed Documents,
intentional crossings/warnings, unresolved mappings, and locked areas that were
left intact. Leave the editor on the most useful review Document and make each
remaining diagnostic addressable by object ID and location.

## Counterexample

A visually cleaner Agent proposal is not authority to overwrite a locked route,
move a human-approved group, or retry against an old revision. A successful SVG
render is not proof that concurrent state or topology was preserved.
