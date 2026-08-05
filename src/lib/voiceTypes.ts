export type VoiceParticipant = {
  userId: string;
  muted: boolean;
  deafened: boolean;
};

export type RadioState = {
  trackUrl: string;
  title: string;
  playing: boolean;
  position: number;
  updatedAt: number;
  updatedBy: string | null;
  /** stream = HTML5 audio URL; spotify = open.spotify.com link for embed */
  source?: "stream" | "spotify";
};
