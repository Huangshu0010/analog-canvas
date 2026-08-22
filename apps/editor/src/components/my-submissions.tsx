import { useEffect, useState } from "react";

import { fetchSessionUser } from "./account";

/**
 * "My submissions" (roadmap phase G3): a signed-in user's gallery entries
 * with their review status; a rejection shows the reviewer's optional
 * reason so resubmission is informed, not a guessing game.
 */

export interface MineEntry {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  rejectReason: string | null;
}

type MineState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; entries: MineEntry[] };

export async function loadMySubmissions(
  fetchLike: typeof fetch = fetch,
): Promise<MineState> {
  const user = await fetchSessionUser(fetchLike);
  if (!user) return { status: "signed-out" };
  try {
    const response = await fetchLike("/api/gallery/mine", {
      credentials: "same-origin",
    });
    if (!response.ok) return { status: "signed-out" };
    const payload = (await response.json()) as { entries?: MineEntry[] };
    return { status: "ready", entries: payload.entries ?? [] };
  } catch {
    return { status: "signed-out" };
  }
}

const STATUS_LABELS: Record<string, string> = {
  public: "Published",
  pending: "Waiting for review",
  rejected: "Rejected",
  recycled: "Removed",
};

export function MySubmissions() {
  const [state, setState] = useState<MineState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadMySubmissions().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="gallery-status">Loading your submissions…</p>;
  }
  if (state.status === "signed-out") {
    return (
      <main className="review-shell" data-testid="mine-signed-out">
        <p className="gallery-status">
          Sign in on the <a href="/">gallery page</a> to see your submissions.
        </p>
      </main>
    );
  }

  return (
    <main className="review-shell" data-testid="mine-list">
      <header className="gallery-chrome">
        <div className="gallery-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          <div>
            <h1>My submissions</h1>
            <p>Status of everything you sent to the gallery</p>
          </div>
        </div>
        <nav className="gallery-actions">
          <a className="gallery-open-editor" href="/">
            Back to the gallery
          </a>
        </nav>
      </header>
      {state.entries.length === 0 ? (
        <p className="gallery-status">
          Nothing yet — open the <a href="/editor">editor</a> and use File →
          Publish to Gallery.
        </p>
      ) : (
        <section className="mine-list">
          {state.entries.map((entry) => (
            <article
              key={entry.id}
              className="mine-card"
              data-testid={`mine-card-${entry.id}`}
            >
              <div className="mine-card-copy">
                <h2>{entry.name}</h2>
                <p className="review-card-meta">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="mine-card-status">
                <span
                  className={`mine-status mine-status-${entry.status}`}
                  data-testid={`mine-status-${entry.id}`}
                >
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </span>
                {entry.status === "rejected" && entry.rejectReason ? (
                  <p
                    className="mine-reason"
                    data-testid={`mine-reason-${entry.id}`}
                  >
                    Reason: {entry.rejectReason}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
