# Current mirror

Owner: Agent reasoning. Strength: guidance. Trigger: a shared control Net plus
reference and output branch evidence.

## Evidence

- compatible devices share a control gate/base Net;
- one branch provides a reference relation, commonly a diode-connected device
  or equivalent feedback path;
- one or more output branches reproduce or ratio the reference current;
- source/emitter and body connections support the same operating domain;
- parameters explain an intended ratio when branches are unequal.

## Counterevidence and variants

A common bias gate alone is not sufficient. Different source rails, body domains,
cascode controls, startup branches, compliance devices, or switched enable paths
may define a bias network instead of a simple mirror. Widlar, Wilson, cascode,
gain-boosted, or multi-output mirrors require showing their extra feedback and
stack structure.

## Expression

Place the reference branch first and make its defining connection easy to trace.
Align output branches beside it, ordered by destination or ratio. Put shared
source/emitter supply on a clean rail and route the common control as a short
trunk. Annotate meaningful ratios; do not conceal startup or cascode bias paths.

## Near miss

Several same-sized devices driven by one bias voltage but connected to different
source domains are not automatically one mirror. Preserve the domains and leave
the interpretation open until the reference relation is evidenced.
