import type { CircuitProject } from "@icm/model";

export interface AppProps {
  project?: CircuitProject;
}

export function App({ project }: AppProps) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Interactive Circuit Maker</h1>
        <p>{project ? project.name : "No project open"}</p>
      </header>
      <section className="canvas-shell" aria-label="Schematic canvas">
        <svg
          role="img"
          aria-label="Empty schematic canvas"
          viewBox="0 0 960 640"
        />
      </section>
    </main>
  );
}
