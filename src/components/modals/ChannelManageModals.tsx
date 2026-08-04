import { useState } from "react";
import { Hash, Radio, Trash2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore, ACCENT_OPTIONS } from "../../store/store";
import type { Channel } from "../../data/mock";
import { HOME_SERVER_ID } from "../../data/modules";
import "./ChannelManageModals.css";

export type ChannelModalMode =
  | { kind: "create"; type: "text" | "voice" }
  | { kind: "edit"; channel: Channel }
  | { kind: "delete"; channel: Channel }
  | { kind: "group" };

interface ChannelManageModalsProps {
  mode: ChannelModalMode;
  onClose: () => void;
  onSwitch: (mode: ChannelModalMode) => void;
}

export function ChannelManageModals({
  mode,
  onClose,
  onSwitch,
}: ChannelManageModalsProps) {
  const {
    createChannel,
    updateChannel,
    deleteChannel,
    updateGroup,
    activeGroupId,
    groups,
    homeChannels,
    toast,
  } = useStore();

  const activeGroup =
    activeGroupId === HOME_SERVER_ID
      ? null
      : groups.find((g) => g.id === activeGroupId) ?? null;

  const channelList =
    activeGroupId === HOME_SERVER_ID
      ? homeChannels
      : (activeGroup?.channels ?? []);

  const [name, setName] = useState(() => {
    if (mode.kind === "edit") return mode.channel.name;
    if (mode.kind === "group") return activeGroup?.name ?? "";
    return "";
  });
  const [topic, setTopic] = useState(() =>
    mode.kind === "edit" ? mode.channel.topic ?? "" : "",
  );
  const [color, setColor] = useState(
    () => activeGroup?.color ?? ACCENT_OPTIONS[0].value,
  );
  const [busy, setBusy] = useState(false);

  const submitCreate = async () => {
    if (mode.kind !== "create") return;
    if (!name.trim()) {
      toast("Βάλε όνομα καναλιού");
      return;
    }
    setBusy(true);
    const ok = await createChannel(
      name.trim(),
      mode.type,
      topic.trim() || undefined,
    );
    setBusy(false);
    if (ok) onClose();
  };

  const submitEdit = async () => {
    if (mode.kind !== "edit") return;
    if (!name.trim()) {
      toast("Βάλε όνομα καναλιού");
      return;
    }
    setBusy(true);
    const ok = await updateChannel(mode.channel.id, {
      name: name.trim(),
      topic: topic.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  };

  const submitDelete = async () => {
    if (mode.kind !== "delete") return;
    setBusy(true);
    const ok = await deleteChannel(mode.channel.id);
    setBusy(false);
    if (ok) onClose();
  };

  const submitGroup = async () => {
    if (!activeGroup) return;
    if (!name.trim()) {
      toast("Βάλε όνομα server");
      return;
    }
    setBusy(true);
    const ok = await updateGroup(activeGroup.id, {
      name: name.trim(),
      color,
    });
    setBusy(false);
    if (ok) onClose();
  };

  if (mode.kind === "create") {
    const isVoice = mode.type === "voice";
    return (
      <Modal
        title={isVoice ? "Νέο φωνητικό κανάλι" : "Νέο κανάλι κειμένου"}
        subtitle="Discord-style · encrypted"
        onClose={onClose}
        width={420}
      >
        <div className="ch-manage">
          <label className="ch-manage__field">
            <span>Όνομα</span>
            <div className="ch-manage__input-row">
              {isVoice ? <Radio size={16} /> : <Hash size={16} />}
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isVoice ? "Lounge" : "announcements"}
                maxLength={48}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCreate();
                }}
              />
            </div>
          </label>
          {!isVoice ? (
            <label className="ch-manage__field">
              <span>Θέμα (προαιρετικό)</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Περί τίνος πρόκειται…"
                maxLength={280}
              />
            </label>
          ) : null}
          <div className="ch-manage__actions">
            <button type="button" className="ch-manage__ghost" onClick={onClose}>
              Άκυρο
            </button>
            <button
              type="button"
              className="ch-manage__primary"
              disabled={busy}
              onClick={() => void submitCreate()}
            >
              Δημιουργία
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (mode.kind === "edit") {
    return (
      <Modal
        title="Επεξεργασία καναλιού"
        subtitle={`#${mode.channel.name}`}
        onClose={onClose}
        width={420}
      >
        <div className="ch-manage">
          <label className="ch-manage__field">
            <span>Όνομα</span>
            <div className="ch-manage__input-row">
              {mode.channel.type === "voice" ? (
                <Radio size={16} />
              ) : (
                <Hash size={16} />
              )}
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
              />
            </div>
          </label>
          {mode.channel.type === "text" ? (
            <label className="ch-manage__field">
              <span>Θέμα</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={280}
              />
            </label>
          ) : null}
          <div className="ch-manage__actions">
            <button type="button" className="ch-manage__ghost" onClick={onClose}>
              Άκυρο
            </button>
            <button
              type="button"
              className="ch-manage__primary"
              disabled={busy}
              onClick={() => void submitEdit()}
            >
              Αποθήκευση
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (mode.kind === "delete") {
    return (
      <Modal
        title="Διαγραφή καναλιού"
        subtitle="Αυτή η ενέργεια δεν αναιρείται"
        onClose={onClose}
        width={400}
      >
        <div className="ch-manage">
          <p className="ch-manage__warn">
            Θα διαγραφεί το{" "}
            <strong>
              {mode.channel.type === "voice" ? "" : "#"}
              {mode.channel.name}
            </strong>
            {mode.channel.type === "text"
              ? " και όλα τα μηνύματά του."
              : "."}
          </p>
          <div className="ch-manage__actions">
            <button type="button" className="ch-manage__ghost" onClick={onClose}>
              Άκυρο
            </button>
            <button
              type="button"
              className="ch-manage__danger"
              disabled={busy}
              onClick={() => void submitDelete()}
            >
              <Trash2 size={14} />
              Διαγραφή
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Ρυθμίσεις server"
      subtitle={activeGroup?.name ?? "η παρέα"}
      onClose={onClose}
      width={420}
    >
      <div className="ch-manage">
        {activeGroupId === HOME_SERVER_ID ? (
          <p className="ch-manage__hint">
            Το home server «η παρέα» δεν μετονομάζεται. Μόνο Admin μπορεί να
            προσθέτει/επεξεργάζεται κανάλια από τα κουμπιά + στις ενότητες.
          </p>
        ) : (
          <>
            <label className="ch-manage__field">
              <span>Όνομα server</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
              />
            </label>
            <div className="ch-manage__field">
              <span>Χρώμα</span>
              <div className="ch-manage__colors">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ch-manage__swatch${
                      color === opt.value ? " ch-manage__swatch--on" : ""
                    }`}
                    style={{ background: opt.value }}
                    title={opt.label}
                    onClick={() => setColor(opt.value)}
                  />
                ))}
              </div>
            </div>
            <div className="ch-manage__actions">
              <button type="button" className="ch-manage__ghost" onClick={onClose}>
                Άκυρο
              </button>
              <button
                type="button"
                className="ch-manage__primary"
                disabled={busy}
                onClick={() => void submitGroup()}
              >
                Αποθήκευση
              </button>
            </div>
          </>
        )}
        <div className="ch-manage__channel-list">
          <span className="ch-manage__list-label">Κανάλια</span>
          <ul>
            {channelList.map((ch) => (
              <li key={ch.id}>
                <span>
                  {ch.type === "voice" ? <Radio size={13} /> : <Hash size={13} />}
                  {ch.name}
                </span>
                <div className="ch-manage__list-actions">
                  <button
                    type="button"
                    onClick={() => onSwitch({ kind: "edit", channel: ch })}
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    className="ch-manage__link-danger"
                    onClick={() => onSwitch({ kind: "delete", channel: ch })}
                  >
                    Διαγραφή
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
