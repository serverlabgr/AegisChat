/** Banner for modules that are not production-ready yet. */
export function SoonBanner({ feature }: { feature: string }) {
  return (
    <p
      className="module__soon"
      style={{
        margin: "0 0 14px",
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid var(--accent-line, rgba(92,200,255,0.25))",
        background: "var(--accent-soft, rgba(92,200,255,0.08))",
        color: "var(--text-dim)",
        fontSize: "13px",
      }}
    >
      <strong style={{ color: "var(--accent-text)" }}>Σύντομα</strong> — το{" "}
      {feature} είναι ακόμα demo preview. Το chat / friends δουλεύουν κανονικά.
    </p>
  );
}
