import { useEffect, useState } from "react";
import { MonitorOff, MonitorUp } from "lucide-react";
import { hangup, isSharing, startScreenShare } from "../../lib/webrtc";
import "./ScreenShareOverlay.css";

interface Props {
  peerUserId: string;
  threadId: string;
  peerName: string;
}

/** Header button — overlay lives in ScreenShareHost. */
export function ScreenShareControls({ peerUserId, threadId, peerName }: Props) {
  const [sharing, setSharing] = useState(isSharing());

  useEffect(() => {
    const id = window.setInterval(() => setSharing(isSharing()), 800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <button
      type="button"
      className={`ss-btn${sharing ? " ss-btn--live" : ""}`}
      title={sharing ? "Stop screen share" : `Share screen with ${peerName}`}
      onClick={() => {
        if (sharing || isSharing()) {
          void hangup();
          setSharing(false);
          return;
        }
        void startScreenShare(peerUserId, threadId)
          .then(() => setSharing(true))
          .catch(() => setSharing(false));
      }}
    >
      {sharing ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
    </button>
  );
}
