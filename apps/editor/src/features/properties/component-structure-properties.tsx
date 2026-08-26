import type { SchematicDocument } from "@icm/model";

type FormalTerminal = NonNullable<
  SchematicDocument["netlist"]
>["terminals"][number];
type PinSide = "north" | "east" | "south" | "west" | "auto";

export function FormalPortProperties({
  terminal,
  revision,
  onRename,
  onDirectionChange,
}: {
  terminal: FormalTerminal;
  revision: number;
  onRename: (name: string) => void;
  onDirectionChange: (
    terminalId: string,
    direction: FormalTerminal["direction"],
  ) => void;
}) {
  return (
    <div className="formal-port-properties" aria-label="Cell Pin properties">
      <label>
        <span>Terminal name</span>
        <input
          key={`${terminal.id}-${revision}-terminal-name`}
          aria-label="Cell Pin name"
          defaultValue={terminal.name}
          onBlur={(event) => onRename(event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Direction</span>
        <select
          aria-label="Cell Pin direction"
          value={terminal.direction}
          onChange={(event) =>
            onDirectionChange(
              terminal.id,
              event.currentTarget.value as FormalTerminal["direction"],
            )
          }
        >
          <option value="input">Input</option>
          <option value="output">Output</option>
          <option value="inout">Inout</option>
          <option value="passive">Passive</option>
        </select>
      </label>
      <small>
        This Port defines the Cell interface and every parent symbol
        automatically.
      </small>
    </div>
  );
}

export function CellSymbolLayoutProperties({
  cell,
  enabled,
  onToggle,
  onBodySizeChange,
  onPortPlacementChange,
}: {
  cell: SchematicDocument;
  enabled: boolean;
  onToggle: () => void;
  onBodySizeChange: (width: number, height: number) => void;
  onPortPlacementChange: (
    terminalId: string,
    side: PinSide,
    offset: number,
  ) => void;
}) {
  const bodySize = cell.presentation.cellSymbol?.minimumBodySize;
  return (
    <div
      className="cell-symbol-layout-properties"
      aria-label="Cell symbol layout"
    >
      <div className="property-section-heading">Cell symbol layout</div>
      <small>
        Editing <strong>{cell.name}</strong>. These definition-level changes
        apply to every parent instance; connected routes follow the moved pin.
      </small>
      <button
        type="button"
        className="cell-symbol-layout-toggle"
        aria-pressed={enabled}
        onClick={onToggle}
      >
        {enabled
          ? "Done editing canvas layout"
          : "Edit symbol layout on canvas"}
      </button>
      {enabled ? (
        <small>
          Drag the corner to resize, or a pin dot to change its side and offset.
        </small>
      ) : null}
      <div className="component-geometry-row">
        <label>
          Width
          <input
            key={`${cell.id}-${cell.revision}-symbol-width`}
            aria-label="Cell symbol width"
            defaultValue={String(bodySize?.width ?? 100)}
            inputMode="numeric"
            onBlur={(event) =>
              onBodySizeChange(
                Number(event.currentTarget.value),
                bodySize?.height ?? 60,
              )
            }
          />
        </label>
        <label>
          Height
          <input
            key={`${cell.id}-${cell.revision}-symbol-height`}
            aria-label="Cell symbol height"
            defaultValue={String(bodySize?.height ?? 60)}
            inputMode="numeric"
            onBlur={(event) =>
              onBodySizeChange(
                bodySize?.width ?? 100,
                Number(event.currentTarget.value),
              )
            }
          />
        </label>
      </div>
      {cell.netlist?.terminals.map((terminal) => {
        const pinPlacement = cell.presentation.cellSymbol?.pinPlacements?.find(
          (placement) => placement.terminalId === terminal.id,
        );
        return (
          <div key={terminal.id} className="cell-symbol-pin-layout-row">
            <strong>{terminal.name}</strong>
            <label>
              Side
              <select
                key={`${cell.revision}-${terminal.id}-side`}
                aria-label={`Cell symbol ${terminal.name} pin side`}
                defaultValue={pinPlacement?.side ?? "auto"}
                onChange={(event) =>
                  onPortPlacementChange(
                    terminal.id,
                    event.currentTarget.value as PinSide,
                    pinPlacement?.offset ?? 0,
                  )
                }
              >
                <option value="auto">Auto</option>
                <option value="west">Left</option>
                <option value="east">Right</option>
                <option value="north">Top</option>
                <option value="south">Bottom</option>
              </select>
            </label>
            <label>
              Offset
              <input
                key={`${cell.revision}-${terminal.id}-offset`}
                aria-label={`Cell symbol ${terminal.name} pin offset`}
                defaultValue={String(pinPlacement?.offset ?? 0)}
                inputMode="numeric"
                onBlur={(event) =>
                  onPortPlacementChange(
                    terminal.id,
                    pinPlacement?.side ?? "auto",
                    Number(event.currentTarget.value),
                  )
                }
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
