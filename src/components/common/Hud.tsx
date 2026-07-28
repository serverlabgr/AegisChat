import type { ReactNode } from "react";
import "./Hud.css";

type Tone = "default" | "ok" | "warn" | "danger" | "dim";

export function HudReadout({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={`hud-readout hud-readout--${tone}`}>
      <span className="hud-readout__label">{label}</span>
      <span className="hud-readout__value">
        {icon ? <span className="hud-readout__icon">{icon}</span> : null}
        {value}
      </span>
    </div>
  );
}

export function SectionLabel({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="section-label">
      <span className="section-label__text">{children}</span>
      {trailing ? <span className="section-label__trailing">{trailing}</span> : null}
    </div>
  );
}
