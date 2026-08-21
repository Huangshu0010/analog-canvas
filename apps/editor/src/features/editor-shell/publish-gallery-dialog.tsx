import { useState } from "react";

import {
  describePublishOutcome,
  forgetOnUnauthorized,
  rememberedPublishAuthor,
  rememberedPublishToken,
  rememberPublishAuthor,
  rememberPublishToken,
  type GalleryPublishFields,
  type GalleryPublishOutcome,
  type PublishSessionUser,
} from "./gallery-publish";

export interface PublishGalleryDialogProps {
  defaultName: string;
  /** The signed-in user, if any; an admin session publishes cookie-side. */
  session?: PublishSessionUser | null;
  publish: (fields: GalleryPublishFields) => Promise<GalleryPublishOutcome>;
  onPublished: (outcome: { id: string; name: string }) => void;
  onClose: () => void;
}

/**
 * File > "Publish to Gallery…". A signed-in super-admin (G2) publishes
 * directly on the session — no passphrase row. Anyone else needs the
 * gallery owner's passphrase (remembered for the browser session,
 * forgotten on a 401). The author byline prefills from the account's
 * display name, else from the last successful publish.
 */
export function PublishGalleryDialog({
  defaultName,
  session = null,
  publish,
  onPublished,
  onClose,
}: PublishGalleryDialogProps) {
  const admin = session?.isAdmin === true;
  const [name, setName] = useState(defaultName);
  const [author, setAuthor] = useState(
    () => rememberedPublishAuthor() || session?.displayName || "",
  );
  const [description, setDescription] = useState("");
  const [token, setToken] = useState(() => rememberedPublishToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const outcome = await publish({
      name,
      author,
      description,
      token: admin ? "" : token,
    });
    if (outcome.status === "published") {
      if (!admin) rememberPublishToken(token);
      rememberPublishAuthor(author);
      onPublished({ id: outcome.id, name: name.trim() });
      return;
    }
    if (forgetOnUnauthorized(outcome)) setToken("");
    setBusy(false);
    setError(describePublishOutcome(outcome));
  }

  return (
    <div
      className="insert-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="publish-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-gallery-title"
        data-testid="publish-gallery-dialog"
      >
        <header className="publish-gallery-header">
          <p>Share this circuit on the public wall</p>
          <h2 id="publish-gallery-title">Publish to Gallery</h2>
        </header>
        <div className="publish-gallery-fields">
          <label>
            Circuit name
            <input
              aria-label="Circuit name"
              value={name}
              maxLength={120}
              autoFocus
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>
              Author <span className="publish-gallery-optional">optional</span>
            </span>
            <input
              aria-label="Author"
              value={author}
              maxLength={40}
              placeholder="Shown on your tile"
              onChange={(event) => setAuthor(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>
              Description{" "}
              <span className="publish-gallery-optional">optional</span>
            </span>
            <textarea
              aria-label="Description"
              value={description}
              maxLength={300}
              rows={3}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </label>
          {admin ? null : (
            <label>
              Owner passphrase
              <input
                aria-label="Owner passphrase"
                type="password"
                value={token}
                onChange={(event) => setToken(event.currentTarget.value)}
              />
            </label>
          )}
        </div>
        <p className="publish-gallery-note">
          {admin
            ? `Signed in as ${session?.displayName} — this publishes directly as the gallery owner.`
            : "Publishing is owner-approved for now: it needs the gallery owner's passphrase. Community sign-in with review is on the roadmap — until then, send your circuit file to the owner."}
        </p>
        {error ? (
          <p role="alert" className="publish-gallery-error">
            {error}
          </p>
        ) : null}
        <div className="publish-gallery-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="publish-gallery-primary"
            disabled={
              busy || name.trim() === "" || (!admin && token.trim() === "")
            }
            onClick={() => void submit()}
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </section>
    </div>
  );
}
