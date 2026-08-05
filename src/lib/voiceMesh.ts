import { realtime } from "./realtime";
import type { VoiceParticipant } from "./voiceTypes";

export type VoiceSignal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit | null };

type Peer = {
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
};

let channelId: string | null = null;
let localStream: MediaStream | null = null;
let screenStream: MediaStream | null = null;
let peers = new Map<string, Peer>();
let muted = false;
let deafened = false;
let myUserId: string | null = null;
let iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export async function refreshIceServers(): Promise<void> {
  try {
    const { api } = await import("./api");
    const res = await api<{ iceServers: RTCIceServer[] }>("/voice/ice");
    if (Array.isArray(res.iceServers) && res.iceServers.length) {
      iceServers = res.iceServers;
    }
  } catch {
    /* keep STUN default */
  }
}

function makePc(peerId: string): Peer {
  const pc = new RTCPeerConnection({ iceServers });
  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");

  pc.onicecandidate = (ev) => {
    if (!channelId) return;
    realtime.sendVoiceSignal(channelId, peerId, {
      kind: "ice",
      candidate: ev.candidate ? ev.candidate.toJSON() : null,
    });
  };
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    if (!stream) return;
    const hasVideo = stream.getVideoTracks().length > 0;
    if (hasVideo) {
      window.dispatchEvent(
        new CustomEvent("aegis-voice-video", {
          detail: { peerId, stream },
        }),
      );
    } else {
      remoteAudio.srcObject = stream;
      remoteAudio.muted = deafened;
      void remoteAudio.play().catch(() => undefined);
    }
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
  if (screenStream) {
    for (const track of screenStream.getTracks()) {
      pc.addTrack(track, screenStream);
    }
  }

  const peer = { pc, remoteAudio };
  peers.set(peerId, peer);
  return peer;
}

async function connectToPeer(peerId: string, polite: boolean) {
  if (!channelId || peerId === myUserId || peers.has(peerId)) return;
  const peer = makePc(peerId);
  if (!polite) {
    // Lower userId initiates offer (deterministic mesh)
    const offer = await peer.pc.createOffer({ offerToReceiveAudio: true });
    await peer.pc.setLocalDescription(offer);
    realtime.sendVoiceSignal(channelId, peerId, { kind: "offer", sdp: offer });
  }
}

async function ensureLocalMic() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (err) {
    throw new Error(micPermissionMessage(err));
  }
  for (const track of localStream.getAudioTracks()) {
    track.enabled = !muted;
  }
  return localStream;
}

function micPermissionMessage(err: unknown): string {
  const name =
    err instanceof DOMException
      ? err.name
      : err instanceof Error
        ? err.name
        : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Χρειάζεται άδεια μικροφώνου (Windows / browser). Έλεγξε τα permissions και ξαναμπές.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Δεν βρέθηκε μικρόφωνο.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Το μικρόφωνο χρησιμοποιείται από άλλη εφαρμογή.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Δεν ανοίγει το μικρόφωνο";
}

export async function joinVoiceMesh(
  voiceChannelId: string,
  userId: string,
  initialMuted: boolean,
  initialDeafened: boolean,
  existing: VoiceParticipant[],
) {
  await leaveVoiceMesh(false);
  await refreshIceServers();
  channelId = voiceChannelId;
  myUserId = userId;
  muted = initialMuted;
  deafened = initialDeafened;
  await ensureLocalMic();
  realtime.sendVoiceJoin(voiceChannelId, muted, deafened);

  for (const p of existing) {
    if (p.userId === userId) continue;
    const shouldOffer = userId < p.userId;
    await connectToPeer(p.userId, !shouldOffer);
  }
}

/** Go Live — share screen into the current voice mesh. */
export async function startVoiceGoLive(): Promise<void> {
  if (!channelId || !myUserId) throw new Error("Δεν είσαι σε voice");
  if (screenStream) return;
  screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  screenStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    void stopVoiceGoLive();
  });
  for (const [peerId, peer] of peers) {
    for (const track of screenStream.getTracks()) {
      peer.pc.addTrack(track, screenStream);
    }
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    realtime.sendVoiceSignal(channelId, peerId, { kind: "offer", sdp: offer });
  }
  window.dispatchEvent(
    new CustomEvent("aegis-voice-video", {
      detail: { peerId: myUserId, stream: screenStream, local: true },
    }),
  );
}

export async function stopVoiceGoLive(): Promise<void> {
  if (!screenStream) return;
  for (const track of screenStream.getTracks()) track.stop();
  screenStream = null;
  window.dispatchEvent(
    new CustomEvent("aegis-voice-video", { detail: { peerId: null } }),
  );
}

export function isVoiceGoLive(): boolean {
  return Boolean(screenStream);
}

export async function syncVoiceParticipants(list: VoiceParticipant[]) {
  if (!channelId || !myUserId) return;
  try {
    const ids = new Set(list.map((p) => p.userId));
    for (const [peerId, peer] of [...peers.entries()]) {
      if (!ids.has(peerId)) {
        peer.pc.close();
        peer.remoteAudio.srcObject = null;
        peers.delete(peerId);
      }
    }
    for (const p of list) {
      if (p.userId === myUserId || peers.has(p.userId)) continue;
      const shouldOffer = myUserId < p.userId;
      await connectToPeer(p.userId, !shouldOffer);
    }
  } catch {
    /* Peer connect races — keep mesh alive */
  }
}

export async function handleVoiceSignal(
  voiceChannelId: string,
  fromUserId: string,
  _toUserId: string,
  signal: VoiceSignal,
) {
  if (voiceChannelId !== channelId || !myUserId) return;
  try {
    let peer = peers.get(fromUserId);
    if (!peer) peer = makePc(fromUserId);

    if (signal.kind === "offer") {
      await peer.pc.setRemoteDescription(signal.sdp);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      realtime.sendVoiceSignal(voiceChannelId, fromUserId, {
        kind: "answer",
        sdp: answer,
      });
      return;
    }
    if (signal.kind === "answer") {
      await peer.pc.setRemoteDescription(signal.sdp);
      return;
    }
    if (signal.kind === "ice" && signal.candidate) {
      try {
        await peer.pc.addIceCandidate(signal.candidate);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* Bad SDP / race during leave — don't crash the UI */
  }
}

export function setLocalVoiceState(nextMuted: boolean, nextDeafened: boolean) {
  muted = nextMuted;
  deafened = nextDeafened;
  if (localStream) {
    for (const track of localStream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }
  for (const peer of peers.values()) {
    peer.remoteAudio.muted = deafened;
  }
  if (channelId) {
    realtime.sendVoiceState(channelId, muted, deafened);
  }
}

export async function leaveVoiceMesh(notify = true) {
  if (notify && channelId) {
    realtime.sendVoiceLeave(channelId);
  }
  await stopVoiceGoLive();
  for (const peer of peers.values()) {
    peer.pc.close();
    peer.remoteAudio.srcObject = null;
  }
  peers.clear();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  channelId = null;
  myUserId = null;
}

export function currentVoiceChannel(): string | null {
  return channelId;
}
