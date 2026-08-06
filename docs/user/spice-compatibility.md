# SPICE Compatibility in v0.1

Interactive Circuit Maker imports circuit structure; it does not simulate the
netlist. Every source byte, continuation, include relation, typed statement,
and unresolved statement remains available to the compiler pipeline.

| Profile               | Structural status       | Detection                                                   | Important limit                                                |
| --------------------- | ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| ngspice 46 core       | baseline                | ngspice directives                                          | simulator commands are preserved, not executed                 |
| SPICE3f5 core         | baseline                | compatibility fallback                                      | no simulator execution                                         |
| LTspice 24 structural | selected vendor profile | `.backanno` family or explicit override                     | schematic directives and proprietary devices may remain opaque |
| Xyce 7 structural     | selected vendor profile | analysis-qualified `.print`/`.measure` or explicit override | Xyce expression/runtime semantics are not evaluated            |
| HSPICE                | preservation only       | no dedicated profile                                        | no released conformance corpus                                 |
| PSpice                | preservation only       | no dedicated profile                                        | no released conformance corpus                                 |

“Opaque” is not discarded. It means the exact source and source span are kept,
but the statement is not yet safe to turn into editable circuit semantics.
