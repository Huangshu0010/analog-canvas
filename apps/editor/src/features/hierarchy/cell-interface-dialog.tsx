import { useEffect, useState } from "react";

import type {
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";

type FormalParameter = NonNullable<
  SchematicDocument["netlist"]
>["formalParameters"][number];

/** Compact definition editor embedded in Cell Manager. */
export function CellInterfaceEditor({
  cell,
  callerCount,
  onRenameTerminal,
  onSetTerminalDirection,
  onMoveTerminal,
  onSetFormalParameters,
  externalDefinitions,
  onSetExternalDefinition,
}: {
  cell: SchematicDocument;
  callerCount: number;
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
  const [externalId, setExternalId] = useState<string>("__new__");
  const [externalName, setExternalName] = useState("");
  const [externalTerminals, setExternalTerminals] = useState("");
  const [externalParameters, setExternalParameters] = useState("");

  useEffect(() => {
    setFormalParameters(cell.netlist?.formalParameters ?? []);
  }, [cell.id, cell.revision]);

  useEffect(() => {
    if (externalId === "__new__") {
      setExternalName("");
      setExternalTerminals("");
      setExternalParameters("");
      return;
    }
    const definition = externalDefinitions.find(
      (item) => item.id === externalId,
    );
    if (!definition) return;
    setExternalName(definition.name);
    setExternalTerminals(
      definition.terminals.map((terminal) => terminal.name).join(", "),
    );
    setExternalParameters(
      definition.formalParameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? parameter.name
            : `${parameter.name}=${parameter.defaultValue}`,
        )
        .join(", "),
    );
  }, [externalDefinitions, externalId]);

  if (!cell.netlist) return null;
  const terminals = cell.netlist.terminals;

  return (
    <div className="cell-interface-editor" aria-label="Cell interface">
      <div className="cell-interface-grid">
        <section
          className="cell-interface-section"
          aria-label="Formal terminals"
        >
          <header>
            <div>
              <h3>Terminals</h3>
              <p>
                Ordered interface shared by {callerCount} caller
                {callerCount === 1 ? "" : "s"}.
              </p>
            </div>
            <span className="cell-count-badge">{terminals.length}</span>
          </header>
          {terminals.length === 0 ? (
            <p className="cell-interface-empty">
              Place a Port in this Cell to define its interface.
            </p>
          ) : (
            <div
              className="cell-interface-table"
              role="table"
              aria-label="Formal terminal order"
            >
              {terminals.map((terminal, index) => (
                <div
                  key={terminal.id}
                  className="cell-interface-row"
                  role="row"
                >
                  <span
                    className="cell-interface-order"
                    aria-label={`Terminal order ${index + 1}`}
                  >
                    {index + 1}
                  </span>
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
                  <div className="cell-interface-order-actions">
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
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="cell-interface-section"
          aria-label="Formal parameters"
        >
          <header>
            <div>
              <h3>Parameters</h3>
              <p>Defaults belong to the Cell; callers may override them.</p>
            </div>
            <button
              type="button"
              className="cell-inline-action"
              onClick={() =>
                setFormalParameters((current) => [...current, { name: "" }])
              }
            >
              Add
            </button>
          </header>
          {formalParameters.length === 0 ? (
            <p className="cell-interface-empty">No formal parameters.</p>
          ) : (
            <div className="cell-parameter-list">
              {formalParameters.map((parameter, index) => (
                <div
                  key={`${parameter.name}-${index}`}
                  className="cell-parameter-row"
                >
                  <input
                    aria-label={`Formal parameter ${index + 1} name`}
                    placeholder="Name"
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
                    placeholder="Required"
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
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {formalParameters.length > 0 ||
          cell.netlist.formalParameters.length > 0 ? (
            <button
              type="button"
              className="cell-apply-action"
              onClick={() =>
                onSetFormalParameters(
                  formalParameters.filter((parameter) => parameter.name.trim()),
                )
              }
            >
              Apply parameters
            </button>
          ) : null}
        </section>
      </div>

      <details className="cell-external-interface">
        <summary>
          <span>External subcircuit definitions</span>
          <small>{externalDefinitions.length} shared</small>
        </summary>
        <div className="cell-external-grid">
          <label>
            Definition
            <select
              aria-label="External subcircuit definition"
              value={externalId}
              onChange={(event) => setExternalId(event.currentTarget.value)}
            >
              <option value="__new__">New definition</option>
              {externalDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
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
                  externalId === "__new__"
                    ? `external-subcircuit-${target
                        .toLowerCase()
                        .replaceAll(/[^a-z0-9_-]/gu, "-")}`
                    : externalId,
                name: target,
                terminals: externalTerminals
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((name, index) => {
                    const existing = externalDefinitions
                      .find((definition) => definition.id === externalId)
                      ?.terminals.find(
                        (terminal) =>
                          terminal.name.toLowerCase() === name.toLowerCase(),
                      );
                    return {
                      id:
                        existing?.id ??
                        `external-terminal-${externalId === "__new__" ? target.toLowerCase().replaceAll(/[^a-z0-9_-]/gu, "-") : externalId}-${index + 1}`,
                      name,
                      direction: existing?.direction ?? ("passive" as const),
                    };
                  }),
                formalParameters: fields,
                interfaceStatus: "declared",
              });
            }}
          >
            Apply definition
          </button>
        </div>
      </details>
    </div>
  );
}
