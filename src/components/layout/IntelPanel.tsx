import { Crown } from "lucide-react";
import { useStore } from "../../store/store";
import { Avatar } from "../common/Avatar";
import { SectionLabel } from "../common/Hud";
import "./IntelPanel.css";

interface IntelPanelProps {
  onSelectMember: (userId: string, e: React.MouseEvent) => void;
}

const statusLabel: Record<string, string> = {
  online: "διαθέσιμος",
  away: "λείπει",
  busy: "μην ενοχλείτε",
};

export function IntelPanel({ onSelectMember }: IntelPanelProps) {
  const { users, memberIds, getPing } = useStore();
  const members = memberIds.map((id) => users[id]).filter(Boolean);
  const online = members.filter((m) => m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  return (
    <aside className="intel">
      <div className="intel__scroll">
        <section className="intel__group">
          <SectionLabel trailing={`${online.length}`}>Online</SectionLabel>
          <ul className="intel__list">
            {online.map((m) => {
              const ping = getPing(m.id);
              return (
              <li key={m.id}>
                <button
                  type="button"
                  className="intel__peer"
                  onClick={(e) => onSelectMember(m.id, e)}
                >
                  <Avatar user={m} size={30} showStatus />
                  <div className="intel__peer-info">
                    <span className="intel__peer-name" style={{ color: m.color }}>
                      {m.name}
                      {m.role === "Admin" ? (
                        <Crown size={11} className="intel__crown" />
                      ) : null}
                    </span>
                    <span className="intel__peer-meta">
                      {statusLabel[m.status] ?? "διαθέσιμος"}
                      {ping != null ? ` · ${ping}ms` : ""}
                    </span>
                  </div>
                </button>
              </li>
              );
            })}
          </ul>
        </section>

        {offline.length > 0 ? (
          <section className="intel__group">
            <SectionLabel trailing={`${offline.length}`}>Offline</SectionLabel>
            <ul className="intel__list">
              {offline.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="intel__peer intel__peer--dim"
                    onClick={(e) => onSelectMember(m.id, e)}
                  >
                    <Avatar user={m} size={30} showStatus />
                    <div className="intel__peer-info">
                      <span className="intel__peer-name">{m.name}</span>
                      <span className="intel__peer-meta">εκτός σύνδεσης</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
