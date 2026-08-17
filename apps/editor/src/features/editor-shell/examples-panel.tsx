import {
  libraryProjectExamples,
  type LibraryProjectExample,
} from "../../examples/library-examples";

export interface ExamplesPanelProps {
  open: boolean;
  onShowLibrary(): void;
  onOpenExample(example: LibraryProjectExample): void;
}

export function ExamplesPanel({
  open,
  onShowLibrary,
  onOpenExample,
}: ExamplesPanelProps) {
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
        <div className="left-panel-tabs" aria-label="Library panels">
          <button
            type="button"
            className="left-panel-tab"
            data-testid="library-panel-tab"
            onClick={onShowLibrary}
            title="Show component library"
          >
            Library
          </button>
          <button
            type="button"
            className="left-panel-tab active"
            data-testid="examples-panel-tab"
            aria-current="page"
            title="Circuit examples"
          >
            <span className="shapes-kicker">Quick place</span>
            <span className="shapes-panel-heading">Examples</span>
          </button>
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
