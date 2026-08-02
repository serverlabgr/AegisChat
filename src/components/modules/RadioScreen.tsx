import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Users,
} from "lucide-react";
import { radioStations } from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { api } from "../../lib/api";
import type { RadioState } from "../../lib/voiceTypes";
import "./module.css";
import "./RadioScreen.css";

export function RadioScreen() {
  const { toast, onlineMode, memberIds, users } = useStore();
  const [stationId, setStationId] = useState("lofi");
  const [customUrl, setCustomUrl] = usePersisted("radio-custom-url", "");
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
      },
    }).catch((err) =>
      toast(err instanceof Error ? err.message : "Αποτυχία radio sync"),
    );
  };

  const applyState = (state: RadioState) => {
    applyingRemote.current = true;
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
    // Match preset by URL
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
  }, [onlineMode]);

  const selectStation = (id: string) => {
    setStationId(id);
    const s = radioStations.find((x) => x.id === id);
    const url = id === "custom" ? customUrl.trim() : (s?.streamUrl ?? "");
    if (!url) {
      toast("Βάλε URL ροής");
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.src = url;
      void audio.play().catch(() => toast("Δεν παίζει η ροή (CORS/δίκτυο)"));
    }
    setPlaying(true);
    setTitle(id === "custom" ? "Custom" : (s?.name ?? "Radio"));
    pushState({
      trackUrl: url,
      title: id === "custom" ? "Custom" : s?.name,
      playing: true,
      position: 0,
    });
    toast(`Συντονίστηκες στο ${id === "custom" ? "Custom" : s?.name}`);
  };

  const togglePlay = () => {
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
    pushState({ playing: next, trackUrl: streamUrl });
  };

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Radio size={18} />
        </span>
        <span className="module__title">Online Radio</span>
        <span className="module__sub">συγχρονισμένο στην παρέα</span>
      </header>

      <div className="module__body radio__body">
        <div
          className="radio__now card"
          style={{
            background: `linear-gradient(135deg, ${station.color}33, rgba(20,26,48,0.6))`,
          }}
        >
          <div
            className="radio__art"
            style={{
              background: `linear-gradient(145deg, ${station.color}, #7c8cff)`,
            }}
          >
            <div className={`radio__eq${playing ? " radio__eq--on" : ""}`}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="radio__now-info">
            <span className="radio__now-label">
              <span className="dot dot--online" />
              {playing ? "LIVE" : "PAUSED"} · {title}
            </span>
            <h2>{station.name}</h2>
            <p>{station.genre}</p>

            <div className="radio__controls">
              <button className="radio__play" onClick={togglePlay}>
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <div className="radio__volume">
                <button
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
          </div>

          <div className="radio__together">
            <span className="radio__together-label">
              <Users size={13} /> Online
            </span>
            <div className="radio__together-avatars">
              {listeners.map((u) => (
                <div key={u.id} className="radio__together-avatar">
                  {/* Avatar via initials if needed */}
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

        <div className="module__section-title">Σταθμοί</div>
        <div className="grid grid--cards">
          {radioStations.map((s) => {
            const active = s.id === stationId;
            return (
              <button
                key={s.id}
                className={`card card--hover radio-station${active ? " radio-station--active" : ""}`}
                onClick={() => selectStation(s.id)}
              >
                <span
                  className="radio-station__art"
                  style={{
                    background: `linear-gradient(145deg, ${s.color}, #7c8cff)`,
                  }}
                >
                  {active && playing ? <Pause size={18} /> : <Play size={18} />}
                </span>
                <div className="radio-station__info">
                  <span className="radio-station__name">{s.name}</span>
                  <span className="radio-station__genre">{s.genre}</span>
                </div>
              </button>
            );
          })}
        </div>

        {stationId === "custom" ? (
          <label className="settings__field" style={{ marginTop: 16, display: "block" }}>
            <span>Stream URL</span>
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onBlur={() => {
                if (customUrl.trim()) selectStation("custom");
              }}
              placeholder="https://…/stream.mp3"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
