import { QUICK_EMOJIS } from "../../data/mock";
import "./EmojiPicker.css";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  align?: "left" | "right";
}

export function EmojiPicker({ onSelect, align = "right" }: EmojiPickerProps) {
  return (
    <div className={`emoji-picker emoji-picker--${align}`}>
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="emoji-picker__item"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
