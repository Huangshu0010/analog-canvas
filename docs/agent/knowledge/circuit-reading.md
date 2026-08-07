# Evidence-first circuit reading

Owner: Agent reasoning. Strength: guidance. Trigger: every unfamiliar circuit,
uncertain topology, or large flat Document.

Use this guide to understand a complete Document Snapshot without requiring a
preclassified circuit or Layout Intent.

## Evidence order

1. Read Document ports, global Nets, Project references, and source binding to
   establish boundaries and hierarchy.
2. Read each device's source name, model/target, parameters, symbol, and complete
   pin-to-Net map. Resolve device semantics before assigning a functional role.
3. Mark directly evidenced supply, ground, bias, clock/control, differential,
   feedback, high-impedance, and high-fanout Nets. Names are hints only.
4. Follow terminal relationships: shared source/emitter nodes, common gates or
   bases, diode-connected devices, stacks, bridges, repeated branches, and
   switched paths.
5. Trace likely main signal paths from boundaries to outputs, then bias supply,
   common-mode/differential paths, feedback returns, and protection/control.
6. Search for counterevidence: mismatched parameters, extra loads, different
   body connections, unequal control Nets, broken branches, or asymmetric fanout.
7. Separate confirmed facts, layout hypotheses, and unresolved questions.

## Reason from connectivity, not names

A name such as `M1`, `VINP`, or `TAIL` does not prove a role. A differential-pair
hypothesis needs shared terminal structure, paired controls, compatible device
types/parameters, and corresponding output loads. A mirror hypothesis needs a
reference branch and a control relationship, not merely two equal transistors.

Treat model namespaces and parameter strings as preserved source evidence. If
the symbol registry cannot establish pin semantics, stop semantic inference for
that device rather than applying a MOS/BJT convention by memory.

## Scale without a query language

For a large Document, keep the complete Snapshot and build an internal graph.
Choose attention sets by electrical boundaries and repeated evidence, not by a
server-defined region:

- boundary cone from a selected input/output or feedback Net;
- supply/bias spine and its consumers;
- repeated isomorphic branches with parameter differences;
- hierarchy reference and its external pin context;
- current diagnostic object IDs plus their adjacent Nets.

Work on one coherent set at a time, but retain boundary Nets and cross-set
relationships. Refresh the whole Snapshot for global review.

## Stop conditions

Stop and request a product fact or human decision when:

- a connected pin exists but its semantic role/order is unresolved;
- two plausible interpretations imply different topology edits;
- source model, parameter, or hierarchy target facts are absent;
- a human lock conflicts with the only electrically honest expression;
- the user asks for a topology change whose intent is ambiguous.

Uncertainty in visual grouping can remain explicit. Uncertainty in electrical
connectivity cannot be resolved by drawing convention.
