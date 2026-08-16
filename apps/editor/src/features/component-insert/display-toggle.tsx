export interface DisplayToggleProps {
  label: string;
  checked: boolean;
  disabled?: boolean | undefined;
  help?: string | undefined;
  testId?: string | undefined;
  onChange(checked: boolean): void;
}

/**
 * One compact Reference/Value visibility switch shared by the insert dialog,
 * the component properties panel, and group selection.
 */
export function DisplayToggle({
  label,
  checked,
  disabled = false,
  help,
  testId,
  onChange,
}: DisplayToggleProps) {
  return (
    <label
      className={`display-toggle${disabled ? " disabled" : ""}`}
      data-testid={testId}
      title={help}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
