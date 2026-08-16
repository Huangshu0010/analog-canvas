# Switching and sampling networks

Owner: Agent reasoning. Strength: guidance. Trigger: control Nets select between
references, connect/disconnect storage elements, or repeat across bits/phases.

## Evidence

- device terminals form alternate conductive paths selected by complementary or
  phased control Nets;
- capacitors or high-impedance nodes retain a sampled quantity;
- repeated branches share references, a summing node, or bit/phase controls;
- parameters, multiplicity, or connectivity establish weight or timing order.

Trace each switch's possible endpoints from connectivity. Distinguish signal,
reference, common-mode, reset, precharge, and clock paths from pin evidence and
formal boundary terminals. For MOS switches, body and complementary devices may
be part of the safe switch structure rather than the main signal path.

## Expression

Keep the sampled/summing node visually stable. Align repeated branches by
evidenced bit, weight, or phase; keep their control labels close but off the
signal path. Show alternate references on consistent sides. Make non-overlap,
complementary control, dummy, bridge, or common-mode exceptions visibly distinct
without forcing a false symmetry.

## Counterevidence and near miss

Shared clock names do not prove a sampling array, and repeated MOS devices do
not prove transmission gates. Static bias switches, level shifters, protection,
and digital logic may share the same symbols. Reject the pattern when terminal
paths, phase relationships, or storage evidence do not support it.
