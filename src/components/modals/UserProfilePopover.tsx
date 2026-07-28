import { useEffect, useRef } from "react";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { useStore } from "../../store/store";
import { Avatar } from "../common/Avatar";
import "./UserProfilePopover.css";

interface UserProfilePopoverProps {
  userId: string;
  anchor: { x: number; y: number };
  onClose: () => void;
}

const statusText: Record<string, string> = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
};

export function UserProfilePopover({
  userId,
  anchor,
  onClose,
}: UserProfilePopoverProps) {
  const { users, currentUserId, openDM, getPing } = useStore();
  const user = users[userId];
  const ref = useRef<HTMLDivElement>(null);
  const isMe = userId === currentUserId;
  const ping = getPing(userId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!user) return null;

  const left = Math.min(anchor.x, window.innerWidth - 300);
  const top = Math.min(anchor.y, window.innerHeight - 280);

  return (
    <div
      ref={ref}
      className="profile-pop"
      style={{ left, top }}
    >
      <div className="profile-pop__banner" style={{ background: user.color }} />
      <div className="profile-pop__body">
        <Avatar user={user} size={64} showStatus />
        <h3 className="profile-pop__name" style={{ color: user.color }}>
          {user.name}
        </h3>
        <span className="profile-pop__status">
          {statusText[user.status]}
          {ping != null ? ` · ${ping}ms` : ""}
        </span>
        {user.role ? (
          <span className="profile-pop__role">
            <ShieldCheck size={12} />
            {user.role}
          </span>
        ) : null}
        {user.bio ? <p className="profile-pop__bio">{user.bio}</p> : null}

        {!isMe ? (
          <button
            type="button"
            className="profile-pop__dm"
            onClick={() => {
              openDM(userId);
              onClose();
            }}
          >
            <MessageSquare size={15} />
            Στείλε μήνυμα
          </button>
        ) : null}
      </div>
    </div>
  );
}
