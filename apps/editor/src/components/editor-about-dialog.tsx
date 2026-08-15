import type { RefObject } from "react";

import editorPackage from "../../package.json";

const REPOSITORY_URL = "https://github.com/chenzc24/Analog-Canvas";

export interface EditorAboutDialogProps {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose(): void;
}

export function EditorAboutDialog({
  closeButtonRef,
  onClose,
}: EditorAboutDialogProps) {
  return (
    <div
      className="help-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="help-dialog"
        id="editor-about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <header className="help-dialog-header">
          <div>
            <p className="help-kicker">Interactive Circuit Maker</p>
            <h2 id="about-title">About</h2>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close about"
          >
            Close
          </button>
        </header>
        <div className="help-dialog-content">
          <p>
            <strong>Analog Canvas</strong> is a local-first schematic editor for
            editable circuit design.
          </p>
          <p>
            Version <strong>{editorPackage.version}</strong>
          </p>
          <p>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {REPOSITORY_URL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
