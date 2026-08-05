import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Users,
  ExternalLink,
  Music2,
} from "lucide-react";
import { radioStations } from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { api } from "../../lib/api";
import type { RadioState } from "../../lib/voiceTypes";
import { parseSpotifyInput, type SpotifyEmbed } from "../../lib/spotify";
import "./module.css";
import "./RadioScreen.css";

type RadioTab = "live" | "spotify";

type BrowseStation = {
  id: string;
  name: string;
  genre: string;
  streamUrl: string;
  codec: string;
  bitrate: number;
};

export function RadioScreen() {
  const { toast, onlineMode, memberIds, users } = useStore();
  const [tab, setTab] = useState<RadioTab>("live");
  const [stationId, setStationId] = useState("skai");
  const [customUrl, setCustomUrl] = usePersisted("radio-custom-url", "");
  const [spotifyInput, setSpotifyInput] = usePersisted("radio-spotify-url", "");
  const [spotifyEmbed, setSpotifyEmbed] = useState<SpotifyEmbed | null>(null);
  const [browse, setBrowse] = useState<BrowseStation[]>([]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = usePersisted("radio-volume", 70);
  const [title, setTitle] = useState("Σίγαση");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const applyingRemote = useRef(false);

  const station = radioStations.find((s) => s.id === stationId) ?? radioStations[0];
  const streamUrl =
    stationId === "custom" ? customUrl.trim() : (station.streamUrl ?? "");

  const listeners = memberIds
    .map((id) => users[id])
    .filter(Boolean)
    .slice(0, 6);

  const pushState = (patch: Partial<RadioState>) => {
    if (!onlineMode || applyingRemote.current) return;
    void api("/radio/state", {
      method: "POST",
      body: {
        trackUrl: patch.trackUrl ?? streamUrl,
        title: patch.title ?? (stationId === "custom" ? "Custom" : station.name),
        playing: patch.playing ?? playing,
        position: patch.position ?? audioRef.current?.currentTime ?? 0,
        source: patch.source ?? "stream",
      },
    }).catch((err) =>
      toast(err instanceof Error ? err.message : "Αποτυχία radio sync"),
    );
  };

  const pushSpotifyState = (embed: SpotifyEmbed, label: string) => {
    if (!onlineMode || applyingRemote.current) return;
    void api("/radio/state", {
      method: "POST",
      body: {
        trackUrl: embed.openUrl,
        title: label,
        playing: true,
        position: 0,
        source: "spotify",
      },
    }).catch((err) =>
      toast(err instanceof Error ? err.message : "Αποτυχία Spotify sync"),
    );
  };

  const applyState = (state: RadioState) => {
    applyingRemote.current = true;

    if (state.source === "spotify" || parseSpotifyInput(state.trackUrl)) {
      const embed = parseSpotifyInput(state.trackUrl);
      setTab("spotify");
      setSpotifyEmbed(embed);
      setSpotifyInput(state.trackUrl);
      setTitle(state.title || "Spotify");
      setPlaying(state.playing);
      audioRef.current?.pause();
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
      return;
    }

    setTab("live");
    setSpotifyEmbed(null);
    setTitle(state.title || "Live");
    setPlaying(state.playing);
    const audio = audioRef.current;
    if (audio) {
      if (state.trackUrl && audio.src !== state.trackUrl) {
        audio.src = state.trackUrl;
      }
      if (state.playing) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
      if (Math.abs((audio.currentTime || 0) - state.position) > 2) {
        try {
          audio.currentTime = state.position;
        } catch {
          /* streams may not seek */
        }
      }
    }
    const match = radioStations.find((s) => s.streamUrl === state.trackUrl);
    if (match) setStationId(match.id);
    else if (state.trackUrl) {
      setStationId("custom");
      setCustomUrl(state.trackUrl);
    }
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const onState = (ev: Event) => {
      const detail = (ev as CustomEvent<RadioState>).detail;
      if (detail) applyState(detail);
    };
    window.addEventListener("aegis-radio-state", onState);
    return () => window.removeEventListener("aegis-radio-state", onState);
  }, []);

  useEffect(() => {
    if (!onlineMode) return;
    void api<{ state: RadioState }>("/radio/state")
      .then((r) => applyState(r.state))
      .catch(() => undefined);
    void api<{ stations: BrowseStation[] }>("/radio/stations")
      .then((r) => setBrowse(r.stations ?? []))
      .catch(() => undefined);
  }, [onlineMode]);

  const playStream = (url: string, label: string, id?: string) => {
    if (!url) {
      toast("Δεν υπάρχει URL ροής");
      return;
    }
    setTab("live");
    setSpotifyEmbed(null);
    if (id) setStationId(id);
    const audio = audioRef.current;
    if (audio) {
      audio.src = url;
      void audio.play().catch(() =>
        toast("Δεν παίζει η ροή — δοκίμασε άλλο σταθμό"),
      );
    }
    setPlaying(true);
    setTitle(label);
    pushState({
      trackUrl: url,
      title: label,
      playing: true,
      position: 0,
      source: "stream",
    });
    toast(`Live: ${label}`);
  };

  const selectStation = (id: string) => {
    const s = radioStations.find((x) => x.id === id);
    const url = id === "custom" ? customUrl.trim() : (s?.streamUrl ?? "");
    if (id === "custom" && !url) {
      toast("Βάλε URL ροής");
      return;
    }
    playStream(url, id === "custom" ? "Custom" : (s?.name ?? "Radio"), id);
  };

  const togglePlay = () => {
    if (tab === "spotify") {
      toast("Για Spotify πάτα play στο embed ή άνοιξε το Spotify app");
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (!streamUrl) {
      toast("Διάλεξε σταθμό ή βάλε URL");
      return;
    }
    if (!audio.src) audio.src = streamUrl;
    const next = !playing;
    if (next) void audio.play().catch(() => toast("Αποτυχία playback"));
    else audio.pause();
    setPlaying(next);
    pushState({ playing: next, trackUrl: streamUrl, source: "stream" });
  };

  const applySpotify = () => {
    const embed = parseSpotifyInput(spotifyInput);
    if (!embed) {
      toast("Μη έγκυρο Spotify link (playlist, album, track)");
      return;
    }
    setSpotifyEmbed(embed);
    setTab("spotify");
    setTitle(`Spotify · ${embed.kind}`);
    setPlaying(true);
    audioRef.current?.pause();
    pushSpotifyState(embed, `Spotify · ${embed.kind}`);
    toast("Spotify μοιράστηκε στην παρέα");
  };

  const displayName =
    tab === "spotify"
      ? title
      : stationId === "custom"
        ? "Custom stream"
        : station.name;
  const displayGenre =
    tab === "spotify"
      ? "Spotify — κάθε μέλος παίζει τοπικά (Premium για full tracks)"
      : station.genre;
  const accentColor = tab === "spotify" ? "#1db954" : station.color;

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Radio size={18} />
        </span>
        <span className="module__title">Ελληνικό Radio</span>
        <span className="module__sub">live + Spotify στην παρέα</span>
      </header>

      <div className="radio__tabs">
        <button
          type="button"
          className={`radio__tab${tab === "live" ? " radio__tab--active" : ""}`}
          onClick={() => setTab("live")}
        >
          <Radio size={14} /> Live GR
        </button>
        <button
          type="button"
          className={`radio__tab${tab === "spotify" ? " radio__tab--active" : ""}`}
          onClick={() => setTab("spotify")}
        >
          <Music2 size={14} /> Spotify
        </button>
      </div>

      <div className="module__body radio__body">
        <div
          className="radio__now card"
          style={{
            background: `linear-gradient(135deg, ${accentColor}33, rgba(20,26,48,0.6))`,
          }}
        >
          <div
            className="radio__art"
            style={{
              background: `linear-gradient(145deg, ${accentColor}, #7c8cff)`,
            }}
          >
            {tab === "spotify" ? (
              <Music2 size={48} color="white" />
            ) : (
              <div className={`radio__eq${playing ? " radio__eq--on" : ""}`}>
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <div className="radio__now-info">
            <span className="radio__now-label">
              <span className="dot dot--online" />
              {tab === "spotify"
                ? "SPOTIFY"
                : playing
                  ? "LIVE"
                  : "PAUSED"}{" "}
              · {title}
            </span>
            <h2>{displayName}</h2>
            <p>{displayGenre}</p>

            {tab === "live" ? (
              <div className="radio__controls">
                <button type="button" className="radio__play" onClick={togglePlay}>
                  {playing ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <div className="radio__volume">
                  <button
                    type="button"
                    className="radio__mute"
                    onClick={() => setVolume((v) => (v === 0 ? 70 : 0))}
                    title={volume === 0 ? "Unmute" : "Mute"}
                  >
                    {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : spotifyEmbed ? (
              <a
                className="radio__spotify-open"
                href={spotifyEmbed.openUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} /> Άνοιγμα στο Spotify
              </a>
            ) : null}
          </div>

          <div className="radio__together">
            <span className="radio__together-label">
              <Users size={13} /> Online
            </span>
            <div className="radio__together-avatars">
              {listeners.map((u) => (
                <div key={u.id} className="radio__together-avatar">
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: u.color,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {u.name.slice(0, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {tab === "spotify" ? (
          <div className="radio__spotify-panel">
            <p className="settings__hint">
              Βάλε link playlist/album/track από Spotify. Η παρέα βλέπει το ίδιο
              embed — το playback γίνεται τοπικά (απαιτείται Spotify account· Premium
              για on-demand tracks).
            </p>
            <label className="settings__field">
              <span>Spotify URL</span>
              <input
                value={spotifyInput}
                onChange={(e) => setSpotifyInput(e.target.value)}
                placeholder="https://open.spotify.com/playlist/…"
              />
            </label>
            <button type="button" className="btn btn--primary" onClick={applySpotify}>
              Μοιράσου στην παρέα
            </button>
            {spotifyEmbed ? (
              <iframe
                className="radio__spotify-embed"
                src={spotifyEmbed.embedUrl}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="Spotify embed"
              />
            ) : null}
          </div>
        ) : (
          <>
            <div className="module__section-title">Δημοφιλείς ελληνικοί σταθμοί</div>
            <div className="grid grid--cards">
              {radioStations
                .filter((s) => s.id !== "custom")
                .map((s) => {
                  const active = s.id === stationId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`card card--hover radio-station${active ? " radio-station--active" : ""}`}
                      onClick={() => selectStation(s.id)}
                    >
                      <span
                        className="radio-station__art"
                        style={{
                          background: `linear-gradient(145deg, ${s.color}, #7c8cff)`,
                        }}
                      >
                        {active && playing ? (
                          <Pause size={18} />
                        ) : (
                          <Play size={18} />
                        )}
                      </span>
                      <div className="radio-station__info">
                        <span className="radio-station__name">{s.name}</span>
                        <span className="radio-station__genre">{s.genre}</span>
                      </div>
                      {s.live ? (
                        <span className="radio-station__live">LIVE</span>
                      ) : null}
                    </button>
                  );
                })}
            </div>

            {browse.length > 0 ? (
              <>
                <div className="module__section-title">Περισσότεροι σταθμοί (Ελλάδα)</div>
                <div className="grid grid--cards radio__browse">
                  {browse.slice(0, 24).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="card card--hover radio-station"
                      onClick={() =>
                        playStream(s.streamUrl, s.name, undefined)
                      }
                    >
                      <span
                        className="radio-station__art"
                        style={{
                          background: "linear-gradient(145deg, #5cc8ff, #7c8cff)",
                        }}
                      >
                        <Play size={18} />
                      </span>
                      <div className="radio-station__info">
                        <span className="radio-station__name">{s.name}</span>
                        <span className="radio-station__genre">
                          {s.genre || "Greece"} · {s.codec}
                          {s.bitrate ? ` ${s.bitrate}k` : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <label
              className="settings__field"
              style={{ marginTop: 16, display: "block" }}
            >
              <span>Custom stream URL</span>
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onBlur={() => {
                  if (customUrl.trim()) selectStation("custom");
                }}
                placeholder="https://…/stream.mp3"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
