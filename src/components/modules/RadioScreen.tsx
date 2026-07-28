import { useEffect, useState } from "react";
import {
  Radio,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  Users,
} from "lucide-react";
import { radioStations, radioQueue } from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { Avatar } from "../common/Avatar";
import { SoonBanner } from "./SoonBanner";
import "./module.css";
import "./RadioScreen.css";

const TRACK_SECONDS = 45;

export function RadioScreen() {
  const { users, toast } = useStore();
  const [stationId, setStationId] = useState("lofi");
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = usePersisted("radio-volume", 70);
  const [trackIdx, setTrackIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [liked, setLiked] = usePersisted<string[]>("radio-liked", []);

  const station = radioStations.find((s) => s.id === stationId) ?? radioStations[0];
  const track = radioQueue[((trackIdx % radioQueue.length) + radioQueue.length) % radioQueue.length];
  const listeners = ["u2", "u4", "u5"].map((id) => users[id]).filter(Boolean);
  const isLiked = liked.includes(track.title);

  // Simulated playback: tick elapsed time, auto-advance to the next track.
  useEffect(() => {
    if (!playing) return;
    const tick = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= TRACK_SECONDS) {
          setTrackIdx((i) => i + 1);
          return 0;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [playing]);

  const changeTrack = (dir: 1 | -1) => {
    setTrackIdx((i) => i + dir);
    setElapsed(0);
  };

  const toggleLike = () => {
    setLiked((prev) =>
      isLiked ? prev.filter((t) => t !== track.title) : [...prev, track.title],
    );
    toast(isLiked ? "Αφαιρέθηκε από τα αγαπημένα" : `❤️ «${track.title}» στα αγαπημένα`);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Radio size={18} />
        </span>
        <span className="module__title">Online Radio</span>
        <span className="module__sub">ακούστε μαζί, live</span>
      </header>

      <div className="module__body radio__body">
        <SoonBanner feature="Radio" />
        <div
          className="radio__now card"
          style={{
            background: `linear-gradient(135deg, ${station.color}33, rgba(20,26,48,0.6))`,
          }}
        >
          <div className="radio__art" style={{ background: `linear-gradient(145deg, ${station.color}, #7c8cff)` }}>
            <div className={`radio__eq${playing ? " radio__eq--on" : ""}`}>
              <span /><span /><span /><span /><span />
            </div>
          </div>

          <div className="radio__now-info">
            <span className="radio__now-label">
              <span className="dot dot--online" />
              LIVE · {station.name}
            </span>
            <h2>{track.title}</h2>
            <p>{track.artist} — {track.album}</p>

            <div className="radio__progress">
              <span>{fmt(elapsed)}</span>
              <div className="radio__progress-bar">
                <div
                  className="radio__progress-fill"
                  style={{ width: `${(elapsed / TRACK_SECONDS) * 100}%` }}
                />
              </div>
              <span>{fmt(TRACK_SECONDS)}</span>
            </div>

            <div className="radio__controls">
              <button onClick={() => changeTrack(-1)} title="Προηγούμενο">
                <SkipBack size={18} />
              </button>
              <button className="radio__play" onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button onClick={() => changeTrack(1)} title="Επόμενο">
                <SkipForward size={18} />
              </button>
              <button
                className={`radio__like${isLiked ? " radio__like--on" : ""}`}
                onClick={toggleLike}
                title={isLiked ? "Στα αγαπημένα" : "Πρόσθεσε στα αγαπημένα"}
              >
                <Heart size={17} fill={isLiked ? "currentColor" : "none"} />
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
              <Users size={13} /> Ακούνε τώρα
            </span>
            <div className="radio__together-avatars">
              {listeners.map((u) => (
                <div key={u.id} className="radio__together-avatar">
                  <Avatar user={u} size={30} />
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
                onClick={() => {
                  if (active) {
                    setPlaying((p) => !p);
                  } else {
                    setStationId(s.id);
                    setPlaying(true);
                    setElapsed(0);
                    toast(`Συντονίστηκες στο ${s.name}`);
                  }
                }}
              >
                <span
                  className="radio-station__art"
                  style={{ background: `linear-gradient(145deg, ${s.color}, #7c8cff)` }}
                >
                  {active && playing ? <Pause size={18} /> : <Play size={18} />}
                </span>
                <div className="radio-station__info">
                  <span className="radio-station__name">{s.name}</span>
                  <span className="radio-station__genre">{s.genre}</span>
                </div>
                <span className="radio-station__listeners">
                  <Users size={12} />
                  {s.listeners}
                </span>
              </button>
            );
          })}
        </div>

        {liked.length > 0 ? (
          <>
            <div className="module__section-title">Αγαπημένα — {liked.length}</div>
            <div className="radio__liked">
              {liked.map((title) => (
                <span key={title} className="chip">
                  <Heart size={11} fill="currentColor" /> {title}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
