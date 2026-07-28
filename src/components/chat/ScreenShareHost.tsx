import { useEffect, useRef, useState } from "react";
import { hangup, setRtcHandlers } from "../../lib/webrtc";
import "./ScreenShareOverlay.css";

/** Always-mounted host so incoming screen shares work even if DM header isn't focused. */
export function ScreenShareHost() {
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Screen share");
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setRtcHandlers({
      onLocalStream: (stream) => {
        setActive(true);
        setLabel("Εσύ μοιράζεσαι οθόνη");
        if (localRef.current) {
          localRef.current.srcObject = stream;
          void localRef.current.play().catch(() => undefined);
        }
      },
      onRemoteStream: (stream) => {
        setActive(true);
        setLabel("Εισερχόμενο screen share");
        if (remoteRef.current) {
          remoteRef.current.srcObject = stream;
          void remoteRef.current.play().catch(() => undefined);
        }
      },
      onEnded: () => {
        setActive(false);
        if (localRef.current) localRef.current.srcObject = null;
        if (remoteRef.current) remoteRef.current.srcObject = null;
      },
    });
    return () => setRtcHandlers({});
  }, []);

  if (!active) return null;

  return (
    <div className="ss-overlay">
      <div className="ss-overlay__panel">
        <header>
          <strong>Screen share</strong>
          <span>{label}</span>
          <button type="button" onClick={() => void hangup()}>
            Τέλος
          </button>
        </header>
        <div className="ss-overlay__videos">
          <video ref={remoteRef} autoPlay playsInline />
          <video ref={localRef} autoPlay muted playsInline className="ss-overlay__local" />
        </div>
      </div>
    </div>
  );
}
