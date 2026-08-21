import {
  libraryProjectExamples,
  type LibraryProjectExample,
} from "../../examples/library-examples";
import type { UserExampleSummary } from "../../document/user-examples-store";

export interface ExamplesPanelProps {
  open: boolean;
  onOpenExample(example: LibraryProjectExample): void;
  /** User-saved snapshots, newest first; empty hides the section body. */
  userExamples?: readonly UserExampleSummary[];
  onOpenUserExample?(id: string): void;
  onExportUserExample?(id: string): void;
  onDeleteUserExample?(id: string): void;
}

function savedAtLabel(savedAt: string): string {
  const parsed = new Date(savedAt);
  return Number.isNaN(parsed.getTime())
    ? savedAt
    : parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function ExamplesPanel({
  open,
  onOpenExample,
  userExamples = [],
  onOpenUserExample,
  onExportUserExample,
  onDeleteUserExample,
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
        {userExamples.length > 0 ? (
          <div
            className="shapes-example-list user-example-list"
            data-testid="user-examples-section"
          >
            <span className="shapes-category-header">My examples</span>
            {userExamples.map((example) => (
              <div
                key={example.id}
                className="shapes-example-card user-example-card"
                data-testid={`user-example-${example.id}`}
              >
                <button
                  type="button"
                  className="user-example-open"
                  aria-label={`Open my example ${example.name}`}
                  title={`Open ${example.name}`}
                  onClick={() => onOpenUserExample?.(example.id)}
                >
                  <span className="shapes-example-copy">
                    <span className="shapes-example-kicker">My example</span>
                    <span className="shapes-example-name">{example.name}</span>
                    <span className="shapes-example-description">
                      Saved {savedAtLabel(example.savedAt)}
                    </span>
                  </span>
                </button>
                <span className="user-example-actions">
                  <button
                    type="button"
                    aria-label={`Export my example ${example.name}`}
                    title="Download .icproj.json"
                    onClick={() => onExportUserExample?.(example.id)}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete my example ${example.name}`}
                    title="Delete this saved example"
                    onClick={() => onDeleteUserExample?.(example.id)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
