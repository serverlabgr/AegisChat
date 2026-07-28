import "./TypingIndicator.css";

export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="typing-indicator">
      <span className="typing-indicator__dots">
        <span />
        <span />
        <span />
      </span>
      <span className="typing-indicator__text">
        <strong>{name}</strong> πληκτρολογεί...
      </span>
    </div>
  );
}
