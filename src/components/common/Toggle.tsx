import "./Toggle.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {description ? (
          <span className="toggle-row__desc">{description}</span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle${checked ? " toggle--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__knob" />
      </button>
    </label>
  );
}
