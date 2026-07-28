import { CheckCircle2 } from "lucide-react";
import { useStore } from "../../store/store";
import "./Toasts.css";

export function Toasts() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toasts__item">
          <CheckCircle2 size={15} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
