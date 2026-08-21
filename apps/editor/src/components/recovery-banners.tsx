import type { RecoveryState } from "../document/recovery-coordinator";

export interface RecoveryFailureBannerProps {
  state: RecoveryState;
  onDownload(): void;
  onDismiss(): void;
}

function failureMessage(state: RecoveryState): string {
  switch (state) {
    case "quota-exceeded":
      return "Browser storage for this site is full — new recovery copies cannot be saved.";
    case "unavailable":
      return "Browser storage is unavailable — recovery copies cannot be saved.";
    default:
      return "The latest recovery copy could not be saved.";
  }
}

/**
 * Persistent, dismissible warning that recovery writes are failing, with a
 * direct download so the user can secure the current Project immediately.
 */
export function RecoveryFailureBanner({
  state,
  onDownload,
  onDismiss,
}: RecoveryFailureBannerProps) {
  return (
    <aside
      className="recovery-banner recovery-banner-warning"
      data-testid="recovery-failure-banner"
      role="alert"
      aria-label="Recovery storage problem"
    >
      <p>
        {failureMessage(state)} Download the Project to keep your work safe.
      </p>
      <div className="recovery-banner-actions">
        <button type="button" onClick={onDownload}>
          Download Project
        </button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss warning">
          Dismiss
        </button>
      </div>
    </aside>
  );
}

/** Concise statusbar label derived from coordinator recovery state. */
export function recoveryStateLabel(state: RecoveryState): string | null {
  switch (state) {
    case "idle":
      return null;
    case "pending":
      return "Saving recovery…";
    case "stored":
      return "Recovery saved";
    case "quota-exceeded":
      return "Recovery full — download now";
    case "unavailable":
      return "Recovery unavailable — download now";
    case "failed":
      return "Recovery failed — download now";
  }
}
