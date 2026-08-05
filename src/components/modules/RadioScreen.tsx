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

export function RadioScreen() {
  const { toast, onlineMode, memberIds, users } = useStore();
  const [tab, setTab] = useState<RadioTab>("live");
  const [stationId, setStationId] = useState(radioStations[0]?.id ?? "notesfm");
  const [spotifyInput, setSpotifyInput] = usePersisted("radio-spotify-url", "");
  const [spotifyEmbed, setSpotifyEmbed] = useState<SpotifyEmbed | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = usePersisted("radio-volume", 70);
  const [title, setTitle] = useState("Σίγαση");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const applyingRemote = useRef(false);

  const station =
    radioStations.find((s) => s.id === stationId) ?? radioStations[0];
  const streamUrl = station?.streamUrl ?? "";

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
        title: patch.title ?? station.name,
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
    if (audio && state.trackUrl) {
      if (!audio.src.endsWith(state.trackUrl)) {
        audio.src = state.trackUrl;
        audio.load();
      }
      if (state.playing) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    }
    const match = radioStations.find((s) => s.streamUrl === state.trackUrl);
    if (match) setStationId(match.id);
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    // Do NOT set crossOrigin — many Icecast/Shoutcast streams lack CORS
    // and HTML5 audio still plays fine without it.
    audioRef.current = audio;
    const onError = () => {
      setPlaying(false);
      const code = audio.error?.code;
      const hint =
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? "Η ροή δεν υποστηρίζεται"
          : code === MediaError.MEDIA_ERR_NETWORK
            ? "Πρόβλημα δικτύου με τη ροή"
            : "Αποτυχία playback";
      toast(hint);
    };
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [toast]);

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
  }, [onlineMode]);

  const playStream = (url: string, label: string, id: string) => {
    if (!url) {
      toast("Δεν υπάρχει URL ροής");
      return;
    }
    setTab("live");
    setSpotifyEmbed(null);
    setStationId(id);
    setTitle(label);
    const audio = audioRef.current;
    if (!audio) return;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      void audio
        .play()
        .then(() => {
          setPlaying(true);
          pushState({
            trackUrl: url,
            title: label,
            playing: true,
            position: 0,
            source: "stream",
          });
        })
        .catch((err: unknown) => {
          setPlaying(false);
          const name = err instanceof Error ? err.name : "";
          toast(
            name === "NotAllowedError"
              ? "Πάτα Play για να ξεκινήσει ο ήχος"
              : "Δεν παίζει η ροή — δοκίμασε άλλο σταθμό",
          );
        });
    };

    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start();
      return;
    }
    const onReady = () => {
      audio.removeEventListener("canplay", onReady);
      start();
    };
    audio.addEventListener("canplay", onReady);
    // Endless Icecast streams sometimes never fire canplay reliably.
    window.setTimeout(() => {
      audio.removeEventListener("canplay", onReady);
      start();
    }, 1200);
  };

  const selectStation = (id: string) => {
    const s = radioStations.find((x) => x.id === id);
    if (!s?.streamUrl) {
      toast("Ο σταθμός δεν έχει ροή");
      return;
    }
    playStream(s.streamUrl, s.name, id);
  };

  const togglePlay = () => {
    if (tab === "spotify") {
      toast("Για Spotify πάτα play στο embed");
      return;
    }
    if (!streamUrl) {
      toast("Διάλεξε σταθμό");
      return;
    }
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      pushState({ playing: false, trackUrl: streamUrl, source: "stream" });
      return;
    }
    playStream(streamUrl, station.name, stationId);
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

  const displayName = tab === "spotify" ? title : station.name;
  const displayGenre =
    tab === "spotify"
      ? "Spotify — τοπικό playback (Premium για full tracks)"
      : station.genre;
  const accentColor = tab === "spotify" ? "#1db954" : station.color;

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Radio size={18} />
        </span>
        <span className="module__title">Radio παρέας</span>
        <span className="module__sub">6 σταθμοί · live sync</span>
      </header>

      <div className="radio__tabs">
        <button
          type="button"
          className={`radio__tab${tab === "live" ? " radio__tab--active" : ""}`}
          onClick={() => setTab("live")}
        >
          <Radio size={14} /> Live
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
              Βάλε link playlist/album/track από Spotify για να το δει η παρέα.
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
            <div className="module__section-title">Σταθμοί</div>
            <div className="grid grid--cards">
              {radioStations.map((s) => {
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
          </>
        )}
      </div>
    </div>
  );
}
