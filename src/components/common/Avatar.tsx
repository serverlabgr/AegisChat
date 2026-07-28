import type { User } from "../../data/mock";
import { initials } from "../../lib/format";
import "./Avatar.css";

interface AvatarProps {
  user: User | undefined | null;
  size?: number;
  showStatus?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function Avatar({ user, size = 36, showStatus = false, onClick }: AvatarProps) {
  if (!user) return null;
  return (
    <div
      className={`avatar${onClick ? " avatar--clickable" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      onClick={onClick}
    >
      <span style={{ color: user.color }}>{initials(user.name)}</span>
      {showStatus ? (
        <span
          className={`avatar__status avatar__status--${user.status}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      ) : null}
    </div>
  );
}
