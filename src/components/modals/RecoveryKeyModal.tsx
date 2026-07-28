import { useState } from "react";
import { Copy, KeyRound, Shield } from "lucide-react";
import { Modal } from "../common/Modal";
import { copyText } from "../../lib/clipboard";
import { markRecoverySeen } from "../../lib/vault";
import "./RecoveryKeyModal.css";

interface Props {
  recoveryKey: string;
  onClose: () => void;
}

export function RecoveryKeyModal({ recoveryKey, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      title="Recovery Key παρέας"
      subtitle="Αυτό το κλειδί ξεκλειδώνει όλα τα κρυπτογραφημένα μηνύματα & media."
      onClose={() => {
        markRecoverySeen();
        onClose();
      }}
      width={520}
    >
      <div className="recovery-modal">
        <div className="recovery-modal__warn">
          <Shield size={18} />
          <p>
            Το server σου <strong>δεν</strong> κρατά αυτό το κλειδί — μόνο ciphertext.
            Μοιράσου το <strong>μόνο</strong> με την παρέα (πρόσωπο με πρόσωπο / ασφαλή
            κανάλι). Όποιος το έχει, διαβάζει το chat.
          </p>
        </div>
        <code className="recovery-modal__key">{recoveryKey}</code>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            void copyText(recoveryKey).then((ok) => {
              setCopied(ok);
              markRecoverySeen();
            });
          }}
        >
          <Copy size={15} />
          {copied ? "Αντιγράφηκε" : "Αντιγραφή κλειδιού"}
        </button>
        <p className="recovery-modal__hint">
          <KeyRound size={13} /> Οι φίλοι το βάζουν στο login στο πεδίο «Recovery Key».
        </p>
      </div>
    </Modal>
  );
}
