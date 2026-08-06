# Accessibility Review for v0.1

Status: `reviewed-with-known-gaps`

## Covered

- All toolbar actions and file inputs use native keyboard-focusable controls.
- Tool state uses `aria-pressed`; status changes use an `aria-live` region.
- The schematic canvas has an image role and accessible label.
- Import diagnostics have a named region, semantic list, severity attributes,
  and text that does not depend on color alone.
- PWA theme and editor controls retain visible contrast in the shipped light
  theme.

## Known gaps

- Precise placement, route-segment selection, wire endpoint selection, and
  Junction insertion still require pointer input.
- The rendered schematic does not yet expose an object-by-object accessibility
  tree.
- Focus order is DOM order; no shortcut customization exists.

These gaps are documented release limits. A later keyboard-editing phase must
add semantic canvas navigation through Edit Engine operations rather than
simulated pointer events.
