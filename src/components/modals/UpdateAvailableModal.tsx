import { Download, Sparkles } from "lucide-react";
import { Modal } from "../common/Modal";
import "./UpdateAvailableModal.css";

interface Props {
  version: string;
  busy: boolean;
  onInstall: () => void;
  onSkip: () => void;
}

export function UpdateAvailableModal({
  version,
  busy,
  onInstall,
  onSkip,
}: Props) {
  return (
    <Modal
      title="Νέα έκδοση διαθέσιμη"
      subtitle="Live update από GitHub — χωρίς νέα εγκατάσταση από την αρχή."
      onClose={onSkip}
      width={440}
    >
      <div className="update-modal">
        <div className="update-modal__badge">
          <Sparkles size={18} />
          <span>Aegis v{version}</span>
        </div>
        <p className="update-modal__body">
          Θέλεις να κατεβάσεις και να εγκαταστήσεις την ενημέρωση τώρα; Η εφαρμογή
          θα επανεκκινηθεί μόνη της.
        </p>
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
            {busy ? "Εγκατάσταση…" : "Ενημέρωση τώρα"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
