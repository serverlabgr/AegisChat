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
      subtitle="Κατεβάζει το Setup από GitHub και ανοίγει τον installer (όπως το ToolBox)."
      onClose={onSkip}
      width={440}
    >
      <div className="update-modal">
        <div className="update-modal__badge">
          <Sparkles size={18} />
          <span>Aegis v{version}</span>
        </div>
        <p className="update-modal__body">
          Θέλεις να κατεβάσεις το Setup και να τρέξεις τον installer τώρα; Η εφαρμογή
          θα κλείσει και θα ανοίξει ο οδηγός εγκατάστασης.
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
