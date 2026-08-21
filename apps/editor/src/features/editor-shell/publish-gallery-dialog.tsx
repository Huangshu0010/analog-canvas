import { useState } from "react";

import {
  describePublishOutcome,
  forgetOnUnauthorized,
  rememberedPublishToken,
  rememberPublishToken,
  type GalleryPublishFields,
  type GalleryPublishOutcome,
} from "./gallery-publish";

export interface PublishGalleryDialogProps {
  defaultName: string;
  publish: (fields: GalleryPublishFields) => Promise<GalleryPublishOutcome>;
  onPublished: (outcome: { id: string; name: string }) => void;
  onClose: () => void;
}

/**
 * File > "Publish to Gallery…". Phase G1: the submissions endpoint accepts
 * only the gallery owner's passphrase (remembered for the browser session,
 * forgotten on a 401); visitors see the sign-in-pending note instead of a
 * dead end. G3 swaps the passphrase row for the signed-in identity.
 */
export function PublishGalleryDialog({
  defaultName,
  publish,
  onPublished,
  onClose,
}: PublishGalleryDialogProps) {
  const [name, setName] = useState(defaultName);
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [token, setToken] = useState(() => rememberedPublishToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const outcome = await publish({ name, author, description, token });
    if (outcome.status === "published") {
      rememberPublishToken(token);
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
        className="insert-component-dialog publish-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-gallery-title"
        data-testid="publish-gallery-dialog"
      >
        <header className="insert-dialog-header">
          <div>
            <p>Share this circuit on the public wall</p>
            <h2 id="publish-gallery-title">Publish to Gallery</h2>
          </div>
        </header>
        <div className="insert-dialog-body">
          <section className="insert-control-column">
            <label>
              Circuit name
              <input
                aria-label="Circuit name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label>
              Author (optional)
              <input
                aria-label="Author"
                value={author}
                maxLength={40}
                onChange={(event) => setAuthor(event.currentTarget.value)}
              />
            </label>
            <label>
              Description (optional)
              <textarea
                aria-label="Description"
                value={description}
                maxLength={300}
                rows={3}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </label>
            <label>
              Owner passphrase
              <input
                aria-label="Owner passphrase"
                type="password"
                value={token}
                onChange={(event) => setToken(event.currentTarget.value)}
              />
            </label>
            <p className="publish-gallery-note">
              Publishing is owner-approved for now: it needs the gallery
              owner&apos;s passphrase. Community sign-in with review is on the
              roadmap — until then, send your circuit file to the owner.
            </p>
            {error ? (
              <p role="alert" className="publish-gallery-error">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy || name.trim() === "" || token.trim() === ""}
              onClick={() => void submit()}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </section>
        </div>
      </section>
    </div>
  );
}
