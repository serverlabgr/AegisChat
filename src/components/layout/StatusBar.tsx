import { useEffect, useState } from "react";
import { Users, Activity, Gamepad2, Sparkles } from "lucide-react";
import { useStore } from "../../store/store";
import { BUILD_VERSION, getAppVersion } from "../../lib/appVersion";
import "./StatusBar.css";

export function StatusBar() {
  const { users, memberIds, currentUserId, getPing, onlineMode } = useStore();
  const [version, setVersion] = useState(BUILD_VERSION);
  const onlineCount = memberIds.filter(
    (id) => id !== currentUserId && users[id]?.status !== "offline",
  ).length;
  const ping = getPing(currentUserId);

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <span className="statusbar__item statusbar__item--ok">
          <Users size={12} />
          {onlineCount} φίλοι online
        </span>
        <span className="statusbar__item">
          <Activity size={12} />
          {ping != null ? `${Math.round(ping)}ms` : onlineMode ? "…" : "—"} ping
        </span>
        <span className="statusbar__item statusbar__item--muted">
          <Sparkles size={12} />
          {onlineMode ? "live server" : "τοπικό demo"}
        </span>
      </div>

      <div className="statusbar__group">
        <span className="statusbar__item">
          <Gamepad2 size={12} />
          η παρέα
        </span>
        <span className="statusbar__item statusbar__item--muted">v{version}</span>
      </div>
    </footer>
  );
}
