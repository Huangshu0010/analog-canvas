import { useEffect, useState } from "react";

import type {
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";

type FormalParameter = NonNullable<
  SchematicDocument["netlist"]
>["formalParameters"][number];

/**
 * Netlist-interface authoring deliberately excludes Cell Symbol Layout. The
 * latter remains the existing canvas presentation workflow.
 */
export function CellInterfaceDialog({
  open,
  cell,
  callerCount,
  onClose,
  onRenameTerminal,
  onSetTerminalDirection,
  onMoveTerminal,
  onSetFormalParameters,
  externalDefinitions,
  onSetExternalDefinition,
}: {
  open: boolean;
  cell: SchematicDocument | null;
  callerCount: number;
  onClose(): void;
  onRenameTerminal(terminalId: string, name: string): void;
  onSetTerminalDirection(
    terminalId: string,
    direction: "input" | "output" | "inout" | "passive",
  ): void;
  onMoveTerminal(terminalId: string, delta: -1 | 1): void;
  onSetFormalParameters(formalParameters: FormalParameter[]): void;
  externalDefinitions: readonly ExternalSubcircuitDefinition[];
  onSetExternalDefinition(definition: ExternalSubcircuitDefinition): void;
}) {
  const [formalParameters, setFormalParameters] = useState<FormalParameter[]>(
    [],
  );
  const [externalId, setExternalId] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [externalTerminals, setExternalTerminals] = useState("");
  const [externalParameters, setExternalParameters] = useState("");
  useEffect(() => {
    setFormalParameters(cell?.netlist?.formalParameters ?? []);
  }, [cell?.id, cell?.revision]);
  useEffect(() => {
    if (externalId === "__new__") {
      setExternalName("");
      setExternalTerminals("");
      setExternalParameters("");
      return;
    }
    const definition =
      externalDefinitions.find((item) => item.id === externalId) ??
      externalDefinitions[0];
    setExternalId(definition?.id ?? null);
    setExternalName(definition?.name ?? "");
    setExternalTerminals(
      definition?.terminals.map((terminal) => terminal.name).join(", ") ?? "",
    );
    setExternalParameters(
      definition?.formalParameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? parameter.name
            : `${parameter.name}=${parameter.defaultValue}`,
        )
        .join(", ") ?? "",
    );
  }, [externalDefinitions, externalId]);
  if (!open || !cell?.netlist) return null;
  const terminals = cell.netlist.terminals;
  return (
    <div
      className="insert-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="insert-component-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-interface-title"
      >
        <header className="insert-dialog-header">
          <div>
            <p>Ordered netlist contract</p>
            <h2 id="cell-interface-title">
              Cell Interface · {cell.netlist.name}
            </h2>
          </div>
        </header>
        <div className="insert-dialog-body">
          <section
            className="insert-control-column"
            aria-label="Formal terminals"
          >
            <h3>Formal terminals</h3>
            <p>
              {callerCount} caller{callerCount === 1 ? "" : "s"} share this
              order.
            </p>
            {terminals.map((terminal, index) => (
              <div key={terminal.id} className="cell-interface-row">
                <input
                  aria-label={`Formal terminal ${index + 1} name`}
                  defaultValue={terminal.name}
                  onBlur={(event) =>
                    onRenameTerminal(
                      terminal.id,
                      event.currentTarget.value.trim(),
                    )
                  }
                />
                <select
                  aria-label={`Formal terminal ${terminal.name} direction`}
                  value={terminal.direction}
                  onChange={(event) =>
                    onSetTerminalDirection(
                      terminal.id,
                      event.currentTarget.value as typeof terminal.direction,
                    )
                  }
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="inout">Inout</option>
                  <option value="passive">Passive</option>
                </select>
                <button
                  type="button"
                  aria-label={`Move ${terminal.name} up`}
                  disabled={index === 0}
                  onClick={() => onMoveTerminal(terminal.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${terminal.name} down`}
                  disabled={index === terminals.length - 1}
                  onClick={() => onMoveTerminal(terminal.id, 1)}
                >
                  ↓
                </button>
              </div>
            ))}
          </section>
          <section
            className="insert-control-column"
            aria-label="Formal parameters"
          >
            <h3>Formal parameters</h3>
            <p>
              Raw defaults are definition-owned; callers only override them.
            </p>
            {formalParameters.map((parameter, index) => (
              <div
                key={`${parameter.name}-${index}`}
                className="cell-interface-row"
              >
                <input
                  aria-label={`Formal parameter ${index + 1} name`}
                  value={parameter.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value;
                    setFormalParameters((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name } : item,
                      ),
                    );
                  }}
                />
                <input
                  aria-label={`Formal parameter ${parameter.name} default`}
                  placeholder="required at caller"
                  value={parameter.defaultValue ?? ""}
                  onChange={(event) => {
                    const defaultValue = event.currentTarget.value;
                    setFormalParameters((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              name: item.name,
                              ...(defaultValue ? { defaultValue } : {}),
                            }
                          : item,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  aria-label={`Remove formal parameter ${parameter.name}`}
                  onClick={() =>
                    setFormalParameters((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFormalParameters((current) => [...current, { name: "" }])
              }
            >
              Add formal parameter
            </button>
            <button
              type="button"
              onClick={() =>
                onSetFormalParameters(
                  formalParameters.filter((parameter) => parameter.name.trim()),
                )
              }
            >
              Apply formal parameters
            </button>
          </section>
          <section
            className="insert-control-column"
            aria-label="External subcircuit interface"
          >
            <h3>External subcircuit</h3>
            <p>One shared black-box definition supplies every caller.</p>
            <select
              aria-label="External subcircuit definition"
              value={externalId ?? ""}
              onChange={(event) =>
                setExternalId(event.currentTarget.value || null)
              }
            >
              <option value="__new__">New definition</option>
              {externalDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
            <label>
              Target
              <input
                aria-label="External subcircuit target"
                value={externalName}
                onChange={(event) => setExternalName(event.currentTarget.value)}
              />
            </label>
            <label>
              Ordered terminals
              <input
                aria-label="External subcircuit terminals"
                placeholder="INP, INN, OUT"
                value={externalTerminals}
                onChange={(event) =>
                  setExternalTerminals(event.currentTarget.value)
                }
              />
            </label>
            <label>
              Formal parameters
              <input
                aria-label="External subcircuit formal parameters"
                placeholder="gain=10, bias"
                value={externalParameters}
                onChange={(event) =>
                  setExternalParameters(event.currentTarget.value)
                }
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const target = externalName.trim();
                if (!target) return;
                const fields = externalParameters
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((item) => {
                    const [name, ...defaultParts] = item.split("=");
                    const defaultValue = defaultParts.join("=").trim();
                    return {
                      name: name!.trim(),
                      ...(defaultValue ? { defaultValue } : {}),
                    };
                  });
                onSetExternalDefinition({
                  id:
                    !externalId || externalId === "__new__"
                      ? `external-subcircuit-${target
                          .toLowerCase()
                          .replaceAll(/[^a-z0-9_-]/gu, "-")}`
                      : externalId,
                  name: target,
                  terminals: externalTerminals
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                  formalParameters: fields,
                });
              }}
            >
              Apply external interface
            </button>
          </section>
        </div>
        <footer className="insert-dialog-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
