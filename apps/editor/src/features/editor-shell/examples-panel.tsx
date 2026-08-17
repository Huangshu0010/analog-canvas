import {
  libraryProjectExamples,
  type LibraryProjectExample,
} from "../../examples/library-examples";

export interface ExamplesPanelProps {
  open: boolean;
  onOpenExample(example: LibraryProjectExample): void;
}

export function ExamplesPanel({ open, onOpenExample }: ExamplesPanelProps) {
  return (
    <aside
      id="examples-panel"
      className={
        open ? "shapes-panel examples-panel" : "shapes-panel collapsed"
      }
      aria-label="Examples"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      data-testid="examples-panel"
      data-open={open ? "true" : "false"}
    >
      <header className="shapes-panel-header">
        <div className="shapes-panel-static-title">
          <span className="shapes-kicker">Quick place</span>
          <span className="shapes-panel-heading">Examples</span>
        </div>
      </header>

      <div className="shapes-panel-body">
        <div className="shapes-example-list">
          {libraryProjectExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              className="shapes-example-card"
              data-testid={`shapes-example-${example.id}`}
              aria-label={`Open example ${example.name}`}
              title={`Open ${example.name}`}
              onClick={() => onOpenExample(example)}
            >
              <span className="shapes-example-copy">
                <span className="shapes-example-kicker">Example</span>
                <span className="shapes-example-name">{example.name}</span>
                <span className="shapes-example-description">
                  {example.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
