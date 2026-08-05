import { Download, Sparkles } from "lucide-react";
import { Modal } from "../common/Modal";
import "./UpdateAvailableModal.css";

interface Props {
  version: string;
  busy: boolean;
  /** Optional download percent 0–100 while busy */
  progressPercent?: number | null;
  statusText?: string | null;
  onInstall: () => void;
  onSkip: () => void;
}

export function UpdateAvailableModal({
  version,
  busy,
  progressPercent,
  statusText,
  onInstall,
  onSkip,
}: Props) {
  const busyLabel =
    statusText ??
    (typeof progressPercent === "number"
      ? `Λήψη… ${progressPercent}%`
      : "Ενημέρωση… η εφαρμογή θα επανεκκινήσει");

  return (
    <Modal
      title="Νέα έκδοση διαθέσιμη"
      subtitle="Ενημέρωση μέσα από το app — μικρή μπάρα προόδου, μετά επανεκκίνηση."
      onClose={onSkip}
      width={440}
    >
      <div className="update-modal">
        <div className="update-modal__badge">
          <Sparkles size={18} />
          <span>Aegis v{version}</span>
        </div>
        <p className="update-modal__body">
          Θέλεις να ενημερωθείς τώρα; Θα εμφανιστεί μικρή μπάρα εγκατάστασης και
          η εφαρμογή θα επανεκκινήσει μόνη της. Αν δεν ανοίξει σε ~30 δευτερόλεπτα,
          άνοιξέ την από το μενού Έναρξη.
        </p>
        {busy && typeof progressPercent === "number" ? (
          <div
            className="update-modal__progress"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="update-modal__progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : null}
        {busy ? (
          <p className="update-modal__status">{busyLabel}</p>
        ) : null}
        <div className="update-modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onSkip}
            disabled={busy}
          >
            Αργότερα
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onInstall}
            disabled={busy}
          >
            <Download size={16} />
            {busy ? "Ενημέρωση…" : "Ενημέρωση τώρα"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
