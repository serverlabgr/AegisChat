import { useState } from "react";
import {
  Wrench,
  Dices,
  Coins,
  Palette,
  Copy,
  Check,
  Sparkles,
  Users,
  Shuffle,
  StickyNote,
} from "lucide-react";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { copyText } from "../../lib/clipboard";
import "./module.css";
import "./ToolboxScreen.css";

const ADJ = ["Shadow", "Neon", "Cyber", "Turbo", "Ghost", "Vortex", "Pixel", "Rogue", "Hyper", "Frost"];
const NOUN = ["Wolf", "Ninja", "Reaper", "Falcon", "Viper", "Dragon", "Phantom", "Blaze", "Nova", "Ranger"];

export function ToolboxScreen() {
  const { users, memberIds, toast } = useStore();
  const [die, setDie] = useState<number | null>(null);
  const [dieSize, setDieSize] = useState(6);
  const [coin, setCoin] = useState<string | null>(null);
  const [nick, setNick] = useState("NeonWolf_47");
  const [color, setColor] = useState("#5cc8ff");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = usePersisted("toolbox-notes", "");
  const [teams, setTeams] = useState<[string[], string[]] | null>(null);

  const roll = () => setDie(Math.floor(Math.random() * dieSize) + 1);
  const flip = () => setCoin(Math.random() < 0.5 ? "Κορώνα" : "Γράμματα");
  const genNick = () =>
    setNick(
      `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}_${Math.floor(Math.random() * 99)}`,
    );
  const copyColor = async () => {
    const ok = await copyText(color.toUpperCase());
    if (!ok) {
      toast("Δεν ήταν δυνατή η αντιγραφή");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const shuffleTeams = () => {
    const pool = [...memberIds].sort(() => Math.random() - 0.5);
    const half = Math.ceil(pool.length / 2);
    setTeams([pool.slice(0, half), pool.slice(half)]);
  };

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Wrench size={18} />
        </span>
        <span className="module__title">Toolbox</span>
        <span className="module__sub">χρήσιμα εργαλεία για την παρέα</span>
      </header>

      <div className="module__body">
        <div className="grid grid--tools">
          {/* Dice */}
          <div className="card tool">
            <div className="tool__head"><Dices size={16} /> Ζάρια</div>
            <div className={`tool__display${die ? " tool__display--pop" : ""}`}>
              {die ?? "–"}
            </div>
            <div className="tool__row">
              {[6, 12, 20].map((s) => (
                <button
                  key={s}
                  className={`tool__pill${dieSize === s ? " tool__pill--on" : ""}`}
                  onClick={() => setDieSize(s)}
                >
                  d{s}
                </button>
              ))}
            </div>
            <button className="btn btn--primary tool__cta" onClick={roll}>
              <Dices size={15} /> Ρίξε
            </button>
          </div>

          {/* Coin */}
          <div className="card tool">
            <div className="tool__head"><Coins size={16} /> Κορώνα-Γράμματα</div>
            <div className="tool__display tool__display--sm">{coin ?? "?"}</div>
            <button className="btn btn--primary tool__cta" onClick={flip}>
              <Coins size={15} /> Στρίψε
            </button>
          </div>

          {/* Nick generator */}
          <div className="card tool">
            <div className="tool__head"><Sparkles size={16} /> Gamer tag</div>
            <div className="tool__nick">{nick}</div>
            <button className="btn btn--primary tool__cta" onClick={genNick}>
              <Shuffle size={15} /> Νέο tag
            </button>
          </div>

          {/* Color picker */}
          <div className="card tool">
            <div className="tool__head"><Palette size={16} /> Color picker</div>
            <div className="tool__color">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <code>{color.toUpperCase()}</code>
            </div>
            <button className="btn tool__cta" onClick={() => void copyColor()}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy hex"}
            </button>
          </div>

          {/* Team randomizer */}
          <div className="card tool tool--wide">
            <div className="tool__head"><Users size={16} /> Team randomizer</div>
            {teams ? (
              <div className="tool__teams">
                {teams.map((team, i) => (
                  <div key={i} className="tool__team">
                    <span className="tool__team-label">Team {i + 1}</span>
                    {team.map((id) => (
                      <span key={id} className="tool__team-member">
                        {users[id]?.name ?? id}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="tool__hint">Χώρισε την παρέα σε 2 ομάδες με ένα κλικ.</p>
            )}
            <button className="btn btn--primary tool__cta" onClick={shuffleTeams}>
              <Shuffle size={15} /> Χώρισε ομάδες
            </button>
          </div>

          {/* Notes */}
          <div className="card tool tool--wide">
            <div className="tool__head"><StickyNote size={16} /> Σημειώσεις</div>
            <textarea
              className="tool__notes"
              placeholder="Γράψε ό,τι θες… (server IPs, seeds, plans)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
