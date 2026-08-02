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
let peers = new Map<string, Peer>();
let muted = false;
let deafened = false;
let myUserId: string | null = null;

function makePc(peerId: string): Peer {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
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
    if (stream) {
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
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  for (const track of localStream.getAudioTracks()) {
    track.enabled = !muted;
  }
  return localStream;
}

export async function joinVoiceMesh(
  voiceChannelId: string,
  userId: string,
  initialMuted: boolean,
  initialDeafened: boolean,
  existing: VoiceParticipant[],
) {
  await leaveVoiceMesh(false);
  channelId = voiceChannelId;
  myUserId = userId;
  muted = initialMuted;
  deafened = initialDeafened;
  await ensureLocalMic();
  realtime.sendVoiceJoin(voiceChannelId, muted, deafened);

  for (const p of existing) {
    if (p.userId === userId) continue;
    // Only the lower id offers to avoid glare
    const shouldOffer = userId < p.userId;
    await connectToPeer(p.userId, !shouldOffer);
  }
}

export async function syncVoiceParticipants(list: VoiceParticipant[]) {
  if (!channelId || !myUserId) return;
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
}

export async function handleVoiceSignal(
  voiceChannelId: string,
  fromUserId: string,
  _toUserId: string,
  signal: VoiceSignal,
) {
  if (voiceChannelId !== channelId || !myUserId) return;
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
