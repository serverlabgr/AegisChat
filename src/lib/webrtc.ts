import { realtime } from "./realtime";

export type RtcSignal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit | null }
  | { kind: "hangup" };

type Handlers = {
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onEnded?: () => void;
  onError?: (err: Error) => void;
};

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let peerUserId: string | null = null;
let threadId: string | null = null;
let handlers: Handlers = {};

function ensurePc() {
  if (pc) return pc;
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  pc.onicecandidate = (ev) => {
    if (!peerUserId || !threadId) return;
    realtime.sendRtc(peerUserId, threadId, {
      kind: "ice",
      candidate: ev.candidate ? ev.candidate.toJSON() : null,
    });
  };
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    if (stream) handlers.onRemoteStream?.(stream);
  };
  pc.onconnectionstatechange = () => {
    if (
      pc?.connectionState === "failed" ||
      pc?.connectionState === "closed" ||
      pc?.connectionState === "disconnected"
    ) {
      handlers.onEnded?.();
    }
  };
  return pc;
}

export function setRtcHandlers(h: Handlers) {
  handlers = h;
}

export async function startScreenShare(toUserId: string, dmThreadId: string) {
  await hangup(false);
  peerUserId = toUserId;
  threadId = dmThreadId;

  // Prefer max fidelity capture — browser keeps native resolution when possible
  localStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack?.applyConstraints) {
    void videoTrack
      .applyConstraints({
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 60 },
      })
      .catch(() => undefined);
  }
  handlers.onLocalStream?.(localStream);

  const conn = ensurePc();
  for (const track of localStream.getTracks()) {
    conn.addTrack(track, localStream);
    track.onended = () => void hangup();
  }

  const offer = await conn.createOffer({ offerToReceiveVideo: true });
  await conn.setLocalDescription(offer);
  realtime.sendRtc(toUserId, dmThreadId, { kind: "offer", sdp: offer });
}

export async function acceptScreenShare(
  fromUserId: string,
  dmThreadId: string,
  offer: RTCSessionDescriptionInit,
) {
  await hangup(false);
  peerUserId = fromUserId;
  threadId = dmThreadId;
  const conn = ensurePc();
  await conn.setRemoteDescription(offer);
  const answer = await conn.createAnswer();
  await conn.setLocalDescription(answer);
  realtime.sendRtc(fromUserId, dmThreadId, { kind: "answer", sdp: answer });
}

export async function handleRtcSignal(
  fromUserId: string,
  dmThreadId: string,
  signal: RtcSignal,
) {
  if (signal.kind === "hangup") {
    await hangup(false);
    handlers.onEnded?.();
    return;
  }
  if (signal.kind === "offer") {
    await acceptScreenShare(fromUserId, dmThreadId, signal.sdp);
    return;
  }
  const conn = ensurePc();
  peerUserId = fromUserId;
  threadId = dmThreadId;
  if (signal.kind === "answer") {
    await conn.setRemoteDescription(signal.sdp);
    return;
  }
  if (signal.kind === "ice" && signal.candidate) {
    try {
      await conn.addIceCandidate(signal.candidate);
    } catch {
      /* ignore race */
    }
  }
}

export async function hangup(notifyPeer = true) {
  if (notifyPeer && peerUserId && threadId) {
    realtime.sendRtc(peerUserId, threadId, { kind: "hangup" });
  }
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  pc?.close();
  pc = null;
  peerUserId = null;
  threadId = null;
}

export function isSharing(): boolean {
  return Boolean(localStream);
}
