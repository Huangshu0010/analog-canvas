# Differential pair

Owner: Agent reasoning. Strength: guidance. Trigger: paired input controls with
shared source/emitter-side evidence.

## Evidence

- two compatible transconducting devices share a source/emitter-side Net or an
  equivalent tail structure;
- their control pins connect to distinct paired inputs;
- drain/collector-side branches feed corresponding loads or outputs;
- model, body connection, and relevant parameters are compatible.

## Counterevidence and variants

Different tail connections, unrelated control domains, strongly unequal sizing,
or asymmetric extra loading may disprove a matched pair. Source degeneration,
cascode devices, active loads, common-mode feedback, or intentional offset can
produce valid asymmetry; preserve and show it.

## Expression

Place the two primary devices as a readable local pair around a vertical axis,
inputs entering from opposite outer sides, shared tail below, and corresponding
loads/outputs above or to the right. Mirror routing only where the electrical
paths correspond. Keep common-mode or calibration branches visible as secondary
attachments rather than hiding them in perfect symmetry.

## Near miss

Two equal MOS devices that merely share ground but have unrelated gates and
drains are not a differential pair. Do not group them from size and proximity.
