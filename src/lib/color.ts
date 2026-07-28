function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function mix(channel: number, amount: number): number {
  return Math.round(channel + (255 - channel) * amount);
}

export function applyAccent(hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  const root = document.documentElement;
  root.style.setProperty("--accent", hex);
  root.style.setProperty(
    "--accent-hover",
    `rgb(${mix(r, 0.15)}, ${mix(g, 0.15)}, ${mix(b, 0.15)})`,
  );
  root.style.setProperty(
    "--accent-text",
    `rgb(${mix(r, 0.35)}, ${mix(g, 0.35)}, ${mix(b, 0.35)})`,
  );
  root.style.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, 0.14)`);
  root.style.setProperty("--accent-line", `rgba(${r}, ${g}, ${b}, 0.4)`);
  root.style.setProperty("--accent-border", `rgba(${r}, ${g}, ${b}, 0.4)`);
  root.style.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.55)`);
  root.style.setProperty("--aurora-1", `rgba(${r}, ${g}, ${b}, 0.22)`);
}
